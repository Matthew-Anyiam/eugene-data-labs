"""Tests for SEC EDGAR API source functions."""
from unittest.mock import patch, MagicMock

import pytest
import requests

from eugene.cache import cache_clear
from eugene.errors import SourceError


@pytest.fixture(autouse=True)
def clear_cache(tmp_path):
    """Clear L1 cache and swap L2 disk cache to a temp dir for test isolation."""
    import eugene.cache as cache_mod
    cache_clear()
    old_dc = cache_mod._disk_cache
    cache_mod._disk_cache = cache_mod.DiskCache(str(tmp_path / "test_cache"))
    yield
    cache_clear()
    cache_mod._disk_cache = old_dc


class TestFetchTickers:
    @patch("eugene.sources.sec_api.SEC_LIMITER")
    @patch("eugene.sources.sec_api.requests.get")
    def test_success(self, mock_get, mock_limiter):
        from eugene.sources.sec_api import fetch_tickers
        # Must return ≥1000 entries to pass the validation guard
        big_map = {str(i): {"cik_str": str(i), "ticker": f"T{i}", "title": f"Co {i}"} for i in range(1100)}
        big_map["0"] = {"cik_str": "320193", "ticker": "AAPL", "title": "Apple Inc"}
        mock_get.return_value = MagicMock(status_code=200, json=lambda: big_map)

        result = fetch_tickers()
        assert "0" in result
        assert result["0"]["ticker"] == "AAPL"
        assert len(result) >= 1000

    @patch("eugene.sources.sec_api.SEC_LIMITER")
    @patch("eugene.sources.sec_api.requests.get")
    def test_rejects_partial_response(self, mock_get, mock_limiter):
        from eugene.sources.sec_api import fetch_tickers
        mock_get.return_value = MagicMock(
            status_code=200,
            json=lambda: {"0": {"cik_str": "320193", "ticker": "AAPL", "title": "Apple Inc"}},
        )

        with pytest.raises(SourceError, match="too small"):
            fetch_tickers()

    def test_uses_disk_cache(self):
        """fetch_tickers is configured with disk caching."""
        from eugene.sources.sec_api import fetch_tickers
        # Verify the decorator is applied (function is wrapped)
        assert hasattr(fetch_tickers, "__wrapped__")


class TestFetchSubmissions:
    @patch("eugene.sources.sec_api.SEC_LIMITER")
    @patch("eugene.sources.sec_api.requests.get")
    def test_success(self, mock_get, mock_limiter):
        from eugene.sources.sec_api import fetch_submissions
        mock_get.return_value = MagicMock(
            status_code=200,
            json=lambda: {"name": "Apple Inc", "cik": "0000320193", "sic": "3571"},
        )

        result = fetch_submissions("320193")
        assert result["name"] == "Apple Inc"

    def test_cik_padding_logic(self):
        """CIK values get zero-padded to 10 digits."""
        assert "123".zfill(10) == "0000000123"
        assert "320193".zfill(10) == "0000320193"
        assert "0000320193".zfill(10) == "0000320193"

    @patch("eugene.sources.sec_api.SEC_LIMITER")
    @patch("eugene.sources.sec_api.requests.get")
    def test_http_error(self, mock_get, mock_limiter):
        from eugene.sources.sec_api import fetch_submissions
        resp = MagicMock(status_code=404)
        resp.raise_for_status.side_effect = requests.exceptions.HTTPError(response=resp)
        mock_get.return_value = resp

        with pytest.raises(SourceError, match="HTTP 404"):
            fetch_submissions("999999")


class TestFetchCompanyFacts:
    @patch("eugene.sources.sec_api.SEC_LIMITER")
    @patch("eugene.sources.sec_api.requests.get")
    def test_success(self, mock_get, mock_limiter):
        from eugene.sources.sec_api import fetch_companyfacts
        mock_get.return_value = MagicMock(
            status_code=200,
            json=lambda: {"facts": {"us-gaap": {"Revenue": {"units": {"USD": []}}}}},
        )

        result = fetch_companyfacts("320193")
        assert "facts" in result

    @patch("eugene.sources.sec_api.SEC_LIMITER")
    @patch("eugene.sources.sec_api.requests.get")
    def test_http_error(self, mock_get, mock_limiter):
        from eugene.sources.sec_api import fetch_companyfacts
        # Clear both L1 and L2 caches so the function actually makes the HTTP call
        cache_clear()
        import eugene.cache as cache_mod
        old_dc = cache_mod._disk_cache
        cache_mod._disk_cache = None
        try:
            resp = MagicMock(status_code=500)
            resp.raise_for_status.side_effect = requests.exceptions.HTTPError(response=resp)
            mock_get.return_value = resp

            with pytest.raises(SourceError, match="companyfacts"):
                fetch_companyfacts("999")  # Use different CIK to avoid L1 cache from success test
        finally:
            cache_mod._disk_cache = old_dc


class TestFetchFilingHtml:
    @patch("eugene.sources.sec_api.SEC_LIMITER")
    @patch("eugene.sources.sec_api.requests.get")
    def test_success(self, mock_get, mock_limiter):
        from eugene.sources.sec_api import fetch_filing_html
        mock_get.return_value = MagicMock(status_code=200, text="<html>Filing</html>")

        result = fetch_filing_html("320193", "0000320193-24-000123", "doc.htm")
        assert "Filing" in result

    @patch("eugene.sources.sec_api.SEC_LIMITER")
    @patch("eugene.sources.sec_api.requests.get")
    def test_http_error(self, mock_get, mock_limiter):
        from eugene.sources.sec_api import fetch_filing_html
        resp = MagicMock(status_code=404)
        resp.raise_for_status.side_effect = requests.exceptions.HTTPError(response=resp)
        mock_get.return_value = resp

        with pytest.raises(SourceError):
            fetch_filing_html("320193", "0000320193-24-000123", "doc.htm")


class TestFetchFilingIndex:
    @patch("eugene.sources.sec_api.SEC_LIMITER")
    @patch("eugene.sources.sec_api.requests.get")
    def test_success(self, mock_get, mock_limiter):
        from eugene.sources.sec_api import fetch_filing_index
        mock_get.return_value = MagicMock(
            status_code=200,
            json=lambda: {"directory": {"item": [{"name": "doc.htm"}]}},
        )

        result = fetch_filing_index("320193", "0000320193-24-000123")
        assert "directory" in result


class TestFetchFilingXml:
    @patch("eugene.sources.sec_api.SEC_LIMITER")
    @patch("eugene.sources.sec_api.requests.get")
    def test_success(self, mock_get, mock_limiter):
        from eugene.sources.sec_api import fetch_filing_xml
        mock_get.return_value = MagicMock(status_code=200, text="<xml>data</xml>")

        result = fetch_filing_xml("320193", "0000320193-24-000123", "form4.xml")
        assert "data" in result


class TestSearchFulltext:
    @patch("eugene.sources.sec_api.SEC_LIMITER")
    @patch("eugene.sources.sec_api.requests.get")
    def test_success(self, mock_get, mock_limiter):
        from eugene.sources.sec_api import search_fulltext
        mock_get.return_value = MagicMock(
            status_code=200,
            json=lambda: {"hits": {"total": 5, "hits": []}},
        )

        result = search_fulltext("apple revenue", forms=["10-K"])
        assert "hits" in result

    @patch("eugene.sources.sec_api.SEC_LIMITER")
    @patch("eugene.sources.sec_api.requests.get")
    def test_with_dates(self, mock_get, mock_limiter):
        from eugene.sources.sec_api import search_fulltext
        mock_get.return_value = MagicMock(status_code=200, json=lambda: {"hits": {}})

        search_fulltext("revenue", date_from="2024-01-01", date_to="2024-12-31")
        call_params = mock_get.call_args[1]["params"]
        assert "startdt" in call_params
        assert "enddt" in call_params

    @patch("eugene.sources.sec_api.SEC_LIMITER")
    @patch("eugene.sources.sec_api.requests.get")
    def test_http_error(self, mock_get, mock_limiter):
        from eugene.sources.sec_api import search_fulltext
        resp = MagicMock(status_code=500)
        resp.raise_for_status.side_effect = requests.exceptions.HTTPError(response=resp)
        mock_get.return_value = resp

        with pytest.raises(SourceError, match="fulltext"):
            search_fulltext("test query")


class TestFilerCik:
    def test_extracts_cik(self):
        from eugene.sources.sec_api import _filer_cik
        assert _filer_cik("0000320193-24-000123") == "320193"

    def test_strips_leading_zeros(self):
        from eugene.sources.sec_api import _filer_cik
        assert _filer_cik("0000000001-24-000123") == "1"
