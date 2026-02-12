"""
Eugene Intelligence — Universal Data Parser
Extracts structured data regardless of source format.
"""
import json
import re
from typing import Union, Dict, List
import requests

SEC_HEADERS = {"User-Agent": "Eugene Intelligence (matthew@eugeneintelligence.com)"}


def detect_format(content: str) -> str:
    """Detect content format."""
    content = content.strip()
    if content.startswith("{") or content.startswith("["):
        return "json"
    elif content.startswith("<?xml") or content.startswith("<"):
        return "xml"
    elif "," in content.split("\n")[0] and "\n" in content:
        return "csv"
    else:
        return "text"


def parse_json(content: str) -> dict:
    """Parse JSON content."""
    try:
        return {"format": "json", "data": json.loads(content), "success": True}
    except Exception as e:
        return {"format": "json", "error": str(e), "success": False}


def parse_xml(content: str) -> dict:
    """Parse XML/RSS content."""
    try:
        import feedparser
        feed = feedparser.parse(content)
        items = []
        for entry in feed.entries:
            items.append({
                "title": entry.get("title", ""),
                "link": entry.get("link", ""),
                "published": entry.get("published", ""),
                "summary": entry.get("summary", "")[:500]
            })
        return {"format": "xml", "data": items, "success": True}
    except Exception as e:
        return {"format": "xml", "error": str(e), "success": False}


def parse_csv(content: str) -> dict:
    """Parse CSV content."""
    try:
        lines = content.strip().split("\n")
        if not lines:
            return {"format": "csv", "data": [], "success": True}
        
        headers = [h.strip().strip('"') for h in lines[0].split(",")]
        rows = []
        
        for line in lines[1:]:
            values = [v.strip().strip('"') for v in line.split(",")]
            if len(values) == len(headers):
                rows.append(dict(zip(headers, values)))
        
        return {"format": "csv", "data": rows, "headers": headers, "success": True}
    except Exception as e:
        return {"format": "csv", "error": str(e), "success": False}


def extract_numbers(text: str) -> List[dict]:
    """Extract financial numbers from text."""
    patterns = [
        (r"\$[\d,]+\.?\d*\s*(million|billion|M|B)?", "currency"),
        (r"[\d,]+\.?\d*\s*%", "percentage"),
        (r"[\d,]+\.?\d*\s*(million|billion|M|B)", "amount"),
    ]
    
    results = []
    for pattern, num_type in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            if isinstance(match, tuple):
                match = " ".join(match)
            results.append({"value": match.strip(), "type": num_type})
    
    return results


def fetch_and_parse(url: str) -> dict:
    """Fetch URL and parse automatically."""
    try:
        r = requests.get(url, headers=SEC_HEADERS, timeout=15)
        content = r.text
        
        fmt = detect_format(content)
        
        if fmt == "json":
            return parse_json(content)
        elif fmt == "xml":
            return parse_xml(content)
        elif fmt == "csv":
            return parse_csv(content)
        else:
            numbers = extract_numbers(content)
            return {"format": "text", "numbers": numbers, "success": True}
    
    except Exception as e:
        return {"url": url, "error": str(e), "success": False}


def normalize_financial_data(data: dict, source: str = "unknown") -> dict:
    """Normalize financial data to standard format."""
    normalized = {
        "source": source,
        "metrics": {},
    }
    
    mappings = {
        "revenue": ["revenue", "revenues", "totalRevenue", "Revenues"],
        "net_income": ["netIncome", "net_income", "NetIncomeLoss"],
        "total_assets": ["totalAssets", "total_assets", "Assets"],
        "price": ["price", "currentPrice", "close"],
        "market_cap": ["marketCap", "market_cap", "mktCap"],
        "eps": ["eps", "earningsPerShare", "EarningsPerShareBasic"],
    }
    
    def find_value(d, keys):
        if isinstance(d, dict):
            for key in keys:
                if key in d:
                    return d[key]
            for v in d.values():
                result = find_value(v, keys)
                if result is not None:
                    return result
        elif isinstance(d, list) and d:
            return find_value(d[0], keys)
        return None
    
    for metric, keys in mappings.items():
        value = find_value(data, keys)
        if value is not None:
            normalized["metrics"][metric] = value
    
    return normalized
