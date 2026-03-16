"""Tests for FMP-backed handlers: ohlcv, float, corporate_actions."""
from unittest.mock import patch


# ===== OHLCV Handler =====

class TestOhlcvHandler:
    @patch("eugene.handlers.ohlcv.get_historical_bars")
    def test_ohlcv_daily(self, mock_bars):
        from eugene.handlers.ohlcv import ohlcv_handler
        mock_bars.return_value = {
            "ticker": "AAPL", "interval": "daily",
            "bars": [
                {"date": "2024-01-05", "open": 185, "high": 186, "low": 184, "close": 185.5, "volume": 40000000},
                {"date": "2024-01-04", "open": 184, "high": 185, "low": 183, "close": 184.5, "volume": 42000000},
            ],
            "count": 2,
        }
        resolved = {"ticker": "AAPL", "cik": "0000320193"}

        result = ohlcv_handler(resolved, {})

        assert result["ticker"] == "AAPL"
        assert result["interval"] == "daily"
        assert result["count"] == 2
        mock_bars.assert_called_once_with("AAPL", interval="daily", from_date=None, to_date=None)

    @patch("eugene.handlers.ohlcv.get_historical_bars")
    def test_ohlcv_custom_interval(self, mock_bars):
        from eugene.handlers.ohlcv import ohlcv_handler
        mock_bars.return_value = {"ticker": "TSLA", "interval": "1hour", "bars": [], "count": 0}
        resolved = {"ticker": "TSLA", "cik": "0001318605"}

        ohlcv_handler(resolved, {"interval": "1hour"})

        mock_bars.assert_called_once_with("TSLA", interval="1hour", from_date=None, to_date=None)

    @patch("eugene.handlers.ohlcv.get_historical_bars")
    def test_ohlcv_date_range(self, mock_bars):
        from eugene.handlers.ohlcv import ohlcv_handler
        mock_bars.return_value = {"ticker": "AAPL", "interval": "daily", "bars": [], "count": 0}
        resolved = {"ticker": "AAPL", "cik": "0000320193"}

        ohlcv_handler(resolved, {"from": "2024-01-01", "to": "2024-06-30"})

        mock_bars.assert_called_once_with("AAPL", interval="daily", from_date="2024-01-01", to_date="2024-06-30")

    def test_ohlcv_no_ticker(self):
        from eugene.handlers.ohlcv import ohlcv_handler
        resolved = {"cik": "0000320193"}

        result = ohlcv_handler(resolved, {})

        assert "error" in result


# ===== Float Handler =====

class TestFloatHandler:
    @patch("eugene.handlers.float_data.get_shares_float")
    def test_float_returns_data(self, mock_float):
        from eugene.handlers.float_data import float_handler
        mock_float.return_value = {
            "ticker": "AAPL", "float_shares": 15000000000,
            "outstanding_shares": 15200000000, "free_float": 98.7,
            "date": "2024-01-15", "source": "FMP",
        }
        resolved = {"ticker": "AAPL", "cik": "0000320193"}

        result = float_handler(resolved, {})

        assert result["float_shares"] == 15000000000
        assert result["outstanding_shares"] == 15200000000
        assert "short_interest" in result
        assert result["short_interest"]["status"] == "coming_soon"

    def test_float_no_ticker(self):
        from eugene.handlers.float_data import float_handler
        resolved = {"cik": "0000320193"}

        result = float_handler(resolved, {})

        assert "error" in result


# ===== Corporate Actions Handler =====

class TestCorporateActionsHandler:
    @patch("eugene.handlers.corporate_actions.events_handler")
    @patch("eugene.handlers.corporate_actions.get_splits")
    @patch("eugene.handlers.corporate_actions.get_dividends")
    def test_corporate_actions_merges_sources(self, mock_divs, mock_splits, mock_events):
        from eugene.handlers.corporate_actions import corporate_actions_handler
        mock_divs.return_value = {
            "dividends": [
                {"date": "2024-08-15", "dividend": 0.25, "record_date": "2024-08-12"},
                {"date": "2024-05-15", "dividend": 0.25, "record_date": "2024-05-12"},
            ]
        }
        mock_splits.return_value = {
            "splits": [
                {"date": "2020-08-31", "numerator": 4, "denominator": 1},
            ]
        }
        mock_events.return_value = {
            "events": [
                {"form": "8-K", "filed_date": "2024-07-15", "accession": "0000320193-24-000090"},
            ],
            "count": 1,
        }
        resolved = {"ticker": "AAPL", "cik": "0000320193"}

        result = corporate_actions_handler(resolved, {})

        assert result["ticker"] == "AAPL"
        assert result["count"] == 4  # 2 dividends + 1 split + 1 event
        types = {a["type"] for a in result["actions"]}
        assert types == {"dividend", "split", "8k_event"}

    @patch("eugene.handlers.corporate_actions.events_handler")
    @patch("eugene.handlers.corporate_actions.get_splits")
    @patch("eugene.handlers.corporate_actions.get_dividends")
    def test_corporate_actions_sorted_by_date(self, mock_divs, mock_splits, mock_events):
        from eugene.handlers.corporate_actions import corporate_actions_handler
        mock_divs.return_value = {"dividends": [{"date": "2024-01-01", "dividend": 0.25}]}
        mock_splits.return_value = {"splits": []}
        mock_events.return_value = {"events": [{"form": "8-K", "filed_date": "2024-06-01"}], "count": 1}
        resolved = {"ticker": "AAPL", "cik": "0000320193"}

        result = corporate_actions_handler(resolved, {})

        dates = [a["date"] for a in result["actions"]]
        assert dates == sorted(dates, reverse=True)

    @patch("eugene.handlers.corporate_actions.events_handler")
    @patch("eugene.handlers.corporate_actions.get_splits")
    @patch("eugene.handlers.corporate_actions.get_dividends")
    def test_corporate_actions_handles_fmp_failure(self, mock_divs, mock_splits, mock_events):
        from eugene.handlers.corporate_actions import corporate_actions_handler
        mock_divs.side_effect = Exception("FMP down")
        mock_splits.side_effect = Exception("FMP down")
        mock_events.return_value = {"events": [], "count": 0}
        resolved = {"ticker": "AAPL", "cik": "0000320193"}

        result = corporate_actions_handler(resolved, {})

        assert "warnings" in result
        assert len(result["warnings"]) == 2

    @patch("eugene.handlers.corporate_actions.events_handler")
    @patch("eugene.handlers.corporate_actions.get_splits")
    @patch("eugene.handlers.corporate_actions.get_dividends")
    def test_corporate_actions_no_ticker(self, mock_divs, mock_splits, mock_events):
        from eugene.handlers.corporate_actions import corporate_actions_handler
        mock_events.return_value = {"events": [], "count": 0}
        resolved = {"cik": "0000320193"}

        result = corporate_actions_handler(resolved, {})

        assert result["ticker"] is None
        mock_divs.assert_not_called()
        mock_splits.assert_not_called()
