"""
Eugene Intelligence - Real-Time SEC Filing Monitor

Monitors SEC EDGAR for new filings and triggers extraction pipeline.

SEC EDGAR provides:
1. RSS feeds for recent filings
2. Full-index files updated every 10 minutes
3. Company-specific filing histories

This module:
- Polls SEC EDGAR for new filings
- Filters by filing type and company watchlist
- Triggers extraction pipeline
- Notifies subscribers
"""

import asyncio
import aiohttp
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Set, Callable, Any
from collections import defaultdict
import json
import logging
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class SECFiling:
    """Represents a new SEC filing"""
    accession_number: str
    cik: str
    company_name: str
    ticker: Optional[str]
    filing_type: str
    filed_at: datetime
    accepted_at: datetime
    document_url: str
    filing_url: str
    size: Optional[int] = None
    
    def to_dict(self) -> Dict:
        return {
            "accession_number": self.accession_number,
            "cik": self.cik,
            "company_name": self.company_name,
            "ticker": self.ticker,
            "filing_type": self.filing_type,
            "filed_at": self.filed_at.isoformat(),
            "accepted_at": self.accepted_at.isoformat(),
            "document_url": self.document_url,
            "filing_url": self.filing_url,
            "size": self.size
        }


@dataclass
class Subscription:
    """Represents a filing subscription"""
    subscriber_id: str
    tickers: Set[str] = field(default_factory=set)
    filing_types: Set[str] = field(default_factory=set)
    callback: Optional[Callable[[SECFiling], Any]] = None
    webhook_url: Optional[str] = None
    
    def matches(self, filing: SECFiling) -> bool:
        """Check if filing matches subscription criteria"""
        # Check ticker (empty means all tickers)
        if self.tickers and filing.ticker and filing.ticker not in self.tickers:
            return False
        
        # Check filing type (empty means all types)
        if self.filing_types and filing.filing_type not in self.filing_types:
            return False
        
        return True


class CIKTickerMapper:
    """Maps between CIK numbers and stock tickers"""
    
    SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
    
    def __init__(self):
        self._cik_to_ticker: Dict[str, str] = {}
        self._ticker_to_cik: Dict[str, str] = {}
        self._loaded = False
    
    async def load(self):
        """Load CIK-ticker mappings from SEC"""
        if self._loaded:
            return
        
        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "User-Agent": "Eugene Intelligence research@eugenedatalabs.com"
                }
                async with session.get(self.SEC_TICKERS_URL, headers=headers) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        
                        for item in data.values():
                            cik = str(item["cik_str"]).zfill(10)
                            ticker = item["ticker"]
                            
                            self._cik_to_ticker[cik] = ticker
                            self._ticker_to_cik[ticker.upper()] = cik
                        
                        logger.info(f"Loaded {len(self._cik_to_ticker)} CIK-ticker mappings")
                        self._loaded = True
        except Exception as e:
            logger.error(f"Failed to load CIK mappings: {e}")
    
    def get_ticker(self, cik: str) -> Optional[str]:
        """Get ticker for a CIK"""
        cik = str(cik).zfill(10)
        return self._cik_to_ticker.get(cik)
    
    def get_cik(self, ticker: str) -> Optional[str]:
        """Get CIK for a ticker"""
        return self._ticker_to_cik.get(ticker.upper())


class SECFilingMonitor:
    """
    Monitors SEC EDGAR for new filings.
    
    Uses SEC's RSS feed which updates every ~10 minutes with recent filings.
    """
    
    # SEC RSS feed for all recent filings
    RSS_FEED_URL = "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=&company=&dateb=&owner=include&count=100&output=atom"
    
    # Filing types we care about
    MONITORED_TYPES = {
        "10-K", "10-K/A",      # Annual reports
        "10-Q", "10-Q/A",      # Quarterly reports
        "8-K", "8-K/A",        # Current reports (material events)
        "6-K",                 # Foreign private issuer reports
        "4", "4/A",            # Insider transactions
        "13F-HR", "13F-HR/A",  # Institutional holdings
        "SC 13G", "SC 13G/A",  # Beneficial ownership (passive)
        "SC 13D", "SC 13D/A",  # Beneficial ownership (active)
        "DEF 14A",             # Proxy statements
        "S-1", "S-1/A",        # IPO registration
        "424B",                # Prospectus
    }
    
    def __init__(self, poll_interval: int = 60):
        """
        Initialize the monitor.
        
        Args:
            poll_interval: Seconds between polling (default 60, min recommended by SEC)
        """
        self.poll_interval = max(poll_interval, 60)  # SEC asks for >= 10 req/sec
        self.cik_mapper = CIKTickerMapper()
        self.subscriptions: List[Subscription] = []
        self.seen_filings: Set[str] = set()
        self.running = False
        self._session: Optional[aiohttp.ClientSession] = None
        
        # Callbacks for different events
        self.on_filing: Optional[Callable[[SECFiling], Any]] = None
        self.on_error: Optional[Callable[[Exception], Any]] = None
    
    async def start(self):
        """Start monitoring for new filings"""
        logger.info("Starting SEC filing monitor...")
        
        # Load CIK mappings
        await self.cik_mapper.load()
        
        self.running = True
        self._session = aiohttp.ClientSession()
        
        while self.running:
            try:
                new_filings = await self._poll_filings()
                
                for filing in new_filings:
                    await self._process_filing(filing)
                
                if new_filings:
                    logger.info(f"Processed {len(new_filings)} new filings")
                
            except Exception as e:
                logger.error(f"Error polling filings: {e}")
                if self.on_error:
                    await self._call_async(self.on_error, e)
            
            await asyncio.sleep(self.poll_interval)
        
        await self._session.close()
    
    async def stop(self):
        """Stop monitoring"""
        logger.info("Stopping SEC filing monitor...")
        self.running = False
    
    def subscribe(
        self,
        subscriber_id: str,
        tickers: Optional[List[str]] = None,
        filing_types: Optional[List[str]] = None,
        callback: Optional[Callable] = None,
        webhook_url: Optional[str] = None
    ) -> Subscription:
        """
        Subscribe to filing notifications.
        
        Args:
            subscriber_id: Unique identifier for subscriber
            tickers: List of tickers to watch (None = all)
            filing_types: List of filing types (None = all monitored)
            callback: Async function to call with new filings
            webhook_url: URL to POST new filings to
        
        Returns:
            Subscription object
        """
        sub = Subscription(
            subscriber_id=subscriber_id,
            tickers=set(t.upper() for t in tickers) if tickers else set(),
            filing_types=set(filing_types) if filing_types else set(),
            callback=callback,
            webhook_url=webhook_url
        )
        
        self.subscriptions.append(sub)
        logger.info(f"Added subscription: {subscriber_id}")
        
        return sub
    
    def unsubscribe(self, subscriber_id: str):
        """Remove a subscription"""
        self.subscriptions = [
            s for s in self.subscriptions 
            if s.subscriber_id != subscriber_id
        ]
        logger.info(f"Removed subscription: {subscriber_id}")
    
    async def _poll_filings(self) -> List[SECFiling]:
        """Poll SEC RSS feed for new filings"""
        headers = {
            "User-Agent": "Eugene Intelligence research@eugenedatalabs.com",
            "Accept": "application/atom+xml"
        }
        
        async with self._session.get(self.RSS_FEED_URL, headers=headers) as resp:
            if resp.status != 200:
                logger.warning(f"RSS feed returned status {resp.status}")
                return []
            
            content = await resp.text()
        
        return self._parse_rss_feed(content)
    
    def _parse_rss_feed(self, content: str) -> List[SECFiling]:
        """Parse SEC ATOM feed into filing objects"""
        filings = []
        
        try:
            # SEC uses Atom namespace
            ns = {
                "atom": "http://www.w3.org/2005/Atom"
            }
            
            root = ET.fromstring(content)
            
            for entry in root.findall("atom:entry", ns):
                try:
                    filing = self._parse_entry(entry, ns)
                    
                    if filing and filing.accession_number not in self.seen_filings:
                        # Check if it's a filing type we monitor
                        if filing.filing_type in self.MONITORED_TYPES:
                            filings.append(filing)
                            self.seen_filings.add(filing.accession_number)
                            
                            # Keep seen set from growing unbounded
                            if len(self.seen_filings) > 10000:
                                # Remove oldest half
                                self.seen_filings = set(list(self.seen_filings)[5000:])
                
                except Exception as e:
                    logger.debug(f"Error parsing entry: {e}")
                    continue
        
        except ET.ParseError as e:
            logger.error(f"Failed to parse RSS feed: {e}")
        
        return filings
    
    def _parse_entry(self, entry: ET.Element, ns: Dict) -> Optional[SECFiling]:
        """Parse a single RSS entry into a SECFiling"""
        
        title = entry.find("atom:title", ns)
        if title is None or title.text is None:
            return None
        
        # Title format: "10-K - Company Name (0001234567) (Filer)"
        title_text = title.text
        
        # Extract filing type
        filing_type_match = re.match(r"^([A-Z0-9\-/]+)\s*-", title_text)
        if not filing_type_match:
            return None
        filing_type = filing_type_match.group(1).strip()
        
        # Extract CIK
        cik_match = re.search(r"\((\d{10})\)", title_text)
        if not cik_match:
            return None
        cik = cik_match.group(1)
        
        # Extract company name
        name_match = re.search(r"-\s*(.+?)\s*\(\d{10}\)", title_text)
        company_name = name_match.group(1).strip() if name_match else "Unknown"
        
        # Get link
        link = entry.find("atom:link", ns)
        filing_url = link.get("href", "") if link is not None else ""
        
        # Get dates
        updated = entry.find("atom:updated", ns)
        updated_text = updated.text if updated is not None and updated.text else ""
        
        try:
            if updated_text:
                # Format: 2024-01-15T16:30:00-05:00
                filed_at = datetime.fromisoformat(updated_text.replace("Z", "+00:00"))
            else:
                filed_at = datetime.now()
        except:
            filed_at = datetime.now()
        
        # Get accession number from URL
        acc_match = re.search(r"/(\d{10}-\d{2}-\d+)", filing_url)
        accession_number = acc_match.group(1) if acc_match else ""
        
        if not accession_number:
            return None
        
        # Map CIK to ticker
        ticker = self.cik_mapper.get_ticker(cik)
        
        # Build document URL
        acc_no_dashes = accession_number.replace("-", "")
        document_url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{acc_no_dashes}/"
        
        return SECFiling(
            accession_number=accession_number,
            cik=cik,
            company_name=company_name,
            ticker=ticker,
            filing_type=filing_type,
            filed_at=filed_at,
            accepted_at=filed_at,
            document_url=document_url,
            filing_url=filing_url
        )
    
    async def _process_filing(self, filing: SECFiling):
        """Process a new filing - notify subscribers and trigger pipeline"""
        
        logger.info(
            f"New filing: {filing.filing_type} from {filing.ticker or filing.company_name} "
            f"({filing.accession_number})"
        )
        
        # Call global handler
        if self.on_filing:
            await self._call_async(self.on_filing, filing)
        
        # Notify matching subscribers
        for sub in self.subscriptions:
            if sub.matches(filing):
                if sub.callback:
                    await self._call_async(sub.callback, filing)
                
                if sub.webhook_url:
                    await self._send_webhook(sub.webhook_url, filing)
    
    async def _call_async(self, func: Callable, *args):
        """Call a function, handling both sync and async"""
        result = func(*args)
        if asyncio.iscoroutine(result):
            await result
    
    async def _send_webhook(self, url: str, filing: SECFiling):
        """Send filing notification to webhook URL"""
        try:
            async with self._session.post(
                url,
                json=filing.to_dict(),
                headers={"Content-Type": "application/json"}
            ) as resp:
                if resp.status >= 400:
                    logger.warning(f"Webhook failed: {url} returned {resp.status}")
        except Exception as e:
            logger.error(f"Webhook error: {e}")


class FilingProcessor:
    """
    Processes new filings through the extraction pipeline.
    
    Connects the monitor to the extraction system.
    """
    
    def __init__(self, monitor: SECFilingMonitor):
        self.monitor = monitor
        self.monitor.on_filing = self.process_filing
        
        # Queue for extraction jobs
        self.extraction_queue: asyncio.Queue = asyncio.Queue()
        
        # Stats
        self.stats = {
            "filings_received": 0,
            "extractions_queued": 0,
            "extractions_completed": 0,
            "extractions_failed": 0
        }
    
    async def process_filing(self, filing: SECFiling):
        """Handle a new filing"""
        self.stats["filings_received"] += 1
        
        # Only extract from certain filing types
        extractable_types = {"10-K", "10-K/A", "10-Q", "10-Q/A", "8-K", "8-K/A"}
        
        if filing.filing_type in extractable_types:
            await self.extraction_queue.put(filing)
            self.stats["extractions_queued"] += 1
            logger.info(f"Queued extraction for {filing.ticker}: {filing.filing_type}")
    
    async def run_extraction_worker(self):
        """Worker that processes extraction queue"""
        while True:
            filing = await self.extraction_queue.get()
            
            try:
                await self._extract_filing(filing)
                self.stats["extractions_completed"] += 1
            except Exception as e:
                logger.error(f"Extraction failed for {filing.accession_number}: {e}")
                self.stats["extractions_failed"] += 1
            
            self.extraction_queue.task_done()
    
    async def _extract_filing(self, filing: SECFiling):
        """Run extraction on a filing"""
        # Import here to avoid circular imports
        from extraction.edgar import SECEdgarClient
        from extraction.parsers.debt import extract_debt_from_text, result_to_dict
        from extraction.validation import validate_extraction
        
        logger.info(f"Extracting: {filing.ticker} {filing.filing_type}")
        
        # Fetch filing content
        client = SECEdgarClient()
        # ... extraction logic would go here
        
        # For now, just log
        logger.info(f"Extraction complete for {filing.accession_number}")


# ============================================
# CLI for testing
# ============================================

async def main():
    """Run the monitor"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Monitor SEC EDGAR for new filings")
    parser.add_argument("--interval", type=int, default=60, help="Poll interval in seconds")
    parser.add_argument("--tickers", nargs="+", help="Tickers to watch")
    parser.add_argument("--types", nargs="+", help="Filing types to watch")
    
    args = parser.parse_args()
    
    monitor = SECFilingMonitor(poll_interval=args.interval)
    
    # Add a test subscription
    def on_filing(filing: SECFiling):
        print(f"\n{'='*60}")
        print(f"NEW FILING DETECTED")
        print(f"{'='*60}")
        print(f"Type: {filing.filing_type}")
        print(f"Company: {filing.company_name}")
        print(f"Ticker: {filing.ticker or 'N/A'}")
        print(f"Filed: {filing.filed_at}")
        print(f"URL: {filing.filing_url}")
        print(f"{'='*60}\n")
    
    monitor.subscribe(
        subscriber_id="test",
        tickers=args.tickers,
        filing_types=args.types,
        callback=on_filing
    )
    
    print(f"Starting SEC monitor (polling every {args.interval}s)...")
    print(f"Watching tickers: {args.tickers or 'ALL'}")
    print(f"Watching types: {args.types or list(monitor.MONITORED_TYPES)}")
    print("Press Ctrl+C to stop\n")
    
    try:
        await monitor.start()
    except KeyboardInterrupt:
        await monitor.stop()
        print("\nMonitor stopped")


if __name__ == "__main__":
    asyncio.run(main())
