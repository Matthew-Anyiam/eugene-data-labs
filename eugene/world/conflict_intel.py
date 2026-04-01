"""
World Intelligence — Conflict module.

Wraps UCDP conflict data for escalation scoring and event monitoring.
"""

from eugene.sources.conflict import (
    get_conflict_events,
    get_active_conflicts,
    get_escalation_score,
    get_affected_assets,
)


def get_events(country: str | None = None, year: int | None = None, limit: int = 50) -> dict:
    """Get georeferenced conflict events."""
    return get_conflict_events(country=country, year=year, limit=limit)


def get_escalation(country: str) -> dict:
    """Get escalation score for a country."""
    return get_escalation_score(country)


def get_conflicts(region: str | None = None) -> dict:
    """Get active armed conflicts."""
    return get_active_conflicts(region=region)


def get_affected(country: str) -> dict:
    """Get affected assets for a country."""
    return get_affected_assets(country)
