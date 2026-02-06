"""
Eugene Intelligence — FRED (Federal Reserve Economic Data) Source
"""

import requests
import os
from datetime import datetime, timedelta
from typing import Optional

FRED_BASE_URL = "https://api.stlouisfed.org/fred"

POPULAR_SERIES = {
    "FEDFUNDS": "Federal Funds Rate", "DFF": "Federal Funds Rate (Daily)",
    "DGS10": "10-Year Treasury Yield", "DGS2": "2-Year Treasury Yield",
    "DGS30": "30-Year Treasury Yield", "T10Y2Y": "10Y-2Y Treasury Spread",
    "MORTGAGE30US": "30-Year Fixed Mortgage Rate",
    "CPIAUCSL": "Consumer Price Index (CPI)", "CPILFESL": "Core CPI",
    "PCEPI": "PCE Price Index", "PCEPILFE": "Core PCE",
    "T5YIE": "5-Year Breakeven Inflation", "T10YIE": "10-Year Breakeven Inflation",
    "UNRATE": "Unemployment Rate", "PAYEMS": "Total Nonfarm Payrolls",
    "ICSA": "Initial Jobless Claims", "CCSA": "Continued Jobless Claims",
    "CIVPART": "Labor Force Participation Rate",
    "GDP": "Gross Domestic Product", "GDPC1": "Real GDP",
    "RSAFS": "Retail Sales", "PCE": "Personal Consumption Expenditures",
    "PSAVERT": "Personal Savings Rate", "UMCSENT": "Michigan Consumer Sentiment",
    "HOUST": "Housing Starts", "PERMIT": "Building Permits",
    "CSUSHPISA": "Case-Shiller Home Price Index",
    "M2SL": "M2 Money Supply", "WALCL": "Fed Balance Sheet",
    "VIXCLS": "VIX Volatility Index", "SP500": "S&P 500",
    "BAMLH0A0HYM2": "High Yield Spread", "NFCI": "Financial Conditions Index",
    "DTWEXBGS": "Trade-Weighted Dollar Index",
    "INDPRO": "Industrial Production", "TCU": "Capacity Utilization",
}

SERIES_BUNDLES = {
    "recession
cat > eugene/sources/fred.py << 'EOF'
"""
Eugene Intelligence — FRED (Federal Reserve Economic Data) Source
"""

import requests
import os
from datetime import datetime, timedelta
from typing import Optional

FRED_BASE_URL = "https://api.stlouisfed.org/fred"

POPULAR_SERIES = {
    "FEDFUNDS": "Federal Funds Rate", "DFF": "Federal Funds Rate (Daily)",
    "DGS10": "10-Year Treasury Yield", "DGS2": "2-Year Treasury Yield",
    "DGS30": "30-Year Treasury Yield", "T10Y2Y": "10Y-2Y Treasury Spread",
    "MORTGAGE30US": "30-Year Fixed Mortgage Rate",
    "CPIAUCSL": "Consumer Price Index (CPI)", "CPILFESL": "Core CPI",
    "PCEPI": "PCE Price Index", "PCEPILFE": "Core PCE",
    "T5YIE": "5-Year Breakeven Inflation", "T10YIE": "10-Year Breakeven Inflation",
    "UNRATE": "Unemployment Rate", "PAYEMS": "Total Nonfarm Payrolls",
    "ICSA": "Initial Jobless Claims", "CCSA": "Continued Jobless Claims",
    "CIVPART": "Labor Force Participation Rate",
    "GDP": "Gross Domestic Product", "GDPC1": "Real GDP",
    "RSAFS": "Retail Sales", "PCE": "Personal Consumption Expenditures",
    "PSAVERT": "Personal Savings Rate", "UMCSENT": "Michigan Consumer Sentiment",
    "HOUST": "Housing Starts", "PERMIT": "Building Permits",
    "CSUSHPISA": "Case-Shiller Home Price Index",
    "M2SL": "M2 Money Supply", "WALCL": "Fed Balance Sheet",
    "VIXCLS": "VIX Volatility Index", "SP500": "S&P 500",
    "BAMLH0A0HYM2": "High Yield Spread", "NFCI": "Financial Conditions Index",
    "DTWEXBGS": "Trade-Weighted Dollar Index",
    "INDPRO": "Industrial Production", "TCU": "Capacity Utilization",
}

SERIES_BUNDLES = {
    "recession_watch": ["T10Y2Y", "UNRATE", "ICSA", "INDPRO", "UMCSENT", "NFCI"],
    "inflation_dashboard": ["CPIAUCSL", "CPILFESL", "PCEPI", "PCEPILFE", "T5YIE", "T10YIE"],
    "fed_watch": ["FEDFUNDS", "DGS2", "DGS10", "T10Y2Y", "WALCL", "M2SL"],
    "labor_market": ["UNRATE", "PAYEMS", "ICSA", "CCSA", "CIVPART"],
    "housing_market": ["HOUST", "PERMIT", "CSUSHPISA", "MORTGAGE30US"],
    "consumer_health": ["RSAFS", "PCE", "PSAVERT", "UMCSENT"],
    "credit_conditions": ["BAMLH0A0HYM2", "NFCI"],
    "yield_curve": ["DGS2", "DGS10", "DGS30", "T10Y2Y", "FEDFUNDS"],
    "market_overview": ["SP500", "VIXCLS", "DTWEXBGS", "BAMLH0A0HYM2", "NFCI"],
}


def _get_api_key() -> str:
    return os.environ.get("FRED_API_KEY", "")


def get_economic_data(series_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None) -> dict:
    api_key = _get_api_key()
    if not api_key:
        return {"error": "FRED_API_KEY not set. Get free key at https://fred.stlouisfed.org/docs/api/api_key.html", "source": "FRED"}
    
    series_id = series_id.upper().strip()
    if not start_date:
        start_date = (datetime.now() - timedelta(days=3650)).strftime("%Y-%m-%d")
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    try:
        meta_resp = requests.get(f"{FRED_BASE_URL}/series", params={"series_id": series_id, "api_key": api_key, "file_type": "json"}, timeout=15)
        meta_data = meta_resp.json()
        series_info = {}
        if "seriess" in meta_data and meta_data["seriess"]:
            s = meta_data["seriess"][0]
            series_info = {"id": s.get("id"), "title": s.get("title"), "frequency": s.get("frequency"), "units": s.get("units"), "last_updated": s.get("last_updated")}
        
        obs_resp = requests.get(f"{FRED_BASE_URL}/series/observations", params={"series_id": series_id, "api_key": api_key, "file_type": "json", "observation_start": start_date, "observation_end": end_date}, timeout=15)
        obs_data = obs_resp.json()
        
        observations = []
        if "observations" in obs_data:
            for obs in obs_data["observations"]:
                value = obs.get("value", ".")
                observations.append({"date": obs.get("date"), "value": float(value) if value != "." else None})
        
        valid_values = [o["value"] for o in observations if o["value"] is not None]
        summary = {}
        if valid_values:
            summary = {
                "latest_value": valid_values[-1],
                "latest_date": observations[-1]["date"],
                "min": min(valid_values),
                "max": max(valid_values),
                "mean": round(sum(valid_values) / len(valid_values), 4),
                "data_points": len(valid_values),
            }
            if len(valid_values) >= 2:
                summary["previous_value"] = valid_values[-2]
                summary["change"] = round(valid_values[-1] - valid_values[-2], 4)
                if valid_values[-2] != 0:
                    summary["change_pct"] = round(((valid_values[-1] - valid_values[-2]) / abs(valid_values[-2])) * 100, 4)
        
        return {
            "series_id": series_id,
            "display_name": POPULAR_SERIES.get(series_id, series_info.get("title", series_id)),
            "source": "FRED",
            "series_info": series_info,
            "date_range": {"start": start_date, "end": end_date},
            "summary": summary,
            "observations": observations,
        }
    except Exception as e:
        return {"series_id": series_id, "error": str(e), "source": "FRED"}


def get_economic_bundle(bundle_name: str, start_date: Optional[str] = None, end_date: Optional[str] = None) -> dict:
    bundle_name = bundle_name.lower().strip()
    if bundle_name not in SERIES_BUNDLES:
        return {"error": f"Unknown bundle: {bundle_name}", "available_bundles": list(SERIES_BUNDLES.keys()), "source": "FRED"}
    
    if not start_date:
        start_date = (datetime.now() - timedelta(days=730)).strftime("%Y-%m-%d")
    
    series_ids = SERIES_BUNDLES[bundle_name]
    results = {}
    for sid in series_ids:
        data = get_economic_data(sid, start_date=start_date, end_date=end_date)
        if "error" not in data and data.get("summary"):
            results[sid] = {"name": POPULAR_SERIES.get(sid, sid), "latest_value": data["summary"].get("latest_value"), "latest_date": data["summary"].get("latest_date"), "change": data["summary"].get("change")}
        else:
            results[sid] = {"name": POPULAR_SERIES.get(sid, sid), "error": data.get("error", "No data")}
    
    return {"bundle": bundle_name, "source": "FRED", "indicators": results}


def search_fred_series(search_text: str, limit: int = 10) -> dict:
    api_key = _get_api_key()
    if not api_key:
        return {"error": "FRED_API_KEY not set", "source": "FRED"}
    
    try:
        resp = requests.get(f"{FRED_BASE_URL}/series/search", params={"search_text": search_text, "api_key": api_key, "file_type": "json", "limit": limit, "order_by": "popularity", "sort_order": "desc"}, timeout=15)
        data = resp.json()
        results = []
        if "seriess" in data:
            for s in data["seriess"]:
                results.append({"series_id": s.get("id"), "title": s.get("title"), "frequency": s.get("frequency"), "units": s.get("units"), "popularity": s.get("popularity")})
        return {"query": search_text, "source": "FRED", "results": results}
    except Exception as e:
        return {"query": search_text, "error": str(e), "source": "FRED"}
