"""In-memory TTL cache (L1) + optional persistent disk cache (L2).

L1 = fast in-process dict, evicted on restart.
L2 = JSON files under ``~/.cache/eugene/``, survives restarts.

Usage:
    @cached(ttl=3600)                          # L1 only
    @cached(ttl=3600, disk=True, disk_ttl=86400)  # L1 + L2
"""
import hashlib
import json
import logging
import os
import shutil
import time
from functools import wraps
from pathlib import Path

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# L1 — in-memory TTL cache
# ---------------------------------------------------------------------------
_CACHE: dict = {}
MAX_SIZE = 1000


def _evict_expired():
    """Remove all expired entries."""
    now = time.time()
    expired = [k for k, (_, expires) in _CACHE.items() if now >= expires]
    for k in expired:
        del _CACHE[k]


def _evict_oldest(count: int = 1):
    """Remove the oldest entries by expiry time."""
    if not _CACHE:
        return
    sorted_keys = sorted(_CACHE, key=lambda k: _CACHE[k][1])
    for k in sorted_keys[:count]:
        del _CACHE[k]


def cache_clear():
    _CACHE.clear()


# ---------------------------------------------------------------------------
# L2 — persistent disk cache
# ---------------------------------------------------------------------------
_DEFAULT_CACHE_DIR = os.path.join(Path.home(), ".cache", "eugene")
_MAX_DISK_ENTRIES = 5000


class DiskCache:
    """JSON-file disk cache with TTL expiry and size eviction.

    Each entry is a JSON file named by SHA-256 of the key.  Metadata
    (stored_at, expires_at) lives inside the file alongside the payload.
    """

    def __init__(self, cache_dir: str | None = None, max_entries: int = _MAX_DISK_ENTRIES):
        self.cache_dir = Path(cache_dir or _DEFAULT_CACHE_DIR)
        self.max_entries = max_entries
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    # -- helpers ----------------------------------------------------------

    @staticmethod
    def _hash_key(key: str) -> str:
        return hashlib.sha256(key.encode()).hexdigest()

    def _path(self, hashed: str) -> Path:
        return self.cache_dir / f"{hashed}.json"

    # -- public API -------------------------------------------------------

    def get(self, key: str):
        """Return cached value or ``None`` if missing / expired."""
        hashed = self._hash_key(key)
        path = self._path(hashed)
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text())
            if time.time() >= data["expires_at"]:
                path.unlink(missing_ok=True)
                return None
            return data["value"]
        except (json.JSONDecodeError, KeyError, OSError):
            path.unlink(missing_ok=True)
            return None

    def set(self, key: str, value, ttl: int = 86400):
        """Store *value* (must be JSON-serialisable) with TTL seconds."""
        hashed = self._hash_key(key)
        path = self._path(hashed)
        now = time.time()
        payload = {
            "key": key,
            "stored_at": now,
            "expires_at": now + ttl,
            "value": value,
        }
        try:
            path.write_text(json.dumps(payload, default=str))
        except OSError:
            logger.warning("disk cache write failed for %s", key)
        # Size eviction
        self._maybe_evict()

    def delete(self, key: str):
        """Remove a single entry."""
        hashed = self._hash_key(key)
        self._path(hashed).unlink(missing_ok=True)

    def clear(self):
        """Remove all cache files."""
        if self.cache_dir.exists():
            shutil.rmtree(self.cache_dir)
            self.cache_dir.mkdir(parents=True, exist_ok=True)

    def evict_expired(self):
        """Scan and remove expired entries."""
        now = time.time()
        removed = 0
        for path in self.cache_dir.glob("*.json"):
            try:
                data = json.loads(path.read_text())
                if now >= data.get("expires_at", 0):
                    path.unlink(missing_ok=True)
                    removed += 1
            except (json.JSONDecodeError, KeyError, OSError):
                path.unlink(missing_ok=True)
                removed += 1
        return removed

    def _maybe_evict(self):
        """If over max_entries, remove oldest 10%."""
        entries = list(self.cache_dir.glob("*.json"))
        if len(entries) <= self.max_entries:
            return
        # Sort by mtime (oldest first)
        entries.sort(key=lambda p: p.stat().st_mtime)
        to_remove = max(1, len(entries) // 10)
        for path in entries[:to_remove]:
            path.unlink(missing_ok=True)

    def size(self) -> int:
        """Return number of cached entries."""
        return len(list(self.cache_dir.glob("*.json")))


# Shared singleton instance
_disk_cache: DiskCache | None = None


def get_disk_cache() -> DiskCache:
    """Return the shared DiskCache singleton."""
    global _disk_cache
    if _disk_cache is None:
        _disk_cache = DiskCache()
    return _disk_cache


# ---------------------------------------------------------------------------
# Decorator — supports L1 only or L1 + L2
# ---------------------------------------------------------------------------
def cached(ttl: int = 3600, disk: bool = False, disk_ttl: int = 86400):
    """Decorator: cache function result with optional L2 disk backing.

    Parameters
    ----------
    ttl : int
        L1 (in-memory) TTL in seconds.
    disk : bool
        If True, also cache on disk for persistence across restarts.
    disk_ttl : int
        L2 (disk) TTL in seconds.  Defaults to 1 day.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            key = f"{fn.__name__}:{hashlib.md5(json.dumps([args, kwargs], default=str).encode()).hexdigest()}"
            now = time.time()

            # --- L1 check ---
            if key in _CACHE:
                val, expires = _CACHE[key]
                if now < expires:
                    return val
                del _CACHE[key]

            # --- L2 check ---
            if disk:
                dc = get_disk_cache()
                disk_val = dc.get(key)
                if disk_val is not None:
                    # Promote to L1
                    if len(_CACHE) >= MAX_SIZE:
                        _evict_expired()
                    if len(_CACHE) >= MAX_SIZE:
                        _evict_oldest(MAX_SIZE // 10)
                    _CACHE[key] = (disk_val, now + ttl)
                    return disk_val

            # --- Miss: call function ---
            result = fn(*args, **kwargs)

            # Store in L1
            if len(_CACHE) >= MAX_SIZE:
                _evict_expired()
            if len(_CACHE) >= MAX_SIZE:
                _evict_oldest(MAX_SIZE // 10)
            _CACHE[key] = (result, now + ttl)

            # Store in L2
            if disk:
                dc = get_disk_cache()
                try:
                    dc.set(key, result, ttl=disk_ttl)
                except Exception:
                    logger.warning("disk cache write failed for %s", fn.__name__)

            return result
        return wrapper
    return decorator
