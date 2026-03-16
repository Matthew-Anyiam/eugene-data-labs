"""Tests for CLI commands."""
from unittest.mock import patch
from click.testing import CliRunner
from eugene.cli import main


runner = CliRunner()


class TestCLIVersion:
    def test_version_flag(self):
        result = runner.invoke(main, ["--version"])
        assert result.exit_code == 0
        assert "0.8.0" in result.output


class TestCLICaps:
    @patch("eugene.router.capabilities")
    def test_caps_command(self, mock_caps):
        mock_caps.return_value = {"service": "eugene-intelligence", "version": "0.8.0"}

        result = runner.invoke(main, ["caps"])

        assert result.exit_code == 0
        assert "eugene-intelligence" in result.output


class TestCLIInfo:
    def test_info_command(self):
        result = runner.invoke(main, ["info"])

        assert result.exit_code == 0
        assert "Eugene Intelligence" in result.output
        assert "API Keys:" in result.output


class TestCLISec:
    @patch("eugene.router.query")
    def test_sec_command(self, mock_query):
        mock_query.return_value = {
            "status": "success",
            "data": {"name": "Apple Inc"},
        }

        result = runner.invoke(main, ["sec", "AAPL", "-e", "profile"])

        assert result.exit_code == 0
        mock_query.assert_called_once()

    @patch("eugene.router.query")
    def test_sec_with_options(self, mock_query):
        mock_query.return_value = {"status": "success", "data": {}}

        result = runner.invoke(main, ["sec", "AAPL", "-e", "financials", "-p", "Q", "-l", "5"])

        assert result.exit_code == 0
        call_args = mock_query.call_args
        assert call_args[1]["period"] == "Q"
        assert call_args[1]["limit"] == 5


class TestCLIEcon:
    @patch("eugene.sources.fred.get_category")
    def test_econ_category(self, mock_cat):
        mock_cat.return_value = {"data": [{"series_id": "FEDFUNDS", "value": 5.33}]}

        result = runner.invoke(main, ["econ", "-c", "rates"])

        assert result.exit_code == 0


class TestCLIPrices:
    @patch("eugene.sources.fmp.get_price")
    def test_prices_command(self, mock_price):
        mock_price.return_value = {"ticker": "AAPL", "price": 175.50}

        result = runner.invoke(main, ["prices", "AAPL"])

        assert result.exit_code == 0
        assert "175.5" in result.output


class TestCLICrypto:
    @patch("eugene.sources.fmp.get_crypto_quote")
    def test_crypto_quote(self, mock_quote):
        mock_quote.return_value = {"symbol": "BTCUSD", "price": 65000.0}

        result = runner.invoke(main, ["crypto", "BTCUSD"])

        assert result.exit_code == 0
        assert "65000" in result.output
