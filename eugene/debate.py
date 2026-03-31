"""
Eugene Intelligence - Bull/Bear Debate Agent

Runs three sequential Claude Haiku calls:
1. Bull agent — strongest investment case using real SEC data
2. Bear agent — strongest case against using real SEC data
3. Synthesis agent — weighs both arguments, produces balanced verdict
"""

import json
import logging

from eugene.cache import cached
from eugene.llm import chat_json, available_providers
from eugene.research import _gather_company_data, _truncate_for_prompt

logger = logging.getLogger(__name__)

BULL_SYSTEM_PROMPT = """You are a bullish equity analyst. Make the strongest possible investment case for this company using ONLY the data provided.

Focus on:
- Revenue/earnings growth signals
- Insider buying patterns (confidence signal)
- Strong balance sheet metrics
- Positive 8-K events or strategic moves
- Competitive advantages from filings

Return ONLY valid JSON:
{
  "thesis": "string — 2-3 sentence bull thesis",
  "key_points": ["string — specific data-backed argument", ...],
  "confidence": 0.0-1.0
}"""

BEAR_SYSTEM_PROMPT = """You are a bearish equity analyst. Make the strongest possible case AGAINST investing in this company using ONLY the data provided.

Focus on:
- Declining margins, revenue, or earnings
- Insider selling patterns (red flag)
- High debt or liquidity concerns
- Negative 8-K events or risks from filings
- Competitive threats or market headwinds

Return ONLY valid JSON:
{
  "thesis": "string — 2-3 sentence bear thesis",
  "key_points": ["string — specific data-backed argument", ...],
  "confidence": 0.0-1.0
}"""

SYNTHESIS_SYSTEM_PROMPT = """You are a senior research director. You have received bull and bear arguments for a company. Synthesize them into a balanced verdict.

Weigh the evidence quality, not just quantity. Cite specific data points from each side.

Return ONLY valid JSON:
{
  "verdict": "string — 2-3 sentence balanced conclusion",
  "conviction": "strong-bull|moderate-bull|neutral|moderate-bear|strong-bear",
  "key_risks": ["string — top risk from bear case", ...],
  "key_catalysts": ["string — top catalyst from bull case", ...],
  "summary": "string — 3-4 sentence synthesis paragraph connecting both perspectives"
}"""


def _build_data_prompt(ticker: str, company_name: str, data: dict) -> str:
    """Build the data context prompt shared by all agents."""
    return f"""Company: {ticker} ({company_name})

<profile>
{_truncate_for_prompt(data["profile"], 1000)}
</profile>

<financial_metrics>
{_truncate_for_prompt(data["metrics"], 1500)}
</financial_metrics>

<recent_financials>
{_truncate_for_prompt(data["financials"], 1500)}
</recent_financials>

<insider_trading>
{_truncate_for_prompt(data["insiders"], 1500)}
</insider_trading>

<institutional_holdings>
{_truncate_for_prompt(data["holdings"], 1000)}
</institutional_holdings>

<recent_8k_events>
{_truncate_for_prompt(data["events"], 1000)}
</recent_8k_events>

<mdna_section>
{data["mdna"][:2000] if data["mdna"] else "Not available."}
</mdna_section>"""


@cached(ttl=3600, disk=True, disk_ttl=86400)
def generate_debate(ticker: str) -> dict:
    """Generate a bull/bear debate analysis for a ticker.

    Three sequential LLM calls: bull case, bear case, synthesis.
    Cached for 1 hour in memory, 24 hours on disk.
    """
    if not available_providers():
        return {
            "ticker": ticker,
            "mode": "debate",
            "error": "No AI provider configured. Set ANTHROPIC_API_KEY, KIMI_API_KEY, or GLM_API_KEY.",
            "source": "eugene-debate-agent",
        }

    # Gather data once
    data = _gather_company_data(ticker)
    company_name = data["profile"].get("name") or data["profile"].get("company") or ticker
    data_prompt = _build_data_prompt(ticker, company_name, data)

    try:
        total_tokens = 0
        provider_used = None

        # 1. Bull case
        bull_prompt = f"{data_prompt}\n\nMake the strongest bull case for investing in {ticker}. Return JSON only."
        bull_result, bull_resp = chat_json(BULL_SYSTEM_PROMPT, bull_prompt, 1000, 0.3)
        total_tokens += bull_resp.total_tokens
        provider_used = bull_resp.provider

        # 2. Bear case
        bear_prompt = f"{data_prompt}\n\nMake the strongest bear case against investing in {ticker}. Return JSON only."
        bear_result, bear_resp = chat_json(BEAR_SYSTEM_PROMPT, bear_prompt, 1000, 0.3)
        total_tokens += bear_resp.total_tokens

        # 3. Synthesis
        synthesis_result = None
        if bull_result and bear_result:
            synth_prompt = f"""Company: {ticker} ({company_name})

<bull_case>
{json.dumps(bull_result, indent=1)}
</bull_case>

<bear_case>
{json.dumps(bear_result, indent=1)}
</bear_case>

Synthesize these arguments into a balanced verdict. Return JSON only."""
            synthesis_result, synth_resp = chat_json(SYNTHESIS_SYSTEM_PROMPT, synth_prompt, 1500, 0.1)
            total_tokens += synth_resp.total_tokens

        return {
            "ticker": ticker,
            "company_name": company_name,
            "mode": "debate",
            "bull_case": bull_result,
            "bear_case": bear_result,
            "synthesis": synthesis_result,
            "tokens_used": total_tokens,
            "model": bull_resp.model,
            "provider": provider_used,
            "source": "eugene-debate-agent",
            "disclaimer": "AI-generated analysis for informational purposes only. Not investment advice.",
        }

    except Exception as e:
        logger.error(f"Debate generation failed for {ticker}: {type(e).__name__}: {e}")
        return {
            "ticker": ticker,
            "mode": "debate",
            "error": str(e),
            "source": "eugene-debate-agent",
        }
