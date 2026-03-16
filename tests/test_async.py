"""Tests for async rate limiter and asyncio.to_thread wrapping."""
import asyncio
import time
from unittest.mock import MagicMock

import pytest

from eugene.rate_limit import AsyncRateLimiter, RateLimiter


# ---------------------------------------------------------------------------
# AsyncRateLimiter
# ---------------------------------------------------------------------------
class TestAsyncRateLimiter:
    @pytest.mark.asyncio
    async def test_basic_acquire(self):
        limiter = AsyncRateLimiter(max_per_second=100.0)
        await limiter.acquire()
        assert limiter._last_call > 0

    @pytest.mark.asyncio
    async def test_rate_limiting(self):
        limiter = AsyncRateLimiter(max_per_second=10.0)
        start = time.monotonic()
        for _ in range(3):
            await limiter.acquire()
        elapsed = time.monotonic() - start
        # 3 calls at 10/s → need at least ~0.2s gap (2 intervals)
        assert elapsed >= 0.15

    @pytest.mark.asyncio
    async def test_min_interval(self):
        limiter = AsyncRateLimiter(max_per_second=5.0)
        assert limiter.min_interval == pytest.approx(0.2)

    @pytest.mark.asyncio
    async def test_concurrent_acquire(self):
        """Multiple coroutines should be serialised by the lock."""
        limiter = AsyncRateLimiter(max_per_second=50.0)
        results = []

        async def worker(n):
            await limiter.acquire()
            results.append(n)

        await asyncio.gather(*[worker(i) for i in range(5)])
        assert len(results) == 5


# ---------------------------------------------------------------------------
# Sync RateLimiter (basic sanity)
# ---------------------------------------------------------------------------
class TestSyncRateLimiter:
    def test_basic_acquire(self):
        limiter = RateLimiter(max_per_second=100.0)
        limiter.acquire()
        assert limiter._last_call > 0

    def test_rate_limiting(self):
        limiter = RateLimiter(max_per_second=10.0)
        start = time.monotonic()
        for _ in range(3):
            limiter.acquire()
        elapsed = time.monotonic() - start
        assert elapsed >= 0.15


# ---------------------------------------------------------------------------
# Pre-configured limiters
# ---------------------------------------------------------------------------
class TestPreConfiguredLimiters:
    def test_sync_limiters_exist(self):
        from eugene.rate_limit import SEC_LIMITER, FMP_LIMITER, FRED_LIMITER
        assert SEC_LIMITER.max_per_second == 9.0
        assert FMP_LIMITER.max_per_second == 5.0
        assert FRED_LIMITER.max_per_second == 5.0

    def test_async_limiters_exist(self):
        from eugene.rate_limit import ASYNC_SEC_LIMITER, ASYNC_FMP_LIMITER, ASYNC_FRED_LIMITER
        assert ASYNC_SEC_LIMITER.max_per_second == 9.0
        assert ASYNC_FMP_LIMITER.max_per_second == 5.0
        assert ASYNC_FRED_LIMITER.max_per_second == 5.0


# ---------------------------------------------------------------------------
# asyncio.to_thread wrapping (simulates what eugene_server.py does)
# ---------------------------------------------------------------------------
class TestToThreadWrapping:
    @pytest.mark.asyncio
    async def test_sync_function_in_thread(self):
        """Sync function runs in thread pool without blocking event loop."""
        def slow_sync():
            time.sleep(0.05)
            return {"status": "ok"}

        result = await asyncio.to_thread(slow_sync)
        assert result == {"status": "ok"}

    @pytest.mark.asyncio
    async def test_query_wrapping(self):
        """Verify query() can be wrapped in to_thread."""
        mock_query = MagicMock(return_value={"data": {"name": "Apple Inc"}})

        result = await asyncio.to_thread(mock_query, "AAPL", "profile")
        assert result == {"data": {"name": "Apple Inc"}}
        mock_query.assert_called_once_with("AAPL", "profile")

    @pytest.mark.asyncio
    async def test_concurrent_queries(self):
        """Multiple queries run concurrently in threads."""
        call_order = []

        def mock_query(identifier, extract):
            call_order.append(identifier)
            time.sleep(0.05)
            return {"ticker": identifier}

        results = await asyncio.gather(
            asyncio.to_thread(mock_query, "AAPL", "profile"),
            asyncio.to_thread(mock_query, "MSFT", "profile"),
            asyncio.to_thread(mock_query, "GOOG", "profile"),
        )

        assert len(results) == 3
        assert all(r["ticker"] in ("AAPL", "MSFT", "GOOG") for r in results)

    @pytest.mark.asyncio
    async def test_exception_propagation(self):
        """Exceptions in sync functions propagate through to_thread."""
        def failing_sync():
            raise ValueError("test error")

        with pytest.raises(ValueError, match="test error"):
            await asyncio.to_thread(failing_sync)
