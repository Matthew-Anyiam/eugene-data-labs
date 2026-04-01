"""
Entity CRUD operations and resolution.

Handles creating, reading, updating, and resolving entities
in the ontology graph. Supports fuzzy name matching for
entity resolution.
"""

import json
import logging
import uuid
from datetime import datetime

from eugene.db import _get_conn
from eugene.ontology.schema import ENTITY_TYPES

logger = logging.getLogger(__name__)


def _new_id() -> str:
    return str(uuid.uuid4())


def create_entity(
    entity_type: str,
    canonical_name: str,
    attributes: dict | None = None,
    source: str | None = None,
    source_id: str | None = None,
    aliases: list[dict] | None = None,
) -> dict:
    """Create a new entity node.

    Args:
        entity_type: One of ENTITY_TYPES
        canonical_name: Primary display name
        attributes: Arbitrary JSON attributes
        source: Data source ('sec', 'fred', 'crypto', 'world_intel')
        source_id: Source-specific identifier (CIK, ticker, MMSI)
        aliases: List of {alias, alias_type, source} dicts

    Returns:
        Created entity dict with id
    """
    if entity_type not in ENTITY_TYPES:
        raise ValueError(f"Invalid entity_type: {entity_type}. Must be one of {ENTITY_TYPES}")

    # Check for existing entity with same source+source_id
    if source and source_id:
        existing = _find_by_source(source, source_id)
        if existing:
            return existing

    entity_id = _new_id()
    now = datetime.utcnow().isoformat()
    attrs_json = json.dumps(attributes or {})

    with _get_conn() as conn:
        conn.execute(
            """INSERT INTO entities (id, entity_type, canonical_name, attributes, source, source_id, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (entity_id, entity_type, canonical_name, attrs_json, source, source_id, now, now),
        )

        # Add aliases
        if aliases:
            for a in aliases:
                alias_id = _new_id()
                conn.execute(
                    """INSERT INTO entity_aliases (id, entity_id, alias, alias_type, source)
                       VALUES (?, ?, ?, ?, ?)""",
                    (alias_id, entity_id, a["alias"], a.get("alias_type"), a.get("source")),
                )

    entity = {
        "id": entity_id,
        "entity_type": entity_type,
        "canonical_name": canonical_name,
        "attributes": attributes or {},
        "source": source,
        "source_id": source_id,
        "created_at": now,
        "updated_at": now,
    }
    logger.debug("Created entity %s: %s (%s)", entity_id[:8], canonical_name, entity_type)
    return entity


def _find_by_source(source: str, source_id: str) -> dict | None:
    """Find entity by source + source_id."""
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM entities WHERE source = ? AND source_id = ?",
            (source, source_id),
        ).fetchone()
        if row:
            return _row_to_dict(row)
    return None


def get_entity(entity_id: str) -> dict | None:
    """Get entity by ID with its aliases and immediate relationship counts."""
    with _get_conn() as conn:
        row = conn.execute("SELECT * FROM entities WHERE id = ?", (entity_id,)).fetchone()
        if not row:
            return None

        entity = _row_to_dict(row)

        # Get aliases
        aliases = conn.execute(
            "SELECT alias, alias_type, source FROM entity_aliases WHERE entity_id = ?",
            (entity_id,),
        ).fetchall()
        entity["aliases"] = [dict(a) for a in aliases]

        # Count relationships
        outbound = conn.execute(
            "SELECT relationship, COUNT(*) as cnt FROM edges WHERE source_id = ? GROUP BY relationship",
            (entity_id,),
        ).fetchall()
        inbound = conn.execute(
            "SELECT relationship, COUNT(*) as cnt FROM edges WHERE target_id = ? GROUP BY relationship",
            (entity_id,),
        ).fetchall()
        entity["relationship_counts"] = {
            "outbound": {r["relationship"]: r["cnt"] for r in outbound},
            "inbound": {r["relationship"]: r["cnt"] for r in inbound},
        }

    return entity


def resolve_entity(
    query: str,
    entity_type: str | None = None,
    limit: int = 5,
) -> list[dict]:
    """Resolve a query string to matching entities.

    Resolution priority:
    1. Exact match on source_id (CIK, ticker, MMSI, ICAO24)
    2. Exact match on alias
    3. Fuzzy name match (LIKE with wildcards)

    Args:
        query: Search string (ticker, CIK, name, etc.)
        entity_type: Optional filter by entity type
        limit: Max results to return

    Returns:
        List of matching entities sorted by match quality
    """
    results = []
    query_upper = query.strip().upper()
    query_lower = query.strip().lower()

    with _get_conn() as conn:
        type_filter = ""
        type_params: tuple = ()
        if entity_type:
            type_filter = "AND e.entity_type = ?"
            type_params = (entity_type,)

        # 1. Exact source_id match
        rows = conn.execute(
            f"""SELECT e.*, 1.0 as match_score, 'source_id' as match_type
                FROM entities e
                WHERE e.source_id = ? {type_filter}
                LIMIT ?""",
            (query_upper, *type_params, limit),
        ).fetchall()
        for r in rows:
            d = _row_to_dict(r)
            d["match_score"] = 1.0
            d["match_type"] = "source_id"
            results.append(d)

        if len(results) >= limit:
            return results[:limit]

        # 2. Exact alias match
        seen_ids = {r["id"] for r in results}
        rows = conn.execute(
            f"""SELECT e.*, 0.95 as match_score, 'alias' as match_type
                FROM entities e
                JOIN entity_aliases a ON a.entity_id = e.id
                WHERE a.alias = ? COLLATE NOCASE {type_filter}
                LIMIT ?""",
            (query.strip(), *type_params, limit),
        ).fetchall()
        for r in rows:
            d = _row_to_dict(r)
            if d["id"] not in seen_ids:
                d["match_score"] = 0.95
                d["match_type"] = "alias"
                results.append(d)
                seen_ids.add(d["id"])

        if len(results) >= limit:
            return results[:limit]

        # 3. Fuzzy name match (LIKE)
        rows = conn.execute(
            f"""SELECT e.*, 0.7 as match_score, 'fuzzy' as match_type
                FROM entities e
                WHERE e.canonical_name LIKE ? COLLATE NOCASE {type_filter}
                ORDER BY LENGTH(e.canonical_name) ASC
                LIMIT ?""",
            (f"%{query_lower}%", *type_params, limit),
        ).fetchall()
        for r in rows:
            d = _row_to_dict(r)
            if d["id"] not in seen_ids:
                d["match_score"] = 0.7
                d["match_type"] = "fuzzy"
                results.append(d)
                seen_ids.add(d["id"])

    return results[:limit]


def search_entities(
    query: str | None = None,
    entity_type: str | None = None,
    filters: dict | None = None,
    limit: int = 20,
    offset: int = 0,
) -> dict:
    """Full-text + attribute search across entities.

    Args:
        query: Text search in name and aliases
        entity_type: Filter by type
        filters: Attribute filters (e.g. {"sector": "Technology"})
        limit: Max results
        offset: Pagination offset

    Returns:
        Dict with entities list and total count
    """
    conditions = []
    params: list = []

    if entity_type:
        conditions.append("e.entity_type = ?")
        params.append(entity_type)

    if query:
        conditions.append("""(
            e.canonical_name LIKE ? COLLATE NOCASE
            OR EXISTS (
                SELECT 1 FROM entity_aliases a
                WHERE a.entity_id = e.id AND a.alias LIKE ? COLLATE NOCASE
            )
        )""")
        like_q = f"%{query.strip()}%"
        params.extend([like_q, like_q])

    if filters:
        for key, value in filters.items():
            # JSON attribute search using json_extract
            conditions.append(f"json_extract(e.attributes, '$.{key}') = ?")
            params.append(str(value))

    where = "WHERE " + " AND ".join(conditions) if conditions else ""

    with _get_conn() as conn:
        # Count
        count_row = conn.execute(
            f"SELECT COUNT(*) FROM entities e {where}", params
        ).fetchone()
        total = count_row[0]

        # Fetch
        rows = conn.execute(
            f"""SELECT e.* FROM entities e {where}
                ORDER BY e.updated_at DESC
                LIMIT ? OFFSET ?""",
            [*params, limit, offset],
        ).fetchall()

    return {
        "entities": [_row_to_dict(r) for r in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def update_entity(entity_id: str, attributes: dict | None = None, canonical_name: str | None = None) -> dict | None:
    """Update an entity's attributes or name."""
    with _get_conn() as conn:
        row = conn.execute("SELECT * FROM entities WHERE id = ?", (entity_id,)).fetchone()
        if not row:
            return None

        now = datetime.utcnow().isoformat()
        if attributes is not None:
            existing = json.loads(row["attributes"] or "{}")
            existing.update(attributes)
            conn.execute(
                "UPDATE entities SET attributes = ?, updated_at = ? WHERE id = ?",
                (json.dumps(existing), now, entity_id),
            )
        if canonical_name is not None:
            conn.execute(
                "UPDATE entities SET canonical_name = ?, updated_at = ? WHERE id = ?",
                (canonical_name, now, entity_id),
            )

    return get_entity(entity_id)


def add_alias(entity_id: str, alias: str, alias_type: str | None = None, source: str | None = None) -> dict:
    """Add an alias to an existing entity."""
    alias_id = _new_id()
    with _get_conn() as conn:
        conn.execute(
            """INSERT OR IGNORE INTO entity_aliases (id, entity_id, alias, alias_type, source)
               VALUES (?, ?, ?, ?, ?)""",
            (alias_id, entity_id, alias, alias_type, source),
        )
    return {"id": alias_id, "entity_id": entity_id, "alias": alias, "alias_type": alias_type}


def get_entity_count(entity_type: str | None = None) -> int:
    """Count entities, optionally filtered by type."""
    with _get_conn() as conn:
        if entity_type:
            row = conn.execute("SELECT COUNT(*) FROM entities WHERE entity_type = ?", (entity_type,)).fetchone()
        else:
            row = conn.execute("SELECT COUNT(*) FROM entities").fetchone()
        return row[0]


def _row_to_dict(row) -> dict:
    """Convert a sqlite Row to dict, parsing JSON attributes."""
    d = dict(row)
    if "attributes" in d and isinstance(d["attributes"], str):
        try:
            d["attributes"] = json.loads(d["attributes"])
        except (json.JSONDecodeError, TypeError):
            d["attributes"] = {}
    # Remove internal score columns if present
    d.pop("match_score", None)
    d.pop("match_type", None)
    return d
