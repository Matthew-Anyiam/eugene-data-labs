"""Simple token-bucket rate limiter per data source."""
import time
import threading


class RateLimiter:
    """Thread-safe rate limiter using token-bucket algorithm.

    Usage:
        limiter = RateLimiter(max_per_second=10)
        limiter.acquire()  # blocks until a slot is available
        requests.get(...)
    """

    def __init__(self, max_per_second: float = 10.0):
        self.max_per_second = max_per_second
        self.min_interval = 1.0 / max_per_second
        self._lock = threading.Lock()
        self._last_call = 0.0

    def acquire(self):
        """Block until rate limit allows the next request."""
        with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_call
            if elapsed < self.min_interval:
                time.sleep(self.min_interval - elapsed)
            self._last_call = time.monotonic()


# Pre-configured limiters for each source
SEC_LIMITER = RateLimiter(max_per_second=9.0)   # SEC limit is 10/s, stay under
FMP_LIMITER = RateLimiter(max_per_second=5.0)   # conservative for free tier
FRED_LIMITER = RateLimiter(max_per_second=5.0)
