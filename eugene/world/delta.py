"""
Delta engine — threshold-based change detection between signal sweeps.

Inspired by Crucix's delta computation pattern. Compares the current state
of Eugene's signal streams against the previous sweep to detect meaningful
changes. Used by the convergence engine and alerting system.

The delta engine answers: "What changed since we last looked?"
"""

import hashlib
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta

from eugene.db import _get_conn

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Threshold configuration
# ---------------------------------------------------------------------------

# Numeric metrics tracked across sweeps (signal_type → threshold % change)
NUMERIC_THRESHOLDS = {
    "disaster_event": 20,       # magnitude change on disaster signals
    "conflict_event": 15,       # conflict intensity
    "port_congestion": 10,      # supply chain stress
    "price_drop": 5,            # market moves
    "price_spike": 5,
    "volume_spike": 15,
    "fred_deterioration": 10,   # economic indicators
    "sentiment_shift": 10,
}

# Count metrics — absolute change thresholds
COUNT_THRESHOLDS = {
    "disaster_event": 3,
    "conflict_event": 5,
    "news_sentiment": 10,
    "sanctions_hit": 1,
    "insider_sell": 2,
    "insider_buy": 2,
    "port_congestion": 2,
    "airspace_closure": 1,
}

# Risk keys used to determine overall direction
RISK_KEYS = [
    "disaster_event", "conflict_event", "sanctions_hit",
    "port_congestion", "sentiment_shift", "price_drop",
]


@dataclass
class DeltaSignal:
    """A detected change between sweeps."""
    signal_type: str
    metric: str          # "count", "avg_magnitude", "max_magnitude"
    previous: float
    current: float
    change: float        # absolute change
    change_pct: float    # percentage change
    severity: str        # "critical", "high", "moderate"
    direction: str       # "up" or "down"

    def to_dict(self) -> dict:
        return {
            "signal_type": self.signal_type,
            "metric": self.metric,
            "previous": round(self.previous, 4),
            "current": round(self.current, 4),
            "change": round(self.change, 4),
            "change_pct": round(self.change_pct, 2),
            "severity": self.severity,
            "direction": self.direction,
        }


@dataclass
class SweepSnapshot:
    """Snapshot of signal state at a point in time."""
    timestamp: str
    signal_counts: dict[str, int] = field(default_factory=dict)
    avg_magnitudes: dict[str, float] = field(default_factory=dict)
    max_magnitudes: dict[str, float] = field(default_factory=dict)
    entity_signals: dict[str, list[str]] = field(default_factory=dict)  # entity_id → signal_types
    raw_signal_hashes: set[str] = field(default_factory=set)

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "signal_counts": self.signal_counts,
            "avg_magnitudes": {k: round(v, 4) for k, v in self.avg_magnitudes.items()},
            "max_magnitudes": {k: round(v, 4) for k, v in self.max_magnitudes.items()},
            "entity_count": len(self.entity_signals),
            "total_signals": sum(self.signal_counts.values()),
        }


# ---------------------------------------------------------------------------
# Sweep state capture
# ---------------------------------------------------------------------------

def capture_snapshot(window: str = "1h") -> SweepSnapshot:
    """Capture current signal state as a snapshot.

    Queries the signals table for all signals within the given window
    and aggregates counts, magnitudes, and entity mappings.
    """
    now = datetime.now(timezone.utc)
    if window.endswith("h"):
        cutoff = now - timedelta(hours=int(window[:-1]))
    elif window.endswith("d"):
        cutoff = now - timedelta(days=int(window[:-1]))
    elif window.endswith("m"):
        cutoff = now - timedelta(minutes=int(window[:-1]))
    else:
        cutoff = now - timedelta(hours=1)

    cutoff_iso = cutoff.isoformat()
    snap = SweepSnapshot(timestamp=now.isoformat())

    with _get_conn() as conn:
        # Aggregate by signal type
        rows = conn.execute(
            """SELECT signal_type,
                      COUNT(*) as cnt,
                      AVG(magnitude) as avg_mag,
                      MAX(magnitude) as max_mag
               FROM signals
               WHERE occurred_at >= ?
               GROUP BY signal_type""",
            (cutoff_iso,),
        ).fetchall()

        for r in rows:
            st = r["signal_type"]
            snap.signal_counts[st] = r["cnt"]
            snap.avg_magnitudes[st] = r["avg_mag"] or 0
            snap.max_magnitudes[st] = r["max_mag"] or 0

        # Entity → signal type mapping
        entity_rows = conn.execute(
            """SELECT entity_id, GROUP_CONCAT(DISTINCT signal_type) as types
               FROM signals
               WHERE occurred_at >= ?
               GROUP BY entity_id""",
            (cutoff_iso,),
        ).fetchall()

        for r in entity_rows:
            snap.entity_signals[r["entity_id"]] = (
                r["types"].split(",") if r["types"] else []
            )

        # Signal content hashes for dedup
        detail_rows = conn.execute(
            """SELECT id, signal_type, entity_id, magnitude, occurred_at
               FROM signals
               WHERE occurred_at >= ?""",
            (cutoff_iso,),
        ).fetchall()

        for r in detail_rows:
            content = f"{r['signal_type']}:{r['entity_id']}:{r['occurred_at']}"
            snap.raw_signal_hashes.add(
                hashlib.sha256(content.encode()).hexdigest()[:16]
            )

    return snap


# ---------------------------------------------------------------------------
# Delta computation
# ---------------------------------------------------------------------------

def compute_delta(
    current: SweepSnapshot,
    previous: SweepSnapshot | None,
) -> dict:
    """Compute meaningful changes between two sweep snapshots.

    Returns categorized signals: new, escalated, de-escalated, unchanged.
    Also computes overall risk direction.
    """
    if previous is None:
        # First sweep — everything is new
        return {
            "timestamp": current.timestamp,
            "previous_timestamp": None,
            "is_first_sweep": True,
            "signals": {
                "new": [
                    {
                        "signal_type": st,
                        "count": cnt,
                        "avg_magnitude": round(current.avg_magnitudes.get(st, 0), 4),
                    }
                    for st, cnt in current.signal_counts.items()
                ],
                "escalated": [],
                "deescalated": [],
                "unchanged": [],
            },
            "summary": {
                "total_changes": len(current.signal_counts),
                "critical_changes": 0,
                "direction": "unknown",
                "new_entities": len(current.entity_signals),
            },
        }

    new_signals = []
    escalated = []
    deescalated = []
    unchanged = []

    all_types = set(current.signal_counts.keys()) | set(previous.signal_counts.keys())

    for st in all_types:
        curr_count = current.signal_counts.get(st, 0)
        prev_count = previous.signal_counts.get(st, 0)
        curr_avg = current.avg_magnitudes.get(st, 0)
        prev_avg = previous.avg_magnitudes.get(st, 0)
        curr_max = current.max_magnitudes.get(st, 0)
        prev_max = previous.max_magnitudes.get(st, 0)

        # New signal type (wasn't in previous sweep)
        if prev_count == 0 and curr_count > 0:
            new_signals.append({
                "signal_type": st,
                "count": curr_count,
                "avg_magnitude": round(curr_avg, 4),
                "max_magnitude": round(curr_max, 4),
            })
            continue

        # Disappeared signal type
        if curr_count == 0 and prev_count > 0:
            deescalated.append(DeltaSignal(
                signal_type=st, metric="count",
                previous=prev_count, current=0,
                change=-prev_count, change_pct=-100,
                severity="moderate", direction="down",
            ).to_dict())
            continue

        changes = []

        # Count delta
        count_threshold = COUNT_THRESHOLDS.get(st, 5)
        count_change = curr_count - prev_count
        if abs(count_change) >= count_threshold:
            count_pct = (count_change / max(prev_count, 1)) * 100
            severity = _classify_severity(abs(count_pct), count_threshold * 3, count_threshold * 2)
            changes.append(DeltaSignal(
                signal_type=st, metric="count",
                previous=prev_count, current=curr_count,
                change=count_change, change_pct=count_pct,
                severity=severity,
                direction="up" if count_change > 0 else "down",
            ))

        # Magnitude delta
        mag_threshold = NUMERIC_THRESHOLDS.get(st, 15)
        if prev_avg > 0:
            mag_pct = ((curr_avg - prev_avg) / prev_avg) * 100
            if abs(mag_pct) >= mag_threshold:
                severity = _classify_severity(abs(mag_pct), mag_threshold * 3, mag_threshold * 2)
                changes.append(DeltaSignal(
                    signal_type=st, metric="avg_magnitude",
                    previous=prev_avg, current=curr_avg,
                    change=curr_avg - prev_avg, change_pct=mag_pct,
                    severity=severity,
                    direction="up" if mag_pct > 0 else "down",
                ))

        if changes:
            # Determine net direction for this signal type
            ups = sum(1 for c in changes if c.direction == "up")
            downs = sum(1 for c in changes if c.direction == "down")
            if ups > downs:
                escalated.extend(c.to_dict() for c in changes)
            else:
                deescalated.extend(c.to_dict() for c in changes)
        else:
            unchanged.append({"signal_type": st, "count": curr_count})

    # New entity detection
    prev_entities = set(previous.entity_signals.keys())
    curr_entities = set(current.entity_signals.keys())
    new_entities = curr_entities - prev_entities

    # New signal hashes (signals not seen in previous sweep)
    new_hashes = current.raw_signal_hashes - previous.raw_signal_hashes

    # Overall direction from risk keys
    risk_up = 0
    risk_down = 0
    for sig in escalated:
        if sig["signal_type"] in RISK_KEYS:
            risk_up += 1
    for sig in deescalated:
        if sig["signal_type"] in RISK_KEYS:
            risk_down += 1

    if risk_up > risk_down + 1:
        direction = "risk-off"  # situation getting worse
    elif risk_down > risk_up + 1:
        direction = "risk-on"   # situation improving
    else:
        direction = "mixed"

    critical_count = sum(
        1 for s in escalated + deescalated
        if s.get("severity") == "critical"
    )

    return {
        "timestamp": current.timestamp,
        "previous_timestamp": previous.timestamp,
        "is_first_sweep": False,
        "signals": {
            "new": new_signals,
            "escalated": escalated,
            "deescalated": deescalated,
            "unchanged": unchanged,
        },
        "summary": {
            "total_changes": len(new_signals) + len(escalated) + len(deescalated),
            "critical_changes": critical_count,
            "direction": direction,
            "new_entities": len(new_entities),
            "new_signals": len(new_hashes),
        },
    }


def _classify_severity(value: float, critical_threshold: float, high_threshold: float) -> str:
    """Classify change severity based on threshold multiples."""
    if value >= critical_threshold:
        return "critical"
    elif value >= high_threshold:
        return "high"
    return "moderate"


# ---------------------------------------------------------------------------
# Sweep history (in-memory, last 3 runs like Crucix hot memory)
# ---------------------------------------------------------------------------

_sweep_history: list[SweepSnapshot] = []
_MAX_HOT_SWEEPS = 3


def run_sweep(window: str = "1h") -> dict:
    """Run a delta sweep: capture current state, compare to previous, store result.

    This is the main entry point called by workers or on-demand.
    """
    current = capture_snapshot(window)

    previous = _sweep_history[-1] if _sweep_history else None
    delta = compute_delta(current, previous)

    # Store in hot memory (last 3)
    _sweep_history.append(current)
    if len(_sweep_history) > _MAX_HOT_SWEEPS:
        _sweep_history.pop(0)

    return delta


def get_sweep_history() -> list[dict]:
    """Get the hot sweep history (last 3 snapshots)."""
    return [s.to_dict() for s in _sweep_history]


def get_last_delta(window: str = "1h") -> dict:
    """Get the most recent delta without running a new sweep."""
    if len(_sweep_history) < 2:
        return run_sweep(window)

    return compute_delta(_sweep_history[-1], _sweep_history[-2])
