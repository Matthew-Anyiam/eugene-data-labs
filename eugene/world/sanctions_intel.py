"""
World Intelligence — Sanctions module.

Wraps the sanctions data source with intelligence-layer features:
screening, exposure analysis, and regulatory monitoring.
"""

import logging
from eugene.sources.sanctions import (
    screen_entity,
    get_sanctions_list,
    get_exposure,
    get_regulatory_changes,
)

logger = logging.getLogger(__name__)


def screen(name: str, threshold: float = 0.8, lists: list[str] | None = None) -> dict:
    """Screen an entity against all sanctions lists.

    Args:
        name: Entity name to screen
        threshold: Match threshold (0.0-1.0)
        lists: Which lists ('ofac', 'un'). Default: all.

    Returns:
        Screening result with matches and risk level
    """
    return screen_entity(name, threshold=threshold, lists=lists)


def get_list(
    source: str = "ofac",
    entity_type: str | None = None,
    program: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """Browse sanctions list entries."""
    return get_sanctions_list(source=source, entity_type=entity_type, program=program, limit=limit, offset=offset)


def check_exposure(ticker: str) -> dict:
    """Check a company's sanctions exposure."""
    return get_exposure(ticker)


def get_changes(days: int = 7, limit: int = 20) -> dict:
    """Get recent sanctions/regulatory changes."""
    return get_regulatory_changes(days=days, limit=limit)
