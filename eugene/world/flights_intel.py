"""
World Intelligence — Flight Intelligence module.

Wraps aircraft tracking, airport status, and airspace anomaly detection.
"""

from eugene.sources.flights import (
    get_flights,
    get_airport_status,
    get_anomalies,
    get_airspace_status,
)


def get_aircraft(
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float = 200,
    icao24: str | None = None,
    limit: int = 50,
) -> dict:
    """Get real-time aircraft positions."""
    return get_flights(lat=lat, lng=lng, radius_km=radius_km, icao24=icao24, limit=limit)


def get_airport(icao: str | None = None, country: str | None = None, limit: int = 20) -> dict:
    """Get airport status with traffic density and risk."""
    return get_airport_status(icao=icao, country=country, limit=limit)


def get_airspace_anomalies(region: str | None = None, limit: int = 20) -> dict:
    """Detect airspace anomalies."""
    return get_anomalies(region=region, limit=limit)


def get_airspace(region: str | None = None) -> dict:
    """Get airspace status overview."""
    return get_airspace_status(region=region)
