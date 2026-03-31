"""
Eugene Intelligence - Multi-Agent Market Simulation

Creates AI agent personas (analyst, trader, insider, institutional, macro)
that interact with real SEC + FRED data to produce emergent market predictions.
"""

import json
import logging
import re
from eugene.cache import cached
from eugene.config import get_config
from eugene.router import query
from eugene.research import _gather_company_data, _truncate_for_prompt
from eugene.db import check_research_rate_limit, _record_research_usage, get_research_remaining

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Rate limiting — shares quota with research (per-IP daily limit)
# ---------------------------------------------------------------------------
FREE_DAILY_LIMIT = 3


def check_rate_limit(client_ip: str) -> dict | None:
    """Check if client has exceeded daily simulation limit."""
    return check_research_rate_limit(client_ip, daily_limit=FREE_DAILY_LIMIT)


def record_usage(client_ip: str):
    """Record a simulation run for rate limiting."""
    _record_research_usage(client_ip)


def get_remaining(client_ip: str) -> int:
    """Get remaining simulation runs for today."""
    return get_research_remaining(client_ip, daily_limit=FREE_DAILY_LIMIT)


# ---------------------------------------------------------------------------
# Agent Persona Prompts
# ---------------------------------------------------------------------------

ANALYST_PERSONA = """You are a senior fundamental equity analyst. You evaluate companies based on financial statements, valuation ratios, profitability metrics, and business quality.

Analyze the provided financial data and company profile. Focus on:
- Revenue growth trajectory and margin trends
- Balance sheet strength (debt levels, cash position, liquidity)
- Valuation relative to earnings, cash flow, and book value
- Return on equity and capital efficiency
- Quality of earnings and accounting red flags

{scenario_instruction}

Return ONLY valid JSON:
{{
  "action": "bullish" or "bearish" or "neutral",
  "reasoning": "2-3 sentences explaining your fundamental view",
  "confidence": 0.0 to 1.0,
  "key_signal": "single most important fundamental signal"
}}"""

TRADER_PERSONA = """You are an experienced technical trader and quantitative analyst. You focus on price action, momentum, volume patterns, and technical indicators.

Analyze the provided price and technical data. Focus on:
- Price momentum (short-term and medium-term trends)
- Volume patterns and anomalies
- Moving average relationships (50/200 day)
- Support and resistance levels
- RSI, MACD, and other momentum indicators
- Volatility regime

{scenario_instruction}

Return ONLY valid JSON:
{{
  "action": "bullish" or "bearish" or "neutral",
  "reasoning": "2-3 sentences explaining your technical view",
  "confidence": 0.0 to 1.0,
  "key_signal": "single most important technical signal"
}}"""

INSIDER_PERSONA = """You are a specialist in analyzing insider trading patterns from SEC Form 4 filings. You model executive confidence through their buying and selling behavior.

Analyze the provided insider trading data. Focus on:
- Net insider buying vs selling (shares and dollar amounts)
- Cluster buys (multiple insiders buying around the same time)
- C-suite transactions (CEO, CFO purchases are strongest signals)
- Transaction size relative to holdings
- Timing relative to earnings or major events
- Historical insider accuracy for this company

{scenario_instruction}

Return ONLY valid JSON:
{{
  "action": "bullish" or "bearish" or "neutral",
  "reasoning": "2-3 sentences explaining the insider sentiment signal",
  "confidence": 0.0 to 1.0,
  "key_signal": "single most important insider trading signal"
}}"""

INSTITUTIONAL_PERSONA = """You are an institutional flow analyst who tracks 13F filings, smart money positioning, and sector rotation patterns.

Analyze the provided institutional holdings and ownership data. Focus on:
- Top institutional holders and their conviction levels
- Concentration of ownership (top 10 holders as % of float)
- Recent changes in institutional positioning
- Smart money flow direction (are top funds adding or reducing?)
- Sector allocation shifts
- Position sizing relative to fund AUM

{scenario_instruction}

Return ONLY valid JSON:
{{
  "action": "bullish" or "bearish" or "neutral",
  "reasoning": "2-3 sentences explaining the institutional positioning view",
  "confidence": 0.0 to 1.0,
  "key_signal": "single most important institutional flow signal"
}}"""

MACRO_PERSONA = """You are a macroeconomic strategist who interprets FRED economic data, monetary policy, rates, and inflation to assess the investing environment.

Analyze the provided macroeconomic data in the context of this company's sector. Focus on:
- Interest rate environment and Fed policy direction
- Inflation trends (CPI, PCE) and implications
- Employment data and consumer health
- GDP growth trajectory
- Sector-specific macro sensitivity (e.g., tech vs rates, housing vs mortgage rates)
- Credit conditions and financial stress indicators

{scenario_instruction}

Return ONLY valid JSON:
{{
  "action": "bullish" or "bearish" or "neutral",
  "reasoning": "2-3 sentences explaining the macro environment view for this stock",
  "confidence": 0.0 to 1.0,
  "key_signal": "single most important macro signal"
}}"""

SYNTHESIS_PROMPT = """You are the chief strategist at Eugene Intelligence. You must synthesize the views of 5 independent AI agents into a coherent market simulation result.

The agents analyzed {ticker}{scenario_context}:

{agent_summaries}

Produce a synthesis that:
1. Identifies the consensus direction (bullish/bearish/neutral based on majority vote)
2. Weighs higher-confidence views more heavily
3. Notes where agents converge (agreement strengthens conviction)
4. Notes where agents diverge (disagreement reduces conviction)
5. Extracts the top 3-5 key signals across all agents
6. Writes a concise narrative paragraph (3-5 sentences) synthesizing the overall picture

Return ONLY valid JSON:
{{
  "consensus": "bullish" or "bearish" or "neutral",
  "confidence": 0.0 to 1.0 (weighted average confidence),
  "convergence_score": 0.0 to 1.0 (how much agents agreed),
  "key_signals": ["signal 1", "signal 2", "signal 3"],
  "narrative": "3-5 sentence synthesis paragraph"
}}"""


# ---------------------------------------------------------------------------
# Data gathering — extends research data with macro + technicals + OHLCV
# ---------------------------------------------------------------------------
def _gather_simulation_data(ticker: str) -> dict:
    """Gather ALL available data for simulation: company data + macro + technicals + price."""
    # Start with everything from research
    data = _gather_company_data(ticker)

    # Add FRED macro data
    try:
        from eugene.sources.fred import get_all as fred_get_all
        fred_data = fred_get_all()
        data["fred_macro"] = fred_data
    except Exception as e:
        logger.warning(f"Simulation: failed to get FRED macro data: {e}")
        data["fred_macro"] = {}

    # Add technical indicators
    try:
        technicals_resp = query(ticker, "technicals")
        data["technicals"] = technicals_resp.get("data", {})
    except Exception as e:
        logger.warning(f"Simulation: failed to get technicals for {ticker}: {e}")
        data["technicals"] = {}

    # Add OHLCV price data
    try:
        ohlcv_resp = query(ticker, "ohlcv")
        data["ohlcv"] = ohlcv_resp.get("data", {})
    except Exception as e:
        logger.warning(f"Simulation: failed to get OHLCV for {ticker}: {e}")
        data["ohlcv"] = {}

    return data


# ---------------------------------------------------------------------------
# Agent runner
# ---------------------------------------------------------------------------
def _parse_agent_json(raw: str) -> dict | None:
    """Parse JSON from agent response, handling code blocks and bare JSON."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    # Try extracting from code block
    m = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', raw)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass
    # Try extracting bare JSON object
    m = re.search(r'\{[\s\S]*\}', raw)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass
    return None


def _run_agent(persona_prompt: str, data_slice: dict, ticker: str, scenario: str = None) -> dict:
    """Run a single agent persona against its relevant data slice.

    Returns the agent's decision dict with action, reasoning, confidence, key_signal.
    """
    config = get_config()

    scenario_instruction = ""
    if scenario:
        scenario_instruction = f"Consider this scenario in your analysis: {scenario}"

    prompt = persona_prompt.format(scenario_instruction=scenario_instruction)

    user_content = f"""Analyze {ticker} based on this data:

<data>
{_truncate_for_prompt(data_slice, 3000)}
</data>

Return your JSON verdict."""

    import anthropic
    client = anthropic.Anthropic(api_key=config.api.anthropic_api_key)

    response = client.messages.create(
        model=config.api.anthropic_model,
        max_tokens=500,
        temperature=0.4,
        system=prompt,
        messages=[{"role": "user", "content": user_content}],
    )

    raw = response.content[0].text
    result = _parse_agent_json(raw)

    tokens = response.usage.input_tokens + response.usage.output_tokens

    if not result:
        return {
            "action": "neutral",
            "reasoning": "Failed to parse agent response",
            "confidence": 0.0,
            "key_signal": "parse_error",
            "tokens_used": tokens,
        }

    # Normalize action value
    action = str(result.get("action", "neutral")).lower().strip()
    if action not in ("bullish", "bearish", "neutral"):
        action = "neutral"

    # Clamp confidence
    try:
        confidence = float(result.get("confidence", 0.5))
        confidence = max(0.0, min(1.0, confidence))
    except (ValueError, TypeError):
        confidence = 0.5

    return {
        "action": action,
        "reasoning": str(result.get("reasoning", ""))[:500],
        "confidence": confidence,
        "key_signal": str(result.get("key_signal", ""))[:200],
        "tokens_used": tokens,
    }


# ---------------------------------------------------------------------------
# Synthesis
# ---------------------------------------------------------------------------
def _synthesize_simulation(agent_results: list[dict], ticker: str, scenario: str = None) -> dict:
    """Synthesize all agent results into a final simulation output."""
    config = get_config()

    scenario_context = f" under scenario: '{scenario}'" if scenario else ""

    agent_summaries = ""
    for agent in agent_results:
        agent_summaries += f"\n{agent['persona'].upper()} AGENT:\n"
        agent_summaries += f"  Action: {agent['action']}\n"
        agent_summaries += f"  Confidence: {agent['confidence']}\n"
        agent_summaries += f"  Key Signal: {agent['key_signal']}\n"
        agent_summaries += f"  Reasoning: {agent['reasoning']}\n"

    prompt = SYNTHESIS_PROMPT.format(
        ticker=ticker,
        scenario_context=scenario_context,
        agent_summaries=agent_summaries,
    )

    import anthropic
    client = anthropic.Anthropic(api_key=config.api.anthropic_api_key)

    response = client.messages.create(
        model=config.api.anthropic_model,
        max_tokens=800,
        temperature=0.2,
        system="You are the chief strategist at Eugene Intelligence. Synthesize agent views into a coherent market simulation result. Return only valid JSON.",
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text
    result = _parse_agent_json(raw)
    tokens = response.usage.input_tokens + response.usage.output_tokens

    if not result:
        # Fallback: compute from agent results directly
        actions = [a["action"] for a in agent_results]
        bullish = actions.count("bullish")
        bearish = actions.count("bearish")
        if bullish > bearish:
            consensus = "bullish"
        elif bearish > bullish:
            consensus = "bearish"
        else:
            consensus = "neutral"
        avg_conf = sum(a["confidence"] for a in agent_results) / len(agent_results) if agent_results else 0.5

        return {
            "consensus": consensus,
            "confidence": round(avg_conf, 2),
            "convergence_score": round(max(bullish, bearish, actions.count("neutral")) / len(actions), 2) if actions else 0.0,
            "key_signals": [a["key_signal"] for a in agent_results if a["key_signal"] != "parse_error"][:5],
            "narrative": f"Agent simulation produced a {consensus} consensus with {avg_conf:.0%} average confidence.",
            "tokens_used": tokens,
        }

    # Normalize synthesis result
    consensus = str(result.get("consensus", "neutral")).lower().strip()
    if consensus not in ("bullish", "bearish", "neutral"):
        consensus = "neutral"

    try:
        confidence = float(result.get("confidence", 0.5))
        confidence = max(0.0, min(1.0, confidence))
    except (ValueError, TypeError):
        confidence = 0.5

    try:
        convergence = float(result.get("convergence_score", 0.5))
        convergence = max(0.0, min(1.0, convergence))
    except (ValueError, TypeError):
        convergence = 0.5

    key_signals = result.get("key_signals", [])
    if not isinstance(key_signals, list):
        key_signals = [str(key_signals)]
    key_signals = [str(s)[:200] for s in key_signals[:5]]

    narrative = str(result.get("narrative", ""))[:1000]

    return {
        "consensus": consensus,
        "confidence": round(confidence, 2),
        "convergence_score": round(convergence, 2),
        "key_signals": key_signals,
        "narrative": narrative,
        "tokens_used": tokens,
    }


# ---------------------------------------------------------------------------
# Main simulation function
# ---------------------------------------------------------------------------
@cached(ttl=1800, disk=True, disk_ttl=43200)
def run_simulation(ticker: str, scenario: str = None) -> dict:
    """Run multi-agent market simulation for a ticker.

    Cached for 30 minutes in memory, 12 hours on disk.
    Runs 5 AI agents sequentially (~$0.01 total cost).
    """
    config = get_config()

    if not config.api.anthropic_api_key:
        return {
            "ticker": ticker,
            "mode": "simulation",
            "error": "Simulation engine requires an Anthropic API key. Set ANTHROPIC_API_KEY environment variable.",
            "source": "eugene-simulation-engine",
        }

    # Gather all data
    data = _gather_simulation_data(ticker)
    company_name = data["profile"].get("name") or data["profile"].get("company") or ticker

    # Define agent configurations: (persona_name, prompt, data_slice_keys)
    agents = [
        ("analyst", ANALYST_PERSONA, {
            "profile": data.get("profile", {}),
            "financials": data.get("financials", {}),
            "metrics": data.get("metrics", {}),
        }),
        ("trader", TRADER_PERSONA, {
            "ohlcv": data.get("ohlcv", {}),
            "technicals": data.get("technicals", {}),
            "metrics": data.get("metrics", {}),
        }),
        ("insider", INSIDER_PERSONA, {
            "insiders": data.get("insiders", {}),
        }),
        ("institutional", INSTITUTIONAL_PERSONA, {
            "holdings": data.get("holdings", {}),
        }),
        ("macro", MACRO_PERSONA, {
            "fred_macro": data.get("fred_macro", {}),
            "profile": data.get("profile", {}),
        }),
    ]

    # Run agents sequentially to manage costs
    agent_results = []
    total_tokens = 0

    try:
        import anthropic  # noqa: F401 — verify package is available
    except ImportError:
        return {
            "ticker": ticker,
            "mode": "simulation",
            "error": "anthropic package not installed",
            "source": "eugene-simulation-engine",
        }

    for persona_name, persona_prompt, data_slice in agents:
        try:
            result = _run_agent(persona_prompt, data_slice, ticker, scenario)
            result["persona"] = persona_name
            total_tokens += result.pop("tokens_used", 0)
            agent_results.append(result)
        except Exception as e:
            logger.warning(f"Simulation: agent '{persona_name}' failed for {ticker}: {e}")
            agent_results.append({
                "persona": persona_name,
                "action": "neutral",
                "reasoning": f"Agent failed: {str(e)[:100]}",
                "confidence": 0.0,
                "key_signal": "agent_error",
            })

    # Synthesize results
    try:
        synthesis = _synthesize_simulation(agent_results, ticker, scenario)
        total_tokens += synthesis.pop("tokens_used", 0)
    except Exception as e:
        logger.error(f"Simulation: synthesis failed for {ticker}: {e}")
        # Fallback synthesis
        actions = [a["action"] for a in agent_results]
        bullish = actions.count("bullish")
        bearish = actions.count("bearish")
        if bullish > bearish:
            consensus = "bullish"
        elif bearish > bullish:
            consensus = "bearish"
        else:
            consensus = "neutral"
        avg_conf = sum(a["confidence"] for a in agent_results) / len(agent_results) if agent_results else 0.5

        synthesis = {
            "consensus": consensus,
            "confidence": round(avg_conf, 2),
            "convergence_score": round(max(bullish, bearish, actions.count("neutral")) / len(actions), 2) if actions else 0.0,
            "key_signals": [a["key_signal"] for a in agent_results if a.get("key_signal") not in ("parse_error", "agent_error")][:5],
            "narrative": f"Simulation produced a {consensus} consensus with {avg_conf:.0%} average confidence across {len(agent_results)} agents.",
        }

    return {
        "ticker": ticker,
        "company_name": company_name,
        "mode": "simulation",
        "scenario": scenario,
        "consensus": synthesis["consensus"],
        "confidence": synthesis["confidence"],
        "convergence_score": synthesis["convergence_score"],
        "agent_decisions": [
            {
                "persona": a["persona"],
                "action": a["action"],
                "confidence": a["confidence"],
                "reasoning": a["reasoning"],
                "key_signal": a["key_signal"],
            }
            for a in agent_results
        ],
        "key_signals": synthesis["key_signals"],
        "narrative": synthesis["narrative"],
        "tokens_used": total_tokens,
        "model": config.api.anthropic_model,
        "source": "eugene-simulation-engine",
        "disclaimer": "This is an AI-generated multi-agent simulation for informational purposes only. Not investment advice. Agent personas are synthetic — no real trading decisions are made.",
    }
