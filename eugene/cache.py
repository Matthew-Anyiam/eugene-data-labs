"""In-memory TTL cache with size eviction. Replace with Redis when needed."""
import time
import hashlib
import json
from functools import wraps

_CACHE = {}
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


def cached(ttl: int = 3600):
    """Decorator: cache function result for `ttl` seconds."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            key = f"{fn.__name__}:{hashlib.md5(json.dumps([args, kwargs], default=str).encode()).hexdigest()}"
            now = time.time()
            if key in _CACHE:
                val, expires = _CACHE[key]
                if now < expires:
                    return val
                # Expired — remove stale entry
                del _CACHE[key]
            result = fn(*args, **kwargs)
            # Evict before inserting if at capacity
            if len(_CACHE) >= MAX_SIZE:
                _evict_expired()
            if len(_CACHE) >= MAX_SIZE:
                _evict_oldest(MAX_SIZE // 10)
            _CACHE[key] = (result, now + ttl)
            return result
        return wrapper
    return decorator


def cache_clear():
    _CACHE.clear()
