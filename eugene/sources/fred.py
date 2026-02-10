"""
Eugene Intelligence — FRED (Federal Reserve Economic Data) Source
"""
import requests
import os
from datetime import datetime, timedelta
from typing import Optional

FRED_BASE_URL = "https://api.stlouisfed.org/fred"

SERIES_BUNDLES = {
    "inflation": ["CPIAUCSL", "CPILFESL", "PCEPI", "PCEPILFE"],
    "employment": ["UNRATE", "PAYEMS", "ICSA", "CIVPART"],
    "rates": ["FEDFUNDS", "DGS10", "DGS2", "T10Y2Y"],
    "housing": ["HOUST", "PERMIT", "CSUSHPISA", "MORTGAGE30US"],
    "gdp": ["GDP", "GDPC1", "A191RL1Q225SBEA"],
    "recession": ["USREC", "SAHMREALTIME", "T10Y3M"]
}

def _get_api_key() -> str:
    key = os.environ.get("FRED_API_KEY")
    if not key:
        raise ValueError("FRED_API_KEY environment variable not set")
    return key

def get_economic_data(series_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None) -> dict:
    """Get data for a single FRED series."""
    try:
        api_key = _get_api_key()
        params = {
            "series_id": series_id,
            "api_key": api_key,
            "file_type": "json"
        }
        if start_date:
            params["observation_start"] = start_date
        if end_date:
            params["observation_end"] = end_date
        
        resp = requests.get(f"{FRED_BASE_URL}/series/observations", params=params, timeout=15)
        data = resp.json()
        
        observations = []
        if "observations" in data:
            for obs in data["observations"]:
                observations.append({
                    "date": obs.get("date"),
                    "value": obs.get("value")
                })
        
        return {
            "series_id": series_id,
            "source": "FRED",
            "observations": observations
        }
    except Exception as e:
        return {"series_id": series_id, "error": str(e), "source": "FRED"}

def get_economic_bundle(bundle_name: str, start_date: Optional[str] = None, end_date: Optional[str] = None) -> dict:
    """Get data for a bundle of related FRED series."""
    bundle_name = bundle_name.lower()
    if bundle_name not in SERIES_BUNDLES:
        return {"error": f"Unknown bundle: {bundle_name}. Options: {list(SERIES_BUNDLES.keys())}"}
    
    results = {}
    for series_id in SERIES_BUNDLES[bundle_name]:
        results[series_id] = get_economic_data(series_id, start_date, end_date)
    
    return {
        "bundle": bundle_name,
        "source": "FRED",
        "series": results
    }

def search_fred_series(search_text: str, limit: int = 10) -> dict:
    """Search for FRED series by keyword."""
    try:
        api_key = _get_api_key()
        resp = requests.get(
            f"{FRED_BASE_URL}/series/search",
            params={
                "search_text": search_text,
                "api_key": api_key,
                "file_type": "json",
                "limit": limit,
                "order_by": "popularity",
                "sort_order": "desc"
            },
            timeout=15
        )
        data = resp.json()
        
        results = []
        if "seriess" in data:
            for s in data["seriess"]:
                results.append({
                    "series_id": s.get("id"),
                    "title": s.get("title"),
                    "frequency": s.get("frequency"),
                    "units": s.get("units"),
                    "popularity": s.get("popularity")
                })
        
        return {"query": search_text, "source": "FRED", "results": results}
    except Exception as e:
        return {"query": search_text, "error": str(e), "source": "FRED"}