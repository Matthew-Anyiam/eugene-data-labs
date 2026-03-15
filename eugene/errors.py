"""
Eugene Intelligence — Error taxonomy.

Structured errors for consistent API responses.
"""


class EugeneError(Exception):
    """Base error for all Eugene errors."""

    def __init__(self, message: str, code: str = "INTERNAL_ERROR", status: int = 500):
        self.message = message
        self.code = code
        self.status = status
        super().__init__(message)


class NotFoundError(EugeneError):
    """Identifier not found (ticker, CIK, accession)."""

    def __init__(self, message: str):
        super().__init__(message, code="NOT_FOUND", status=404)


class SourceError(EugeneError):
    """Upstream data source returned an error."""

    def __init__(self, source: str, message: str):
        super().__init__(f"{source}: {message}", code="SOURCE_ERROR", status=502)


class ValidationError(EugeneError):
    """Invalid input parameters."""

    def __init__(self, message: str):
        super().__init__(message, code="VALIDATION_ERROR", status=422)


class RateLimitError(EugeneError):
    """Rate limit exceeded for a data source."""

    def __init__(self, source: str, retry_after: int = 60):
        self.retry_after = retry_after
        super().__init__(
            f"{source}: rate limited, retry after {retry_after}s",
            code="RATE_LIMITED",
            status=429,
        )
