"""Tests for identifier resolver (ticker, CIK, accession → company identity)."""
from unittest.mock import patch

import pytest

from eugene.resolver import resolve, _load_ticker_map, ACCESSION_RE, CIK_RE
from eugene.errors import NotFoundError
from eugene.cache import cache_clear


MOCK_TICKERS = {
    "0": {"ticker": "AAPL", "cik_str": "320193", "title": "Apple Inc"},
    "1": {"ticker": "MSFT", "cik_str": "789019", "title": "Microsoft Corp"},
    "2": {"ticker": "GOOG", "cik_str": "1652044", "title": "Alphabet Inc"},
}

MOCK_SUBMISSIONS = {
    "name": "Apple Inc",
    "cik": "0000320193",
    "sic": "3571",
    "fiscalYearEnd": "0928",
    "tickers": ["AAPL"],
}


class TestRegexPatterns:
    def test_accession_pattern(self):
        assert ACCESSION_RE.match("0000320193-24-000123")
        assert ACCESSION_RE.match("1234567890-99-123456")
        assert not ACCESSION_RE.match("AAPL")
        assert not ACCESSION_RE.match("320193")
        assert not ACCESSION_RE.match("123-45-678")

    def test_cik_pattern(self):
        assert CIK_RE.match("320193")
        assert CIK_RE.match("0000320193")
        assert CIK_RE.match("1")
        assert not CIK_RE.match("AAPL")
        assert not CIK_RE.match("123-456")


class TestLoadTickerMap:
    def setup_method(self):
        cache_clear()

    @patch("eugene.resolver.fetch_tickers")
    def test_builds_ticker_map(self, mock_fetch):
        mock_fetch.return_value = MOCK_TICKERS
        result = _load_ticker_map()
        assert "AAPL" in result
        assert result["AAPL"]["cik"] == "0000320193"
        assert result["AAPL"]["company"] == "Apple Inc"

    @patch("eugene.resolver.fetch_tickers")
    def test_uppercase_tickers(self, mock_fetch):
        mock_fetch.return_value = {"0": {"ticker": "aapl", "cik_str": "320193", "title": "Apple"}}
        result = _load_ticker_map()
        assert "AAPL" in result


class TestResolveByTicker:
    def setup_method(self):
        cache_clear()

    @patch("eugene.resolver.fetch_submissions")
    @patch("eugene.resolver.fetch_tickers")
    def test_resolve_ticker(self, mock_tickers, mock_subs):
        mock_tickers.return_value = MOCK_TICKERS
        mock_subs.return_value = MOCK_SUBMISSIONS

        result = resolve("AAPL")

        assert result["ticker"] == "AAPL"
        assert result["cik"] == "0000320193"
        assert result["company"] == "Apple Inc"
        assert result["sic"] == "3571"

    @patch("eugene.resolver.fetch_submissions")
    @patch("eugene.resolver.fetch_tickers")
    def test_resolve_lowercase(self, mock_tickers, mock_subs):
        mock_tickers.return_value = MOCK_TICKERS
        mock_subs.return_value = MOCK_SUBMISSIONS

        result = resolve("aapl")
        assert result["ticker"] == "AAPL"

    @patch("eugene.resolver.fetch_tickers")
    def test_resolve_unknown_ticker(self, mock_tickers):
        mock_tickers.return_value = MOCK_TICKERS

        with pytest.raises(NotFoundError, match="Unknown ticker: ZZZZZ"):
            resolve("ZZZZZ")

    @patch("eugene.resolver.fetch_submissions")
    @patch("eugene.resolver.fetch_tickers")
    def test_resolve_ticker_submissions_fail(self, mock_tickers, mock_subs):
        mock_tickers.return_value = MOCK_TICKERS
        mock_subs.side_effect = Exception("Network error")

        result = resolve("AAPL")
        # Should still return with ticker and cik from ticker map
        assert result["ticker"] == "AAPL"
        assert result["cik"] == "0000320193"


class TestResolveByCIK:
    def setup_method(self):
        cache_clear()

    @patch("eugene.resolver.fetch_submissions")
    def test_resolve_cik(self, mock_subs):
        mock_subs.return_value = MOCK_SUBMISSIONS

        result = resolve("320193")

        assert result["cik"] == "0000320193"
        assert result["company"] == "Apple Inc"
        assert result["ticker"] == "AAPL"

    @patch("eugene.resolver.fetch_submissions")
    def test_resolve_padded_cik(self, mock_subs):
        mock_subs.return_value = MOCK_SUBMISSIONS

        result = resolve("0000320193")
        assert result["cik"] == "0000320193"

    @patch("eugene.resolver.fetch_submissions")
    def test_resolve_cik_failure(self, mock_subs):
        mock_subs.side_effect = Exception("Not found")

        with pytest.raises(NotFoundError, match="Could not resolve CIK"):
            resolve("999999999")


class TestResolveByAccession:
    def setup_method(self):
        cache_clear()

    @patch("eugene.resolver.fetch_submissions")
    def test_resolve_accession(self, mock_subs):
        mock_subs.return_value = MOCK_SUBMISSIONS

        result = resolve("0000320193-24-000123")

        assert result["cik"] == "0000320193"
        assert result["company"] == "Apple Inc"
        assert result["accession"] == "0000320193-24-000123"

    @patch("eugene.resolver.fetch_submissions")
    def test_resolve_accession_failure(self, mock_subs):
        mock_subs.side_effect = Exception("Not found")

        with pytest.raises(NotFoundError, match="Could not resolve accession"):
            resolve("0000320193-24-000123")

    @patch("eugene.resolver.fetch_submissions")
    def test_resolve_accession_no_tickers(self, mock_subs):
        mock_subs.return_value = {"name": "Unknown Corp", "tickers": []}

        result = resolve("0000320193-24-000123")
        assert result["ticker"] is None
