"""
Disaster data sources — USGS Earthquakes, GDACS Multi-Hazard, NASA FIRMS Fire.

All sources are free, US Gov/UN public domain, real-time.
- USGS: https://earthquake.usgs.gov/fdsnws/event/1/
- GDACS: https://www.gdacs.org/gdacsapi/
- NASA FIRMS: https://firms.modaps.eosdis.nasa.gov/
"""

import logging
import os
import requests
from datetime import datetime, timedelta, timezone
from eugene.cache import cached

logger = logging.getLogger(__name__)

USGS_API = "https://earthquake.usgs.gov/fdsnws/event/1/query"
GDACS_API = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH"
NASA_FIRMS_API = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

# NASA FIRMS uses a separate MAP_KEY (register at https://firms.modaps.eosdis.nasa.gov/api/map_key/)
# The general NASA_API_KEY (api.nasa.gov) does NOT work with FIRMS.
NASA_FIRMS_MAP_KEY = os.environ.get("NASA_FIRMS_MAP_KEY", "")

TIMEOUT = 20


# ---------------------------------------------------------------------------
# Severity classification (inspired by tiered alerting patterns)
# ---------------------------------------------------------------------------

def _classify_quake_severity(mag: float, felt: int | None, tsunami: int, alert: str | None) -> dict:
    """Classify earthquake severity into actionable tiers.

    Returns tier (critical/high/moderate/low), whether it's notable,
    and extracted signals for convergence engine.
    """
    signals = []

    if tsunami:
        signals.append("tsunami_warning")
    if felt and felt > 100:
        signals.append("widely_felt")
    elif felt and felt > 10:
        signals.append("felt_reports")
    if alert in ("red", "orange"):
        signals.append(f"usgs_alert_{alert}")

    if mag >= 7.0 or alert == "red" or tsunami:
        tier = "critical"
    elif mag >= 6.0 or alert == "orange":
        tier = "high"
    elif mag >= 5.0 or (felt and felt > 50):
        tier = "moderate"
    else:
        tier = "low"

    return {"tier": tier, "signals": signals}


# ---------------------------------------------------------------------------
# USGS Earthquakes
# ---------------------------------------------------------------------------

@cached(ttl=300)  # 5 min cache
def get_earthquakes(
    min_magnitude: float = 4.0,
    days: int = 7,
    limit: int = 50,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float | None = None,
) -> dict:
    """Get recent earthquakes from USGS.

    Args:
        min_magnitude: Minimum magnitude (0-10)
        days: Days to look back
        limit: Max results
        lat/lng/radius_km: Optional geographic filter

    Returns:
        Dict with earthquakes list
    """
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    # Use ISO format with time component so we don't exclude today's events.
    # USGS treats date-only endtime as midnight, cutting off the current day.
    end = now + timedelta(hours=1)  # small buffer to catch very recent events

    params = {
        "format": "geojson",
        "starttime": start.strftime("%Y-%m-%dT%H:%M:%S"),
        "endtime": end.strftime("%Y-%m-%dT%H:%M:%S"),
        "minmagnitude": min_magnitude,
        "limit": min(limit, 200),
        "orderby": "time",
    }

    if lat is not None and lng is not None and radius_km is not None:
        params["latitude"] = lat
        params["longitude"] = lng
        params["maxradiuskm"] = radius_km

    try:
        resp = requests.get(USGS_API, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        quakes = []
        for feature in data.get("features", []):
            props = feature.get("properties", {})
            coords = feature.get("geometry", {}).get("coordinates", [0, 0, 0])
            mag = props.get("mag") or 0
            felt = props.get("felt")
            tsunami_flag = props.get("tsunami", 0)
            alert_level = props.get("alert")

            severity = _classify_quake_severity(mag, felt, tsunami_flag, alert_level)

            quakes.append({
                "id": feature.get("id", ""),
                "magnitude": mag,
                "place": props.get("place", ""),
                "time": props.get("time"),
                "timestamp": datetime.fromtimestamp(props["time"] / 1000, tz=timezone.utc).isoformat() if props.get("time") else None,
                "lat": coords[1] if len(coords) > 1 else 0,
                "lng": coords[0] if len(coords) > 0 else 0,
                "depth_km": coords[2] if len(coords) > 2 else 0,
                "alert": alert_level,  # green, yellow, orange, red
                "tsunami": tsunami_flag,
                "felt": felt,
                "significance": props.get("sig"),
                "severity_tier": severity["tier"],
                "signals": severity["signals"],
                "url": props.get("url", ""),
                "type": "earthquake",
                "source": "usgs",
            })

        # Extract top-level signals for convergence
        top_signals = []
        critical_count = sum(1 for q in quakes if q["severity_tier"] == "critical")
        high_count = sum(1 for q in quakes if q["severity_tier"] == "high")
        if critical_count:
            top_signals.append(f"{critical_count}_critical_earthquakes")
        if high_count:
            top_signals.append(f"{high_count}_significant_earthquakes")
        if any(q["tsunami"] for q in quakes):
            top_signals.append("tsunami_warning_active")

        return {
            "earthquakes": quakes,
            "count": len(quakes),
            "signals": top_signals,
            "metadata": {
                "min_magnitude": min_magnitude,
                "days": days,
                "total_available": data.get("metadata", {}).get("count", 0),
                "severity_breakdown": {
                    "critical": critical_count,
                    "high": high_count,
                    "moderate": sum(1 for q in quakes if q["severity_tier"] == "moderate"),
                    "low": sum(1 for q in quakes if q["severity_tier"] == "low"),
                },
            },
            "source": "usgs",
        }

    except Exception as e:
        logger.error("USGS API error: %s", e)
        return {"earthquakes": [], "count": 0, "error": str(e), "source": "usgs"}


# ---------------------------------------------------------------------------
# GDACS — Global Disaster Alerting Coordination System
# ---------------------------------------------------------------------------

@cached(ttl=600)  # 10 min cache
def get_gdacs_events(
    event_type: str | None = None,
    alert_level: str | None = None,
    days: int = 30,
    limit: int = 50,
) -> dict:
    """Get active disasters from GDACS.

    Args:
        event_type: EQ (earthquake), TC (tropical cyclone), FL (flood), VO (volcano), WF (wildfire), DR (drought)
        alert_level: Green, Orange, Red
        days: Days to look back
        limit: Max results

    Returns:
        Dict with disaster events
    """
    end = datetime.utcnow()
    start = end - timedelta(days=days)

    params = {
        "fromDate": start.strftime("%Y-%m-%d"),
        "toDate": end.strftime("%Y-%m-%d"),
        "alertlevel": alert_level or "",
        "eventtype": event_type or "",
    }

    try:
        resp = requests.get(GDACS_API, params=params, timeout=TIMEOUT,
                          headers={"Accept": "application/json"})
        resp.raise_for_status()
        data = resp.json()

        events = []
        for feature in data.get("features", [])[:limit]:
            props = feature.get("properties", {})
            coords = feature.get("geometry", {}).get("coordinates", [0, 0])

            # Map GDACS event types
            etype = props.get("eventtype", "")
            type_labels = {
                "EQ": "earthquake", "TC": "tropical_cyclone", "FL": "flood",
                "VO": "volcano", "WF": "wildfire", "DR": "drought", "TS": "tsunami",
            }

            events.append({
                "id": props.get("eventid", ""),
                "name": props.get("eventname", "") or props.get("name", ""),
                "type": type_labels.get(etype, etype),
                "alert_level": props.get("alertlevel", ""),
                "severity": props.get("severity", {}).get("severity_value") if isinstance(props.get("severity"), dict) else props.get("severitydata", {}).get("severity", ""),
                "country": props.get("country", ""),
                "lat": coords[1] if len(coords) > 1 else (coords[0] if isinstance(coords[0], (int, float)) and len(coords) == 2 else 0),
                "lng": coords[0] if len(coords) > 0 else 0,
                "date": props.get("fromdate", ""),
                "description": props.get("description", "")[:300] if props.get("description") else "",
                "affected_population": props.get("population", {}).get("value") if isinstance(props.get("population"), dict) else None,
                "url": props.get("url", {}).get("report") if isinstance(props.get("url"), dict) else props.get("link", ""),
                "source": "gdacs",
            })

        return {
            "events": events,
            "count": len(events),
            "source": "gdacs",
        }

    except Exception as e:
        logger.error("GDACS API error: %s", e)
        return {"events": [], "count": 0, "error": str(e), "source": "gdacs"}


# ---------------------------------------------------------------------------
# NASA FIRMS — Fire Information for Resource Management System
# ---------------------------------------------------------------------------

@cached(ttl=3600)  # 1h cache — FIRMS updates ~3h
def get_fire_hotspots(
    country: str | None = None,
    days: int = 1,
    limit: int = 100,
) -> dict:
    """Get active fire hotspots from NASA FIRMS.

    Uses NASA_API_KEY env var for authenticated access (higher quality VIIRS data).
    Falls back to open CSV feed when no key is configured.
    """
    api_key = NASA_FIRMS_MAP_KEY or "OPEN_KEY"
    has_key = bool(NASA_FIRMS_MAP_KEY)

    if country:
        # Authenticated endpoint with real API key gives full VIIRS_SNPP_NRT data
        url = f"https://firms.modaps.eosdis.nasa.gov/api/country/csv/{api_key}/VIIRS_SNPP_NRT/{country}/{days}"
    elif has_key:
        # With API key: use area endpoint for global data (better quality)
        url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{api_key}/VIIRS_SNPP_NRT/world/{days}"
    else:
        # No key: open global summary
        url = "https://firms.modaps.eosdis.nasa.gov/active_fire/c6/text/MODIS_C6_Global_24h.csv"

    try:
        resp = requests.get(url, timeout=TIMEOUT)
        if resp.status_code != 200:
            logger.warning("FIRMS API returned %d, falling back", resp.status_code)
            return _get_fire_summary()

        lines = resp.text.strip().split("\n")
        if len(lines) < 2:
            return _get_fire_summary()

        headers = lines[0].split(",")
        fires = []

        for line in lines[1:limit + 1]:
            parts = line.split(",")
            if len(parts) < len(headers):
                continue

            row = dict(zip(headers, parts))
            fires.append({
                "lat": float(row.get("latitude", 0)),
                "lng": float(row.get("longitude", 0)),
                "brightness": float(row.get("brightness", 0) or row.get("bright_ti4", 0)),
                "confidence": row.get("confidence", ""),
                "frp": float(row.get("frp", 0) or 0),
                "date": row.get("acq_date", ""),
                "time": row.get("acq_time", ""),
                "satellite": row.get("satellite", ""),
                "daynight": row.get("daynight", ""),
                "type": "fire",
                "source": "nasa_firms",
            })

        return {
            "fires": fires,
            "count": len(fires),
            "authenticated": has_key,
            "source": "nasa_firms",
        }

    except Exception as e:
        logger.error("NASA FIRMS error: %s", e)
        return _get_fire_summary()


def _get_fire_summary() -> dict:
    """Fallback fire data from FIRMS open summary."""
    return {
        "fires": [],
        "count": 0,
        "note": "Set NASA_API_KEY env var for detailed VIIRS fire data.",
        "source": "nasa_firms",
    }


# ---------------------------------------------------------------------------
# Combined disaster feed
# ---------------------------------------------------------------------------

def get_active_disasters(
    days: int = 7,
    min_magnitude: float = 4.0,
    include_fires: bool = False,
) -> dict:
    """Get all active disasters across all sources.

    Combines USGS earthquakes, GDACS events, and optionally NASA FIRMS fires
    into a single unified feed.
    """
    results = {
        "disasters": [],
        "count": 0,
        "signals": [],
        "sources": [],
    }

    try:
        from eugene.world.health import get_tracker
        _health = get_tracker()
    except Exception:
        _health = None

    # USGS Earthquakes
    _t0 = __import__('time').time()
    try:
        quakes = get_earthquakes(min_magnitude=min_magnitude, days=days, limit=50)
        for q in quakes.get("earthquakes", []):
            results["disasters"].append({
                "id": q["id"],
                "type": "earthquake",
                "name": f"M{q['magnitude']} - {q['place']}",
                "severity": q["magnitude"],
                "severity_tier": q.get("severity_tier", "low"),
                "alert_level": q.get("alert") or ("red" if q["magnitude"] >= 7 else "orange" if q["magnitude"] >= 6 else "yellow" if q["magnitude"] >= 5 else "green"),
                "lat": q["lat"],
                "lng": q["lng"],
                "date": q["timestamp"],
                "details": {
                    "magnitude": q["magnitude"],
                    "depth_km": q["depth_km"],
                    "tsunami": q["tsunami"],
                    "felt": q["felt"],
                    "significance": q.get("significance"),
                },
                "signals": q.get("signals", []),
                "url": q.get("url", ""),
                "source": "usgs",
            })
        # Propagate earthquake signals
        results["signals"] = quakes.get("signals", [])
        results["sources"].append("usgs")
        if _health:
            _health.record_success("usgs", "disasters", (__import__('time').time() - _t0) * 1000)
    except Exception as e:
        logger.error("Earthquake fetch error: %s", e)
        if _health:
            _health.record_error("usgs", "disasters", str(e))

    # GDACS Events
    _t0 = __import__('time').time()
    try:
        gdacs = get_gdacs_events(days=days, limit=30)
        for event in gdacs.get("events", []):
            results["disasters"].append({
                "id": str(event["id"]),
                "type": event["type"],
                "name": event["name"],
                "severity": event.get("severity"),
                "alert_level": event.get("alert_level", "").lower(),
                "lat": event["lat"],
                "lng": event["lng"],
                "date": event["date"],
                "details": {
                    "country": event.get("country"),
                    "affected_population": event.get("affected_population"),
                    "description": event.get("description"),
                },
                "url": event.get("url", ""),
                "source": "gdacs",
            })
        results["sources"].append("gdacs")
        if _health:
            _health.record_success("gdacs", "disasters", (__import__('time').time() - _t0) * 1000)
    except Exception as e:
        logger.error("GDACS fetch error: %s", e)
        if _health:
            _health.record_error("gdacs", "disasters", str(e))

    # NASA FIRMS fires (optional, can be noisy)
    if include_fires:
        try:
            fires = get_fire_hotspots(days=1, limit=50)
            for f in fires.get("fires", []):
                results["disasters"].append({
                    "id": f"fire_{f['lat']}_{f['lng']}",
                    "type": "wildfire",
                    "name": f"Active fire at {f['lat']:.2f}, {f['lng']:.2f}",
                    "severity": f.get("brightness", 0),
                    "alert_level": "orange" if f.get("confidence", "").lower() in ("high", "h") else "green",
                    "lat": f["lat"],
                    "lng": f["lng"],
                    "date": f.get("date", ""),
                    "source": "nasa_firms",
                })
            results["sources"].append("nasa_firms")
        except Exception as e:
            logger.error("FIRMS fetch error: %s", e)

    # Sort by date (most recent first)
    results["disasters"].sort(key=lambda x: x.get("date", "") or "", reverse=True)
    results["count"] = len(results["disasters"])

    return results


def get_climate_risk(lat: float, lng: float, radius_km: float = 500) -> dict:
    """Assess climate/disaster risk for a location based on historical data.

    Checks recent earthquake activity and active disasters near coordinates.
    """
    quakes = get_earthquakes(min_magnitude=3.0, days=365, limit=100, lat=lat, lng=lng, radius_km=radius_km)
    gdacs = get_gdacs_events(days=90, limit=50)

    # Count nearby GDACS events
    nearby_events = []
    for event in gdacs.get("events", []):
        elat = event.get("lat", 0)
        elng = event.get("lng", 0)
        # Simple distance approximation
        dist = ((elat - lat) ** 2 + (elng - lng) ** 2) ** 0.5 * 111  # ~km
        if dist <= radius_km:
            nearby_events.append(event)

    quake_count = quakes.get("count", 0)
    max_mag = max((q.get("magnitude", 0) or 0 for q in quakes.get("earthquakes", [])), default=0)

    # Simple risk scoring
    risk_score = min(1.0,
        (quake_count / 50) * 0.3 +
        (max_mag / 9.0) * 0.3 +
        (len(nearby_events) / 10) * 0.4
    )

    risk_level = "low"
    if risk_score > 0.7:
        risk_level = "high"
    elif risk_score > 0.4:
        risk_level = "medium"

    return {
        "location": {"lat": lat, "lng": lng, "radius_km": radius_km},
        "risk_score": round(risk_score, 3),
        "risk_level": risk_level,
        "earthquake_activity": {
            "count_last_year": quake_count,
            "max_magnitude": max_mag,
        },
        "nearby_disasters": len(nearby_events),
        "source": "usgs+gdacs",
    }
