"""Unified corporate actions: dividends, splits, 8-K events."""
import logging
from eugene.sources.fmp import get_dividends, get_splits
from eugene.handlers.events import events_handler

logger = logging.getLogger(__name__)


def corporate_actions_handler(resolved: dict, params: dict) -> dict:
    """Merge dividends + splits + 8-K events into a unified timeline."""
    ticker = resolved.get("ticker")
    actions = []
    warnings = []

    # FMP dividends
    if ticker:
        try:
            divs = get_dividends(ticker)
            for d in divs.get("dividends", []):
                actions.append({
                    "type": "dividend", "date": d.get("date"),
                    "details": d, "source": "FMP",
                })
        except Exception:
            logger.exception("Failed to fetch dividends for %s", ticker)
            warnings.append("Could not fetch dividend data")

        # FMP splits
        try:
            splits = get_splits(ticker)
            for s in splits.get("splits", []):
                actions.append({
                    "type": "split", "date": s.get("date"),
                    "details": s, "source": "FMP",
                })
        except Exception:
            logger.exception("Failed to fetch splits for %s", ticker)
            warnings.append("Could not fetch stock split data")

    # SEC 8-K events
    try:
        events = events_handler(resolved, {"limit": params.get("limit", 10)})
        for e in events.get("events", []):
            actions.append({
                "type": "8k_event", "date": e.get("filed_date"),
                "details": e, "source": "SEC EDGAR",
            })
    except Exception:
        logger.exception("Failed to fetch 8-K events for %s", ticker)
        warnings.append("Could not fetch 8-K event data")

    # Sort by date descending
    actions.sort(key=lambda x: x.get("date") or "", reverse=True)

    result = {
        "ticker": ticker,
        "actions": actions,
        "count": len(actions),
    }
    if warnings:
        result["warnings"] = warnings
    return result
