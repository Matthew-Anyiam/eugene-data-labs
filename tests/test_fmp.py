"""Tests for FMP source functions — mock HTTP calls, test parsing logic."""
from unittest.mock import patch, MagicMock

import pytest
import requests

from eugene.cache import cache_clear
from eugene.errors import SourceError


# Clear cache before each test class to avoid stale cached values
@pytest.fixture(autouse=True)
def clear_cache():
    cache_clear()
    yield
    cache_clear()


class TestSafeGet:
    @patch("eugene.sources.fmp.FMP_LIMITER")
    @patch("eugene.sources.fmp.requests.get")
    def test_success(self, mock_get, mock_limiter):
        from eugene.sources.fmp import _safe_get
        mock_get.return_value = MagicMock(status_code=200, json=lambda: {"data": "ok"})

        result = _safe_get("http://test.com")
        assert result == {"data": "ok"}

    @patch("eugene.sources.fmp.FMP_LIMITER")
    @patch("eugene.sources.fmp.requests.get")
    def test_402_paid_plan(self, mock_get, mock_limiter):
        from eugene.sources.fmp import _safe_get
        resp = MagicMock(status_code=402)
        resp.raise_for_status.side_effect = requests.exceptions.HTTPError(response=resp)
        mock_get.return_value = resp

        result = _safe_get("http://test.com")
        assert result["error"] == "This feature requires a paid FMP plan"

    @patch("eugene.sources.fmp.FMP_LIMITER")
    @patch("eugene.sources.fmp.requests.get")
    def test_404_not_found(self, mock_get, mock_limiter):
        from eugene.sources.fmp import _safe_get
        resp = MagicMock(status_code=404)
        resp.raise_for_status.side_effect = requests.exceptions.HTTPError(response=resp)
        mock_get.return_value = resp

        result = _safe_get("http://test.com")
        assert result["error"] == "Endpoint not found"

    @patch("eugene.sources.fmp.FMP_LIMITER")
    @patch("eugene.sources.fmp.requests.get")
    def test_500_raises_source_error(self, mock_get, mock_limiter):
        from eugene.sources.fmp import _safe_get
        resp = MagicMock(status_code=500)
        resp.raise_for_status.side_effect = requests.exceptions.HTTPError(response=resp)
        mock_get.return_value = resp

        with pytest.raises(SourceError):
            _safe_get("http://test.com")

    @patch("eugene.sources.fmp.FMP_LIMITER")
    @patch("eugene.sources.fmp.requests.get")
    def test_connection_error(self, mock_get, mock_limiter):
        from eugene.sources.fmp import _safe_get
        mock_get.side_effect = requests.exceptions.ConnectionError("timeout")

        with pytest.raises(SourceError, match="timeout"):
            _safe_get("http://test.com")


class TestGetPrice:
    @patch("eugene.sources.fmp._safe_get")
    def test_price_success(self, mock_get):
        from eugene.sources.fmp import get_price
        mock_get.return_value = [{"price": 175.5, "change": 1.2, "changePercentage": 0.69,
                                   "volume": 50000000, "marketCap": 2700000000000}]

        result = get_price("AAPL")
        assert result["ticker"] == "AAPL"
        assert result["price"] == 175.5
        assert result["change"] == 1.2

    @patch("eugene.sources.fmp._safe_get")
    def test_price_error(self, mock_get):
        from eugene.sources.fmp import get_price
        mock_get.return_value = {"error": "No key"}

        result = get_price("AAPL")
        assert "error" in result

    @patch("eugene.sources.fmp._safe_get")
    def test_price_empty(self, mock_get):
        from eugene.sources.fmp import get_price
        mock_get.return_value = []

        result = get_price("AAPL")
        assert "error" in result


class TestGetProfile:
    @patch("eugene.sources.fmp._safe_get")
    def test_profile_success(self, mock_get):
        from eugene.sources.fmp import get_profile
        mock_get.return_value = [{"companyName": "Apple Inc", "sector": "Technology",
                                   "industry": "Consumer Electronics", "ceo": "Tim Cook",
                                   "fullTimeEmployees": 164000, "country": "US"}]

        result = get_profile("AAPL")
        assert result["name"] == "Apple Inc"
        assert result["sector"] == "Technology"
        assert result["ceo"] == "Tim Cook"

    @patch("eugene.sources.fmp._safe_get")
    def test_profile_no_data(self, mock_get):
        from eugene.sources.fmp import get_profile
        mock_get.return_value = []

        result = get_profile("ZZZZZ")
        assert "error" in result


class TestGetEarnings:
    @patch("eugene.sources.fmp._safe_get")
    def test_earnings_success(self, mock_get):
        from eugene.sources.fmp import get_earnings
        mock_get.return_value = [
            {"date": "2024-01-25", "eps": 2.18, "epsEstimated": 2.10, "revenue": 119580000000},
            {"date": "2023-10-26", "eps": 1.46, "epsEstimated": 1.39, "revenue": 89498000000},
        ]

        result = get_earnings("AAPL")
        assert result["ticker"] == "AAPL"
        assert len(result["earnings"]) == 2
        assert result["earnings"][0]["eps_actual"] == 2.18

    @patch("eugene.sources.fmp._safe_get")
    def test_earnings_error(self, mock_get):
        from eugene.sources.fmp import get_earnings
        mock_get.return_value = {"error": "No key"}

        result = get_earnings("AAPL")
        assert result["earnings"] == []


class TestGetEstimates:
    @patch("eugene.sources.fmp._safe_get")
    def test_estimates_success(self, mock_get):
        from eugene.sources.fmp import get_estimates
        mock_get.return_value = [
            {"analystName": "John", "analystCompany": "GS", "adjPriceTarget": 200, "publishedDate": "2024-01-15"},
        ]

        result = get_estimates("AAPL")
        assert len(result["price_targets"]) == 1
        assert result["price_targets"][0]["target"] == 200


class TestGetNews:
    @patch("eugene.sources.fmp._safe_get")
    def test_news_success(self, mock_get):
        from eugene.sources.fmp import get_news
        mock_get.return_value = [
            {"title": "Apple beats", "publishedDate": "2024-01-25", "site": "Reuters", "url": "http://...", "text": "Short text"},
        ]

        result = get_news("AAPL")
        assert len(result["articles"]) == 1
        assert result["articles"][0]["title"] == "Apple beats"


class TestGetHistoricalBars:
    @patch("eugene.sources.fmp._safe_get")
    def test_daily_bars(self, mock_get):
        from eugene.sources.fmp import get_historical_bars
        mock_get.return_value = [
            {"date": "2024-01-05", "open": 185, "high": 186, "low": 184, "close": 185.5, "volume": 40000000},
        ]

        result = get_historical_bars("AAPL", "daily")
        assert result["interval"] == "daily"
        assert result["count"] == 1
        assert result["bars"][0]["close"] == 185.5

    @patch("eugene.sources.fmp._safe_get")
    def test_intraday_bars(self, mock_get):
        from eugene.sources.fmp import get_historical_bars
        mock_get.return_value = [
            {"date": "2024-01-05 09:30:00", "open": 185, "high": 186, "low": 184, "close": 185.5, "volume": 1000000},
        ]

        result = get_historical_bars("AAPL", "5min", from_date="2024-01-01", to_date="2024-01-05")
        assert result["interval"] == "5min"
        assert result["count"] == 1


class TestGetScreener:
    @patch("eugene.sources.fmp._safe_get")
    def test_screener_success(self, mock_get):
        from eugene.sources.fmp import get_screener
        mock_get.return_value = [
            {"symbol": "AAPL", "companyName": "Apple", "marketCap": 2700000000000,
             "price": 175, "sector": "Technology"},
            {"symbol": "MSFT", "companyName": "Microsoft", "marketCap": 2500000000000,
             "price": 380, "sector": "Technology"},
        ]

        result = get_screener(sector="Technology", limit=10)
        assert result["count"] == 2
        assert result["results"][0]["ticker"] == "AAPL"
        assert result["source"] == "FMP"

    @patch("eugene.sources.fmp._safe_get")
    def test_screener_with_filters(self, mock_get):
        from eugene.sources.fmp import get_screener
        mock_get.return_value = []

        result = get_screener(
            market_cap_min=1000000000, price_min=10, price_max=500,
            volume_min=1000000, beta_min=0.5, beta_max=2.0,
            country="US",
        )
        assert result["count"] == 0


class TestGetCryptoQuote:
    @patch("eugene.sources.fmp._safe_get")
    def test_crypto_success(self, mock_get):
        from eugene.sources.fmp import get_crypto_quote
        mock_get.return_value = [{"price": 65000, "change": 1500, "changePercentage": 2.3}]

        result = get_crypto_quote("BTCUSD")
        assert result["symbol"] == "BTCUSD"
        assert result["price"] == 65000

    @patch("eugene.sources.fmp._safe_get")
    def test_crypto_no_data(self, mock_get):
        from eugene.sources.fmp import get_crypto_quote
        mock_get.return_value = []

        result = get_crypto_quote("FAKECOIN")
        assert "error" in result


class TestGetSharesFloat:
    @patch("eugene.sources.fmp._safe_get")
    def test_float_success(self, mock_get):
        from eugene.sources.fmp import get_shares_float
        mock_get.return_value = [{"floatShares": 15000000000, "outstandingShares": 15500000000,
                                   "freeFloat": 96.7, "date": "2024-01-01"}]

        result = get_shares_float("AAPL")
        assert result["float_shares"] == 15000000000
        assert result["source"] == "FMP"


class TestGetDividends:
    @patch("eugene.sources.fmp._safe_get")
    def test_dividends_success(self, mock_get):
        from eugene.sources.fmp import get_dividends
        mock_get.return_value = [{"date": "2024-01-15", "dividend": 0.24}]

        result = get_dividends("AAPL")
        assert result["count"] == 1
        assert result["dividends"][0]["dividend"] == 0.24


class TestGetSplits:
    @patch("eugene.sources.fmp._safe_get")
    def test_splits_success(self, mock_get):
        from eugene.sources.fmp import get_splits
        mock_get.return_value = [{"date": "2020-08-31", "numerator": 4, "denominator": 1}]

        result = get_splits("AAPL")
        assert result["count"] == 1
        assert result["splits"][0]["numerator"] == 4
