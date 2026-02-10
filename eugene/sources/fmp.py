"""
Eugene Intelligence — Financial Modeling Prep (FMP) Source
Uses new /stable/ API endpoints.
"""
import requests
import os
from typing import List
from datetime import datetime, timedelta

FMP_BASE_URL = "https://financialmodelingprep.com/stable"

def _get_api_key() -> str:
    return os.environ.get("FMP_API_KEY", "qHpeyyajejSLEzWdaMmerWRJVkLDP6Pu")

def get_stock_price(ticker: str) -> dict:
    """Get current stock quote."""
    try:
        api_key = _get_api_key()
        resp = requests.get(f"{FMP_BASE_URL}/quote?symbol={ticker}&apikey={api_key}", timeout=15)
        data = resp.json()
        if data and len(data) > 0:
            q = data[0]
            return {
                "ticker": ticker,
                "price": q.get("price"),
                "change": q.get("change"),
                "change_percent": q.get("changePercentage"),
                "volume": q.get("volume"),
                "market_cap": q.get("marketCap"),
                "day_high": q.get("dayHigh"),
                "day_low": q.get("dayLow"),
                "year_high": q.get("yearHigh"),
                "year_low": q.get("yearLow"),
                "avg_50": q.get("priceAvg50"),
                "avg_200": q.get("priceAvg200"),
                "source": "FMP"
            }
        return {"ticker": ticker, "error": "No data found", "source": "FMP"}
    except Exception as e:
        return {"ticker": ticker, "error": str(e), "source": "FMP"}

def get_company_profile(ticker: str) -> dict:
    """Get company profile."""
    try:
        api_key = _get_api_key()
        resp = requests.get(f"{FMP_BASE_URL}/profile?symbol={ticker}&apikey={api_key}", timeout=15)
        data = resp.json()
        if data and len(data) > 0:
            p = data[0]
            return {
                "ticker": ticker,
                "name": p.get("companyName"),
                "sector": p.get("sector"),
                "industry": p.get("industry"),
                "description": p.get("description"),
                "ceo": p.get("ceo"),
                "employees": p.get("fullTimeEmployees"),
                "website": p.get("website"),
                "market_cap": p.get("mktCap"),
                "country": p.get("country"),
                "exchange": p.get("exchangeShortName"),
                "source": "FMP"
            }
        return {"ticker": ticker, "error": "No data found", "source": "FMP"}
    except Exception as e:
        return {"ticker": ticker, "error": str(e), "source": "FMP"}

def get_stock_history(ticker: str, period: str = "1y") -> dict:
    """Get historical stock prices."""
    try:
        api_key = _get_api_key()
        resp = requests.get(f"{FMP_BASE_URL}/historical-price-eod/full?symbol={ticker}&apikey={api_key}", timeout=15)
        data = resp.json()
        if data and "historical" in data:
            days_map = {"1m": 30, "3m": 90, "6m": 180, "1y": 365, "2y": 730, "5y": 1825}
            days = days_map.get(period, 365)
            cutoff = datetime.now() - timedelta(days=days)
            history = []
            for h in data["historical"]:
                date = datetime.strptime(h["date"], "%Y-%m-%d")
                if date >= cutoff:
                    history.append({"date": h["date"], "open": h["open"], "high": h["high"], "low": h["low"], "close": h["close"], "volume": h["volume"]})
            return {"ticker": ticker, "period": period, "history": history[::-1], "source": "FMP"}
        return {"ticker": ticker, "error": "No data found", "source": "FMP"}
    except Exception as e:
        return {"ticker": ticker, "error": str(e), "source": "FMP"}

def get_analyst_estimates(ticker: str) -> dict:
    """Get analyst price targets."""
    try:
        api_key = _get_api_key()
        resp = requests.get(f"{FMP_BASE_URL}/price-target?symbol={ticker}&apikey={api_key}", timeout=15)
        data = resp.json()
        targets = []
        if data:
            for t in data[:10]:
                targets.append({"analyst": t.get("analystName"), "company": t.get("analystCompany"), "target": t.get("adjPriceTarget"), "date": t.get("publishedDate")})
        return {"ticker": ticker, "price_targets": targets, "source": "FMP"}
    except Exception as e:
        return {"ticker": ticker, "error": str(e), "source": "FMP"}

def get_earnings(ticker: str) -> dict:
    """Get earnings history."""
    try:
        api_key = _get_api_key()
        resp = requests.get(f"{FMP_BASE_URL}/earning-calendar-historical?symbol={ticker}&apikey={api_key}", timeout=15)
        data = resp.json()
        earnings = []
        if data:
            for e in data[:20]:
                earnings.append({"date": e.get("date"), "eps_actual": e.get("eps"), "eps_estimate": e.get("epsEstimated"), "revenue_actual": e.get("revenue"), "revenue_estimate": e.get("revenueEstimated")})
        return {"ticker": ticker, "earnings": earnings, "source": "FMP"}
    except Exception as e:
        return {"ticker": ticker, "error": str(e), "source": "FMP"}

def get_stock_news(ticker: str = None, limit: int = 20) -> dict:
    """Get stock news."""
    try:
        api_key = _get_api_key()
        url = f"{FMP_BASE_URL}/stock-news?symbol={ticker}&limit={limit}&apikey={api_key}" if ticker else f"{FMP_BASE_URL}/stock-news?limit={limit}&apikey={api_key}"
        resp = requests.get(url, timeout=15)
        data = resp.json()
        news = []
        if data:
            for n in data[:limit]:
                news.append({"title": n.get("title"), "url": n.get("url"), "site": n.get("site"), "date": n.get("publishedDate"), "ticker": n.get("symbol")})
        return {"ticker": ticker, "news": news, "source": "FMP"}
    except Exception as e:
        return {"ticker": ticker, "error": str(e), "source": "FMP"}

def quick_quote(tickers: List[str]) -> dict:
    """Get quotes for multiple tickers."""
    try:
        api_key = _get_api_key()
        resp = requests.get(f"{FMP_BASE_URL}/quote?symbol={','.join(tickers)}&apikey={api_key}", timeout=15)
        data = resp.json()
        quotes = {}
        if data:
            for q in data:
                quotes[q.get("symbol")] = {"price": q.get("price"), "change_percent": q.get("changePercentage"), "market_cap": q.get("marketCap")}
        return {"quotes": quotes, "source": "FMP"}
    except Exception as e:
        return {"error": str(e), "source": "FMP"}
