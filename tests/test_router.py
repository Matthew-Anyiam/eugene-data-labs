"""Tests for eugene.router — routing and envelope."""
from unittest.mock import patch
from eugene.router import query, capabilities, VALID_EXTRACTS, VERSION


class TestQuery:
    def test_invalid_extract(self):
        with patch("eugene.router.resolve") as mock:
            mock.return_value = {"cik": "0000320193", "ticker": "AAPL"}
            result = query("AAPL", "nonexistent_extract")
            assert result["status"] == "error"
            assert "Unknown extract" in result["data"]["error"]

    def test_envelope_shape(self):
        with patch("eugene.router.resolve") as mock_resolve:
            mock_resolve.return_value = {"cik": "0000320193", "ticker": "AAPL"}
            with patch("eugene.router.EXTRACT_HANDLERS", {"profile": lambda r, p: {"name": "Apple"}}):
                result = query("AAPL", "profile")
                assert result["status"] == "success"
                assert result["identifier"] == "AAPL"
                assert "resolved" in result
                assert "data" in result
                assert "provenance" in result
                assert result["metadata"]["service"] == "eugene-intelligence"
                assert result["metadata"]["version"] == VERSION

    def test_resolve_error(self):
        with patch("eugene.router.resolve") as mock:
            mock.return_value = {"error": "Could not resolve"}
            result = query("INVALID", "financials")
            assert result["status"] == "error"

    def test_handler_exception(self):
        def broken_handler(r, p):
            raise ValueError("boom")

        with patch("eugene.router.resolve") as mock_resolve:
            mock_resolve.return_value = {"cik": "0000320193", "ticker": "AAPL"}
            with patch("eugene.router.EXTRACT_HANDLERS", {"profile": broken_handler}):
                result = query("AAPL", "profile")
                assert result["status"] == "error"
                assert "boom" in result["data"]["error"]


class TestCapabilities:
    def test_returns_all_extracts(self):
        caps = capabilities()
        assert "extracts" in caps
        for ext in VALID_EXTRACTS:
            assert ext in caps["extracts"]

    def test_version_present(self):
        caps = capabilities()
        assert caps["version"] == VERSION
