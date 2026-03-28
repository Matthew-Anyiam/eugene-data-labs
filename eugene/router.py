"""Central request router and envelope builder."""
import logging
from datetime import datetime, timezone
from eugene.errors import EugeneError
from eugene.resolver import resolve
from eugene.handlers.profile import profile_handler
from eugene.handlers.filings import filings_handler
from eugene.handlers.financials import financials_handler
from eugene.handlers.concepts_raw import concepts_handler
from eugene.handlers.insiders import insiders_handler
from eugene.handlers.ownership import ownership_handler
from eugene.handlers.events import events_handler
from eugene.handlers.sections import sections_handler
from eugene.handlers.exhibits import exhibits_handler
from eugene.handlers.metrics import metrics_handler
from eugene.handlers.ohlcv import ohlcv_handler
from eugene.handlers.technicals import technicals_handler
from eugene.handlers.segments import segments_handler
from eugene.handlers.float_data import float_handler
from eugene.handlers.corporate_actions import corporate_actions_handler
from eugene.handlers.transcripts import transcripts_handler
from eugene.handlers.peers import peers_handler
from eugene.handlers.news import news_handler
from eugene.concepts import VALID_CONCEPTS

VERSION = "0.8.1"

logger = logging.getLogger(__name__)

EXTRACT_HANDLERS = {
    "profile": profile_handler,
    "filings": filings_handler,
    "financials": financials_handler,
    "concepts": concepts_handler,
    "insiders": insiders_handler,
    "ownership": ownership_handler,
    "events": events_handler,
    "sections": sections_handler,
    "exhibits": exhibits_handler,
    # --- v0.6 ---
    "metrics": metrics_handler,
    "ohlcv": ohlcv_handler,
    "technicals": technicals_handler,
    "segments": segments_handler,
    "float": float_handler,
    "corporate_actions": corporate_actions_handler,
    # --- v0.7 ---
    "transcripts": transcripts_handler,
    "peers": peers_handler,
    "news": news_handler,
}

VALID_EXTRACTS = list(EXTRACT_HANDLERS.keys())

SOURCE_MAP = {
    "profile": "SEC EDGAR Submissions",
    "filings": "SEC EDGAR Submissions",
    "financials": "SEC CompanyFacts (XBRL)",
    "concepts": "SEC CompanyFacts (XBRL)",
    "insiders": "SEC EDGAR Form 4",
    "ownership": "SEC EDGAR 13F-HR",
    "events": "SEC EDGAR 8-K",
    "sections": "SEC EDGAR Filing HTML",
    "exhibits": "SEC EDGAR Filing Index",
    # --- v0.6 ---
    "metrics": "SEC CompanyFacts (XBRL) + FMP Market Data",
    "ohlcv": "FMP Historical Charts",
    "technicals": "FMP Historical Charts (computed)",
    "segments": "SEC CompanyFacts (XBRL Dimensions)",
    "float": "FMP Shares Float",
    "corporate_actions": "FMP + SEC EDGAR 8-K",
    # --- v0.7 ---
    "transcripts": "SEC EDGAR 8-K Filings",
    "peers": "SEC XBRL + FMP Screener",
    # --- v0.8 ---
    "news": "SEC EDGAR EFTS",
}

EXTRACT_DESCRIPTIONS = {
    "profile": "Company name, CIK, SIC, address, fiscal year end",
    "filings": "Filing list (10-K, 10-Q, 8-K, etc.) with accession + URL",
    "financials": "Normalized IS/BS/CF (revenue, net_income, etc.) with provenance",
    "concepts": "Raw XBRL concept time series (any tag)",
    "insiders": "Form 4 insider trade filings",
    "ownership": "13F-HR institutional holdings filings",
    "events": "8-K material event filings",
    "sections": "MD&A, risk factors, business description text from filings",
    "exhibits": "Exhibit list with URLs for each filing",
    "metrics": "50+ financial ratios (profitability, liquidity, leverage, valuation, growth)",
    "ohlcv": "OHLCV historical price bars (daily, 1hour, 5min, etc.)",
    "technicals": "Technical indicators (SMA, EMA, RSI, MACD, Bollinger, ATR, VWAP)",
    "segments": "Segmented revenues (business + geographic breakdowns)",
    "float": "Share float, outstanding shares, free float",
    "corporate_actions": "Dividends, stock splits, and 8-K events timeline",
    # --- v0.7 ---
    "transcripts": "Earnings call transcripts with management remarks, Q&A, guidance, and tone analysis",
    "peers": "Relative valuation: compare metrics against sector peers with percentile rankings",
    # --- v0.8 ---
    "news": "Recent 8-K/6-K filings as corporate news (material events, earnings, leadership changes)",
}


def query(identifier: str, extract: str = "financials", **params) -> dict:
    """
    Main entry point. Resolves identifier, routes to handlers, wraps in envelope.

    This function is used by both the FastAPI endpoint and the MCP tool.
    """
    # Resolve identifier
    try:
        resolved = resolve(identifier)
    except EugeneError as e:
        return _envelope(identifier, {}, params, {"error": e.message, "code": e.code}, [], status="error")

    # Parse extracts
    extracts = [e.strip() for e in extract.split(",")]
    invalid = [e for e in extracts if e not in EXTRACT_HANDLERS]
    if invalid:
        return _envelope(identifier, resolved, params,
                        {"error": f"Unknown extract(s): {invalid}", "valid_extracts": VALID_EXTRACTS},
                        [], status="error")

    # Route to handlers
    data = {}
    provenance = []
    has_error = False

    for ext in extracts:
        handler = EXTRACT_HANDLERS[ext]
        try:
            result = handler(resolved, params)
            data[ext] = result
            provenance.append({
                "extract": ext,
                "source": SOURCE_MAP.get(ext, "SEC EDGAR"),
                "url": _source_url(ext, resolved.get("cik", "")),
                "retrieved_at": datetime.now(timezone.utc).isoformat(),
            })
            # Quality scoring for data extracts
            if ext in ("financials", "metrics") and isinstance(result, dict) and "error" not in result:
                try:
                    from eugene.validation.financial import validate_financials, validate_metrics
                    vr = validate_metrics(result) if ext == "metrics" else validate_financials(result)
                    provenance[-1]["quality"] = vr.to_dict()
                except Exception:
                    pass  # validation is advisory, never block
        except EugeneError as e:
            data[ext] = {"error": e.message, "code": e.code}
            has_error = True
        except Exception as e:
            logger.exception("Handler %s failed", ext)
            data[ext] = {"error": str(e), "code": "INTERNAL_ERROR"}
            has_error = True

    # If single extract, unwrap for cleaner response
    if len(extracts) == 1:
        data = data[extracts[0]]

    return _envelope(identifier, resolved, params, data, provenance,
                     status="error" if has_error else "success")


def _envelope(identifier, resolved, params, data, provenance, status="success"):
    return {
        "status": status,
        "identifier": identifier,
        "resolved": {k: v for k, v in resolved.items() if k != "error"} if resolved else {},
        "requested": {k: v for k, v in params.items() if v is not None} if params else {},
        "data": data,
        "provenance": provenance,
        "metadata": {
            "service": "eugene-intelligence",
            "version": VERSION,
        },
    }


def _source_url(extract: str, cik: str) -> str:
    cik = cik.zfill(10) if cik else ""
    xbrl_url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
    edgar_url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    urls = {
        "profile": edgar_url,
        "filings": edgar_url,
        "financials": xbrl_url,
        "concepts": xbrl_url,
        "insiders": edgar_url,
        "ownership": edgar_url,
        "events": edgar_url,
        "sections": edgar_url,
        "exhibits": edgar_url,
        "metrics": xbrl_url,
        "segments": xbrl_url,
        "ohlcv": "https://financialmodelingprep.com/stable",
        "technicals": "https://financialmodelingprep.com/stable",
        "float": "https://financialmodelingprep.com/stable",
        "corporate_actions": edgar_url,
        "transcripts": edgar_url,
        "peers": xbrl_url,
        "news": "https://efts.sec.gov/LATEST/search-index?q=&forms=8-K",
    }
    return urls.get(extract, "")


def capabilities() -> dict:
    """Return tool discovery metadata."""
    return {
        "service": "eugene-intelligence",
        "version": VERSION,
        "endpoint": "GET /v1/sec/{identifier}",
        "extracts": {
            name: {
                "source": SOURCE_MAP.get(name, ""),
                "description": EXTRACT_DESCRIPTIONS.get(name, ""),
            }
            for name in VALID_EXTRACTS
        },
        "canonical_concepts": VALID_CONCEPTS,
        "parameters": {
            "identifier": "Ticker (AAPL), CIK (320193), or accession number",
            "extract": f"Comma-separated: {', '.join(VALID_EXTRACTS)}",
            "period": "FY | Q (for financials, metrics, segments)",
            "concept": "Concept name(s) for financials, or XBRL tag(s) for concepts",
            "form": "10-K, 10-Q, 8-K, 4, 13F-HR (filter)",
            "section": "mdna, risk_factors, business, legal (for sections)",
            "interval": "daily, 1hour, 5min, etc. (for ohlcv)",
            "from": "YYYY-MM-DD start date",
            "to": "YYYY-MM-DD end date",
            "limit": "Max results (default 10)",
        },
    }
