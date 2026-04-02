"""
Signal recording and convergence detection.

Signals are normalized events (entity_id, signal_type, magnitude, timestamp)
that feed the convergence engine. The convergence engine detects when multiple
independent signal types co-occur on the same entity within a time window.
"""

import json
import logging
import uuid
from datetime import datetime, timedelta

from eugene.db import _get_conn

logger = logging.getLogger(__name__)


def _new_id() -> str:
    return str(uuid.uuid4())


def record_signal(
    entity_id: str,
    signal_type: str,
    magnitude: float,
    metadata: dict | None = None,
    occurred_at: str | None = None,
) -> dict:
    """Record a signal event for an entity.

    Args:
        entity_id: Entity UUID
        signal_type: Type from SIGNAL_TYPES
        magnitude: Signal strength (0.0-1.0 normalized)
        metadata: Additional context
        occurred_at: When the signal occurred (default: now)

    Returns:
        Created signal dict
    """
    signal_id = _new_id()
    occurred = occurred_at or datetime.utcnow().isoformat()
    meta_json = json.dumps(metadata or {})

    with _get_conn() as conn:
        conn.execute(
            """INSERT INTO signals (id, entity_id, signal_type, magnitude, metadata, occurred_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (signal_id, entity_id, signal_type, magnitude, meta_json, occurred),
        )

    return {
        "id": signal_id,
        "entity_id": entity_id,
        "signal_type": signal_type,
        "magnitude": magnitude,
        "occurred_at": occurred,
    }


def get_entity_signals(
    entity_id: str,
    signal_type: str | None = None,
    time_window: str = "7d",
    limit: int = 50,
) -> dict:
    """Get recent signals for an entity.

    Args:
        entity_id: Entity UUID
        signal_type: Filter by signal type
        time_window: Time window ('1h', '24h', '7d', '30d')
        limit: Max signals

    Returns:
        Dict with signals list and summary
    """
    cutoff = _parse_window(time_window)

    with _get_conn() as conn:
        conditions = ["entity_id = ?", "occurred_at >= ?"]
        params: list = [entity_id, cutoff]

        if signal_type:
            conditions.append("signal_type = ?")
            params.append(signal_type)

        where = " AND ".join(conditions)

        rows = conn.execute(
            f"""SELECT * FROM signals
                WHERE {where}
                ORDER BY occurred_at DESC
                LIMIT ?""",
            [*params, limit],
        ).fetchall()

        # Summary stats
        summary = conn.execute(
            f"""SELECT signal_type, COUNT(*) as count, AVG(magnitude) as avg_magnitude,
                       MAX(magnitude) as max_magnitude
                FROM signals
                WHERE {where}
                GROUP BY signal_type""",
            params,
        ).fetchall()

    signals = []
    for r in rows:
        d = dict(r)
        if isinstance(d.get("metadata"), str):
            try:
                d["metadata"] = json.loads(d["metadata"])
            except (json.JSONDecodeError, TypeError):
                d["metadata"] = {}
        signals.append(d)

    return {
        "entity_id": entity_id,
        "time_window": time_window,
        "signals": signals,
        "summary": [
            {
                "signal_type": s["signal_type"],
                "count": s["count"],
                "avg_magnitude": round(s["avg_magnitude"], 4) if s["avg_magnitude"] else 0,
                "max_magnitude": round(s["max_magnitude"], 4) if s["max_magnitude"] else 0,
            }
            for s in summary
        ],
        "total_signals": len(signals),
    }


def get_convergence(
    entity_id: str | None = None,
    time_window: str = "24h",
    min_signal_types: int = 2,
    limit: int = 20,
) -> dict:
    """Detect signal convergence — multiple signal types on the same entity.

    This is the core convergence engine query. It finds entities where
    multiple independent signal types co-occur within the time window.

    Args:
        entity_id: Optional filter to a specific entity
        time_window: Aggregation window
        min_signal_types: Minimum distinct signal types for convergence
        limit: Max entities to return

    Returns:
        Dict with convergence alerts
    """
    cutoff = _parse_window(time_window)

    with _get_conn() as conn:
        entity_filter = ""
        params: list = [cutoff]
        if entity_id:
            entity_filter = "AND s.entity_id = ?"
            params.append(entity_id)

        # Find entities with multiple signal types in window
        rows = conn.execute(
            f"""SELECT
                    s.entity_id,
                    e.canonical_name,
                    e.entity_type,
                    COUNT(DISTINCT s.signal_type) as signal_type_count,
                    COUNT(*) as total_signals,
                    AVG(s.magnitude) as avg_magnitude,
                    MAX(s.magnitude) as max_magnitude,
                    GROUP_CONCAT(DISTINCT s.signal_type) as signal_types
                FROM signals s
                JOIN entities e ON e.id = s.entity_id
                WHERE s.occurred_at >= ? {entity_filter}
                GROUP BY s.entity_id
                HAVING COUNT(DISTINCT s.signal_type) >= ?
                ORDER BY COUNT(DISTINCT s.signal_type) DESC, AVG(s.magnitude) DESC
                LIMIT ?""",
            [*params, min_signal_types, limit],
        ).fetchall()

        alerts = []
        for r in rows:
            # Get signal breakdown for each entity
            breakdown = conn.execute(
                """SELECT signal_type, COUNT(*) as count,
                          AVG(magnitude) as avg_mag, MAX(magnitude) as max_mag,
                          MIN(occurred_at) as first_seen, MAX(occurred_at) as last_seen
                   FROM signals
                   WHERE entity_id = ? AND occurred_at >= ?
                   GROUP BY signal_type
                   ORDER BY MAX(magnitude) DESC""",
                (r["entity_id"], cutoff),
            ).fetchall()

            # Calculate composite risk score
            # Weighted by signal diversity and magnitude
            type_count = r["signal_type_count"]
            avg_mag = r["avg_magnitude"] or 0
            composite_risk = min(1.0, (type_count / 5.0) * 0.6 + avg_mag * 0.4)

            alerts.append({
                "entity_id": r["entity_id"],
                "entity_name": r["canonical_name"],
                "entity_type": r["entity_type"],
                "signal_type_count": type_count,
                "total_signals": r["total_signals"],
                "composite_risk": round(composite_risk, 3),
                "avg_magnitude": round(avg_mag, 4),
                "max_magnitude": round(r["max_magnitude"] or 0, 4),
                "signal_types": r["signal_types"].split(",") if r["signal_types"] else [],
                "breakdown": [
                    {
                        "signal_type": b["signal_type"],
                        "count": b["count"],
                        "avg_magnitude": round(b["avg_mag"], 4) if b["avg_mag"] else 0,
                        "max_magnitude": round(b["max_mag"], 4) if b["max_mag"] else 0,
                        "first_seen": b["first_seen"],
                        "last_seen": b["last_seen"],
                    }
                    for b in breakdown
                ],
            })

    return {
        "time_window": time_window,
        "min_signal_types": min_signal_types,
        "alerts": alerts,
        "total_alerts": len(alerts),
    }


def cleanup_signals(days: int = 90) -> int:
    """Delete signals older than the given number of days.

    Used by the weekly cleanup worker task to prevent unbounded growth.

    Args:
        days: Delete signals older than this many days

    Returns:
        Number of signals deleted
    """
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()

    with _get_conn() as conn:
        # Count first
        row = conn.execute(
            "SELECT COUNT(*) FROM signals WHERE occurred_at < ?", (cutoff,)
        ).fetchone()
        count = row[0]

        if count > 0:
            conn.execute("DELETE FROM signals WHERE occurred_at < ?", (cutoff,))
            logger.info("Cleaned up %d signals older than %d days", count, days)

    return count


def _parse_window(window: str) -> str:
    """Parse time window string to ISO datetime cutoff."""
    now = datetime.utcnow()
    if window.endswith("h"):
        hours = int(window[:-1])
        cutoff = now - timedelta(hours=hours)
    elif window.endswith("d"):
        days = int(window[:-1])
        cutoff = now - timedelta(days=days)
    elif window.endswith("m"):
        minutes = int(window[:-1])
        cutoff = now - timedelta(minutes=minutes)
    else:
        cutoff = now - timedelta(days=7)  # Default 7 days
    return cutoff.isoformat()
