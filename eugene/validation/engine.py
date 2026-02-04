"""
Eugene Intelligence - Validation Engine

The trust layer. Michelle Leder said it best: trust is everything.

This module validates every extraction before it reaches a user.
Every data point gets a confidence score and validation check.
"""

import re
import logging
from typing import List, Optional, Dict, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """Result of validating an extraction"""
    is_valid: bool
    confidence_score: float  # 0.0 - 1.0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    checks_passed: int = 0
    checks_failed: int = 0
    checks_total: int = 0
    
    @property
    def pass_rate(self) -> float:
        if self.checks_total == 0:
            return 0.0
        return self.checks_passed / self.checks_total
    
    def to_dict(self) -> dict:
        return {
            "is_valid": self.is_valid,
            "confidence_score": round(self.confidence_score, 3),
            "pass_rate": round(self.pass_rate, 3),
            "checks_passed": self.checks_passed,
            "checks_failed": self.checks_failed,
            "checks_total": self.checks_total,
            "errors": self.errors,
            "warnings": self.warnings
        }


@dataclass
class Check:
    """Single validation check"""
    name: str
    passed: bool
    message: str = ""
    severity: str = "error"  # error, warning


class Validator:
    """
    Base validator. Runs checks against extraction data.
    
    Usage:
        validator = Validator()
        validator.add_check("positive_debt", lambda d: d.get("total_debt", 0) >= 0, 
                           "Total debt cannot be negative")
        result = validator.validate(data)
    """
    
    def __init__(self):
        self._checks: List[Dict] = []
    
    def add_check(
        self, 
        name: str, 
        check_fn: Callable[[Dict], bool], 
        error_message: str,
        severity: str = "error"
    ):
        """Add a validation check"""
        self._checks.append({
            "name": name,
            "fn": check_fn,
            "message": error_message,
            "severity": severity
        })
    
    def validate(self, data: Dict[str, Any]) -> ValidationResult:
        """Run all checks against data"""
        errors = []
        warnings = []
        passed = 0
        failed = 0
        
        for check in self._checks:
            try:
                if check["fn"](data):
                    passed += 1
                else:
                    failed += 1
                    if check["severity"] == "error":
                        errors.append(f"{check['name']}: {check['message']}")
                    else:
                        warnings.append(f"{check['name']}: {check['message']}")
            except Exception as e:
                failed += 1
                errors.append(f"{check['name']}: Check failed with exception: {e}")
        
        total = passed + failed
        confidence = passed / total if total > 0 else 0.0
        is_valid = len(errors) == 0
        
        return ValidationResult(
            is_valid=is_valid,
            confidence_score=confidence,
            errors=errors,
            warnings=warnings,
            checks_passed=passed,
            checks_failed=failed,
            checks_total=total
        )


class DebtValidator(Validator):
    """Validator for debt extractions"""
    
    def __init__(self):
        super().__init__()
        self._add_debt_checks()
    
    def _add_debt_checks(self):
        # Total debt must be non-negative
        self.add_check(
            "positive_total_debt",
            lambda d: d.get("total_debt") is None or d.get("total_debt", 0) >= 0,
            "Total debt cannot be negative"
        )
        
        # Must have at least one instrument
        self.add_check(
            "has_instruments",
            lambda d: len(d.get("instruments", [])) > 0,
            "No debt instruments found"
        )
        
        # All instrument principals must be positive
        self.add_check(
            "positive_principals",
            lambda d: all(
                i.get("principal", 0) > 0 
                for i in d.get("instruments", [{}])
            ),
            "All instrument principals must be positive"
        )
        
        # Interest rates should be between 0 and 0.50 (0% to 50%)
        self.add_check(
            "reasonable_rates",
            lambda d: all(
                i.get("interest_rate") is None or 0 <= i.get("interest_rate", 0) <= 0.50
                for i in d.get("instruments", [])
            ),
            "Interest rates should be between 0% and 50%",
            severity="warning"
        )
        
        # Maturity dates should be in the future or recent past
        self.add_check(
            "valid_maturity_dates",
            lambda d: all(
                i.get("maturity_date") is None or self._is_valid_date(i.get("maturity_date"))
                for i in d.get("instruments", [])
            ),
            "Maturity dates should be valid",
            severity="warning"
        )
        
        # Sum of instruments should roughly match total
        self.add_check(
            "instruments_sum_matches_total",
            lambda d: self._check_sum(d),
            "Sum of instruments doesn't match total debt (>20% difference)",
            severity="warning"
        )
        
        # Each instrument should have a name
        self.add_check(
            "instruments_have_names",
            lambda d: all(
                bool(i.get("name", "").strip())
                for i in d.get("instruments", [{}])
            ),
            "All instruments should have names"
        )
        
        # Confidence scores should be valid
        self.add_check(
            "valid_confidence_scores",
            lambda d: all(
                0 <= i.get("confidence", 0) <= 1
                for i in d.get("instruments", [{}])
            ),
            "Confidence scores must be between 0 and 1"
        )
    
    @staticmethod
    def _is_valid_date(date_str: str) -> bool:
        """Check if date string is valid"""
        if not date_str:
            return True
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
            return True
        except ValueError:
            return False
    
    @staticmethod
    def _check_sum(data: dict) -> bool:
        """Check if instrument sum roughly matches total"""
        total = data.get("total_debt")
        instruments = data.get("instruments", [])
        
        if total is None or not instruments:
            return True  # Can't check, pass
        
        instrument_sum = sum(i.get("principal", 0) for i in instruments)
        
        if total == 0:
            return instrument_sum == 0
        
        # Allow 20% tolerance
        ratio = abs(instrument_sum - total) / total
        return ratio <= 0.20


class EmployeeValidator(Validator):
    """Validator for employee/layoff extractions"""
    
    def __init__(self):
        super().__init__()
        self._add_employee_checks()
    
    def _add_employee_checks(self):
        # Must have employee count
        self.add_check(
            "has_employee_count",
            lambda d: d.get("current_employees") is not None or d.get("employee_count") is not None,
            "No employee count found"
        )
        
        # Employee count must be positive
        self.add_check(
            "positive_employee_count",
            lambda d: (d.get("current_employees") or d.get("employee_count") or 1) > 0,
            "Employee count must be positive"
        )
        
        # If layoff mentioned, must have number or percentage
        self.add_check(
            "layoff_has_details",
            lambda d: (
                not d.get("has_layoffs", False) or 
                d.get("layoff_count") is not None or 
                d.get("layoff_percentage") is not None
            ),
            "Layoff mentioned but no count or percentage provided",
            severity="warning"
        )
        
        # Layoff count should be less than total employees
        self.add_check(
            "layoff_less_than_total",
            lambda d: (
                d.get("layoff_count") is None or
                d.get("current_employees") is None or
                d.get("layoff_count", 0) <= d.get("current_employees", float("inf"))
            ),
            "Layoff count exceeds total employee count"
        )


class EventValidator(Validator):
    """Validator for 8-K material events"""
    
    def __init__(self):
        super().__init__()
        self._add_event_checks()
    
    def _add_event_checks(self):
        # Must have at least one event
        self.add_check(
            "has_events",
            lambda d: len(d.get("events", [])) > 0,
            "No events found in 8-K"
        )
        
        # Events must have item numbers
        self.add_check(
            "events_have_item_numbers",
            lambda d: all(
                bool(e.get("item_number", "").strip())
                for e in d.get("events", [{}])
            ),
            "All events must have item numbers"
        )
        
        # Item numbers should match known patterns
        self.add_check(
            "valid_item_numbers",
            lambda d: all(
                re.match(r'^\d+\.\d+$', e.get("item_number", "0.0"))
                for e in d.get("events", [{"item_number": "1.01"}])
            ),
            "Item numbers should be in format X.XX",
            severity="warning"
        )


def validate_debt(data: Dict[str, Any]) -> ValidationResult:
    """Convenience function to validate debt extraction"""
    return DebtValidator().validate(data)


def validate_employees(data: Dict[str, Any]) -> ValidationResult:
    """Convenience function to validate employee extraction"""
    return EmployeeValidator().validate(data)


def validate_events(data: Dict[str, Any]) -> ValidationResult:
    """Convenience function to validate 8-K events"""
    return EventValidator().validate(data)


if __name__ == "__main__":
    print("Testing Validation Engine...\n")
    
    # Test good debt data
    good_debt = {
        "total_debt": 3700,
        "instruments": [
            {"name": "Senior Notes", "principal": 1500, "interest_rate": 0.0525, "confidence": 0.9},
            {"name": "Term Loan", "principal": 2000, "confidence": 0.85},
            {"name": "Revolver", "principal": 200, "confidence": 0.8}
        ]
    }
    
    result = validate_debt(good_debt)
    print(f"Good debt data: valid={result.is_valid}, confidence={result.confidence_score:.2f}")
    print(f"  Passed: {result.checks_passed}/{result.checks_total}")
    assert result.is_valid
    print("  ✓ Passed\n")
    
    # Test bad debt data
    bad_debt = {
        "total_debt": -500,
        "instruments": []
    }
    
    result = validate_debt(bad_debt)
    print(f"Bad debt data: valid={result.is_valid}, confidence={result.confidence_score:.2f}")
    print(f"  Errors: {result.errors}")
    assert not result.is_valid
    print("  ✓ Correctly rejected\n")
    
    # Test employee data
    good_employees = {
        "current_employees": 150000,
        "has_layoffs": True,
        "layoff_count": 2400,
        "layoff_percentage": 1.6
    }
    
    result = validate_employees(good_employees)
    print(f"Employee data: valid={result.is_valid}, confidence={result.confidence_score:.2f}")
    assert result.is_valid
    print("  ✓ Passed\n")
    
    print("✅ All validation tests passed!")
