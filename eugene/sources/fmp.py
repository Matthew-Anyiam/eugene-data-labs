"""FMP source — prices, profile, earnings, estimates, news, OHLCV, screener, crypto, float, dividends, splits."""
import os
import requests
from eugene.cache import cached
from eugene.errors import SourceError
from eugene.rate_limit import FMP_LIMITER

FMP_BASE = "https://financialmodelingprep.com/stable"


def _key():
    return os.environ.get("FMP_API_KEY", "")


def _safe_get(url: str, params: dict = None, timeout: int = 15) -> dict | list | None:
    """Make a GET request with graceful error handling."""
    FMP_LIMITER.acquire()
    try:
        r = requests.get(url, params=params, timeout=timeout)
        if r.status_code == 402:
            return {"error": "This feature requires a paid FMP plan", "status": 402}
        if r.status_code == 404:
            return {"error": "Endpoint not found", "status": 404}
        r.raise_for_status()
        return r.json()
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else 500
        if status >= 500:
            raise SourceError("FMP", f"HTTP {status}")
        return {"error": f"HTTP {status}", "status": status}
    except requests.exceptions.RequestException as e:
        raise SourceError("FMP", str(e))


@cached(ttl=60)
def get_price(ticker: str) -> dict:
    data = _safe_get(f"{FMP_BASE}/quote", params={"symbol": ticker, "apikey": _key()})
    if isinstance(data, dict) and "error" in data:
        return {"ticker": ticker, **data}
    q = data[0] if isinstance(data, list) and data else data if isinstance(data, dict) and "price" in data else None
    if q:
        return {
            "ticker": ticker, "price": q.get("price"), "change": q.get("change"),
            "change_percent": q.get("changePercentage"), "volume": q.get("volume"),
            "market_cap": q.get("marketCap"), "day_high": q.get("dayHigh"),
            "day_low": q.get("dayLow"), "year_high": q.get("yearHigh"),
            "year_low": q.get("yearLow"), "avg_50": q.get("priceAvg50"),
            "avg_200": q.get("priceAvg200"),
        }
    return {"ticker": ticker, "error": "No data found"}


@cached(ttl=3600)
def get_profile(ticker: str) -> dict:
    data = _safe_get(f"{FMP_BASE}/profile", params={"symbol": ticker, "apikey": _key()})
    if isinstance(data, dict) and "error" in data:
        return {"ticker": ticker, **data}
    p = data[0] if isinstance(data, list) and data else data if isinstance(data, dict) and "companyName" in data else None
    if p:
        return {
            "ticker": ticker, "name": p.get("companyName"), "sector": p.get("sector"),
            "industry": p.get("industry"), "description": p.get("description"),
            "ceo": p.get("ceo"), "employees": p.get("fullTimeEmployees"),
            "website": p.get("website"), "market_cap": p.get("mktCap"),
            "country": p.get("country"), "exchange": p.get("exchangeShortName"),
        }
    return {"ticker": ticker, "error": "No data found"}


@cached(ttl=3600)
def get_earnings(ticker: str) -> dict:
    data = _safe_get(f"{FMP_BASE}/earning-calendar-historical", params={"symbol": ticker, "apikey": _key()})
    if isinstance(data, dict) and "error" in data:
        return {"ticker": ticker, "earnings": [], **data}
    earnings = []
    if isinstance(data, list):
        for e in data[:12]:
            earnings.append({
                "date": e.get("date"), "eps_actual": e.get("eps"),
                "eps_estimate": e.get("epsEstimated"), "revenue_actual": e.get("revenue"),
                "revenue_estimate": e.get("revenueEstimated"),
            })
    return {"ticker": ticker, "earnings": earnings}


@cached(ttl=3600)
def get_estimates(ticker: str) -> dict:
    data = _safe_get(f"{FMP_BASE}/price-target", params={"symbol": ticker, "apikey": _key()})
    if isinstance(data, dict) and "error" in data:
        return {"ticker": ticker, "price_targets": [], **data}
    targets = []
    if isinstance(data, list):
        for t in data[:10]:
            targets.append({
                "analyst": t.get("analystName"), "company": t.get("analystCompany"),
                "target": t.get("adjPriceTarget"), "date": t.get("publishedDate"),
            })
    return {"ticker": ticker, "price_targets": targets}


@cached(ttl=300)
def get_news(ticker: str, limit: int = 10) -> dict:
    data = _safe_get(f"{FMP_BASE}/stock-news", params={"symbol": ticker, "limit": limit, "apikey": _key()})
    if isinstance(data, dict) and "error" in data:
        return {"ticker": ticker, "articles": [], **data}
    articles = []
    if isinstance(data, list):
        for a in data[:limit]:
            articles.append({
                "title": a.get("title"), "date": a.get("publishedDate"),
                "source": a.get("site"), "url": a.get("url"),
                "snippet": (a.get("text") or "")[:300],
            })
    return {"ticker": ticker, "articles": articles}


# ---------------------------------------------------------------------------
# OHLCV Historical Bars
# ---------------------------------------------------------------------------
@cached(ttl=300)
def get_historical_bars(ticker: str, interval: str = "daily",
                        from_date: str = None, to_date: str = None) -> dict:
    """OHLCV bars. interval: 1min|5min|15min|30min|1hour|4hour|daily."""
    if interval == "daily":
        url = f"{FMP_BASE}/historical-price-eod/full"
    else:
        url = f"{FMP_BASE}/historical-chart/{interval}"
    params = {"symbol": ticker, "apikey": _key()}
    if from_date:
        params["from"] = from_date
    if to_date:
        params["to"] = to_date
    data = _safe_get(url, params=params)
    if isinstance(data, dict) and "error" in data:
        return {"ticker": ticker, "interval": interval, "bars": [], "count": 0, **data}
    bars = []
    if isinstance(data, list):
        for bar in data:
            bars.append({
                "date": bar.get("date"),
                "open": bar.get("open"),
                "high": bar.get("high"),
                "low": bar.get("low"),
                "close": bar.get("close"),
                "volume": bar.get("volume"),
            })
    return {"ticker": ticker, "interval": interval, "bars": bars, "count": len(bars)}


# ---------------------------------------------------------------------------
# Stock Screener
# ---------------------------------------------------------------------------
@cached(ttl=300)
def get_screener(market_cap_min: int = None, market_cap_max: int = None,
                 price_min: float = None, price_max: float = None,
                 volume_min: int = None, sector: str = None,
                 country: str = None, beta_min: float = None,
                 beta_max: float = None, dividend_min: float = None,
                 dividend_max: float = None, limit: int = 50) -> dict:
    """Screen stocks using FMP company-screener endpoint."""
    params = {"apikey": _key(), "limit": limit}
    if market_cap_min:
        params["marketCapMoreThan"] = market_cap_min
    if market_cap_max:
        params["marketCapLowerThan"] = market_cap_max
    if price_min:
        params["priceMoreThan"] = price_min
    if price_max:
        params["priceLowerThan"] = price_max
    if volume_min:
        params["volumeMoreThan"] = volume_min
    if sector:
        params["sector"] = sector
    if country:
        params["country"] = country
    if beta_min:
        params["betaMoreThan"] = beta_min
    if beta_max:
        params["betaLowerThan"] = beta_max
    if dividend_min:
        params["dividendMoreThan"] = dividend_min
    if dividend_max:
        params["dividendLowerThan"] = dividend_max
    data = _safe_get(f"{FMP_BASE}/company-screener", params=params)
    if isinstance(data, dict) and "error" in data:
        if data.get("status") == 402 or "paid" in data.get("error", "").lower():
            return {
                "results": [], "count": 0, "source": "FMP",
                "note": "Stock screening requires an FMP API key with a paid plan. Visit financialmodelingprep.com for pricing.",
                "alternatives": "Use 'eugene sec <TICKER>' to look up individual companies by ticker.",
            }
        return {"results": [], "count": 0, "source": "FMP", **data}
    results = []
    for item in (data if isinstance(data, list) else []):
        results.append({
            "ticker": item.get("symbol"), "name": item.get("companyName"),
            "market_cap": item.get("marketCap"), "price": item.get("price"),
            "sector": item.get("sector"), "industry": item.get("industry"),
            "beta": item.get("beta"), "volume": item.get("volume"),
            "country": item.get("country"), "exchange": item.get("exchangeShortName"),
        })
    return {"results": results, "count": len(results), "source": "FMP"}


# ---------------------------------------------------------------------------
# Crypto
# ---------------------------------------------------------------------------
@cached(ttl=60)
def get_crypto_quote(symbol: str) -> dict:
    """Get crypto quote. symbol: BTCUSD, ETHUSD, etc."""
    data = _safe_get(f"{FMP_BASE}/quote", params={"symbol": symbol, "apikey": _key()})
    if isinstance(data, dict) and "error" in data:
        return {"symbol": symbol, **data}
    q = data[0] if isinstance(data, list) and data else None
    if q:
        return {
            "symbol": symbol, "price": q.get("price"), "change": q.get("change"),
            "change_percent": q.get("changePercentage"), "volume": q.get("volume"),
            "market_cap": q.get("marketCap"), "day_high": q.get("dayHigh"),
            "day_low": q.get("dayLow"), "source": "FMP",
        }
    return {"symbol": symbol, "error": "No data found"}


# ---------------------------------------------------------------------------
# Shares Float
# ---------------------------------------------------------------------------
@cached(ttl=3600)
def get_shares_float(ticker: str) -> dict:
    """Get share float data from FMP."""
    data = _safe_get(f"{FMP_BASE}/shares-float", params={"symbol": ticker, "apikey": _key()})
    if isinstance(data, dict) and "error" in data:
        return {"ticker": ticker, **data}
    f = data[0] if isinstance(data, list) and data else None
    if f:
        return {
            "ticker": ticker, "float_shares": f.get("floatShares"),
            "outstanding_shares": f.get("outstandingShares"),
            "free_float": f.get("freeFloat"), "date": f.get("date"),
            "source": "FMP",
        }
    return {"ticker": ticker, "error": "No float data found"}


# ---------------------------------------------------------------------------
# Dividends
# ---------------------------------------------------------------------------
@cached(ttl=3600)
def get_dividends(ticker: str) -> dict:
    """Get dividend history from FMP."""
    data = _safe_get(f"{FMP_BASE}/historical-price-eod/dividend", params={"symbol": ticker, "apikey": _key()})
    if isinstance(data, dict) and "error" in data:
        return {"ticker": ticker, "dividends": [], "count": 0, **data}
    divs = []
    if isinstance(data, list):
        for d in data[:30]:
            divs.append({
                "date": d.get("date"), "dividend": d.get("dividend"),
                "record_date": d.get("recordDate"),
                "payment_date": d.get("paymentDate"),
                "declaration_date": d.get("declarationDate"),
            })
    return {"ticker": ticker, "dividends": divs, "count": len(divs)}


# ---------------------------------------------------------------------------
# Stock Splits
# ---------------------------------------------------------------------------
@cached(ttl=3600)
def get_splits(ticker: str) -> dict:
    """Get stock split history from FMP."""
    data = _safe_get(f"{FMP_BASE}/historical-price-eod/stock-split", params={"symbol": ticker, "apikey": _key()})
    if isinstance(data, dict) and "error" in data:
        return {"ticker": ticker, "splits": [], "count": 0, **data}
    splits = []
    if isinstance(data, list):
        for s in data[:20]:
            splits.append({
                "date": s.get("date"), "numerator": s.get("numerator"),
                "denominator": s.get("denominator"),
            })
    return {"ticker": ticker, "splits": splits, "count": len(splits)}
