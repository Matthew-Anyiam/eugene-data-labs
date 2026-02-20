"""Insider trades from SEC Form 4 filings."""
from eugene.handlers.filings import filings_handler


def insiders_handler(resolved: dict, params: dict) -> dict:
    """List insider trade filings (Form 4). Full parsing is v1."""
    params_copy = dict(params)
    params_copy["form"] = "4"
    params_copy["limit"] = params.get("limit", 20)
    
    result = filings_handler(resolved, params_copy)
    filings = result.get("filings", [])
    
    return {
        "insider_filings": filings,
        "count": len(filings),
        "note": "Full transaction parsing (shares, price, direction) coming in v1",
    }
