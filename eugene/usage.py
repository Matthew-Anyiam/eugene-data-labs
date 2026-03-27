"""Per-API-key usage tracking and rate limiting with response headers.

Tracks request counts per key with sliding-window rate limiting.
Data is in-memory (resets on server restart). For production billing,
persist to a database.
"""
import time
import threading
from collections import defaultdict


class UsageTracker:
    """Thread-safe per-key usage counter with sliding-window rate limiter."""

    def __init__(self, window_seconds: int = 60, max_per_window: int = 60):
        self.window = window_seconds
        self.max_per_window = max_per_window
        self._lock = threading.Lock()
        # key -> list of timestamps
        self._requests: dict[str, list[float]] = defaultdict(list)
        # key -> total lifetime count
        self._totals: dict[str, int] = defaultdict(int)

    def _prune(self, key: str, now: float):
        """Remove timestamps outside the current window."""
        cutoff = now - self.window
        timestamps = self._requests[key]
        # Find first index within window
        i = 0
        while i < len(timestamps) and timestamps[i] < cutoff:
            i += 1
        if i > 0:
            self._requests[key] = timestamps[i:]

    def check_and_record(self, key: str) -> dict:
        """Check rate limit and record a request.

        Returns dict with:
            allowed: bool
            remaining: int  — requests left in current window
            limit: int      — max requests per window
            reset: int      — seconds until window resets
            total: int      — lifetime request count for this key
        """
        now = time.monotonic()
        with self._lock:
            self._prune(key, now)
            current = len(self._requests[key])

            if current >= self.max_per_window:
                # Rate limited
                oldest = self._requests[key][0] if self._requests[key] else now
                reset = max(1, int(self.window - (now - oldest)))
                return {
                    "allowed": False,
                    "remaining": 0,
                    "limit": self.max_per_window,
                    "reset": reset,
                    "total": self._totals[key],
                }

            # Record
            self._requests[key].append(now)
            self._totals[key] += 1
            remaining = self.max_per_window - current - 1

            oldest = self._requests[key][0] if self._requests[key] else now
            reset = max(1, int(self.window - (now - oldest)))

            return {
                "allowed": True,
                "remaining": remaining,
                "limit": self.max_per_window,
                "reset": reset,
                "total": self._totals[key],
            }

    def get_stats(self, key: str) -> dict:
        """Get usage stats for a key without recording."""
        now = time.monotonic()
        with self._lock:
            self._prune(key, now)
            current = len(self._requests[key])
            return {
                "current_window": current,
                "limit": self.max_per_window,
                "remaining": max(0, self.max_per_window - current),
                "total": self._totals[key],
            }

    def get_all_stats(self) -> dict:
        """Get usage stats for all keys."""
        now = time.monotonic()
        with self._lock:
            result = {}
            for key in list(self._totals.keys()):
                self._prune(key, now)
                result[key[:8] + "..."] = {
                    "current_window": len(self._requests[key]),
                    "total": self._totals[key],
                }
            return result


# Global tracker: 60 requests per 60-second window per key
usage_tracker = UsageTracker(window_seconds=60, max_per_window=60)
