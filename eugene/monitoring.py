"""
Structured logging and lightweight monitoring for Eugene Intelligence.

Uses only Python stdlib (logging, time, collections). No external dependencies.
"""
import logging
import json
import time
import traceback
from collections import defaultdict

# ---------------------------------------------------------------------------
# Uptime tracking — start time recorded on module import
# ---------------------------------------------------------------------------
_START_TIME = time.time()

# ---------------------------------------------------------------------------
# In-memory request stats
# ---------------------------------------------------------------------------
_total_requests = 0
_error_count = 0
_total_duration_ms = 0.0
_requests_by_endpoint: dict[str, int] = defaultdict(int)


def track_request(method: str, path: str, status_code: int, duration_ms: float) -> None:
    """Record a completed request in the in-memory counters."""
    global _total_requests, _error_count, _total_duration_ms

    _total_requests += 1
    _total_duration_ms += duration_ms
    _requests_by_endpoint[f"{method} {path}"] += 1

    if status_code >= 500:
        _error_count += 1


def get_stats() -> dict:
    """Return a snapshot of server stats."""
    uptime = time.time() - _START_TIME
    avg_ms = round(_total_duration_ms / _total_requests, 2) if _total_requests else 0.0

    # Top 10 endpoints by request count
    sorted_endpoints = sorted(
        _requests_by_endpoint.items(), key=lambda kv: kv[1], reverse=True
    )[:10]

    return {
        "total_requests": _total_requests,
        "error_count": _error_count,
        "avg_response_ms": avg_ms,
        "uptime_seconds": round(uptime, 1),
        "requests_by_endpoint": dict(sorted_endpoints),
    }


# ---------------------------------------------------------------------------
# Structured JSON logging
# ---------------------------------------------------------------------------
class _JSONFormatter(logging.Formatter):
    """Emit each log record as a single JSON line for Railway / structured log parsing."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry, default=str)


def setup_logging(level: str = "INFO") -> None:
    """Configure the root logger with structured JSON output.

    Call this once, early in the application lifecycle.
    """
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Remove any existing handlers to avoid duplicate output
    root.handlers.clear()

    handler = logging.StreamHandler()
    handler.setFormatter(_JSONFormatter())
    root.addHandler(handler)


# ---------------------------------------------------------------------------
# Error tracking helper
# ---------------------------------------------------------------------------
def log_error(error: Exception, context: dict | None = None) -> None:
    """Log an error with its stack trace in structured format.

    Args:
        error: The exception to log.
        context: Optional dict of extra context (e.g. request path, user info).
    """
    logger = logging.getLogger("eugene.error")
    entry = {
        "error_type": type(error).__name__,
        "error_message": str(error),
        "traceback": traceback.format_exception(type(error), error, error.__traceback__),
    }
    if context:
        entry["context"] = context
    logger.error(json.dumps(entry, default=str))


# ---------------------------------------------------------------------------
# Starlette request-logging middleware
# ---------------------------------------------------------------------------
class RequestLoggingMiddleware:
    """Lightweight ASGI middleware that logs every request as structured JSON.

    Logs: method, path, status_code, duration_ms, client_ip.
    Also feeds the in-memory stats tracker.
    """

    def __init__(self, app):
        self.app = app
        self.logger = logging.getLogger("eugene.requests")

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start = time.time()
        method = scope.get("method", "")
        path = scope.get("path", "")

        # Extract client IP
        client = scope.get("client")
        client_ip = client[0] if client else "unknown"

        # Capture the status code from the response
        status_code = 500  # default in case send is never called

        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 500)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as exc:
            status_code = 500
            log_error(exc, context={"method": method, "path": path, "client_ip": client_ip})
            raise
        finally:
            duration_ms = round((time.time() - start) * 1000, 2)

            # Track in-memory stats
            track_request(method, path, status_code, duration_ms)

            # Structured log line
            self.logger.info(
                json.dumps({
                    "method": method,
                    "path": path,
                    "status_code": status_code,
                    "duration_ms": duration_ms,
                    "client_ip": client_ip,
                }, default=str)
            )
