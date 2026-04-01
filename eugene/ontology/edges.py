"""
Relationship edge operations and graph traversal.

Handles creating edges between entities and performing
multi-hop graph traversal queries.
"""

import json
import logging
import uuid
from datetime import datetime

from eugene.db import _get_conn
from eugene.ontology.schema import RELATIONSHIP_TYPES

logger = logging.getLogger(__name__)


def _new_id() -> str:
    return str(uuid.uuid4())


def create_edge(
    source_id: str,
    target_id: str,
    relationship: str,
    attributes: dict | None = None,
    confidence: float = 1.0,
    valid_from: str | None = None,
    valid_to: str | None = None,
) -> dict:
    """Create a relationship edge between two entities.

    Args:
        source_id: Source entity UUID
        target_id: Target entity UUID
        relationship: Edge type from RELATIONSHIP_TYPES
        attributes: Edge metadata (role, shares, etc.)
        confidence: Confidence score 0.0-1.0
        valid_from: When the relationship started
        valid_to: When it ended (None = current)

    Returns:
        Created edge dict
    """
    if relationship not in RELATIONSHIP_TYPES:
        raise ValueError(f"Invalid relationship: {relationship}. Must be one of {RELATIONSHIP_TYPES}")

    # Check for duplicate edge
    with _get_conn() as conn:
        existing = conn.execute(
            """SELECT id FROM edges
               WHERE source_id = ? AND target_id = ? AND relationship = ?
               AND (valid_from = ? OR (valid_from IS NULL AND ? IS NULL))""",
            (source_id, target_id, relationship, valid_from, valid_from),
        ).fetchone()
        if existing:
            return {"id": existing["id"], "exists": True}

        edge_id = _new_id()
        now = datetime.utcnow().isoformat()
        attrs_json = json.dumps(attributes or {})

        conn.execute(
            """INSERT INTO edges (id, source_id, target_id, relationship, attributes, confidence, valid_from, valid_to, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (edge_id, source_id, target_id, relationship, attrs_json, confidence, valid_from, valid_to, now),
        )

    logger.debug("Created edge %s: %s -[%s]-> %s", edge_id[:8], source_id[:8], relationship, target_id[:8])
    return {
        "id": edge_id,
        "source_id": source_id,
        "target_id": target_id,
        "relationship": relationship,
        "attributes": attributes or {},
        "confidence": confidence,
        "valid_from": valid_from,
        "valid_to": valid_to,
    }


def get_relationships(
    entity_id: str,
    relationship: str | None = None,
    direction: str = "both",
    limit: int = 50,
) -> dict:
    """Get edges for an entity.

    Args:
        entity_id: Entity UUID
        relationship: Filter by relationship type
        direction: 'outbound', 'inbound', or 'both'
        limit: Max edges to return

    Returns:
        Dict with outbound and inbound edge lists
    """
    result = {"entity_id": entity_id, "outbound": [], "inbound": []}

    with _get_conn() as conn:
        rel_filter = ""
        rel_params: tuple = ()
        if relationship:
            rel_filter = "AND e.relationship = ?"
            rel_params = (relationship,)

        if direction in ("outbound", "both"):
            rows = conn.execute(
                f"""SELECT e.*, ent.canonical_name as target_name, ent.entity_type as target_type
                    FROM edges e
                    JOIN entities ent ON ent.id = e.target_id
                    WHERE e.source_id = ? {rel_filter}
                    AND (e.valid_to IS NULL OR e.valid_to >= datetime('now'))
                    ORDER BY e.created_at DESC
                    LIMIT ?""",
                (entity_id, *rel_params, limit),
            ).fetchall()
            result["outbound"] = [_edge_to_dict(r) for r in rows]

        if direction in ("inbound", "both"):
            rows = conn.execute(
                f"""SELECT e.*, ent.canonical_name as source_name, ent.entity_type as source_type
                    FROM edges e
                    JOIN entities ent ON ent.id = e.source_id
                    WHERE e.target_id = ? {rel_filter}
                    AND (e.valid_to IS NULL OR e.valid_to >= datetime('now'))
                    ORDER BY e.created_at DESC
                    LIMIT ?""",
                (entity_id, *rel_params, limit),
            ).fetchall()
            result["inbound"] = [_edge_to_dict(r) for r in rows]

    return result


def traverse(
    entity_id: str,
    max_depth: int = 2,
    relationship_filter: str | None = None,
    limit: int = 100,
) -> dict:
    """Multi-hop graph traversal using iterative BFS.

    SQLite doesn't support recursive CTEs as efficiently as PostgreSQL,
    so we use Python-side BFS with batched queries.

    Args:
        entity_id: Starting entity UUID
        max_depth: Maximum hops (1-4)
        relationship_filter: Only follow specific relationship types
        limit: Max total entities to return

    Returns:
        Dict with nodes list and edges list
    """
    max_depth = min(max_depth, 4)  # Safety cap
    visited = {entity_id}
    nodes = []
    edges_found = []
    frontier = [entity_id]

    with _get_conn() as conn:
        # Get starting node
        start = conn.execute("SELECT * FROM entities WHERE id = ?", (entity_id,)).fetchone()
        if not start:
            return {"error": "Entity not found", "nodes": [], "edges": []}
        nodes.append(_entity_row_to_dict(start, depth=0))

        for depth in range(1, max_depth + 1):
            if not frontier or len(nodes) >= limit:
                break

            next_frontier = []
            placeholders = ",".join(["?"] * len(frontier))

            rel_filter = ""
            rel_params: tuple = ()
            if relationship_filter:
                rel_filter = "AND e.relationship = ?"
                rel_params = (relationship_filter,)

            # Outbound edges
            rows = conn.execute(
                f"""SELECT e.*, ent.canonical_name, ent.entity_type, ent.attributes, ent.source, ent.source_id
                    FROM edges e
                    JOIN entities ent ON ent.id = e.target_id
                    WHERE e.source_id IN ({placeholders}) {rel_filter}
                    AND (e.valid_to IS NULL OR e.valid_to >= datetime('now'))""",
                (*frontier, *rel_params),
            ).fetchall()

            for r in rows:
                target_id = r["target_id"]
                edges_found.append({
                    "id": r["id"],
                    "source_id": r["source_id"],
                    "target_id": target_id,
                    "relationship": r["relationship"],
                    "attributes": json.loads(r["attributes"] or "{}"),
                    "confidence": r["confidence"],
                })
                if target_id not in visited and len(nodes) < limit:
                    visited.add(target_id)
                    next_frontier.append(target_id)
                    nodes.append({
                        "id": target_id,
                        "entity_type": r["entity_type"],
                        "canonical_name": r["canonical_name"],
                        "attributes": json.loads(r["attributes"] or "{}") if isinstance(r["attributes"], str) else r.get("attributes", {}),
                        "depth": depth,
                    })

            # Inbound edges
            rows = conn.execute(
                f"""SELECT e.*, ent.canonical_name, ent.entity_type, ent.attributes, ent.source, ent.source_id
                    FROM edges e
                    JOIN entities ent ON ent.id = e.source_id
                    WHERE e.target_id IN ({placeholders}) {rel_filter}
                    AND (e.valid_to IS NULL OR e.valid_to >= datetime('now'))""",
                (*frontier, *rel_params),
            ).fetchall()

            for r in rows:
                src_id = r["source_id"]
                edges_found.append({
                    "id": r["id"],
                    "source_id": src_id,
                    "target_id": r["target_id"],
                    "relationship": r["relationship"],
                    "attributes": json.loads(r["attributes"] or "{}"),
                    "confidence": r["confidence"],
                })
                if src_id not in visited and len(nodes) < limit:
                    visited.add(src_id)
                    next_frontier.append(src_id)
                    nodes.append({
                        "id": src_id,
                        "entity_type": r["entity_type"],
                        "canonical_name": r["canonical_name"],
                        "attributes": json.loads(r["attributes"] or "{}") if isinstance(r["attributes"], str) else r.get("attributes", {}),
                        "depth": depth,
                    })

            frontier = next_frontier

    return {
        "root": entity_id,
        "max_depth": max_depth,
        "nodes": nodes[:limit],
        "edges": edges_found,
        "node_count": len(nodes),
        "edge_count": len(edges_found),
    }


def _edge_to_dict(row) -> dict:
    """Convert edge row to dict."""
    d = dict(row)
    if "attributes" in d and isinstance(d["attributes"], str):
        try:
            d["attributes"] = json.loads(d["attributes"])
        except (json.JSONDecodeError, TypeError):
            d["attributes"] = {}
    return d


def _entity_row_to_dict(row, depth: int = 0) -> dict:
    """Convert entity row to dict for traversal results."""
    attrs = row["attributes"]
    if isinstance(attrs, str):
        try:
            attrs = json.loads(attrs)
        except (json.JSONDecodeError, TypeError):
            attrs = {}
    return {
        "id": row["id"],
        "entity_type": row["entity_type"],
        "canonical_name": row["canonical_name"],
        "attributes": attrs,
        "depth": depth,
    }
