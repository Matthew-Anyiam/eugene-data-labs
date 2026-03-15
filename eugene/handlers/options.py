"""Options chains — coming soon."""


def options_handler(resolved: dict, params: dict) -> dict:
    return {
        "status": "coming_soon",
        "ticker": resolved.get("ticker"),
        "message": "Options chain data requires a specialized provider (Polygon.io, CBOE). Planned for future release.",
        "alternatives": [
            "Check Yahoo Finance directly for options chains",
            "Use Polygon.io API for real-time options data",
        ],
    }
