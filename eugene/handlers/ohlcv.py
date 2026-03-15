"""Historical OHLCV price bars."""
from eugene.sources.fmp import get_historical_bars


def ohlcv_handler(resolved: dict, params: dict) -> dict:
    """OHLCV bars for a ticker. Supports daily, 1hour, 5min, etc."""
    ticker = resolved.get("ticker")
    if not ticker:
        return {"error": "Ticker required for OHLCV data"}
    interval = params.get("interval", "daily")
    from_date = params.get("from")
    to_date = params.get("to")
    return get_historical_bars(ticker, interval=interval,
                               from_date=from_date, to_date=to_date)
