"""
Eugene Intelligence - Evaluation Framework

Domain-specific evals for financial data extraction.
Key insight from Fintool: "Generic NLP metrics (BLEU, ROUGE) don't work for finance.
A response can be semantically similar but have completely wrong numbers."

Evaluation categories:
- Numeric precision (amounts, ratios)
- Date/period accuracy
- Covenant term extraction
- Cross-reference validation
- Adversarial grounding (resist hallucination)
"""

import json
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Callable
from datetime import date
from enum import Enum


class EvalCategory(Enum):
    """Categories of evaluation tests"""
    NUMERIC_PRECISION = "numeric_precision"
    DATE_ACCURACY = "date_accuracy"
    COVENANT_EXTRACTION = "covenant_extraction"
    INSTRUMENT_EXTRACTION = "instrument_extraction"
    CROSS_VALIDATION = "cross_validation"
    ADVERSARIAL = "adversarial"
    FISCAL_PERIOD = "fiscal_period"


@dataclass
class EvalCase:
    """A single evaluation test case"""
    id: str
    category: EvalCategory
    description: str
    input_data: Dict[str, Any]
    expected_output: Dict[str, Any]
    tolerance: Optional[float] = None  # For numeric comparisons
    required_fields: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)


@dataclass
class EvalResult:
    """Result of running an evaluation"""
    case_id: str
    passed: bool
    score: float  # 0.0 to 1.0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EvalSuiteResult:
    """Results from running a full evaluation suite"""
    total_cases: int
    passed: int
    failed: int
    score: float  # Overall percentage
    by_category: Dict[str, float]
    results: List[EvalResult]
    
    def summary(self) -> str:
        """Generate human-readable summary"""
        lines = [
            "=" * 60,
            "EVALUATION RESULTS",
            "=" * 60,
            f"Total Cases: {self.total_cases}",
            f"Passed: {self.passed}",
            f"Failed: {self.failed}",
            f"Overall Score: {self.score:.1%}",
            "",
            "By Category:",
        ]
        
        for category, score in self.by_category.items():
            status = "✓" if score >= 0.9 else "⚠" if score >= 0.7 else "✗"
            lines.append(f"  {status} {category}: {score:.1%}")
        
        if self.failed > 0:
            lines.append("")
            lines.append("Failed Cases:")
            for result in self.results:
                if not result.passed:
                    lines.append(f"  ✗ {result.case_id}")
                    for error in result.errors:
                        lines.append(f"    - {error}")
        
        return "\n".join(lines)


class EvalRunner:
    """Runs evaluation tests against extraction results"""
    
    def __init__(self):
        self.cases: List[EvalCase] = []
        self._load_default_cases()
    
    def _load_default_cases(self):
        """Load default evaluation cases"""
        
        # ============================================
        # NUMERIC PRECISION TESTS
        # ============================================
        
        self.cases.append(EvalCase(
            id="num_001",
            category=EvalCategory.NUMERIC_PRECISION,
            description="Total debt extraction - exact match",
            input_data={
                "filing_text": "As of December 31, 2024, total debt was $3,500 million.",
                "ticker": "TEST"
            },
            expected_output={
                "total_debt": 3500
            },
            tolerance=0.01  # 1% tolerance
        ))
        
        self.cases.append(EvalCase(
            id="num_002",
            category=EvalCategory.NUMERIC_PRECISION,
            description="Interest rate extraction - percentage format",
            input_data={
                "filing_text": "The Senior Notes bear interest at 5.75% per annum.",
                "ticker": "TEST"
            },
            expected_output={
                "interest_rate": 0.0575
            },
            tolerance=0.001
        ))
        
        self.cases.append(EvalCase(
            id="num_003",
            category=EvalCategory.NUMERIC_PRECISION,
            description="Spread extraction - basis points",
            input_data={
                "filing_text": "The Term Loan bears interest at SOFR plus 275 basis points.",
                "ticker": "TEST"
            },
            expected_output={
                "spread_bps": 275
            },
            tolerance=0
        ))
        
        self.cases.append(EvalCase(
            id="num_004",
            category=EvalCategory.NUMERIC_PRECISION,
            description="Leverage ratio extraction",
            input_data={
                "filing_text": "The consolidated leverage ratio was 3.2x as of year end.",
                "ticker": "TEST"
            },
            expected_output={
                "leverage_ratio": 3.2
            },
            tolerance=0.1
        ))
        
        self.cases.append(EvalCase(
            id="num_005",
            category=EvalCategory.NUMERIC_PRECISION,
            description="Handle billions vs millions",
            input_data={
                "filing_text": "Total debt outstanding was $4.2 billion.",
                "ticker": "TEST"
            },
            expected_output={
                "total_debt": 4200  # In millions
            },
            tolerance=0.01
        ))
        
        # ============================================
        # DATE ACCURACY TESTS
        # ============================================
        
        self.cases.append(EvalCase(
            id="date_001",
            category=EvalCategory.DATE_ACCURACY,
            description="Maturity date extraction - standard format",
            input_data={
                "filing_text": "The Notes mature on June 15, 2028.",
                "ticker": "TEST"
            },
            expected_output={
                "maturity_date": "2028-06-15"
            }
        ))
        
        self.cases.append(EvalCase(
            id="date_002",
            category=EvalCategory.DATE_ACCURACY,
            description="Maturity date extraction - numeric format",
            input_data={
                "filing_text": "Maturity: 03/15/2030",
                "ticker": "TEST"
            },
            expected_output={
                "maturity_date": "2030-03-15"
            }
        ))
        
        # ============================================
        # COVENANT EXTRACTION TESTS
        # ============================================
        
        self.cases.append(EvalCase(
            id="cov_001",
            category=EvalCategory.COVENANT_EXTRACTION,
            description="Leverage covenant - max threshold",
            input_data={
                "filing_text": """The Credit Agreement requires maintenance of a 
                Consolidated Total Net Leverage Ratio not exceeding 4.50 to 1.00.""",
                "ticker": "TEST"
            },
            expected_output={
                "covenant_type": "leverage",
                "threshold_value": 4.5,
                "threshold_direction": "max"
            }
        ))
        
        self.cases.append(EvalCase(
            id="cov_002",
            category=EvalCategory.COVENANT_EXTRACTION,
            description="Interest coverage covenant - min threshold",
            input_data={
                "filing_text": """The Company must maintain a minimum Interest Coverage 
                Ratio of at least 3.00 to 1.00.""",
                "ticker": "TEST"
            },
            expected_output={
                "covenant_type": "interest_coverage",
                "threshold_value": 3.0,
                "threshold_direction": "min"
            }
        ))
        
        self.cases.append(EvalCase(
            id="cov_003",
            category=EvalCategory.COVENANT_EXTRACTION,
            description="Covenant compliance status",
            input_data={
                "filing_text": """As of December 31, 2024, the Company was in compliance 
                with all financial covenants. The Leverage Ratio was 3.1x versus 
                the maximum permitted of 4.5x.""",
                "ticker": "TEST"
            },
            expected_output={
                "in_compliance": True,
                "current_value": 3.1,
                "threshold_value": 4.5
            }
        ))
        
        # ============================================
        # INSTRUMENT EXTRACTION TESTS
        # ============================================
        
        self.cases.append(EvalCase(
            id="inst_001",
            category=EvalCategory.INSTRUMENT_EXTRACTION,
            description="Term loan extraction",
            input_data={
                "filing_text": """The Company has a $2.0 billion Senior Secured Term Loan B, 
                maturing June 30, 2028, bearing interest at SOFR plus 2.75%.""",
                "ticker": "TEST"
            },
            expected_output={
                "instrument_type": "term_loan",
                "principal_amount": 2000,
                "maturity_date": "2028-06-30",
                "rate_type": "floating",
                "spread_bps": 275
            }
        ))
        
        self.cases.append(EvalCase(
            id="inst_002",
            category=EvalCategory.INSTRUMENT_EXTRACTION,
            description="Revolver extraction with availability",
            input_data={
                "filing_text": """The Revolving Credit Facility provides for borrowings up to 
                $500 million. As of year end, $200 million was drawn, leaving 
                $300 million available.""",
                "ticker": "TEST"
            },
            expected_output={
                "instrument_type": "revolver",
                "principal_amount": 500,
                "outstanding_amount": 200,
                "available_amount": 300
            }
        ))
        
        # ============================================
        # FISCAL PERIOD TESTS
        # ============================================
        
        self.cases.append(EvalCase(
            id="fiscal_001",
            category=EvalCategory.FISCAL_PERIOD,
            description="Apple Q1 normalization",
            input_data={
                "ticker": "AAPL",
                "period_str": "Q1 2024"
            },
            expected_output={
                "period_start": "2023-10-01",
                "period_end": "2023-12-31"
            },
            tags=["fiscal_calendar"]
        ))
        
        self.cases.append(EvalCase(
            id="fiscal_002",
            category=EvalCategory.FISCAL_PERIOD,
            description="Microsoft Q1 normalization",
            input_data={
                "ticker": "MSFT",
                "period_str": "Q1 2024"
            },
            expected_output={
                "period_start": "2023-07-01",
                "period_end": "2023-09-30"
            },
            tags=["fiscal_calendar"]
        ))
        
        # ============================================
        # ADVERSARIAL TESTS
        # ============================================
        
        self.cases.append(EvalCase(
            id="adv_001",
            category=EvalCategory.ADVERSARIAL,
            description="Reject fake analyst report number",
            input_data={
                "filing_text": """[Actual 10-K] Total debt was $3,500 million.
                
                [Analyst Note - not from filing] Some analysts estimate debt at $5,000 million.""",
                "ticker": "TEST"
            },
            expected_output={
                "total_debt": 3500  # Should use actual filing number, not analyst estimate
            },
            tolerance=0.01,
            tags=["hallucination_resistance"]
        ))
        
        self.cases.append(EvalCase(
            id="adv_002",
            category=EvalCategory.ADVERSARIAL,
            description="Handle missing data gracefully",
            input_data={
                "filing_text": """The Company has various debt obligations. 
                Details are provided in Exhibit 10.1.""",
                "ticker": "TEST"
            },
            expected_output={
                "total_debt": None  # Should not hallucinate a number
            },
            tags=["hallucination_resistance"]
        ))
        
        # ============================================
        # CROSS VALIDATION TESTS
        # ============================================
        
        self.cases.append(EvalCase(
            id="cross_001",
            category=EvalCategory.CROSS_VALIDATION,
            description="Instrument sum equals total debt",
            input_data={
                "total_debt": 3500,
                "instruments": [
                    {"outstanding_amount": 2000},
                    {"outstanding_amount": 1000},
                    {"outstanding_amount": 500}
                ]
            },
            expected_output={
                "valid": True
            },
            tolerance=0.10,
            tags=["consistency_check"]
        ))
    
    def run_case(self, case: EvalCase, actual_output: Dict) -> EvalResult:
        """Run a single evaluation case"""
        errors = []
        warnings = []
        details = {}
        field_scores = []
        
        for expected_key, expected_value in case.expected_output.items():
            actual_value = actual_output.get(expected_key)
            
            if expected_value is None:
                # Expected missing value
                if actual_value is not None:
                    errors.append(f"{expected_key}: expected None, got {actual_value}")
                    field_scores.append(0.0)
                else:
                    field_scores.append(1.0)
            
            elif isinstance(expected_value, (int, float)):
                # Numeric comparison
                if actual_value is None:
                    errors.append(f"{expected_key}: expected {expected_value}, got None")
                    field_scores.append(0.0)
                elif case.tolerance:
                    diff = abs(expected_value - actual_value)
                    relative_diff = diff / abs(expected_value) if expected_value != 0 else diff
                    if relative_diff <= case.tolerance:
                        field_scores.append(1.0)
                    else:
                        errors.append(
                            f"{expected_key}: expected {expected_value}, got {actual_value} "
                            f"(diff: {relative_diff:.2%}, tolerance: {case.tolerance:.2%})"
                        )
                        field_scores.append(max(0, 1 - relative_diff))
                else:
                    if expected_value == actual_value:
                        field_scores.append(1.0)
                    else:
                        errors.append(f"{expected_key}: expected {expected_value}, got {actual_value}")
                        field_scores.append(0.0)
            
            elif isinstance(expected_value, bool):
                if actual_value == expected_value:
                    field_scores.append(1.0)
                else:
                    errors.append(f"{expected_key}: expected {expected_value}, got {actual_value}")
                    field_scores.append(0.0)
            
            elif isinstance(expected_value, str):
                if actual_value == expected_value:
                    field_scores.append(1.0)
                elif actual_value and expected_value.lower() == actual_value.lower():
                    warnings.append(f"{expected_key}: case mismatch ({expected_value} vs {actual_value})")
                    field_scores.append(0.9)
                else:
                    errors.append(f"{expected_key}: expected '{expected_value}', got '{actual_value}'")
                    field_scores.append(0.0)
            
            else:
                # Complex comparison - just check existence for now
                if actual_value is not None:
                    field_scores.append(0.8)
                else:
                    errors.append(f"{expected_key}: expected value, got None")
                    field_scores.append(0.0)
            
            details[expected_key] = {
                "expected": expected_value,
                "actual": actual_value,
                "match": len(errors) == 0 or errors[-1].split(":")[0] != expected_key
            }
        
        score = sum(field_scores) / len(field_scores) if field_scores else 0.0
        passed = len(errors) == 0 and score >= 0.9
        
        return EvalResult(
            case_id=case.id,
            passed=passed,
            score=score,
            errors=errors,
            warnings=warnings,
            details=details
        )
    
    def run_suite(
        self, 
        extraction_fn: Callable[[Dict], Dict],
        categories: Optional[List[EvalCategory]] = None,
        tags: Optional[List[str]] = None
    ) -> EvalSuiteResult:
        """
        Run a suite of evaluation tests.
        
        Args:
            extraction_fn: Function that takes input_data and returns extraction result
            categories: Optional filter by category
            tags: Optional filter by tags
        
        Returns:
            EvalSuiteResult with all results
        """
        # Filter cases
        cases_to_run = self.cases
        
        if categories:
            cases_to_run = [c for c in cases_to_run if c.category in categories]
        
        if tags:
            cases_to_run = [c for c in cases_to_run if any(t in c.tags for t in tags)]
        
        results = []
        by_category = {}
        
        for case in cases_to_run:
            try:
                actual_output = extraction_fn(case.input_data)
                result = self.run_case(case, actual_output)
            except Exception as e:
                result = EvalResult(
                    case_id=case.id,
                    passed=False,
                    score=0.0,
                    errors=[f"Exception: {str(e)}"]
                )
            
            results.append(result)
            
            # Track by category
            cat = case.category.value
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(result.score)
        
        # Calculate category scores
        category_scores = {
            cat: sum(scores) / len(scores)
            for cat, scores in by_category.items()
        }
        
        passed = sum(1 for r in results if r.passed)
        failed = len(results) - passed
        overall_score = sum(r.score for r in results) / len(results) if results else 0.0
        
        return EvalSuiteResult(
            total_cases=len(results),
            passed=passed,
            failed=failed,
            score=overall_score,
            by_category=category_scores,
            results=results
        )
    
    def add_case(self, case: EvalCase):
        """Add a custom evaluation case"""
        self.cases.append(case)
    
    def load_cases_from_file(self, filepath: str):
        """Load evaluation cases from a JSON file"""
        with open(filepath) as f:
            data = json.load(f)
        
        for case_data in data:
            case = EvalCase(
                id=case_data["id"],
                category=EvalCategory(case_data["category"]),
                description=case_data["description"],
                input_data=case_data["input_data"],
                expected_output=case_data["expected_output"],
                tolerance=case_data.get("tolerance"),
                required_fields=case_data.get("required_fields", []),
                tags=case_data.get("tags", [])
            )
            self.cases.append(case)


# ============================================
# Convenience Functions
# ============================================

def run_extraction_evals(extraction_fn: Callable) -> EvalSuiteResult:
    """Run the full evaluation suite"""
    runner = EvalRunner()
    return runner.run_suite(extraction_fn)


def run_quick_evals(extraction_fn: Callable) -> EvalSuiteResult:
    """Run a quick subset of evaluations"""
    runner = EvalRunner()
    return runner.run_suite(
        extraction_fn,
        categories=[
            EvalCategory.NUMERIC_PRECISION,
            EvalCategory.COVENANT_EXTRACTION
        ]
    )


# ============================================
# Testing
# ============================================

if __name__ == "__main__":
    # Mock extraction function for testing
    def mock_extraction(input_data: Dict) -> Dict:
        """Mock extraction that returns expected values (for testing the eval framework)"""
        # This would be replaced with actual extraction in production
        
        # Return some mock results
        text = input_data.get("filing_text", "")
        
        result = {}
        
        if "3,500 million" in text:
            result["total_debt"] = 3500
        if "4.2 billion" in text:
            result["total_debt"] = 4200
        if "5.75%" in text:
            result["interest_rate"] = 0.0575
        if "275 basis points" in text:
            result["spread_bps"] = 275
        if "3.2x" in text:
            result["leverage_ratio"] = 3.2
        if "June 15, 2028" in text:
            result["maturity_date"] = "2028-06-15"
        if "4.50 to 1.00" in text:
            result["covenant_type"] = "leverage"
            result["threshold_value"] = 4.5
            result["threshold_direction"] = "max"
        if "3.00 to 1.00" in text:
            result["covenant_type"] = "interest_coverage"
            result["threshold_value"] = 3.0
            result["threshold_direction"] = "min"
        
        return result
    
    print("Running evaluation suite...")
    print()
    
    runner = EvalRunner()
    results = runner.run_suite(mock_extraction)
    
    print(results.summary())
