"""
Eugene Intelligence - Bulk Downloads
High-performance bulk data retrieval from SEC EDGAR for batch processing.
Critical for building comprehensive financial datasets.
"""
import json
import logging
import gzip
import asyncio
import aiohttp
from typing import Dict, List, Optional, Iterator, Tuple
from dataclasses import dataclass
from datetime import datetime, date, timedelta
from pathlib import Path
from eugene.config import Config, get_config

logger = logging.getLogger(__name__)

@dataclass
class BulkDownloadJob:
    """Configuration for a bulk download job."""
    job_id: str
    data_type: str  # 'company_tickers', 'submissions', 'xbrl_datasets'
    date_range: Tuple[date, date]  # (start_date, end_date)
    output_path: str
    filters: Dict = None  # Additional filtering criteria
    status: str = 'pending'  # pending, running, completed, failed
    progress: float = 0.0
    created_at: datetime = None
    completed_at: datetime = None
    error_message: str = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()

@dataclass
class BulkDataset:
    """Represents a bulk dataset from SEC EDGAR."""
    dataset_name: str
    file_path: str
    record_count: int
    file_size_mb: float
    last_updated: datetime
    schema: Dict
    data_quality_score: float = 0.0

class BulkDownloader:
    """High-performance bulk data downloader for SEC EDGAR."""

    def __init__(self, config=None):
        self.config = config or get_config()
        self.base_url = "https://www.sec.gov/Archives/edgar"
        self.data_url = "https://data.sec.gov"
        self.session = None
        self.download_jobs = {}

        # Rate limiting for bulk operations
        self.request_delay = 0.1  # 100ms between requests
        self.max_concurrent = 10

    async def __aenter__(self):
        """Async context manager entry."""
        connector = aiohttp.TCPConnector(limit=self.max_concurrent)
        timeout = aiohttp.ClientTimeout(total=300)  # 5 minute timeout
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={'User-Agent': getattr(self.config, 'user_agent', 'Eugene Intelligence')}
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()

    async def download_company_tickers_bulk(self, output_path: str = None) -> BulkDataset:
        """
        Download complete company tickers dataset.
        Contains all public companies with CIK, ticker, name mapping.
        """
        output_path = output_path or "data/bulk/company_tickers.json"
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        try:
            url = f"{self.data_url}/files/company_tickers_exchange.json"

            async with self.session.get(url) as response:
                response.raise_for_status()
                data = await response.json()

            # Transform data for better usability
            companies = []
            for cik, company_info in data.items():
                companies.append({
                    'cik': str(cik).zfill(10),
                    'ticker': company_info.get('ticker', ''),
                    'title': company_info.get('title', ''),
                    'sic': company_info.get('sic')
                })

            # Save to file
            with open(output_path, 'w') as f:
                json.dump({
                    'metadata': {
                        'download_date': datetime.utcnow().isoformat(),
                        'source': 'SEC EDGAR',
                        'record_count': len(companies)
                    },
                    'companies': companies
                }, f, indent=2)

            file_size = Path(output_path).stat().st_size / (1024 * 1024)

            return BulkDataset(
                dataset_name='company_tickers',
                file_path=output_path,
                record_count=len(companies),
                file_size_mb=file_size,
                last_updated=datetime.utcnow(),
                schema={
                    'cik': 'string (10 digits, zero-padded)',
                    'ticker': 'string (stock symbol)',
                    'title': 'string (company name)',
                    'sic': 'integer (standard industrial classification)'
                },
                data_quality_score=95.0
            )

        except Exception as e:
            logger.error(f"Failed to download company tickers: {e}")
            raise

    async def download_submissions_bulk(self,
                                      start_date: date,
                                      end_date: date,
                                      filing_types: List[str] = None,
                                      output_path: str = None) -> BulkDataset:
        """
        Download bulk submissions for date range.

        Args:
            start_date: Start date for filings
            end_date: End date for filings
            filing_types: Filter by filing types (e.g., ['10-K', '10-Q'])
            output_path: Output file path
        """
        filing_types = filing_types or ['10-K', '10-Q', '8-K', '13F-HR']
        output_path = output_path or f"data/bulk/submissions_{start_date}_{end_date}.json"
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        try:
            # Get daily index files for date range
            submissions = []
            current_date = start_date

            while current_date <= end_date:
                daily_submissions = await self._download_daily_index(current_date, filing_types)
                submissions.extend(daily_submissions)
                current_date += timedelta(days=1)

                # Rate limiting
                await asyncio.sleep(self.request_delay)

            # Save consolidated data
            with open(output_path, 'w') as f:
                json.dump({
                    'metadata': {
                        'download_date': datetime.utcnow().isoformat(),
                        'date_range': [start_date.isoformat(), end_date.isoformat()],
                        'filing_types': filing_types,
                        'record_count': len(submissions)
                    },
                    'submissions': submissions
                }, f, indent=2)

            file_size = Path(output_path).stat().st_size / (1024 * 1024)

            return BulkDataset(
                dataset_name='submissions_bulk',
                file_path=output_path,
                record_count=len(submissions),
                file_size_mb=file_size,
                last_updated=datetime.utcnow(),
                schema={
                    'cik': 'string (company identifier)',
                    'company_name': 'string',
                    'form_type': 'string (filing type)',
                    'date_filed': 'string (ISO date)',
                    'accession_number': 'string (SEC accession)',
                    'file_name': 'string',
                    'url': 'string (filing URL)'
                },
                data_quality_score=90.0
            )

        except Exception as e:
            logger.error(f"Failed to download submissions bulk: {e}")
            raise

    async def download_xbrl_datasets(self,
                                   quarters: List[str],
                                   output_path: str = None) -> List[BulkDataset]:
        """
        Download quarterly XBRL datasets.
        These contain standardized financial data for all public companies.

        Args:
            quarters: List of quarters like ['2024q1', '2024q2', '2024q3']
            output_path: Base output directory
        """
        output_path = output_path or "data/bulk/xbrl"
        Path(output_path).mkdir(parents=True, exist_ok=True)

        datasets = []

        for quarter in quarters:
            try:
                year, q = quarter[:4], quarter[4:]

                # Download quarterly XBRL dataset
                dataset = await self._download_quarterly_xbrl(year, q, output_path)
                if dataset:
                    datasets.append(dataset)

                await asyncio.sleep(self.request_delay * 10)  # Longer delay for large files

            except Exception as e:
                logger.warning(f"Failed to download XBRL for {quarter}: {e}")
                continue

        return datasets

    async def _download_daily_index(self, target_date: date, filing_types: List[str]) -> List[Dict]:
        """Download and parse daily index file."""
        try:
            # SEC daily index URL format
            year = target_date.year
            quarter = f"QTR{(target_date.month - 1) // 3 + 1}"
            date_str = target_date.strftime("%Y%m%d")

            url = f"{self.base_url}/daily-index/{year}/{quarter}/master.{date_str}.idx"

            async with self.session.get(url) as response:
                if response.status == 404:
                    return []  # No filings for this date

                response.raise_for_status()
                content = await response.text()

            # Parse index file
            submissions = []
            lines = content.split('\n')

            # Skip header lines
            data_start = False
            for line in lines:
                if '----' in line and not data_start:
                    data_start = True
                    continue

                if not data_start or not line.strip():
                    continue

                parts = line.split('|')
                if len(parts) >= 5:
                    cik, company_name, form_type, date_filed, file_name = parts[:5]

                    if form_type in filing_types:
                        submissions.append({
                            'cik': cik.strip().zfill(10),
                            'company_name': company_name.strip(),
                            'form_type': form_type.strip(),
                            'date_filed': date_filed.strip(),
                            'file_name': file_name.strip(),
                            'accession_number': self._extract_accession(file_name),
                            'url': f"{self.base_url}/{file_name}"
                        })

            return submissions

        except Exception as e:
            logger.warning(f"Failed to download daily index for {target_date}: {e}")
            return []

    async def _download_quarterly_xbrl(self, year: str, quarter: str, output_path: str) -> Optional[BulkDataset]:
        """Download quarterly XBRL dataset."""
        try:
            # SEC XBRL dataset URLs
            dataset_name = f"{year}{quarter.lower()}"
            url = f"{self.data_url}/api/xbrl/datasets/{dataset_name}.zip"

            file_path = f"{output_path}/{dataset_name}.zip"

            async with self.session.get(url) as response:
                if response.status == 404:
                    logger.warning(f"XBRL dataset {dataset_name} not available")
                    return None

                response.raise_for_status()

                # Save file
                with open(file_path, 'wb') as f:
                    async for chunk in response.content.iter_chunked(8192):
                        f.write(chunk)

            file_size = Path(file_path).stat().st_size / (1024 * 1024)

            return BulkDataset(
                dataset_name=f'xbrl_{dataset_name}',
                file_path=file_path,
                record_count=0,  # Would need to unzip and count
                file_size_mb=file_size,
                last_updated=datetime.utcnow(),
                schema={
                    'contains': 'XBRL facts, dimensions, presentations, calculations',
                    'format': 'ZIP archive with TSV files',
                    'coverage': 'All public company XBRL submissions for quarter'
                },
                data_quality_score=98.0
            )

        except Exception as e:
            logger.error(f"Failed to download XBRL dataset {year}{quarter}: {e}")
            return None

    def _extract_accession(self, file_name: str) -> str:
        """Extract accession number from file name."""
        # File names like: edgar/data/320193/0000320193-21-000010/aapl-20201226.htm
        parts = file_name.split('/')
        for part in parts:
            if '-' in part and len(part) >= 18:  # Accession format: 0000000000-00-000000
                return part
        return ''

    async def create_download_job(self, job: BulkDownloadJob) -> str:
        """Create and queue a bulk download job."""
        self.download_jobs[job.job_id] = job

        # Start job execution in background
        asyncio.create_task(self._execute_job(job))

        return job.job_id

    async def get_job_status(self, job_id: str) -> Optional[BulkDownloadJob]:
        """Get status of a download job."""
        return self.download_jobs.get(job_id)

    async def _execute_job(self, job: BulkDownloadJob):
        """Execute a download job."""
        try:
            job.status = 'running'

            if job.data_type == 'company_tickers':
                result = await self.download_company_tickers_bulk(job.output_path)
            elif job.data_type == 'submissions':
                start_date, end_date = job.date_range
                result = await self.download_submissions_bulk(
                    start_date, end_date,
                    job.filters.get('filing_types') if job.filters else None,
                    job.output_path
                )
            elif job.data_type == 'xbrl_datasets':
                quarters = job.filters.get('quarters', []) if job.filters else []
                results = await self.download_xbrl_datasets(quarters, job.output_path)
                result = results[0] if results else None
            else:
                raise ValueError(f"Unknown data type: {job.data_type}")

            job.status = 'completed'
            job.progress = 100.0
            job.completed_at = datetime.utcnow()

        except Exception as e:
            job.status = 'failed'
            job.error_message = str(e)
            logger.error(f"Job {job.job_id} failed: {e}")

# Convenience functions
async def download_all_companies() -> BulkDataset:
    """Download complete company tickers dataset."""
    async with BulkDownloader() as downloader:
        return await downloader.download_company_tickers_bulk()

async def download_recent_filings(days: int = 30) -> BulkDataset:
    """Download recent filings for specified number of days."""
    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    async with BulkDownloader() as downloader:
        return await downloader.download_submissions_bulk(start_date, end_date)

async def download_quarterly_data(year: int, quarter: int) -> Optional[BulkDataset]:
    """Download XBRL data for a specific quarter."""
    quarter_str = f"{year}q{quarter}"

    async with BulkDownloader() as downloader:
        results = await downloader.download_xbrl_datasets([quarter_str])
        return results[0] if results else None