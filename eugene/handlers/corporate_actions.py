"""Unified corporate actions: dividends, splits, 8-K events."""
from eugene.sources.fmp import get_dividends, get_splits
from eugene.handlers.events import events_handler


def corporate_actions_handler(resolved: dict, params: dict) -> dict:
    """Merge dividends + splits + 8-K events into a unified timeline."""
    ticker = resolved.get("ticker")
    actions = []

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
            pass

        # FMP splits
        try:
            splits = get_splits(ticker)
            for s in splits.get("splits", []):
                actions.append({
                    "type": "split", "date": s.get("date"),
                    "details": s, "source": "FMP",
                })
        except Exception:
            pass

    # SEC 8-K events
    try:
        events = events_handler(resolved, {"limit": params.get("limit", 10)})
        for e in events.get("events", []):
            actions.append({
                "type": "8k_event", "date": e.get("filed_date"),
                "details": e, "source": "SEC EDGAR",
            })
    except Exception:
        pass

    # Sort by date descending
    actions.sort(key=lambda x: x.get("date") or "", reverse=True)

    return {
        "ticker": ticker,
        "actions": actions,
        "count": len(actions),
    }
