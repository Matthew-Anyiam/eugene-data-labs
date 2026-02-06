"""
Eugene Intelligence - Resilient Job Runner

Handles failures gracefully:
- Retries with exponential backoff
- Checkpointing for resume after crash
- Rate limiting for API calls
- Circuit breaker for repeated failures
- Progress tracking
- Graceful shutdown

Usage:
    runner = ResilientRunner()
    await runner.run_extraction_job(tickers=["TSLA", "AAPL", "MSFT"])
"""

import asyncio
import json
import os
import signal
import sys
import time
import traceback
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Callable, Any, Set
from enum import Enum
import logging
import hashlib

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)


class JobStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    RETRYING = "retrying"


class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if recovered


@dataclass
class TaskResult:
    """Result of a single task"""
    task_id: str
    ticker: str
    status: JobStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    attempts: int = 0
    error: Optional[str] = None
    result_path: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return {
            **asdict(self),
            "status": self.status.value,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }


@dataclass
class Checkpoint:
    """Checkpoint for job resumption"""
    job_id: str
    created_at: datetime
    updated_at: datetime
    total_tasks: int
    completed_tasks: int
    failed_tasks: int
    pending_tickers: List[str]
    completed_tickers: List[str]
    failed_tickers: List[str]
    task_results: Dict[str, Dict]
    
    def to_dict(self) -> Dict:
        return {
            **asdict(self),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "Checkpoint":
        return cls(
            job_id=data["job_id"],
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            total_tasks=data["total_tasks"],
            completed_tasks=data["completed_tasks"],
            failed_tasks=data["failed_tasks"],
            pending_tickers=data["pending_tickers"],
            completed_tickers=data["completed_tickers"],
            failed_tickers=data["failed_tickers"],
            task_results=data["task_results"]
        )


class CircuitBreaker:
    """
    Circuit breaker to prevent cascade failures.
    
    Opens after N consecutive failures, waits before retrying.
    """
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        half_open_requests: int = 3
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_requests = half_open_requests
        
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.half_open_successes = 0
    
    def can_execute(self) -> bool:
        """Check if we can execute a request"""
        if self.state == CircuitState.CLOSED:
            return True
        
        if self.state == CircuitState.OPEN:
            # Check if recovery timeout has passed
            if self.last_failure_time:
                elapsed = (datetime.now() - self.last_failure_time).total_seconds()
                if elapsed >= self.recovery_timeout:
                    logger.info("Circuit breaker: Moving to HALF_OPEN")
                    self.state = CircuitState.HALF_OPEN
                    self.half_open_successes = 0
                    return True
            return False
        
        # HALF_OPEN: allow limited requests
        return True
    
    def record_success(self):
        """Record a successful request"""
        self.failure_count = 0
        
        if self.state == CircuitState.HALF_OPEN:
            self.half_open_successes += 1
            if self.half_open_successes >= self.half_open_requests:
                logger.info("Circuit breaker: Recovered, moving to CLOSED")
                self.state = CircuitState.CLOSED
        
        self.success_count += 1
    
    def record_failure(self):
        """Record a failed request"""
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        
        if self.state == CircuitState.HALF_OPEN:
            logger.warning("Circuit breaker: Failed in HALF_OPEN, reopening")
            self.state = CircuitState.OPEN
        elif self.failure_count >= self.failure_threshold:
            logger.warning(f"Circuit breaker: OPEN after {self.failure_count} failures")
            self.state = CircuitState.OPEN
    
    def get_wait_time(self) -> int:
        """Get seconds to wait before retry"""
        if self.state == CircuitState.OPEN and self.last_failure_time:
            elapsed = (datetime.now() - self.last_failure_time).total_seconds()
            remaining = self.recovery_timeout - elapsed
            return max(0, int(remaining))
        return 0


class RateLimiter:
    """
    Token bucket rate limiter.
    
    Prevents hitting API rate limits.
    """
    
    def __init__(self, requests_per_minute: int = 20):
        self.requests_per_minute = requests_per_minute
        self.tokens = requests_per_minute
        self.last_refill = time.time()
        self._lock = asyncio.Lock()
    
    async def acquire(self):
        """Wait until we can make a request"""
        async with self._lock:
            while True:
                now = time.time()
                
                # Refill tokens based on time passed
                time_passed = now - self.last_refill
                tokens_to_add = time_passed * (self.requests_per_minute / 60)
                self.tokens = min(self.requests_per_minute, self.tokens + tokens_to_add)
                self.last_refill = now
                
                if self.tokens >= 1:
                    self.tokens -= 1
                    return
                
                # Wait for token
                wait_time = (1 - self.tokens) / (self.requests_per_minute / 60)
                await asyncio.sleep(wait_time)


class RetryPolicy:
    """Configurable retry policy with exponential backoff"""
    
    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        jitter: bool = True
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter
    
    def get_delay(self, attempt: int) -> float:
        """Get delay for attempt number (0-indexed)"""
        delay = self.base_delay * (self.exponential_base ** attempt)
        delay = min(delay, self.max_delay)
        
        if self.jitter:
            import random
            delay = delay * (0.5 + random.random())
        
        return delay
    
    def should_retry(self, attempt: int, error: Exception) -> bool:
        """Determine if we should retry based on attempt and error type"""
        if attempt >= self.max_retries:
            return False
        
        # Don't retry on certain errors
        error_str = str(error).lower()
        non_retryable = [
            "invalid api key",
            "authentication",
            "unauthorized",
            "forbidden",
            "not found"
        ]
        
        for msg in non_retryable:
            if msg in error_str:
                return False
        
        return True


class ResilientRunner:
    """
    Resilient job runner with:
    - Retries with exponential backoff
    - Circuit breaker
    - Rate limiting
    - Checkpointing
    - Graceful shutdown
    """
    
    def __init__(
        self,
        checkpoint_dir: str = "data/checkpoints",
        output_dir: str = "data/extractions",
        retry_policy: Optional[RetryPolicy] = None,
        rate_limiter: Optional[RateLimiter] = None,
        circuit_breaker: Optional[CircuitBreaker] = None
    ):
        self.checkpoint_dir = Path(checkpoint_dir)
        self.output_dir = Path(output_dir)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.retry_policy = retry_policy or RetryPolicy()
        self.rate_limiter = rate_limiter or RateLimiter()
        self.circuit_breaker = circuit_breaker or CircuitBreaker()
        
        # State
        self.current_checkpoint: Optional[Checkpoint] = None
        self.shutdown_requested = False
        self.current_task: Optional[str] = None
        
        # Setup signal handlers
        self._setup_signal_handlers()
    
    def _setup_signal_handlers(self):
        """Setup handlers for graceful shutdown"""
        def handle_signal(signum, frame):
            logger.warning(f"Received signal {signum}, requesting graceful shutdown...")
            self.shutdown_requested = True
        
        signal.signal(signal.SIGINT, handle_signal)
        signal.signal(signal.SIGTERM, handle_signal)
    
    def _generate_job_id(self, tickers: List[str]) -> str:
        """Generate unique job ID"""
        content = f"{','.join(sorted(tickers))}:{datetime.now().isoformat()}"
        return hashlib.sha256(content.encode()).hexdigest()[:12]
    
    def _get_checkpoint_path(self, job_id: str) -> Path:
        """Get path for checkpoint file"""
        return self.checkpoint_dir / f"checkpoint_{job_id}.json"
    
    def _save_checkpoint(self, checkpoint: Checkpoint):
        """Save checkpoint to disk"""
        checkpoint.updated_at = datetime.now()
        path = self._get_checkpoint_path(checkpoint.job_id)
        
        with open(path, 'w') as f:
            json.dump(checkpoint.to_dict(), f, indent=2)
        
        logger.debug(f"Checkpoint saved: {checkpoint.completed_tasks}/{checkpoint.total_tasks}")
    
    def _load_checkpoint(self, job_id: str) -> Optional[Checkpoint]:
        """Load checkpoint from disk"""
        path = self._get_checkpoint_path(job_id)
        
        if not path.exists():
            return None
        
        with open(path) as f:
            data = json.load(f)
        
        return Checkpoint.from_dict(data)
    
    def find_resumable_job(self, tickers: List[str]) -> Optional[Checkpoint]:
        """Find a checkpoint that matches these tickers"""
        ticker_set = set(tickers)
        
        for path in self.checkpoint_dir.glob("checkpoint_*.json"):
            try:
                with open(path) as f:
                    data = json.load(f)
                
                checkpoint_tickers = set(
                    data.get("pending_tickers", []) +
                    data.get("completed_tickers", []) +
                    data.get("failed_tickers", [])
                )
                
                if checkpoint_tickers == ticker_set:
                    # Check if there's pending work
                    if data.get("pending_tickers"):
                        return Checkpoint.from_dict(data)
            except:
                continue
        
        return None
    
    async def run_extraction_job(
        self,
        tickers: List[str],
        filing_type: str = "10-K",
        resume: bool = True,
        extraction_fn: Optional[Callable] = None
    ) -> Dict:
        """
        Run extraction job with full resilience.
        
        Args:
            tickers: List of stock tickers
            filing_type: SEC filing type
            resume: Whether to resume from checkpoint
            extraction_fn: Custom extraction function (for testing)
        
        Returns:
            Job summary with results
        """
        # Check for resumable job
        if resume:
            checkpoint = self.find_resumable_job(tickers)
            if checkpoint:
                logger.info(f"Resuming job {checkpoint.job_id} "
                           f"({checkpoint.completed_tasks}/{checkpoint.total_tasks} done)")
                self.current_checkpoint = checkpoint
        
        # Create new checkpoint if needed
        if not self.current_checkpoint:
            job_id = self._generate_job_id(tickers)
            self.current_checkpoint = Checkpoint(
                job_id=job_id,
                created_at=datetime.now(),
                updated_at=datetime.now(),
                total_tasks=len(tickers),
                completed_tasks=0,
                failed_tasks=0,
                pending_tickers=list(tickers),
                completed_tickers=[],
                failed_tickers=[],
                task_results={}
            )
            self._save_checkpoint(self.current_checkpoint)
            logger.info(f"Created job {job_id} with {len(tickers)} tickers")
        
        # Use default extraction if none provided
        if extraction_fn is None:
            extraction_fn = self._default_extraction
        
        # Process pending tickers
        while self.current_checkpoint.pending_tickers and not self.shutdown_requested:
            ticker = self.current_checkpoint.pending_tickers[0]
            
            # Check circuit breaker
            if not self.circuit_breaker.can_execute():
                wait_time = self.circuit_breaker.get_wait_time()
                logger.warning(f"Circuit breaker open, waiting {wait_time}s...")
                await asyncio.sleep(wait_time)
                continue
            
            # Process ticker
            result = await self._process_ticker(ticker, filing_type, extraction_fn)
            
            # Update checkpoint
            self.current_checkpoint.pending_tickers.remove(ticker)
            
            if result.status == JobStatus.COMPLETED:
                self.current_checkpoint.completed_tickers.append(ticker)
                self.current_checkpoint.completed_tasks += 1
                self.circuit_breaker.record_success()
            else:
                self.current_checkpoint.failed_tickers.append(ticker)
                self.current_checkpoint.failed_tasks += 1
                self.circuit_breaker.record_failure()
            
            self.current_checkpoint.task_results[ticker] = result.to_dict()
            self._save_checkpoint(self.current_checkpoint)
            
            # Progress log
            total = self.current_checkpoint.total_tasks
            done = self.current_checkpoint.completed_tasks
            failed = self.current_checkpoint.failed_tasks
            logger.info(f"Progress: {done}/{total} completed, {failed} failed")
        
        # Handle shutdown
        if self.shutdown_requested:
            logger.warning("Shutdown requested, job paused")
            return {
                "status": "paused",
                "job_id": self.current_checkpoint.job_id,
                "completed": self.current_checkpoint.completed_tasks,
                "failed": self.current_checkpoint.failed_tasks,
                "remaining": len(self.current_checkpoint.pending_tickers),
                "message": "Job paused, run again to resume"
            }
        
        # Job complete
        logger.info(f"Job {self.current_checkpoint.job_id} completed")
        
        # Clean up checkpoint
        checkpoint_path = self._get_checkpoint_path(self.current_checkpoint.job_id)
        if checkpoint_path.exists():
            # Keep for audit, rename
            final_path = checkpoint_path.with_suffix('.completed.json')
            checkpoint_path.rename(final_path)
        
        return {
            "status": "completed",
            "job_id": self.current_checkpoint.job_id,
            "completed": self.current_checkpoint.completed_tasks,
            "failed": self.current_checkpoint.failed_tasks,
            "completed_tickers": self.current_checkpoint.completed_tickers,
            "failed_tickers": self.current_checkpoint.failed_tickers,
            "results": self.current_checkpoint.task_results
        }
    
    async def _process_ticker(
        self,
        ticker: str,
        filing_type: str,
        extraction_fn: Callable
    ) -> TaskResult:
        """Process a single ticker with retries"""
        
        task_id = f"{ticker}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        result = TaskResult(
            task_id=task_id,
            ticker=ticker,
            status=JobStatus.RUNNING,
            started_at=datetime.now()
        )
        
        self.current_task = ticker
        logger.info(f"Processing {ticker}...")
        
        attempt = 0
        last_error = None
        
        while attempt <= self.retry_policy.max_retries:
            try:
                # Rate limit
                await self.rate_limiter.acquire()
                
                # Run extraction
                output_path = await extraction_fn(ticker, filing_type)
                
                # Success
                result.status = JobStatus.COMPLETED
                result.completed_at = datetime.now()
                result.result_path = output_path
                result.attempts = attempt + 1
                
                logger.info(f"✓ {ticker} completed (attempt {attempt + 1})")
                return result
                
            except Exception as e:
                last_error = e
                result.attempts = attempt + 1
                
                logger.warning(f"✗ {ticker} failed (attempt {attempt + 1}): {e}")
                
                if self.retry_policy.should_retry(attempt, e):
                    delay = self.retry_policy.get_delay(attempt)
                    logger.info(f"  Retrying in {delay:.1f}s...")
                    result.status = JobStatus.RETRYING
                    await asyncio.sleep(delay)
                    attempt += 1
                else:
                    break
        
        # All retries exhausted
        result.status = JobStatus.FAILED
        result.completed_at = datetime.now()
        result.error = str(last_error)
        
        logger.error(f"✗ {ticker} failed permanently after {result.attempts} attempts")
        return result
    
    async def _default_extraction(self, ticker: str, filing_type: str) -> str:
        """Default extraction function"""
        # Import here to avoid circular imports
        from extraction.edgar import SECEdgarClient, extract_debt_section
        from extraction.parsers.debt import extract_debt_from_text, result_to_dict
        from extraction.validation import validate_extraction
        
        # Fetch filing
        client = SECEdgarClient()
        filings = client.get_company_filings(ticker, filing_type, limit=1)
        
        if not filings:
            raise ValueError(f"No {filing_type} found for {ticker}")
        
        filing = filings[0]
        
        # Get filing text
        filing_text = client.get_filing_document(ticker, filing_type)
        if not filing_text:
            raise ValueError(f"Could not download filing for {ticker}")
        
        # Extract debt section
        debt_section = extract_debt_section(filing_text)
        if not debt_section or len(debt_section) < 500:
            debt_section = filing_text[:50000]
        
        # Run extraction
        filing_date = filing.get('filedAt', '').split('T')[0]
        result = extract_debt_from_text(
            filing_text=debt_section,
            company_ticker=ticker,
            filing_date=filing_date
        )
        
        # Validate
        result_dict = result_to_dict(result)
        quality = validate_extraction(result_dict)
        
        # Save output
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = self.output_dir / f"{ticker}_{timestamp}.json"
        
        with open(output_path, 'w') as f:
            json.dump({
                "ticker": ticker,
                "filing_type": filing_type,
                "filing_date": filing_date,
                "quality_score": quality.overall_confidence,
                "should_serve": quality.should_serve,
                "data": result_dict
            }, f, indent=2, default=str)
        
        return str(output_path)


# ============================================
# CLI
# ============================================

async def main():
    """CLI for resilient runner"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Resilient extraction job runner")
    parser.add_argument("--tickers", "-t", nargs="+", required=True, help="Tickers to process")
    parser.add_argument("--filing-type", "-f", default="10-K", help="Filing type")
    parser.add_argument("--no-resume", action="store_true", help="Don't resume from checkpoint")
    parser.add_argument("--max-retries", type=int, default=3, help="Max retries per ticker")
    parser.add_argument("--rate-limit", type=int, default=20, help="Requests per minute")
    
    args = parser.parse_args()
    
    runner = ResilientRunner(
        retry_policy=RetryPolicy(max_retries=args.max_retries),
        rate_limiter=RateLimiter(requests_per_minute=args.rate_limit)
    )
    
    result = await runner.run_extraction_job(
        tickers=args.tickers,
        filing_type=args.filing_type,
        resume=not args.no_resume
    )
    
    print("\n" + "=" * 60)
    print("JOB SUMMARY")
    print("=" * 60)
    print(f"Status: {result['status']}")
    print(f"Completed: {result['completed']}")
    print(f"Failed: {result['failed']}")
    
    if result.get('failed_tickers'):
        print(f"Failed tickers: {', '.join(result['failed_tickers'])}")
    
    if result['status'] == 'paused':
        print(f"\nTo resume: python resilient_runner.py --tickers {' '.join(args.tickers)}")


if __name__ == "__main__":
    asyncio.run(main())
