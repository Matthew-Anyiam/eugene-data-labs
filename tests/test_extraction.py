#!/usr/bin/env python3
"""
Eugene Intelligence - Test Extraction on Real Filing

This script:
1. Fetches a real 10-K from SEC EDGAR
2. Extracts the debt section
3. Runs Claude extraction
4. Validates the output
5. Outputs results

Usage:
    python test_extraction.py --ticker TSLA
    python test_extraction.py --ticker AAPL --filing-type 10-K
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from extraction.edgar import (
    SECEdgarClient,
    get_company_filings,
    get_filing_text,
    extract_debt_section
)
from extraction.parsers.debt import (
    extract_debt_from_text,
    result_to_dict
)
from extraction.validation import validate_extraction
from extraction.formatter import format_credit_summary
from extraction.fiscal import normalize_period, get_fiscal_database


def test_extraction(ticker: str, filing_type: str = "10-K", save_output: bool = True):
    """
    Test the full extraction pipeline on a real filing.
    """
    print("=" * 60)
    print(f"EUGENE EXTRACTION TEST: {ticker}")
    print("=" * 60)
    print()
    
    # Check for API key
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌ ERROR: ANTHROPIC_API_KEY not set")
        print("   Set it with: export ANTHROPIC_API_KEY=your-key")
        return None
    
    print(f"✓ API key found")
    print()
    
    # Step 1: Fetch company filings
    print(f"[1/5] Fetching {filing_type} filings for {ticker}...")
    
    try:
        client = SECEdgarClient()
        filings = client.get_company_filings(ticker, filing_type, limit=1)
        
        if not filings:
            print(f"❌ No {filing_type} filings found for {ticker}")
            return None
        
        filing = filings[0]
        print(f"      Found: {filing.get('filedAt', 'Unknown date')}")
        print(f"      Accession: {filing.get('accessionNumber', 'Unknown')}")
    except Exception as e:
        print(f"❌ Error fetching filings: {e}")
        return None
    
    print()
    
    # Step 2: Get filing text
    print(f"[2/5] Downloading filing content...")
    
    try:
        # Get the filing URL
        accession = filing.get('accessionNumber', '').replace('-', '')
        cik = filing.get('cik', '')
        primary_doc = filing.get('primaryDocument', '')
        
        if not all([accession, cik, primary_doc]):
            # Try alternate method
            filing_text = client.get_filing_document(ticker, filing_type)
        else:
            filing_url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/{primary_doc}"
            filing_text = client._fetch_url(filing_url)
        
        if not filing_text:
            print(f"❌ Could not download filing")
            return None
        
        print(f"      Downloaded {len(filing_text):,} characters")
    except Exception as e:
        print(f"❌ Error downloading filing: {e}")
        import traceback
        traceback.print_exc()
        return None
    
    print()
    
    # Step 3: Extract debt section
    print(f"[3/5] Extracting debt-related sections...")
    
    try:
        debt_section = extract_debt_section(filing_text)
        
        if not debt_section or len(debt_section) < 500:
            print(f"⚠️  Debt section is short ({len(debt_section) if debt_section else 0} chars)")
            print(f"      Using first 50k chars of filing instead")
            debt_section = filing_text[:50000]
        else:
            print(f"      Extracted {len(debt_section):,} characters")
    except Exception as e:
        print(f"⚠️  Error extracting section: {e}")
        print(f"      Using first 50k chars of filing instead")
        debt_section = filing_text[:50000]
    
    print()
    
    # Step 4: Run Claude extraction
    print(f"[4/5] Running Claude extraction...")
    print(f"      (This may take 30-60 seconds)")
    
    try:
        filing_date = filing.get('filedAt', datetime.now().strftime('%Y-%m-%d'))
        if 'T' in filing_date:
            filing_date = filing_date.split('T')[0]
        
        result = extract_debt_from_text(
            filing_text=debt_section,
            company_ticker=ticker,
            filing_date=filing_date
        )
        
        print(f"      ✓ Extraction complete")
        print(f"      Found {len(result.debt_instruments)} debt instruments")
        print(f"      Found {len(result.covenants)} covenants")
        print(f"      Found {len(result.maturity_schedule)} maturity entries")
    except Exception as e:
        print(f"❌ Error during extraction: {e}")
        import traceback
        traceback.print_exc()
        return None
    
    print()
    
    # Step 5: Validate
    print(f"[5/5] Validating extraction quality...")
    
    result_dict = result_to_dict(result)
    quality = validate_extraction(result_dict)
    
    print(f"      Overall Confidence: {quality.overall_confidence:.1%}")
    print(f"      Should Serve: {'✓ Yes' if quality.should_serve else '✗ No'}")
    print(f"      Needs Review: {'Yes' if quality.needs_review else 'No'}")
    
    if quality.validation_errors:
        print(f"      Errors: {len(quality.validation_errors)}")
        for err in quality.validation_errors[:3]:
            print(f"        - {err}")
    
    if quality.validation_warnings:
        print(f"      Warnings: {len(quality.validation_warnings)}")
        for warn in quality.validation_warnings[:3]:
            print(f"        - {warn}")
    
    print()
    
    # Output results
    print("=" * 60)
    print("EXTRACTION RESULTS")
    print("=" * 60)
    print()
    
    # Format as markdown for display
    markdown_output = format_credit_summary(result_dict)
    print(markdown_output)
    
    # Save outputs
    if save_output:
        output_dir = Path("data/extractions")
        output_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save JSON
        json_path = output_dir / f"{ticker}_{timestamp}.json"
        with open(json_path, 'w') as f:
            output_data = {
                "ticker": ticker,
                "filing_type": filing_type,
                "filing_date": filing_date,
                "extracted_at": datetime.now().isoformat(),
                "quality": quality.to_dict(),
                "data": result_dict
            }
            json.dump(output_data, f, indent=2, default=str)
        print(f"\n✓ Saved JSON: {json_path}")
        
        # Save markdown
        md_path = output_dir / f"{ticker}_{timestamp}.md"
        with open(md_path, 'w') as f:
            f.write(markdown_output)
        print(f"✓ Saved Markdown: {md_path}")
        
        # Save raw debt section for debugging
        raw_path = output_dir / f"{ticker}_{timestamp}_raw.txt"
        with open(raw_path, 'w') as f:
            f.write(debt_section[:100000])  # First 100k chars
        print(f"✓ Saved raw section: {raw_path}")
    
    return result_dict


def main():
    parser = argparse.ArgumentParser(
        description="Test Eugene extraction on a real SEC filing"
    )
    parser.add_argument(
        "--ticker", "-t",
        required=True,
        help="Stock ticker (e.g., TSLA, AAPL)"
    )
    parser.add_argument(
        "--filing-type", "-f",
        default="10-K",
        help="Filing type (default: 10-K)"
    )
    parser.add_argument(
        "--no-save",
        action="store_true",
        help="Don't save output files"
    )
    
    args = parser.parse_args()
    
    result = test_extraction(
        ticker=args.ticker.upper(),
        filing_type=args.filing_type,
        save_output=not args.no_save
    )
    
    if result:
        print("\n✓ Extraction test completed successfully")
    else:
        print("\n✗ Extraction test failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
