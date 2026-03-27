"""Tests for error taxonomy — verify each subclass has correct code and status."""
from eugene.errors import (
    EugeneError,
    NotFoundError,
    SourceError,
    ValidationError,
    RateLimitError,
)


class TestEugeneError:
    def test_base_error(self):
        e = EugeneError("something broke")
        assert e.message == "something broke"
        assert e.code == "INTERNAL_ERROR"
        assert e.status == 500
        assert str(e) == "something broke"

    def test_base_error_custom(self):
        e = EugeneError("custom", code="CUSTOM", status=418)
        assert e.code == "CUSTOM"
        assert e.status == 418


class TestNotFoundError:
    def test_not_found(self):
        e = NotFoundError("Unknown ticker: ZZZZZ")
        assert e.code == "NOT_FOUND"
        assert e.status == 404
        assert "ZZZZZ" in e.message
        assert isinstance(e, EugeneError)


class TestSourceError:
    def test_source_error(self):
        e = SourceError("SEC EDGAR", "HTTP 503")
        assert e.code == "SOURCE_ERROR"
        assert e.status == 502
        assert "SEC EDGAR" in e.message
        assert "HTTP 503" in e.message
        assert isinstance(e, EugeneError)


class TestValidationError:
    def test_validation_error(self):
        e = ValidationError("concept parameter required")
        assert e.code == "VALIDATION_ERROR"
        assert e.status == 422
        assert "concept" in e.message
        assert isinstance(e, EugeneError)


class TestRateLimitError:
    def test_rate_limit_error(self):
        e = RateLimitError("FMP", retry_after=30)
        assert e.code == "RATE_LIMITED"
        assert e.status == 429
        assert e.retry_after == 30
        assert "FMP" in e.message
        assert isinstance(e, EugeneError)

    def test_rate_limit_default_retry(self):
        e = RateLimitError("SEC")
        assert e.retry_after == 60


class TestErrorHierarchy:
    def test_all_subclass_eugene_error(self):
        errors = [NotFoundError("x"), SourceError("s", "m"), ValidationError("v"), RateLimitError("r")]
        for e in errors:
            assert isinstance(e, EugeneError)
            assert isinstance(e, Exception)

    def test_catchable_as_eugene_error(self):
        try:
            raise NotFoundError("test")
        except EugeneError as e:
            assert e.code == "NOT_FOUND"

    def test_catchable_as_exception(self):
        try:
            raise SourceError("SEC", "down")
        except Exception as e:
            assert "SEC" in str(e)
