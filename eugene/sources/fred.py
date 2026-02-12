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
    key = os.environ.get("FRED_API_KEY", "018a61888253d0c6d69e55df3dc38f8c")
    if not key:
        pass  # Using default key
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

# Economic indicator bundles
ECONOMIC_INDICATORS = {
    "inflation": {
        "CPIAUCSL": "CPI (All Urban Consumers)",
        "CPILFESL": "Core CPI (Ex Food & Energy)", 
        "PCEPI": "PCE Price Index",
        "PCEPILFE": "Core PCE",
    },
    "employment": {
        "UNRATE": "Unemployment Rate",
        "PAYEMS": "Nonfarm Payrolls",
        "ICSA": "Initial Jobless Claims",
        "CIVPART": "Labor Force Participation",
        "AHETPI": "Avg Hourly Earnings",
    },
    "gdp": {
        "GDP": "Nominal GDP",
        "GDPC1": "Real GDP",
        "A191RL1Q225SBEA": "Real GDP Growth Rate",
    },
    "housing": {
        "HOUST": "Housing Starts",
        "PERMIT": "Building Permits",
        "CSUSHPISA": "Case-Shiller Home Price",
        "MORTGAGE30US": "30Y Mortgage Rate",
    },
    "consumer": {
        "RSXFS": "Retail Sales",
        "UMCSENT": "Consumer Sentiment",
        "PCE": "Personal Consumption",
    },
    "manufacturing": {
        "INDPRO": "Industrial Production",
        "DGORDER": "Durable Goods Orders",
    },
    "rates": {
        "FEDFUNDS": "Fed Funds Rate",
        "DGS2": "2Y Treasury",
        "DGS10": "10Y Treasury",
        "T10Y2Y": "10Y-2Y Spread",
        "T10Y3M": "10Y-3M Spread",
    },
    "money": {
        "M1SL": "M1 Money Supply",
        "M2SL": "M2 Money Supply",
    }
}


def get_latest_indicators(category: str = "all") -> dict:
    """Get latest values for economic indicators."""
    import requests
    
    api_key = os.environ.get("FRED_API_KEY", "018a61888253d0c6d69e55df3dc38f8c")
    
    if category == "all":
        categories = ECONOMIC_INDICATORS.keys()
    elif category in ECONOMIC_INDICATORS:
        categories = [category]
    else:
        return {"error": f"Unknown category: {category}. Valid: {list(ECONOMIC_INDICATORS.keys())}"}
    
    results = {}
    
    for cat in categories:
        results[cat] = {}
        for series_id, name in ECONOMIC_INDICATORS[cat].items():
            try:
                url = f"https://api.stlouisfed.org/fred/series/observations"
                params = {
                    "series_id": series_id,
                    "api_key": api_key,
                    "file_type": "json",
                    "limit": 1,
                    "sort_order": "desc"
                }
                r = requests.get(url, params=params, timeout=10)
                data = r.json()
                
                if "observations" in data and data["observations"]:
                    obs = data["observations"][0]
                    results[cat][series_id] = {
                        "name": name,
                        "value": obs.get("value"),
                        "date": obs.get("date")
                    }
            except:
                continue
    
    return {"indicators": results, "source": "FRED"}
