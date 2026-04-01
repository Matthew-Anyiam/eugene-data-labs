"""
Eugene Intelligence — Ontology Engine.

Unified entity graph linking all Eugene data sources into typed objects
with explicit relationships. Provides entity resolution, graph traversal,
and signal convergence queries.
"""

from eugene.ontology.schema import init_ontology_db
from eugene.ontology.entities import (
    create_entity,
    get_entity,
    resolve_entity,
    search_entities,
    update_entity,
    add_alias,
)
from eugene.ontology.edges import (
    create_edge,
    get_relationships,
    traverse,
)
from eugene.ontology.signals import (
    record_signal,
    get_entity_signals,
    get_convergence,
)

__all__ = [
    "init_ontology_db",
    "create_entity",
    "get_entity",
    "resolve_entity",
    "search_entities",
    "update_entity",
    "add_alias",
    "create_edge",
    "get_relationships",
    "traverse",
    "record_signal",
    "get_entity_signals",
    "get_convergence",
]
