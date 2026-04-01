"""
World Intelligence — Disasters module.

Wraps USGS, GDACS, and NASA FIRMS data sources.
"""

from eugene.sources.disasters import (
    get_active_disasters,
    get_earthquakes,
    get_climate_risk,
)


def get_active(days: int = 7, min_magnitude: float = 4.5, include_fires: bool = False) -> dict:
    """Get all active disasters across sources."""
    return get_active_disasters(days=days, min_magnitude=min_magnitude, include_fires=include_fires)


def get_impact(lat: float, lng: float, radius_km: float = 500) -> dict:
    """Assess disaster risk/impact for a location."""
    return get_climate_risk(lat, lng, radius_km)


def get_historical(min_magnitude: float = 5.0, days: int = 30, limit: int = 50) -> dict:
    """Get historical earthquake data."""
    return get_earthquakes(min_magnitude=min_magnitude, days=days, limit=limit)
