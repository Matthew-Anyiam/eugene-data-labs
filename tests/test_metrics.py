"""Tests for eugene.handlers.metrics — financial ratio computation."""
from eugene.handlers.metrics import (
    _profitability, _liquidity, _valuation, _growth, _per_share, _v, _div, _pct, _net_debt,
)


def _metric(value, unit="USD"):
    """Helper to create a metric dict like the financials handler returns."""
    if value is None:
        return None
    return {"value": value, "unit": unit, "source_tag": "test:Tag"}


def _make_metrics(**kwargs):
    """Build a metrics dict from keyword arguments."""
    return {k: _metric(v) for k, v in kwargs.items()}


# ---------------------------------------------------------------------------
# Helper tests
# ---------------------------------------------------------------------------

class TestHelpers:
    def test_v_extracts_value(self):
        assert _v({"rev": {"value": 100}}, "rev") == 100

    def test_v_returns_none_for_missing(self):
        assert _v({}, "rev") is None

    def test_v_returns_none_for_none_entry(self):
        assert _v({"rev": None}, "rev") is None

    def test_div_normal(self):
        assert _div(10, 5) == 2.0

    def test_div_by_zero(self):
        assert _div(10, 0) is None

    def test_div_none_args(self):
        assert _div(None, 5) is None
        assert _div(10, None) is None

    def test_pct_normal(self):
        assert _pct(110, 100) == 0.1

    def test_pct_zero_prior(self):
        assert _pct(110, 0) is None

    def test_pct_none(self):
        assert _pct(None, 100) is None


# ---------------------------------------------------------------------------
# Ratio category tests
# ---------------------------------------------------------------------------

class TestProfitability:
    def test_all_ratios(self):
        m = _make_metrics(
            revenue=1000, net_income=200, gross_profit=600,
            operating_income=300, ebitda=400,
            stockholders_equity=500, total_assets=2000,
            current_liabilities=100,
        )
        r = _profitability(m)
        assert r["gross_margin"] == 0.6
        assert r["operating_margin"] == 0.3
        assert r["net_margin"] == 0.2
        assert r["roe"] == 0.4
        assert r["roa"] == 0.1

    def test_missing_revenue(self):
        m = _make_metrics(net_income=200)
        r = _profitability(m)
        assert r["gross_margin"] is None
        assert r["net_margin"] is None


class TestLiquidity:
    def test_all_ratios(self):
        m = _make_metrics(
            current_assets=500, current_liabilities=200,
            inventory=100, cash=50,
        )
        r = _liquidity(m)
        assert r["current_ratio"] == 2.5
        assert r["quick_ratio"] == 2.0
        assert r["cash_ratio"] == 0.25

    def test_missing_inventory_defaults_zero(self):
        """When inventory is None (service co), quick_ratio = current_ratio."""
        m = _make_metrics(current_assets=500, current_liabilities=200, cash=50)
        r = _liquidity(m)
        assert r["quick_ratio"] == 2.5

    def test_missing_cash_returns_none(self):
        """Cash ratio should be None when cash is missing, not 0."""
        m = _make_metrics(current_assets=500, current_liabilities=200)
        r = _liquidity(m)
        assert r["cash_ratio"] is None


class TestLeverage:
    def test_net_debt_both_present(self):
        assert _net_debt(1000, 200) == 800

    def test_net_debt_missing_cash(self):
        """Net debt should be None when cash is missing."""
        assert _net_debt(1000, None) is None

    def test_net_debt_missing_debt(self):
        assert _net_debt(None, 200) is None


class TestValuation:
    def test_ev_calculation(self):
        m = _make_metrics(
            net_income=100, revenue=1000, stockholders_equity=500,
            free_cf=80, ebitda=200, shares_outstanding=100,
            total_debt=300, cash=50, dividends_paid=-20,
        )
        market = {"price": 175, "market_cap": 17500}
        r = _valuation(m, market)
        # EV = 17500 + 300 - 50 = 17750
        assert r["enterprise_value"] == 17750
        assert r["pe_ratio"] == _div(17500, 100)

    def test_ev_missing_debt(self):
        """EV should still compute with missing debt (treated as 0)."""
        m = _make_metrics(net_income=100, revenue=1000, cash=50)
        market = {"price": 175, "market_cap": 17500}
        r = _valuation(m, market)
        # EV = 17500 + 0 - 50 = 17450
        assert r["enterprise_value"] == 17450

    def test_ev_missing_cash(self):
        """EV should still compute with missing cash (treated as 0)."""
        m = _make_metrics(net_income=100, revenue=1000, total_debt=300)
        market = {"price": 175, "market_cap": 17500}
        r = _valuation(m, market)
        # EV = 17500 + 300 - 0 = 17800
        assert r["enterprise_value"] == 17800


class TestGrowth:
    def test_revenue_growth(self):
        current = _make_metrics(revenue=110, net_income=50)
        prior = _make_metrics(revenue=100, net_income=40)
        r = _growth(current, prior)
        assert r["revenue_growth"] == 0.1
        assert r["earnings_growth"] == 0.25

    def test_missing_prior(self):
        current = _make_metrics(revenue=110)
        prior = _make_metrics()
        r = _growth(current, prior)
        assert r["revenue_growth"] is None


class TestPerShare:
    def test_all_per_share(self):
        m = _make_metrics(
            stockholders_equity=500, revenue=1000,
            free_cf=80, operating_cf=100, net_income=200,
            shares_outstanding=10,
        )
        r = _per_share(m)
        assert r["book_value_per_share"] == 50.0
        assert r["revenue_per_share"] == 100.0
        assert r["fcf_per_share"] == 8.0
