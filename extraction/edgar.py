"""
Eugene Intelligence - SEC EDGAR Data Fetcher

Handles fetching company filings from SEC EDGAR.
"""

import requests
import time
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
import xml.etree.ElementTree as ET
import re


# SEC requires a User-Agent with contact info
USER_AGENT = "Eugene Intelligence research@eugenedatalabs.com"
BASE_URL = "https://www.sec.gov"
EDGAR_API = "https://data.sec.gov"

# Rate limiting: SEC allows 10 requests per second
REQUEST_DELAY = 0.1


@dataclass
class Filing:
    """Represents a SEC filing"""
    company_cik: str
    company_name: str
    ticker: str
    filing_type: str
    filing_date: date
    period_end_date: Optional[date]
    accession_number: str
    filing_url: str
    primary_document: str


@dataclass
class CompanyInfo:
    """Basic company information from SEC"""
    cik: str
    name: str
    ticker: str
    sic: str
    sic_description: str
    state: str
    fiscal_year_end: str


class EDGARClient:
    """Client for interacting with SEC EDGAR"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "application/json"
        })
        self._last_request_time = 0
    
    def _rate_limit(self):
        """Ensure we don't exceed SEC rate limits"""
        elapsed = time.time() - self._last_request_time
        if elapsed < REQUEST_DELAY:
            time.sleep(REQUEST_DELAY - elapsed)
        self._last_request_time = time.time()
    
    def _get(self, url: str) -> requests.Response:
        """Make a rate-limited GET request"""
        self._rate_limit()
        response = self.session.get(url)
        response.raise_for_status()
        return response
    
    def _normalize_cik(self, cik: str) -> str:
        """Normalize CIK to 10 digits with leading zeros"""
        return cik.lstrip("0").zfill(10)
    
    # ==========================================
    # Company Information
    # ==========================================
    
    def get_company_info(self, cik: str) -> CompanyInfo:
        """Get company information from SEC"""
        cik = self._normalize_cik(cik)
        url = f"{EDGAR_API}/submissions/CIK{cik}.json"
        
        response = self._get(url)
        data = response.json()
        
        # Get the first ticker if multiple exist
        tickers = data.get("tickers", [])
        ticker = tickers[0] if tickers else ""
        
        return CompanyInfo(
            cik=cik,
            name=data.get("name", ""),
            ticker=ticker,
            sic=data.get("sic", ""),
            sic_description=data.get("sicDescription", ""),
            state=data.get("stateOfIncorporation", ""),
            fiscal_year_end=data.get("fiscalYearEnd", "")
        )
    
    def search_companies(self, query: str) -> List[Dict[str, str]]:
        """Search for companies by name or ticker"""
        url = f"{EDGAR_API}/cgi-bin/browse-edgar"
        params = {
            "action": "getcompany",
            "company": query,
            "type": "",
            "dateb": "",
            "owner": "include",
            "count": "40",
            "output": "atom"
        }
        
        # This endpoint returns XML
        self._rate_limit()
        response = self.session.get(url, params=params)
        response.raise_for_status()
        
        # Parse XML response
        results = []
        # Simple parsing - in production use proper XML parsing
        # For now, use the JSON company tickers endpoint
        
        return results
    
    def get_company_tickers(self) -> Dict[str, Dict]:
        """Get full list of company tickers from SEC"""
        url = f"{BASE_URL}/files/company_tickers.json"
        response = self._get(url)
        data = response.json()
        
        # Convert to dict keyed by ticker
        tickers = {}
        for entry in data.values():
            ticker = entry.get("ticker", "")
            if ticker:
                tickers[ticker] = {
                    "cik": str(entry.get("cik_str", "")).zfill(10),
                    "name": entry.get("title", "")
                }
        
        return tickers
    
    # ==========================================
    # Filing Retrieval
    # ==========================================
    
    def get_company_filings(
        self,
        cik: str,
        filing_types: List[str] = None,
        start_date: date = None,
        end_date: date = None,
        limit: int = 100
    ) -> List[Filing]:
        """Get filings for a company"""
        cik = self._normalize_cik(cik)
        url = f"{EDGAR_API}/submissions/CIK{cik}.json"
        
        response = self._get(url)
        data = response.json()
        
        company_name = data.get("name", "")
        tickers = data.get("tickers", [])
        ticker = tickers[0] if tickers else ""
        
        filings = []
        recent = data.get("filings", {}).get("recent", {})
        
        # Extract filing data
        forms = recent.get("form", [])
        dates = recent.get("filingDate", [])
        accessions = recent.get("accessionNumber", [])
        primary_docs = recent.get("primaryDocument", [])
        report_dates = recent.get("reportDate", [])
        
        for i in range(min(len(forms), limit)):
            form = forms[i]
            
            # Filter by filing type
            if filing_types and form not in filing_types:
                continue
            
            filing_date_str = dates[i] if i < len(dates) else None
            if not filing_date_str:
                continue
                
            filing_date = datetime.strptime(filing_date_str, "%Y-%m-%d").date()
            
            # Filter by date
            if start_date and filing_date < start_date:
                continue
            if end_date and filing_date > end_date:
                continue
            
            accession = accessions[i] if i < len(accessions) else ""
            primary_doc = primary_docs[i] if i < len(primary_docs) else ""
            report_date_str = report_dates[i] if i < len(report_dates) else None
            
            period_end = None
            if report_date_str:
                try:
                    period_end = datetime.strptime(report_date_str, "%Y-%m-%d").date()
                except:
                    pass
            
            # Build filing URL
            accession_no_dashes = accession.replace("-", "")
            filing_url = f"{BASE_URL}/Archives/edgar/data/{cik}/{accession_no_dashes}/{primary_doc}"
            
            filings.append(Filing(
                company_cik=cik,
                company_name=company_name,
                ticker=ticker,
                filing_type=form,
                filing_date=filing_date,
                period_end_date=period_end,
                accession_number=accession,
                filing_url=filing_url,
                primary_document=primary_doc
            ))
        
        return filings
    
    def get_10k_filings(self, cik: str, limit: int = 5) -> List[Filing]:
        """Get 10-K filings for a company"""
        return self.get_company_filings(
            cik=cik,
            filing_types=["10-K", "10-K/A"],
            limit=limit
        )
    
    def get_10q_filings(self, cik: str, limit: int = 12) -> List[Filing]:
        """Get 10-Q filings for a company"""
        return self.get_company_filings(
            cik=cik,
            filing_types=["10-Q", "10-Q/A"],
            limit=limit
        )
    
    def get_8k_filings(self, cik: str, limit: int = 20) -> List[Filing]:
        """Get 8-K filings for a company"""
        return self.get_company_filings(
            cik=cik,
            filing_types=["8-K", "8-K/A"],
            limit=limit
        )
    
    # ==========================================
    # Filing Content
    # ==========================================
    
    def get_filing_content(self, filing: Filing) -> str:
        """Download the full text content of a filing"""
        response = self._get(filing.filing_url)
        return response.text
    
    def get_filing_by_accession(self, cik: str, accession_number: str) -> Optional[str]:
        """Get filing content by accession number"""
        cik = self._normalize_cik(cik)
        accession_no_dashes = accession_number.replace("-", "")
        
        # Try to get the primary document
        # First, get the filing index
        index_url = f"{BASE_URL}/Archives/edgar/data/{cik}/{accession_no_dashes}/index.json"
        
        try:
            response = self._get(index_url)
            data = response.json()
            
            # Find the primary document (usually the .htm file)
            for item in data.get("directory", {}).get("item", []):
                name = item.get("name", "")
                if name.endswith(".htm") and "10-" in name.lower():
                    doc_url = f"{BASE_URL}/Archives/edgar/data/{cik}/{accession_no_dashes}/{name}"
                    content_response = self._get(doc_url)
                    return content_response.text
            
        except Exception as e:
            print(f"Error fetching filing: {e}")
            return None
        
        return None


# ==========================================
# Utility Functions
# ==========================================

def get_sp500_companies() -> List[Dict[str, str]]:
    """
    Get list of S&P 500 companies.
    In production, this would be fetched from a reliable source.
    For now, returns a sample list.
    """
    # This is a small sample - in production, scrape from Wikipedia or use a data provider
    sample_companies = [
        {"ticker": "AAPL", "name": "Apple Inc."},
        {"ticker": "MSFT", "name": "Microsoft Corporation"},
        {"ticker": "GOOGL", "name": "Alphabet Inc."},
        {"ticker": "AMZN", "name": "Amazon.com Inc."},
        {"ticker": "NVDA", "name": "NVIDIA Corporation"},
        {"ticker": "META", "name": "Meta Platforms Inc."},
        {"ticker": "TSLA", "name": "Tesla Inc."},
        {"ticker": "JPM", "name": "JPMorgan Chase & Co."},
        {"ticker": "V", "name": "Visa Inc."},
        {"ticker": "JNJ", "name": "Johnson & Johnson"},
        {"ticker": "WMT", "name": "Walmart Inc."},
        {"ticker": "PG", "name": "Procter & Gamble Co."},
        {"ticker": "MA", "name": "Mastercard Inc."},
        {"ticker": "HD", "name": "Home Depot Inc."},
        {"ticker": "CVX", "name": "Chevron Corporation"},
        {"ticker": "MRK", "name": "Merck & Co. Inc."},
        {"ticker": "ABBV", "name": "AbbVie Inc."},
        {"ticker": "PEP", "name": "PepsiCo Inc."},
        {"ticker": "KO", "name": "Coca-Cola Company"},
        {"ticker": "COST", "name": "Costco Wholesale Corporation"},
    ]
    return sample_companies


def extract_text_from_html(html_content: str) -> str:
    """Extract plain text from HTML filing"""
    # Remove script and style elements
    html_content = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    html_content = re.sub(r'<style[^>]*>.*?</style>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', ' ', html_content)
    
    # Clean up whitespace
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    
    return text


def find_debt_section(filing_text: str) -> Optional[str]:
    """
    Find the debt/borrowings section in a filing.
    Returns the relevant section text.
    """
    # Common section headers for debt disclosures
    debt_patterns = [
        r'(?i)note\s*\d*\s*[-–—]?\s*debt',
        r'(?i)note\s*\d*\s*[-–—]?\s*borrowings',
        r'(?i)note\s*\d*\s*[-–—]?\s*long[- ]term\s+debt',
        r'(?i)note\s*\d*\s*[-–—]?\s*credit\s+facilities',
        r'(?i)note\s*\d*\s*[-–—]?\s*financing\s+arrangements',
        r'(?i)liquidity\s+and\s+capital\s+resources',
    ]
    
    for pattern in debt_patterns:
        match = re.search(pattern, filing_text)
        if match:
            # Extract surrounding context (approximately 10000 characters)
            start = max(0, match.start() - 500)
            end = min(len(filing_text), match.end() + 15000)
            return filing_text[start:end]
    
    return None


# ==========================================
# Structured Filing Helpers
# ==========================================

def get_form4_filings(ticker: str, limit: int = 20) -> List[Dict]:
    """
    Get Form 4 (insider trading) filings for a company.
    
    Args:
        ticker: Stock ticker
        limit: Max filings to return
    
    Returns:
        List of filing metadata
    """
    client = SECEdgarClient()
    return client.get_company_filings(ticker, "4", limit)


def get_13f_filings(cik: str, limit: int = 8) -> List[Dict]:
    """
    Get 13F-HR (institutional holdings) filings.
    
    Note: 13F is filed by CIK of the institution, not company ticker.
    
    Args:
        cik: CIK of the filing institution
        limit: Max filings to return
    
    Returns:
        List of filing metadata
    """
    client = SECEdgarClient()
    return client.get_company_filings(cik, "13F-HR", limit)


def get_13d_13g_filings(ticker: str, limit: int = 20) -> List[Dict]:
    """
    Get 13D and 13G (beneficial ownership) filings for a company.
    
    Args:
        ticker: Stock ticker of the subject company
        limit: Max filings to return
    
    Returns:
        List of filing metadata
    """
    client = SECEdgarClient()
    filings = []
    
    # Get both 13D and 13G
    for form_type in ["SC 13D", "SC 13G"]:
        try:
            filings.extend(client.get_company_filings(ticker, form_type, limit // 2))
        except:
            pass
    
    # Sort by date descending
    return sorted(filings, key=lambda x: x.get('filedAt', ''), reverse=True)[:limit]


def get_insider_transactions(ticker: str, days: int = 90) -> List[Dict]:
    """
    Get recent insider transactions for a company.
    
    Fetches Form 4 filings and parses them.
    
    Args:
        ticker: Stock ticker
        days: Look back period
    
    Returns:
        List of parsed transactions
    """
    from extraction.parsers.form4 import parse_form4_xml, Form4Filing
    from datetime import datetime, timedelta
    
    filings = get_form4_filings(ticker, limit=50)
    transactions = []
    
    cutoff = datetime.now() - timedelta(days=days)
    
    for filing_meta in filings:
        try:
            filed_at = filing_meta.get('filedAt', '')
            if filed_at:
                filed_date = datetime.fromisoformat(filed_at.replace('Z', '+00:00'))
                if filed_date.replace(tzinfo=None) < cutoff:
                    continue
            
            # Would need to fetch and parse the actual XML here
            # For now, just return metadata
            transactions.append({
                "accession_number": filing_meta.get('accessionNumber'),
                "filed_date": filed_at,
                "form_type": filing_meta.get('form', '4')
            })
        except:
            continue
    
    return transactions


# ==========================================
# Main / Testing
# ==========================================

if __name__ == "__main__":
    # Test the EDGAR client
    client = EDGARClient()
    
    # Test getting company info
    print("Testing EDGAR Client...")
    print("-" * 50)
    
    # Get Apple's info
    info = client.get_company_info("320193")  # Apple's CIK
    print(f"Company: {info.name}")
    print(f"Ticker: {info.ticker}")
    print(f"CIK: {info.cik}")
    print(f"Industry: {info.sic_description}")
    print()
    
    # Get recent 10-K filings
    print("Recent 10-K filings:")
    filings = client.get_10k_filings("320193", limit=3)
    for f in filings:
        print(f"  {f.filing_date}: {f.filing_type} - {f.accession_number}")
    print()
    
    # Get recent 10-Q filings
    print("Recent 10-Q filings:")
    filings = client.get_10q_filings("320193", limit=4)
    for f in filings:
        print(f"  {f.filing_date}: {f.filing_type} - {f.accession_number}")
