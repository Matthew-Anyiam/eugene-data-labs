"""
Eugene Intelligence - Data Store

Unified storage layer for all extracted financial data.

Supports:
- PostgreSQL for structured queries
- S3 for raw filings and version history
- In-memory cache for hot data

Design principles (from Fintool):
- S3 is source of truth (11 nines durability)
- PostgreSQL for fast queries
- Version everything
- Cache aggressively
"""

import os
import json
import hashlib
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Any, Union
from pathlib import Path
import asyncio
from abc import ABC, abstractmethod


@dataclass
class StoredExtraction:
    """Metadata for a stored extraction"""
    id: str
    ticker: str
    extraction_type: str  # "debt", "earnings", "filing"
    source_filing: Optional[str]  # accession number
    filing_date: str
    extracted_at: datetime
    version: int
    quality_score: float
    storage_path: str  # S3 or local path
    
    def to_dict(self) -> Dict:
        return {
            **asdict(self),
            "extracted_at": self.extracted_at.isoformat()
        }


class DataStoreBackend(ABC):
    """Abstract backend for data storage"""
    
    @abstractmethod
    async def save(self, key: str, data: Dict, metadata: Dict) -> str:
        pass
    
    @abstractmethod
    async def load(self, key: str) -> Optional[Dict]:
        pass
    
    @abstractmethod
    async def delete(self, key: str) -> bool:
        pass
    
    @abstractmethod
    async def list_keys(self, prefix: str) -> List[str]:
        pass


class LocalFileBackend(DataStoreBackend):
    """Local filesystem backend for development"""
    
    def __init__(self, base_path: str = "data/store"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
    
    def _key_to_path(self, key: str) -> Path:
        # Sanitize key for filesystem
        safe_key = key.replace("/", "_").replace(":", "_")
        return self.base_path / f"{safe_key}.json"
    
    async def save(self, key: str, data: Dict, metadata: Dict) -> str:
        path = self._key_to_path(key)
        
        stored = {
            "key": key,
            "data": data,
            "metadata": metadata,
            "stored_at": datetime.now().isoformat()
        }
        
        with open(path, 'w') as f:
            json.dump(stored, f, indent=2, default=str)
        
        return str(path)
    
    async def load(self, key: str) -> Optional[Dict]:
        path = self._key_to_path(key)
        
        if not path.exists():
            return None
        
        with open(path) as f:
            stored = json.load(f)
        
        return stored.get("data")
    
    async def delete(self, key: str) -> bool:
        path = self._key_to_path(key)
        
        if path.exists():
            path.unlink()
            return True
        return False
    
    async def list_keys(self, prefix: str) -> List[str]:
        keys = []
        safe_prefix = prefix.replace("/", "_").replace(":", "_")
        
        for path in self.base_path.glob(f"{safe_prefix}*.json"):
            with open(path) as f:
                stored = json.load(f)
                keys.append(stored.get("key", path.stem))
        
        return keys


class S3Backend(DataStoreBackend):
    """S3 backend for production"""
    
    def __init__(self, bucket: str, prefix: str = "extractions/"):
        self.bucket = bucket
        self.prefix = prefix
        self._client = None
    
    @property
    def client(self):
        if self._client is None:
            import boto3
            self._client = boto3.client('s3')
        return self._client
    
    def _key_to_s3_key(self, key: str) -> str:
        return f"{self.prefix}{key}.json"
    
    async def save(self, key: str, data: Dict, metadata: Dict) -> str:
        s3_key = self._key_to_s3_key(key)
        
        stored = {
            "key": key,
            "data": data,
            "metadata": metadata,
            "stored_at": datetime.now().isoformat()
        }
        
        # Run in thread pool since boto3 is sync
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self.client.put_object(
                Bucket=self.bucket,
                Key=s3_key,
                Body=json.dumps(stored, default=str),
                ContentType='application/json'
            )
        )
        
        return f"s3://{self.bucket}/{s3_key}"
    
    async def load(self, key: str) -> Optional[Dict]:
        s3_key = self._key_to_s3_key(key)
        
        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.client.get_object(Bucket=self.bucket, Key=s3_key)
            )
            
            content = response['Body'].read().decode('utf-8')
            stored = json.loads(content)
            return stored.get("data")
        
        except self.client.exceptions.NoSuchKey:
            return None
    
    async def delete(self, key: str) -> bool:
        s3_key = self._key_to_s3_key(key)
        
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: self.client.delete_object(Bucket=self.bucket, Key=s3_key)
            )
            return True
        except:
            return False
    
    async def list_keys(self, prefix: str) -> List[str]:
        s3_prefix = self._key_to_s3_key(prefix)
        
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self.client.list_objects_v2(
                Bucket=self.bucket,
                Prefix=s3_prefix
            )
        )
        
        keys = []
        for obj in response.get('Contents', []):
            # Remove prefix and .json suffix
            key = obj['Key'][len(self.prefix):-5]
            keys.append(key)
        
        return keys


class InMemoryCache:
    """Simple in-memory cache with TTL"""
    
    def __init__(self, default_ttl: int = 300):  # 5 minutes default
        self._cache: Dict[str, tuple] = {}  # key -> (value, expires_at)
        self.default_ttl = default_ttl
    
    def get(self, key: str) -> Optional[Any]:
        if key in self._cache:
            value, expires_at = self._cache[key]
            if datetime.now() < expires_at:
                return value
            else:
                del self._cache[key]
        return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        ttl = ttl or self.default_ttl
        expires_at = datetime.now() + timedelta(seconds=ttl)
        self._cache[key] = (value, expires_at)
    
    def delete(self, key: str):
        if key in self._cache:
            del self._cache[key]
    
    def clear(self):
        self._cache.clear()


class EugeneDataStore:
    """
    Main data store for Eugene Intelligence.
    
    Provides unified access to:
    - Credit/debt extractions
    - Earnings call extractions
    - SEC filing metadata
    - Company information
    """
    
    def __init__(
        self,
        backend: Optional[DataStoreBackend] = None,
        cache_ttl: int = 300
    ):
        self.backend = backend or LocalFileBackend()
        self.cache = InMemoryCache(default_ttl=cache_ttl)
    
    # ============================================
    # Credit Data
    # ============================================
    
    async def save_credit_extraction(
        self,
        ticker: str,
        data: Dict,
        filing_date: str,
        quality_score: float,
        source_filing: Optional[str] = None
    ) -> StoredExtraction:
        """Save a credit/debt extraction"""
        
        # Generate unique ID
        extraction_id = self._generate_id(ticker, "debt", filing_date)
        
        # Build key
        key = f"credit/{ticker}/{filing_date}"
        
        metadata = {
            "id": extraction_id,
            "ticker": ticker,
            "extraction_type": "debt",
            "source_filing": source_filing,
            "filing_date": filing_date,
            "quality_score": quality_score,
            "version": 1
        }
        
        # Check for existing version
        existing = await self.backend.load(key)
        if existing:
            metadata["version"] = existing.get("_metadata", {}).get("version", 0) + 1
        
        # Add metadata to data
        data["_metadata"] = metadata
        
        # Save
        storage_path = await self.backend.save(key, data, metadata)
        
        # Invalidate cache
        self.cache.delete(f"credit:{ticker}")
        self.cache.delete(f"credit:{ticker}:{filing_date}")
        
        return StoredExtraction(
            id=extraction_id,
            ticker=ticker,
            extraction_type="debt",
            source_filing=source_filing,
            filing_date=filing_date,
            extracted_at=datetime.now(),
            version=metadata["version"],
            quality_score=quality_score,
            storage_path=storage_path
        )
    
    async def get_credit_data(
        self,
        ticker: str,
        filing_date: Optional[str] = None
    ) -> Optional[Dict]:
        """Get credit data for a ticker"""
        
        # Check cache
        cache_key = f"credit:{ticker}:{filing_date}" if filing_date else f"credit:{ticker}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached
        
        if filing_date:
            key = f"credit/{ticker}/{filing_date}"
            data = await self.backend.load(key)
        else:
            # Get most recent
            keys = await self.backend.list_keys(f"credit/{ticker}/")
            if not keys:
                return None
            
            # Sort by date descending
            keys.sort(reverse=True)
            data = await self.backend.load(keys[0])
        
        if data:
            self.cache.set(cache_key, data)
        
        return data
    
    async def list_credit_history(self, ticker: str) -> List[Dict]:
        """List all credit extractions for a ticker"""
        keys = await self.backend.list_keys(f"credit/{ticker}/")
        
        results = []
        for key in sorted(keys, reverse=True):
            data = await self.backend.load(key)
            if data:
                results.append({
                    "filing_date": key.split("/")[-1],
                    "quality_score": data.get("_metadata", {}).get("quality_score"),
                    "version": data.get("_metadata", {}).get("version")
                })
        
        return results
    
    # ============================================
    # Earnings Data
    # ============================================
    
    async def save_earnings_extraction(
        self,
        ticker: str,
        data: Dict,
        call_date: str,
        fiscal_quarter: int,
        fiscal_year: int,
        quality_score: float
    ) -> StoredExtraction:
        """Save an earnings call extraction"""
        
        extraction_id = self._generate_id(ticker, "earnings", call_date)
        
        key = f"earnings/{ticker}/{fiscal_year}Q{fiscal_quarter}"
        
        metadata = {
            "id": extraction_id,
            "ticker": ticker,
            "extraction_type": "earnings",
            "call_date": call_date,
            "fiscal_quarter": fiscal_quarter,
            "fiscal_year": fiscal_year,
            "quality_score": quality_score,
            "version": 1
        }
        
        data["_metadata"] = metadata
        
        storage_path = await self.backend.save(key, data, metadata)
        
        # Invalidate cache
        self.cache.delete(f"earnings:{ticker}")
        
        return StoredExtraction(
            id=extraction_id,
            ticker=ticker,
            extraction_type="earnings",
            source_filing=None,
            filing_date=call_date,
            extracted_at=datetime.now(),
            version=1,
            quality_score=quality_score,
            storage_path=storage_path
        )
    
    async def get_earnings_data(
        self,
        ticker: str,
        fiscal_year: Optional[int] = None,
        fiscal_quarter: Optional[int] = None
    ) -> Optional[Dict]:
        """Get earnings data for a ticker"""
        
        if fiscal_year and fiscal_quarter:
            key = f"earnings/{ticker}/{fiscal_year}Q{fiscal_quarter}"
            return await self.backend.load(key)
        
        # Get most recent
        keys = await self.backend.list_keys(f"earnings/{ticker}/")
        if not keys:
            return None
        
        keys.sort(reverse=True)
        return await self.backend.load(keys[0])
    
    # ============================================
    # Company Info
    # ============================================
    
    async def save_company_info(self, ticker: str, info: Dict):
        """Save company information"""
        key = f"companies/{ticker}"
        await self.backend.save(key, info, {"ticker": ticker})
        self.cache.delete(f"company:{ticker}")
    
    async def get_company_info(self, ticker: str) -> Optional[Dict]:
        """Get company information"""
        cache_key = f"company:{ticker}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached
        
        key = f"companies/{ticker}"
        data = await self.backend.load(key)
        
        if data:
            self.cache.set(cache_key, data, ttl=3600)  # 1 hour TTL
        
        return data
    
    # ============================================
    # Utilities
    # ============================================
    
    def _generate_id(self, ticker: str, extraction_type: str, date: str) -> str:
        """Generate a unique extraction ID"""
        raw = f"{ticker}:{extraction_type}:{date}:{datetime.now().isoformat()}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]
    
    async def get_coverage_stats(self) -> Dict:
        """Get statistics about data coverage"""
        credit_keys = await self.backend.list_keys("credit/")
        earnings_keys = await self.backend.list_keys("earnings/")
        
        # Count unique tickers
        credit_tickers = set()
        for key in credit_keys:
            parts = key.split("/")
            if len(parts) >= 2:
                credit_tickers.add(parts[1])
        
        earnings_tickers = set()
        for key in earnings_keys:
            parts = key.split("/")
            if len(parts) >= 2:
                earnings_tickers.add(parts[1])
        
        return {
            "credit_extractions": len(credit_keys),
            "credit_tickers": len(credit_tickers),
            "earnings_extractions": len(earnings_keys),
            "earnings_tickers": len(earnings_tickers),
            "total_tickers": len(credit_tickers | earnings_tickers)
        }


# ============================================
# Global instance
# ============================================

_store: Optional[EugeneDataStore] = None


def get_data_store() -> EugeneDataStore:
    """Get the global data store instance"""
    global _store
    
    if _store is None:
        # Check for S3 configuration
        s3_bucket = os.environ.get("EUGENE_S3_BUCKET")
        
        if s3_bucket:
            backend = S3Backend(bucket=s3_bucket)
        else:
            backend = LocalFileBackend()
        
        _store = EugeneDataStore(backend=backend)
    
    return _store


# ============================================
# Testing
# ============================================

async def test_data_store():
    """Test the data store"""
    store = EugeneDataStore()
    
    print("Testing data store...")
    
    # Test credit data
    sample_credit = {
        "total_debt": 3500,
        "net_debt": 2800,
        "leverage_ratio": 3.5,
        "debt_instruments": [
            {"name": "Term Loan", "amount": 2000},
            {"name": "Notes", "amount": 1500}
        ]
    }
    
    result = await store.save_credit_extraction(
        ticker="TEST",
        data=sample_credit,
        filing_date="2024-12-31",
        quality_score=0.92
    )
    
    print(f"Saved credit extraction: {result.id}")
    
    # Retrieve it
    loaded = await store.get_credit_data("TEST")
    print(f"Loaded: {loaded.get('total_debt')} total debt")
    
    # Test earnings data
    sample_earnings = {
        "guidance": [
            {"metric": "revenue", "low": 90, "high": 94}
        ],
        "tone": {"overall": "confident"}
    }
    
    result = await store.save_earnings_extraction(
        ticker="TEST",
        data=sample_earnings,
        call_date="2024-02-01",
        fiscal_quarter=1,
        fiscal_year=2024,
        quality_score=0.88
    )
    
    print(f"Saved earnings extraction: {result.id}")
    
    # Get coverage stats
    stats = await store.get_coverage_stats()
    print(f"Coverage: {stats}")
    
    print("\n✓ Data store tests passed")


if __name__ == "__main__":
    asyncio.run(test_data_store())
