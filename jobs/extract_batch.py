"""
Eugene Intelligence - Extraction Job Runner

Orchestrates the extraction of debt data from SEC filings.
Run this to populate the database with credit data.

Usage:
    python extract_batch.py --tickers AAPL MSFT TSLA
    python extract_batch.py --sp500
    python extract_batch.py --tickers AAPL --filing-types 10-K 10-Q --limit 4
"""

import os
import sys
import json
import time
from datetime import datetime, date
from typing import List, Optional
from dataclasses import asdict

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from extraction.edgar import EDGARClient, Filing, get_sp500_companies, extract_text_from_html, find_debt_section
from extraction.parsers.debt import extract_debt_from_text, result_to_dict, DebtExtractionResult


class ExtractionJob:
    """Manages the extraction of debt data for multiple companies"""
    
    def __init__(self, output_dir: str = "data/extractions"):
        self.edgar = EDGARClient()
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        
        # Load company tickers mapping
        print("Loading SEC company tickers...")
        self.tickers = self.edgar.get_company_tickers()
        print(f"Loaded {len(self.tickers)} tickers")
    
    def get_cik_for_ticker(self, ticker: str) -> Optional[str]:
        """Get CIK for a ticker symbol"""
        ticker = ticker.upper()
        if ticker in self.tickers:
            return self.tickers[ticker]["cik"]
        return None
    
    def extract_company(
        self,
        ticker: str,
        filing_types: List[str] = ["10-K", "10-Q"],
        limit: int = 4
    ) -> List[DebtExtractionResult]:
        """
        Extract debt data for a single company.
        
        Args:
            ticker: Company ticker symbol
            filing_types: Types of filings to process
            limit: Maximum number of filings to process
        
        Returns:
            List of extraction results
        """
        print(f"\n{'='*50}")
        print(f"Processing {ticker}")
        print(f"{'='*50}")
        
        # Get CIK
        cik = self.get_cik_for_ticker(ticker)
        if not cik:
            print(f"  ERROR: Could not find CIK for {ticker}")
            return []
        
        print(f"  CIK: {cik}")
        
        # Get filings
        filings = self.edgar.get_company_filings(
            cik=cik,
            filing_types=filing_types,
            limit=limit
        )
        
        if not filings:
            print(f"  ERROR: No filings found")
            return []
        
        print(f"  Found {len(filings)} filings")
        
        results = []
        
        for filing in filings:
            print(f"\n  Processing {filing.filing_type} ({filing.filing_date})...")
            
            try:
                # Download filing content
                print(f"    Downloading filing...")
                content = self.edgar.get_filing_content(filing)
                
                if not content:
                    print(f"    ERROR: Could not download filing")
                    continue
                
                # Extract text from HTML
                print(f"    Extracting text ({len(content):,} chars)...")
                text = extract_text_from_html(content)
                
                # Find debt section
                print(f"    Looking for debt section...")
                debt_section = find_debt_section(text)
                
                if debt_section:
                    print(f"    Found debt section ({len(debt_section):,} chars)")
                    extraction_text = debt_section
                else:
                    print(f"    No specific debt section found, using full text")
                    extraction_text = text[:150000]  # Limit size
                
                # Extract debt data
                print(f"    Extracting debt data with Claude...")
                result = extract_debt_from_text(
                    filing_text=extraction_text,
                    company_ticker=ticker,
                    filing_date=filing.filing_date.isoformat(),
                    period_end_date=filing.period_end_date.isoformat() if filing.period_end_date else None
                )
                
                # Print summary
                print(f"\n    Results:")
                print(f"      Total Debt: ${result.total_debt}M" if result.total_debt else "      Total Debt: Not found")
                print(f"      Instruments: {len(result.debt_instruments)}")
                print(f"      Covenants: {len(result.covenants)}")
                print(f"      Maturity Years: {len(result.maturity_schedule)}")
                
                if result.extraction_notes:
                    print(f"      Notes: {result.extraction_notes}")
                
                results.append(result)
                
                # Save individual result
                output_file = os.path.join(
                    self.output_dir,
                    f"{ticker}_{filing.filing_type}_{filing.filing_date}.json"
                )
                with open(output_file, 'w') as f:
                    json.dump(result_to_dict(result), f, indent=2)
                print(f"    Saved to {output_file}")
                
                # Rate limiting - be nice to Claude API
                time.sleep(1)
                
            except Exception as e:
                print(f"    ERROR: {str(e)}")
                continue
        
        return results
    
    def extract_batch(
        self,
        tickers: List[str],
        filing_types: List[str] = ["10-K"],
        filings_per_company: int = 1
    ) -> dict:
        """
        Extract debt data for multiple companies.
        
        Args:
            tickers: List of ticker symbols
            filing_types: Types of filings to process
            filings_per_company: Number of filings per company
        
        Returns:
            Summary of extraction results
        """
        print(f"\n{'#'*60}")
        print(f"EUGENE INTELLIGENCE - BATCH EXTRACTION")
        print(f"{'#'*60}")
        print(f"Companies: {len(tickers)}")
        print(f"Filing types: {filing_types}")
        print(f"Filings per company: {filings_per_company}")
        print(f"Started: {datetime.now().isoformat()}")
        
        summary = {
            "started_at": datetime.now().isoformat(),
            "total_companies": len(tickers),
            "successful": 0,
            "failed": 0,
            "total_instruments": 0,
            "total_covenants": 0,
            "companies": {}
        }
        
        for i, ticker in enumerate(tickers):
            print(f"\n[{i+1}/{len(tickers)}] Processing {ticker}...")
            
            try:
                results = self.extract_company(
                    ticker=ticker,
                    filing_types=filing_types,
                    limit=filings_per_company
                )
                
                if results:
                    summary["successful"] += 1
                    summary["companies"][ticker] = {
                        "status": "success",
                        "filings_processed": len(results),
                        "instruments": sum(len(r.debt_instruments) for r in results),
                        "covenants": sum(len(r.covenants) for r in results)
                    }
                    summary["total_instruments"] += summary["companies"][ticker]["instruments"]
                    summary["total_covenants"] += summary["companies"][ticker]["covenants"]
                else:
                    summary["failed"] += 1
                    summary["companies"][ticker] = {"status": "no_data"}
                    
            except Exception as e:
                summary["failed"] += 1
                summary["companies"][ticker] = {"status": "error", "error": str(e)}
                print(f"  FAILED: {str(e)}")
            
            # Rate limiting between companies
            time.sleep(2)
        
        summary["completed_at"] = datetime.now().isoformat()
        
        # Save summary
        summary_file = os.path.join(self.output_dir, f"batch_summary_{date.today()}.json")
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2)
        
        # Print summary
        print(f"\n{'#'*60}")
        print(f"EXTRACTION COMPLETE")
        print(f"{'#'*60}")
        print(f"Successful: {summary['successful']}/{summary['total_companies']}")
        print(f"Failed: {summary['failed']}")
        print(f"Total debt instruments extracted: {summary['total_instruments']}")
        print(f"Total covenants extracted: {summary['total_covenants']}")
        print(f"Summary saved to: {summary_file}")
        
        return summary


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Eugene Intelligence - Debt Extraction")
    parser.add_argument(
        "--tickers",
        type=str,
        nargs="+",
        help="Ticker symbols to process (e.g., AAPL MSFT TSLA)"
    )
    parser.add_argument(
        "--sp500",
        action="store_true",
        help="Process S&P 500 companies"
    )
    parser.add_argument(
        "--filing-types",
        type=str,
        nargs="+",
        default=["10-K"],
        help="Filing types to process (default: 10-K)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=1,
        help="Number of filings per company (default: 1)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="data/extractions",
        help="Output directory for extracted data"
    )
    
    args = parser.parse_args()
    
    # Determine tickers to process
    if args.sp500:
        tickers = [c["ticker"] for c in get_sp500_companies()]
        print(f"Processing S&P 500 sample ({len(tickers)} companies)")
    elif args.tickers:
        tickers = [t.upper() for t in args.tickers]
    else:
        # Default: test with a few companies
        tickers = ["AAPL", "MSFT", "TSLA"]
        print("No tickers specified, using default test set")
    
    # Run extraction
    job = ExtractionJob(output_dir=args.output)
    
    if len(tickers) == 1:
        job.extract_company(
            ticker=tickers[0],
            filing_types=args.filing_types,
            limit=args.limit
        )
    else:
        job.extract_batch(
            tickers=tickers,
            filing_types=args.filing_types,
            filings_per_company=args.limit
        )


if __name__ == "__main__":
    main()
