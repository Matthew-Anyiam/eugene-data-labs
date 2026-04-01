"""
Conflict data — UCDP (Uppsala Conflict Data Program) + SIPRI.

- UCDP API: https://ucdp.uu.se/apidocs/ — CC BY 4.0, free
- SIPRI: Public bulk downloads for arms transfers

UCDP provides georeferenced conflict events, state-based violence,
and non-state conflict data. Updates monthly + API access.
"""

import logging
import requests
from eugene.cache import cached

logger = logging.getLogger(__name__)

UCDP_API = "https://ucdpapi.pcr.uu.se/api"
TIMEOUT = 20

# UCDP requires an API token as of 2025. Set UCDP_API_TOKEN env var.
import os
UCDP_TOKEN = os.environ.get("UCDP_API_TOKEN", "")


# ---------------------------------------------------------------------------
# UCDP Georeferenced Events
# ---------------------------------------------------------------------------

@cached(ttl=3600)  # 1h cache
def get_conflict_events(
    country: str | None = None,
    year: int | None = None,
    limit: int = 50,
    page: int = 1,
) -> dict:
    """Get georeferenced conflict events from UCDP GED.

    Args:
        country: Country name filter
        year: Year filter (default: latest available)
        limit: Max results per page
        page: Page number

    Returns:
        Dict with conflict events
    """
    params = {
        "pagesize": min(limit, 100),
        "page": page,
    }

    if country:
        params["Country"] = country
    if year:
        params["Year"] = year

    try:
        headers = {}
        if UCDP_TOKEN:
            headers["x-ucdp-access-token"] = UCDP_TOKEN
        resp = requests.get(f"{UCDP_API}/gedevents/24.0.10", params=params, headers=headers, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        events = []
        for event in data.get("Result", []):
            events.append({
                "id": event.get("id", ""),
                "country": event.get("country", ""),
                "region": event.get("region", ""),
                "conflict_name": event.get("conflict_name", "") or event.get("dyad_name", ""),
                "type_of_violence": event.get("type_of_violence", ""),
                "side_a": event.get("side_a", ""),
                "side_b": event.get("side_b", ""),
                "deaths_a": event.get("deaths_a", 0),
                "deaths_b": event.get("deaths_b", 0),
                "deaths_civilians": event.get("deaths_civilians", 0),
                "deaths_total": event.get("best", 0),
                "lat": event.get("latitude", 0),
                "lng": event.get("longitude", 0),
                "date_start": event.get("date_start", ""),
                "date_end": event.get("date_end", ""),
                "year": event.get("year", ""),
                "source": "ucdp",
            })

        return {
            "events": events,
            "count": len(events),
            "total_available": data.get("TotalCount", 0),
            "page": page,
            "source": "ucdp",
        }

    except Exception as e:
        logger.error("UCDP events API error: %s", e)
        return {"events": [], "count": 0, "error": str(e), "source": "ucdp"}


# ---------------------------------------------------------------------------
# UCDP Armed Conflicts
# ---------------------------------------------------------------------------

@cached(ttl=86400)  # 24h cache — updates less frequently
def get_active_conflicts(
    region: str | None = None,
    year: int | None = None,
    limit: int = 50,
) -> dict:
    """Get active armed conflicts from UCDP.

    Returns organized conflicts (state-based, non-state, one-sided violence).
    """
    params = {
        "pagesize": min(limit, 100),
        "page": 1,
    }

    if year:
        params["Year"] = year

    try:
        headers = {}
        if UCDP_TOKEN:
            headers["x-ucdp-access-token"] = UCDP_TOKEN
        resp = requests.get(f"{UCDP_API}/ucdpprioconflict/24.1", params=params, headers=headers, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        conflicts = []
        for conflict in data.get("Result", []):
            loc = conflict.get("GWNoLoc", "")
            c_region = conflict.get("Region", "")

            if region and region.lower() not in c_region.lower():
                continue

            conflicts.append({
                "id": conflict.get("ConflictId", ""),
                "name": conflict.get("SideA", "") + " vs " + conflict.get("SideB", ""),
                "side_a": conflict.get("SideA", ""),
                "side_b": conflict.get("SideB", ""),
                "territory": conflict.get("TerritoryName", ""),
                "region": c_region,
                "type": conflict.get("TypeOfConflict", ""),
                "intensity_level": conflict.get("IntensityLevel", ""),
                "start_year": conflict.get("StartDate", ""),
                "location": loc,
                "source": "ucdp",
            })

        return {
            "conflicts": conflicts,
            "count": len(conflicts),
            "source": "ucdp",
        }

    except Exception as e:
        logger.error("UCDP conflicts API error: %s", e)
        return {"conflicts": [], "count": 0, "error": str(e), "source": "ucdp"}


# ---------------------------------------------------------------------------
# Escalation scoring
# ---------------------------------------------------------------------------

def get_escalation_score(country: str) -> dict:
    """Calculate conflict escalation score for a country.

    Based on recent event frequency, fatalities trend, and conflict intensity.
    """
    # Get recent events
    events_data = get_conflict_events(country=country, limit=100)
    events = events_data.get("events", [])

    if not events:
        return {
            "country": country,
            "escalation_score": 0.0,
            "risk_level": "low",
            "event_count": 0,
            "total_fatalities": 0,
            "source": "ucdp",
        }

    total_fatalities = sum(e.get("deaths_total", 0) or 0 for e in events)
    civilian_fatalities = sum(e.get("deaths_civilians", 0) or 0 for e in events)
    event_count = len(events)

    # Simple escalation scoring
    event_score = min(1.0, event_count / 50)
    fatality_score = min(1.0, total_fatalities / 500)
    civilian_score = min(1.0, civilian_fatalities / 100)

    escalation = event_score * 0.3 + fatality_score * 0.4 + civilian_score * 0.3
    escalation = round(min(1.0, escalation), 3)

    risk_level = "low"
    if escalation > 0.7:
        risk_level = "critical"
    elif escalation > 0.4:
        risk_level = "high"
    elif escalation > 0.2:
        risk_level = "medium"

    return {
        "country": country,
        "escalation_score": escalation,
        "risk_level": risk_level,
        "event_count": event_count,
        "total_fatalities": total_fatalities,
        "civilian_fatalities": civilian_fatalities,
        "source": "ucdp",
    }


# ---------------------------------------------------------------------------
# Combined conflict + disaster assessment for affected assets
# ---------------------------------------------------------------------------

def get_affected_assets(country: str) -> dict:
    """Get potential market-impacting events for a country.

    Combines conflict data with disaster exposure to assess
    risk to companies operating in or exposed to the region.
    """
    escalation = get_escalation_score(country)
    conflicts = get_active_conflicts()

    # Filter conflicts involving this country
    relevant_conflicts = [
        c for c in conflicts.get("conflicts", [])
        if country.lower() in c.get("name", "").lower()
        or country.lower() in c.get("territory", "").lower()
        or country.lower() in c.get("region", "").lower()
    ]

    return {
        "country": country,
        "escalation": escalation,
        "active_conflicts": relevant_conflicts[:10],
        "conflict_count": len(relevant_conflicts),
        "source": "ucdp",
    }
