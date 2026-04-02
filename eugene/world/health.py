"""
Source health tracking — inspired by Crucix's sweep-level health reporting.

Tracks which data sources are up/down, last successful fetch times,
and error rates. Used by convergence engine to weight signal confidence
and by the dashboard to show data freshness.
"""

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


@dataclass
class SourceStatus:
    """Status of a single data source."""
    name: str
    category: str  # disasters, news, sanctions, conflict, supply_chain, flights, economics
    last_success: float | None = None
    last_error: float | None = None
    last_error_msg: str = ""
    success_count: int = 0
    error_count: int = 0
    avg_latency_ms: float = 0
    _latencies: list = field(default_factory=list, repr=False)

    @property
    def is_healthy(self) -> bool:
        if self.last_success is None:
            return False
        if self.last_error and self.last_error > self.last_success:
            return False
        return True

    @property
    def staleness_seconds(self) -> float | None:
        if self.last_success is None:
            return None
        return time.time() - self.last_success

    def record_success(self, latency_ms: float) -> None:
        self.last_success = time.time()
        self.success_count += 1
        self._latencies.append(latency_ms)
        if len(self._latencies) > 20:
            self._latencies = self._latencies[-20:]
        self.avg_latency_ms = sum(self._latencies) / len(self._latencies)

    def record_error(self, error: str) -> None:
        self.last_error = time.time()
        self.last_error_msg = error[:200]
        self.error_count += 1

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "category": self.category,
            "healthy": self.is_healthy,
            "last_success": datetime.fromtimestamp(self.last_success, tz=timezone.utc).isoformat() if self.last_success else None,
            "last_error": datetime.fromtimestamp(self.last_error, tz=timezone.utc).isoformat() if self.last_error else None,
            "last_error_message": self.last_error_msg if self.last_error else None,
            "staleness_seconds": round(self.staleness_seconds) if self.staleness_seconds is not None else None,
            "success_count": self.success_count,
            "error_count": self.error_count,
            "avg_latency_ms": round(self.avg_latency_ms, 1),
            "error_rate": round(self.error_count / max(self.success_count + self.error_count, 1), 3),
        }


class SourceHealthTracker:
    """Global health tracker for all data sources.

    Usage:
        tracker = get_tracker()
        with tracker.track("usgs", "disasters"):
            data = fetch_usgs_data()
    """

    def __init__(self) -> None:
        self._sources: dict[str, SourceStatus] = {}

    def _get_or_create(self, name: str, category: str) -> SourceStatus:
        if name not in self._sources:
            self._sources[name] = SourceStatus(name=name, category=category)
        return self._sources[name]

    def track(self, name: str, category: str):
        """Context manager that tracks success/failure and latency."""
        return _TrackContext(self, name, category)

    def record_success(self, name: str, category: str, latency_ms: float) -> None:
        self._get_or_create(name, category).record_success(latency_ms)

    def record_error(self, name: str, category: str, error: str) -> None:
        self._get_or_create(name, category).record_error(error)

    def get_status(self, category: str | None = None) -> dict:
        """Get health status for all sources or a specific category."""
        sources = self._sources.values()
        if category:
            sources = [s for s in sources if s.category == category]

        statuses = [s.to_dict() for s in sources]
        healthy = sum(1 for s in statuses if s["healthy"])
        total = len(statuses)

        return {
            "sources": statuses,
            "summary": {
                "total": total,
                "healthy": healthy,
                "degraded": total - healthy,
                "health_pct": round(healthy / max(total, 1) * 100, 1),
            },
        }

    def get_signals(self) -> list[str]:
        """Extract health-related signals for convergence engine."""
        signals = []
        degraded = [s for s in self._sources.values() if not s.is_healthy]
        if len(degraded) >= 3:
            signals.append(f"{len(degraded)}_sources_degraded")
        for s in degraded:
            if s.error_count >= 5:
                signals.append(f"{s.name}_persistent_failure")
        return signals


class _TrackContext:
    def __init__(self, tracker: SourceHealthTracker, name: str, category: str):
        self.tracker = tracker
        self.name = name
        self.category = category
        self.start = 0.0

    def __enter__(self):
        self.start = time.time()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        elapsed_ms = (time.time() - self.start) * 1000
        if exc_type is None:
            self.tracker.record_success(self.name, self.category, elapsed_ms)
        else:
            self.tracker.record_error(self.name, self.category, str(exc_val))
        return False  # don't suppress exceptions


# Singleton instance
_tracker: SourceHealthTracker | None = None


def get_tracker() -> SourceHealthTracker:
    """Get the global source health tracker."""
    global _tracker
    if _tracker is None:
        _tracker = SourceHealthTracker()
    return _tracker
