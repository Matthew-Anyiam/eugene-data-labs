"""
Eugene Intelligence - Equity Research Agent

Generates AI-powered deep research briefs by synthesizing company data
from SEC filings, financial metrics, insider trades, institutional holdings,
corporate events, and market data.

Uses Claude Haiku with aggressive caching to minimize costs.
Rate-limited: 3 briefs/day for free users, unlimited for Pro.
"""

import json
import logging
from eugene.cache import cached
from eugene.router import query
from eugene.db import check_research_rate_limit, _record_research_usage, get_research_remaining

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Rate limiting — per-IP daily limit (backed by SQLite via eugene.db)
# ---------------------------------------------------------------------------
FREE_DAILY_LIMIT = 3


def check_rate_limit(client_ip: str) -> dict | None:
    """Check if client has exceeded daily research limit.
    Returns error dict if limited, None if OK.
    """
    return check_research_rate_limit(client_ip, daily_limit=FREE_DAILY_LIMIT)


def record_usage(client_ip: str):
    """Record a research generation for rate limiting."""
    _record_research_usage(client_ip)


def get_remaining(client_ip: str) -> int:
    """Get remaining research briefs for today."""
    return get_research_remaining(client_ip, daily_limit=FREE_DAILY_LIMIT)


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------
RESEARCH_SYSTEM_PROMPT = """You are a senior equity research analyst at Eugene Intelligence. Generate a comprehensive research brief for the given company based on ALL the data provided — financials, insider activity, institutional holdings, recent corporate events, and filing narratives.

Rules:
- Return ONLY valid JSON matching the schema below
- Be factual and data-driven — cite specific numbers, dates, and names from the data
- Synthesize across data sources — connect insider trades to financial performance, link 8-K events to outlook
- Never give buy/sell/hold recommendations
- Never predict future stock prices
- Use plain language accessible to non-experts
- Keep each section to 3-5 sentences for depth
- If data is missing for a section, write "Insufficient data available."

JSON Schema:
{
  "company_overview": "string — what the company does, sector, scale, market position",
  "financial_health": "string — profitability, margins, revenue trends, liquidity, debt levels",
  "key_metrics": "string — notable ratios with context on what they indicate",
  "insider_activity": "string — recent insider buying/selling patterns, who is trading, sentiment signal",
  "institutional_holdings": "string — major institutional holders, concentration, changes",
  "recent_events": "string — recent 8-K filings, corporate actions, material events",
  "recent_developments": "string — insights from MD&A, management commentary, strategic direction",
  "risk_factors": "string — key risks from filings, financial position, or market dynamics",
  "competitive_position": "string — market position, moat indicators, peer comparison if available",
  "market_sentiment": "string — prediction market consensus if available, crowd expectations vs fundamental view",
  "outlook_summary": "string — neutral forward-looking context synthesizing all data sources including prediction markets"
}"""

RESEARCH_USER_PROMPT = """Generate a deep equity research brief for {ticker} ({company_name}) based on this comprehensive data package:

<profile>
{profile}
</profile>

<financial_metrics>
{metrics}
</financial_metrics>

<recent_financials>
{financials}
</recent_financials>

<insider_trading>
{insiders}
</insider_trading>

<institutional_holdings>
{holdings}
</institutional_holdings>

<recent_8k_events>
{events}
</recent_8k_events>

<recent_filings>
{filings}
</recent_filings>

<mdna_section>
{mdna}
</mdna_section>

<prediction_markets>
{predictions}
</prediction_markets>

Synthesize ALL data sources to produce a thorough research brief. Connect the dots — if insiders are buying while financials show growth, note it. If 8-K events signal major changes, analyze implications. If prediction market data is available, compare crowd expectations to fundamental data.

Return JSON only."""

SCENARIO_ADDENDUM = """

ADDITIONAL INSTRUCTION — SCENARIO ANALYSIS:
The user wants you to analyze this company under the following hypothetical scenario:

<scenario>
{scenario}
</scenario>

Add an extra field to your JSON response:
  "scenario_analysis": "string — detailed analysis of how this scenario would impact the company, based on the data provided. Reference specific financials, insider positions, sector exposure, or risk factors that are relevant to this scenario. 3-5 sentences."

Incorporate the scenario's implications into your other sections where relevant (e.g., risk_factors, outlook_summary)."""


# ---------------------------------------------------------------------------
# Data gathering
# ---------------------------------------------------------------------------
def _gather_company_data(ticker: str) -> dict:
    """Gather comprehensive data for a company from all available sources."""
    data = {}

    # Profile
    try:
        profile_resp = query(ticker, "profile")
        data["profile"] = profile_resp.get("data", {})
    except Exception as e:
        logger.warning(f"Research: failed to get profile for {ticker}: {e}")
        data["profile"] = {}

    # Metrics (latest period)
    try:
        metrics_resp = query(ticker, "metrics", limit=1)
        periods = metrics_resp.get("data", {}).get("periods", [])
        data["metrics"] = periods[0].get("ratios", {}) if periods else {}
    except Exception as e:
        logger.warning(f"Research: failed to get metrics for {ticker}: {e}")
        data["metrics"] = {}

    # Financials (latest period)
    try:
        fin_resp = query(ticker, "financials", period="FY", limit=1)
        periods = fin_resp.get("data", {}).get("periods", [])
        if periods:
            p = periods[0]
            data["financials"] = {
                "period_end": p.get("period_end"),
                "income_statement": {k: v.get("value") for k, v in p.get("income_statement", {}).items()},
                "balance_sheet": {k: v.get("value") for k, v in p.get("balance_sheet", {}).items()},
            }
        else:
            data["financials"] = {}
    except Exception as e:
        logger.warning(f"Research: failed to get financials for {ticker}: {e}")
        data["financials"] = {}

    # Insider trades (recent Form 4 filings)
    try:
        insiders_resp = query(ticker, "insiders", limit=10)
        insiders_data = insiders_resp.get("data", {})
        # Extract summary and recent trades
        summary = insiders_data.get("summary", {})
        sentiment = insiders_data.get("sentiment", {})
        trades = []
        for filing in insiders_data.get("insider_filings", [])[:5]:
            owner = filing.get("owner", {})
            for txn in filing.get("transactions", [])[:2]:
                trades.append({
                    "date": txn.get("date"),
                    "name": owner.get("name"),
                    "title": owner.get("title"),
                    "type": txn.get("transaction_type"),
                    "shares": txn.get("shares"),
                    "price": txn.get("price_per_share"),
                })
        data["insiders"] = {
            "summary": summary,
            "sentiment": sentiment,
            "recent_trades": trades,
        }
    except Exception as e:
        logger.warning(f"Research: failed to get insiders for {ticker}: {e}")
        data["insiders"] = {}

    # Institutional holdings (13F)
    try:
        ownership_resp = query(ticker, "ownership", limit=3)
        ownership_data = ownership_resp.get("data", {})
        holdings = []
        for filing in ownership_data.get("ownership_filings", [])[:1]:
            for h in filing.get("holdings", [])[:10]:
                holdings.append({
                    "issuer": h.get("issuer"),
                    "value_thousands": h.get("value_thousands"),
                    "shares": h.get("shares"),
                })
            data["holdings"] = {
                "filed_date": filing.get("filed_date"),
                "total_value_thousands": filing.get("total_value_thousands"),
                "position_count": filing.get("position_count"),
                "top_holdings": holdings,
            }
        if not holdings:
            data["holdings"] = {}
    except Exception as e:
        logger.warning(f"Research: failed to get ownership for {ticker}: {e}")
        data["holdings"] = {}

    # Recent 8-K events (corporate news from SEC)
    try:
        events_resp = query(ticker, "events", limit=10)
        events_data = events_resp.get("data", {})
        events = []
        for ev in events_data.get("events", [])[:10]:
            events.append({
                "date": ev.get("filed_date"),
                "form": ev.get("form"),
                "description": ev.get("description"),
            })
        data["events"] = events
    except Exception as e:
        logger.warning(f"Research: failed to get events for {ticker}: {e}")
        data["events"] = []

    # Recent filings (all types)
    try:
        filings_resp = query(ticker, "filings", limit=10)
        filings_data = filings_resp.get("data", {})
        filings = []
        for f in filings_data.get("filings", [])[:10]:
            filings.append({
                "date": f.get("filed_date"),
                "form": f.get("form"),
                "description": f.get("description"),
            })
        data["filings"] = filings
    except Exception as e:
        logger.warning(f"Research: failed to get filings for {ticker}: {e}")
        data["filings"] = []

    # MD&A section (truncated to save tokens)
    try:
        sections_resp = query(ticker, "sections", section="mdna", limit=1)
        mdna = sections_resp.get("data", {}).get("sections", {}).get("mdna", {})
        text = mdna.get("text", "") if isinstance(mdna, dict) else ""
        data["mdna"] = text[:2000]
    except Exception as e:
        logger.warning(f"Research: failed to get MD&A for {ticker}: {e}")
        data["mdna"] = ""

    # Prediction market data (Polymarket + Kalshi)
    try:
        from eugene.sources.predictions import get_predictions
        pred_resp = get_predictions(query=ticker, limit=5)
        predictions = []
        for p in pred_resp.get("predictions", [])[:5]:
            predictions.append({
                "question": p.get("question"),
                "outcomes": p.get("outcomes"),
                "yes_pct": p.get("yes_probability_pct"),
                "source": p.get("source"),
            })
        data["predictions"] = predictions
    except Exception as e:
        logger.warning(f"Research: failed to get predictions for {ticker}: {e}")
        data["predictions"] = []

    return data


def _truncate_for_prompt(obj, max_chars: int = 2000) -> str:
    """Serialize dict/list to JSON string, truncated to max_chars."""
    text = json.dumps(obj, indent=1, default=str)
    if len(text) > max_chars:
        return text[:max_chars] + "\n... (truncated)"
    return text


# ---------------------------------------------------------------------------
# Research generation (cached)
# ---------------------------------------------------------------------------
@cached(ttl=3600, disk=True, disk_ttl=86400)
def generate_research(ticker: str, scenario: str = None) -> dict:
    """Generate a deep AI equity research brief for a ticker.

    Cached for 1 hour in memory, 24 hours on disk.
    """
    from eugene.llm import chat_json, available_providers

    if not available_providers():
        return {
            "ticker": ticker,
            "research": None,
            "error": "No AI provider configured. Set ANTHROPIC_API_KEY, KIMI_API_KEY, or GLM_API_KEY.",
            "source": "eugene-research-agent",
        }

    # Gather comprehensive data from all sources
    data = _gather_company_data(ticker)
    company_name = data["profile"].get("name") or data["profile"].get("company") or ticker

    # Build prompt with all data sources
    prompt = RESEARCH_USER_PROMPT.format(
        ticker=ticker,
        company_name=company_name,
        profile=_truncate_for_prompt(data["profile"], 1000),
        metrics=_truncate_for_prompt(data["metrics"], 1500),
        financials=_truncate_for_prompt(data["financials"], 1500),
        insiders=_truncate_for_prompt(data["insiders"], 1500),
        holdings=_truncate_for_prompt(data["holdings"], 1000),
        events=_truncate_for_prompt(data["events"], 1000),
        filings=_truncate_for_prompt(data["filings"], 800),
        mdna=data["mdna"][:2000] if data["mdna"] else "Not available.",
        predictions=_truncate_for_prompt(data["predictions"], 1000) if data.get("predictions") else "No prediction market data available.",
    )

    # Append scenario analysis instruction if provided
    if scenario:
        prompt += SCENARIO_ADDENDUM.format(scenario=scenario)

    try:
        research, response = chat_json(
            system=RESEARCH_SYSTEM_PROMPT,
            user=prompt,
            max_tokens=2000,
            temperature=0.1,
        )

        if not research:
            return {
                "ticker": ticker,
                "research": None,
                "error": "Failed to parse research response",
                "source": "eugene-research-agent",
            }

        return {
            "ticker": ticker,
            "company_name": company_name,
            "research": research,
            "tokens_used": response.total_tokens,
            "model": response.model,
            "provider": response.provider,
            "source": "eugene-research-agent",
            "disclaimer": "This is AI-generated analysis for informational purposes only. Not investment advice. Based on SEC filings and public data.",
        }

    except Exception as e:
        logger.error(f"Research generation failed for {ticker}: {type(e).__name__}: {e}")
        return {
            "ticker": ticker,
            "research": None,
            "error": str(e),
            "source": "eugene-research-agent",
        }
