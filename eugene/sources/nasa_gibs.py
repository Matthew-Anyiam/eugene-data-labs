"""
NASA GIBS (Global Imagery Browse Services) — satellite imagery tile service.

Provides WMTS tile URLs and layer metadata for Earth observation imagery.
No API key required. Used for supply chain, disaster, and world intelligence
visualisation overlays.

- WMTS: https://gibs.earthdata.nasa.gov/wmts/
- EONET (Earth Observatory Natural Event Tracker): https://eonet.gsfc.nasa.gov/api/v3/
- Docs: https://nasa-gibs.github.io/gibs-api-docs/
"""

import logging
import os
import requests
from datetime import datetime, timedelta, timezone
from eugene.cache import cached

logger = logging.getLogger(__name__)

NASA_API_KEY = os.environ.get("NASA_API_KEY", "DEMO_KEY")

# ---------------------------------------------------------------------------
# GIBS WMTS tile service
# ---------------------------------------------------------------------------

GIBS_WMTS_BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best"

# Curated layers useful for world intelligence / supply chain monitoring
GIBS_LAYERS = {
    # True-color imagery
    "terra_truecolor": {
        "id": "MODIS_Terra_CorrectedReflectance_TrueColor",
        "title": "MODIS Terra True Color",
        "category": "imagery",
        "format": "jpg",
        "matrix_set": "GoogleMapsCompatible_Level9",
        "description": "Daily true-color satellite imagery from Terra/MODIS",
    },
    "aqua_truecolor": {
        "id": "MODIS_Aqua_CorrectedReflectance_TrueColor",
        "title": "MODIS Aqua True Color",
        "category": "imagery",
        "format": "jpg",
        "matrix_set": "GoogleMapsCompatible_Level9",
        "description": "Daily true-color satellite imagery from Aqua/MODIS",
    },
    "viirs_truecolor": {
        "id": "VIIRS_SNPP_CorrectedReflectance_TrueColor",
        "title": "VIIRS True Color",
        "category": "imagery",
        "format": "jpg",
        "matrix_set": "GoogleMapsCompatible_Level9",
        "description": "Daily true-color satellite imagery from Suomi NPP/VIIRS",
    },
    # Fire & thermal
    "terra_fires": {
        "id": "MODIS_Terra_Thermal_Anomalies_Day",
        "title": "MODIS Terra Fire/Thermal (Day)",
        "category": "fire",
        "format": "png",
        "matrix_set": "GoogleMapsCompatible_Level8",
        "description": "Active fire and thermal anomaly detections (daytime)",
    },
    "aqua_fires": {
        "id": "MODIS_Aqua_Thermal_Anomalies_Day",
        "title": "MODIS Aqua Fire/Thermal (Day)",
        "category": "fire",
        "format": "png",
        "matrix_set": "GoogleMapsCompatible_Level8",
        "description": "Active fire and thermal anomaly detections from Aqua",
    },
    "viirs_fires": {
        "id": "VIIRS_SNPP_Thermal_Anomalies_375m_Day",
        "title": "VIIRS Fire Detections (375m)",
        "category": "fire",
        "format": "png",
        "matrix_set": "GoogleMapsCompatible_Level8",
        "description": "High-resolution active fire detections from VIIRS",
    },
    # Atmosphere & weather
    "aerosol": {
        "id": "MODIS_Terra_Aerosol_Optical_Depth_3km",
        "title": "Aerosol Optical Depth",
        "category": "atmosphere",
        "format": "png",
        "matrix_set": "GoogleMapsCompatible_Level6",
        "description": "Aerosol concentration — indicates pollution, dust storms, smoke",
    },
    "cloud_fraction": {
        "id": "MODIS_Terra_Cloud_Fraction_Day",
        "title": "Cloud Fraction (Day)",
        "category": "atmosphere",
        "format": "png",
        "matrix_set": "GoogleMapsCompatible_Level6",
        "description": "Cloud coverage fraction — weather pattern indicator",
    },
    # Sea surface & ocean
    "sea_surface_temp": {
        "id": "MODIS_Aqua_L3_SST_MidIR_Monthly",
        "title": "Sea Surface Temperature",
        "category": "ocean",
        "format": "png",
        "matrix_set": "GoogleMapsCompatible_Level7",
        "description": "Monthly sea surface temperature — shipping lane and port conditions",
    },
    "chlorophyll": {
        "id": "MODIS_Aqua_L3_Chlorophyll_A_Monthly",
        "title": "Ocean Chlorophyll Concentration",
        "category": "ocean",
        "format": "png",
        "matrix_set": "GoogleMapsCompatible_Level7",
        "description": "Ocean biological productivity — fisheries and environmental monitoring",
    },
    # Nighttime lights / economic activity
    "nightlights": {
        "id": "VIIRS_SNPP_DayNightBand_ENCC",
        "title": "Nighttime Lights",
        "category": "economic",
        "format": "png",
        "matrix_set": "GoogleMapsCompatible_Level8",
        "description": "Nighttime light emissions — proxy for economic activity and urbanization",
    },
    # Vegetation / agriculture
    "ndvi": {
        "id": "MODIS_Terra_NDVI_8Day",
        "title": "Vegetation Index (NDVI)",
        "category": "vegetation",
        "format": "png",
        "matrix_set": "GoogleMapsCompatible_Level8",
        "description": "Normalized vegetation index — agriculture health and drought monitoring",
    },
    "snow_cover": {
        "id": "MODIS_Terra_Snow_Cover",
        "title": "Snow Cover",
        "category": "weather",
        "format": "png",
        "matrix_set": "GoogleMapsCompatible_Level8",
        "description": "Snow coverage — logistics disruption and water supply indicator",
    },
    # Flooding / water
    "flood_map": {
        "id": "MODIS_Aqua_Flood_3Day",
        "title": "3-Day Flood Map",
        "category": "disaster",
        "format": "png",
        "matrix_set": "GoogleMapsCompatible_Level8",
        "description": "Near-real-time flood extent — infrastructure and supply chain impact",
    },
}


def get_tile_url(layer_key: str, date: str | None = None, z: int = 3, x: int = 0, y: int = 0) -> str:
    """Build a WMTS tile URL for a given GIBS layer.

    Args:
        layer_key: Key from GIBS_LAYERS dict
        date: Date string YYYY-MM-DD (default: yesterday for NRT data)
        z: Zoom level (TileMatrix)
        x: Tile column
        y: Tile row

    Returns:
        Full tile URL string
    """
    layer = GIBS_LAYERS.get(layer_key)
    if not layer:
        raise ValueError(f"Unknown GIBS layer: {layer_key}. Available: {list(GIBS_LAYERS.keys())}")

    if not date:
        date = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")

    fmt = layer["format"]
    return (
        f"{GIBS_WMTS_BASE}/{layer['id']}/default/{date}/"
        f"{layer['matrix_set']}/{z}/{y}/{x}.{fmt}"
    )


def get_wmts_config(layer_key: str, date: str | None = None) -> dict:
    """Get WMTS configuration for a frontend map library (Leaflet, MapLibre, etc.).

    Returns a dict with everything the frontend needs to render GIBS tiles.
    """
    layer = GIBS_LAYERS.get(layer_key)
    if not layer:
        raise ValueError(f"Unknown GIBS layer: {layer_key}")

    if not date:
        date = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")

    return {
        "key": layer_key,
        "layer_id": layer["id"],
        "title": layer["title"],
        "category": layer["category"],
        "description": layer["description"],
        "url_template": (
            f"{GIBS_WMTS_BASE}/{layer['id']}/default/{date}/"
            f"{layer['matrix_set']}/{{z}}/{{y}}/{{x}}.{layer['format']}"
        ),
        "format": f"image/{layer['format']}",
        "date": date,
        "attribution": "NASA GIBS",
        "max_zoom": int(layer["matrix_set"].split("Level")[-1]) if "Level" in layer["matrix_set"] else 9,
    }


def list_layers(category: str | None = None) -> list[dict]:
    """List available GIBS layers, optionally filtered by category.

    Categories: imagery, fire, atmosphere, ocean, economic, vegetation, weather, disaster
    """
    layers = []
    for key, layer in GIBS_LAYERS.items():
        if category and layer["category"] != category:
            continue
        layers.append({
            "key": key,
            "layer_id": layer["id"],
            "title": layer["title"],
            "category": layer["category"],
            "description": layer["description"],
            "format": layer["format"],
        })
    return layers


# ---------------------------------------------------------------------------
# NASA EONET — Earth Observatory Natural Event Tracker
# ---------------------------------------------------------------------------

EONET_API = "https://eonet.gsfc.nasa.gov/api/v3"


@cached(ttl=1800)  # 30min cache
def get_natural_events(
    category: str | None = None,
    days: int = 30,
    status: str = "open",
    limit: int = 50,
) -> dict:
    """Get active natural events from NASA EONET.

    Categories: drought, dustHaze, earthquakes, floods, landslides,
    manmadeFires, seaLakeIce, severeStorms, snow, tempExtremes,
    volcanoes, waterColor, wildfires

    Args:
        category: EONET category ID (e.g. 'wildfires', 'severeStorms')
        days: Events from last N days
        status: 'open' (active) or 'closed'
        limit: Max results

    Returns:
        Dict with events list including geometry coordinates.
    """
    params = {
        "status": status,
        "limit": limit,
        "days": days,
        "api_key": NASA_API_KEY,
    }
    if category:
        url = f"{EONET_API}/categories/{category}"
    else:
        url = f"{EONET_API}/events"

    try:
        resp = requests.get(url, params=params, timeout=20)
        resp.raise_for_status()
        data = resp.json()

        events = []
        for event in data.get("events", []):
            # Get the most recent geometry (latest observation)
            geometries = event.get("geometry", [])
            latest_geo = geometries[-1] if geometries else {}
            coords = latest_geo.get("coordinates", [0, 0])

            categories = event.get("categories", [])
            cat_id = categories[0].get("id", "") if categories else ""
            cat_title = categories[0].get("title", "") if categories else ""

            # Get all sources for this event
            sources = [
                {"id": s.get("id", ""), "url": s.get("url", "")}
                for s in event.get("sources", [])
            ]

            events.append({
                "id": event.get("id", ""),
                "title": event.get("title", ""),
                "category_id": cat_id,
                "category": cat_title,
                "lat": coords[1] if len(coords) > 1 else coords[0],
                "lng": coords[0],
                "date": latest_geo.get("date", ""),
                "geometry_type": latest_geo.get("type", "Point"),
                "observation_count": len(geometries),
                "sources": sources,
                "closed": event.get("closed"),
                "type": "natural_event",
                "source": "nasa_eonet",
            })

        return {
            "events": events,
            "count": len(events),
            "title": data.get("title", "EONET Events"),
            "source": "nasa_eonet",
        }

    except Exception as e:
        logger.error("NASA EONET error: %s", e)
        return {"events": [], "count": 0, "error": str(e), "source": "nasa_eonet"}


@cached(ttl=86400)  # 24h cache
def get_eonet_categories() -> list[dict]:
    """List available EONET event categories."""
    try:
        resp = requests.get(
            f"{EONET_API}/categories",
            params={"api_key": NASA_API_KEY},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return [
            {"id": c["id"], "title": c["title"], "description": c.get("description", "")}
            for c in data.get("categories", [])
        ]
    except Exception as e:
        logger.error("EONET categories error: %s", e)
        return []


# ---------------------------------------------------------------------------
# NASA EONET + GIBS combined: event imagery
# ---------------------------------------------------------------------------

def get_event_imagery(event_lat: float, event_lng: float, date: str | None = None) -> dict:
    """Get relevant satellite imagery layers for a specific event location.

    Returns GIBS tile configs centered on the event, suitable for
    rendering in a frontend map component.
    """
    if not date:
        date = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")

    # Select relevant layers based on what's useful for event monitoring
    relevant_layers = ["viirs_truecolor", "terra_fires", "viirs_fires", "flood_map", "aerosol"]

    imagery = []
    for layer_key in relevant_layers:
        try:
            config = get_wmts_config(layer_key, date=date)
            config["center"] = {"lat": event_lat, "lng": event_lng}
            imagery.append(config)
        except ValueError:
            continue

    return {
        "location": {"lat": event_lat, "lng": event_lng},
        "date": date,
        "layers": imagery,
        "source": "nasa_gibs",
    }
