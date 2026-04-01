"""
World Intelligence — Convergence Engine.

Cross-signal scoring across all data streams: SEC filings, news sentiment,
sanctions, disasters, conflict, and economic indicators. Detects when multiple
independent signals converge on the same entity or region within a time window.

This is the core differentiator — individual signals are available elsewhere;
convergence is the product.
"""

import logging
from datetime import datetime, timedelta

from eugene.db import _get_conn

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Convergence patterns — weighted signal co-occurrence templates
# ---------------------------------------------------------------------------

CONVERGENCE_PATTERNS = {
    "earnings_risk": {
        "description": "Insider selling cluster + earnings filing + sector deterioration",
        "required_signals": ["insider_sell", "filing_drop"],
        "boost_signals": ["fred_deterioration", "sentiment_shift", "price_drop"],
        "base_weight": 0.8,
    },
    "supply_chain_disruption": {
        "description": "Port congestion + conflict escalation + commodity price spike",
        "required_signals": ["port_congestion"],
        "boost_signals": ["conflict_escalation", "disaster_impact", "price_spike"],
        "base_weight": 0.7,
    },
    "geopolitical_escalation": {
        "description": "Military movement + airspace closure + sanctions announcement",
        "required_signals": ["conflict_escalation"],
        "boost_signals": ["airspace_closure", "sanctions_hit", "sentiment_shift"],
        "base_weight": 0.9,
    },
    "operational_risk": {
        "description": "Natural disaster + facility in affected zone + company exposure",
        "required_signals": ["disaster_impact"],
        "boost_signals": ["price_drop", "volume_spike", "sentiment_shift"],
        "base_weight": 0.6,
    },
    "sentiment_divergence": {
        "description": "News sentiment shift + institutional holdings change + insider activity",
        "required_signals": ["sentiment_shift"],
        "boost_signals": ["institutional_buy", "institutional_sell", "insider_buy", "insider_sell"],
        "base_weight": 0.5,
    },
}


def _parse_window(window: str) -> str:
    """Parse time window string to ISO datetime cutoff."""
    now = datetime.utcnow()
    if window.endswith("h"):
        cutoff = now - timedelta(hours=int(window[:-1]))
    elif window.endswith("d"):
        cutoff = now - timedelta(days=int(window[:-1]))
    elif window.endswith("m"):
        cutoff = now - timedelta(minutes=int(window[:-1]))
    else:
        cutoff = now - timedelta(days=7)
    return cutoff.isoformat()


# ---------------------------------------------------------------------------
# Cross-signal alerts
# ---------------------------------------------------------------------------

def get_alerts(
    time_window: str = "24h",
    min_signal_types: int = 2,
    entity_type: str | None = None,
    limit: int = 20,
) -> dict:
    """Get convergence alerts — entities with multiple co-occurring signal types.

    This is the primary convergence query. It finds entities where independent
    signal streams are firing simultaneously, indicating elevated risk or opportunity.

    Args:
        time_window: Aggregation window (1h, 24h, 7d)
        min_signal_types: Minimum distinct signal types for an alert
        entity_type: Filter to specific entity type
        limit: Max alerts

    Returns:
        Ranked alerts with composite risk scores and pattern matches
    """
    cutoff = _parse_window(time_window)

    with _get_conn() as conn:
        type_filter = ""
        params: list = [cutoff]
        if entity_type:
            type_filter = "AND e.entity_type = ?"
            params.append(entity_type)

        rows = conn.execute(
            f"""SELECT
                    s.entity_id,
                    e.canonical_name,
                    e.entity_type,
                    COUNT(DISTINCT s.signal_type) as signal_type_count,
                    COUNT(*) as total_signals,
                    AVG(s.magnitude) as avg_magnitude,
                    MAX(s.magnitude) as max_magnitude,
                    MIN(s.occurred_at) as first_signal,
                    MAX(s.occurred_at) as last_signal,
                    GROUP_CONCAT(DISTINCT s.signal_type) as signal_types
                FROM signals s
                JOIN entities e ON e.id = s.entity_id
                WHERE s.occurred_at >= ? {type_filter}
                GROUP BY s.entity_id
                HAVING COUNT(DISTINCT s.signal_type) >= ?
                ORDER BY COUNT(DISTINCT s.signal_type) DESC, MAX(s.magnitude) DESC
                LIMIT ?""",
            [*params, min_signal_types, limit],
        ).fetchall()

        alerts = []
        for r in rows:
            signal_types = r["signal_types"].split(",") if r["signal_types"] else []

            # Match against convergence patterns
            matched_patterns = _match_patterns(signal_types)

            # Composite risk: diversity * 0.4 + magnitude * 0.3 + pattern_boost * 0.3
            type_count = r["signal_type_count"]
            avg_mag = r["avg_magnitude"] or 0
            pattern_boost = max((p["score"] for p in matched_patterns), default=0)
            composite_risk = min(1.0, (type_count / 5.0) * 0.4 + avg_mag * 0.3 + pattern_boost * 0.3)

            # Risk level
            if composite_risk >= 0.8:
                risk_level = "critical"
            elif composite_risk >= 0.6:
                risk_level = "high"
            elif composite_risk >= 0.4:
                risk_level = "elevated"
            else:
                risk_level = "moderate"

            # Signal breakdown
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

            alerts.append({
                "entity_id": r["entity_id"],
                "entity_name": r["canonical_name"],
                "entity_type": r["entity_type"],
                "composite_risk": round(composite_risk, 3),
                "risk_level": risk_level,
                "signal_type_count": type_count,
                "total_signals": r["total_signals"],
                "avg_magnitude": round(avg_mag, 4),
                "max_magnitude": round(r["max_magnitude"] or 0, 4),
                "signal_types": signal_types,
                "first_signal": r["first_signal"],
                "last_signal": r["last_signal"],
                "matched_patterns": matched_patterns,
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

    # Sort by composite risk descending
    alerts.sort(key=lambda a: a["composite_risk"], reverse=True)

    return {
        "time_window": time_window,
        "min_signal_types": min_signal_types,
        "alerts": alerts,
        "total_alerts": len(alerts),
        "patterns_checked": list(CONVERGENCE_PATTERNS.keys()),
    }


def _match_patterns(signal_types: list[str]) -> list[dict]:
    """Match observed signal types against known convergence patterns."""
    matches = []
    signal_set = set(signal_types)

    for name, pattern in CONVERGENCE_PATTERNS.items():
        required = set(pattern["required_signals"])
        boost = set(pattern["boost_signals"])

        # Check if required signals are present
        required_match = required & signal_set
        if not required_match:
            continue

        boost_match = boost & signal_set
        required_ratio = len(required_match) / len(required)
        boost_ratio = len(boost_match) / len(boost) if boost else 0

        # Score: full required match + partial boost
        score = required_ratio * pattern["base_weight"] + boost_ratio * (1 - pattern["base_weight"])

        if score > 0.3:
            matches.append({
                "pattern": name,
                "description": pattern["description"],
                "score": round(score, 3),
                "matched_required": list(required_match),
                "matched_boost": list(boost_match),
            })

    matches.sort(key=lambda m: m["score"], reverse=True)
    return matches


# ---------------------------------------------------------------------------
# Entity signal aggregation
# ---------------------------------------------------------------------------

def get_entity_signals(
    entity_id: str,
    time_window: str = "7d",
) -> dict:
    """Get aggregated cross-stream signals for an entity.

    Returns signals grouped by type with trend analysis.
    """
    cutoff = _parse_window(time_window)

    with _get_conn() as conn:
        entity = conn.execute(
            "SELECT id, canonical_name, entity_type FROM entities WHERE id = ?",
            (entity_id,),
        ).fetchone()
        if not entity:
            return {"error": "Entity not found"}

        # All signals in window
        signals = conn.execute(
            """SELECT signal_type, magnitude, occurred_at, metadata
               FROM signals
               WHERE entity_id = ? AND occurred_at >= ?
               ORDER BY occurred_at DESC""",
            (entity_id, cutoff),
        ).fetchall()

        # Group by type
        by_type: dict[str, list] = {}
        for s in signals:
            st = s["signal_type"]
            if st not in by_type:
                by_type[st] = []
            by_type[st].append({
                "magnitude": s["magnitude"],
                "occurred_at": s["occurred_at"],
            })

        # Build type summaries with trend
        type_summaries = []
        for st, events in by_type.items():
            magnitudes = [e["magnitude"] for e in events if e["magnitude"] is not None]
            avg_mag = sum(magnitudes) / len(magnitudes) if magnitudes else 0

            # Trend: compare first half vs second half
            if len(magnitudes) >= 2:
                mid = len(magnitudes) // 2
                recent = magnitudes[:mid]
                older = magnitudes[mid:]
                recent_avg = sum(recent) / len(recent)
                older_avg = sum(older) / len(older)
                if older_avg > 0:
                    trend_pct = ((recent_avg - older_avg) / older_avg) * 100
                else:
                    trend_pct = 0
                trend = "increasing" if trend_pct > 10 else "decreasing" if trend_pct < -10 else "stable"
            else:
                trend = "insufficient_data"
                trend_pct = 0

            type_summaries.append({
                "signal_type": st,
                "count": len(events),
                "avg_magnitude": round(avg_mag, 4),
                "max_magnitude": round(max(magnitudes), 4) if magnitudes else 0,
                "trend": trend,
                "trend_pct": round(trend_pct, 1),
                "latest": events[0]["occurred_at"] if events else None,
            })

        type_summaries.sort(key=lambda t: t["count"], reverse=True)

        # Pattern matching on this entity's signals
        all_types = list(by_type.keys())
        patterns = _match_patterns(all_types)

        # Composite risk
        type_count = len(all_types)
        all_mags = [e["magnitude"] for s in signals for e in [s] if s["magnitude"] is not None]
        avg_all = sum(all_mags) / len(all_mags) if all_mags else 0
        pattern_boost = max((p["score"] for p in patterns), default=0)
        composite = min(1.0, (type_count / 5.0) * 0.4 + avg_all * 0.3 + pattern_boost * 0.3)

    return {
        "entity_id": entity_id,
        "entity_name": entity["canonical_name"],
        "entity_type": entity["entity_type"],
        "time_window": time_window,
        "total_signals": len(signals),
        "signal_types": len(by_type),
        "composite_risk": round(composite, 3),
        "type_summaries": type_summaries,
        "matched_patterns": patterns,
    }


# ---------------------------------------------------------------------------
# Composite risk scoring
# ---------------------------------------------------------------------------

def get_composite_risk(
    entity_id: str | None = None,
    entity_type: str | None = None,
    time_window: str = "24h",
    limit: int = 20,
) -> dict:
    """Get composite risk scores across entities.

    Calculates weighted risk from signal diversity, magnitude, frequency,
    and pattern matching. Returns a ranked risk leaderboard.

    Args:
        entity_id: Optional single entity
        entity_type: Filter by type
        time_window: Risk window
        limit: Max entities

    Returns:
        Ranked list of entities by composite risk
    """
    cutoff = _parse_window(time_window)

    with _get_conn() as conn:
        conditions = ["s.occurred_at >= ?"]
        params: list = [cutoff]

        if entity_id:
            conditions.append("s.entity_id = ?")
            params.append(entity_id)
        if entity_type:
            conditions.append("e.entity_type = ?")
            params.append(entity_type)

        where = " AND ".join(conditions)

        rows = conn.execute(
            f"""SELECT
                    s.entity_id,
                    e.canonical_name,
                    e.entity_type,
                    COUNT(DISTINCT s.signal_type) as type_count,
                    COUNT(*) as total_signals,
                    AVG(s.magnitude) as avg_mag,
                    MAX(s.magnitude) as max_mag,
                    GROUP_CONCAT(DISTINCT s.signal_type) as signal_types
                FROM signals s
                JOIN entities e ON e.id = s.entity_id
                WHERE {where}
                GROUP BY s.entity_id
                ORDER BY COUNT(DISTINCT s.signal_type) DESC, AVG(s.magnitude) DESC
                LIMIT ?""",
            [*params, limit],
        ).fetchall()

    entities = []
    for r in rows:
        signal_types = r["signal_types"].split(",") if r["signal_types"] else []
        patterns = _match_patterns(signal_types)

        type_count = r["type_count"]
        avg_mag = r["avg_mag"] or 0
        max_mag = r["max_mag"] or 0
        pattern_boost = max((p["score"] for p in patterns), default=0)

        # Multi-factor composite risk
        diversity_score = min(1.0, type_count / 5.0)
        magnitude_score = avg_mag
        frequency_score = min(1.0, r["total_signals"] / 20.0)
        composite = (
            diversity_score * 0.35
            + magnitude_score * 0.25
            + frequency_score * 0.15
            + pattern_boost * 0.25
        )
        composite = min(1.0, composite)

        if composite >= 0.8:
            risk_level = "critical"
        elif composite >= 0.6:
            risk_level = "high"
        elif composite >= 0.4:
            risk_level = "elevated"
        elif composite >= 0.2:
            risk_level = "moderate"
        else:
            risk_level = "low"

        entities.append({
            "entity_id": r["entity_id"],
            "entity_name": r["canonical_name"],
            "entity_type": r["entity_type"],
            "composite_risk": round(composite, 3),
            "risk_level": risk_level,
            "factors": {
                "diversity": round(diversity_score, 3),
                "magnitude": round(magnitude_score, 3),
                "frequency": round(frequency_score, 3),
                "pattern_match": round(pattern_boost, 3),
            },
            "signal_type_count": type_count,
            "total_signals": r["total_signals"],
            "avg_magnitude": round(avg_mag, 4),
            "max_magnitude": round(max_mag, 4),
            "signal_types": signal_types,
            "matched_patterns": [p["pattern"] for p in patterns],
        })

    entities.sort(key=lambda e: e["composite_risk"], reverse=True)

    return {
        "time_window": time_window,
        "entities": entities,
        "total": len(entities),
    }


# ---------------------------------------------------------------------------
# Dashboard summary
# ---------------------------------------------------------------------------

def get_dashboard_summary(time_window: str = "24h") -> dict:
    """Get a complete intelligence dashboard summary.

    Aggregates data from all signal streams into a single overview
    suitable for rendering a multi-panel dashboard.

    Returns:
        Combined summary with signal stats, top alerts, and source status
    """
    cutoff = _parse_window(time_window)

    with _get_conn() as conn:
        # Signal stats
        total_signals = conn.execute(
            "SELECT COUNT(*) FROM signals WHERE occurred_at >= ?", (cutoff,)
        ).fetchone()[0]

        signal_by_type = conn.execute(
            """SELECT signal_type, COUNT(*) as cnt, AVG(magnitude) as avg_mag
               FROM signals WHERE occurred_at >= ?
               GROUP BY signal_type ORDER BY cnt DESC""",
            (cutoff,),
        ).fetchall()

        # Entity stats
        total_entities = conn.execute("SELECT COUNT(*) FROM entities").fetchone()[0]
        entity_by_type = conn.execute(
            "SELECT entity_type, COUNT(*) as cnt FROM entities GROUP BY entity_type ORDER BY cnt DESC"
        ).fetchall()

        # Entities with signals in window
        active_entities = conn.execute(
            "SELECT COUNT(DISTINCT entity_id) FROM signals WHERE occurred_at >= ?",
            (cutoff,),
        ).fetchone()[0]

        # Recent signals timeline (hourly buckets for last 24h)
        timeline = conn.execute(
            """SELECT
                    strftime('%Y-%m-%dT%H:00:00', occurred_at) as hour,
                    COUNT(*) as count,
                    AVG(magnitude) as avg_magnitude
               FROM signals
               WHERE occurred_at >= ?
               GROUP BY hour
               ORDER BY hour ASC""",
            (cutoff,),
        ).fetchall()

    # Top alerts (reuse convergence query)
    alerts = get_alerts(time_window=time_window, min_signal_types=2, limit=5)

    # Risk distribution
    risk_dist = {"critical": 0, "high": 0, "elevated": 0, "moderate": 0, "low": 0}
    risk_data = get_composite_risk(time_window=time_window, limit=100)
    for e in risk_data.get("entities", []):
        level = e.get("risk_level", "low")
        if level in risk_dist:
            risk_dist[level] += 1

    return {
        "time_window": time_window,
        "overview": {
            "total_entities": total_entities,
            "active_entities": active_entities,
            "total_signals": total_signals,
            "signal_types_active": len(signal_by_type),
            "convergence_alerts": alerts.get("total_alerts", 0),
        },
        "signal_breakdown": [
            {
                "signal_type": s["signal_type"],
                "count": s["cnt"],
                "avg_magnitude": round(s["avg_mag"], 4) if s["avg_mag"] else 0,
            }
            for s in signal_by_type
        ],
        "entity_breakdown": [
            {"entity_type": e["entity_type"], "count": e["cnt"]}
            for e in entity_by_type
        ],
        "risk_distribution": risk_dist,
        "top_alerts": alerts.get("alerts", [])[:5],
        "signal_timeline": [
            {
                "hour": t["hour"],
                "count": t["count"],
                "avg_magnitude": round(t["avg_magnitude"], 4) if t["avg_magnitude"] else 0,
            }
            for t in timeline
        ],
    }
