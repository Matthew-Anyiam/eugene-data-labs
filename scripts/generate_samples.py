"""
Eugene Intelligence - Sample Data Generator

Generates sample data files for any list of companies.
No API needed - uses mock data patterns.
"""

import json
from pathlib import Path
from datetime import datetime

# Company data (expand as needed)
COMPANIES = {
    # Existing 10
    "TSLA": {"name": "Tesla, Inc.", "cik": "1318605", "fy_end": "December", "sector": "Consumer Discretionary"},
    "AAPL": {"name": "Apple Inc.", "cik": "320193", "fy_end": "September", "sector": "Technology"},
    "MSFT": {"name": "Microsoft Corporation", "cik": "789019", "fy_end": "June", "sector": "Technology"},
    "GOOGL": {"name": "Alphabet Inc.", "cik": "1652044", "fy_end": "December", "sector": "Technology"},
    "AMZN": {"name": "Amazon.com, Inc.", "cik": "1018724", "fy_end": "December", "sector": "Consumer Discretionary"},
    "META": {"name": "Meta Platforms, Inc.", "cik": "1326801", "fy_end": "December", "sector": "Technology"},
    "NVDA": {"name": "NVIDIA Corporation", "cik": "1045810", "fy_end": "January", "sector": "Technology"},
    "JPM": {"name": "JPMorgan Chase & Co.", "cik": "19617", "fy_end": "December", "sector": "Financials"},
    "WMT": {"name": "Walmart Inc.", "cik": "104169", "fy_end": "January", "sector": "Consumer Staples"},
    "BRK.A": {"name": "Berkshire Hathaway Inc.", "cik": "1067983", "fy_end": "December", "sector": "Financials"},
    
    # New 10
    "BAC": {"name": "Bank of America Corporation", "cik": "70858", "fy_end": "December", "sector": "Financials"},
    "XOM": {"name": "Exxon Mobil Corporation", "cik": "34088", "fy_end": "December", "sector": "Energy"},
    "JNJ": {"name": "Johnson & Johnson", "cik": "200406", "fy_end": "December", "sector": "Healthcare"},
    "V": {"name": "Visa Inc.", "cik": "1403161", "fy_end": "September", "sector": "Financials"},
    "PG": {"name": "Procter & Gamble Company", "cik": "80424", "fy_end": "June", "sector": "Consumer Staples"},
    "HD": {"name": "The Home Depot, Inc.", "cik": "354950", "fy_end": "January", "sector": "Consumer Discretionary"},
    "CVX": {"name": "Chevron Corporation", "cik": "93410", "fy_end": "December", "sector": "Energy"},
    "MA": {"name": "Mastercard Incorporated", "cik": "1141391", "fy_end": "December", "sector": "Financials"},
    "PFE": {"name": "Pfizer Inc.", "cik": "78003", "fy_end": "December", "sector": "Healthcare"},
    "KO": {"name": "The Coca-Cola Company", "cik": "21344", "fy_end": "December", "sector": "Consumer Staples"},
    
    # Additional companies for broader coverage
    "DIS": {"name": "The Walt Disney Company", "cik": "1744489", "fy_end": "September", "sector": "Communication Services"},
    "NFLX": {"name": "Netflix, Inc.", "cik": "1065280", "fy_end": "December", "sector": "Communication Services"},
    "AMD": {"name": "Advanced Micro Devices, Inc.", "cik": "2488", "fy_end": "December", "sector": "Technology"},
    "INTC": {"name": "Intel Corporation", "cik": "50863", "fy_end": "December", "sector": "Technology"},
    "CRM": {"name": "Salesforce, Inc.", "cik": "1108524", "fy_end": "January", "sector": "Technology"},
    "ORCL": {"name": "Oracle Corporation", "cik": "1341439", "fy_end": "May", "sector": "Technology"},
    "CSCO": {"name": "Cisco Systems, Inc.", "cik": "858877", "fy_end": "July", "sector": "Technology"},
    "VZ": {"name": "Verizon Communications Inc.", "cik": "732712", "fy_end": "December", "sector": "Communication Services"},
    "T": {"name": "AT&T Inc.", "cik": "732717", "fy_end": "December", "sector": "Communication Services"},
    "UNH": {"name": "UnitedHealth Group Incorporated", "cik": "731766", "fy_end": "December", "sector": "Healthcare"},
}

# Mock financial data by sector
SECTOR_FINANCIALS = {
    "Technology": {
        "debt_range": (5000, 50000),
        "leverage_range": (0.5, 2.0),
        "margin_range": (0.15, 0.35),
    },
    "Financials": {
        "debt_range": (100000, 500000),
        "leverage_range": (5.0, 15.0),
        "margin_range": (0.20, 0.35),
    },
    "Healthcare": {
        "debt_range": (10000, 80000),
        "leverage_range": (1.0, 3.0),
        "margin_range": (0.15, 0.25),
    },
    "Consumer Discretionary": {
        "debt_range": (5000, 60000),
        "leverage_range": (0.5, 3.0),
        "margin_range": (0.05, 0.20),
    },
    "Consumer Staples": {
        "debt_range": (10000, 50000),
        "leverage_range": (1.0, 3.0),
        "margin_range": (0.10, 0.20),
    },
    "Energy": {
        "debt_range": (20000, 100000),
        "leverage_range": (1.0, 3.0),
        "margin_range": (0.08, 0.15),
    },
    "Communication Services": {
        "debt_range": (30000, 150000),
        "leverage_range": (2.0, 5.0),
        "margin_range": (0.10, 0.25),
    },
}


def generate_sample(ticker: str) -> dict:
    """Generate sample data for a company"""
    if ticker not in COMPANIES:
        print(f"Unknown ticker: {ticker}")
        return None
    
    company = COMPANIES[ticker]
    sector = company["sector"]
    sector_data = SECTOR_FINANCIALS.get(sector, SECTOR_FINANCIALS["Technology"])
    
    # Generate mock values
    import random
    debt = random.randint(*sector_data["debt_range"])
    leverage = round(random.uniform(*sector_data["leverage_range"]), 2)
    margin = round(random.uniform(*sector_data["margin_range"]), 3)
    
    return {
        "company": {
            "ticker": ticker,
            "name": company["name"],
            "cik": company["cik"],
            "fiscal_year_end": company["fy_end"],
            "sector": sector
        },
        "filing": {
            "type": "10-K",
            "filed_at": "2024-02-15",
            "period_end": "2023-12-31",
            "accession_number": f"0000{company['cik']}-24-000001"
        },
        "debt_section": f"As of December 31, 2023, {company['name']} had total debt of ${debt:,} million. The company's leverage ratio was {leverage}x EBITDA. Management remains committed to maintaining investment-grade credit ratings and strong liquidity.",
        "earnings_excerpt": f"{company['name']} reported strong results for fiscal year 2023. Operating margin was {margin*100:.1f}%, reflecting continued focus on operational efficiency. Management provided guidance for continued growth in the coming year.",
        "mock_metrics": {
            "total_debt": debt,
            "leverage_ratio": leverage,
            "operating_margin": margin
        }
    }


def generate_mock_extraction(ticker: str, sample_data: dict) -> dict:
    """Generate mock extraction from sample data"""
    if not sample_data:
        return None
    
    return {
        "ticker": ticker,
        "company_name": sample_data["company"]["name"],
        "mock": True,
        "timestamp": datetime.now().isoformat(),
        "filing_type": "10-K",
        "period_end": sample_data["filing"]["period_end"],
        "metrics": sample_data.get("mock_metrics", {
            "total_debt": 10000,
            "leverage_ratio": 2.0,
            "operating_margin": 0.15
        }),
        "confidence": 0.85
    }


def main():
    """Generate sample data for all companies"""
    samples_dir = Path("data/samples")
    extractions_dir = Path("data/extractions")
    samples_dir.mkdir(parents=True, exist_ok=True)
    extractions_dir.mkdir(parents=True, exist_ok=True)
    
    print("=" * 60)
    print("EUGENE INTELLIGENCE - SAMPLE DATA GENERATOR")
    print("=" * 60)
    print()
    
    generated = 0
    
    for ticker in COMPANIES.keys():
        # Generate sample
        sample = generate_sample(ticker)
        if not sample:
            continue
        
        # Save sample
        sample_file = samples_dir / f"{ticker.lower().replace('.', '_')}_10k_2023.json"
        with open(sample_file, "w") as f:
            json.dump(sample, f, indent=2)
        
        # Generate and save extraction
        extraction = generate_mock_extraction(ticker, sample)
        extraction_file = extractions_dir / f"{ticker.replace('.', '_')}_mock.json"
        with open(extraction_file, "w") as f:
            json.dump(extraction, f, indent=2)
        
        print(f"✓ {ticker}: {sample['company']['name']}")
        generated += 1
    
    print()
    print("=" * 60)
    print(f"Generated {generated} sample files and mock extractions")
    print(f"Samples: {samples_dir}")
    print(f"Extractions: {extractions_dir}")
    print("=" * 60)


if __name__ == "__main__":
    main()