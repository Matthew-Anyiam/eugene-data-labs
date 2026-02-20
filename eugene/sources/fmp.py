"""FMP source for market data (prices, profile, earnings, estimates, news)."""
import os
import requests
from eugene.cache import cached

FMP_BASE = "https://financialmodelingprep.com/stable"


def _key():
    return os.environ.get("FMP_API_KEY", "")


@cached(ttl=60)
def get_price(ticker: str) -> dict:
    r = requests.get(f"{FMP_BASE}/quote?symbol={ticker}&apikey={_key()}", timeout=15)
    data = r.json()
    if data and len(data) > 0:
        q = data[0]
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
    r = requests.get(f"{FMP_BASE}/profile?symbol={ticker}&apikey={_key()}", timeout=15)
    data = r.json()
    if data and len(data) > 0:
        p = data[0]
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
    r = requests.get(f"{FMP_BASE}/earning-calendar-historical?symbol={ticker}&apikey={_key()}", timeout=15)
    data = r.json()
    earnings = []
    if data:
        for e in data[:12]:
            earnings.append({
                "date": e.get("date"), "eps_actual": e.get("eps"),
                "eps_estimate": e.get("epsEstimated"), "revenue_actual": e.get("revenue"),
                "revenue_estimate": e.get("revenueEstimated"),
            })
    return {"ticker": ticker, "earnings": earnings}


@cached(ttl=3600)
def get_estimates(ticker: str) -> dict:
    r = requests.get(f"{FMP_BASE}/price-target?symbol={ticker}&apikey={_key()}", timeout=15)
    data = r.json()
    targets = []
    if data:
        for t in data[:10]:
            targets.append({
                "analyst": t.get("analystName"), "company": t.get("analystCompany"),
                "target": t.get("adjPriceTarget"), "date": t.get("publishedDate"),
            })
    return {"ticker": ticker, "price_targets": targets}


@cached(ttl=300)
def get_news(ticker: str, limit: int = 10) -> dict:
    r = requests.get(f"{FMP_BASE}/news?symbol={ticker}&limit={limit}&apikey={_key()}", timeout=15)
    data = r.json()
    articles = []
    if data:
        for a in data[:limit]:
            articles.append({
                "title": a.get("title"), "date": a.get("publishedDate"),
                "source": a.get("site"), "url": a.get("url"),
                "snippet": (a.get("text") or "")[:300],
            })
    return {"ticker": ticker, "articles": articles}
