"""Tick / order book data — coming soon."""


def orderbook_handler(resolved: dict, params: dict) -> dict:
    return {
        "status": "coming_soon",
        "ticker": resolved.get("ticker"),
        "message": "Tick and order book data requires a specialized provider (Polygon.io, Databento). Planned for future release.",
    }
