"""
Emerging Markets alternative data — World Bank, commodity exposure, currency risk.

Free APIs, no key required.
- World Bank: https://api.worldbank.org/v2/
- BIS Statistics: https://data.bis.org/
"""

import logging
import requests
from datetime import datetime, timezone
from eugene.cache import cached

logger = logging.getLogger(__name__)

WORLDBANK_API = "https://api.worldbank.org/v2"
TIMEOUT = 20

# ---------------------------------------------------------------------------
# Emerging market country universe
# ---------------------------------------------------------------------------

EM_COUNTRIES = {
    # BRICS+
    "BR": {"name": "Brazil", "region": "Latin America", "income": "upper_middle"},
    "RU": {"name": "Russia", "region": "Europe & Central Asia", "income": "upper_middle"},
    "IN": {"name": "India", "region": "South Asia", "income": "lower_middle"},
    "CN": {"name": "China", "region": "East Asia", "income": "upper_middle"},
    "ZA": {"name": "South Africa", "region": "Sub-Saharan Africa", "income": "upper_middle"},
    # Next 11 / Frontier
    "MX": {"name": "Mexico", "region": "Latin America", "income": "upper_middle"},
    "ID": {"name": "Indonesia", "region": "East Asia", "income": "upper_middle"},
    "TR": {"name": "Turkey", "region": "Europe & Central Asia", "income": "upper_middle"},
    "NG": {"name": "Nigeria", "region": "Sub-Saharan Africa", "income": "lower_middle"},
    "EG": {"name": "Egypt", "region": "Middle East & North Africa", "income": "lower_middle"},
    "VN": {"name": "Vietnam", "region": "East Asia", "income": "lower_middle"},
    "PH": {"name": "Philippines", "region": "East Asia", "income": "lower_middle"},
    "PK": {"name": "Pakistan", "region": "South Asia", "income": "lower_middle"},
    "BD": {"name": "Bangladesh", "region": "South Asia", "income": "lower_middle"},
    "TH": {"name": "Thailand", "region": "East Asia", "income": "upper_middle"},
    "MY": {"name": "Malaysia", "region": "East Asia", "income": "upper_middle"},
    "CL": {"name": "Chile", "region": "Latin America", "income": "high"},
    "CO": {"name": "Colombia", "region": "Latin America", "income": "upper_middle"},
    "PE": {"name": "Peru", "region": "Latin America", "income": "upper_middle"},
    "KE": {"name": "Kenya", "region": "Sub-Saharan Africa", "income": "lower_middle"},
    "SA": {"name": "Saudi Arabia", "region": "Middle East & North Africa", "income": "high"},
    "AE": {"name": "UAE", "region": "Middle East & North Africa", "income": "high"},
    "PL": {"name": "Poland", "region": "Europe & Central Asia", "income": "high"},
    "CZ": {"name": "Czech Republic", "region": "Europe & Central Asia", "income": "high"},
    "HU": {"name": "Hungary", "region": "Europe & Central Asia", "income": "high"},
    "AR": {"name": "Argentina", "region": "Latin America", "income": "upper_middle"},
    "GH": {"name": "Ghana", "region": "Sub-Saharan Africa", "income": "lower_middle"},
    "ET": {"name": "Ethiopia", "region": "Sub-Saharan Africa", "income": "low"},
    "TZ": {"name": "Tanzania", "region": "Sub-Saharan Africa", "income": "lower_middle"},
}

# Key World Bank indicators for EM analysis
EM_INDICATORS = {
    # Growth
    "gdp_growth": {"id": "NY.GDP.MKTP.KD.ZG", "name": "GDP Growth (%)", "category": "growth"},
    "gdp_per_capita": {"id": "NY.GDP.PCAP.CD", "name": "GDP per Capita (USD)", "category": "growth"},
    "gdp_total": {"id": "NY.GDP.MKTP.CD", "name": "GDP (current USD)", "category": "growth"},
    # Inflation & prices
    "inflation": {"id": "FP.CPI.TOTL.ZG", "name": "Inflation, CPI (%)", "category": "prices"},
    "food_inflation": {"id": "FP.CPI.TOTL.ZG", "name": "Consumer Price Index", "category": "prices"},
    # Trade
    "trade_pct_gdp": {"id": "NE.TRD.GNFS.ZS", "name": "Trade (% of GDP)", "category": "trade"},
    "exports_gdp": {"id": "NE.EXP.GNFS.ZS", "name": "Exports (% of GDP)", "category": "trade"},
    "imports_gdp": {"id": "NE.IMP.GNFS.ZS", "name": "Imports (% of GDP)", "category": "trade"},
    "current_account": {"id": "BN.CAB.XOKA.CD", "name": "Current Account Balance (USD)", "category": "trade"},
    "fdi_inflows": {"id": "BX.KLT.DINV.CD.WD", "name": "FDI Net Inflows (USD)", "category": "trade"},
    # Debt & fiscal
    "debt_pct_gdp": {"id": "GC.DOD.TOTL.GD.ZS", "name": "Government Debt (% GDP)", "category": "fiscal"},
    "external_debt": {"id": "DT.DOD.DECT.CD", "name": "External Debt (USD)", "category": "fiscal"},
    "reserves": {"id": "FI.RES.TOTL.CD", "name": "Foreign Reserves (USD)", "category": "fiscal"},
    # Demographics & development
    "population": {"id": "SP.POP.TOTL", "name": "Population", "category": "demographics"},
    "urban_pct": {"id": "SP.URB.TOTL.IN.ZS", "name": "Urban Population (%)", "category": "demographics"},
    "internet_pct": {"id": "IT.NET.USER.ZS", "name": "Internet Users (%)", "category": "demographics"},
    # Energy
    "energy_imports": {"id": "EG.IMP.CONS.ZS", "name": "Energy Imports (% of use)", "category": "energy"},
    "co2_per_capita": {"id": "EN.ATM.CO2E.PC", "name": "CO2 Emissions per Capita", "category": "energy"},
    # Commodity dependence
    "fuel_exports_pct": {"id": "TX.VAL.FUEL.ZS.UN", "name": "Fuel Exports (% of merch.)", "category": "commodities"},
    "ore_exports_pct": {"id": "TX.VAL.MMTL.ZS.UN", "name": "Ore/Metal Exports (% merch.)", "category": "commodities"},
    "agri_exports_pct": {"id": "TX.VAL.AGRI.ZS.UN", "name": "Agri Exports (% merch.)", "category": "commodities"},
}

# Commodity-dependent EMs: maps countries to their key commodity exposure
COMMODITY_EXPOSURE = {
    "SA": {"primary": "oil", "commodities": ["crude_oil", "refined_petroleum", "petrochemicals"], "pct_revenue": 65},
    "RU": {"primary": "oil_gas", "commodities": ["crude_oil", "natural_gas", "wheat", "metals"], "pct_revenue": 45},
    "NG": {"primary": "oil", "commodities": ["crude_oil", "natural_gas", "cocoa"], "pct_revenue": 80},
    "BR": {"primary": "diversified", "commodities": ["soybeans", "iron_ore", "crude_oil", "coffee", "sugar"], "pct_revenue": 55},
    "CL": {"primary": "copper", "commodities": ["copper", "lithium", "fish"], "pct_revenue": 50},
    "PE": {"primary": "metals", "commodities": ["copper", "gold", "zinc", "silver"], "pct_revenue": 60},
    "ID": {"primary": "diversified", "commodities": ["palm_oil", "coal", "nickel", "rubber", "tin"], "pct_revenue": 45},
    "MY": {"primary": "diversified", "commodities": ["palm_oil", "natural_gas", "rubber", "electronics"], "pct_revenue": 30},
    "ZA": {"primary": "metals", "commodities": ["gold", "platinum", "coal", "iron_ore", "manganese"], "pct_revenue": 40},
    "CO": {"primary": "oil", "commodities": ["crude_oil", "coal", "coffee", "gold"], "pct_revenue": 50},
    "GH": {"primary": "gold", "commodities": ["gold", "cocoa", "oil"], "pct_revenue": 55},
    "ET": {"primary": "agriculture", "commodities": ["coffee", "sesame", "flowers", "textiles"], "pct_revenue": 70},
    "AE": {"primary": "oil", "commodities": ["crude_oil", "natural_gas", "aluminum"], "pct_revenue": 30},
    "EG": {"primary": "diversified", "commodities": ["natural_gas", "crude_oil", "cotton", "suez_tolls"], "pct_revenue": 25},
    "AR": {"primary": "agriculture", "commodities": ["soybeans", "corn", "wheat", "lithium", "shale_oil"], "pct_revenue": 55},
    "KE": {"primary": "agriculture", "commodities": ["tea", "coffee", "flowers", "vegetables"], "pct_revenue": 50},
    "TZ": {"primary": "agriculture", "commodities": ["gold", "tobacco", "coffee", "cashews"], "pct_revenue": 45},
}


# ---------------------------------------------------------------------------
# World Bank API helpers
# ---------------------------------------------------------------------------

def _wb_fetch(endpoint: str, params: dict | None = None) -> list | None:
    """Fetch data from World Bank API v2."""
    base_params = {"format": "json", "per_page": "200"}
    if params:
        base_params.update(params)
    try:
        resp = requests.get(f"{WORLDBANK_API}/{endpoint}", params=base_params, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        # WB API returns [metadata, data_array]
        if isinstance(data, list) and len(data) > 1:
            return data[1]
        return None
    except Exception as e:
        logger.error("World Bank API error: %s", e)
        return None


# ---------------------------------------------------------------------------
# Core data functions
# ---------------------------------------------------------------------------

@cached(ttl=86400)  # 24h — WB data updates infrequently
def get_country_indicators(
    country: str,
    indicators: list[str] | None = None,
    years: int = 5,
) -> dict:
    """Get key economic indicators for an emerging market country.

    Args:
        country: ISO2 country code (e.g., 'BR', 'IN', 'NG')
        indicators: List of indicator keys from EM_INDICATORS (default: core set)
        years: How many years of history

    Returns:
        Dict with country profile, indicators with historical data, and commodity exposure.
    """
    country = country.upper()
    meta = EM_COUNTRIES.get(country, {"name": country, "region": "Unknown", "income": "unknown"})

    if not indicators:
        indicators = ["gdp_growth", "inflation", "trade_pct_gdp", "debt_pct_gdp",
                       "fdi_inflows", "reserves", "population", "fuel_exports_pct"]

    now = datetime.now(timezone.utc)
    date_range = f"{now.year - years}:{now.year}"

    results = {}
    for ind_key in indicators:
        ind = EM_INDICATORS.get(ind_key)
        if not ind:
            continue

        rows = _wb_fetch(
            f"country/{country}/indicator/{ind['id']}",
            {"date": date_range},
        )
        if not rows:
            results[ind_key] = {"name": ind["name"], "category": ind["category"], "data": [], "latest": None}
            continue

        series = []
        latest_val = None
        for row in rows:
            val = row.get("value")
            if val is not None:
                series.append({"year": row["date"], "value": round(val, 2)})
                if latest_val is None:
                    latest_val = {"value": round(val, 2), "year": row["date"]}

        results[ind_key] = {
            "name": ind["name"],
            "category": ind["category"],
            "data": sorted(series, key=lambda x: x["year"]),
            "latest": latest_val,
        }

    return {
        "country": country,
        "name": meta["name"],
        "region": meta["region"],
        "income_group": meta["income"],
        "commodity_exposure": COMMODITY_EXPOSURE.get(country),
        "indicators": results,
        "source": "world_bank",
    }


@cached(ttl=86400)
def get_em_rankings(
    indicator: str = "gdp_growth",
    year: str | None = None,
    region: str | None = None,
) -> dict:
    """Rank emerging market countries by a given indicator.

    Args:
        indicator: Key from EM_INDICATORS
        year: Specific year (default: latest available)
        region: Filter by region (e.g., 'Latin America', 'Sub-Saharan Africa')
    """
    ind = EM_INDICATORS.get(indicator)
    if not ind:
        return {"error": f"Unknown indicator: {indicator}", "available": list(EM_INDICATORS.keys())}

    countries = list(EM_COUNTRIES.keys())
    if region:
        countries = [c for c, m in EM_COUNTRIES.items() if region.lower() in m["region"].lower()]

    country_str = ";".join(countries)
    params = {"date": year} if year else {"mrnev": "1"}  # mrnev=1 = most recent non-empty value

    rows = _wb_fetch(f"country/{country_str}/indicator/{ind['id']}", params)
    if not rows:
        return {"rankings": [], "indicator": ind["name"], "count": 0, "source": "world_bank"}

    entries = []
    for row in rows:
        val = row.get("value")
        if val is None:
            continue
        iso = row.get("countryiso3code", "")
        # Map ISO3 back to ISO2
        iso2 = row.get("country", {}).get("id", "")
        meta = EM_COUNTRIES.get(iso2, {"name": row.get("country", {}).get("value", iso), "region": ""})
        entries.append({
            "country": iso2,
            "name": meta["name"],
            "region": meta.get("region", ""),
            "value": round(val, 2),
            "year": row.get("date", ""),
        })

    # Sort descending by value
    entries.sort(key=lambda x: x["value"], reverse=True)

    # Add rank
    for i, entry in enumerate(entries):
        entry["rank"] = i + 1

    return {
        "indicator": ind["name"],
        "indicator_key": indicator,
        "rankings": entries,
        "count": len(entries),
        "region_filter": region,
        "source": "world_bank",
    }


@cached(ttl=86400)
def get_em_overview(region: str | None = None) -> dict:
    """Get a high-level overview of all emerging markets.

    Returns GDP growth, inflation, and commodity exposure for each country.
    """
    countries = EM_COUNTRIES
    if region:
        countries = {c: m for c, m in EM_COUNTRIES.items() if region.lower() in m["region"].lower()}

    country_list = list(countries.keys())

    # World Bank API has URL length limits — batch into groups of 15
    def _batch_fetch(indicator_id: str) -> list:
        all_rows = []
        batch_size = 15
        for i in range(0, len(country_list), batch_size):
            batch = ";".join(country_list[i:i + batch_size])
            rows = _wb_fetch(f"country/{batch}/indicator/{indicator_id}", {"mrnev": "1"})
            if rows:
                all_rows.extend(rows)
        return all_rows

    gdp_rows = _batch_fetch("NY.GDP.MKTP.KD.ZG")
    inflation_rows = _batch_fetch("FP.CPI.TOTL.ZG")

    gdp_map = {}
    if gdp_rows:
        for row in gdp_rows:
            iso2 = row.get("country", {}).get("id", "")
            val = row.get("value")
            if iso2 and val is not None:
                gdp_map[iso2] = {"value": round(val, 2), "year": row["date"]}

    inflation_map = {}
    if inflation_rows:
        for row in inflation_rows:
            iso2 = row.get("country", {}).get("id", "")
            val = row.get("value")
            if iso2 and val is not None:
                inflation_map[iso2] = {"value": round(val, 2), "year": row["date"]}

    overview = []
    for iso2, meta in countries.items():
        overview.append({
            "country": iso2,
            "name": meta["name"],
            "region": meta["region"],
            "income_group": meta["income"],
            "gdp_growth": gdp_map.get(iso2),
            "inflation": inflation_map.get(iso2),
            "commodity_exposure": COMMODITY_EXPOSURE.get(iso2),
        })

    # Sort by GDP growth descending
    overview.sort(key=lambda x: (x.get("gdp_growth") or {}).get("value", -999), reverse=True)

    return {
        "countries": overview,
        "count": len(overview),
        "region_filter": region,
        "source": "world_bank",
    }


def list_indicators(category: str | None = None) -> list[dict]:
    """List available EM indicators."""
    results = []
    for key, ind in EM_INDICATORS.items():
        if category and ind["category"] != category:
            continue
        results.append({"key": key, "name": ind["name"], "category": ind["category"]})
    return results


def list_countries(region: str | None = None) -> list[dict]:
    """List emerging market countries."""
    results = []
    for iso2, meta in EM_COUNTRIES.items():
        if region and region.lower() not in meta["region"].lower():
            continue
        results.append({
            "country": iso2,
            "name": meta["name"],
            "region": meta["region"],
            "income_group": meta["income"],
            "has_commodity_exposure": iso2 in COMMODITY_EXPOSURE,
        })
    return results
