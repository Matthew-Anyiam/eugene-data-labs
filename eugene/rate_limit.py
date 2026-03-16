"""Simple token-bucket rate limiter per data source."""
import asyncio
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


class AsyncRateLimiter:
    """Async-compatible rate limiter using token-bucket algorithm.

    Usage:
        limiter = AsyncRateLimiter(max_per_second=10)
        await limiter.acquire()  # awaits until a slot is available
        async with httpx.AsyncClient() as client:
            ...
    """

    def __init__(self, max_per_second: float = 10.0):
        self.max_per_second = max_per_second
        self.min_interval = 1.0 / max_per_second
        self._lock = asyncio.Lock()
        self._last_call = 0.0

    async def acquire(self):
        """Await until rate limit allows the next request."""
        async with self._lock:
            now = asyncio.get_event_loop().time()
            elapsed = now - self._last_call
            if elapsed < self.min_interval:
                await asyncio.sleep(self.min_interval - elapsed)
            self._last_call = asyncio.get_event_loop().time()


# Pre-configured sync limiters for each source
SEC_LIMITER = RateLimiter(max_per_second=9.0)   # SEC limit is 10/s, stay under
FMP_LIMITER = RateLimiter(max_per_second=5.0)   # conservative for free tier
FRED_LIMITER = RateLimiter(max_per_second=5.0)

# Pre-configured async limiters for each source
ASYNC_SEC_LIMITER = AsyncRateLimiter(max_per_second=9.0)
ASYNC_FMP_LIMITER = AsyncRateLimiter(max_per_second=5.0)
ASYNC_FRED_LIMITER = AsyncRateLimiter(max_per_second=5.0)
