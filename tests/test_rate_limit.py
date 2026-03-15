"""Tests for rate limiter."""
import time
from eugene.rate_limit import RateLimiter


def test_rate_limiter_enforces_interval():
    limiter = RateLimiter(max_per_second=10.0)  # 100ms between calls
    start = time.monotonic()
    limiter.acquire()
    limiter.acquire()
    limiter.acquire()
    elapsed = time.monotonic() - start

    # 3 acquires at 10/s = at least 0.2s between first and third
    assert elapsed >= 0.18  # small tolerance


def test_rate_limiter_first_call_instant():
    limiter = RateLimiter(max_per_second=5.0)
    start = time.monotonic()
    limiter.acquire()
    elapsed = time.monotonic() - start

    # First call should be nearly instant
    assert elapsed < 0.05


def test_rate_limiter_high_rate():
    limiter = RateLimiter(max_per_second=100.0)  # 10ms between calls
    start = time.monotonic()
    for _ in range(5):
        limiter.acquire()
    elapsed = time.monotonic() - start

    # 5 calls at 100/s = ~40ms minimum
    assert elapsed >= 0.03  # small tolerance
    assert elapsed < 0.5   # shouldn't take forever


def test_pre_configured_limiters():
    from eugene.rate_limit import SEC_LIMITER, FMP_LIMITER, FRED_LIMITER

    assert SEC_LIMITER.max_per_second == 9.0
    assert FMP_LIMITER.max_per_second == 5.0
    assert FRED_LIMITER.max_per_second == 5.0
