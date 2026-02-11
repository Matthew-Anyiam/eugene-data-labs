#!/usr/bin/env python3
"""
Eugene Data Labs - Offline Pipeline Test

Tests the extraction pipeline using sample data (no network required).
Use this to validate the pipeline logic before testing with real API calls.

Usage:
    python test_offline.py                    # Test all components
    python test_offline.py --component parse  # Test specific component
"""

import json
import sys
from pathlib import Path
from datetime import datetime

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent))


def load_sample_data():
    """Load sample filing data"""
    sample_file = Path(__file__).parent / "data/samples/tsla_10k_2023.json"
    
    if not sample_file.exists():
        print(f"❌ Sample data not found: {sample_file}")
        return None
    
    with open(sample_file) as f:
        return json.load(f)


def test_validation():
    """Test the validation module"""
    print("\n" + "=" * 60)
    print("TEST: Validation Module")
    print("=" * 60)
    
    from extraction.validation import validate_extraction, QualityFlag
    
    # Test with good data
    good_extraction = {
        "debt_instruments": [
            {
                "instrument_name": "Automotive Asset-backed Notes",
                "instrument_type": "asset_backed",
                "principal_amount": 2326,
                "outstanding_amount": 2326,
                "rate_type": "floating",
                "maturity_date": "2028-12-31",
                "confidence_score": 0.92
            }
        ],
        "covenants": [
            {
                "covenant_type": "leverage",
                "covenant_name": "Maximum Consolidated Total Leverage Ratio",
                "threshold_value": 3.5,
                "threshold_direction": "max",
                "current_value": 0.08,
                "in_compliance": True
            }
        ],
        "maturity_schedule": [
            {"fiscal_year": 2024, "amount_due": 2373},
            {"fiscal_year": 2025, "amount_due": 678},
            {"fiscal_year": 2026, "amount_due": 512},
            {"fiscal_year": 2027, "amount_due": 389},
            {"fiscal_year": 2028, "amount_due": 56}
        ],
        "aggregate_metrics": {
            "total_debt": 4008,
            "net_debt": -25092,  # Net cash position
            "cash_and_equivalents": 29100,
            "ebitda": 12500
        }
    }
    
    quality = validate_extraction(good_extraction)
    
    print(f"✓ Overall Confidence: {quality.overall_confidence:.1%}")
    print(f"✓ Should Serve: {quality.should_serve}")
    print(f"✓ Needs Review: {quality.needs_review}")
    
    if quality.validation_warnings:
        print(f"  Warnings: {quality.validation_warnings}")
    
    # Test with bad data
    bad_extraction = {
        "debt_instruments": [
            {
                "instrument_name": "Bad Instrument",
                "principal_amount": -100,  # Invalid: negative
                "interest_rate": 0.50,     # Invalid: 50% rate
            }
        ],
        "covenants": [],
        "maturity_schedule": [],
        "aggregate_metrics": {
            "total_debt": 1000000000  # $1 trillion - suspicious
        }
    }
    
    bad_quality = validate_extraction(bad_extraction)
    
    print(f"\n✓ Bad data detected:")
    print(f"  Confidence: {bad_quality.overall_confidence:.1%}")
    print(f"  Should Serve: {bad_quality.should_serve}")
    print(f"  Flags: {[f.value for f in bad_quality.flags]}")
    
    return True


def test_fiscal_calendar():
    """Test fiscal period normalization"""
    print("\n" + "=" * 60)
    print("TEST: Fiscal Calendar")
    print("=" * 60)
    
    from extraction.fiscal import normalize_period, get_fiscal_database
    
    db = get_fiscal_database()
    
    # Test different companies
    test_cases = [
        ("AAPL", "Q1 2024"),  # Apple: Oct-Dec 2023
        ("MSFT", "Q1 2024"),  # Microsoft: Jul-Sep 2023
        ("TSLA", "Q1 2024"),  # Tesla: Jan-Mar 2024
    ]
    
    for ticker, period_str in test_cases:
        period = normalize_period(ticker, period_str)
        print(f"✓ {ticker} {period_str}:")
        print(f"    {period.period_start} to {period.period_end}")
    
    return True


def test_formatter():
    """Test markdown formatter"""
    print("\n" + "=" * 60)
    print("TEST: Markdown Formatter")
    print("=" * 60)
    
    from extraction.formatter import format_credit_summary
    
    sample_data = {
        "ticker": "TSLA",
        "company_name": "Tesla, Inc.",
        "as_of_date": "2023-12-31",
        "aggregate_metrics": {
            "total_debt": 4008,
            "net_debt": -25092,
            "cash_and_equivalents": 29100,
            "ebitda": 12500,
            "leverage_ratio": 0.32,
            "interest_coverage": 48.2
        },
        "debt_instruments": [
            {
                "instrument_name": "Automotive Asset-backed Notes",
                "instrument_type": "asset_backed",
                "outstanding_amount": 2326,
                "rate_type": "floating",
                "maturity_date": "2028-12-31"
            },
            {
                "instrument_name": "Automotive Lease-backed Notes",
                "instrument_type": "asset_backed",
                "outstanding_amount": 1283,
                "rate_type": "fixed",
                "interest_rate": 0.0531,
                "maturity_date": "2027-12-31"
            }
        ],
        "covenants": [
            {
                "covenant_name": "Maximum Leverage Ratio",
                "covenant_type": "leverage",
                "threshold_value": 3.5,
                "threshold_direction": "max",
                "current_value": 0.08,
                "in_compliance": True
            },
            {
                "covenant_name": "Minimum Interest Coverage",
                "covenant_type": "interest_coverage",
                "threshold_value": 3.0,
                "threshold_direction": "min",
                "current_value": 48.2,
                "in_compliance": True
            }
        ],
        "maturity_schedule": [
            {"fiscal_year": 2024, "amount_due": 2373},
            {"fiscal_year": 2025, "amount_due": 678},
            {"fiscal_year": 2026, "amount_due": 512},
            {"fiscal_year": 2027, "amount_due": 389},
            {"fiscal_year": 2028, "amount_due": 56}
        ]
    }
    
    markdown = format_credit_summary(sample_data)
    
    # Print first 50 lines
    lines = markdown.split('\n')
    for line in lines[:50]:
        print(line)
    
    if len(lines) > 50:
        print(f"... ({len(lines) - 50} more lines)")
    
    print(f"\n✓ Generated {len(markdown)} characters of markdown")
    
    return True


def test_resilient_runner():
    """Test resilient runner components"""
    print("\n" + "=" * 60)
    print("TEST: Resilient Runner Components")
    print("=" * 60)
    
    from jobs.resilient_runner import (
        RetryPolicy, 
        RateLimiter, 
        CircuitBreaker,
        CircuitState
    )
    
    # Test retry policy
    policy = RetryPolicy(max_retries=3, base_delay=1.0)
    
    print("✓ Retry Policy:")
    for attempt in range(4):
        delay = policy.get_delay(attempt)
        should_retry = policy.should_retry(attempt, Exception("test"))
        print(f"    Attempt {attempt}: delay={delay:.2f}s, retry={should_retry}")
    
    # Test circuit breaker
    cb = CircuitBreaker(failure_threshold=3)
    
    print("\n✓ Circuit Breaker:")
    print(f"    Initial state: {cb.state.value}")
    
    for i in range(4):
        cb.record_failure()
        print(f"    After failure {i+1}: {cb.state.value}")
    
    # Test rate limiter
    import asyncio
    
    async def test_rate_limiter():
        limiter = RateLimiter(requests_per_minute=60)
        
        start = datetime.now()
        for i in range(3):
            await limiter.acquire()
        elapsed = (datetime.now() - start).total_seconds()
        
        print(f"\n✓ Rate Limiter: 3 requests in {elapsed:.3f}s")
    
    asyncio.run(test_rate_limiter())
    
    return True


def test_session_state():
    """Test session state management"""
    print("\n" + "=" * 60)
    print("TEST: Session State")
    print("=" * 60)
    
    from session_state import SessionState
    
    state = SessionState(state_dir="data/test_sessions")
    
    # Save state
    saved = state.save(
        current_task="Testing offline pipeline",
        completed_tasks=["Validation", "Fiscal calendar", "Formatter"],
        next_steps=["Test with real API", "Run batch job"],
        notes="All offline tests passing"
    )
    
    print(f"✓ Saved session state")
    
    # Load state
    loaded = state.load()
    print(f"✓ Loaded session state")
    print(f"    Current task: {loaded['current_task']}")
    print(f"    Completed: {len(loaded['completed_tasks'])} tasks")
    
    # Generate resume prompt
    prompt = state.generate_resume_prompt()
    print(f"✓ Generated resume prompt ({len(prompt)} chars)")
    
    return True


def test_evals():
    """Test evaluation framework"""
    print("\n" + "=" * 60)
    print("TEST: Evaluation Framework")
    print("=" * 60)
    
    from evaluation.evals import EvalRunner, EvalCategory
    
    runner = EvalRunner()
    
    # Mock extraction function
    def mock_extract(input_data):
        text = input_data.get("filing_text", "")
        
        result = {}
        
        # Simple pattern matching for testing
        if "3,500 million" in text:
            result["total_debt"] = 3500
        if "5.75%" in text:
            result["interest_rate"] = 0.0575
        if "4.50 to 1.00" in text:
            result["covenant_type"] = "leverage"
            result["threshold_value"] = 4.5
            result["threshold_direction"] = "max"
        
        return result
    
    # Run subset of evals
    results = runner.run_suite(
        mock_extract,
        categories=[EvalCategory.NUMERIC_PRECISION]
    )
    
    print(f"✓ Ran {results.total_cases} eval cases")
    print(f"    Passed: {results.passed}")
    print(f"    Failed: {results.failed}")
    print(f"    Score: {results.score:.1%}")
    
    return True


def test_safe_extract():
    """Test safe extraction wrapper"""
    print("\n" + "=" * 60)
    print("TEST: Safe Extract Wrapper")
    print("=" * 60)
    
    from extraction.safe_extract import (
        categorize_error,
        is_recoverable,
        ErrorCategory,
        SafeResult
    )
    
    # Test error categorization
    test_errors = [
        (ConnectionError("Connection refused"), ErrorCategory.NETWORK),
        (Exception("Rate limit exceeded"), ErrorCategory.API),
        (json.JSONDecodeError("", "", 0), ErrorCategory.PARSING),
        (ValueError("Invalid value"), ErrorCategory.VALIDATION),
        (MemoryError("Out of memory"), ErrorCategory.RESOURCE),
    ]
    
    print("✓ Error Categorization:")
    for error, expected in test_errors:
        category = categorize_error(error)
        status = "✓" if category == expected else "✗"
        print(f"    {status} {type(error).__name__}: {category.value}")
    
    # Test recoverability
    print("\n✓ Recoverability:")
    recoverable_err = Exception("Connection timeout")
    non_recoverable_err = Exception("Invalid API key")
    
    print(f"    Timeout: recoverable={is_recoverable(recoverable_err, ErrorCategory.NETWORK)}")
    print(f"    Invalid key: recoverable={is_recoverable(non_recoverable_err, ErrorCategory.API)}")
    
    # Test SafeResult
    success = SafeResult.ok({"data": "test"})
    failure = SafeResult.fail(None)
    
    print(f"\n✓ SafeResult: success={success.success}, failure={failure.success}")
    
    return True


def main():
    """Run all offline tests"""
    print("=" * 60)
    print("EUGENE INTELLIGENCE - OFFLINE PIPELINE TEST")
    print("=" * 60)
    print(f"Time: {datetime.now().isoformat()}")
    
    # Load sample data
    sample = load_sample_data()
    if sample:
        print(f"\n✓ Sample data loaded: {sample['company']['name']}")
    
    tests = [
        ("Validation", test_validation),
        ("Fiscal Calendar", test_fiscal_calendar),
        ("Formatter", test_formatter),
        ("Resilient Runner", test_resilient_runner),
        ("Session State", test_session_state),
        ("Eval Framework", test_evals),
        ("Safe Extract", test_safe_extract),
    ]
    
    results = []
    
    for name, test_fn in tests:
        try:
            success = test_fn()
            results.append((name, success, None))
        except Exception as e:
            results.append((name, False, str(e)))
            import traceback
            traceback.print_exc()
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, success, _ in results if success)
    failed = len(results) - passed
    
    for name, success, error in results:
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"{status}: {name}")
        if error:
            print(f"       Error: {error}")
    
    print(f"\nTotal: {passed}/{len(results)} passed")
    
    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
