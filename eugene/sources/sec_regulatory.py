"""
Eugene Intelligence — SEC Regulatory Data Source
Speeches, press releases, rules, litigation, enforcement actions.
"""
import requests
import feedparser
from typing import Optional
from datetime import datetime, timedelta

# Headers required by SEC
HEADERS = {"User-Agent": "Eugene Intelligence (matthew@eugeneintelligence.com)"}

# SEC RSS Feeds
SEC_FEEDS = {
    "speeches": "https://www.sec.gov/news/speeches.rss",
    "press_releases": "https://www.sec.gov/news/pressreleases.rss",
    "litigation": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=LIT&output=atom",
    "admin_proceedings": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=ADMIN&output=atom",
    "trading_suspensions": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=SUSP&output=atom",
}

EFTS_ENDPOINT = "https://efts.sec.gov/LATEST/search-index"


def get_sec_feed(category: str, limit: int = 20, keyword: str = None) -> dict:
    """
    Fetch SEC RSS feed by category.
    """
    if category not in SEC_FEEDS:
        return {"error": f"Unknown category: {category}. Valid: {list(SEC_FEEDS.keys())}"}
    
    try:
        # Fetch with headers
        resp = requests.get(SEC_FEEDS[category], headers=HEADERS, timeout=15)
        feed = feedparser.parse(resp.text)
        
        results = []
        for entry in feed.entries[:limit * 2]:
            item = {
                "title": entry.get("title", ""),
                "link": entry.get("link", ""),
                "published": entry.get("published", entry.get("updated", "")),
                "summary": entry.get("summary", "")[:500],
            }
            
            if keyword:
                text = f"{item['title']} {item['summary']}".lower()
                if keyword.lower() not in text:
                    continue
            
            results.append(item)
            
            if len(results) >= limit:
                break
        
        return {
            "category": category,
            "count": len(results),
            "items": results,
            "source": "SEC"
        }
    except Exception as e:
        return {"category": category, "error": str(e), "source": "SEC"}


def search_sec_filings(query: str, filing_type: str = None, date_from: str = None, limit: int = 20) -> dict:
    """
    Search SEC EDGAR full-text search (EFTS).
    """
    try:
        params = {"q": query}
        
        if date_from:
            params["dateRange"] = "custom"
            params["startdt"] = date_from
            params["enddt"] = datetime.now().strftime("%Y-%m-%d")
        
        if filing_type:
            params["forms"] = filing_type
        
        resp = requests.get(EFTS_ENDPOINT, params=params, headers=HEADERS, timeout=15)
        data = resp.json()
        
        results = []
        hits = data.get("hits", {}).get("hits", [])
        
        for hit in hits[:limit]:
            source = hit.get("_source", {})
            results.append({
                "form": source.get("form", ""),
                "filed_date": source.get("file_date", ""),
                "company": source.get("entity_name", ""),
                "cik": source.get("cik", ""),
                "description": source.get("display_names", [""])[0] if source.get("display_names") else "",
            })
        
        return {
            "query": query,
            "count": len(results),
            "results": results,
            "source": "SEC EFTS"
        }
    except Exception as e:
        return {"query": query, "error": str(e), "source": "SEC EFTS"}


def get_enforcement_actions(days_back: int = 30, keyword: str = None) -> dict:
    """
    Get recent SEC enforcement actions.
    """
    litigation = get_sec_feed("litigation", limit=30, keyword=keyword)
    admin = get_sec_feed("admin_proceedings", limit=20, keyword=keyword)
    
    all_actions = []
    
    for item in litigation.get("items", []):
        item["type"] = "litigation"
        all_actions.append(item)
    
    for item in admin.get("items", []):
        item["type"] = "admin_proceeding"
        all_actions.append(item)
    
    return {
        "count": len(all_actions),
        "actions": all_actions[:50],
        "source": "SEC"
    }


def check_company_enforcement(ticker: str, company_name: str = None) -> dict:
    """
    Check if a company has recent enforcement actions.
    """
    search_term = company_name or ticker
    
    results = search_sec_filings(
        query=search_term,
        date_from=(datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d"),
        limit=10
    )
    
    return {
        "ticker": ticker,
        "search_term": search_term,
        "has_enforcement": results.get("count", 0) > 0,
        "action_count": results.get("count", 0),
        "results": results.get("results", []),
        "source": "SEC EFTS"
    }
