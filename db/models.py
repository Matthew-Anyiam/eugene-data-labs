"""
Eugene Intelligence - Database Models
"""

from datetime import datetime, date
from typing import Optional
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Date, DateTime, 
    Text, ForeignKey, Enum, JSON, UniqueConstraint
)
from sqlalchemy.orm import relationship, declarative_base
import enum

Base = declarative_base()


# ============================================
# ENUMS
# ============================================

class InstrumentType(enum.Enum):
    TERM_LOAN = "term_loan"
    REVOLVER = "revolver"
    SENIOR_NOTE = "senior_note"
    SUBORDINATED_NOTE = "subordinated_note"
    BOND = "bond"
    CONVERTIBLE = "convertible"
    OTHER = "other"


class Seniority(enum.Enum):
    SENIOR_SECURED = "senior_secured"
    SENIOR_UNSECURED = "senior_unsecured"
    SUBORDINATED = "subordinated"
    JUNIOR = "junior"


class RateType(enum.Enum):
    FIXED = "fixed"
    FLOATING = "floating"


class CovenantType(enum.Enum):
    LEVERAGE = "leverage"                    # Debt/EBITDA
    INTEREST_COVERAGE = "interest_coverage"  # EBITDA/Interest
    FIXED_CHARGE = "fixed_charge"            # (EBITDA-CapEx)/Fixed Charges
    LIQUIDITY = "liquidity"                  # Minimum cash/liquidity
    NET_WORTH = "net_worth"                  # Minimum net worth
    ASSET_COVERAGE = "asset_coverage"        # Assets/Debt
    CAPEX_LIMIT = "capex_limit"              # Maximum CapEx
    OTHER = "other"


class AlertSeverity(enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AlertType(enum.Enum):
    COVENANT_CUSHION = "covenant_cushion"
    COVENANT_BREACH = "covenant_breach"
    MATURITY_APPROACHING = "maturity_approaching"
    LEVERAGE_SPIKE = "leverage_spike"
    NEW_DEBT = "new_debt"
    REFINANCING = "refinancing"
    COVERAGE_DETERIORATION = "coverage_deterioration"


# ============================================
# CORE TABLES
# ============================================

class Company(Base):
    """Core company information"""
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True)
    ticker = Column(String(10), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    cik = Column(String(10), unique=True, nullable=False, index=True)
    sector = Column(String(100))
    industry = Column(String(100))
    market_cap = Column(Float)  # in millions
    
    # Relationships
    debt_instruments = relationship("DebtInstrument", back_populates="company")
    covenants = relationship("Covenant", back_populates="company")
    credit_snapshots = relationship("CreditSnapshot", back_populates="company")
    filings = relationship("Filing", back_populates="company")
    alerts = relationship("Alert", back_populates="company")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Company(ticker='{self.ticker}', name='{self.name}')>"


class Filing(Base):
    """SEC filing metadata"""
    __tablename__ = "filings"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    
    filing_type = Column(String(20), nullable=False)  # 10-K, 10-Q, 8-K
    filing_date = Column(Date, nullable=False)
    period_end_date = Column(Date)
    accession_number = Column(String(25), unique=True, nullable=False)
    filing_url = Column(Text)
    
    # Extraction status
    extracted = Column(Boolean, default=False)
    extracted_at = Column(DateTime)
    extraction_error = Column(Text)
    
    # Relationships
    company = relationship("Company", back_populates="filings")
    
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('company_id', 'accession_number', name='uq_company_filing'),
    )


# ============================================
# DEBT & CREDIT TABLES
# ============================================

class DebtInstrument(Base):
    """Individual debt instruments"""
    __tablename__ = "debt_instruments"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    filing_id = Column(Integer, ForeignKey("filings.id"))
    
    # Instrument details
    instrument_name = Column(String(255), nullable=False)
    instrument_type = Column(Enum(InstrumentType))
    seniority = Column(Enum(Seniority))
    
    # Amounts
    principal_amount = Column(Float)  # in millions
    outstanding_amount = Column(Float)  # in millions
    available_amount = Column(Float)  # for revolvers, in millions
    currency = Column(String(3), default="USD")
    
    # Interest
    rate_type = Column(Enum(RateType))
    interest_rate = Column(Float)  # fixed rate as decimal (0.055 = 5.5%)
    spread_bps = Column(Integer)   # spread in basis points for floating
    reference_rate = Column(String(20))  # SOFR, LIBOR, etc.
    
    # Dates
    issue_date = Column(Date)
    maturity_date = Column(Date)
    
    # Additional terms
    callable = Column(Boolean)
    call_date = Column(Date)
    guarantors = Column(Text)  # JSON or comma-separated
    collateral = Column(Text)
    
    # Metadata
    source_text = Column(Text)  # Original extracted text
    confidence_score = Column(Float)  # Extraction confidence
    
    # Relationships
    company = relationship("Company", back_populates="debt_instruments")
    covenants = relationship("Covenant", back_populates="debt_instrument")
    
    # Status
    is_current = Column(Boolean, default=True)  # Latest extraction
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Covenant(Base):
    """Financial covenant terms and compliance"""
    __tablename__ = "covenants"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    debt_instrument_id = Column(Integer, ForeignKey("debt_instruments.id"))
    filing_id = Column(Integer, ForeignKey("filings.id"))
    
    # Covenant definition
    covenant_type = Column(Enum(CovenantType), nullable=False)
    covenant_name = Column(String(255))  # e.g., "Maximum Consolidated Leverage Ratio"
    
    # Threshold
    threshold_value = Column(Float)  # e.g., 4.5 for max 4.5x leverage
    threshold_direction = Column(String(10))  # "max" or "min"
    
    # Current compliance
    current_value = Column(Float)  # e.g., 3.2 (current leverage)
    cushion = Column(Float)  # threshold - current (or current - threshold for min)
    cushion_percent = Column(Float)  # cushion as percentage of threshold
    in_compliance = Column(Boolean)
    
    # Measurement
    measurement_period = Column(String(50))  # "quarterly", "trailing_12m"
    measurement_date = Column(Date)
    
    # Details
    definition = Column(Text)  # How the ratio is calculated
    source_text = Column(Text)
    confidence_score = Column(Float)
    
    # Relationships
    company = relationship("Company", back_populates="covenants")
    debt_instrument = relationship("DebtInstrument", back_populates="covenants")
    
    is_current = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MaturitySchedule(Base):
    """Debt maturity schedule by year"""
    __tablename__ = "maturity_schedules"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    filing_id = Column(Integer, ForeignKey("filings.id"))
    
    fiscal_year = Column(Integer, nullable=False)
    amount_due = Column(Float)  # in millions
    
    # Breakdown by instrument type (optional)
    breakdown = Column(JSON)  # {"term_loan": 500, "bonds": 300}
    
    source_text = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('company_id', 'filing_id', 'fiscal_year', name='uq_maturity_schedule'),
    )


class CreditSnapshot(Base):
    """Point-in-time credit metrics for trend tracking"""
    __tablename__ = "credit_snapshots"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    filing_id = Column(Integer, ForeignKey("filings.id"))
    
    period_end_date = Column(Date, nullable=False)
    
    # Debt metrics
    total_debt = Column(Float)  # in millions
    net_debt = Column(Float)
    cash_and_equivalents = Column(Float)
    
    # Income metrics (for ratios)
    ebitda = Column(Float)
    ebit = Column(Float)
    interest_expense = Column(Float)
    
    # Calculated ratios
    leverage_ratio = Column(Float)  # Total Debt / EBITDA
    net_leverage_ratio = Column(Float)  # Net Debt / EBITDA
    interest_coverage = Column(Float)  # EBITDA / Interest
    
    # Relationships
    company = relationship("Company", back_populates="credit_snapshots")
    
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('company_id', 'period_end_date', name='uq_credit_snapshot'),
    )


# ============================================
# ALERTS & MONITORING
# ============================================

class Alert(Base):
    """Generated alerts for monitored companies"""
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    
    alert_type = Column(Enum(AlertType), nullable=False)
    severity = Column(Enum(AlertSeverity), nullable=False)
    
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    
    # Related data
    related_covenant_id = Column(Integer, ForeignKey("covenants.id"))
    related_instrument_id = Column(Integer, ForeignKey("debt_instruments.id"))
    metric_value = Column(Float)
    threshold_value = Column(Float)
    
    # Status
    acknowledged = Column(Boolean, default=False)
    acknowledged_at = Column(DateTime)
    acknowledged_by = Column(String(255))
    
    # Relationships
    company = relationship("Company", back_populates="alerts")
    
    triggered_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================
# USER & WATCHLIST TABLES
# ============================================

class User(Base):
    """User accounts"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    
    # API access
    api_key = Column(String(64), unique=True, index=True)
    api_tier = Column(String(20), default="free")  # free, developer, pro, enterprise
    
    # Subscription
    stripe_customer_id = Column(String(255))
    subscription_status = Column(String(20))  # active, canceled, past_due
    
    # Relationships
    watchlist = relationship("Watchlist", back_populates="user")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Watchlist(Base):
    """User's watched companies"""
    __tablename__ = "watchlists"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    
    # Alert preferences
    alert_covenant = Column(Boolean, default=True)
    alert_maturity = Column(Boolean, default=True)
    alert_new_debt = Column(Boolean, default=True)
    
    notes = Column(Text)
    
    # Relationships
    user = relationship("User", back_populates="watchlist")
    
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('user_id', 'company_id', name='uq_user_watchlist'),
    )
