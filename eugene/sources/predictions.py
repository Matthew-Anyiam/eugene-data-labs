"""
Eugene Intelligence - Prediction Market Data

Fetches prediction/forecasting data from:
- Polymarket (Gamma API) — event outcome probabilities
- Kalshi — financial & economic event contracts

Both APIs are free and require no authentication.
"""

import logging
import requests

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Polymarket (Gamma API)
# ---------------------------------------------------------------------------
POLYMARKET_BASE = "https://gamma-api.polymarket.com"
POLYMARKET_TIMEOUT = 15


def _polymarket_search(query: str, limit: int = 10) -> list[dict]:
    """Search Polymarket for prediction markets matching a query."""
    try:
        resp = requests.get(
            f"{POLYMARKET_BASE}/markets",
            params={
                "tag_slug": query.lower().replace(" ", "-"),
                "active": "true",
                "limit": limit,
                "order": "volume24hr",
                "ascending": "false",
            },
            timeout=POLYMARKET_TIMEOUT,
        )
        if resp.status_code != 200:
            # Try text search instead of tag
            resp = requests.get(
                f"{POLYMARKET_BASE}/markets",
                params={
                    "active": "true",
                    "limit": limit,
                    "order": "volume24hr",
                    "ascending": "false",
                },
                timeout=POLYMARKET_TIMEOUT,
            )
        if resp.status_code != 200:
            return []
        return resp.json() if isinstance(resp.json(), list) else []
    except Exception as e:
        logger.warning(f"Polymarket search failed: {e}")
        return []


def _polymarket_events(limit: int = 10) -> list[dict]:
    """Get top active Polymarket events by volume."""
    try:
        resp = requests.get(
            f"{POLYMARKET_BASE}/events",
            params={
                "active": "true",
                "limit": limit,
                "order": "volume24hr",
                "ascending": "false",
            },
            timeout=POLYMARKET_TIMEOUT,
        )
        if resp.status_code != 200:
            return []
        return resp.json() if isinstance(resp.json(), list) else []
    except Exception as e:
        logger.warning(f"Polymarket events failed: {e}")
        return []


def get_polymarket(query: str = None, limit: int = 10) -> dict:
    """Get Polymarket prediction data.

    If query is provided, search for matching markets.
    Otherwise return top events by volume.
    """
    if query:
        raw = _polymarket_search(query, limit)
    else:
        raw = _polymarket_events(limit)

    markets = []
    for m in raw:
        # Markets have different structure than events
        if "question" in m:
            # It's a market
            outcome_prices = m.get("outcomePrices", "")
            outcomes = m.get("outcomes", "")

            # Parse prices — can be JSON string or list
            prices = []
            if isinstance(outcome_prices, str) and outcome_prices:
                try:
                    import json
                    prices = json.loads(outcome_prices)
                except Exception:
                    prices = []
            elif isinstance(outcome_prices, list):
                prices = outcome_prices

            outcome_names = []
            if isinstance(outcomes, str) and outcomes:
                try:
                    import json
                    outcome_names = json.loads(outcomes)
                except Exception:
                    outcome_names = []
            elif isinstance(outcomes, list):
                outcome_names = outcomes

            # Build outcome probability pairs
            outcome_data = []
            for i, name in enumerate(outcome_names):
                prob = float(prices[i]) * 100 if i < len(prices) else None
                outcome_data.append({
                    "outcome": name,
                    "probability_pct": round(prob, 1) if prob is not None else None,
                })

            markets.append({
                "question": m.get("question"),
                "outcomes": outcome_data,
                "volume_24h": m.get("volume24hr"),
                "volume_total": m.get("volumeNum"),
                "liquidity": m.get("liquidityNum"),
                "end_date": m.get("endDate"),
                "url": f"https://polymarket.com/event/{m.get('slug', '')}",
                "source": "polymarket",
            })
        elif "title" in m:
            # It's an event
            markets.append({
                "question": m.get("title"),
                "description": m.get("description", "")[:200],
                "volume_total": m.get("volumeNum"),
                "end_date": m.get("endDate"),
                "url": f"https://polymarket.com/event/{m.get('slug', '')}",
                "source": "polymarket",
            })

    return {
        "predictions": markets,
        "count": len(markets),
        "source": "Polymarket",
    }


# ---------------------------------------------------------------------------
# Kalshi
# ---------------------------------------------------------------------------
KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2"
KALSHI_TIMEOUT = 15

# Key Kalshi series tickers for financial/economic data
KALSHI_FINANCIAL_SERIES = {
    "INX": "S&P 500",
    "NASDAQ100": "Nasdaq 100",
    "KXFEDRATE": "Fed Interest Rate",
    "KXINFL": "Inflation (CPI)",
    "KXGDP": "GDP Growth",
    "KXRECESSION": "Recession",
    "KXGASPRICE": "Gas Prices",
    "KXMORTGAGE": "Mortgage Rates",
    "KXWTI": "Oil (WTI)",
    "KXBTC": "Bitcoin Price",
}


def _kalshi_markets(series_ticker: str = None, limit: int = 20) -> list[dict]:
    """Get Kalshi markets, optionally filtered by series."""
    try:
        params = {"limit": limit, "status": "open"}
        if series_ticker:
            params["series_ticker"] = series_ticker
        resp = requests.get(
            f"{KALSHI_BASE}/markets",
            params=params,
            timeout=KALSHI_TIMEOUT,
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        return data.get("markets", [])
    except Exception as e:
        logger.warning(f"Kalshi markets failed: {e}")
        return []


def _kalshi_event(event_ticker: str) -> dict | None:
    """Get a specific Kalshi event."""
    try:
        resp = requests.get(
            f"{KALSHI_BASE}/events/{event_ticker}",
            timeout=KALSHI_TIMEOUT,
        )
        if resp.status_code != 200:
            return None
        return resp.json().get("event")
    except Exception as e:
        logger.warning(f"Kalshi event fetch failed: {e}")
        return None


def get_kalshi(topic: str = None, limit: int = 10) -> dict:
    """Get Kalshi prediction market data.

    topic: 'fed', 'sp500', 'inflation', 'gdp', 'recession', 'bitcoin', 'oil', etc.
    If no topic, returns financial markets overview.
    """
    # Map topics to series tickers
    topic_map = {
        "fed": "KXFEDRATE",
        "rates": "KXFEDRATE",
        "interest": "KXFEDRATE",
        "sp500": "INX",
        "s&p": "INX",
        "nasdaq": "NASDAQ100",
        "inflation": "KXINFL",
        "cpi": "KXINFL",
        "gdp": "KXGDP",
        "recession": "KXRECESSION",
        "gas": "KXGASPRICE",
        "mortgage": "KXMORTGAGE",
        "oil": "KXWTI",
        "wti": "KXWTI",
        "bitcoin": "KXBTC",
        "btc": "KXBTC",
    }

    series_ticker = None
    if topic:
        series_ticker = topic_map.get(topic.lower().strip())
        if not series_ticker:
            # Try direct ticker
            series_ticker = topic.upper()

    raw = _kalshi_markets(series_ticker, limit)

    markets = []
    for m in raw:
        yes_bid = m.get("yes_bid")
        no_bid = m.get("no_bid")

        # Convert cents to probability percentage
        yes_prob = yes_bid if yes_bid is not None else None
        no_prob = no_bid if no_bid is not None else None

        markets.append({
            "question": m.get("title") or m.get("subtitle"),
            "ticker": m.get("ticker"),
            "yes_probability_pct": yes_prob,
            "no_probability_pct": no_prob,
            "volume": m.get("volume"),
            "open_interest": m.get("open_interest"),
            "expiration": m.get("expiration_time") or m.get("close_time"),
            "category": m.get("category"),
            "url": f"https://kalshi.com/markets/{m.get('ticker', '')}",
            "source": "kalshi",
        })

    return {
        "predictions": markets,
        "count": len(markets),
        "topic": topic,
        "source": "Kalshi",
        "available_topics": list(topic_map.keys()) if not topic else None,
    }


# ---------------------------------------------------------------------------
# Combined prediction data
# ---------------------------------------------------------------------------
def get_predictions(query: str = None, topic: str = None, limit: int = 10) -> dict:
    """Get combined prediction market data from all sources.

    query: search term for Polymarket (e.g., "apple", "fed", "bitcoin")
    topic: Kalshi topic (e.g., "fed", "sp500", "inflation")
    """
    search = query or topic

    polymarket = get_polymarket(query=search, limit=limit)
    kalshi = get_kalshi(topic=search, limit=limit)

    all_predictions = polymarket.get("predictions", []) + kalshi.get("predictions", [])

    return {
        "predictions": all_predictions,
        "count": len(all_predictions),
        "sources": {
            "polymarket": polymarket.get("count", 0),
            "kalshi": kalshi.get("count", 0),
        },
    }
