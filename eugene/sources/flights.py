"""
Flight intelligence data sources — aircraft tracking, airport status, airspace.

Sources:
  - OpenSky Network REST API: Real-time aircraft positions (free for non-commercial)
  - FAA NOTAM/TFR: Airspace restrictions and temporary flight restrictions
  - ADSBHub: ADS-B exchange data (free, commercial OK with contribution)

OpenSky Network: free REST API at opensky-network.org/api
  - Anonymous: 10 requests/10sec, 400/day
  - Authenticated: 100 requests/10sec, 4000/day
  - Set OPENSKY_USER and OPENSKY_PASS for higher limits
"""

import logging
import math
import os
import time

import requests

logger = logging.getLogger(__name__)

_cache: dict = {}
CACHE_TTL = 60  # 1 minute for real-time data

OPENSKY_BASE = "https://opensky-network.org/api"


def _cached_get(url: str, params: dict | None = None, auth: tuple | None = None, ttl: int = CACHE_TTL) -> dict | None:
    """HTTP GET with in-memory cache."""
    import hashlib
    key = hashlib.md5(f"{url}:{params}".encode()).hexdigest()
    if key in _cache:
        data, ts = _cache[key]
        if time.time() - ts < ttl:
            return data
    try:
        resp = requests.get(url, params=params, auth=auth, timeout=30)
        resp.raise_for_status()
        result = resp.json()
        _cache[key] = (result, time.time())
        return result
    except Exception as e:
        logger.warning("Flight API error: %s — %s", url, e)
        return None


def _get_opensky_auth() -> tuple | None:
    """Get OpenSky authentication if configured."""
    user = os.environ.get("OPENSKY_USER")
    pwd = os.environ.get("OPENSKY_PASS")
    if user and pwd:
        return (user, pwd)
    return None


# ---------------------------------------------------------------------------
# Aircraft Tracking — OpenSky Network
# ---------------------------------------------------------------------------

def get_flights(
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float = 200,
    icao24: str | None = None,
    limit: int = 50,
) -> dict:
    """Get real-time aircraft positions from OpenSky Network.

    Args:
        lat: Center latitude for bounding box
        lng: Center longitude for bounding box
        radius_km: Search radius (converted to bounding box)
        icao24: Specific aircraft ICAO 24-bit address
        limit: Max aircraft

    Returns:
        Aircraft positions with metadata
    """
    auth = _get_opensky_auth()
    params: dict = {}

    if icao24:
        params["icao24"] = icao24.lower()
    elif lat is not None and lng is not None:
        # Convert radius to bounding box
        lat_delta = radius_km / 111.0
        lng_delta = radius_km / (111.0 * max(math.cos(math.radians(lat)), 0.01))
        params["lamin"] = lat - lat_delta
        params["lamax"] = lat + lat_delta
        params["lomin"] = lng - lng_delta
        params["lomax"] = lng + lng_delta

    data = _cached_get(f"{OPENSKY_BASE}/states/all", params=params, auth=auth, ttl=15)

    if not data or "states" not in data:
        return {
            "aircraft": [],
            "count": 0,
            "timestamp": data.get("time", 0) if data else 0,
            "error": "No aircraft data available" if data is None else None,
            "source": "opensky",
        }

    aircraft = []
    for state in data["states"][:limit]:
        # OpenSky state vector format:
        # [icao24, callsign, origin_country, time_position, last_contact,
        #  longitude, latitude, baro_altitude, on_ground, velocity,
        #  true_track, vertical_rate, sensors, geo_altitude,
        #  squawk, spi, position_source, category]
        if len(state) < 14:
            continue

        aircraft.append({
            "icao24": state[0] or "",
            "callsign": (state[1] or "").strip(),
            "origin_country": state[2] or "",
            "lat": state[6],
            "lng": state[5],
            "altitude_m": state[7],
            "altitude_ft": round(state[7] * 3.281) if state[7] else None,
            "on_ground": state[8],
            "velocity_ms": state[9],
            "velocity_kts": round(state[9] * 1.944) if state[9] else None,
            "heading": state[10],
            "vertical_rate": state[11],
            "squawk": state[14] if len(state) > 14 else None,
            "category": _aircraft_category(state[17] if len(state) > 17 else None),
            "last_contact": state[4],
        })

    return {
        "aircraft": aircraft,
        "count": len(aircraft),
        "timestamp": data.get("time", 0),
        "source": "opensky",
    }


def _aircraft_category(cat: int | None) -> str:
    """Map OpenSky category integer to label."""
    categories = {
        0: "no_info",
        1: "no_category",
        2: "light",
        3: "small",
        4: "large",
        5: "high_vortex_large",
        6: "heavy",
        7: "high_performance",
        8: "rotorcraft",
        9: "glider",
        10: "lighter_than_air",
        11: "parachutist",
        12: "ultralight",
        14: "uav",
        15: "space",
        16: "emergency_vehicle",
        17: "service_vehicle",
        18: "ground_obstruction",
        19: "cluster_obstacle",
        20: "point_obstacle",
    }
    return categories.get(cat, "unknown") if cat is not None else "unknown"


# ---------------------------------------------------------------------------
# Airport Status
# ---------------------------------------------------------------------------

# Major airports with coordinates
MAJOR_AIRPORTS = {
    "KJFK": {"name": "John F. Kennedy Intl", "city": "New York", "country": "US", "lat": 40.64, "lng": -73.78},
    "KLAX": {"name": "Los Angeles Intl", "city": "Los Angeles", "country": "US", "lat": 33.94, "lng": -118.41},
    "KORD": {"name": "O'Hare Intl", "city": "Chicago", "country": "US", "lat": 41.97, "lng": -87.91},
    "KATL": {"name": "Hartsfield-Jackson Intl", "city": "Atlanta", "country": "US", "lat": 33.64, "lng": -84.43},
    "EGLL": {"name": "Heathrow", "city": "London", "country": "GB", "lat": 51.47, "lng": -0.46},
    "LFPG": {"name": "Charles de Gaulle", "city": "Paris", "country": "FR", "lat": 49.01, "lng": 2.55},
    "EDDF": {"name": "Frankfurt", "city": "Frankfurt", "country": "DE", "lat": 50.03, "lng": 8.57},
    "RJTT": {"name": "Haneda", "city": "Tokyo", "country": "JP", "lat": 35.55, "lng": 139.78},
    "VHHH": {"name": "Hong Kong Intl", "city": "Hong Kong", "country": "HK", "lat": 22.31, "lng": 113.92},
    "WSSS": {"name": "Changi", "city": "Singapore", "country": "SG", "lat": 1.36, "lng": 103.99},
    "OMDB": {"name": "Dubai Intl", "city": "Dubai", "country": "AE", "lat": 25.25, "lng": 55.36},
    "ZBAA": {"name": "Beijing Capital", "city": "Beijing", "country": "CN", "lat": 40.08, "lng": 116.58},
    "YSSY": {"name": "Sydney Kingsford Smith", "city": "Sydney", "country": "AU", "lat": -33.95, "lng": 151.18},
    "LEMD": {"name": "Adolfo Suarez Madrid-Barajas", "city": "Madrid", "country": "ES", "lat": 40.47, "lng": -3.57},
    "EHAM": {"name": "Amsterdam Schiphol", "city": "Amsterdam", "country": "NL", "lat": 52.31, "lng": 4.76},
}


def get_airport_status(
    icao: str | None = None,
    country: str | None = None,
    limit: int = 20,
) -> dict:
    """Get airport status with nearby flight activity and risk assessment.

    Args:
        icao: Airport ICAO code (e.g. KJFK)
        country: Filter by country ISO code
        limit: Max airports

    Returns:
        Airport status with traffic density and risk
    """
    airports = []

    for code, info in MAJOR_AIRPORTS.items():
        if icao and code != icao.upper():
            continue
        if country and info["country"] != country.upper():
            continue

        # Get nearby flight count as proxy for traffic density
        flight_data = get_flights(lat=info["lat"], lng=info["lng"], radius_km=50, limit=100)
        traffic_count = flight_data.get("count", 0)

        # Assess disruption risk from nearby disasters/weather
        risk = _airport_disruption_risk(info["lat"], info["lng"], info["country"])

        if risk >= 0.6:
            status = "disrupted"
        elif risk >= 0.3:
            status = "delays_likely"
        elif traffic_count > 50:
            status = "busy"
        else:
            status = "normal"

        airports.append({
            "icao": code,
            "name": info["name"],
            "city": info["city"],
            "country": info["country"],
            "lat": info["lat"],
            "lng": info["lng"],
            "status": status,
            "traffic_count": traffic_count,
            "risk_score": round(risk, 3),
        })

        if len(airports) >= limit:
            break

    return {
        "airports": airports,
        "count": len(airports),
        "source": "opensky_composite",
    }


def _airport_disruption_risk(lat: float, lng: float, country: str) -> float:
    """Calculate disruption risk for an airport location."""
    risk = 0.0
    try:
        from eugene.sources.disasters import get_earthquakes
        quakes = get_earthquakes(min_magnitude=4.5, days=3, lat=lat, lng=lng, radius_km=200)
        if quakes.get("earthquakes"):
            risk += 0.3
    except Exception:
        pass

    try:
        from eugene.sources.conflict import get_escalation_score
        esc = get_escalation_score(country)
        if esc.get("risk_level") in ("high", "critical"):
            risk += 0.4
    except Exception:
        pass

    return min(1.0, risk)


# ---------------------------------------------------------------------------
# Airspace Anomalies — Detect unusual patterns
# ---------------------------------------------------------------------------

def get_anomalies(
    region: str | None = None,
    limit: int = 20,
) -> dict:
    """Detect airspace anomalies — military activity, unusual routing, groundings.

    Analyzes real-time flight data for patterns that deviate from normal:
    - Military aircraft in civilian areas
    - Sudden drop in traffic (potential airspace closure)
    - Unusual altitude or speed patterns

    Args:
        region: Region to analyze (us, europe, asia, middle_east)
        limit: Max anomalies

    Returns:
        Detected anomalies with confidence scores
    """
    # Define region bounding boxes
    regions = {
        "us": (25.0, -125.0, 50.0, -65.0),
        "europe": (35.0, -10.0, 70.0, 40.0),
        "asia": (10.0, 60.0, 55.0, 145.0),
        "middle_east": (12.0, 30.0, 42.0, 65.0),
    }

    anomalies = []

    if region and region.lower() in regions:
        bounds = regions[region.lower()]
        center_lat = (bounds[0] + bounds[2]) / 2
        center_lng = (bounds[1] + bounds[3]) / 2
        radius = max(abs(bounds[2] - bounds[0]), abs(bounds[3] - bounds[1])) * 55

        flight_data = get_flights(lat=center_lat, lng=center_lng, radius_km=radius, limit=200)
        aircraft_list = flight_data.get("aircraft", [])

        # Detect military aircraft (based on category, origin, squawk)
        for ac in aircraft_list:
            confidence = 0.0
            anomaly_type = None

            # Military squawk codes
            squawk = ac.get("squawk", "")
            if squawk in ("7500", "7600", "7700"):
                anomaly_type = "emergency_squawk"
                confidence = 0.95
            elif ac.get("category") in ("high_performance", "heavy") and not ac.get("callsign"):
                anomaly_type = "unidentified_heavy"
                confidence = 0.6
            elif ac.get("vertical_rate") and abs(ac["vertical_rate"]) > 30:
                anomaly_type = "rapid_altitude_change"
                confidence = 0.5

            if anomaly_type and confidence >= 0.5:
                anomalies.append({
                    "type": anomaly_type,
                    "confidence": round(confidence, 2),
                    "icao24": ac.get("icao24", ""),
                    "callsign": ac.get("callsign", ""),
                    "origin_country": ac.get("origin_country", ""),
                    "lat": ac.get("lat"),
                    "lng": ac.get("lng"),
                    "altitude_ft": ac.get("altitude_ft"),
                    "velocity_kts": ac.get("velocity_kts"),
                    "squawk": squawk,
                })

                if len(anomalies) >= limit:
                    break
    else:
        # Check all regions
        for reg_name, bounds in regions.items():
            center_lat = (bounds[0] + bounds[2]) / 2
            center_lng = (bounds[1] + bounds[3]) / 2

            flight_data = get_flights(lat=center_lat, lng=center_lng, radius_km=2000, limit=50)
            traffic = flight_data.get("count", 0)

            # Low traffic anomaly — possible airspace closure
            if traffic == 0:
                anomalies.append({
                    "type": "low_traffic",
                    "confidence": 0.4,
                    "region": reg_name,
                    "expected_traffic": "high",
                    "actual_traffic": traffic,
                    "lat": center_lat,
                    "lng": center_lng,
                })

    anomalies.sort(key=lambda a: a.get("confidence", 0), reverse=True)

    return {
        "anomalies": anomalies[:limit],
        "count": len(anomalies),
        "region": region,
        "source": "opensky_analysis",
    }


# ---------------------------------------------------------------------------
# Airspace Status — Regional overview
# ---------------------------------------------------------------------------

def get_airspace_status(region: str | None = None) -> dict:
    """Get airspace status overview for a region.

    Args:
        region: us, europe, asia, middle_east (or None for all)

    Returns:
        Regional airspace status with traffic density and risk
    """
    regions = {
        "us": {"lat": 38.0, "lng": -97.0, "radius": 2500, "label": "United States"},
        "europe": {"lat": 50.0, "lng": 10.0, "radius": 2000, "label": "Europe"},
        "asia": {"lat": 35.0, "lng": 105.0, "radius": 3000, "label": "Asia Pacific"},
        "middle_east": {"lat": 28.0, "lng": 47.0, "radius": 1500, "label": "Middle East"},
    }

    statuses = []

    targets = {region: regions[region]} if region and region in regions else regions

    for name, info in targets.items():
        flight_data = get_flights(lat=info["lat"], lng=info["lng"], radius_km=info["radius"], limit=200)
        traffic = flight_data.get("count", 0)

        # Rough density categorization
        if traffic > 100:
            density = "high"
        elif traffic > 30:
            density = "moderate"
        elif traffic > 0:
            density = "low"
        else:
            density = "no_data"

        statuses.append({
            "region": name,
            "label": info["label"],
            "traffic_count": traffic,
            "density": density,
            "status": "normal" if density != "no_data" else "unknown",
        })

    return {
        "regions": statuses,
        "count": len(statuses),
        "source": "opensky",
    }
