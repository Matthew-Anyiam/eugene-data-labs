"""
Eugene Intelligence - Real-time SEC Filings
WebSocket-based real-time monitoring of SEC EDGAR filings.
Critical for time-sensitive trading decisions and immediate market intelligence.
"""
import json
import logging
import asyncio
import websockets
import aiohttp
from typing import Dict, List, Optional, Callable, Set
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from enum import Enum
from eugene.config import Config, get_config

logger = logging.getLogger(__name__)

class FilingPriority(Enum):
    """Priority levels for real-time filings."""
    CRITICAL = 1   # 8-K breaking news, earnings, M&A
    HIGH = 2       # 10-K/10-Q from large caps
    MEDIUM = 3     # Standard 10-K/10-Q
    LOW = 4        # Routine filings

@dataclass
class RealtimeFiling:
    """A real-time SEC filing event."""
    cik: str
    company_name: str
    ticker: Optional[str]
    form_type: str
    filing_date: datetime
    accession_number: str
    file_name: str
    file_url: str
    priority: FilingPriority
    market_cap: Optional[float] = None
    sector: Optional[str] = None

    # Derived fields for smart filtering
    is_earnings_related: bool = False
    is_merger_related: bool = False
    is_insider_trading: bool = False
    is_major_event: bool = False

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        data = asdict(self)
        data['priority'] = self.priority.name
        data['filing_date'] = self.filing_date.isoformat()
        return data

@dataclass
class FilingFilter:
    """Filter configuration for real-time filings."""
    form_types: Optional[Set[str]] = None  # {'10-K', '10-Q', '8-K'}
    tickers: Optional[Set[str]] = None     # {'AAPL', 'GOOGL', 'TSLA'}
    min_market_cap: Optional[float] = None # Minimum market cap in billions
    sectors: Optional[Set[str]] = None     # {'Technology', 'Healthcare'}
    priority_levels: Optional[Set[FilingPriority]] = None
    keywords: Optional[Set[str]] = None    # Keywords in filing content

@dataclass
class RealtimeMetrics:
    """Real-time streaming metrics."""
    total_filings_received: int = 0
    filings_per_minute: float = 0.0
    critical_alerts: int = 0
    connection_uptime: float = 0.0
    last_filing_time: Optional[datetime] = None
    error_count: int = 0
    filtered_filings: int = 0

class RealtimeFilingsStream:
    """Real-time SEC filings WebSocket stream."""

    def __init__(self, config=None):
        self.config = config or get_config()
        self.websocket = None
        self.session = None
        self.is_connected = False
        self.subscribers = []  # List of callback functions
        self.filters = FilingFilter()
        self.metrics = RealtimeMetrics()

        # Rate limiting and performance
        self.max_filings_per_second = 100
        self.filing_buffer = []
        self.last_buffer_flush = datetime.utcnow()

        # Company metadata cache for enrichment
        self.company_cache = {}
        self.large_cap_tickers = set()  # Preloaded S&P 500, etc.

        # SEC RSS/Atom feeds (fallback if WebSocket unavailable)
        self.rss_feeds = [
            'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&CIK=&type=&company=&dateb=&owner=include&start=0&count=40&output=atom',
        ]

    async def connect(self) -> bool:
        """Connect to real-time filings stream."""
        try:
            # Initialize HTTP session
            self.session = aiohttp.ClientSession(
                headers={'User-Agent': getattr(self.config, 'user_agent', 'Eugene Intelligence')}
            )

            # Load company metadata for enrichment
            await self._load_company_metadata()

            # Start real-time monitoring
            # Note: SEC doesn't provide official WebSocket API, so we'll use polling + RSS
            self.is_connected = True
            logger.info("Connected to real-time filings stream")

            # Start monitoring task
            asyncio.create_task(self._monitor_filings())

            return True

        except Exception as e:
            logger.error(f"Failed to connect to real-time stream: {e}")
            self.is_connected = False
            return False

    async def disconnect(self):
        """Disconnect from real-time stream."""
        self.is_connected = False

        if self.session:
            await self.session.close()

        logger.info("Disconnected from real-time filings stream")

    def subscribe(self, callback: Callable[[RealtimeFiling], None], filing_filter: FilingFilter = None):
        """
        Subscribe to real-time filings with optional filtering.

        Args:
            callback: Function to call when new filing matches filter
            filing_filter: Filter criteria for filings
        """
        self.subscribers.append({
            'callback': callback,
            'filter': filing_filter or FilingFilter()
        })

    def set_global_filter(self, filing_filter: FilingFilter):
        """Set global filter for all filings."""
        self.filters = filing_filter

    async def _monitor_filings(self):
        """Main monitoring loop."""
        while self.is_connected:
            try:
                # Poll SEC RSS feeds for new filings
                new_filings = await self._poll_rss_feeds()

                # Process and enrich filings
                for filing_data in new_filings:
                    filing = await self._create_realtime_filing(filing_data)
                    if filing:
                        await self._process_filing(filing)

                # Update metrics
                self.metrics.last_filing_time = datetime.utcnow()

                # Wait before next poll (respect rate limits)
                await asyncio.sleep(30)  # Poll every 30 seconds

            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                self.metrics.error_count += 1
                await asyncio.sleep(60)  # Back off on error

    async def _poll_rss_feeds(self) -> List[Dict]:
        """Poll SEC RSS/Atom feeds for new filings."""
        new_filings = []

        try:
            # Use SEC's recent filings RSS feed
            url = "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&CIK=&type=&company=&dateb=&owner=include&start=0&count=100&output=atom"

            async with self.session.get(url) as response:
                response.raise_for_status()
                content = await response.text()

            # Parse Atom XML feed
            filings = self._parse_atom_feed(content)
            new_filings.extend(filings)

            self.metrics.total_filings_received += len(filings)

        except Exception as e:
            logger.warning(f"Failed to poll RSS feeds: {e}")

        return new_filings

    def _parse_atom_feed(self, xml_content: str) -> List[Dict]:
        """Parse SEC Atom XML feed."""
        import xml.etree.ElementTree as ET

        filings = []

        try:
            root = ET.fromstring(xml_content)
            namespace = {'atom': 'http://www.w3.org/2005/Atom'}

            for entry in root.findall('.//atom:entry', namespace):
                try:
                    title_elem = entry.find('atom:title', namespace)
                    link_elem = entry.find('atom:link', namespace)
                    updated_elem = entry.find('atom:updated', namespace)

                    if all(elem is not None for elem in [title_elem, link_elem, updated_elem]):
                        title = title_elem.text or ''

                        # Parse title: "FORM TYPE - COMPANY NAME (CIK: 0000000000)"
                        parts = title.split(' - ')
                        if len(parts) >= 2:
                            form_type = parts[0].strip()
                            company_part = parts[1]

                            # Extract CIK
                            cik_match = None
                            if '(CIK:' in company_part:
                                cik_start = company_part.find('(CIK:') + 5
                                cik_end = company_part.find(')', cik_start)
                                if cik_end > cik_start:
                                    cik_match = company_part[cik_start:cik_end].strip()

                            company_name = company_part.split('(CIK:')[0].strip()

                            filing = {
                                'form_type': form_type,
                                'company_name': company_name,
                                'cik': cik_match or '',
                                'filing_url': link_elem.get('href', ''),
                                'filing_date': updated_elem.text or '',
                                'title': title
                            }
                            filings.append(filing)

                except Exception as e:
                    logger.debug(f"Failed to parse feed entry: {e}")
                    continue

        except ET.ParseError as e:
            logger.warning(f"Failed to parse Atom XML: {e}")

        return filings

    async def _create_realtime_filing(self, filing_data: Dict) -> Optional[RealtimeFiling]:
        """Create enriched RealtimeFiling object."""
        try:
            cik = filing_data.get('cik', '').zfill(10)
            company_name = filing_data.get('company_name', '')
            form_type = filing_data.get('form_type', '')

            # Parse filing date
            filing_date_str = filing_data.get('filing_date', '')
            try:
                filing_date = datetime.fromisoformat(filing_date_str.replace('Z', '+00:00'))
            except:
                filing_date = datetime.utcnow()

            # Extract accession number and create proper URLs
            filing_url = filing_data.get('filing_url', '')
            accession_number = self._extract_accession_from_url(filing_url)

            # Get ticker from cache
            company_info = self.company_cache.get(cik, {})
            ticker = company_info.get('ticker')
            market_cap = company_info.get('market_cap')
            sector = company_info.get('sector')

            # Determine priority
            priority = self._calculate_priority(form_type, ticker, market_cap, company_name)

            # Detect special events
            is_earnings = self._is_earnings_related(form_type, company_name)
            is_merger = self._is_merger_related(form_type, company_name)
            is_insider = form_type in ['3', '4', '5', '144']
            is_major = priority in [FilingPriority.CRITICAL, FilingPriority.HIGH]

            filing = RealtimeFiling(
                cik=cik,
                company_name=company_name,
                ticker=ticker,
                form_type=form_type,
                filing_date=filing_date,
                accession_number=accession_number,
                file_name='',
                file_url=filing_url,
                priority=priority,
                market_cap=market_cap,
                sector=sector,
                is_earnings_related=is_earnings,
                is_merger_related=is_merger,
                is_insider_trading=is_insider,
                is_major_event=is_major
            )

            return filing

        except Exception as e:
            logger.warning(f"Failed to create realtime filing: {e}")
            return None

    def _calculate_priority(self, form_type: str, ticker: Optional[str],
                          market_cap: Optional[float], company_name: str) -> FilingPriority:
        """Calculate filing priority based on various factors."""

        # Critical priority for breaking news forms
        if form_type == '8-K':
            if ticker in self.large_cap_tickers or (market_cap and market_cap > 10):
                return FilingPriority.CRITICAL
            else:
                return FilingPriority.HIGH

        # High priority for large cap earnings
        if form_type in ['10-K', '10-Q']:
            if ticker in self.large_cap_tickers or (market_cap and market_cap > 50):
                return FilingPriority.HIGH
            else:
                return FilingPriority.MEDIUM

        # Medium priority for standard filings
        if form_type in ['10-K', '10-Q', '13F-HR']:
            return FilingPriority.MEDIUM

        # Low priority for routine filings
        return FilingPriority.LOW

    def _is_earnings_related(self, form_type: str, company_name: str) -> bool:
        """Check if filing is earnings-related."""
        if form_type == '10-K':  # Annual earnings
            return True
        if form_type == '10-Q':  # Quarterly earnings
            return True
        if form_type == '8-K':  # May contain earnings announcements
            # Would need to analyze content for earnings keywords
            return False
        return False

    def _is_merger_related(self, form_type: str, company_name: str) -> bool:
        """Check if filing is merger/acquisition related."""
        merger_forms = ['8-K', 'DEFM14A', 'DEFM14C', '13D', '13G']
        return form_type in merger_forms

    def _extract_accession_from_url(self, url: str) -> str:
        """Extract accession number from SEC URL."""
        # URL format: https://www.sec.gov/Archives/edgar/data/320193/000032019323000064/0000320193-23-000064-index.html
        try:
            parts = url.split('/')
            for part in parts:
                if '-' in part and len(part) >= 18:
                    return part.split('-index')[0]
        except:
            pass
        return ''

    async def _load_company_metadata(self):
        """Load company metadata for enrichment."""
        try:
            # Load S&P 500 tickers for large cap identification
            # In production, this would come from a more comprehensive database
            sp500_tickers = {
                'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'BRK.B',
                'UNH', 'JNJ', 'XOM', 'JPM', 'V', 'PG', 'HD', 'CVX', 'MA', 'PFE',
                'ABBV', 'BAC', 'COST', 'DIS', 'KO', 'ADBE', 'WMT', 'CRM', 'MRK',
                'PEP', 'TMO', 'NFLX', 'ACN', 'LLY', 'NKE', 'AMD', 'QCOM', 'TXN',
                'NEE', 'DHR', 'PM', 'HON', 'UNP', 'T', 'INTC', 'LOW', 'UPS'
            }
            self.large_cap_tickers = sp500_tickers

            logger.info(f"Loaded {len(self.large_cap_tickers)} large cap tickers")

        except Exception as e:
            logger.warning(f"Failed to load company metadata: {e}")

    async def _process_filing(self, filing: RealtimeFiling):
        """Process a new filing and notify subscribers."""
        try:
            # Apply global filter
            if not self._matches_filter(filing, self.filters):
                self.metrics.filtered_filings += 1
                return

            # Notify subscribers
            for subscriber in self.subscribers:
                if self._matches_filter(filing, subscriber['filter']):
                    try:
                        # Call subscriber callback
                        await self._safe_callback(subscriber['callback'], filing)
                    except Exception as e:
                        logger.warning(f"Subscriber callback failed: {e}")

            # Update metrics
            if filing.priority == FilingPriority.CRITICAL:
                self.metrics.critical_alerts += 1

        except Exception as e:
            logger.error(f"Failed to process filing: {e}")

    def _matches_filter(self, filing: RealtimeFiling, filter_config: FilingFilter) -> bool:
        """Check if filing matches filter criteria."""
        if filter_config.form_types and filing.form_type not in filter_config.form_types:
            return False

        if filter_config.tickers and filing.ticker not in filter_config.tickers:
            return False

        if filter_config.min_market_cap and (not filing.market_cap or filing.market_cap < filter_config.min_market_cap):
            return False

        if filter_config.sectors and filing.sector not in filter_config.sectors:
            return False

        if filter_config.priority_levels and filing.priority not in filter_config.priority_levels:
            return False

        return True

    async def _safe_callback(self, callback: Callable, filing: RealtimeFiling):
        """Safely execute callback function."""
        try:
            if asyncio.iscoroutinefunction(callback):
                await callback(filing)
            else:
                callback(filing)
        except Exception as e:
            logger.warning(f"Callback execution failed: {e}")

    def get_metrics(self) -> RealtimeMetrics:
        """Get current streaming metrics."""
        if self.metrics.last_filing_time:
            uptime = (datetime.utcnow() - self.metrics.last_filing_time).total_seconds()
            self.metrics.connection_uptime = uptime

        return self.metrics

# Convenience functions
async def monitor_sp500_filings(callback: Callable[[RealtimeFiling], None]):
    """Monitor filings from S&P 500 companies."""
    stream = RealtimeFilingsStream()

    # Filter for large cap companies and important forms
    filter_config = FilingFilter(
        form_types={'8-K', '10-K', '10-Q'},
        priority_levels={FilingPriority.CRITICAL, FilingPriority.HIGH}
    )

    await stream.connect()
    stream.subscribe(callback, filter_config)

async def monitor_earnings_releases(callback: Callable[[RealtimeFiling], None]):
    """Monitor earnings-related filings."""
    stream = RealtimeFilingsStream()

    await stream.connect()

    def earnings_callback(filing: RealtimeFiling):
        if filing.is_earnings_related:
            callback(filing)

    stream.subscribe(earnings_callback)

async def monitor_merger_activity(callback: Callable[[RealtimeFiling], None]):
    """Monitor M&A related filings."""
    stream = RealtimeFilingsStream()

    filter_config = FilingFilter(
        form_types={'8-K', 'DEFM14A', '13D', '13G'}
    )

    await stream.connect()
    stream.subscribe(callback, filter_config)