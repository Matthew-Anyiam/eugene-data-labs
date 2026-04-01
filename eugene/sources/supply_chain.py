"""
Supply chain data sources — trade flows, port status, vessel tracking.

Sources:
  - UN Comtrade: International trade flow data (free, public domain)
  - AIS via aisstream.io: Real-time vessel positions (free API key)
  - Route risk: Composite scoring from conflict + disaster data

All sources are freely redistributable for commercial use.
"""

import logging
import os
import time
from datetime import datetime

import requests

logger = logging.getLogger(__name__)

_cache: dict = {}
CACHE_TTL = 3600  # 1 hour


def _cached_get(url: str, params: dict | None = None, headers: dict | None = None, ttl: int = CACHE_TTL) -> dict | list | None:
    """HTTP GET with in-memory cache."""
    import hashlib
    key = hashlib.md5(f"{url}:{params}".encode()).hexdigest()
    if key in _cache:
        data, ts = _cache[key]
        if time.time() - ts < ttl:
            return data
    try:
        resp = requests.get(url, params=params, headers=headers, timeout=30)
        resp.raise_for_status()
        result = resp.json()
        _cache[key] = (result, time.time())
        return result
    except Exception as e:
        logger.warning("Supply chain API error: %s — %s", url, e)
        return None


# ---------------------------------------------------------------------------
# UN Comtrade — International Trade Flows
# ---------------------------------------------------------------------------

COMTRADE_BASE = "https://comtradeapi.un.org/public/v1/preview"

# Top traded commodities (HS2 codes)
COMMODITY_CODES = {
    "27": "Mineral fuels, oils",
    "84": "Machinery",
    "85": "Electrical machinery",
    "87": "Vehicles",
    "71": "Precious metals",
    "30": "Pharmaceuticals",
    "72": "Iron and steel",
    "39": "Plastics",
    "90": "Optical/medical instruments",
    "29": "Organic chemicals",
}

# ISO country codes for major trading partners
MAJOR_ECONOMIES = {
    "US": "842", "CN": "156", "DE": "276", "JP": "392", "GB": "826",
    "FR": "250", "KR": "410", "IN": "356", "IT": "380", "CA": "124",
    "MX": "484", "BR": "076", "AU": "036", "NL": "528", "SG": "702",
}


def get_trade_flows(
    reporter: str = "US",
    partner: str | None = None,
    commodity: str | None = None,
    year: int | None = None,
    flow: str = "X",
    limit: int = 50,
) -> dict:
    """Get international trade flow data from UN Comtrade.

    Args:
        reporter: Reporter country ISO code (US, CN, DE, etc.)
        partner: Partner country ISO code (optional)
        commodity: HS2 commodity code (optional, e.g. '27' for fuels)
        year: Trade year (default: most recent available)
        flow: X=exports, M=imports
        limit: Max records

    Returns:
        Trade flow records with values, quantities, and partner details
    """
    reporter_code = MAJOR_ECONOMIES.get(reporter.upper(), reporter)

    params: dict = {
        "reporterCode": reporter_code,
        "flowCode": flow,
        "maxRecords": min(limit, 250),
        "typeCode": "C",
        "freqCode": "A",
    }

    if partner:
        partner_code = MAJOR_ECONOMIES.get(partner.upper(), partner)
        params["partnerCode"] = partner_code

    if commodity:
        params["cmdCode"] = commodity

    if year:
        params["period"] = str(year)
    else:
        params["period"] = str(datetime.utcnow().year - 1)

    data = _cached_get(f"{COMTRADE_BASE}/getTarifflineData", params=params, ttl=86400)

    if not data or not isinstance(data, dict):
        # Fallback: use preview endpoint
        data = _cached_get(f"{COMTRADE_BASE}/getTarifflineData", params=params, ttl=86400)

    records = []
    raw_data = data.get("data", []) if isinstance(data, dict) else data if isinstance(data, list) else []

    for rec in raw_data[:limit]:
        if not isinstance(rec, dict):
            continue
        records.append({
            "reporter": rec.get("reporterDesc", reporter),
            "partner": rec.get("partnerDesc", partner or "World"),
            "commodity_code": rec.get("cmdCode", ""),
            "commodity": rec.get("cmdDesc", COMMODITY_CODES.get(str(rec.get("cmdCode", "")), "")),
            "flow": "Export" if flow == "X" else "Import",
            "value_usd": rec.get("primaryValue", 0),
            "quantity": rec.get("qty", 0),
            "unit": rec.get("qtyUnitAbbr", ""),
            "year": rec.get("period", year),
        })

    return {
        "reporter": reporter,
        "partner": partner or "World",
        "flow": flow,
        "year": year or datetime.utcnow().year - 1,
        "records": records,
        "count": len(records),
        "source": "un_comtrade",
    }


# ---------------------------------------------------------------------------
# Port Status — Major Global Ports
# ---------------------------------------------------------------------------

# Major port data with baseline metrics
MAJOR_PORTS = {
    "USLAX": {"name": "Los Angeles", "country": "US", "lat": 33.74, "lng": -118.27, "type": "container"},
    "USLGB": {"name": "Long Beach", "country": "US", "lat": 33.76, "lng": -118.19, "type": "container"},
    "USNYC": {"name": "New York/New Jersey", "country": "US", "lat": 40.67, "lng": -74.05, "type": "container"},
    "USSAV": {"name": "Savannah", "country": "US", "lat": 32.08, "lng": -81.09, "type": "container"},
    "CNSHA": {"name": "Shanghai", "country": "CN", "lat": 31.35, "lng": 121.61, "type": "container"},
    "CNSZX": {"name": "Shenzhen", "country": "CN", "lat": 22.53, "lng": 114.05, "type": "container"},
    "CNNGB": {"name": "Ningbo", "country": "CN", "lat": 29.87, "lng": 121.54, "type": "container"},
    "SGSIN": {"name": "Singapore", "country": "SG", "lat": 1.26, "lng": 103.84, "type": "container"},
    "NLRTM": {"name": "Rotterdam", "country": "NL", "lat": 51.95, "lng": 4.14, "type": "container"},
    "DEHAM": {"name": "Hamburg", "country": "DE", "lat": 53.53, "lng": 9.97, "type": "container"},
    "KRPUS": {"name": "Busan", "country": "KR", "lat": 35.10, "lng": 129.03, "type": "container"},
    "AEJEA": {"name": "Jebel Ali", "country": "AE", "lat": 25.01, "lng": 55.06, "type": "container"},
    "JPYOK": {"name": "Yokohama", "country": "JP", "lat": 35.44, "lng": 139.65, "type": "container"},
    "GBFXT": {"name": "Felixstowe", "country": "GB", "lat": 51.96, "lng": 1.33, "type": "container"},
    "THLCH": {"name": "Laem Chabang", "country": "TH", "lat": 13.08, "lng": 100.88, "type": "container"},
}


def get_port_status(
    port_code: str | None = None,
    country: str | None = None,
    limit: int = 20,
) -> dict:
    """Get port status with congestion and disruption risk assessment.

    Combines port baseline data with real-time disaster/conflict overlays
    to assess congestion risk.

    Args:
        port_code: UNLOCODE (e.g. USLAX, CNSHA)
        country: Filter by country ISO code
        limit: Max ports

    Returns:
        Port status list with congestion risk scores
    """
    ports = []

    for code, info in MAJOR_PORTS.items():
        if port_code and code != port_code.upper():
            continue
        if country and info["country"] != country.upper():
            continue

        # Calculate disruption risk from nearby disasters/conflicts
        risk_score = _calculate_port_risk(info["lat"], info["lng"], info["country"])

        if risk_score >= 0.7:
            status = "disrupted"
        elif risk_score >= 0.4:
            status = "congested"
        else:
            status = "operational"

        ports.append({
            "port_code": code,
            "name": info["name"],
            "country": info["country"],
            "lat": info["lat"],
            "lng": info["lng"],
            "type": info["type"],
            "status": status,
            "risk_score": round(risk_score, 3),
            "risk_factors": _get_risk_factors(info["lat"], info["lng"], info["country"]),
        })

        if len(ports) >= limit:
            break

    ports.sort(key=lambda p: p["risk_score"], reverse=True)

    return {
        "ports": ports,
        "count": len(ports),
        "operational": sum(1 for p in ports if p["status"] == "operational"),
        "congested": sum(1 for p in ports if p["status"] == "congested"),
        "disrupted": sum(1 for p in ports if p["status"] == "disrupted"),
        "source": "eugene_composite",
    }


def _calculate_port_risk(lat: float, lng: float, country: str) -> float:
    """Calculate disruption risk for a port location using disaster + conflict data."""
    risk = 0.0

    # Check nearby disasters
    try:
        from eugene.sources.disasters import get_earthquakes
        quakes = get_earthquakes(min_magnitude=5.0, days=7, lat=lat, lng=lng, radius_km=500)
        earthquake_list = quakes.get("earthquakes", [])
        if earthquake_list:
            max_mag = max(q.get("magnitude", 0) for q in earthquake_list)
            risk += min(0.5, (max_mag - 4.5) / 5.0)
    except Exception:
        pass

    # Check country conflict level
    try:
        from eugene.sources.conflict import get_escalation_score
        escalation = get_escalation_score(country)
        esc_score = escalation.get("escalation_score", 0)
        risk += min(0.3, esc_score * 0.3)
    except Exception:
        pass

    return min(1.0, risk)


def _get_risk_factors(lat: float, lng: float, country: str) -> list[str]:
    """Get human-readable risk factors for a location."""
    factors = []

    try:
        from eugene.sources.disasters import get_earthquakes
        quakes = get_earthquakes(min_magnitude=5.0, days=7, lat=lat, lng=lng, radius_km=500)
        if quakes.get("earthquakes"):
            factors.append(f"Seismic activity ({len(quakes['earthquakes'])} recent earthquakes)")
    except Exception:
        pass

    try:
        from eugene.sources.conflict import get_escalation_score
        escalation = get_escalation_score(country)
        if escalation.get("risk_level") in ("high", "critical"):
            factors.append(f"Conflict zone ({escalation.get('risk_level')} risk)")
    except Exception:
        pass

    return factors


# ---------------------------------------------------------------------------
# Route Risk — Shipping Lane Assessment
# ---------------------------------------------------------------------------

# Major shipping chokepoints
CHOKEPOINTS = [
    {"name": "Strait of Malacca", "lat": 2.5, "lng": 101.5, "radius_km": 200, "trade_pct": 25},
    {"name": "Suez Canal", "lat": 30.0, "lng": 32.5, "radius_km": 100, "trade_pct": 12},
    {"name": "Strait of Hormuz", "lat": 26.5, "lng": 56.5, "radius_km": 150, "trade_pct": 21},
    {"name": "Panama Canal", "lat": 9.0, "lng": -79.5, "radius_km": 100, "trade_pct": 5},
    {"name": "Bab el-Mandeb", "lat": 12.5, "lng": 43.5, "radius_km": 100, "trade_pct": 9},
    {"name": "Turkish Straits", "lat": 41.0, "lng": 29.0, "radius_km": 100, "trade_pct": 3},
    {"name": "Cape of Good Hope", "lat": -34.4, "lng": 18.5, "radius_km": 300, "trade_pct": 8},
    {"name": "English Channel", "lat": 50.5, "lng": 1.0, "radius_km": 150, "trade_pct": 4},
]


def get_route_risk(
    origin: str | None = None,
    destination: str | None = None,
    limit: int = 10,
) -> dict:
    """Assess shipping route risk across major chokepoints.

    Returns risk scores for each chokepoint based on nearby conflict,
    disaster activity, and strategic importance.

    Args:
        origin: Origin port code or country
        destination: Destination port code or country
        limit: Max chokepoints

    Returns:
        Route risk assessment with chokepoint analysis
    """
    chokepoint_risks = []

    for cp in CHOKEPOINTS[:limit]:
        risk = _calculate_port_risk(cp["lat"], cp["lng"], "")
        factors = _get_risk_factors(cp["lat"], cp["lng"], "")

        if risk >= 0.6:
            status = "high_risk"
        elif risk >= 0.3:
            status = "elevated"
        else:
            status = "normal"

        chokepoint_risks.append({
            "name": cp["name"],
            "lat": cp["lat"],
            "lng": cp["lng"],
            "trade_share_pct": cp["trade_pct"],
            "risk_score": round(risk, 3),
            "status": status,
            "risk_factors": factors,
        })

    chokepoint_risks.sort(key=lambda c: c["risk_score"], reverse=True)

    # Overall route risk
    avg_risk = sum(c["risk_score"] for c in chokepoint_risks) / len(chokepoint_risks) if chokepoint_risks else 0
    high_risk_count = sum(1 for c in chokepoint_risks if c["status"] == "high_risk")

    return {
        "chokepoints": chokepoint_risks,
        "count": len(chokepoint_risks),
        "avg_risk": round(avg_risk, 3),
        "high_risk_count": high_risk_count,
        "origin": origin,
        "destination": destination,
        "source": "eugene_composite",
    }


# ---------------------------------------------------------------------------
# Vessel Tracking (aisstream.io — requires API key)
# ---------------------------------------------------------------------------

AISSTREAM_BASE = "https://api.aisstream.io/v0"


def get_vessels(
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float = 100,
    mmsi: str | None = None,
    limit: int = 50,
) -> dict:
    """Get vessel positions from AIS data.

    Requires AISSTREAM_API_KEY environment variable.

    Args:
        lat: Center latitude for area search
        lng: Center longitude for area search
        radius_km: Search radius in km
        mmsi: Specific vessel MMSI number
        limit: Max vessels

    Returns:
        Vessel positions with metadata
    """
    api_key = os.environ.get("AISSTREAM_API_KEY")
    if not api_key:
        return {
            "vessels": [],
            "count": 0,
            "error": "AISSTREAM_API_KEY not configured. Get a free key at aisstream.io",
            "source": "aisstream",
        }

    # AIS stream uses websocket primarily; REST endpoint for latest positions
    headers = {"Authorization": f"Bearer {api_key}"}

    if mmsi:
        data = _cached_get(
            f"{AISSTREAM_BASE}/vessel/{mmsi}",
            headers=headers,
            ttl=300,
        )
        vessels = [data] if data else []
    elif lat is not None and lng is not None:
        params = {
            "lat": lat,
            "lon": lng,
            "radius": radius_km,
            "limit": limit,
        }
        data = _cached_get(
            f"{AISSTREAM_BASE}/vessels",
            params=params,
            headers=headers,
            ttl=300,
        )
        vessels = data if isinstance(data, list) else data.get("vessels", []) if isinstance(data, dict) else []
    else:
        return {
            "vessels": [],
            "count": 0,
            "error": "Provide lat/lng for area search or mmsi for specific vessel",
            "source": "aisstream",
        }

    results = []
    for v in vessels[:limit]:
        if not isinstance(v, dict):
            continue
        results.append({
            "mmsi": v.get("mmsi", ""),
            "name": v.get("name", v.get("shipName", "")),
            "type": v.get("shipType", v.get("type", "")),
            "flag": v.get("flag", v.get("country", "")),
            "lat": v.get("lat", v.get("latitude", 0)),
            "lng": v.get("lon", v.get("longitude", 0)),
            "speed": v.get("speed", v.get("sog", 0)),
            "heading": v.get("heading", v.get("cog", 0)),
            "destination": v.get("destination", ""),
            "eta": v.get("eta", ""),
            "last_update": v.get("timestamp", v.get("lastUpdate", "")),
        })

    return {
        "vessels": results,
        "count": len(results),
        "source": "aisstream",
    }
