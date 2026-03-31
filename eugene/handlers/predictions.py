"""Handler for prediction market data (Polymarket + Kalshi)."""
import logging

logger = logging.getLogger(__name__)


def predictions_handler(resolved: dict, params: dict) -> dict:
    """Fetch prediction market data related to a company or topic.

    Uses the company ticker/name as a search query for Polymarket,
    and maps to relevant Kalshi financial series.
    """
    from eugene.sources.predictions import get_polymarket, get_kalshi

    ticker = resolved.get("ticker", "")
    company_name = resolved.get("company_name", ticker)
    limit = params.get("limit", 10)

    # Search Polymarket with company name or ticker
    search_term = company_name if company_name != ticker else ticker
    polymarket = get_polymarket(query=search_term, limit=limit)

    # For Kalshi, try to match to financial topics
    # Most Kalshi markets are macro — always include relevant ones
    kalshi = get_kalshi(topic=None, limit=limit)

    all_predictions = polymarket.get("predictions", []) + kalshi.get("predictions", [])

    return {
        "predictions": all_predictions,
        "count": len(all_predictions),
        "search_term": search_term,
        "sources": {
            "polymarket": polymarket.get("count", 0),
            "kalshi": kalshi.get("count", 0),
        },
    }
