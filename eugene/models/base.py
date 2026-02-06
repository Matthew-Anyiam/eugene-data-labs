"""
Eugene Intelligence - Data Models

Core data models for all extractions.
Uses dataclasses with validation.

Conventions:
- All monetary amounts in millions USD unless specified
- All dates in ISO format (YYYY-MM-DD)
- All percentages as decimals (0.05 = 5%)
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Union
from datetime import date, datetime
from decimal import Decimal
from enum import Enum


# ==============================================================================
# Enums
# ==============================================================================

class DebtType(Enum):
    """Types of debt instruments"""
    SENIOR_NOTES = "senior_notes"
    SUBORDINATED_NOTES = "subordinated_notes"
    CONVERTIBLE_NOTES = "convertible_notes"
    TERM_LOAN = "term_loan"
    REVOLVING_CREDIT = "revolving_credit"
    COMMERCIAL_PAPER = "commercial_paper"
    CAPITAL_LEASE = "capital_lease"
    OPERATING_LEASE = "operating_lease"
    OTHER = "other"


class RateType(Enum):
    """Interest rate types"""
    FIXED = "fixed"
    FLOATING = "floating"
    ZERO_COUPON = "zero_coupon"


class CovenantType(Enum):
    """Types of debt covenants"""
    LEVERAGE = "leverage"  # Debt/EBITDA
    INTEREST_COVERAGE = "interest_coverage"  # EBITDA/Interest
    FIXED_CHARGE = "fixed_charge"  # EBITDA/Fixed Charges
    DEBT_TO_EQUITY = "debt_to_equity"
    CURRENT_RATIO = "current_ratio"
    MINIMUM_LIQUIDITY = "minimum_liquidity"
    MINIMUM_NET_WORTH = "minimum_net_worth"
    CAPEX_LIMIT = "capex_limit"
    DIVIDEND_RESTRICTION = "dividend_restriction"
    OTHER = "other"


class InsiderTransactionType(Enum):
    """Types of insider transactions"""
    PURCHASE = "purchase"
    SALE = "sale"
    GRANT = "grant"
    EXERCISE = "exercise"
    CONVERSION = "conversion"
    GIFT = "gift"
    OTHER = "other"


class Severity(Enum):
    """Alert severity levels"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class Confidence(Enum):
    """Confidence levels for extractions"""
    HIGH = "high"      # > 0.85
    MEDIUM = "medium"  # 0.5 - 0.85
    LOW = "low"        # < 0.5


# ==============================================================================
# Base Models
# ==============================================================================

@dataclass
class ExtractionMetadata:
    """Metadata for any extraction"""
    source_filing: str  # Accession number
    source_url: Optional[str] = None
    filing_date: Optional[str] = None
    extracted_at: str = field(default_factory=lambda: datetime.now().isoformat())
    confidence_score: float = 0.0
    extraction_notes: List[str] = field(default_factory=list)
    validation_errors: List[str] = field(default_factory=list)
    validation_warnings: List[str] = field(default_factory=list)
    
    @property
    def confidence_level(self) -> Confidence:
        if self.confidence_score >= 0.85:
            return Confidence.HIGH
        elif self.confidence_score >= 0.5:
            return Confidence.MEDIUM
        else:
            return Confidence.LOW
    
    @property
    def is_valid(self) -> bool:
        return len(self.validation_errors) == 0
    
    def to_dict(self) -> dict:
        return {
            "source_filing": self.source_filing,
            "source_url": self.source_url,
            "filing_date": self.filing_date,
            "extracted_at": self.extracted_at,
            "confidence_score": self.confidence_score,
            "confidence_level": self.confidence_level.value,
            "is_valid": self.is_valid,
            "extraction_notes": self.extraction_notes,
            "validation_errors": self.validation_errors,
            "validation_warnings": self.validation_warnings
        }


# ==============================================================================
# Company Models
# ==============================================================================

@dataclass
class Company:
    """Company information"""
    ticker: str
    name: str
    cik: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    sic_code: Optional[str] = None
    state_of_incorporation: Optional[str] = None
    fiscal_year_end: Optional[str] = None  # Month name
    
    def __post_init__(self):
        self.ticker = self.ticker.upper()
    
    def to_dict(self) -> dict:
        return {
            "ticker": self.ticker,
            "name": self.name,
            "cik": self.cik,
            "sector": self.sector,
            "industry": self.industry,
            "sic_code": self.sic_code,
            "state_of_incorporation": self.state_of_incorporation,
            "fiscal_year_end": self.fiscal_year_end
        }


# ==============================================================================
# Debt Models
# ==============================================================================

@dataclass
class DebtInstrument:
    """Single debt instrument"""
    name: str
    instrument_type: str  # Use DebtType.value
    principal: float  # Millions USD
    
    # Interest rate
    rate_type: Optional[str] = None  # Use RateType.value
    interest_rate: Optional[float] = None  # Fixed rate as decimal (0.05 = 5%)
    spread_bps: Optional[int] = None  # Spread in basis points
    benchmark: Optional[str] = None  # SOFR, LIBOR, etc.
    
    # Terms
    currency: str = "USD"
    maturity_date: Optional[str] = None  # YYYY-MM-DD
    issue_date: Optional[str] = None  # YYYY-MM-DD
    
    # Security
    is_secured: Optional[bool] = None
    seniority: Optional[str] = None  # senior, subordinated
    collateral: Optional[str] = None
    
    # Extraction metadata
    source_text: Optional[str] = None
    confidence: float = 0.0
    
    def __post_init__(self):
        # Validation
        if self.principal < 0:
            raise ValueError(f"Principal cannot be negative: {self.principal}")
        if self.confidence < 0 or self.confidence > 1:
            raise ValueError(f"Confidence must be 0-1: {self.confidence}")
        if self.interest_rate is not None and self.interest_rate < 0:
            raise ValueError(f"Interest rate cannot be negative: {self.interest_rate}")
    
    @property
    def interest_rate_display(self) -> str:
        """Human-readable interest rate"""
        if self.rate_type == RateType.FLOATING.value:
            if self.benchmark and self.spread_bps:
                return f"{self.benchmark} + {self.spread_bps}bps"
            elif self.spread_bps:
                return f"+{self.spread_bps}bps"
            else:
                return "Floating"
        elif self.interest_rate is not None:
            return f"{self.interest_rate * 100:.2f}%"
        else:
            return "N/A"
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "instrument_type": self.instrument_type,
            "principal": self.principal,
            "currency": self.currency,
            "rate_type": self.rate_type,
            "interest_rate": self.interest_rate,
            "interest_rate_display": self.interest_rate_display,
            "spread_bps": self.spread_bps,
            "benchmark": self.benchmark,
            "maturity_date": self.maturity_date,
            "issue_date": self.issue_date,
            "is_secured": self.is_secured,
            "seniority": self.seniority,
            "collateral": self.collateral,
            "confidence": self.confidence
        }


@dataclass
class DebtMaturity:
    """Debt maturity schedule entry"""
    year: int
    amount: float  # Millions USD
    
    def to_dict(self) -> dict:
        return {"year": self.year, "amount": self.amount}


@dataclass
class Covenant:
    """Debt covenant"""
    name: str
    covenant_type: str  # Use CovenantType.value
    threshold: float  # The limit
    current_value: Optional[float] = None
    
    # Threshold interpretation
    is_maximum: bool = True  # True if must stay below threshold
    
    # Extraction
    source_text: Optional[str] = None
    confidence: float = 0.0
    
    @property
    def cushion(self) -> Optional[float]:
        """Calculate covenant cushion as percentage"""
        if self.current_value is None:
            return None
        
        if self.is_maximum:
            # Must stay below threshold
            if self.threshold == 0:
                return None
            return (self.threshold - self.current_value) / self.threshold
        else:
            # Must stay above threshold
            if self.current_value == 0:
                return None
            return (self.current_value - self.threshold) / self.current_value
    
    @property
    def is_in_compliance(self) -> Optional[bool]:
        """Check if covenant is in compliance"""
        if self.current_value is None:
            return None
        
        if self.is_maximum:
            return self.current_value <= self.threshold
        else:
            return self.current_value >= self.threshold
    
    @property
    def cushion_display(self) -> str:
        """Human-readable cushion"""
        if self.cushion is None:
            return "N/A"
        return f"{self.cushion * 100:.1f}%"
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "covenant_type": self.covenant_type,
            "threshold": self.threshold,
            "current_value": self.current_value,
            "is_maximum": self.is_maximum,
            "cushion": self.cushion,
            "cushion_display": self.cushion_display,
            "is_in_compliance": self.is_in_compliance,
            "confidence": self.confidence
        }


@dataclass
class DebtExtraction:
    """Complete debt extraction result"""
    ticker: str
    company_name: str
    
    # Extracted data
    instruments: List[DebtInstrument] = field(default_factory=list)
    maturities: List[DebtMaturity] = field(default_factory=list)
    covenants: List[Covenant] = field(default_factory=list)
    
    # Summary metrics
    total_debt: Optional[float] = None  # Millions USD
    total_long_term_debt: Optional[float] = None
    total_short_term_debt: Optional[float] = None
    cash_and_equivalents: Optional[float] = None
    net_debt: Optional[float] = None
    
    # Metadata
    metadata: ExtractionMetadata = field(default_factory=lambda: ExtractionMetadata(source_filing=""))
    
    def __post_init__(self):
        # Calculate totals if not provided
        if self.total_debt is None and self.instruments:
            self.total_debt = sum(i.principal for i in self.instruments)
        
        if self.net_debt is None and self.total_debt is not None and self.cash_and_equivalents is not None:
            self.net_debt = self.total_debt - self.cash_and_equivalents
    
    @property
    def weighted_confidence(self) -> float:
        """Calculate weighted average confidence"""
        if not self.instruments:
            return 0.0
        
        total_principal = sum(i.principal for i in self.instruments)
        if total_principal == 0:
            return 0.0
        
        weighted_sum = sum(i.principal * i.confidence for i in self.instruments)
        return weighted_sum / total_principal
    
    def to_dict(self) -> dict:
        return {
            "ticker": self.ticker,
            "company_name": self.company_name,
            "summary": {
                "total_debt": self.total_debt,
                "total_long_term_debt": self.total_long_term_debt,
                "total_short_term_debt": self.total_short_term_debt,
                "cash_and_equivalents": self.cash_and_equivalents,
                "net_debt": self.net_debt
            },
            "instruments": [i.to_dict() for i in self.instruments],
            "maturities": [m.to_dict() for m in self.maturities],
            "covenants": [c.to_dict() for c in self.covenants],
            "metadata": self.metadata.to_dict()
        }


# ==============================================================================
# Insider Trading Models
# ==============================================================================

@dataclass
class InsiderTransaction:
    """Single insider transaction"""
    insider_name: str
    insider_title: Optional[str] = None
    transaction_type: str = ""  # Use InsiderTransactionType.value
    transaction_date: Optional[str] = None  # YYYY-MM-DD
    
    # Shares
    shares: Optional[int] = None
    price_per_share: Optional[float] = None
    total_value: Optional[float] = None  # Calculated or extracted
    
    # Post-transaction
    shares_owned_after: Optional[int] = None
    ownership_type: Optional[str] = None  # direct, indirect
    
    # Metadata
    source_filing: Optional[str] = None
    confidence: float = 0.0
    
    def __post_init__(self):
        # Calculate total value if not provided
        if self.total_value is None and self.shares and self.price_per_share:
            self.total_value = self.shares * self.price_per_share
    
    def to_dict(self) -> dict:
        return {
            "insider_name": self.insider_name,
            "insider_title": self.insider_title,
            "transaction_type": self.transaction_type,
            "transaction_date": self.transaction_date,
            "shares": self.shares,
            "price_per_share": self.price_per_share,
            "total_value": self.total_value,
            "shares_owned_after": self.shares_owned_after,
            "ownership_type": self.ownership_type,
            "confidence": self.confidence
        }


@dataclass
class InsiderExtraction:
    """Complete insider trading extraction"""
    ticker: str
    company_name: str
    
    transactions: List[InsiderTransaction] = field(default_factory=list)
    
    # Summary
    period_days: int = 90
    total_buys: int = 0
    total_sells: int = 0
    buy_value: float = 0
    sell_value: float = 0
    net_shares: int = 0
    net_value: float = 0
    
    metadata: ExtractionMetadata = field(default_factory=lambda: ExtractionMetadata(source_filing=""))
    
    @property
    def sentiment(self) -> str:
        """Calculate insider sentiment"""
        if self.net_value > 1000000:  # > $1M net buying
            return "bullish"
        elif self.net_value < -1000000:  # > $1M net selling
            return "bearish"
        else:
            return "neutral"
    
    def to_dict(self) -> dict:
        return {
            "ticker": self.ticker,
            "company_name": self.company_name,
            "summary": {
                "period_days": self.period_days,
                "total_buys": self.total_buys,
                "total_sells": self.total_sells,
                "buy_value": self.buy_value,
                "sell_value": self.sell_value,
                "net_shares": self.net_shares,
                "net_value": self.net_value,
                "sentiment": self.sentiment
            },
            "transactions": [t.to_dict() for t in self.transactions],
            "metadata": self.metadata.to_dict()
        }


# ==============================================================================
# Material Event Models (8-K)
# ==============================================================================

@dataclass
class MaterialEvent:
    """Material event from 8-K filing"""
    item_number: str  # e.g., "2.02", "5.02"
    item_description: str  # e.g., "Results of Operations"
    event_date: Optional[str] = None
    summary: Optional[str] = None
    
    # Event-specific data
    event_data: Dict[str, Any] = field(default_factory=dict)
    
    confidence: float = 0.0
    
    @property
    def severity(self) -> Severity:
        """Determine event severity based on item number"""
        critical_items = ["1.03", "2.04", "3.01", "4.01", "4.02"]  # Bankruptcy, default, delisting
        high_items = ["1.01", "2.01", "5.02"]  # M&A, asset sale, officer change
        medium_items = ["2.02", "5.01", "7.01"]  # Earnings, bylaw changes, reg FD
        
        if self.item_number in critical_items:
            return Severity.CRITICAL
        elif self.item_number in high_items:
            return Severity.HIGH
        elif self.item_number in medium_items:
            return Severity.MEDIUM
        else:
            return Severity.LOW
    
    def to_dict(self) -> dict:
        return {
            "item_number": self.item_number,
            "item_description": self.item_description,
            "event_date": self.event_date,
            "summary": self.summary,
            "severity": self.severity.value,
            "event_data": self.event_data,
            "confidence": self.confidence
        }


@dataclass
class Form8KExtraction:
    """Complete 8-K extraction"""
    ticker: str
    company_name: str
    filing_date: str
    
    events: List[MaterialEvent] = field(default_factory=list)
    
    metadata: ExtractionMetadata = field(default_factory=lambda: ExtractionMetadata(source_filing=""))
    
    def to_dict(self) -> dict:
        return {
            "ticker": self.ticker,
            "company_name": self.company_name,
            "filing_date": self.filing_date,
            "events": [e.to_dict() for e in self.events],
            "metadata": self.metadata.to_dict()
        }


# ==============================================================================
# Utility Functions
# ==============================================================================

def parse_amount(text: str) -> Optional[float]:
    """
    Parse monetary amount from text.
    
    Handles:
    - "$1.5 billion" -> 1500.0
    - "$500 million" -> 500.0
    - "1,234.56" -> 1.23456 (assumes millions if no unit)
    """
    if not text:
        return None
    
    text = text.lower().strip()
    
    # Remove currency symbols
    text = text.replace("$", "").replace("€", "").replace("£", "")
    
    # Find numeric value
    import re
    match = re.search(r"[\d,]+\.?\d*", text)
    if not match:
        return None
    
    value = float(match.group().replace(",", ""))
    
    # Apply multiplier
    if "trillion" in text:
        value *= 1_000_000  # Return in millions
    elif "billion" in text:
        value *= 1_000
    elif "million" in text:
        pass  # Already in millions
    elif "thousand" in text:
        value /= 1_000
    
    return value


def parse_date(text: str) -> Optional[str]:
    """
    Parse date from text and return ISO format.
    
    Handles:
    - "December 31, 2024" -> "2024-12-31"
    - "12/31/2024" -> "2024-12-31"
    - "2024-12-31" -> "2024-12-31"
    """
    if not text:
        return None
    
    from datetime import datetime
    
    formats = [
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%B %d, %Y",
        "%b %d, %Y",
        "%d %B %Y",
        "%d %b %Y",
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(text.strip(), fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    
    return None


if __name__ == "__main__":
    # Test models
    print("Testing data models...\n")
    
    # Test DebtInstrument
    debt = DebtInstrument(
        name="5.25% Senior Notes due 2028",
        instrument_type=DebtType.SENIOR_NOTES.value,
        principal=1500.0,
        rate_type=RateType.FIXED.value,
        interest_rate=0.0525,
        maturity_date="2028-06-15",
        is_secured=False,
        seniority="senior",
        confidence=0.92
    )
    print(f"Debt Instrument: {debt.name}")
    print(f"  Principal: ${debt.principal}M")
    print(f"  Rate: {debt.interest_rate_display}")
    print(f"  Confidence: {debt.confidence}")
    
    # Test Covenant
    covenant = Covenant(
        name="Maximum Leverage Ratio",
        covenant_type=CovenantType.LEVERAGE.value,
        threshold=4.5,
        current_value=3.2,
        is_maximum=True,
        confidence=0.88
    )
    print(f"\nCovenant: {covenant.name}")
    print(f"  Threshold: {covenant.threshold}x")
    print(f"  Current: {covenant.current_value}x")
    print(f"  Cushion: {covenant.cushion_display}")
    print(f"  Compliant: {covenant.is_in_compliance}")
    
    # Test amount parsing
    print("\nAmount parsing:")
    print(f"  '$1.5 billion' -> {parse_amount('$1.5 billion')}M")
    print(f"  '$500 million' -> {parse_amount('$500 million')}M")
    print(f"  '1,234.56' -> {parse_amount('1,234.56')}M")
    
    # Test date parsing
    print("\nDate parsing:")
    print(f"  'December 31, 2024' -> {parse_date('December 31, 2024')}")
    print(f"  '12/31/2024' -> {parse_date('12/31/2024')}")
    
    print("\n✅ All model tests passed!")
