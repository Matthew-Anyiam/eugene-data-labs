"""Tests for financial validation engine."""
from eugene.validation.financial import validate_financials, validate_metrics


def test_valid_financials():
    data = {
        "income_statement": {"revenue": 100_000, "net_income": 15_000},
        "balance_sheet": {"total_assets": 200_000, "total_liabilities": 120_000, "stockholders_equity": 80_000},
        "cash_flow": {"operating_cash_flow": 25_000},
    }
    result = validate_financials(data)
    assert result.is_valid
    assert result.confidence_score == 1.0
    assert result.checks_passed == result.checks_total


def test_negative_assets_fails():
    data = {"balance_sheet": {"total_assets": -5000}, "income_statement": {"revenue": 100}}
    result = validate_financials(data)
    assert not result.is_valid
    assert any("negative" in e.lower() for e in result.errors)


def test_bs_equation_warning():
    data = {
        "balance_sheet": {"total_assets": 100, "total_liabilities": 50, "stockholders_equity": 20},
        "income_statement": {"revenue": 10},
    }
    result = validate_financials(data)
    assert len(result.warnings) > 0
    assert any("equation" in w.lower() for w in result.warnings)


def test_empty_financials_fails():
    result = validate_financials({})
    assert not result.is_valid
    assert any("no financial" in e.lower() for e in result.errors)


def test_reasonable_margin_warning():
    data = {
        "income_statement": {"revenue": 100, "net_income": 500},
        "balance_sheet": {"total_assets": 1000},
    }
    result = validate_financials(data)
    assert any("margin" in w.lower() for w in result.warnings)


def test_valid_metrics():
    data = {
        "profitability": {"gross_margin": 0.4, "net_margin": 0.15},
        "liquidity": {"current_ratio": 2.1},
        "leverage": {"debt_to_equity": 0.8},
        "valuation": {"pe_ratio": 25.0},
    }
    result = validate_metrics(data)
    assert result.is_valid
    assert result.confidence_score == 1.0


def test_extreme_pe_warning():
    data = {"valuation": {"pe_ratio": 10000}}
    result = validate_metrics(data)
    assert len(result.warnings) > 0
    assert any("pe" in w.lower() for w in result.warnings)


def test_extreme_current_ratio_warning():
    data = {"liquidity": {"current_ratio": 150}}
    result = validate_metrics(data)
    assert any("current" in w.lower() for w in result.warnings)


def test_validation_result_to_dict():
    data = {"income_statement": {"revenue": 100}, "balance_sheet": {"total_assets": 200}}
    result = validate_financials(data)
    d = result.to_dict()
    assert "confidence_score" in d
    assert "checks_passed" in d
    assert "checks_total" in d
    assert isinstance(d["errors"], list)
    assert isinstance(d["warnings"], list)
