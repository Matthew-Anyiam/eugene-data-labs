"""Shares float and short interest data."""
from eugene.sources.fmp import get_shares_float


def float_handler(resolved: dict, params: dict) -> dict:
    """Get share float data for a ticker."""
    ticker = resolved.get("ticker")
    if not ticker:
        return {"error": "Ticker required for float data"}
    result = get_shares_float(ticker)
    result["short_interest"] = {
        "status": "coming_soon",
        "note": "Short interest data requires FINRA data feed. Coming in future release.",
    }
    return result
