"""Material events from 8-K filings."""
from eugene.handlers.filings import filings_handler


def events_handler(resolved: dict, params: dict) -> dict:
    """List 8-K event filings. Full event categorization is v1."""
    params_copy = dict(params)
    params_copy["form"] = "8-K,8-K/A"
    params_copy["limit"] = params.get("limit", 10)
    
    result = filings_handler(resolved, params_copy)
    filings = result.get("filings", [])
    
    return {
        "events": filings,
        "count": len(filings),
        "note": "Event categorization (earnings, M&A, leadership changes) coming in v1",
    }
