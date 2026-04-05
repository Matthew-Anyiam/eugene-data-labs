"""
World Intelligence — Supply Chain module.

Wraps trade flow, port status, route risk, vessel tracking,
chokepoint impact analysis, and emerging market data.
"""

from eugene.sources.supply_chain import (
    get_trade_flows,
    get_port_status,
    get_route_risk,
    get_vessels,
)
from eugene.sources.chokepoint_impact import (
    get_chokepoint_analysis,
    get_disruption_impact,
    get_commodity_chokepoint_exposure,
)
from eugene.sources.emerging_markets import (
    get_country_indicators,
    get_em_rankings,
    get_em_overview,
    list_indicators as em_list_indicators,
    list_countries as em_list_countries,
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


# --- Chokepoint impact analysis ---

def get_chokepoints(chokepoint: str | None = None) -> dict:
    """Get chokepoint analysis with commodity flow data and disruption scenarios."""
    return get_chokepoint_analysis(chokepoint=chokepoint)


def get_chokepoint_impact(chokepoint: str) -> dict:
    """Get real-time disruption impact for a chokepoint with live signals."""
    return get_disruption_impact(chokepoint)


def get_commodity_exposure(commodity: str) -> dict:
    """Find all chokepoints that affect a given commodity."""
    return get_commodity_chokepoint_exposure(commodity)


# --- Emerging markets ---

def get_em_country(country: str, indicators: list[str] | None = None, years: int = 5) -> dict:
    """Get economic indicators for an emerging market country (World Bank data)."""
    return get_country_indicators(country, indicators=indicators, years=years)


def get_em_rank(indicator: str = "gdp_growth", region: str | None = None) -> dict:
    """Rank emerging markets by an indicator."""
    return get_em_rankings(indicator=indicator, region=region)


def get_em_dashboard(region: str | None = None) -> dict:
    """High-level emerging market overview with GDP growth, inflation, commodity exposure."""
    return get_em_overview(region=region)


def list_em_indicators(category: str | None = None) -> list[dict]:
    """List available EM indicators."""
    return em_list_indicators(category=category)


def list_em_countries(region: str | None = None) -> list[dict]:
    """List emerging market countries."""
    return em_list_countries(region=region)
