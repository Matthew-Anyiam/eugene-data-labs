"""
World Intelligence — Disasters module.

Wraps USGS, GDACS, NASA FIRMS, NASA EONET, and NASA GIBS data sources.
"""

from eugene.sources.disasters import (
    get_active_disasters,
    get_earthquakes,
    get_climate_risk,
)
from eugene.sources.nasa_gibs import (
    get_natural_events,
    get_event_imagery,
    get_wmts_config,
    list_layers as list_gibs_layers,
    get_eonet_categories,
)


def get_active(days: int = 7, min_magnitude: float = 4.0, include_fires: bool = False) -> dict:
    """Get all active disasters across sources."""
    return get_active_disasters(days=days, min_magnitude=min_magnitude, include_fires=include_fires)


def get_impact(lat: float, lng: float, radius_km: float = 500) -> dict:
    """Assess disaster risk/impact for a location."""
    return get_climate_risk(lat, lng, radius_km)


def get_historical(min_magnitude: float = 5.0, days: int = 30, limit: int = 50) -> dict:
    """Get historical earthquake data."""
    return get_earthquakes(min_magnitude=min_magnitude, days=days, limit=limit)


def get_nasa_events(category: str | None = None, days: int = 30, limit: int = 50) -> dict:
    """Get natural events from NASA EONET (wildfires, storms, volcanoes, etc.)."""
    return get_natural_events(category=category, days=days, limit=limit)


def get_satellite_imagery(lat: float, lng: float, date: str | None = None) -> dict:
    """Get satellite imagery layers for a specific location from NASA GIBS."""
    return get_event_imagery(lat, lng, date=date)


def get_imagery_layer(layer_key: str, date: str | None = None) -> dict:
    """Get WMTS tile config for a specific GIBS layer."""
    return get_wmts_config(layer_key, date=date)


def list_imagery_layers(category: str | None = None) -> list[dict]:
    """List available NASA GIBS satellite imagery layers."""
    return list_gibs_layers(category=category)


def list_event_categories() -> list[dict]:
    """List available NASA EONET event categories."""
    return get_eonet_categories()
