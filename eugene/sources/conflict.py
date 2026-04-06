"""
Conflict data -- curated active conflicts + ACLED event data.

Primary: Curated list of major active conflicts (updated early 2026).
Secondary: ACLED API (https://acleddata.com) for granular event data.
  - Requires ACLED_API_KEY and ACLED_EMAIL environment variables.
  - Free tier available.
"""

import logging
import os
from datetime import datetime, timedelta

import requests

from eugene.cache import cached

logger = logging.getLogger(__name__)

ACLED_BASE = "https://api.acleddata.com/acled/read"
ACLED_API_KEY = os.environ.get("ACLED_API_KEY", "")
ACLED_EMAIL = os.environ.get("ACLED_EMAIL", "")
TIMEOUT = 20

# ---------------------------------------------------------------------------
# Curated active conflicts (as of early 2026)
# ---------------------------------------------------------------------------

ACTIVE_CONFLICTS: list[dict] = [
    {
        "id": "russia-ukraine",
        "name": "Russia - Ukraine War",
        "side_a": "Russia",
        "side_b": "Ukraine",
        "territory": "Ukraine",
        "region": "Europe",
        "type": "state-based",
        "intensity_level": 2,
        "start_year": 2022,
        "lat": 48.38,
        "lng": 35.04,
        "affected_commodities": ["wheat", "natural_gas", "crude_oil", "sunflower_oil", "fertilizer", "neon", "palladium"],
        "risk_score": 0.95,
        "source": "curated",
        "description": "Full-scale Russian invasion of Ukraine. Major impact on global grain and energy markets.",
    },
    {
        "id": "israel-palestine",
        "name": "Israel - Palestine / Hamas Conflict",
        "side_a": "Israel",
        "side_b": "Hamas / Palestinian militant groups",
        "territory": "Gaza, West Bank",
        "region": "Middle East",
        "type": "state-based",
        "intensity_level": 2,
        "start_year": 2023,
        "lat": 31.35,
        "lng": 34.31,
        "affected_commodities": ["crude_oil", "natural_gas", "shipping"],
        "risk_score": 0.92,
        "source": "curated",
        "description": "Escalated after October 7, 2023 Hamas attack. Major humanitarian crisis in Gaza.",
    },
    {
        "id": "israel-iran-hezbollah",
        "name": "Israel - Iran / Hezbollah Conflict",
        "side_a": "Israel",
        "side_b": "Iran / Hezbollah",
        "territory": "Lebanon, Iran, Israel",
        "region": "Middle East",
        "type": "state-based",
        "intensity_level": 2,
        "start_year": 2024,
        "lat": 33.89,
        "lng": 35.50,
        "affected_commodities": ["crude_oil", "natural_gas", "shipping", "petrochemicals"],
        "risk_score": 0.90,
        "source": "curated",
        "description": "Escalated regional conflict involving direct strikes between Israel and Iran. Hezbollah front in Lebanon.",
    },
    {
        "id": "sudan-civil-war",
        "name": "Sudan Civil War",
        "side_a": "Sudanese Armed Forces (SAF)",
        "side_b": "Rapid Support Forces (RSF)",
        "territory": "Sudan",
        "region": "Africa",
        "type": "state-based",
        "intensity_level": 2,
        "start_year": 2023,
        "lat": 15.50,
        "lng": 32.56,
        "affected_commodities": ["gold", "gum_arabic", "livestock", "sesame"],
        "risk_score": 0.88,
        "source": "curated",
        "description": "Civil war between SAF and RSF. Massive displacement and humanitarian crisis.",
    },
    {
        "id": "myanmar-civil-war",
        "name": "Myanmar Civil War",
        "side_a": "Myanmar Military (Tatmadaw)",
        "side_b": "National Unity Government / Ethnic Armed Organizations",
        "territory": "Myanmar",
        "region": "Asia",
        "type": "state-based",
        "intensity_level": 1,
        "start_year": 2021,
        "lat": 19.76,
        "lng": 96.07,
        "affected_commodities": ["rare_earth_minerals", "jade", "natural_gas", "timber"],
        "risk_score": 0.72,
        "source": "curated",
        "description": "Post-coup civil war. Resistance forces making significant gains against military junta.",
    },
    {
        "id": "yemen-houthi",
        "name": "Yemen / Houthi - Red Sea Crisis",
        "side_a": "Saudi-led coalition / US-UK forces",
        "side_b": "Houthi movement (Ansar Allah)",
        "territory": "Yemen, Red Sea",
        "region": "Middle East",
        "type": "state-based",
        "intensity_level": 2,
        "start_year": 2014,
        "lat": 15.37,
        "lng": 44.19,
        "affected_commodities": ["shipping", "crude_oil", "container_freight", "lng"],
        "risk_score": 0.85,
        "source": "curated",
        "description": "Houthi attacks on Red Sea shipping disrupted global trade routes. Major impact on Suez Canal traffic.",
    },
    {
        "id": "drc-m23",
        "name": "DRC - M23 / Rwanda Conflict",
        "side_a": "DR Congo (FARDC)",
        "side_b": "M23 / Rwanda-backed forces",
        "territory": "Eastern DRC",
        "region": "Africa",
        "type": "state-based",
        "intensity_level": 2,
        "start_year": 2022,
        "lat": -1.68,
        "lng": 29.22,
        "affected_commodities": ["cobalt", "coltan", "copper", "tin", "tantalum"],
        "risk_score": 0.80,
        "source": "curated",
        "description": "M23 rebel advance in eastern DRC with alleged Rwandan backing. Critical for battery mineral supply.",
    },
    {
        "id": "ethiopia-regional",
        "name": "Ethiopia Regional Conflicts",
        "side_a": "Ethiopian Federal Government",
        "side_b": "Fano militia / OLA / Regional forces",
        "territory": "Amhara, Oromia, Ethiopia",
        "region": "Africa",
        "type": "state-based",
        "intensity_level": 1,
        "start_year": 2020,
        "lat": 9.15,
        "lng": 40.50,
        "affected_commodities": ["coffee", "livestock", "sesame", "flowers"],
        "risk_score": 0.65,
        "source": "curated",
        "description": "Post-Tigray war regional instability. Active conflicts in Amhara and Oromia regions.",
    },
    {
        "id": "somalia-al-shabaab",
        "name": "Somalia - Al-Shabaab Insurgency",
        "side_a": "Somali Federal Government / ATMIS",
        "side_b": "Al-Shabaab",
        "territory": "Somalia",
        "region": "Africa",
        "type": "state-based",
        "intensity_level": 1,
        "start_year": 2006,
        "lat": 2.05,
        "lng": 45.32,
        "affected_commodities": ["livestock", "shipping", "charcoal"],
        "risk_score": 0.60,
        "source": "curated",
        "description": "Long-running Islamist insurgency. Government offensive ongoing with AU support.",
    },
    {
        "id": "syria-ongoing",
        "name": "Syria - Multi-party Conflict",
        "side_a": "HTS-led government / Turkey",
        "side_b": "Assad remnants / ISIS / SDF",
        "territory": "Syria",
        "region": "Middle East",
        "type": "state-based",
        "intensity_level": 1,
        "start_year": 2011,
        "lat": 35.20,
        "lng": 38.99,
        "affected_commodities": ["crude_oil", "wheat", "phosphates"],
        "risk_score": 0.62,
        "source": "curated",
        "description": "Post-Assad transition instability. HTS-led government faces multiple armed factions.",
    },
]

# Map country/region aliases to conflict IDs for lookup
_COUNTRY_CONFLICT_MAP: dict[str, list[str]] = {
    "russia": ["russia-ukraine"],
    "ukraine": ["russia-ukraine"],
    "israel": ["israel-palestine", "israel-iran-hezbollah"],
    "palestine": ["israel-palestine"],
    "gaza": ["israel-palestine"],
    "iran": ["israel-iran-hezbollah"],
    "lebanon": ["israel-iran-hezbollah"],
    "hezbollah": ["israel-iran-hezbollah"],
    "sudan": ["sudan-civil-war"],
    "myanmar": ["myanmar-civil-war"],
    "burma": ["myanmar-civil-war"],
    "yemen": ["yemen-houthi"],
    "houthi": ["yemen-houthi"],
    "drc": ["drc-m23"],
    "congo": ["drc-m23"],
    "ethiopia": ["ethiopia-regional"],
    "somalia": ["somalia-al-shabaab"],
    "syria": ["syria-ongoing"],
}

# Hardcoded escalation data keyed by conflict ID
_ESCALATION_DATA: dict[str, dict] = {
    "russia-ukraine": {
        "escalation_score": 0.88,
        "risk_level": "critical",
        "trend": "stable-high",
        "event_count_30d": 3200,
        "fatalities_30d": 4500,
        "civilian_fatalities_30d": 350,
        "notes": "Intense frontline fighting. Drone and missile strikes on infrastructure.",
    },
    "israel-palestine": {
        "escalation_score": 0.90,
        "risk_level": "critical",
        "trend": "high",
        "event_count_30d": 1800,
        "fatalities_30d": 2800,
        "civilian_fatalities_30d": 1200,
        "notes": "Ongoing operations in Gaza. Severe humanitarian situation.",
    },
    "israel-iran-hezbollah": {
        "escalation_score": 0.82,
        "risk_level": "critical",
        "trend": "volatile",
        "event_count_30d": 600,
        "fatalities_30d": 800,
        "civilian_fatalities_30d": 200,
        "notes": "Direct Israel-Iran exchanges. Hezbollah degraded but still active.",
    },
    "sudan-civil-war": {
        "escalation_score": 0.85,
        "risk_level": "critical",
        "trend": "escalating",
        "event_count_30d": 900,
        "fatalities_30d": 1500,
        "civilian_fatalities_30d": 600,
        "notes": "RSF advances in Darfur and Khartoum. Widespread atrocities reported.",
    },
    "myanmar-civil-war": {
        "escalation_score": 0.68,
        "risk_level": "high",
        "trend": "escalating",
        "event_count_30d": 450,
        "fatalities_30d": 350,
        "civilian_fatalities_30d": 80,
        "notes": "Resistance forces gaining territory. Junta losing control of border regions.",
    },
    "yemen-houthi": {
        "escalation_score": 0.78,
        "risk_level": "critical",
        "trend": "high",
        "event_count_30d": 300,
        "fatalities_30d": 200,
        "civilian_fatalities_30d": 40,
        "notes": "Continued Red Sea shipping attacks. US/UK strikes on Houthi positions.",
    },
    "drc-m23": {
        "escalation_score": 0.75,
        "risk_level": "high",
        "trend": "escalating",
        "event_count_30d": 400,
        "fatalities_30d": 500,
        "civilian_fatalities_30d": 150,
        "notes": "M23 expanding control. Goma under threat. Critical mineral supply disrupted.",
    },
    "ethiopia-regional": {
        "escalation_score": 0.55,
        "risk_level": "high",
        "trend": "unstable",
        "event_count_30d": 200,
        "fatalities_30d": 180,
        "civilian_fatalities_30d": 50,
        "notes": "Fano militia active in Amhara. OLA operations in Oromia.",
    },
    "somalia-al-shabaab": {
        "escalation_score": 0.50,
        "risk_level": "medium",
        "trend": "stable",
        "event_count_30d": 150,
        "fatalities_30d": 120,
        "civilian_fatalities_30d": 30,
        "notes": "Government offensive continues. Al-Shabaab retains rural strongholds.",
    },
    "syria-ongoing": {
        "escalation_score": 0.52,
        "risk_level": "medium",
        "trend": "unstable",
        "event_count_30d": 180,
        "fatalities_30d": 130,
        "civilian_fatalities_30d": 25,
        "notes": "Post-Assad transition. ISIS remnants active in eastern desert.",
    },
}


def _acled_available() -> bool:
    """Check if ACLED API credentials are configured."""
    return bool(ACLED_API_KEY and ACLED_EMAIL)


def _fetch_acled(
    country: str | None = None,
    limit: int = 100,
    days_back: int = 90,
) -> list[dict]:
    """Fetch recent conflict events from ACLED API.

    Returns list of normalized event dicts or empty list on failure.
    """
    if not _acled_available():
        return []

    params: dict = {
        "key": ACLED_API_KEY,
        "email": ACLED_EMAIL,
        "limit": min(limit, 5000),
    }

    # Date filter
    date_from = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y-%m-%d")
    params["event_date"] = f"{date_from}|"
    params["event_date_where"] = "BETWEEN"

    if country:
        params["country"] = country

    try:
        resp = requests.get(ACLED_BASE, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        payload = resp.json()

        events = []
        for row in payload.get("data", []):
            events.append({
                "id": row.get("data_id", ""),
                "country": row.get("country", ""),
                "region": row.get("region", ""),
                "conflict_name": row.get("actor1", "") + " vs " + row.get("actor2", ""),
                "type_of_violence": row.get("event_type", ""),
                "sub_event_type": row.get("sub_event_type", ""),
                "side_a": row.get("actor1", ""),
                "side_b": row.get("actor2", ""),
                "deaths_total": int(row.get("fatalities", 0) or 0),
                "lat": float(row.get("latitude", 0) or 0),
                "lng": float(row.get("longitude", 0) or 0),
                "date": row.get("event_date", ""),
                "notes": row.get("notes", ""),
                "source": "acled",
            })
        return events

    except Exception as e:
        logger.warning("ACLED API error: %s", e)
        return []


def _acled_event_count(country: str, days_back: int = 30) -> int | None:
    """Get event count for a country from ACLED. Returns None if unavailable."""
    if not _acled_available():
        return None

    date_from = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y-%m-%d")
    params = {
        "key": ACLED_API_KEY,
        "email": ACLED_EMAIL,
        "country": country,
        "event_date": f"{date_from}|",
        "event_date_where": "BETWEEN",
        "limit": 0,
    }

    try:
        resp = requests.get(ACLED_BASE, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        payload = resp.json()
        count = payload.get("count", None)
        return int(count) if count is not None else None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

@cached(ttl=86400)
def get_active_conflicts(
    region: str | None = None,
    **_kwargs,
) -> dict:
    """Get active armed conflicts.

    Returns curated list of major active conflicts, optionally enriched
    with ACLED event counts.

    Args:
        region: Filter by region name (e.g. "Middle East", "Africa", "Europe")

    Returns:
        Dict with conflicts list, count, and source info.
    """
    conflicts = []

    for c in ACTIVE_CONFLICTS:
        if region and region.lower() not in c["region"].lower():
            continue

        entry = dict(c)

        # Try to enrich with live ACLED event count
        if _acled_available():
            territory = c["territory"].split(",")[0].strip()
            count = _acled_event_count(territory, days_back=30)
            if count is not None:
                entry["acled_events_30d"] = count
                entry["source"] = "curated+acled"

        conflicts.append(entry)

    return {
        "conflicts": conflicts,
        "count": len(conflicts),
        "source": "curated+acled" if _acled_available() else "curated",
    }


@cached(ttl=3600)
def get_conflict_events(
    country: str | None = None,
    limit: int = 50,
    **_kwargs,
) -> dict:
    """Get conflict events for a country.

    Tries ACLED first, falls back to curated conflict data.

    Args:
        country: Country name filter
        limit: Max results

    Returns:
        Dict with events list, count, and source info.
    """
    # Try ACLED first
    if _acled_available() and country:
        acled_events = _fetch_acled(country=country, limit=limit)
        if acled_events:
            return {
                "events": acled_events[:limit],
                "count": len(acled_events[:limit]),
                "total_available": len(acled_events),
                "source": "acled",
            }

    # Fall back to curated data
    key = country.lower().strip() if country else ""
    conflict_ids = _COUNTRY_CONFLICT_MAP.get(key, [])

    if not conflict_ids and country:
        # Try fuzzy match against conflict fields
        for c in ACTIVE_CONFLICTS:
            searchable = f"{c['name']} {c['territory']} {c['side_a']} {c['side_b']}".lower()
            if key in searchable:
                conflict_ids.append(c["id"])

    matching = [c for c in ACTIVE_CONFLICTS if c["id"] in conflict_ids]

    # Convert curated conflicts into event-like records
    events = []
    for c in matching:
        events.append({
            "id": c["id"],
            "country": c["territory"],
            "region": c["region"],
            "conflict_name": c["name"],
            "type_of_violence": c["type"],
            "side_a": c["side_a"],
            "side_b": c["side_b"],
            "deaths_total": _ESCALATION_DATA.get(c["id"], {}).get("fatalities_30d", 0),
            "lat": c["lat"],
            "lng": c["lng"],
            "date": f"{c['start_year']}-01-01",
            "description": c.get("description", ""),
            "source": "curated",
        })

    return {
        "events": events[:limit],
        "count": len(events[:limit]),
        "total_available": len(events),
        "source": "curated",
    }


def get_escalation_score(country: str) -> dict:
    """Calculate conflict escalation score for a country.

    Uses hardcoded scores based on known conflict severity, enriched
    with ACLED data when available.

    Args:
        country: Country or conflict party name.

    Returns:
        Dict with escalation score, risk level, event counts, and trend.
    """
    key = country.lower().strip()
    conflict_ids = _COUNTRY_CONFLICT_MAP.get(key, [])

    # Fuzzy match if alias not found
    if not conflict_ids:
        for c in ACTIVE_CONFLICTS:
            searchable = f"{c['name']} {c['territory']} {c['side_a']} {c['side_b']}".lower()
            if key in searchable:
                conflict_ids.append(c["id"])

    if not conflict_ids:
        return {
            "country": country,
            "escalation_score": 0.0,
            "risk_level": "low",
            "trend": "none",
            "event_count": 0,
            "total_fatalities": 0,
            "civilian_fatalities": 0,
            "source": "curated",
        }

    # Aggregate across all matching conflicts (take highest)
    best: dict = {}
    best_score = -1.0

    for cid in conflict_ids:
        data = _ESCALATION_DATA.get(cid)
        if data and data["escalation_score"] > best_score:
            best = data
            best_score = data["escalation_score"]

    if not best:
        return {
            "country": country,
            "escalation_score": 0.1,
            "risk_level": "low",
            "trend": "unknown",
            "event_count": 0,
            "total_fatalities": 0,
            "civilian_fatalities": 0,
            "source": "curated",
        }

    result = {
        "country": country,
        "escalation_score": best["escalation_score"],
        "risk_level": best["risk_level"],
        "trend": best.get("trend", "unknown"),
        "event_count": best.get("event_count_30d", 0),
        "total_fatalities": best.get("fatalities_30d", 0),
        "civilian_fatalities": best.get("civilian_fatalities_30d", 0),
        "notes": best.get("notes", ""),
        "source": "curated",
    }

    # Enrich with ACLED if available
    if _acled_available():
        territory = ACTIVE_CONFLICTS[0]["territory"].split(",")[0].strip()
        for c in ACTIVE_CONFLICTS:
            if c["id"] in conflict_ids:
                territory = c["territory"].split(",")[0].strip()
                break
        acled_count = _acled_event_count(territory, days_back=30)
        if acled_count is not None:
            result["acled_events_30d"] = acled_count
            result["source"] = "curated+acled"

    return result


def get_affected_assets(country: str) -> dict:
    """Get potential market-impacting events for a country.

    Combines conflict data with commodity exposure to assess
    risk to companies operating in or exposed to the region.

    Args:
        country: Country or conflict party name.

    Returns:
        Dict with escalation info, active conflicts, and affected commodities.
    """
    escalation = get_escalation_score(country)
    conflicts_data = get_active_conflicts()

    key = country.lower().strip()

    # Filter conflicts involving this country
    relevant = []
    for c in conflicts_data.get("conflicts", []):
        searchable = (
            f"{c.get('name', '')} {c.get('territory', '')} "
            f"{c.get('side_a', '')} {c.get('side_b', '')} {c.get('region', '')}"
        ).lower()
        if key in searchable:
            relevant.append(c)

    # Collect all affected commodities
    all_commodities: list[str] = []
    for c in relevant:
        all_commodities.extend(c.get("affected_commodities", []))
    unique_commodities = sorted(set(all_commodities))

    return {
        "country": country,
        "escalation": escalation,
        "active_conflicts": relevant[:10],
        "conflict_count": len(relevant),
        "affected_commodities": unique_commodities,
        "source": escalation.get("source", "curated"),
    }
