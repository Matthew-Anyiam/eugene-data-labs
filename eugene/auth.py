"""API key authentication with usage tracking and rate-limit headers."""
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

    - If EUGENE_API_KEYS is not set, all requests pass through (open mode)
      with no rate limiting.
    - If set, validates the key, tracks usage, enforces per-key rate limits,
      and adds X-RateLimit-* headers to every response.
    """
    @wraps(func)
    async def wrapper(request, *args, **kwargs):
        valid_keys = _get_valid_keys()

        # Open mode — no auth required
        if not valid_keys:
            return await func(request, *args, **kwargs)

        key = _extract_key(request)
        if key not in valid_keys:
            from starlette.responses import JSONResponse
            return JSONResponse(
                {"error": "Invalid or missing API key"},
                status_code=401,
            )

        # Usage tracking + rate limiting
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

        # Execute handler
        response = await func(request, *args, **kwargs)

        # Add rate-limit headers to successful responses
        _add_rate_headers(response, usage_info)
        return response

    return wrapper
