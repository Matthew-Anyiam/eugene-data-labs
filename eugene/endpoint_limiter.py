"""
Sliding-window endpoint rate limiter for auth and API routes.

Unlike rate_limit.py (which throttles outbound API source calls),
this module protects inbound endpoints from abuse (brute force, DDoS).
"""
import time
import threading
from collections import defaultdict
from dataclasses import dataclass, field


@dataclass
class _Window:
    """Sliding window counter for a single key."""
    timestamps: list[float] = field(default_factory=list)

    def count_within(self, window_seconds: float) -> int:
        cutoff = time.monotonic() - window_seconds
        self.timestamps = [t for t in self.timestamps if t > cutoff]
        return len(self.timestamps)

    def record(self) -> None:
        self.timestamps.append(time.monotonic())


class EndpointLimiter:
    """
    In-memory sliding window rate limiter.

    Usage:
        limiter = EndpointLimiter(max_requests=5, window_seconds=60)
        allowed = limiter.check_and_record("192.168.1.1")
        if not allowed:
            return JSONResponse({"error": "Too many requests"}, 429)
    """

    def __init__(self, max_requests: int = 10, window_seconds: float = 60.0):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._windows: dict[str, _Window] = defaultdict(_Window)
        self._lock = threading.Lock()
        self._last_cleanup = time.monotonic()
        self._cleanup_interval = 300.0

    def is_limited(self, key: str) -> bool:
        with self._lock:
            self._maybe_cleanup()
            return self._windows[key].count_within(self.window_seconds) >= self.max_requests

    def check_and_record(self, key: str) -> bool:
        """Atomically check + record. Returns True if allowed, False if limited."""
        with self._lock:
            self._maybe_cleanup()
            window = self._windows[key]
            if window.count_within(self.window_seconds) >= self.max_requests:
                return False
            window.record()
            return True

    def remaining(self, key: str) -> int:
        with self._lock:
            used = self._windows[key].count_within(self.window_seconds)
            return max(0, self.max_requests - used)

    def reset_seconds(self, key: str) -> float:
        with self._lock:
            w = self._windows[key]
            w.count_within(self.window_seconds)
            if not w.timestamps:
                return 0.0
            return max(0.0, self.window_seconds - (time.monotonic() - w.timestamps[0]))

    def _maybe_cleanup(self) -> None:
        now = time.monotonic()
        if now - self._last_cleanup < self._cleanup_interval:
            return
        self._last_cleanup = now
        cutoff = now - self.window_seconds
        stale = [k for k, w in self._windows.items()
                 if not w.timestamps or w.timestamps[-1] < cutoff]
        for k in stale:
            del self._windows[k]


# ── Pre-configured limiters ──────────────────────────────────────────────────

# Login/signup: 5 per minute per IP (brute force protection)
auth_limiter = EndpointLimiter(max_requests=5, window_seconds=60)

# Token refresh: 10 per minute per IP
refresh_limiter = EndpointLimiter(max_requests=10, window_seconds=60)

# General API: 120 per minute per IP
api_limiter = EndpointLimiter(max_requests=120, window_seconds=60)


def get_client_ip(request) -> str:
    """Extract client IP from request, respecting X-Forwarded-For behind proxies."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    client = getattr(request, "client", None)
    if client:
        return client.host
    return "unknown"
