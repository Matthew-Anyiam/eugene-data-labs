"""In-memory TTL cache. Replace with Redis when needed."""
import time
import hashlib
import json
from functools import wraps

_CACHE = {}


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
            result = fn(*args, **kwargs)
            _CACHE[key] = (result, now + ttl)
            return result
        return wrapper
    return decorator


def cache_clear():
    _CACHE.clear()
