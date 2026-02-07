"""
Eugene Intelligence - XBRL Data Validator
Comprehensive validation layer for financial metrics to prevent bad SEC data reaching agents.
"""
import json
import logging
import statistics
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
from eugene.config import Config, get_config

logger = logging.getLogger(__name__)

@dataclass
class ValidationResult:
    """Result of a single validation check."""
    check_name: str
    status: str  # 'pass', 'fail', 'warning'
    message: str
    severity: str  # 'low', 'medium', 'high', 'critical'

@dataclass
class ValidatedMetric:
    """A financial metric with validation results and confidence scoring."""
    value: Any
    raw_value: Any
    xbrl_tag: str
    source: str
    confidence: int  # 0-100
    validation: Dict[str, str]  # check_name -> status
    flags: List[str]
    validation_results: List[ValidationResult]

    def to_dict(self):
        return {
            "value": self.value,
            "raw_value": self.raw_value,
            "xbrl_tag": self.xbrl_tag,
            "source": self.source,
            "confidence": self.confidence,
            "validation": self.validation,
            "flags": self.flags
        }

class XBRLValidator:
    """Validates XBRL financial metrics before they reach agents."""

    def __init__(self, config=None):
        self.config = config or get_config()

        # Critical metrics that should never be negative
        self.positive_only_metrics = {
            'revenue', 'total_assets', 'cash_and_equivalents', 'shares_outstanding'
        }

        # Metrics where negative values might be acceptable but worth flagging
        self.usually_positive_metrics = {
            'operating_income', 'net_income', 'operating_cash_flow', 'total_equity'
        }

        # Source quality scoring
        self.source_weights = {
            '10-K': 100,
            '10-Q': 85,
            '8-K': 70,
            '10-K/A': 95,  # amended
            '10-Q/A': 80   # amended
        }

    def validate_financials(self, xbrl_financials, ticker=None) -> Dict[str, ValidatedMetric]:
        """
        Validate all financial metrics in an XBRLFinancials object.

        Args:
            xbrl_financials: XBRLFinancials object from XBRL client
            ticker: Optional ticker for historical comparison

        Returns:
            Dict of metric_name -> ValidatedMetric
        """
        validated_metrics = {}

        # Get historical data for trend analysis if ticker provided
        historical_data = self._get_historical_context(ticker) if ticker else {}

        for metric_name, fact in xbrl_financials.facts.items():
            validated_metric = self._validate_single_metric(
                metric_name, fact, historical_data.get(metric_name, [])
            )
            validated_metrics[metric_name] = validated_metric

        return validated_metrics

    def _validate_single_metric(self, metric_name: str, fact, historical_values: List[float]) -> ValidatedMetric:
        """Validate a single financial metric."""
        validation_results = []
        flags = []

        # 1. Magnitude Check - flag >100x YoY changes
        magnitude_result = self._check_magnitude(metric_name, fact.value, historical_values)
        validation_results.append(magnitude_result)
        if magnitude_result.status != 'pass':
            flags.append(f"Magnitude {magnitude_result.status}: {magnitude_result.message}")

        # 2. Sign Check - flag negative values for metrics that should be positive
        sign_result = self._check_sign(metric_name, fact.value)
        validation_results.append(sign_result)
        if sign_result.status != 'pass':
            flags.append(f"Sign {sign_result.status}: {sign_result.message}")

        # 3. Historical Outlier Check - flag >3 standard deviations from history
        outlier_result = self._check_historical_outlier(metric_name, fact.value, historical_values)
        validation_results.append(outlier_result)
        if outlier_result.status != 'pass':
            flags.append(f"Outlier {outlier_result.status}: {outlier_result.message}")

        # 4. Data Completeness Check
        completeness_result = self._check_data_completeness(fact)
        validation_results.append(completeness_result)
        if completeness_result.status != 'pass':
            flags.append(f"Completeness {completeness_result.status}: {completeness_result.message}")

        # Calculate confidence score
        confidence = self._calculate_confidence(fact, validation_results)

        # Build validation summary
        validation_summary = {
            result.check_name: result.status for result in validation_results
        }

        # Format source string
        source_str = f"{fact.form} {fact.filed}" if fact.form and fact.filed else "Unknown source"

        return ValidatedMetric(
            value=fact.value,
            raw_value=fact.value,
            xbrl_tag=fact.tag,
            source=source_str,
            confidence=confidence,
            validation=validation_summary,
            flags=flags,
            validation_results=validation_results
        )

    def _check_magnitude(self, metric_name: str, current_value: float, historical_values: List[float]) -> ValidationResult:
        """Check for extreme year-over-year changes (>100x)."""
        if not historical_values or current_value is None:
            return ValidationResult(
                check_name="magnitude_check",
                status="pass",
                message="No historical data for comparison",
                severity="low"
            )

        # Compare to most recent historical value
        recent_value = historical_values[0] if historical_values else None
        if recent_value is None or recent_value == 0:
            return ValidationResult(
                check_name="magnitude_check",
                status="warning",
                message="Cannot compare to zero/null historical value",
                severity="low"
            )

        ratio = abs(current_value / recent_value)
        reverse_ratio = abs(recent_value / current_value)

        # Check both directions (increase and decrease)
        max_ratio = max(ratio, reverse_ratio)

        if max_ratio > 100:
            return ValidationResult(
                check_name="magnitude_check",
                status="fail",
                message=f"Extreme change: {max_ratio:.0f}x from previous period",
                severity="critical"
            )
        elif max_ratio >= 10:
            return ValidationResult(
                check_name="magnitude_check",
                status="warning",
                message=f"Large change: {max_ratio:.1f}x from previous period",
                severity="medium"
            )
        else:
            return ValidationResult(
                check_name="magnitude_check",
                status="pass",
                message="Normal magnitude change",
                severity="low"
            )

    def _check_sign(self, metric_name: str, value: float) -> ValidationResult:
        """Check if metric has expected sign (positive/negative)."""
        if value is None:
            return ValidationResult(
                check_name="sign_check",
                status="warning",
                message="Null value",
                severity="medium"
            )

        if metric_name in self.positive_only_metrics and value < 0:
            return ValidationResult(
                check_name="sign_check",
                status="fail",
                message=f"{metric_name} should not be negative: {value}",
                severity="high"
            )

        if metric_name in self.usually_positive_metrics and value < 0:
            return ValidationResult(
                check_name="sign_check",
                status="warning",
                message=f"{metric_name} is negative, worth reviewing: {value}",
                severity="medium"
            )

        return ValidationResult(
            check_name="sign_check",
            status="pass",
            message="Expected sign",
            severity="low"
        )

    def _check_historical_outlier(self, metric_name: str, current_value: float, historical_values: List[float]) -> ValidationResult:
        """Check if current value is >3 standard deviations from historical mean."""
        if len(historical_values) < 3 or current_value is None:
            return ValidationResult(
                check_name="outlier_check",
                status="pass",
                message="Insufficient historical data",
                severity="low"
            )

        # Filter out None/null values
        clean_values = [v for v in historical_values if v is not None]
        if len(clean_values) < 3:
            return ValidationResult(
                check_name="outlier_check",
                status="pass",
                message="Insufficient clean historical data",
                severity="low"
            )

        try:
            mean = statistics.mean(clean_values)
            if len(clean_values) == 1:
                return ValidationResult(
                    check_name="outlier_check",
                    status="pass",
                    message="Only one historical value",
                    severity="low"
                )

            stdev = statistics.stdev(clean_values)
            if stdev == 0:
                # All historical values are identical
                if current_value != mean:
                    return ValidationResult(
                        check_name="outlier_check",
                        status="warning",
                        message=f"Value {current_value} differs from constant historical {mean}",
                        severity="medium"
                    )
                else:
                    return ValidationResult(
                        check_name="outlier_check",
                        status="pass",
                        message="Consistent with historical values",
                        severity="low"
                    )

            z_score = abs((current_value - mean) / stdev)

            if z_score > 3:
                return ValidationResult(
                    check_name="outlier_check",
                    status="fail",
                    message=f"Extreme outlier: {z_score:.1f} std devs from mean",
                    severity="high"
                )
            elif z_score > 2:
                return ValidationResult(
                    check_name="outlier_check",
                    status="warning",
                    message=f"Potential outlier: {z_score:.1f} std devs from mean",
                    severity="medium"
                )
            else:
                return ValidationResult(
                    check_name="outlier_check",
                    status="pass",
                    message="Within normal range",
                    severity="low"
                )

        except statistics.StatisticsError as e:
            return ValidationResult(
                check_name="outlier_check",
                status="warning",
                message=f"Statistical analysis failed: {e}",
                severity="low"
            )

    def _check_data_completeness(self, fact) -> ValidationResult:
        """Check if the XBRL fact has complete metadata."""
        missing_fields = []

        if not fact.tag:
            missing_fields.append("xbrl_tag")
        if not fact.period_end:
            missing_fields.append("period_end")
        if not fact.filed:
            missing_fields.append("filing_date")
        if not fact.form:
            missing_fields.append("form_type")

        if missing_fields:
            return ValidationResult(
                check_name="completeness_check",
                status="warning",
                message=f"Missing metadata: {', '.join(missing_fields)}",
                severity="medium"
            )

        return ValidationResult(
            check_name="completeness_check",
            status="pass",
            message="Complete metadata",
            severity="low"
        )

    def _calculate_confidence(self, fact, validation_results: List[ValidationResult]) -> int:
        """Calculate confidence score 0-100 based on validation results and source quality."""
        base_confidence = 100

        # Source quality component (40% of score)
        source_weight = self.source_weights.get(fact.form, 50)  # default 50 for unknown forms
        source_component = int(source_weight * 0.4)

        # Data freshness component (20% of score)
        freshness_component = self._calculate_freshness_score(fact.filed)

        # Validation results component (40% of score)
        validation_component = self._calculate_validation_score(validation_results)

        total_confidence = source_component + freshness_component + validation_component
        return max(0, min(100, total_confidence))  # clamp to 0-100

    def _calculate_freshness_score(self, filed_date: str) -> int:
        """Calculate freshness score based on filing date (20% of total confidence)."""
        if not filed_date:
            return 10  # low score for missing date

        try:
            filed = datetime.fromisoformat(filed_date.replace('Z', '+00:00'))
            days_old = (datetime.now().replace(tzinfo=filed.tzinfo) - filed).days

            if days_old <= 90:
                return 20  # fresh data
            elif days_old <= 365:
                return 15  # acceptable
            elif days_old <= 730:
                return 10  # getting stale
            else:
                return 5   # very stale
        except (ValueError, TypeError):
            return 10  # parsing error

    def _calculate_validation_score(self, validation_results: List[ValidationResult]) -> int:
        """Calculate validation score based on check results (40% of total confidence)."""
        total_weight = 0
        weighted_score = 0

        # Weight validation checks by importance
        check_weights = {
            'magnitude_check': 15,    # critical - catches data errors
            'sign_check': 10,         # important - catches obvious errors
            'outlier_check': 10,      # important - catches anomalies
            'completeness_check': 5   # nice to have - metadata quality
        }

        for result in validation_results:
            weight = check_weights.get(result.check_name, 5)
            total_weight += weight

            if result.status == 'pass':
                weighted_score += weight
            elif result.status == 'warning':
                weighted_score += weight * 0.7  # partial credit
            else:  # fail
                weighted_score += 0  # no credit

        if total_weight == 0:
            return 20  # default if no checks

        return int((weighted_score / total_weight) * 40)  # scale to 40% of total confidence

    def _get_historical_context(self, ticker: str) -> Dict[str, List[float]]:
        """Get historical values for trend analysis."""
        if not ticker:
            return {}

        try:
            from eugene.sources.xbrl import XBRLClient
            xbrl = XBRLClient(self.config)

            historical_data = {}
            key_metrics = ['revenue', 'operating_income', 'net_income', 'total_assets',
                          'total_debt', 'cash_and_equivalents']

            for metric in key_metrics:
                try:
                    historical_facts = xbrl.get_historical(ticker, metric, years=5)
                    values = [fact.value for fact in historical_facts if fact.value is not None]
                    if values:
                        historical_data[metric] = values
                except Exception as e:
                    logger.warning(f"Failed to get historical {metric} for {ticker}: {e}")

            return historical_data

        except Exception as e:
            logger.warning(f"Failed to get historical context for {ticker}: {e}")
            return {}

def validate_xbrl_data(xbrl_financials, ticker=None, config=None):
    """
    Convenience function to validate XBRL financial data.

    Args:
        xbrl_financials: XBRLFinancials object
        ticker: Optional ticker for historical comparison
        config: Optional config object

    Returns:
        Dict[str, ValidatedMetric]: Validated metrics
    """
    validator = XBRLValidator(config)
    return validator.validate_financials(xbrl_financials, ticker)