"""API key authentication with usage tracking and rate-limit headers.

Supports two authentication modes:
1. Eugene API keys (``eug_`` prefix) — validated against SQLite via apikeys module
2. Legacy env-var keys (``EUGENE_API_KEYS``) — comma-separated list for backwards compat
3. No key — unauthenticated free tier, rate limited by IP
"""
import os
from functools import wraps


def _get_valid_keys():
    """Load valid API keys from EUGENE_API_KEYS env var (comma-separated)."""
    raw = os.environ.get("EUGENE_API_KEYS", "")
    if not raw:
        return set()
    return {k.strip() for k in raw.split(",") if k.strip()}


def _extract_key(request):
    """Extract API key from header or query param."""
    return request.headers.get("x-api-key") or request.query_params.get("api_key")


def _add_rate_headers(response, usage_info):
    """Add standard rate-limit headers to a response (if it supports headers)."""
    if not hasattr(response, "headers"):
        return response
    response.headers["X-RateLimit-Limit"] = str(usage_info["limit"])
    response.headers["X-RateLimit-Remaining"] = str(usage_info["remaining"])
    response.headers["X-RateLimit-Reset"] = str(usage_info["reset"])
    response.headers["X-Request-Count"] = str(usage_info["total"])
    return response


def require_api_key(func):
    """Starlette route decorator: auth + usage tracking + rate-limit headers.

    Authentication flow:
    1. If an ``eug_`` key is provided, validate via ``apikeys.validate_key()``.
       - Valid: attach user info to ``request.state.user`` and proceed.
       - Invalid/revoked: return 401.
    2. If a legacy env-var key is provided, validate against EUGENE_API_KEYS.
    3. If no key is provided, allow the request (free tier).
    """
    @wraps(func)
    async def wrapper(request, *args, **kwargs):
        key = _extract_key(request)

        # --- Eugene API key (eug_ prefix) ---
        if key and key.startswith("eug_"):
            from eugene.apikeys import validate_key
            user_info = validate_key(key)
            if user_info is None:
                from starlette.responses import JSONResponse
                return JSONResponse(
                    {"error": "Invalid or revoked API key"},
                    status_code=401,
                )
            # Attach user info so downstream handlers can check tier, etc.
            request.state.user = user_info
            return await func(request, *args, **kwargs)

        # --- Legacy env-var keys ---
        valid_keys = _get_valid_keys()
        if valid_keys:
            if key not in valid_keys:
                from starlette.responses import JSONResponse
                return JSONResponse(
                    {"error": "Invalid or missing API key"},
                    status_code=401,
                )
            # Legacy key — usage tracking + rate limiting
            from eugene.usage import usage_tracker
            usage_info = usage_tracker.check_and_record(key)

            if not usage_info["allowed"]:
                from starlette.responses import JSONResponse
                resp = JSONResponse(
                    {
                        "error": "Rate limit exceeded",
                        "retry_after": usage_info["reset"],
                        "limit": usage_info["limit"],
                    },
                    status_code=429,
                )
                _add_rate_headers(resp, usage_info)
                resp.headers["Retry-After"] = str(usage_info["reset"])
                return resp

            response = await func(request, *args, **kwargs)
            _add_rate_headers(response, usage_info)
            return response

        # --- No key, no env-var keys configured: open / free tier ---
        # Ensure request.state.user is not set (free tier)
        if not hasattr(request.state, "user"):
            request.state.user = None
        return await func(request, *args, **kwargs)

    return wrapper
