"""Tests for eugene.cache — TTL expiry and size eviction."""
import time
from eugene.cache import cached, cache_clear, _CACHE, MAX_SIZE, _evict_expired, _evict_oldest


def setup_function():
    cache_clear()


def test_cached_returns_same_value():
    call_count = 0

    @cached(ttl=60)
    def add(a, b):
        nonlocal call_count
        call_count += 1
        return a + b

    assert add(1, 2) == 3
    assert add(1, 2) == 3  # cached
    assert call_count == 1


def test_cached_different_args():
    @cached(ttl=60)
    def mul(a, b):
        return a * b

    assert mul(2, 3) == 6
    assert mul(3, 4) == 12
    assert len(_CACHE) == 2


def test_ttl_expiry():
    @cached(ttl=0)
    def now_val():
        return time.time()

    v1 = now_val()
    time.sleep(0.01)
    v2 = now_val()
    assert v1 != v2  # expired, recomputed


def test_cache_clear():
    @cached(ttl=60)
    def val():
        return 42

    val()
    assert len(_CACHE) > 0
    cache_clear()
    assert len(_CACHE) == 0


def test_evict_expired():
    _CACHE["old"] = ("data", time.time() - 10)
    _CACHE["fresh"] = ("data", time.time() + 60)
    _evict_expired()
    assert "old" not in _CACHE
    assert "fresh" in _CACHE


def test_evict_oldest():
    cache_clear()
    now = time.time()
    for i in range(5):
        _CACHE[f"key_{i}"] = (f"val_{i}", now + i)
    _evict_oldest(2)
    assert len(_CACHE) == 3
    assert "key_0" not in _CACHE
    assert "key_1" not in _CACHE


def test_max_size_eviction():
    cache_clear()

    @cached(ttl=3600)
    def make(n):
        return n

    for i in range(MAX_SIZE + 50):
        make(i)
    assert len(_CACHE) <= MAX_SIZE
