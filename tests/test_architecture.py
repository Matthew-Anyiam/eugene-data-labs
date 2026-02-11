#!/usr/bin/env python3
"""
Eugene Intelligence - Architecture Test

This test verifies that the core architecture works correctly
WITHOUT requiring external API calls.

Run with: python test_architecture.py
"""

import sys
import json
from pathlib import Path

# Add project to path
sys.path.insert(0, str(Path(__file__).parent))


def test_config():
    """Test configuration management"""
    print("\n1. Testing Configuration...")
    
    from eugene.config import Config, APIConfig, SECConfig
    
    # Create config
    config = Config()
    
    # Check defaults
    assert config.cache.enabled == True
    assert config.validation.min_confidence_threshold == 0.5
    assert config.server.port == 8000
    
    # Check API config
    assert config.api.anthropic_model == "claude-sonnet-4-20250514"
    
    # Check validation
    issues = config.validate()
    # Should have issues since no API key
    assert "ANTHROPIC_API_KEY not set" in issues
    
    print("   ✓ Config loads correctly")
    print("   ✓ Defaults work")
    print("   ✓ Validation catches missing API key")
    
    return True


def test_models():
    """Test data models"""
    print("\n2. Testing Data Models...")
    
    from eugene.models.base import (
        DebtInstrument, DebtType, RateType,
        Covenant, CovenantType,
        DebtExtraction, ExtractionMetadata,
        parse_amount, parse_date
    )
    
    # Test DebtInstrument
    debt = DebtInstrument(
        name="5.25% Senior Notes due 2028",
        instrument_type=DebtType.SENIOR_NOTES.value,
        principal=1500.0,
        rate_type=RateType.FIXED.value,
        interest_rate=0.0525,
        maturity_date="2028-06-15",
        confidence=0.92
    )
    
    assert debt.principal == 1500.0
    assert debt.interest_rate_display == "5.25%"
    assert debt.confidence == 0.92
    print("   ✓ DebtInstrument works")
    
    # Test Covenant
    covenant = Covenant(
        name="Maximum Leverage Ratio",
        covenant_type=CovenantType.LEVERAGE.value,
        threshold=4.5,
        current_value=3.2,
        is_maximum=True,
        confidence=0.88
    )
    
    assert covenant.is_in_compliance == True
    assert covenant.cushion is not None
    assert covenant.cushion > 0.2  # Should be about 28%
    print("   ✓ Covenant works with cushion calculation")
    
    # Test amount parsing
    assert parse_amount("$1.5 billion") == 1500.0
    assert parse_amount("$500 million") == 500.0
    print("   ✓ Amount parsing works")
    
    # Test date parsing
    assert parse_date("December 31, 2024") == "2024-12-31"
    assert parse_date("12/31/2024") == "2024-12-31"
    print("   ✓ Date parsing works")
    
    # Test serialization
    debt_dict = debt.to_dict()
    assert "name" in debt_dict
    assert debt_dict["principal"] == 1500.0
    print("   ✓ Serialization works")
    
    return True


def test_llm_extraction():
    """Test LLM extraction engine (with mock)"""
    print("\n3. Testing LLM Extraction Engine...")
    
    from eugene.extraction.llm import (
        MockLLMClient, ExtractionRequest,
        create_debt_extraction_request
    )
    
    # Create mock client
    client = MockLLMClient()
    
    # Add mock response
    client.add_mock_response("senior notes", {
        "total_debt": 5000,
        "instruments": [
            {
                "name": "5.25% Senior Notes due 2028",
                "instrument_type": "senior_notes",
                "principal": 1500,
                "rate_type": "fixed",
                "interest_rate": 0.0525,
                "maturity_date": "2028-06-15",
                "confidence": 0.92
            }
        ]
    })
    
    # Test extraction
    request = create_debt_extraction_request(
        "The company has $1.5 billion in 5.25% Senior Notes due 2028."
    )
    
    response = client.extract(request)
    
    assert response.success == True
    assert response.data is not None
    assert response.data["total_debt"] == 5000
    assert len(response.data["instruments"]) == 1
    print("   ✓ Mock LLM extraction works")
    
    # Test retry logic
    response = client.extract_with_retry(request)
    assert response.success == True
    print("   ✓ Retry logic works")
    
    return True


def test_edgar_client_offline():
    """Test EDGAR client structure (no network calls)"""
    print("\n4. Testing EDGAR Client Structure...")
    
    from eugene.sources.edgar import (
        Filing, Company, RateLimiter, Cache,
        EDGARClient, EDGARError
    )
    
    # Test Filing model
    filing = Filing(
        accession_number="0000320193-24-000081",
        filing_type="10-K",
        filing_date="2024-11-01",
        accepted_datetime="2024-11-01T16:30:00",
        cik="320193",
        company_name="Apple Inc."
    )
    
    assert filing.accession_number_clean == "000032019324000081"
    assert filing.filing_type == "10-K"
    print("   ✓ Filing model works")
    
    # Test Company model
    company = Company(
        cik="320193",
        name="Apple Inc.",
        ticker="AAPL"
    )
    
    assert company.cik_padded == "0000320193"
    print("   ✓ Company model works")
    
    # Test RateLimiter
    limiter = RateLimiter(requests_per_second=10)
    assert limiter.min_interval == 0.1
    print("   ✓ RateLimiter configured")
    
    # Test Cache
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        cache = Cache(Path(tmpdir), ttl_hours=24)
        
        # Set and get
        cache.set("test_key", {"data": "value"})
        result = cache.get("test_key")
        
        assert result == {"data": "value"}
        print("   ✓ Cache works")
    
    # Test known CIKs
    assert EDGARClient.KNOWN_CIKS["AAPL"] == "320193"
    assert EDGARClient.KNOWN_CIKS["TSLA"] == "1318605"
    print("   ✓ Known CIKs loaded")
    
    return True


def test_full_pipeline_mock():
    """Test full extraction pipeline with mock data"""
    print("\n5. Testing Full Pipeline (Mock)...")
    
    from eugene.extraction.llm import MockLLMClient, create_debt_extraction_request
    from eugene.models.base import DebtInstrument, DebtExtraction, ExtractionMetadata
    
    # Simulate: EDGAR fetch -> LLM extract -> Validate -> Return
    
    # Step 1: Mock filing text (would come from EDGAR)
    filing_text = """
    Note 10 - Long-Term Debt
    
    The Company's long-term debt consists of the following:
    
    5.25% Senior Notes due 2028: $1,500 million
    Term Loan B (SOFR + 275 bps) due 2030: $2,000 million
    Revolving Credit Facility: $500 million available, $200 million drawn
    
    Total Long-Term Debt: $3,700 million
    
    The Company maintains a leverage covenant requiring Total Debt to EBITDA 
    of no more than 4.5x. As of December 31, 2023, the ratio was 3.2x.
    """
    
    # Step 2: LLM extraction (mocked)
    client = MockLLMClient()
    client.add_mock_response("senior notes", {
        "total_debt": 3700,
        "instruments": [
            {
                "name": "5.25% Senior Notes due 2028",
                "instrument_type": "senior_notes",
                "principal": 1500,
                "rate_type": "fixed",
                "interest_rate": 0.0525,
                "maturity_date": "2028-06-15",
                "confidence": 0.92
            },
            {
                "name": "Term Loan B due 2030",
                "instrument_type": "term_loan",
                "principal": 2000,
                "rate_type": "floating",
                "spread_bps": 275,
                "benchmark": "SOFR",
                "maturity_date": "2030-12-31",
                "confidence": 0.88
            },
            {
                "name": "Revolving Credit Facility",
                "instrument_type": "revolving_credit",
                "principal": 200,
                "confidence": 0.85
            }
        ],
        "covenants": [
            {
                "name": "Maximum Leverage Ratio",
                "covenant_type": "leverage",
                "threshold": 4.5,
                "current_value": 3.2,
                "is_in_compliance": True,
                "confidence": 0.90
            }
        ]
    })
    
    request = create_debt_extraction_request(filing_text)
    response = client.extract(request)
    
    assert response.success
    print("   ✓ LLM extraction successful")
    
    # Step 3: Build typed models
    instruments = []
    for item in response.data["instruments"]:
        inst = DebtInstrument(
            name=item["name"],
            instrument_type=item["instrument_type"],
            principal=item["principal"],
            rate_type=item.get("rate_type"),
            interest_rate=item.get("interest_rate"),
            spread_bps=item.get("spread_bps"),
            benchmark=item.get("benchmark"),
            maturity_date=item.get("maturity_date"),
            confidence=item["confidence"]
        )
        instruments.append(inst)
    
    assert len(instruments) == 3
    print("   ✓ Models built from extraction")
    
    # Step 4: Build complete extraction result
    extraction = DebtExtraction(
        ticker="TEST",
        company_name="Test Company",
        instruments=instruments,
        total_debt=response.data["total_debt"],
        metadata=ExtractionMetadata(
            source_filing="0000000000-24-000001",
            confidence_score=0.88
        )
    )
    
    assert extraction.total_debt == 3700
    assert extraction.weighted_confidence > 0.8
    print("   ✓ DebtExtraction built")
    
    # Step 5: Serialize
    result = extraction.to_dict()
    
    assert "instruments" in result
    assert len(result["instruments"]) == 3
    assert result["summary"]["total_debt"] == 3700
    print("   ✓ Serialization works")
    
    # Pretty print result
    print("\n   Sample Output:")
    print("   " + "-" * 50)
    print(f"   Total Debt: ${result['summary']['total_debt']}M")
    print(f"   Instruments: {len(result['instruments'])}")
    for inst in result["instruments"]:
        rate = inst.get("interest_rate_display", "N/A")
        print(f"     - {inst['name']}: ${inst['principal']}M @ {rate}")
    print("   " + "-" * 50)
    
    return True


def run_all_tests():
    """Run all architecture tests"""
    print("=" * 60)
    print("EUGENE INTELLIGENCE - ARCHITECTURE TESTS")
    print("=" * 60)
    
    tests = [
        ("Configuration", test_config),
        ("Data Models", test_models),
        ("LLM Extraction", test_llm_extraction),
        ("EDGAR Client", test_edgar_client_offline),
        ("Full Pipeline", test_full_pipeline_mock),
    ]
    
    passed = 0
    failed = 0
    
    for name, test_func in tests:
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"\n❌ {name} FAILED: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("=" * 60)
    
    if failed > 0:
        sys.exit(1)
    
    print("\n✅ All architecture tests passed!")
    print("\nThe core architecture is solid. Next steps:")
    print("  1. Add Anthropic API key to test real extraction")
    print("  2. Test with real SEC filings")
    print("  3. Add more parsers")
    print("  4. Build API layer")


if __name__ == "__main__":
    run_all_tests()
