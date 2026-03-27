"""Tests for FRED economic data source."""
from unittest.mock import patch, MagicMock

import pytest
import pandas as pd

from eugene.cache import cache_clear
from eugene.sources.fred import get_category, get_series, get_all, FRED_SERIES


@pytest.fixture(autouse=True)
def clear_cache():
    cache_clear()
    yield
    cache_clear()


def _mock_series(values, dates=None):
    """Create a mock pandas Series matching fredapi output."""
    if dates is None:
        dates = pd.date_range("2024-01-01", periods=len(values), freq="MS")
    return pd.Series(values, index=dates)


class TestFredSeries:
    def test_series_categories_defined(self):
        assert "inflation" in FRED_SERIES
        assert "employment" in FRED_SERIES
        assert "rates" in FRED_SERIES
        assert "gdp" in FRED_SERIES
        assert len(FRED_SERIES) == 9


class TestGetCategory:
    @patch("eugene.sources.fred._get_fred")
    @patch("eugene.sources.fred.FRED_LIMITER")
    def test_category_success(self, mock_limiter, mock_get_fred):
        mock_fred = MagicMock()
        mock_fred.get_series.return_value = _mock_series([5.33, 5.50])
        mock_get_fred.return_value = mock_fred

        result = get_category("rates")

        assert result["category"] == "rates"
        assert result["source"] == "FRED"
        assert "FEDFUNDS" in result["series"]
        assert result["series"]["FEDFUNDS"]["value"] == 5.5

    @patch("eugene.sources.fred._get_fred")
    @patch("eugene.sources.fred.FRED_LIMITER")
    def test_category_unknown(self, mock_limiter, mock_get_fred):
        result = get_category("unknown_category")
        assert "error" in result
        assert "valid" in result

    @patch("eugene.sources.fred._get_fred")
    @patch("eugene.sources.fred.FRED_LIMITER")
    def test_category_fetch_error(self, mock_limiter, mock_get_fred):
        mock_fred = MagicMock()
        mock_fred.get_series.side_effect = Exception("API error")
        mock_get_fred.return_value = mock_fred

        result = get_category("rates")
        # Should still return a result with error entries
        assert result["category"] == "rates"
        for series_data in result["series"].values():
            assert "error" in series_data


class TestGetSeries:
    @patch("eugene.sources.fred._get_fred")
    @patch("eugene.sources.fred.FRED_LIMITER")
    def test_series_success(self, mock_limiter, mock_get_fred):
        mock_fred = MagicMock()
        mock_fred.get_series.return_value = _mock_series([3.5, 3.6, 3.7])
        mock_get_fred.return_value = mock_fred

        result = get_series("FEDFUNDS")

        assert result["series_id"] == "FEDFUNDS"
        assert result["source"] == "FRED"
        assert len(result["data"]) == 3
        assert result["data"][-1]["value"] == 3.7

    @patch("eugene.sources.fred._get_fred")
    @patch("eugene.sources.fred.FRED_LIMITER")
    def test_series_error(self, mock_limiter, mock_get_fred):
        mock_fred = MagicMock()
        mock_fred.get_series.side_effect = Exception("Bad series")
        mock_get_fred.return_value = mock_fred

        result = get_series("INVALID")
        assert "error" in result

    @patch("eugene.sources.fred._get_fred")
    @patch("eugene.sources.fred.FRED_LIMITER")
    def test_series_empty(self, mock_limiter, mock_get_fred):
        mock_fred = MagicMock()
        mock_fred.get_series.return_value = pd.Series([], dtype=float)
        mock_get_fred.return_value = mock_fred

        result = get_series("EMPTY")
        assert "error" in result


class TestGetAll:
    @patch("eugene.sources.fred.get_category")
    def test_get_all(self, mock_cat):
        mock_cat.return_value = {"category": "test", "series": {}, "source": "FRED"}

        result = get_all()

        assert "categories" in result
        assert result["source"] == "FRED"
        assert len(result["categories"]) == len(FRED_SERIES)
