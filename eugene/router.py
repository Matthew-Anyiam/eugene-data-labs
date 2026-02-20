"""Central request router and envelope builder."""
from datetime import datetime, timezone
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
from eugene.concepts import VALID_CONCEPTS

VERSION = "0.4.0"

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
}


def query(identifier: str, extract: str = "financials", **params) -> dict:
    """
    Main entry point. Resolves identifier, routes to handlers, wraps in envelope.
    
    This function is used by both the FastAPI endpoint and the MCP tool.
    """
    # Resolve identifier
    resolved = resolve(identifier)
    if "error" in resolved:
        return _envelope(identifier, {}, params, {"error": resolved["error"]}, [], status="error")

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
        except Exception as e:
            data[ext] = {"error": str(e)}
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
    urls = {
        "profile": f"https://data.sec.gov/submissions/CIK{cik}.json",
        "filings": f"https://data.sec.gov/submissions/CIK{cik}.json",
        "financials": f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json",
        "concepts": f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json",
        "insiders": f"https://data.sec.gov/submissions/CIK{cik}.json",
        "ownership": f"https://data.sec.gov/submissions/CIK{cik}.json",
        "events": f"https://data.sec.gov/submissions/CIK{cik}.json",
        "sections": f"https://data.sec.gov/submissions/CIK{cik}.json",
        "exhibits": f"https://data.sec.gov/submissions/CIK{cik}.json",
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
                "source": SOURCE_MAP.get(name, "SEC EDGAR"),
                "description": {
                    "profile": "Company name, CIK, SIC, address, fiscal year end",
                    "filings": "Filing list (10-K, 10-Q, 8-K, etc.) with accession + URL",
                    "financials": "Normalized fundamentals (revenue, net_income, etc.) with provenance",
                    "concepts": "Raw XBRL concept time series (any tag)",
                    "insiders": "Form 4 insider trade filings",
                    "ownership": "13F-HR institutional holdings filings",
                    "events": "8-K material event filings",
                    "sections": "MD&A, risk factors, business description text from filings",
                    "exhibits": "Exhibit list with URLs for each filing",
                }.get(name, ""),
            }
            for name in VALID_EXTRACTS
        },
        "canonical_concepts": VALID_CONCEPTS,
        "parameters": {
            "identifier": "Ticker (AAPL), CIK (320193), or accession number",
            "extract": f"Comma-separated: {', '.join(VALID_EXTRACTS)}",
            "period": "FY | Q (for financials)",
            "concept": "Concept name(s) for financials, or XBRL tag(s) for concepts",
            "form": "10-K, 10-Q, 8-K, 4, 13F-HR (filter)",
            "section": "mdna, risk_factors, business, legal (for sections)",
            "from": "YYYY-MM-DD start date",
            "to": "YYYY-MM-DD end date",
            "limit": "Max results (default 10)",
        },
    }
