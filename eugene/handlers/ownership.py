"""Institutional ownership from 13F-HR filings."""
from eugene.handlers.filings import filings_handler


def ownership_handler(resolved: dict, params: dict) -> dict:
    """List 13F-HR filings. Full holdings parsing is v1."""
    params_copy = dict(params)
    params_copy["form"] = "13F-HR"
    params_copy["limit"] = params.get("limit", 10)
    
    result = filings_handler(resolved, params_copy)
    filings = result.get("filings", [])
    
    return {
        "ownership_filings": filings,
        "count": len(filings),
        "note": "Full holdings parsing (position sizes, changes) coming in v1",
    }
