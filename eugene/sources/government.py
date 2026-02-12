"""
Eugene Intelligence — Government Data Sources
Fed, Treasury, Forex
"""
import requests
import feedparser

HEADERS = {"User-Agent": "Eugene Intelligence (matthew@eugeneintelligence.com)"}


# ============================================
# FEDERAL RESERVE
# ============================================

FED_FEEDS = {
    "speeches": "https://www.federalreserve.gov/feeds/speeches.xml",
    "press": "https://www.federalreserve.gov/feeds/press_all.xml",
    "fomc": "https://www.federalreserve.gov/feeds/fomc.xml",
}

def get_fed_data(category: str = "speeches", limit: int = 10) -> dict:
    """Get Federal Reserve speeches, press releases, FOMC."""
    if category not in FED_FEEDS:
        return {"error": f"Unknown category. Valid: {list(FED_FEEDS.keys())}"}
    
    try:
        feed = feedparser.parse(FED_FEEDS[category])
        items = []
        for entry in feed.entries[:limit]:
            items.append({
                "title": entry.get("title", ""),
                "link": entry.get("link", ""),
                "date": entry.get("published", ""),
                "summary": entry.get("summary", "")[:300]
            })
        return {"category": category, "count": len(items), "items": items, "source": "Federal Reserve"}
    except Exception as e:
        return {"error": str(e)}


# ============================================
# TREASURY FISCAL DATA
# ============================================

TREASURY_ENDPOINTS = {
    "debt": "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny",
    "auctions": "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query",
}

def get_treasury_data(data_type: str = "debt") -> dict:
    """Get Treasury fiscal data."""
    if data_type not in TREASURY_ENDPOINTS:
        return {"error": f"Unknown type. Valid: {list(TREASURY_ENDPOINTS.keys())}"}
    
    try:
        url = TREASURY_ENDPOINTS[data_type]
        params = {"sort": "-record_date", "page[size]": 10}
        r = requests.get(url, params=params, headers=HEADERS, timeout=15)
        data = r.json()
        
        return {
            "type": data_type,
            "records": data.get("data", [])[:10],
            "source": "Treasury FiscalData"
        }
    except Exception as e:
        return {"error": str(e)}


# ============================================
# FOREX (ECB)
# ============================================

def get_forex_rates(base: str = "USD") -> dict:
    """Get forex rates from ECB."""
    try:
        url = "https://api.frankfurter.app/latest?from=USD"
        r = requests.get(url, timeout=10)
        data = r.json()
        
        return {
            "base": data.get("base", "USD"),
            "date": data.get("date"),
            "rates": data.get("rates", {}),
            "source": "ECB via Frankfurter"
        }
    except Exception as e:
        return {"error": str(e)}
