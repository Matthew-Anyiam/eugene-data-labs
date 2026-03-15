"""Tests for eugene.handlers.financials — normalized IS/BS/CF."""
from unittest.mock import patch
from eugene.handlers.financials import financials_handler, _compute_derived


class TestFinancialsHandler:
    @patch("eugene.handlers.financials.fetch_companyfacts")
    def test_basic_extraction(self, mock_fetch, sample_companyfacts):
        mock_fetch.return_value = sample_companyfacts
        resolved = {"cik": "0000320193", "ticker": "AAPL"}
        result = financials_handler(resolved, {"period": "FY", "limit": 2})

        assert "periods" in result
        assert len(result["periods"]) <= 2
        assert result["period_type"] == "FY"

    @patch("eugene.handlers.financials.fetch_companyfacts")
    def test_period_structure(self, mock_fetch, sample_companyfacts):
        mock_fetch.return_value = sample_companyfacts
        resolved = {"cik": "0000320193", "ticker": "AAPL"}
        result = financials_handler(resolved, {"period": "FY", "limit": 1})

        if result["periods"]:
            p = result["periods"][0]
            assert "period_end" in p
            assert "period_type" in p
            assert "metrics" in p
            assert "income_statement" in p
            assert "balance_sheet" in p
            assert "cash_flow_statement" in p

    @patch("eugene.handlers.financials.fetch_companyfacts")
    def test_empty_data(self, mock_fetch):
        mock_fetch.return_value = {"facts": {"us-gaap": {}, "dei": {}}}
        resolved = {"cik": "0000320193", "ticker": "TEST"}
        result = financials_handler(resolved, {"period": "FY", "limit": 5})

        assert result["periods"] == []
        assert result["concepts_found"] == []


class TestDerivedMetrics:
    def test_free_cf_computed(self):
        metrics = {
            "operating_cf": {"value": 100, "unit": "USD"},
            "capex": {"value": 30, "unit": "USD"},
        }
        _compute_derived(metrics, None)
        assert metrics["free_cf"]["value"] == 70
        assert metrics["free_cf"]["derived"] is True

    def test_ebitda_computed(self):
        metrics = {
            "operating_income": {"value": 200, "unit": "USD"},
            "depreciation_amortization": {"value": 50, "unit": "USD"},
        }
        _compute_derived(metrics, None)
        assert metrics["ebitda"]["value"] == 250

    def test_free_cf_none_when_missing(self):
        metrics = {"operating_cf": {"value": 100, "unit": "USD"}}
        _compute_derived(metrics, None)
        assert metrics["free_cf"] is None
