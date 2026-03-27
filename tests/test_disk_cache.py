"""Tests for DiskCache (L2 persistent cache) and L1+L2 integration."""
import time

import pytest

from eugene.cache import DiskCache, cached, cache_clear, _CACHE, get_disk_cache


@pytest.fixture
def disk_cache(tmp_path):
    """Return a DiskCache backed by a temp directory."""
    return DiskCache(cache_dir=str(tmp_path / "cache"), max_entries=50)


# ---------------------------------------------------------------------------
# DiskCache unit tests
# ---------------------------------------------------------------------------
class TestDiskCacheBasic:
    def test_set_and_get(self, disk_cache):
        disk_cache.set("key1", {"name": "Apple"}, ttl=3600)
        result = disk_cache.get("key1")
        assert result == {"name": "Apple"}

    def test_get_missing_key(self, disk_cache):
        assert disk_cache.get("nonexistent") is None

    def test_overwrite(self, disk_cache):
        disk_cache.set("key1", "old", ttl=3600)
        disk_cache.set("key1", "new", ttl=3600)
        assert disk_cache.get("key1") == "new"

    def test_different_value_types(self, disk_cache):
        disk_cache.set("str", "hello", ttl=3600)
        disk_cache.set("int", 42, ttl=3600)
        disk_cache.set("list", [1, 2, 3], ttl=3600)
        disk_cache.set("nested", {"a": {"b": [1]}}, ttl=3600)

        assert disk_cache.get("str") == "hello"
        assert disk_cache.get("int") == 42
        assert disk_cache.get("list") == [1, 2, 3]
        assert disk_cache.get("nested") == {"a": {"b": [1]}}


class TestDiskCacheTTL:
    def test_expired_entry_returns_none(self, disk_cache):
        disk_cache.set("expiring", "data", ttl=0)
        time.sleep(0.01)
        assert disk_cache.get("expiring") is None

    def test_valid_entry_returns_value(self, disk_cache):
        disk_cache.set("valid", "data", ttl=3600)
        assert disk_cache.get("valid") == "data"

    def test_evict_expired(self, disk_cache):
        disk_cache.set("exp1", "a", ttl=0)
        disk_cache.set("exp2", "b", ttl=0)
        disk_cache.set("keep", "c", ttl=3600)
        time.sleep(0.01)

        removed = disk_cache.evict_expired()
        assert removed == 2
        assert disk_cache.get("keep") == "c"
        assert disk_cache.size() == 1


class TestDiskCacheEviction:
    def test_size_eviction(self, tmp_path):
        dc = DiskCache(cache_dir=str(tmp_path / "cache"), max_entries=10)
        for i in range(15):
            dc.set(f"key{i}", f"val{i}", ttl=3600)

        # After eviction, should be under max_entries
        assert dc.size() <= 10

    def test_size_returns_count(self, disk_cache):
        assert disk_cache.size() == 0
        disk_cache.set("a", 1, ttl=3600)
        disk_cache.set("b", 2, ttl=3600)
        assert disk_cache.size() == 2


class TestDiskCacheOperations:
    def test_delete(self, disk_cache):
        disk_cache.set("to_delete", "data", ttl=3600)
        assert disk_cache.get("to_delete") == "data"
        disk_cache.delete("to_delete")
        assert disk_cache.get("to_delete") is None

    def test_delete_nonexistent(self, disk_cache):
        # Should not raise
        disk_cache.delete("nonexistent")

    def test_clear(self, disk_cache):
        disk_cache.set("a", 1, ttl=3600)
        disk_cache.set("b", 2, ttl=3600)
        disk_cache.clear()
        assert disk_cache.size() == 0
        assert disk_cache.get("a") is None

    def test_corrupted_file_handled(self, disk_cache):
        disk_cache.set("key", "value", ttl=3600)
        # Corrupt the file
        hashed = disk_cache._hash_key("key")
        path = disk_cache._path(hashed)
        path.write_text("NOT JSON")
        assert disk_cache.get("key") is None
        # Corrupted file should be cleaned up
        assert not path.exists()


# ---------------------------------------------------------------------------
# L1 + L2 integration via @cached decorator
# ---------------------------------------------------------------------------
class TestCachedDecoratorWithDisk:
    def setup_method(self):
        cache_clear()

    def test_l1_miss_l2_hit_promotes(self, tmp_path):
        """On L1 miss, check L2; on hit, promote to L1."""
        import eugene.cache as cache_mod

        dc = DiskCache(cache_dir=str(tmp_path / "cache"))
        old_dc = cache_mod._disk_cache
        cache_mod._disk_cache = dc

        try:
            call_count = 0

            @cached(ttl=60, disk=True, disk_ttl=3600)
            def expensive_fn():
                nonlocal call_count
                call_count += 1
                return {"result": "fresh"}

            # First call: computes and stores in L1 + L2
            result = expensive_fn()
            assert result == {"result": "fresh"}
            assert call_count == 1
            assert dc.size() == 1

            # Clear L1 only
            _CACHE.clear()

            # Second call: L1 miss, but L2 hit → promote
            result = expensive_fn()
            assert result == {"result": "fresh"}
            assert call_count == 1  # No recompute — served from L2
        finally:
            cache_mod._disk_cache = old_dc

    def test_l1_hit_skips_l2(self, tmp_path):
        """L1 hit returns immediately without touching disk."""
        import eugene.cache as cache_mod

        dc = DiskCache(cache_dir=str(tmp_path / "cache"))
        old_dc = cache_mod._disk_cache
        cache_mod._disk_cache = dc

        try:
            call_count = 0

            @cached(ttl=60, disk=True, disk_ttl=3600)
            def simple_fn():
                nonlocal call_count
                call_count += 1
                return "computed"

            result1 = simple_fn()
            assert result1 == "computed"
            assert call_count == 1

            result2 = simple_fn()
            assert result2 == "computed"
            assert call_count == 1  # L1 hit, no recompute
        finally:
            cache_mod._disk_cache = old_dc

    def test_l1_only_decorator(self):
        """Default decorator (disk=False) only uses L1."""
        call_count = 0

        @cached(ttl=60)
        def l1_only():
            nonlocal call_count
            call_count += 1
            return "value"

        l1_only()
        l1_only()
        assert call_count == 1

        _CACHE.clear()
        l1_only()
        assert call_count == 2  # No L2 to fall back on


# ---------------------------------------------------------------------------
# get_disk_cache singleton
# ---------------------------------------------------------------------------
class TestGetDiskCache:
    def test_returns_disk_cache_instance(self):
        import eugene.cache as cache_mod
        old = cache_mod._disk_cache
        cache_mod._disk_cache = None
        try:
            dc = get_disk_cache()
            assert isinstance(dc, DiskCache)
            assert dc.cache_dir.exists()

            # Same instance on second call
            dc2 = get_disk_cache()
            assert dc is dc2
        finally:
            cache_mod._disk_cache = old

    def test_cache_dir_created(self, tmp_path):
        cache_dir = tmp_path / "new_cache"
        DiskCache(cache_dir=str(cache_dir))
        assert cache_dir.exists()
