"""FRED economic data source."""
import os
from eugene.cache import cached

FRED_SERIES = {
    "inflation": {
        "CPIAUCSL": "CPI All Urban Consumers",
        "CPILFESL": "CPI Core (ex Food & Energy)",
        "PCEPI": "PCE Price Index",
        "PCEPILFE": "PCE Core",
    },
    "employment": {
        "UNRATE": "Unemployment Rate",
        "PAYEMS": "Total Nonfarm Payrolls",
        "ICSA": "Initial Jobless Claims",
        "CCSA": "Continuing Claims",
    },
    "gdp": {
        "GDP": "Nominal GDP",
        "GDPC1": "Real GDP",
        "A191RL1Q225SBEA": "Real GDP Growth Rate",
    },
    "housing": {
        "HOUST": "Housing Starts",
        "PERMIT": "Building Permits",
        "MORTGAGE30US": "30-Year Mortgage Rate",
        "CSUSHPISA": "Case-Shiller Home Price Index",
    },
    "consumer": {
        "UMCSENT": "Consumer Sentiment",
        "PCE": "Personal Consumption Expenditures",
        "RSAFS": "Retail Sales",
    },
    "manufacturing": {
        "INDPRO": "Industrial Production",
        "TCU": "Capacity Utilization",
    },
    "rates": {
        "FEDFUNDS": "Federal Funds Rate",
        "T10Y2Y": "10Y-2Y Spread",
        "T10Y3M": "10Y-3M Spread",
    },
    "money": {
        "M2SL": "M2 Money Supply",
        "WALCL": "Fed Balance Sheet",
    },
    "treasury": {
        "DGS1": "1-Year Treasury",
        "DGS2": "2-Year Treasury",
        "DGS5": "5-Year Treasury",
        "DGS10": "10-Year Treasury",
        "DGS30": "30-Year Treasury",
    },
}


def _get_fred():
    from fredapi import Fred
    return Fred(api_key=os.environ.get("FRED_API_KEY", ""))


@cached(ttl=3600)
def get_category(category: str) -> dict:
    """Fetch all series in a FRED category."""
    fred = _get_fred()
    series_map = FRED_SERIES.get(category, {})
    if not series_map:
        return {"error": f"Unknown category: {category}", "valid": list(FRED_SERIES.keys())}

    results = {}
    for series_id, label in series_map.items():
        try:
            s = fred.get_series(series_id)
            if s is not None and len(s) > 0:
                latest = s.dropna().iloc[-1]
                results[series_id] = {
                    "label": label,
                    "value": round(float(latest), 4),
                    "date": str(s.dropna().index[-1].date()),
                }
        except Exception:
            results[series_id] = {"label": label, "error": "fetch failed"}

    return {"category": category, "series": results, "source": "FRED"}


@cached(ttl=3600)
def get_series(series_id: str) -> dict:
    """Fetch a specific FRED series."""
    fred = _get_fred()
    try:
        s = fred.get_series(series_id)
        if s is not None and len(s) > 0:
            recent = s.dropna().tail(30)
            data = [{"date": str(idx.date()), "value": round(float(val), 4)} for idx, val in recent.items()]
            return {"series_id": series_id, "data": data, "source": "FRED"}
    except Exception as e:
        return {"series_id": series_id, "error": str(e)}
    return {"series_id": series_id, "error": "No data"}


def get_all() -> dict:
    """Fetch latest from all categories."""
    results = {}
    for cat in FRED_SERIES:
        results[cat] = get_category(cat)
    return {"categories": results, "source": "FRED"}
