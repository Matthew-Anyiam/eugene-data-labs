"""
World Intelligence — Supply Chain module.

Wraps trade flow, port status, route risk, and vessel tracking sources.
"""

from eugene.sources.supply_chain import (
    get_trade_flows,
    get_port_status,
    get_route_risk,
    get_vessels,
)


def get_ports(port_code: str | None = None, country: str | None = None, limit: int = 20) -> dict:
    """Get port status with congestion risk."""
    return get_port_status(port_code=port_code, country=country, limit=limit)


def get_trade(
    reporter: str = "US",
    partner: str | None = None,
    commodity: str | None = None,
    flow: str = "X",
    limit: int = 50,
) -> dict:
    """Get international trade flow data."""
    return get_trade_flows(reporter=reporter, partner=partner, commodity=commodity, flow=flow, limit=limit)


def get_routes(origin: str | None = None, destination: str | None = None) -> dict:
    """Get shipping route risk across chokepoints."""
    return get_route_risk(origin=origin, destination=destination)


def get_vessel(mmsi: str | None = None, lat: float | None = None, lng: float | None = None) -> dict:
    """Get vessel positions from AIS."""
    return get_vessels(lat=lat, lng=lng, mmsi=mmsi)
