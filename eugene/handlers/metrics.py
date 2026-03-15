"""
Financial ratio computation from XBRL + market data.

50+ ratios across 7 categories:
  profitability, liquidity, leverage, efficiency, valuation, growth, per_share
"""
from eugene.handlers.financials import financials_handler
from eugene.sources.fmp import get_price


def metrics_handler(resolved: dict, params: dict) -> dict:
    """Compute 50+ financial ratios for each period."""
    ticker = resolved.get("ticker")

    # Fetch all financial data
    fin_params = dict(params)
    fin_params["limit"] = params.get("limit", 5)
    financials = financials_handler(resolved, fin_params)

    # Market data for valuation ratios
    market = None
    if ticker:
        try:
            market = get_price(ticker)
        except Exception:
            pass

    periods = financials.get("periods", [])
    results = []

    for i, period in enumerate(periods):
        m = period.get("metrics", {})
        ratios = {}

        ratios["profitability"] = _profitability(m)
        ratios["liquidity"] = _liquidity(m)
        ratios["leverage"] = _leverage(m)
        ratios["efficiency"] = _efficiency(m)
        ratios["per_share"] = _per_share(m)

        # Valuation needs market data (latest period only)
        if market and i == 0 and "error" not in market:
            ratios["valuation"] = _valuation(m, market)

        # Growth needs prior period
        if i < len(periods) - 1:
            prior = periods[i + 1].get("metrics", {})
            ratios["growth"] = _growth(m, prior)

        results.append({
            "period_end": period["period_end"],
            "period_type": period["period_type"],
            "fiscal_year": period.get("fiscal_year"),
            "ratios": ratios,
        })

    return {
        "ticker": ticker,
        "periods": results,
        "period_type": financials.get("period_type"),
        "ratio_count": _count_ratios(results[0]["ratios"] if results else {}),
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _v(metrics: dict, key: str):
    """Safely extract a metric value."""
    entry = metrics.get(key)
    if entry and isinstance(entry, dict):
        return entry.get("value")
    return None


def _div(a, b):
    """Safe division, returns None if b is 0 or None."""
    if a is None or b is None or b == 0:
        return None
    return round(a / b, 4)


def _pct(current, prior):
    """YoY percentage change."""
    if current is None or prior is None or prior == 0:
        return None
    return round((current - prior) / abs(prior), 4)


def _count_ratios(ratios: dict) -> int:
    total = 0
    for category in ratios.values():
        if isinstance(category, dict):
            total += sum(1 for v in category.values() if v is not None)
    return total


# ---------------------------------------------------------------------------
# Ratio categories
# ---------------------------------------------------------------------------

def _profitability(m):
    rev = _v(m, "revenue")
    ni = _v(m, "net_income")
    return {
        "gross_margin": _div(_v(m, "gross_profit"), rev),
        "operating_margin": _div(_v(m, "operating_income"), rev),
        "net_margin": _div(ni, rev),
        "ebitda_margin": _div(_v(m, "ebitda"), rev),
        "roe": _div(ni, _v(m, "stockholders_equity")),
        "roa": _div(ni, _v(m, "total_assets")),
        "roic": _roic(m),
    }


def _roic(m):
    oi = _v(m, "operating_income")
    ta = _v(m, "total_assets")
    cl = _v(m, "current_liabilities")
    if oi is None or ta is None or cl is None:
        return None
    invested = ta - cl
    return _div(oi, invested)


def _liquidity(m):
    ca = _v(m, "current_assets")
    cl = _v(m, "current_liabilities")
    inv = _v(m, "inventory") or 0
    cash = _v(m, "cash") or 0
    return {
        "current_ratio": _div(ca, cl),
        "quick_ratio": _div((ca - inv) if ca is not None else None, cl),
        "cash_ratio": _div(cash, cl),
    }


def _leverage(m):
    eq = _v(m, "stockholders_equity")
    ta = _v(m, "total_assets")
    td = _v(m, "total_debt")
    oi = _v(m, "operating_income")
    ie = _v(m, "interest_expense")
    return {
        "debt_to_equity": _div(td, eq),
        "debt_to_assets": _div(td, ta),
        "equity_multiplier": _div(ta, eq),
        "interest_coverage": _div(oi, ie),
        "net_debt": (td - (_v(m, "cash") or 0)) if td is not None else None,
    }


def _efficiency(m):
    rev = _v(m, "revenue")
    ta = _v(m, "total_assets")
    cogs = _v(m, "cost_of_revenue")
    inv = _v(m, "inventory")
    ar = _v(m, "accounts_receivable")
    ap = _v(m, "accounts_payable")
    return {
        "asset_turnover": _div(rev, ta),
        "inventory_turnover": _div(cogs, inv),
        "receivables_turnover": _div(rev, ar),
        "payables_turnover": _div(cogs, ap),
        "days_sales_outstanding": _div(ar, _div(rev, 365)) if rev and ar else None,
        "days_inventory": _div(inv, _div(cogs, 365)) if cogs and inv else None,
    }


def _valuation(m, market):
    price = market.get("price")
    mcap = market.get("market_cap")
    shares = _v(m, "shares_outstanding")
    ni = _v(m, "net_income")
    rev = _v(m, "revenue")
    eq = _v(m, "stockholders_equity")
    fcf = _v(m, "free_cf")
    ebitda = _v(m, "ebitda")
    td = _v(m, "total_debt") or 0
    cash = _v(m, "cash") or 0
    ev = (mcap + td - cash) if mcap is not None else None
    divs = _v(m, "dividends_paid")

    return {
        "pe_ratio": _div(mcap, ni),
        "pb_ratio": _div(mcap, eq),
        "ps_ratio": _div(mcap, rev),
        "ev_to_ebitda": _div(ev, ebitda),
        "ev_to_revenue": _div(ev, rev),
        "fcf_yield": _div(fcf, mcap) if mcap and fcf else None,
        "earnings_yield": _div(ni, mcap),
        "dividend_yield": _div(abs(divs), mcap) if divs and mcap else None,
        "price_to_fcf": _div(mcap, fcf),
        "enterprise_value": ev,
        "market_cap": mcap,
    }


def _growth(m, prior):
    return {
        "revenue_growth": _pct(_v(m, "revenue"), _v(prior, "revenue")),
        "earnings_growth": _pct(_v(m, "net_income"), _v(prior, "net_income")),
        "operating_income_growth": _pct(_v(m, "operating_income"), _v(prior, "operating_income")),
        "ebitda_growth": _pct(_v(m, "ebitda"), _v(prior, "ebitda")),
        "fcf_growth": _pct(_v(m, "free_cf"), _v(prior, "free_cf")),
        "asset_growth": _pct(_v(m, "total_assets"), _v(prior, "total_assets")),
        "equity_growth": _pct(_v(m, "stockholders_equity"), _v(prior, "stockholders_equity")),
    }


def _per_share(m):
    shares = _v(m, "shares_outstanding")
    return {
        "book_value_per_share": _div(_v(m, "stockholders_equity"), shares),
        "revenue_per_share": _div(_v(m, "revenue"), shares),
        "fcf_per_share": _div(_v(m, "free_cf"), shares),
        "operating_cf_per_share": _div(_v(m, "operating_cf"), shares),
        "net_income_per_share": _div(_v(m, "net_income"), shares),
    }
