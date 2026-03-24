"""
Eugene Intelligence - SEC EDGAR Client

Real client for fetching SEC filings from EDGAR.
Handles rate limiting, caching, and error recovery.

SEC EDGAR API Documentation:
https://www.sec.gov/developer

Rate Limits:
- Max 10 requests per second
- User-Agent header required with contact info
"""

import re
import time
import json
import hashlib
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from urllib.parse import urljoin
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from eugene.config import Config, get_config


logger = logging.getLogger(__name__)


class EDGARError(Exception):
    """Base exception for EDGAR client errors"""
    pass


class RateLimitError(EDGARError):
    """Rate limit exceeded"""
    pass


class FilingNotFoundError(EDGARError):
    """Requested filing not found"""
    pass


class NetworkError(EDGARError):
    """Network-related error"""
    pass


@dataclass
class Filing:
    """Represents an SEC filing"""
    accession_number: str
    filing_type: str
    filing_date: str
    accepted_datetime: str
    cik: str
    company_name: str
    
    # URLs
    filing_url: Optional[str] = None
    index_url: Optional[str] = None
    
    # Content (populated when fetched)
    content: Optional[str] = None
    documents: List[Dict[str, Any]] = field(default_factory=list)
    
    @property
    def accession_number_clean(self) -> str:
        """Accession number without dashes"""
        return self.accession_number.replace("-", "")
    
    def to_dict(self) -> dict:
        return {
            "accession_number": self.accession_number,
            "filing_type": self.filing_type,
            "filing_date": self.filing_date,
            "accepted_datetime": self.accepted_datetime,
            "cik": self.cik,
            "company_name": self.company_name,
            "filing_url": self.filing_url,
            "index_url": self.index_url
        }


@dataclass
class Company:
    """Represents a company in EDGAR"""
    cik: str
    name: str
    ticker: Optional[str] = None
    sic: Optional[str] = None  # Standard Industrial Classification
    state: Optional[str] = None
    
    @property
    def cik_padded(self) -> str:
        """CIK padded to 10 digits (required for some EDGAR URLs)"""
        return self.cik.zfill(10)


class RateLimiter:
    """
    Rate limiter for SEC EDGAR requests.
    
    SEC allows max 10 requests per second.
    We target 8/second to be safe.
    """
    
    def __init__(self, requests_per_second: int = 8):
        self.requests_per_second = requests_per_second
        self.min_interval = 1.0 / requests_per_second
        self.last_request_time = 0.0
    
    def wait(self):
        """Wait if necessary to respect rate limit"""
        current_time = time.time()
        elapsed = current_time - self.last_request_time
        
        if elapsed < self.min_interval:
            sleep_time = self.min_interval - elapsed
            logger.debug(f"Rate limiting: sleeping {sleep_time:.3f}s")
            time.sleep(sleep_time)
        
        self.last_request_time = time.time()


class Cache:
    """
    Simple file-based cache for EDGAR responses.
    """
    
    def __init__(self, cache_dir: Path, ttl_hours: int = 168):  # 1 week default
        self.cache_dir = cache_dir
        self.ttl = timedelta(hours=ttl_hours)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
    
    def _key_to_path(self, key: str) -> Path:
        """Convert cache key to file path"""
        # Use hash for safe filenames
        hashed = hashlib.md5(key.encode()).hexdigest()
        return self.cache_dir / f"{hashed}.json"
    
    def get(self, key: str) -> Optional[dict]:
        """Get item from cache if exists and not expired"""
        path = self._key_to_path(key)
        
        if not path.exists():
            return None
        
        try:
            with open(path) as f:
                data = json.load(f)
            
            # Check expiration
            cached_at = datetime.fromisoformat(data.get("_cached_at", "2000-01-01"))
            if datetime.now() - cached_at > self.ttl:
                logger.debug(f"Cache expired for key: {key}")
                path.unlink()
                return None
            
            return data.get("content")
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning(f"Cache read error: {e}")
            return None
    
    def set(self, key: str, content: Any):
        """Store item in cache"""
        path = self._key_to_path(key)
        
        data = {
            "_cached_at": datetime.now().isoformat(),
            "_key": key,
            "content": content
        }
        
        with open(path, "w") as f:
            json.dump(data, f)


class EDGARClient:
    """
    Client for SEC EDGAR API.
    
    Usage:
        client = EDGARClient()
        
        # Get company info
        company = client.get_company("AAPL")
        
        # Get filings
        filings = client.get_filings("AAPL", filing_type="10-K", limit=5)
        
        # Get filing content
        content = client.get_filing_content(filing)
    """
    
    # CIK lookup for common companies (avoid API call)
    KNOWN_CIKS = {
        "AAPL": "320193",
        "MSFT": "789019",
        "GOOGL": "1652044",
        "AMZN": "1018724",
        "META": "1326801",
        "TSLA": "1318605",
        "NVDA": "1045810",
        "JPM": "19617",
        "BAC": "70858",
        "WMT": "104169",
        "JNJ": "200406",
        "V": "1403161",
        "PG": "80424",
        "XOM": "34088",
        "CVX": "93410",
        "KO": "21344",
        "PFE": "78003",
        "DIS": "1744489",
        "NFLX": "1065280",
        "INTC": "50863",
    }
    
    def __init__(self, config: Optional[Config] = None):
        self.config = config or get_config()
        
        # Validate configuration
        if "@" not in self.config.sec.user_agent:
            raise EDGARError(
                "SEC requires contact email in User-Agent. "
                "Set SEC_CONTACT_EMAIL environment variable."
            )
        
        # Setup session with retries
        self.session = self._create_session()
        
        # Rate limiter
        self.rate_limiter = RateLimiter(
            requests_per_second=self.config.sec.rate_limit_per_second
        )
        
        # Cache
        self.cache = Cache(
            cache_dir=self.config.cache.directory / "edgar",
            ttl_hours=self.config.cache.filing_ttl_hours
        )
        
        logger.info(f"EDGAR client initialized with user agent: {self.config.sec.user_agent}")
    
    def _create_session(self) -> requests.Session:
        """Create requests session with retry logic"""
        session = requests.Session()
        
        # Set required headers
        session.headers.update({
            "User-Agent": self.config.sec.user_agent,
            "Accept-Encoding": "gzip, deflate"
        })
        
        # Configure retries
        retry_strategy = Retry(
            total=self.config.sec.max_retries,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET"]
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("https://", adapter)
        session.mount("http://", adapter)
        
        return session
    
    def _request(self, url: str, use_cache: bool = True) -> str:
        """
        Make rate-limited request to EDGAR.
        
        Args:
            url: URL to fetch
            use_cache: Whether to use cache
        
        Returns:
            Response text
        """
        # Check cache first
        if use_cache and self.config.cache.enabled:
            cached = self.cache.get(url)
            if cached:
                logger.debug(f"Cache hit: {url}")
                return cached
        
        # Rate limit
        self.rate_limiter.wait()
        
        try:
            logger.debug(f"Fetching: {url}")
            response = self.session.get(
                url,
                timeout=self.config.sec.request_timeout
            )
            
            if response.status_code == 429:
                raise RateLimitError("SEC rate limit exceeded. Try again later.")
            
            if response.status_code == 404:
                raise FilingNotFoundError(f"Not found: {url}")
            
            response.raise_for_status()
            
            content = response.text
            
            # Cache successful response
            if use_cache and self.config.cache.enabled:
                self.cache.set(url, content)
            
            return content
            
        except requests.exceptions.Timeout:
            raise NetworkError(f"Request timeout: {url}")
        except requests.exceptions.ConnectionError as e:
            raise NetworkError(f"Connection error: {e}")
        except requests.exceptions.RequestException as e:
            raise EDGARError(f"Request failed: {e}")
    
    def get_cik(self, ticker: str) -> str:
        """Get CIK for a ticker symbol."""
        ticker = ticker.upper()
        if ticker in self.KNOWN_CIKS:
            return self.KNOWN_CIKS[ticker]
        try:
            url = "https://www.sec.gov/files/company_tickers.json"
            raw = self._request(url, use_cache=False)
            data = json.loads(raw)
            for entry in data.values():
                if entry.get("ticker", "").upper() == ticker:
                    cik = str(entry["cik_str"])
                    self.KNOWN_CIKS[ticker] = cik
                    return cik
        except Exception as e:
            logger.warning(f"Failed to fetch SEC ticker mapping: {e}")
        raise FilingNotFoundError(f"Could not find CIK for ticker: {ticker}")
    
    def _search_cik(self, ticker: str) -> str:
        """Search for CIK by ticker"""
        url = f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={ticker}&type=&dateb=&owner=include&count=1&output=json"
        
        try:
            content = self._request(url, use_cache=False)
            # Parse response and extract CIK
            # This is a fallback, implementation depends on response format
            raise FilingNotFoundError(f"Could not find CIK for ticker: {ticker}")
        except Exception:
            raise FilingNotFoundError(f"Could not find CIK for ticker: {ticker}")
    
    def get_company(self, ticker_or_cik: str) -> Company:
        """
        Get company information.
        
        Args:
            ticker_or_cik: Ticker symbol or CIK
        
        Returns:
            Company object
        """
        # Determine if input is ticker or CIK
        if ticker_or_cik.isdigit():
            cik = ticker_or_cik
        else:
            cik = self.get_cik(ticker_or_cik)
        
        # Fetch company info from submissions endpoint
        url = f"{self.config.sec.data_url}/submissions/CIK{cik.zfill(10)}.json"
        
        content = self._request(url)
        data = json.loads(content)
        
        return Company(
            cik=cik,
            name=data.get("name", ""),
            ticker=data.get("tickers", [None])[0] if data.get("tickers") else None,
            sic=data.get("sic"),
            state=data.get("stateOfIncorporation")
        )
    
    def get_filings(
        self,
        ticker_or_cik: str,
        filing_type: Optional[str] = None,
        limit: int = 10,
        before_date: Optional[str] = None,
        after_date: Optional[str] = None
    ) -> List[Filing]:
        """
        Get list of filings for a company.
        
        Args:
            ticker_or_cik: Ticker symbol or CIK
            filing_type: Filter by type (e.g., "10-K", "10-Q", "8-K")
            limit: Maximum number of filings to return
            before_date: Only filings before this date (YYYY-MM-DD)
            after_date: Only filings after this date (YYYY-MM-DD)
        
        Returns:
            List of Filing objects
        """
        # Get CIK
        if ticker_or_cik.isdigit():
            cik = ticker_or_cik
        else:
            cik = self.get_cik(ticker_or_cik)
        
        # Fetch submissions
        url = f"{self.config.sec.data_url}/submissions/CIK{cik.zfill(10)}.json"
        content = self._request(url)
        data = json.loads(content)
        
        company_name = data.get("name", "")
        recent = data.get("filings", {}).get("recent", {})
        
        if not recent:
            return []
        
        # Build filing list
        filings = []
        
        accession_numbers = recent.get("accessionNumber", [])
        filing_types = recent.get("form", [])
        filing_dates = recent.get("filingDate", [])
        accepted_datetimes = recent.get("acceptanceDateTime", [])
        primary_documents = recent.get("primaryDocument", [])
        
        for i in range(len(accession_numbers)):
            form = filing_types[i] if i < len(filing_types) else ""
            date = filing_dates[i] if i < len(filing_dates) else ""
            
            # Apply filters
            if filing_type and form != filing_type:
                continue
            
            if before_date and date >= before_date:
                continue
            
            if after_date and date <= after_date:
                continue
            
            accession = accession_numbers[i]
            accession_clean = accession.replace("-", "")
            
            filing = Filing(
                accession_number=accession,
                filing_type=form,
                filing_date=date,
                accepted_datetime=accepted_datetimes[i] if i < len(accepted_datetimes) else "",
                cik=cik,
                company_name=company_name,
                filing_url=f"{self.config.sec.base_url}/Archives/edgar/data/{cik}/{accession_clean}/{primary_documents[i] if i < len(primary_documents) else ''}",
                index_url=f"{self.config.sec.base_url}/Archives/edgar/data/{cik}/{accession_clean}/index.json"
            )
            
            filings.append(filing)
            
            if len(filings) >= limit:
                break
        
        logger.info(f"Found {len(filings)} filings for {ticker_or_cik}")
        return filings
    
    def get_filing_content(self, filing: Filing) -> str:
        """
        Get the content of a filing.
        
        Args:
            filing: Filing object
        
        Returns:
            Filing content as text (HTML or plain text)
        """
        if not filing.filing_url:
            raise EDGARError("Filing URL not available")
        
        content = self._request(filing.filing_url)
        filing.content = content
        
        return content
    
    def get_filing_documents(self, filing: Filing) -> List[Dict[str, Any]]:
        """
        Get list of documents in a filing.
        
        Args:
            filing: Filing object
        
        Returns:
            List of document metadata
        """
        if not filing.index_url:
            raise EDGARError("Filing index URL not available")
        
        content = self._request(filing.index_url)
        data = json.loads(content)
        
        documents = []
        for doc in data.get("directory", {}).get("item", []):
            documents.append({
                "name": doc.get("name"),
                "type": doc.get("type"),
                "size": doc.get("size"),
                "last_modified": doc.get("last-modified")
            })
        
        filing.documents = documents
        return documents
    
    def extract_text_from_html(self, html: str) -> str:
        """
        Extract clean text from HTML filing.
        
        Args:
            html: HTML content
        
        Returns:
            Cleaned text
        """
        try:
            from bs4 import BeautifulSoup
            
            soup = BeautifulSoup(html, "html.parser")
            
            # Remove script and style elements
            for element in soup(["script", "style", "head", "meta"]):
                element.decompose()
            
            # Get text
            text = soup.get_text(separator="\n")
            
            # Clean up whitespace
            lines = [line.strip() for line in text.splitlines()]
            text = "\n".join(line for line in lines if line)
            
            return text
            
        except ImportError:
            # Fallback: basic regex cleaning
            text = re.sub(r"<[^>]+>", " ", html)
            text = re.sub(r"\s+", " ", text)
            return text.strip()


# Convenience functions
def get_client(config: Optional[Config] = None) -> EDGARClient:
    """Get EDGAR client instance"""
    return EDGARClient(config)


if __name__ == "__main__":
    # Test the client
    import sys
    
    logging.basicConfig(level=logging.DEBUG)
    
    # Need to set user agent for testing
    import os
    os.environ["SEC_CONTACT_EMAIL"] = "test@example.com"
    
    try:
        client = EDGARClient()
        
        # Test: Get Apple's CIK
        print("\n1. Getting Apple's CIK...")
        cik = client.get_cik("AAPL")
        print(f"   CIK: {cik}")
        
        # Test: Get company info
        print("\n2. Getting Apple's company info...")
        company = client.get_company("AAPL")
        print(f"   Name: {company.name}")
        print(f"   Ticker: {company.ticker}")
        
        # Test: Get recent 10-K filings
        print("\n3. Getting Apple's recent 10-K filings...")
        filings = client.get_filings("AAPL", filing_type="10-K", limit=3)
        for f in filings:
            print(f"   {f.filing_date}: {f.filing_type} ({f.accession_number})")
        
        # Test: Get filing content (first 500 chars)
        if filings:
            print("\n4. Getting filing content...")
            content = client.get_filing_content(filings[0])
            text = client.extract_text_from_html(content)
            print(f"   Length: {len(text)} characters")
            print(f"   Preview: {text[:300]}...")
        
        print("\n✅ All tests passed!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
