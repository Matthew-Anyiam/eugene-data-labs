"""
Eugene Intelligence - Safe Extraction Wrapper

Wraps extraction functions with comprehensive error handling.
Ensures that:
- Failures are captured, not thrown
- Partial results are saved
- Errors are logged with context
- Resources are cleaned up
"""

import sys
import traceback
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Any, Optional, List, Callable, TypeVar, Generic
from enum import Enum
import logging
import functools
import asyncio

logger = logging.getLogger(__name__)


class ErrorCategory(Enum):
    """Categories of errors for handling"""
    NETWORK = "network"           # Connection, timeout
    API = "api"                   # Claude API errors
    PARSING = "parsing"           # HTML/text parsing errors
    VALIDATION = "validation"     # Data validation errors
    RESOURCE = "resource"         # Memory, disk, etc.
    UNKNOWN = "unknown"


@dataclass
class ExtractionError:
    """Structured error information"""
    category: ErrorCategory
    message: str
    ticker: Optional[str] = None
    stage: Optional[str] = None  # "fetch", "parse", "extract", "validate"
    timestamp: datetime = field(default_factory=datetime.now)
    traceback: Optional[str] = None
    recoverable: bool = True
    context: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "category": self.category.value,
            "message": self.message,
            "ticker": self.ticker,
            "stage": self.stage,
            "timestamp": self.timestamp.isoformat(),
            "traceback": self.traceback,
            "recoverable": self.recoverable,
            "context": self.context
        }


T = TypeVar('T')


@dataclass
class SafeResult(Generic[T]):
    """Result wrapper that captures success or failure"""
    success: bool
    data: Optional[T] = None
    error: Optional[ExtractionError] = None
    partial_data: Optional[Dict] = None  # Partial results if available
    warnings: List[str] = field(default_factory=list)
    
    @classmethod
    def ok(cls, data: T, warnings: List[str] = None) -> "SafeResult[T]":
        return cls(success=True, data=data, warnings=warnings or [])
    
    @classmethod
    def fail(cls, error: ExtractionError, partial_data: Dict = None) -> "SafeResult[T]":
        return cls(success=False, error=error, partial_data=partial_data)
    
    def to_dict(self) -> Dict:
        return {
            "success": self.success,
            "data": self.data if self.success else None,
            "error": self.error.to_dict() if self.error else None,
            "partial_data": self.partial_data,
            "warnings": self.warnings
        }


def categorize_error(error: Exception) -> ErrorCategory:
    """Determine error category from exception type"""
    error_str = str(error).lower()
    error_type = type(error).__name__.lower()
    
    # Network errors
    network_indicators = [
        "connection", "timeout", "refused", "reset",
        "network", "socket", "dns", "ssl", "certificate"
    ]
    for indicator in network_indicators:
        if indicator in error_str or indicator in error_type:
            return ErrorCategory.NETWORK
    
    # API errors
    api_indicators = [
        "api", "rate limit", "quota", "unauthorized",
        "forbidden", "authentication", "anthropic", "openai"
    ]
    for indicator in api_indicators:
        if indicator in error_str or indicator in error_type:
            return ErrorCategory.API
    
    # Parsing errors
    parsing_indicators = [
        "parse", "json", "xml", "html", "decode",
        "syntax", "invalid", "malformed"
    ]
    for indicator in parsing_indicators:
        if indicator in error_str or indicator in error_type:
            return ErrorCategory.PARSING
    
    # Validation errors
    validation_indicators = [
        "validation", "invalid", "schema", "constraint",
        "type error", "value error"
    ]
    for indicator in validation_indicators:
        if indicator in error_str or indicator in error_type:
            return ErrorCategory.VALIDATION
    
    # Resource errors
    resource_indicators = [
        "memory", "disk", "space", "resource", "limit",
        "too large", "overflow"
    ]
    for indicator in resource_indicators:
        if indicator in error_str or indicator in error_type:
            return ErrorCategory.RESOURCE
    
    return ErrorCategory.UNKNOWN


def is_recoverable(error: Exception, category: ErrorCategory) -> bool:
    """Determine if error is recoverable (worth retrying)"""
    error_str = str(error).lower()
    
    # Never recoverable
    non_recoverable = [
        "invalid api key",
        "authentication failed",
        "unauthorized",
        "forbidden",
        "not found",
        "does not exist"
    ]
    
    for msg in non_recoverable:
        if msg in error_str:
            return False
    
    # Category-based
    if category == ErrorCategory.NETWORK:
        return True  # Usually transient
    if category == ErrorCategory.API:
        # Rate limits are recoverable, auth errors are not
        return "rate" in error_str or "limit" in error_str
    if category == ErrorCategory.PARSING:
        return False  # Bad data won't fix itself
    if category == ErrorCategory.RESOURCE:
        return False  # Need intervention
    
    return True  # Default to optimistic


def safe_extract(stage: str = "extract"):
    """
    Decorator for safe extraction with error handling.
    
    Usage:
        @safe_extract(stage="fetch")
        def fetch_filing(ticker: str) -> str:
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> SafeResult:
            ticker = kwargs.get('ticker') or (args[0] if args else None)
            
            try:
                result = func(*args, **kwargs)
                return SafeResult.ok(result)
                
            except Exception as e:
                category = categorize_error(e)
                recoverable = is_recoverable(e, category)
                
                error = ExtractionError(
                    category=category,
                    message=str(e),
                    ticker=ticker if isinstance(ticker, str) else None,
                    stage=stage,
                    traceback=traceback.format_exc(),
                    recoverable=recoverable,
                    context={
                        "args": [str(a)[:100] for a in args],
                        "kwargs": {k: str(v)[:100] for k, v in kwargs.items()}
                    }
                )
                
                logger.error(f"[{stage}] {category.value}: {e}")
                
                return SafeResult.fail(error)
        
        return wrapper
    return decorator


def safe_extract_async(stage: str = "extract"):
    """Async version of safe_extract decorator"""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs) -> SafeResult:
            ticker = kwargs.get('ticker') or (args[0] if args else None)
            
            try:
                result = await func(*args, **kwargs)
                return SafeResult.ok(result)
                
            except Exception as e:
                category = categorize_error(e)
                recoverable = is_recoverable(e, category)
                
                error = ExtractionError(
                    category=category,
                    message=str(e),
                    ticker=ticker if isinstance(ticker, str) else None,
                    stage=stage,
                    traceback=traceback.format_exc(),
                    recoverable=recoverable
                )
                
                logger.error(f"[{stage}] {category.value}: {e}")
                
                return SafeResult.fail(error)
        
        return wrapper
    return decorator


class SafeExtractor:
    """
    Safe extraction pipeline with stage-by-stage error handling.
    
    Captures partial results even on failure.
    """
    
    def __init__(self, ticker: str, filing_type: str = "10-K"):
        self.ticker = ticker
        self.filing_type = filing_type
        self.stages_completed: List[str] = []
        self.partial_results: Dict[str, Any] = {}
        self.errors: List[ExtractionError] = []
        self.warnings: List[str] = []
    
    def run(self) -> SafeResult[Dict]:
        """Run full extraction pipeline with error handling"""
        
        # Stage 1: Fetch filing
        filing_result = self._fetch_filing()
        if not filing_result.success:
            return SafeResult.fail(filing_result.error, self.partial_results)
        
        self.stages_completed.append("fetch")
        self.partial_results["filing_metadata"] = {
            "ticker": self.ticker,
            "filing_type": self.filing_type
        }
        
        # Stage 2: Parse filing
        parse_result = self._parse_filing(filing_result.data)
        if not parse_result.success:
            return SafeResult.fail(parse_result.error, self.partial_results)
        
        self.stages_completed.append("parse")
        self.partial_results["parsed_sections"] = list(parse_result.data.keys())
        
        # Stage 3: Extract data
        extract_result = self._extract_data(parse_result.data)
        if not extract_result.success:
            return SafeResult.fail(extract_result.error, self.partial_results)
        
        self.stages_completed.append("extract")
        self.partial_results["extraction"] = extract_result.data
        
        # Stage 4: Validate
        validate_result = self._validate_data(extract_result.data)
        if not validate_result.success:
            # Validation failure is soft - we still have data
            self.warnings.append(f"Validation issues: {validate_result.error.message}")
            self.partial_results["validation"] = validate_result.error.to_dict()
        else:
            self.stages_completed.append("validate")
            self.partial_results["quality"] = validate_result.data
        
        # Return full result
        return SafeResult.ok(
            data=self.partial_results,
            warnings=self.warnings
        )
    
    @safe_extract(stage="fetch")
    def _fetch_filing(self) -> Dict:
        """Fetch filing from SEC EDGAR"""
        from extraction.edgar import SECEdgarClient, extract_debt_section
        
        client = SECEdgarClient()
        filings = client.get_company_filings(self.ticker, self.filing_type, limit=1)
        
        if not filings:
            raise ValueError(f"No {self.filing_type} found for {self.ticker}")
        
        filing = filings[0]
        filing_text = client.get_filing_document(self.ticker, self.filing_type)
        
        if not filing_text:
            raise ValueError(f"Could not download filing for {self.ticker}")
        
        return {
            "metadata": filing,
            "text": filing_text,
            "filing_date": filing.get('filedAt', '').split('T')[0]
        }
    
    @safe_extract(stage="parse")
    def _parse_filing(self, filing_data: Dict) -> Dict:
        """Parse filing into sections"""
        from extraction.edgar import extract_debt_section
        
        text = filing_data["text"]
        
        # Extract debt section
        debt_section = extract_debt_section(text)
        
        if not debt_section or len(debt_section) < 500:
            self.warnings.append("Debt section is short, using broader text")
            debt_section = text[:50000]
        
        return {
            "debt_section": debt_section,
            "full_text_length": len(text),
            "section_length": len(debt_section)
        }
    
    @safe_extract(stage="extract")
    def _extract_data(self, parsed_data: Dict) -> Dict:
        """Run Claude extraction"""
        from extraction.parsers.debt import extract_debt_from_text, result_to_dict
        
        result = extract_debt_from_text(
            filing_text=parsed_data["debt_section"],
            company_ticker=self.ticker,
            filing_date=self.partial_results.get("filing_metadata", {}).get("filing_date", "")
        )
        
        return result_to_dict(result)
    
    @safe_extract(stage="validate")
    def _validate_data(self, extraction_data: Dict) -> Dict:
        """Validate extracted data"""
        from extraction.validation import validate_extraction
        
        quality = validate_extraction(extraction_data)
        
        if not quality.should_serve:
            raise ValueError(
                f"Quality below threshold: {quality.overall_confidence:.1%}. "
                f"Errors: {quality.validation_errors}"
            )
        
        return quality.to_dict()


def run_safe_extraction(ticker: str, filing_type: str = "10-K") -> SafeResult[Dict]:
    """
    Run extraction with full error handling.
    
    This is the main entry point for safe extraction.
    
    Usage:
        result = run_safe_extraction("TSLA")
        if result.success:
            print(result.data)
        else:
            print(f"Failed: {result.error.message}")
            if result.partial_data:
                print(f"Partial data: {result.partial_data}")
    """
    extractor = SafeExtractor(ticker, filing_type)
    return extractor.run()


# ============================================
# Testing
# ============================================

if __name__ == "__main__":
    import os
    
    # Check API key
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("Set ANTHROPIC_API_KEY to test")
        sys.exit(1)
    
    print("Testing safe extraction...")
    
    result = run_safe_extraction("TSLA")
    
    print("\n" + "=" * 60)
    print("RESULT")
    print("=" * 60)
    
    if result.success:
        print("✓ Extraction succeeded")
        print(f"Stages completed: {result.data.get('stages_completed', [])}")
        
        if result.warnings:
            print(f"Warnings: {result.warnings}")
    else:
        print("✗ Extraction failed")
        print(f"Stage: {result.error.stage}")
        print(f"Category: {result.error.category.value}")
        print(f"Message: {result.error.message}")
        print(f"Recoverable: {result.error.recoverable}")
        
        if result.partial_data:
            print(f"\nPartial data available:")
            for key in result.partial_data:
                print(f"  - {key}")
