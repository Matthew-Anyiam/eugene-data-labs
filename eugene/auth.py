"""API key authentication for Eugene Intelligence."""
import os
from functools import wraps


def _get_valid_keys():
    """Load valid API keys from EUGENE_API_KEYS env var (comma-separated)."""
    raw = os.environ.get("EUGENE_API_KEYS", "")
    if not raw:
        return set()
    return {k.strip() for k in raw.split(",") if k.strip()}


def require_api_key(func):
    """Starlette route decorator that checks X-API-Key header or api_key query param.

    Returns 401 if EUGENE_API_KEYS is set and the request doesn't provide a valid key.
    If EUGENE_API_KEYS is not set, all requests pass through (open mode).
    """
    @wraps(func)
    async def wrapper(request, *args, **kwargs):
        valid_keys = _get_valid_keys()
        if not valid_keys:
            return await func(request, *args, **kwargs)

        key = request.headers.get("x-api-key") or request.query_params.get("api_key")
        if key not in valid_keys:
            from starlette.responses import JSONResponse
            return JSONResponse(
                {"error": "Invalid or missing API key"},
                status_code=401,
            )
        return await func(request, *args, **kwargs)

    return wrapper
