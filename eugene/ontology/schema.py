"""
Ontology database schema — SQLite tables for entity graph.

Tables:
  - entities: Graph nodes (company, person, institution, filing, etc.)
  - entity_aliases: Fuzzy/exact matching for entity resolution
  - edges: Typed relationships between entities
  - signals: Normalized signal stream for convergence detection
"""

import logging
from eugene.db import _get_conn

logger = logging.getLogger(__name__)

# Valid entity types
ENTITY_TYPES = {
    "company", "person", "institution", "filing", "transaction",
    "economic_indicator", "crypto_asset", "news_event", "facility",
    "vessel", "aircraft", "sanction", "conflict_event", "disaster_event",
}

# Valid relationship types
RELATIONSHIP_TYPES = {
    "officer_of", "transacted", "holds", "filed", "exposed_to",
    "peer_of", "operates", "sanctioned_by", "located_in", "docked_at",
    "carries_for", "mentions", "affects",
}

# Valid signal types
SIGNAL_TYPES = {
    "insider_sell", "insider_buy", "filing_drop", "earnings_miss",
    "earnings_beat", "price_spike", "price_drop", "volume_spike",
    "sentiment_shift", "port_congestion", "conflict_escalation",
    "sanctions_hit", "disaster_impact", "airspace_closure",
    "institutional_buy", "institutional_sell", "fred_deterioration",
    "fred_improvement",
}


def init_ontology_db():
    """Create ontology tables if they don't exist."""
    with _get_conn() as conn:
        conn.executescript("""
            -- Entity graph nodes
            CREATE TABLE IF NOT EXISTS entities (
                id              TEXT PRIMARY KEY,
                entity_type     TEXT NOT NULL,
                canonical_name  TEXT NOT NULL,
                attributes      TEXT DEFAULT '{}',
                source          TEXT,
                source_id       TEXT,
                created_at      TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_entities_type
                ON entities (entity_type);
            CREATE INDEX IF NOT EXISTS idx_entities_source_id
                ON entities (source, source_id);
            CREATE INDEX IF NOT EXISTS idx_entities_name
                ON entities (canonical_name COLLATE NOCASE);

            -- Entity aliases for resolution
            CREATE TABLE IF NOT EXISTS entity_aliases (
                id          TEXT PRIMARY KEY,
                entity_id   TEXT NOT NULL REFERENCES entities(id),
                alias       TEXT NOT NULL,
                alias_type  TEXT,
                source      TEXT,
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_aliases_alias
                ON entity_aliases (alias COLLATE NOCASE);
            CREATE INDEX IF NOT EXISTS idx_aliases_type
                ON entity_aliases (alias_type);
            CREATE INDEX IF NOT EXISTS idx_aliases_entity
                ON entity_aliases (entity_id);

            -- Relationship edges
            CREATE TABLE IF NOT EXISTS edges (
                id              TEXT PRIMARY KEY,
                source_id       TEXT NOT NULL REFERENCES entities(id),
                target_id       TEXT NOT NULL REFERENCES entities(id),
                relationship    TEXT NOT NULL,
                attributes      TEXT DEFAULT '{}',
                confidence      REAL DEFAULT 1.0,
                valid_from      TEXT,
                valid_to        TEXT,
                created_at      TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_edges_source
                ON edges (source_id);
            CREATE INDEX IF NOT EXISTS idx_edges_target
                ON edges (target_id);
            CREATE INDEX IF NOT EXISTS idx_edges_rel
                ON edges (relationship);
            CREATE INDEX IF NOT EXISTS idx_edges_dedup
                ON edges (source_id, target_id, relationship, valid_from);

            -- Signal stream for convergence
            CREATE TABLE IF NOT EXISTS signals (
                id          TEXT PRIMARY KEY,
                entity_id   TEXT NOT NULL REFERENCES entities(id),
                signal_type TEXT NOT NULL,
                magnitude   REAL,
                metadata    TEXT DEFAULT '{}',
                occurred_at TEXT NOT NULL,
                ingested_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_signals_entity_time
                ON signals (entity_id, occurred_at);
            CREATE INDEX IF NOT EXISTS idx_signals_type_time
                ON signals (signal_type, occurred_at);
        """)
    logger.info("Ontology tables initialised")


# Auto-init on import
init_ontology_db()
