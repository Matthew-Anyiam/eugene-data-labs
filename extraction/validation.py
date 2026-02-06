"""
Eugene Intelligence - Quality Scoring & Validation

Implements confidence scoring and validation for extracted data.
Based on lessons from production financial AI systems.

Key principles:
- Every extraction gets a confidence score
- Low-confidence data doesn't get served
- Sanity checks catch obvious errors
- Cross-validation ensures consistency
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Tuple
from enum import Enum
import re
from datetime import date, datetime


class QualityFlag(Enum):
    """Flags indicating potential quality issues"""
    LOW_CONFIDENCE = "low_confidence"
    MISSING_REQUIRED_FIELD = "missing_required_field"
    INCONSISTENT_TOTALS = "inconsistent_totals"
    SUSPICIOUS_VALUE = "suspicious_value"
    PARSE_ERROR = "parse_error"
    TEMPORAL_MISMATCH = "temporal_mismatch"
    UNIT_AMBIGUITY = "unit_ambiguity"
    CROSS_REFERENCE_FAILED = "cross_reference_failed"


@dataclass
class FieldConfidence:
    """Confidence score for a single extracted field"""
    field_name: str
    value: Any
    confidence: float  # 0.0 to 1.0
    source_text: Optional[str] = None
    flags: List[QualityFlag] = field(default_factory=list)
    
    @property
    def is_reliable(self) -> bool:
        return self.confidence >= 0.85 and len(self.flags) == 0


@dataclass 
class ExtractionQuality:
    """Overall quality assessment for an extraction"""
    overall_confidence: float
    field_scores: Dict[str, FieldConfidence]
    flags: List[QualityFlag]
    validation_errors: List[str]
    validation_warnings: List[str]
    
    @property
    def should_serve(self) -> bool:
        """Determine if extraction quality is sufficient to serve to users"""
        return (
            self.overall_confidence >= 0.85 and
            QualityFlag.INCONSISTENT_TOTALS not in self.flags and
            QualityFlag.PARSE_ERROR not in self.flags and
            len(self.validation_errors) == 0
        )
    
    @property
    def needs_review(self) -> bool:
        """Determine if extraction should be flagged for human review"""
        return (
            0.70 <= self.overall_confidence < 0.85 or
            len(self.validation_warnings) > 0
        )
    
    def to_dict(self) -> Dict:
        return {
            "overall_confidence": self.overall_confidence,
            "should_serve": self.should_serve,
            "needs_review": self.needs_review,
            "flags": [f.value for f in self.flags],
            "validation_errors": self.validation_errors,
            "validation_warnings": self.validation_warnings,
            "field_scores": {
                k: {
                    "value": v.value,
                    "confidence": v.confidence,
                    "flags": [f.value for f in v.flags]
                }
                for k, v in self.field_scores.items()
            }
        }


class DebtExtractionValidator:
    """
    Validates extracted debt data for consistency and accuracy.
    
    Implements sanity checks based on domain knowledge:
    - Debt totals should sum correctly
    - Interest rates should be reasonable
    - Maturity dates should be in the future
    - Leverage ratios should compute correctly
    """
    
    # Reasonable bounds for financial metrics
    RATE_BOUNDS = (0.0, 0.25)  # 0% to 25% interest rate
    SPREAD_BOUNDS = (0, 2000)   # 0 to 2000 bps spread
    LEVERAGE_BOUNDS = (0, 20)   # 0x to 20x leverage
    COVERAGE_BOUNDS = (0, 100)  # 0x to 100x coverage
    
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.flags: List[QualityFlag] = []
    
    def validate(self, extraction: Dict) -> ExtractionQuality:
        """
        Run all validation checks on an extraction result.
        
        Args:
            extraction: Dictionary from debt extraction
            
        Returns:
            ExtractionQuality with scores and flags
        """
        self.errors = []
        self.warnings = []
        self.flags = []
        field_scores = {}
        
        # Validate debt instruments
        instruments = extraction.get("debt_instruments", [])
        for i, inst in enumerate(instruments):
            inst_scores = self._validate_instrument(inst, i)
            field_scores.update(inst_scores)
        
        # Validate covenants
        covenants = extraction.get("covenants", [])
        for i, cov in enumerate(covenants):
            cov_scores = self._validate_covenant(cov, i)
            field_scores.update(cov_scores)
        
        # Validate maturity schedule
        maturities = extraction.get("maturity_schedule", [])
        mat_scores = self._validate_maturity_schedule(maturities)
        field_scores.update(mat_scores)
        
        # Cross-validate totals
        self._cross_validate_totals(extraction, instruments, maturities)
        
        # Validate aggregate metrics
        metrics = extraction.get("aggregate_metrics", {})
        metric_scores = self._validate_metrics(metrics)
        field_scores.update(metric_scores)
        
        # Calculate overall confidence
        if field_scores:
            confidences = [fs.confidence for fs in field_scores.values()]
            overall = sum(confidences) / len(confidences)
        else:
            overall = 0.0
            self.flags.append(QualityFlag.MISSING_REQUIRED_FIELD)
        
        return ExtractionQuality(
            overall_confidence=overall,
            field_scores=field_scores,
            flags=self.flags,
            validation_errors=self.errors,
            validation_warnings=self.warnings
        )
    
    def _validate_instrument(self, inst: Dict, idx: int) -> Dict[str, FieldConfidence]:
        """Validate a single debt instrument"""
        scores = {}
        prefix = f"instrument_{idx}"
        
        # Check required fields
        name = inst.get("instrument_name")
        if not name:
            self.errors.append(f"Instrument {idx}: missing name")
            self.flags.append(QualityFlag.MISSING_REQUIRED_FIELD)
        
        # Validate amounts
        principal = inst.get("principal_amount")
        outstanding = inst.get("outstanding_amount")
        
        if principal is not None:
            scores[f"{prefix}_principal"] = self._score_amount(
                principal, "principal_amount"
            )
        
        if outstanding is not None:
            scores[f"{prefix}_outstanding"] = self._score_amount(
                outstanding, "outstanding_amount"
            )
            
            # Outstanding shouldn't exceed principal
            if principal and outstanding > principal * 1.05:  # 5% tolerance
                self.warnings.append(
                    f"Instrument {idx}: outstanding ({outstanding}) > principal ({principal})"
                )
        
        # Validate interest rate
        rate_type = inst.get("rate_type")
        interest_rate = inst.get("interest_rate")
        spread_bps = inst.get("spread_bps")
        
        if rate_type == "fixed" and interest_rate is not None:
            scores[f"{prefix}_rate"] = self._score_rate(interest_rate)
        elif rate_type == "floating" and spread_bps is not None:
            scores[f"{prefix}_spread"] = self._score_spread(spread_bps)
        
        # Validate maturity date
        maturity = inst.get("maturity_date")
        if maturity:
            scores[f"{prefix}_maturity"] = self._score_date(maturity, "maturity")
        
        # Use extraction confidence if provided
        ext_confidence = inst.get("confidence_score")
        if ext_confidence is not None:
            # Blend with our validation confidence
            for key in scores:
                scores[key].confidence = (scores[key].confidence + ext_confidence) / 2
        
        return scores
    
    def _validate_covenant(self, cov: Dict, idx: int) -> Dict[str, FieldConfidence]:
        """Validate a single covenant"""
        scores = {}
        prefix = f"covenant_{idx}"
        
        cov_type = cov.get("covenant_type")
        threshold = cov.get("threshold_value")
        current = cov.get("current_value")
        direction = cov.get("threshold_direction")
        
        # Check required fields
        if not cov_type:
            self.errors.append(f"Covenant {idx}: missing type")
            self.flags.append(QualityFlag.MISSING_REQUIRED_FIELD)
        
        # Validate threshold makes sense for covenant type
        if threshold is not None:
            if cov_type in ["leverage", "net_leverage"]:
                scores[f"{prefix}_threshold"] = self._score_leverage(threshold)
            elif cov_type in ["interest_coverage", "fixed_charge"]:
                scores[f"{prefix}_threshold"] = self._score_coverage(threshold)
            else:
                scores[f"{prefix}_threshold"] = FieldConfidence(
                    field_name="threshold",
                    value=threshold,
                    confidence=0.8  # Default confidence for unknown types
                )
        
        # Validate current value
        if current is not None:
            if cov_type in ["leverage", "net_leverage"]:
                scores[f"{prefix}_current"] = self._score_leverage(current)
            elif cov_type in ["interest_coverage", "fixed_charge"]:
                scores[f"{prefix}_current"] = self._score_coverage(current)
        
        # Check compliance logic
        if threshold is not None and current is not None and direction:
            in_compliance = cov.get("in_compliance")
            expected_compliance = (
                (direction == "max" and current <= threshold) or
                (direction == "min" and current >= threshold)
            )
            
            if in_compliance is not None and in_compliance != expected_compliance:
                self.warnings.append(
                    f"Covenant {idx}: compliance flag doesn't match values "
                    f"(current={current}, threshold={threshold}, direction={direction})"
                )
        
        return scores
    
    def _validate_maturity_schedule(self, maturities: List[Dict]) -> Dict[str, FieldConfidence]:
        """Validate the maturity schedule"""
        scores = {}
        
        if not maturities:
            return scores
        
        current_year = date.today().year
        total_maturities = 0
        
        for i, mat in enumerate(maturities):
            year = mat.get("fiscal_year")
            amount = mat.get("amount_due")
            
            if year is not None and amount is not None:
                total_maturities += amount
                
                # Year should be reasonable
                if year < current_year:
                    self.warnings.append(
                        f"Maturity schedule includes past year {year}"
                    )
                elif year > current_year + 30:
                    self.warnings.append(
                        f"Maturity schedule includes far future year {year}"
                    )
                
                scores[f"maturity_{year}"] = FieldConfidence(
                    field_name=f"maturity_{year}",
                    value=amount,
                    confidence=0.9 if amount > 0 else 0.7
                )
        
        scores["total_scheduled_maturities"] = FieldConfidence(
            field_name="total_scheduled_maturities",
            value=total_maturities,
            confidence=0.85
        )
        
        return scores
    
    def _cross_validate_totals(
        self, 
        extraction: Dict, 
        instruments: List[Dict],
        maturities: List[Dict]
    ):
        """Cross-validate that totals are consistent"""
        
        # Sum of instrument outstanding should ≈ total debt
        total_debt = extraction.get("aggregate_metrics", {}).get("total_debt")
        instrument_sum = sum(
            inst.get("outstanding_amount", 0) or 0 
            for inst in instruments
        )
        
        if total_debt and instrument_sum:
            diff_pct = abs(total_debt - instrument_sum) / total_debt
            if diff_pct > 0.15:  # 15% tolerance
                self.errors.append(
                    f"Debt totals inconsistent: reported {total_debt}M, "
                    f"instruments sum to {instrument_sum}M ({diff_pct:.1%} diff)"
                )
                self.flags.append(QualityFlag.INCONSISTENT_TOTALS)
            elif diff_pct > 0.05:  # 5% warning threshold
                self.warnings.append(
                    f"Debt totals slightly off: reported {total_debt}M, "
                    f"instruments sum to {instrument_sum}M ({diff_pct:.1%} diff)"
                )
        
        # Sum of maturities should ≈ total debt
        maturity_sum = sum(
            mat.get("amount_due", 0) or 0
            for mat in maturities
        )
        
        if total_debt and maturity_sum:
            diff_pct = abs(total_debt - maturity_sum) / total_debt
            if diff_pct > 0.15:
                self.warnings.append(
                    f"Maturity sum ({maturity_sum}M) differs from "
                    f"total debt ({total_debt}M) by {diff_pct:.1%}"
                )
    
    def _validate_metrics(self, metrics: Dict) -> Dict[str, FieldConfidence]:
        """Validate aggregate metrics"""
        scores = {}
        
        total_debt = metrics.get("total_debt")
        net_debt = metrics.get("net_debt")
        cash = metrics.get("cash_and_equivalents")
        ebitda = metrics.get("ebitda")
        interest = metrics.get("interest_expense")
        
        # Validate total debt
        if total_debt is not None:
            scores["total_debt"] = self._score_amount(total_debt, "total_debt")
        
        # Validate net debt = total debt - cash
        if all(v is not None for v in [total_debt, net_debt, cash]):
            expected_net = total_debt - cash
            if abs(expected_net - net_debt) > total_debt * 0.05:
                self.warnings.append(
                    f"Net debt calculation off: {total_debt} - {cash} = {expected_net}, "
                    f"but reported {net_debt}"
                )
        
        # Validate leverage ratio if we can compute it
        if total_debt and ebitda and ebitda > 0:
            computed_leverage = total_debt / ebitda
            scores["computed_leverage"] = self._score_leverage(computed_leverage)
        
        # Validate coverage ratio if we can compute it
        if ebitda and interest and interest > 0:
            computed_coverage = ebitda / interest
            scores["computed_coverage"] = self._score_coverage(computed_coverage)
        
        return scores
    
    def _score_amount(self, value: float, field_name: str) -> FieldConfidence:
        """Score a monetary amount"""
        flags = []
        confidence = 0.9
        
        if value < 0:
            flags.append(QualityFlag.SUSPICIOUS_VALUE)
            confidence = 0.5
        elif value == 0:
            confidence = 0.7  # Zero might be correct but suspicious
        elif value > 1_000_000:  # > $1 trillion, probably wrong
            flags.append(QualityFlag.SUSPICIOUS_VALUE)
            confidence = 0.4
        
        return FieldConfidence(
            field_name=field_name,
            value=value,
            confidence=confidence,
            flags=flags
        )
    
    def _score_rate(self, rate: float) -> FieldConfidence:
        """Score an interest rate"""
        flags = []
        
        if self.RATE_BOUNDS[0] <= rate <= self.RATE_BOUNDS[1]:
            confidence = 0.95
        elif rate < 0:
            confidence = 0.3
            flags.append(QualityFlag.SUSPICIOUS_VALUE)
        elif rate > 0.30:  # > 30%
            confidence = 0.5
            flags.append(QualityFlag.SUSPICIOUS_VALUE)
        else:
            confidence = 0.7
        
        return FieldConfidence(
            field_name="interest_rate",
            value=rate,
            confidence=confidence,
            flags=flags
        )
    
    def _score_spread(self, spread_bps: int) -> FieldConfidence:
        """Score a credit spread in basis points"""
        flags = []
        
        if self.SPREAD_BOUNDS[0] <= spread_bps <= self.SPREAD_BOUNDS[1]:
            confidence = 0.95
        elif spread_bps < 0:
            confidence = 0.3
            flags.append(QualityFlag.SUSPICIOUS_VALUE)
        elif spread_bps > 3000:  # > 30%
            confidence = 0.5
            flags.append(QualityFlag.SUSPICIOUS_VALUE)
        else:
            confidence = 0.7
        
        return FieldConfidence(
            field_name="spread_bps",
            value=spread_bps,
            confidence=confidence,
            flags=flags
        )
    
    def _score_leverage(self, leverage: float) -> FieldConfidence:
        """Score a leverage ratio"""
        flags = []
        
        if self.LEVERAGE_BOUNDS[0] <= leverage <= self.LEVERAGE_BOUNDS[1]:
            confidence = 0.9
        elif leverage < 0:
            confidence = 0.3
            flags.append(QualityFlag.SUSPICIOUS_VALUE)
        elif leverage > 30:
            confidence = 0.5
            flags.append(QualityFlag.SUSPICIOUS_VALUE)
        else:
            confidence = 0.7
        
        return FieldConfidence(
            field_name="leverage_ratio",
            value=leverage,
            confidence=confidence,
            flags=flags
        )
    
    def _score_coverage(self, coverage: float) -> FieldConfidence:
        """Score a coverage ratio"""
        flags = []
        
        if self.COVERAGE_BOUNDS[0] <= coverage <= self.COVERAGE_BOUNDS[1]:
            confidence = 0.9
        elif coverage < 0:
            confidence = 0.3
            flags.append(QualityFlag.SUSPICIOUS_VALUE)
        else:
            confidence = 0.7
        
        return FieldConfidence(
            field_name="coverage_ratio",
            value=coverage,
            confidence=confidence,
            flags=flags
        )
    
    def _score_date(self, date_str: str, date_type: str) -> FieldConfidence:
        """Score a date field"""
        flags = []
        confidence = 0.9
        
        try:
            parsed = datetime.strptime(date_str, "%Y-%m-%d").date()
            today = date.today()
            
            if date_type == "maturity":
                if parsed < today:
                    flags.append(QualityFlag.TEMPORAL_MISMATCH)
                    confidence = 0.5
                elif parsed > date(today.year + 50, 12, 31):
                    flags.append(QualityFlag.SUSPICIOUS_VALUE)
                    confidence = 0.6
        except (ValueError, TypeError):
            flags.append(QualityFlag.PARSE_ERROR)
            confidence = 0.4
        
        return FieldConfidence(
            field_name=date_type + "_date",
            value=date_str,
            confidence=confidence,
            flags=flags
        )


# ============================================
# Convenience Functions
# ============================================

def validate_extraction(extraction: Dict) -> ExtractionQuality:
    """Validate an extraction result"""
    validator = DebtExtractionValidator()
    return validator.validate(extraction)


def should_serve_extraction(extraction: Dict) -> Tuple[bool, ExtractionQuality]:
    """Check if an extraction is good enough to serve"""
    quality = validate_extraction(extraction)
    return quality.should_serve, quality


# ============================================
# Testing
# ============================================

if __name__ == "__main__":
    # Test with sample extraction
    sample_extraction = {
        "debt_instruments": [
            {
                "instrument_name": "Senior Term Loan B",
                "instrument_type": "term_loan",
                "principal_amount": 2000,
                "outstanding_amount": 1850,
                "rate_type": "floating",
                "spread_bps": 275,
                "maturity_date": "2028-06-30",
                "confidence_score": 0.92
            },
            {
                "instrument_name": "Senior Notes 5.5%",
                "instrument_type": "senior_note",
                "principal_amount": 1000,
                "outstanding_amount": 1000,
                "rate_type": "fixed",
                "interest_rate": 0.055,
                "maturity_date": "2029-12-15",
                "confidence_score": 0.95
            }
        ],
        "covenants": [
            {
                "covenant_type": "leverage",
                "covenant_name": "Maximum Total Net Leverage",
                "threshold_value": 4.5,
                "threshold_direction": "max",
                "current_value": 3.2,
                "in_compliance": True,
                "confidence_score": 0.88
            }
        ],
        "maturity_schedule": [
            {"fiscal_year": 2025, "amount_due": 150},
            {"fiscal_year": 2026, "amount_due": 200},
            {"fiscal_year": 2027, "amount_due": 200},
            {"fiscal_year": 2028, "amount_due": 1500},
            {"fiscal_year": 2029, "amount_due": 1000}
        ],
        "aggregate_metrics": {
            "total_debt": 2850,
            "net_debt": 2100,
            "cash_and_equivalents": 750,
            "ebitda": 900,
            "interest_expense": 160
        }
    }
    
    quality = validate_extraction(sample_extraction)
    
    print("=" * 50)
    print("EXTRACTION QUALITY REPORT")
    print("=" * 50)
    print(f"Overall Confidence: {quality.overall_confidence:.1%}")
    print(f"Should Serve: {quality.should_serve}")
    print(f"Needs Review: {quality.needs_review}")
    print()
    
    if quality.flags:
        print("Flags:")
        for flag in quality.flags:
            print(f"  ⚠️  {flag.value}")
        print()
    
    if quality.validation_errors:
        print("Errors:")
        for error in quality.validation_errors:
            print(f"  ❌ {error}")
        print()
    
    if quality.validation_warnings:
        print("Warnings:")
        for warning in quality.validation_warnings:
            print(f"  ⚡ {warning}")
        print()
    
    print("Field Scores:")
    for name, score in quality.field_scores.items():
        status = "✓" if score.is_reliable else "?"
        print(f"  {status} {name}: {score.confidence:.1%}")
