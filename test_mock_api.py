#!/usr/bin/env python3
"""
Eugene Data Labs - Mock API Test

Simulates the full extraction pipeline using mock Claude responses.
Use this to test the entire flow without spending API credits.

Usage:
    python test_mock_api.py
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from dataclasses import asdict

sys.path.insert(0, str(Path(__file__).parent))


# Mock Claude API response for debt extraction
MOCK_CLAUDE_RESPONSE = {
    "debt_instruments": [
        {
            "instrument_name": "Automotive Asset-backed Notes",
            "instrument_type": "asset_backed",
            "principal_amount": 2326,
            "outstanding_amount": 2326,
            "rate_type": "floating",
            "reference_rate": "SOFR",
            "spread_bps": 182,
            "maturity_date": "2028-12-31",
            "seniority": "senior_secured",
            "confidence_score": 0.94
        },
        {
            "instrument_name": "Automotive Lease-backed Notes",
            "instrument_type": "asset_backed",
            "principal_amount": 1283,
            "outstanding_amount": 1283,
            "rate_type": "fixed",
            "interest_rate": 0.0531,
            "maturity_date": "2027-12-31",
            "seniority": "senior_secured",
            "confidence_score": 0.92
        },
        {
            "instrument_name": "Solar Asset-backed Notes",
            "instrument_type": "asset_backed",
            "principal_amount": 166,
            "outstanding_amount": 166,
            "rate_type": "fixed",
            "interest_rate": 0.045,
            "maturity_date": "2029-06-30",
            "seniority": "senior_secured",
            "confidence_score": 0.88
        }
    ],
    "covenants": [
        {
            "covenant_type": "leverage",
            "covenant_name": "Maximum Consolidated Total Leverage Ratio",
            "threshold_value": 3.5,
            "threshold_direction": "max",
            "current_value": 0.08,
            "measurement_date": "2023-12-31",
            "in_compliance": True,
            "confidence_score": 0.96
        },
        {
            "covenant_type": "interest_coverage",
            "covenant_name": "Minimum Interest Coverage Ratio",
            "threshold_value": 3.0,
            "threshold_direction": "min",
            "current_value": 48.2,
            "measurement_date": "2023-12-31",
            "in_compliance": True,
            "confidence_score": 0.95
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
        "net_debt": -25092,
        "cash_and_equivalents": 29100,
        "ebitda": 12500,
        "interest_expense": 259
    },
    "credit_facility": {
        "facility_name": "Revolving Credit Agreement",
        "facility_type": "revolver",
        "commitment_amount": 5000,
        "drawn_amount": 0,
        "available_amount": 5000,
        "maturity_date": "2028-08-15"
    },
    "extraction_notes": "Tesla maintains a very strong balance sheet with significant net cash position. The company has minimal covenant risk given leverage ratio of 0.08x versus 3.50x maximum threshold."
}


def mock_claude_extract(filing_text: str, ticker: str, filing_date: str):
    """Simulates Claude API extraction"""
    print(f"  [Mock] Claude API called for {ticker}")
    print(f"  [Mock] Input: {len(filing_text)} characters")
    print(f"  [Mock] Returning mock extraction...")
    return MOCK_CLAUDE_RESPONSE


def run_mock_pipeline():
    """Run the full pipeline with mock API"""
    print("=" * 60)
    print("MOCK API PIPELINE TEST")
    print("=" * 60)
    print()
    
    # Load sample data
    sample_file = Path(__file__).parent / "data/samples/tsla_10k_2023.json"
    with open(sample_file) as f:
        sample = json.load(f)
    
    print(f"1. Loaded sample: {sample['company']['name']}")
    print()
    
    # Simulate filing fetch
    print("2. Simulating SEC EDGAR fetch...")
    filing_text = sample['debt_section']
    print(f"   Filing text: {len(filing_text)} characters")
    print()
    
    # Run mock extraction
    print("3. Running extraction (mock Claude API)...")
    extraction = mock_claude_extract(
        filing_text=filing_text,
        ticker=sample['company']['ticker'],
        filing_date=sample['filing']['filed_at']
    )
    print()
    
    # Validate extraction
    print("4. Validating extraction quality...")
    from extraction.validation import validate_extraction
    
    quality = validate_extraction(extraction)
    print(f"   Overall Confidence: {quality.overall_confidence:.1%}")
    print(f"   Should Serve: {quality.should_serve}")
    
    if quality.validation_errors:
        print(f"   Errors: {quality.validation_errors}")
    if quality.validation_warnings:
        print(f"   Warnings: {quality.validation_warnings[:3]}")
    print()
    
    # Format output
    print("5. Formatting for agent consumption...")
    from extraction.formatter import format_credit_summary
    
    output_data = {
        "ticker": sample['company']['ticker'],
        "company_name": sample['company']['name'],
        "as_of_date": sample['filing']['period_end'],
        "aggregate_metrics": extraction['aggregate_metrics'],
        "debt_instruments": extraction['debt_instruments'],
        "covenants": extraction['covenants'],
        "maturity_schedule": extraction['maturity_schedule'],
        "extraction_notes": extraction.get('extraction_notes')
    }
    
    markdown = format_credit_summary(output_data)
    print(f"   Generated {len(markdown)} characters of markdown")
    print()
    
    # Save results
    print("6. Saving results...")
    output_dir = Path(__file__).parent / "data/extractions"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # JSON output
    json_path = output_dir / f"TSLA_mock_{timestamp}.json"
    with open(json_path, 'w') as f:
        json.dump({
            "ticker": sample['company']['ticker'],
            "company_name": sample['company']['name'],
            "filing_date": sample['filing']['filed_at'],
            "period_end": sample['filing']['period_end'],
            "quality": quality.to_dict(),
            "extraction": extraction,
            "mock": True
        }, f, indent=2, default=str)
    print(f"   JSON: {json_path}")
    
    # Markdown output
    md_path = output_dir / f"TSLA_mock_{timestamp}.md"
    with open(md_path, 'w') as f:
        f.write(markdown)
    print(f"   Markdown: {md_path}")
    print()
    
    # Display output
    print("=" * 60)
    print("EXTRACTION OUTPUT")
    print("=" * 60)
    print(markdown)
    
    # Test data store
    print()
    print("=" * 60)
    print("7. Testing Data Store...")
    print("=" * 60)
    
    from storage.data_store import EugeneDataStore
    import asyncio
    
    async def test_store():
        store = EugeneDataStore()
        
        # Save extraction
        result = await store.save_credit_extraction(
            ticker="TSLA",
            data=extraction,
            filing_date=sample['filing']['period_end'],
            quality_score=quality.overall_confidence,
            source_filing=sample['filing']['accession_number']
        )
        print(f"   Saved: {result.id}")
        
        # Load it back
        loaded = await store.get_credit_data("TSLA")
        print(f"   Loaded: {len(loaded.get('debt_instruments', []))} instruments")
        
        # Get coverage stats
        stats = await store.get_coverage_stats()
        print(f"   Coverage: {stats}")
    
    asyncio.run(test_store())
    
    print()
    print("=" * 60)
    print("✓ MOCK PIPELINE TEST COMPLETE")
    print("=" * 60)
    print()
    print("Next steps:")
    print("  1. Set ANTHROPIC_API_KEY environment variable")
    print("  2. Run: python eugene_cli.py extract --ticker TSLA")
    print("  3. Verify output matches expected format")


if __name__ == "__main__":
    run_mock_pipeline()
