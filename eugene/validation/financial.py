"""
Financial data validation — quality scores for financials and metrics extracts.
"""
from eugene.validation.engine import Validator, ValidationResult


class FinancialsValidator(Validator):
    """Validate XBRL financial statement data."""

    def __init__(self):
        super().__init__()

        # Revenue should be non-negative (for non-financial companies)
        self.add_check(
            "non_negative_revenue",
            lambda d: _v(d, "revenue") is None or _v(d, "revenue") >= 0,
            "Revenue is negative",
            severity="warning",
        )

        # Net income should be reasonable relative to revenue
        self.add_check(
            "reasonable_margin",
            lambda d: _check_margin(d),
            "Net margin exceeds 200% — possible data issue",
            severity="warning",
        )

        # Total assets should be non-negative
        self.add_check(
            "non_negative_assets",
            lambda d: _v(d, "total_assets") is None or _v(d, "total_assets") >= 0,
            "Total assets is negative",
        )

        # Balance sheet equation: assets ≈ liabilities + equity (within 5%)
        self.add_check(
            "balance_sheet_equation",
            lambda d: _check_bs_equation(d),
            "Assets != Liabilities + Equity (>5% gap)",
            severity="warning",
        )

        # Has at least one financial value
        self.add_check(
            "has_data",
            lambda d: _has_any_value(d),
            "No financial values found",
        )


class MetricsValidator(Validator):
    """Validate computed financial ratios."""

    def __init__(self):
        super().__init__()

        # PE ratio should be reasonable (-500 to 5000)
        self.add_check(
            "reasonable_pe",
            lambda d: _ratio_in_range(d, "pe_ratio", -500, 5000),
            "PE ratio is extreme",
            severity="warning",
        )

        # Margins should be between -200% and 200%
        self.add_check(
            "reasonable_gross_margin",
            lambda d: _ratio_in_range(d, "gross_margin", -2, 2),
            "Gross margin is extreme (>200%)",
            severity="warning",
        )

        # Current ratio shouldn't be extreme
        self.add_check(
            "reasonable_current_ratio",
            lambda d: _ratio_in_range(d, "current_ratio", 0, 100),
            "Current ratio is extreme (>100)",
            severity="warning",
        )

        # Debt-to-equity shouldn't be extreme
        self.add_check(
            "reasonable_debt_equity",
            lambda d: _ratio_in_range(d, "debt_to_equity", -50, 100),
            "Debt-to-equity is extreme",
            severity="warning",
        )


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _v(data: dict, key: str):
    """Extract a value from financials data (handles nested period dicts)."""
    if isinstance(data, dict):
        # Direct value
        if key in data:
            return data[key]
        # Look in nested period structures (e.g. {"income_statement": {"revenue": ...}})
        for section in ("income_statement", "balance_sheet", "cash_flow"):
            if section in data and isinstance(data[section], dict):
                if key in data[section]:
                    return data[section][key]
        # Look in metrics categories
        for cat in ("profitability", "liquidity", "leverage", "valuation", "growth", "per_share"):
            if cat in data and isinstance(data[cat], dict):
                if key in data[cat]:
                    return data[cat][key]
    return None


def _check_margin(data: dict) -> bool:
    """Check if net margin is reasonable."""
    rev = _v(data, "revenue")
    ni = _v(data, "net_income")
    if rev is None or ni is None or rev == 0:
        return True  # can't check
    margin = abs(ni / rev)
    return margin <= 2.0


def _check_bs_equation(data: dict) -> bool:
    """Check assets ≈ liabilities + equity."""
    assets = _v(data, "total_assets")
    liabilities = _v(data, "total_liabilities")
    equity = _v(data, "stockholders_equity") or _v(data, "total_equity")

    if assets is None or liabilities is None or equity is None:
        return True  # can't check
    if assets == 0:
        return True

    diff = abs(assets - (liabilities + equity))
    return (diff / abs(assets)) <= 0.05


def _has_any_value(data: dict) -> bool:
    """Check that at least one financial value is present."""
    for key in ("revenue", "net_income", "total_assets", "operating_cash_flow"):
        if _v(data, key) is not None:
            return True
    return False


def _ratio_in_range(data: dict, key: str, lo: float, hi: float) -> bool:
    """Check if a ratio is within a reasonable range."""
    val = _v(data, key)
    if val is None:
        return True  # can't check, pass
    return lo <= val <= hi


# ---------------------------------------------------------------------------
# Convenience functions
# ---------------------------------------------------------------------------

def validate_financials(data: dict) -> ValidationResult:
    """Validate financial statement data, return quality result."""
    return FinancialsValidator().validate(data)


def validate_metrics(data: dict) -> ValidationResult:
    """Validate computed metrics/ratios, return quality result."""
    return MetricsValidator().validate(data)
