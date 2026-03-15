"""Peer comparison — relative valuation against sector peers."""
import logging
from eugene.sources.fmp import get_profile, get_screener
from eugene.handlers.metrics import metrics_handler
from eugene.resolver import resolve

logger = logging.getLogger(__name__)

# Key ratios for comparison
COMPARE_RATIOS = [
    ("profitability", "gross_margin"),
    ("profitability", "net_margin"),
    ("profitability", "return_on_equity"),
    ("valuation", "pe_ratio"),
    ("valuation", "ev_to_ebitda"),
    ("leverage", "debt_to_equity"),
    ("growth", "revenue_growth"),
    ("growth", "earnings_growth"),
]


def peers_handler(resolved: dict, params: dict) -> dict:
    """Compare a company's metrics against sector peers."""
    ticker = resolved.get("ticker", "")
    limit = int(params.get("limit", 5))

    # 1. Get company profile for sector/market cap
    profile = get_profile(ticker)
    if isinstance(profile, dict) and "error" in profile:
        return {"error": f"Cannot get profile for {ticker}", "detail": profile.get("error")}

    sector = profile.get("sector")
    market_cap = profile.get("market_cap")

    if not sector:
        return {"error": f"No sector data for {ticker}"}

    # 2. Find peers via screener (same sector, similar market cap)
    screen_params = {"sector": sector, "limit": limit + 5}
    if market_cap and market_cap > 0:
        screen_params["market_cap_min"] = int(market_cap * 0.2)
        screen_params["market_cap_max"] = int(market_cap * 5)

    screen = get_screener(**screen_params)
    peer_tickers = [
        r["ticker"] for r in screen.get("results", [])
        if r.get("ticker") and r["ticker"] != ticker
    ][:limit]

    if not peer_tickers:
        return {"error": f"No peers found for {ticker} in {sector}"}

    # 3. Get metrics for target
    target_metrics = metrics_handler(resolved, params)

    # 4. Get metrics for peers
    peer_data = []
    for pt in peer_tickers:
        try:
            peer_resolved = resolve(pt)
            if "error" not in peer_resolved:
                pm = metrics_handler(peer_resolved, {"period": params.get("period", "FY"), "limit": "1"})
                peer_data.append({"ticker": pt, "metrics": pm})
        except Exception:
            logger.debug("Failed to get metrics for peer %s", pt)
            continue

    # 5. Compute relative position
    comparison = _compare(target_metrics, peer_data)

    return {
        "ticker": ticker,
        "sector": sector,
        "industry": profile.get("industry"),
        "peers": peer_tickers,
        "peer_count": len(peer_data),
        "target_metrics": target_metrics,
        "peer_metrics": peer_data,
        "relative_valuation": comparison,
    }


def _compare(target: dict, peers: list[dict]) -> dict:
    """Compute percentile rankings for key ratios vs peers."""
    if not peers:
        return {}

    results = {}
    for category, ratio in COMPARE_RATIOS:
        target_val = _get_ratio(target, category, ratio)
        if target_val is None:
            continue

        peer_vals = []
        for p in peers:
            v = _get_ratio(p.get("metrics", {}), category, ratio)
            if v is not None:
                peer_vals.append(v)

        if not peer_vals:
            continue

        # All values including target
        all_vals = sorted(peer_vals + [target_val])
        rank = all_vals.index(target_val) + 1
        percentile = round((rank / len(all_vals)) * 100, 1)

        # For some ratios, higher is better; for others, lower is better
        higher_is_better = ratio not in ("debt_to_equity", "pe_ratio", "ev_to_ebitda")

        results[ratio] = {
            "value": target_val,
            "percentile": percentile,
            "peer_median": round(_median(peer_vals), 4) if peer_vals else None,
            "peer_min": round(min(peer_vals), 4),
            "peer_max": round(max(peer_vals), 4),
            "peer_count": len(peer_vals),
            "higher_is_better": higher_is_better,
        }

    return results


def _get_ratio(data: dict, category: str, ratio: str):
    """Extract a ratio from metrics response."""
    if isinstance(data, dict):
        cat = data.get(category, {})
        if isinstance(cat, dict):
            val = cat.get(ratio)
            if isinstance(val, (int, float)):
                return val
    return None


def _median(values: list) -> float:
    """Compute median of a list."""
    s = sorted(values)
    n = len(s)
    if n == 0:
        return 0.0
    if n % 2 == 1:
        return s[n // 2]
    return (s[n // 2 - 1] + s[n // 2]) / 2
