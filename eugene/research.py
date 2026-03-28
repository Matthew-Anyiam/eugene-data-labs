"""
Eugene Intelligence - Equity Research Agent

Generates AI-powered research briefs by synthesizing company data
from SEC filings, financial metrics, and market data.

Uses Claude Haiku with aggressive caching to minimize costs.
Rate-limited: 3 briefs/day for free users, unlimited for Pro.
"""

import json
import logging
import time
from collections import defaultdict
from eugene.cache import cached
from eugene.config import get_config
from eugene.router import query

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Rate limiting — per-IP daily limit
# ---------------------------------------------------------------------------
FREE_DAILY_LIMIT = 3

_usage: dict[str, list[float]] = defaultdict(list)  # ip -> [timestamps]


def check_rate_limit(client_ip: str) -> dict | None:
    """Check if client has exceeded daily research limit.
    Returns error dict if limited, None if OK.
    """
    now = time.time()
    day_ago = now - 86400

    # Clean old entries
    _usage[client_ip] = [t for t in _usage[client_ip] if t > day_ago]

    if len(_usage[client_ip]) >= FREE_DAILY_LIMIT:
        return {
            "ticker": "",
            "research": None,
            "rate_limited": True,
            "error": f"Free tier limit: {FREE_DAILY_LIMIT} research briefs per day. Upgrade to Pro for unlimited access.",
            "remaining": 0,
            "source": "eugene-research-agent",
        }
    return None


def record_usage(client_ip: str):
    """Record a research generation for rate limiting."""
    _usage[client_ip].append(time.time())


def get_remaining(client_ip: str) -> int:
    """Get remaining research briefs for today."""
    now = time.time()
    day_ago = now - 86400
    used = len([t for t in _usage.get(client_ip, []) if t > day_ago])
    return max(0, FREE_DAILY_LIMIT - used)


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------
RESEARCH_SYSTEM_PROMPT = """You are an equity research analyst at Eugene Intelligence. Generate a concise research brief for the given company based on the financial data provided.

Rules:
- Return ONLY valid JSON matching the schema below
- Be factual and data-driven — cite specific numbers from the data
- Never give buy/sell/hold recommendations
- Never predict future stock prices
- Use plain language accessible to non-experts
- Keep each section to 2-3 sentences
- If data is missing for a section, write "Insufficient data available."

JSON Schema:
{
  "company_overview": "string — what the company does, sector, scale",
  "financial_health": "string — profitability, margins, liquidity, debt levels",
  "key_metrics": "string — notable ratios, how they compare to typical ranges",
  "recent_developments": "string — insights from MD&A or recent filings",
  "risk_factors": "string — key risks from filings or financial position",
  "competitive_position": "string — market position, moat indicators",
  "outlook_summary": "string — neutral forward-looking context from filings"
}"""

RESEARCH_USER_PROMPT = """Generate an equity research brief for {ticker} ({company_name}) based on this data:

<profile>
{profile}
</profile>

<financial_metrics>
{metrics}
</financial_metrics>

<recent_financials>
{financials}
</recent_financials>

<mdna_section>
{mdna}
</mdna_section>

Return JSON only."""


# ---------------------------------------------------------------------------
# Data gathering
# ---------------------------------------------------------------------------
def _gather_company_data(ticker: str) -> dict:
    """Gather all available data for a company from existing sources."""
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

    # MD&A section (truncated to save tokens)
    try:
        sections_resp = query(ticker, "sections", section="mdna", limit=1)
        mdna = sections_resp.get("data", {}).get("sections", {}).get("mdna", {})
        text = mdna.get("text", "") if isinstance(mdna, dict) else ""
        data["mdna"] = text[:2000]  # Trimmed from 4K to 2K for cost savings
    except Exception as e:
        logger.warning(f"Research: failed to get MD&A for {ticker}: {e}")
        data["mdna"] = ""

    return data


def _truncate_for_prompt(obj: dict, max_chars: int = 2000) -> str:
    """Serialize dict to JSON string, truncated to max_chars."""
    text = json.dumps(obj, indent=1, default=str)
    if len(text) > max_chars:
        return text[:max_chars] + "\n... (truncated)"
    return text


# ---------------------------------------------------------------------------
# Research generation (cached)
# ---------------------------------------------------------------------------
@cached(ttl=3600, disk=True, disk_ttl=86400)
def generate_research(ticker: str) -> dict:
    """Generate an AI equity research brief for a ticker.

    Cached for 1 hour in memory, 24 hours on disk.
    """
    config = get_config()

    if not config.api.anthropic_api_key:
        return {
            "ticker": ticker,
            "research": None,
            "error": "Research agent requires an Anthropic API key. Set ANTHROPIC_API_KEY environment variable.",
            "source": "eugene-research-agent",
        }

    # Gather data from existing sources
    data = _gather_company_data(ticker)
    company_name = data["profile"].get("name") or data["profile"].get("company") or ticker

    # Build prompt with trimmed inputs
    prompt = RESEARCH_USER_PROMPT.format(
        ticker=ticker,
        company_name=company_name,
        profile=_truncate_for_prompt(data["profile"], 1000),
        metrics=_truncate_for_prompt(data["metrics"], 1500),
        financials=_truncate_for_prompt(data["financials"], 1500),
        mdna=data["mdna"][:2000] if data["mdna"] else "Not available.",
    )

    # Call Claude Haiku
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=config.api.anthropic_api_key)

        response = client.messages.create(
            model=config.api.anthropic_model,
            max_tokens=1500,  # Reduced from 2048
            temperature=0.1,
            system=RESEARCH_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = response.content[0].text
        # Parse JSON from response
        import re
        research = None
        try:
            research = json.loads(raw)
        except json.JSONDecodeError:
            m = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', raw)
            if m:
                research = json.loads(m.group(1))
            else:
                m = re.search(r'\{[\s\S]*\}', raw)
                if m:
                    research = json.loads(m.group())

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
            "tokens_used": response.usage.input_tokens + response.usage.output_tokens,
            "model": config.api.anthropic_model,
            "source": "eugene-research-agent",
            "disclaimer": "This is AI-generated analysis for informational purposes only. Not investment advice.",
        }

    except ImportError:
        return {
            "ticker": ticker,
            "research": None,
            "error": "anthropic package not installed",
            "source": "eugene-research-agent",
        }
    except Exception as e:
        logger.error(f"Research generation failed for {ticker}: {e}")
        return {
            "ticker": ticker,
            "research": None,
            "error": str(e),
            "source": "eugene-research-agent",
        }
