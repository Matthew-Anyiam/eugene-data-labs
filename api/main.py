"""
Eugene Intelligence - API Server

FastAPI application serving the Eugene Data API.
"""

from fastapi import FastAPI, HTTPException, Depends, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import date, datetime
import os

# App initialization
app = FastAPI(
    title="Eugene Intelligence API",
    description="Financial data infrastructure for AI agents. Debt, covenants, earnings, and more.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# Authentication
# ==========================================

async def verify_api_key(x_api_key: str = Header(None)):
    """Verify API key from header"""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="API key required")
    
    # In production, verify against database
    # For now, accept any key for testing
    if x_api_key.startswith("eugene_"):
        return x_api_key
    
    raise HTTPException(status_code=401, detail="Invalid API key")


# ==========================================
# Pydantic Models
# ==========================================

class CompanyResponse(BaseModel):
    ticker: str
    name: str
    cik: str
    sector: Optional[str]
    industry: Optional[str]
    market_cap: Optional[float]


class DebtInstrumentResponse(BaseModel):
    instrument_name: str
    instrument_type: Optional[str]
    seniority: Optional[str]
    principal_amount: Optional[float]
    outstanding_amount: Optional[float]
    available_amount: Optional[float]
    currency: str
    rate_type: Optional[str]
    interest_rate: Optional[float]
    spread_bps: Optional[int]
    reference_rate: Optional[str]
    maturity_date: Optional[str]
    issue_date: Optional[str]


class CovenantResponse(BaseModel):
    covenant_type: str
    covenant_name: Optional[str]
    threshold_value: Optional[float]
    threshold_direction: str
    current_value: Optional[float]
    cushion: Optional[float]
    cushion_percent: Optional[float]
    in_compliance: Optional[bool]
    measurement_period: Optional[str]


class MaturityScheduleResponse(BaseModel):
    fiscal_year: int
    amount_due: float
    breakdown: Optional[Dict[str, float]]


class CreditSummaryResponse(BaseModel):
    ticker: str
    company_name: str
    as_of_date: str
    total_debt: Optional[float]
    net_debt: Optional[float]
    cash_and_equivalents: Optional[float]
    ebitda: Optional[float]
    leverage_ratio: Optional[float]
    interest_coverage: Optional[float]
    debt_instruments: List[DebtInstrumentResponse]
    covenants: List[CovenantResponse]
    maturity_schedule: List[MaturityScheduleResponse]


class AlertResponse(BaseModel):
    id: int
    company_ticker: str
    alert_type: str
    severity: str
    title: str
    message: str
    triggered_at: datetime


class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: datetime


# ==========================================
# Mock Data (Replace with DB queries)
# ==========================================

MOCK_COMPANIES = {
    "AAPL": {
        "ticker": "AAPL",
        "name": "Apple Inc.",
        "cik": "0000320193",
        "sector": "Technology",
        "industry": "Consumer Electronics",
        "market_cap": 3000000
    },
    "MSFT": {
        "ticker": "MSFT", 
        "name": "Microsoft Corporation",
        "cik": "0000789019",
        "sector": "Technology",
        "industry": "Software",
        "market_cap": 2800000
    },
    "TSLA": {
        "ticker": "TSLA",
        "name": "Tesla Inc.",
        "cik": "0001318605",
        "sector": "Consumer Discretionary",
        "industry": "Automobiles",
        "market_cap": 800000
    }
}

MOCK_CREDIT_DATA = {
    "TSLA": {
        "ticker": "TSLA",
        "company_name": "Tesla Inc.",
        "as_of_date": "2024-09-30",
        "total_debt": 5500,
        "net_debt": -8000,  # Net cash position
        "cash_and_equivalents": 13500,
        "ebitda": 12000,
        "leverage_ratio": 0.46,
        "interest_coverage": 25.0,
        "debt_instruments": [
            {
                "instrument_name": "2025 Convertible Notes",
                "instrument_type": "convertible",
                "seniority": "senior_unsecured",
                "principal_amount": 1800,
                "outstanding_amount": 1800,
                "available_amount": None,
                "currency": "USD",
                "rate_type": "fixed",
                "interest_rate": 0.02,
                "spread_bps": None,
                "reference_rate": None,
                "maturity_date": "2025-05-15",
                "issue_date": "2019-05-15"
            },
            {
                "instrument_name": "Automotive Asset-Backed Notes",
                "instrument_type": "other",
                "seniority": "senior_secured",
                "principal_amount": 3700,
                "outstanding_amount": 3700,
                "available_amount": None,
                "currency": "USD",
                "rate_type": "fixed",
                "interest_rate": 0.045,
                "spread_bps": None,
                "reference_rate": None,
                "maturity_date": "2028-12-15",
                "issue_date": "2023-06-01"
            }
        ],
        "covenants": [],  # Tesla's debt doesn't have traditional covenants
        "maturity_schedule": [
            {"fiscal_year": 2025, "amount_due": 1800, "breakdown": {"convertible": 1800}},
            {"fiscal_year": 2026, "amount_due": 500, "breakdown": None},
            {"fiscal_year": 2027, "amount_due": 700, "breakdown": None},
            {"fiscal_year": 2028, "amount_due": 2500, "breakdown": None}
        ]
    }
}


# ==========================================
# API Routes
# ==========================================

@app.get("/", response_model=HealthResponse)
async def root():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        timestamp=datetime.utcnow()
    )


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        timestamp=datetime.utcnow()
    )


# ==========================================
# Company Endpoints
# ==========================================

@app.get("/v1/companies", response_model=List[CompanyResponse])
async def list_companies(
    sector: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    api_key: str = Depends(verify_api_key)
):
    """List all companies with coverage"""
    companies = list(MOCK_COMPANIES.values())
    
    if sector:
        companies = [c for c in companies if c.get("sector", "").lower() == sector.lower()]
    
    return companies[:limit]


@app.get("/v1/companies/{ticker}", response_model=CompanyResponse)
async def get_company(
    ticker: str,
    api_key: str = Depends(verify_api_key)
):
    """Get company information"""
    ticker = ticker.upper()
    
    if ticker not in MOCK_COMPANIES:
        raise HTTPException(status_code=404, detail=f"Company {ticker} not found")
    
    return MOCK_COMPANIES[ticker]


# ==========================================
# Debt & Credit Endpoints
# ==========================================

@app.get("/v1/credit/{ticker}", response_model=CreditSummaryResponse)
async def get_credit_summary(
    ticker: str,
    api_key: str = Depends(verify_api_key)
):
    """
    Get comprehensive credit summary for a company.
    
    Includes debt instruments, covenants, and maturity schedule.
    """
    ticker = ticker.upper()
    
    if ticker not in MOCK_CREDIT_DATA:
        raise HTTPException(
            status_code=404, 
            detail=f"Credit data for {ticker} not found. Coverage may be in progress."
        )
    
    return MOCK_CREDIT_DATA[ticker]


@app.get("/v1/credit/{ticker}/debt", response_model=List[DebtInstrumentResponse])
async def get_debt_instruments(
    ticker: str,
    instrument_type: Optional[str] = None,
    api_key: str = Depends(verify_api_key)
):
    """Get debt instruments for a company"""
    ticker = ticker.upper()
    
    if ticker not in MOCK_CREDIT_DATA:
        raise HTTPException(status_code=404, detail=f"Credit data for {ticker} not found")
    
    instruments = MOCK_CREDIT_DATA[ticker]["debt_instruments"]
    
    if instrument_type:
        instruments = [i for i in instruments if i.get("instrument_type") == instrument_type]
    
    return instruments


@app.get("/v1/credit/{ticker}/covenants", response_model=List[CovenantResponse])
async def get_covenants(
    ticker: str,
    api_key: str = Depends(verify_api_key)
):
    """Get financial covenants for a company"""
    ticker = ticker.upper()
    
    if ticker not in MOCK_CREDIT_DATA:
        raise HTTPException(status_code=404, detail=f"Credit data for {ticker} not found")
    
    return MOCK_CREDIT_DATA[ticker]["covenants"]


@app.get("/v1/credit/{ticker}/maturities", response_model=List[MaturityScheduleResponse])
async def get_maturity_schedule(
    ticker: str,
    api_key: str = Depends(verify_api_key)
):
    """Get debt maturity schedule for a company"""
    ticker = ticker.upper()
    
    if ticker not in MOCK_CREDIT_DATA:
        raise HTTPException(status_code=404, detail=f"Credit data for {ticker} not found")
    
    return MOCK_CREDIT_DATA[ticker]["maturity_schedule"]


# ==========================================
# Alerts Endpoints
# ==========================================

@app.get("/v1/alerts", response_model=List[AlertResponse])
async def get_alerts(
    ticker: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    api_key: str = Depends(verify_api_key)
):
    """
    Get alerts for monitored companies.
    
    Filter by ticker and/or severity.
    """
    # Mock alerts
    alerts = [
        AlertResponse(
            id=1,
            company_ticker="XYZ",
            alert_type="covenant_cushion",
            severity="warning",
            title="Leverage Covenant Cushion Narrowing",
            message="XYZ Corp leverage ratio at 4.1x, within 10% of 4.5x covenant maximum",
            triggered_at=datetime(2025, 1, 15, 10, 30)
        ),
        AlertResponse(
            id=2,
            company_ticker="ABC",
            alert_type="maturity_approaching",
            severity="info",
            title="Significant Debt Maturity in 18 Months",
            message="ABC Inc has $500M (25% of total debt) maturing by June 2026",
            triggered_at=datetime(2025, 1, 14, 14, 0)
        )
    ]
    
    if ticker:
        alerts = [a for a in alerts if a.company_ticker == ticker.upper()]
    
    if severity:
        alerts = [a for a in alerts if a.severity == severity.lower()]
    
    return alerts[:limit]


# ==========================================
# Batch Endpoints
# ==========================================

@app.post("/v1/credit/batch")
async def get_credit_batch(
    tickers: List[str],
    api_key: str = Depends(verify_api_key)
):
    """
    Get credit data for multiple companies at once.
    
    Maximum 50 tickers per request.
    """
    if len(tickers) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 tickers per request")
    
    results = {}
    for ticker in tickers:
        ticker = ticker.upper()
        if ticker in MOCK_CREDIT_DATA:
            results[ticker] = MOCK_CREDIT_DATA[ticker]
        else:
            results[ticker] = {"error": "not_found"}
    
    return results


# ==========================================
# Insider Trading Endpoints (Form 4)
# ==========================================

class InsiderTransactionResponse(BaseModel):
    insider_name: str
    insider_role: str
    transaction_type: str
    transaction_date: str
    shares: float
    price: Optional[float]
    total_value: Optional[float]
    shares_owned_after: float


class InsiderSummaryResponse(BaseModel):
    ticker: str
    total_transactions: int
    net_shares_30d: float
    total_bought_30d: float
    total_sold_30d: float
    recent_transactions: List[InsiderTransactionResponse]


@app.get("/v1/insiders/{ticker}", response_model=InsiderSummaryResponse)
async def get_insider_trading(
    ticker: str,
    days: int = Query(default=90, le=365),
    api_key: str = Depends(verify_api_key)
):
    """
    Get insider trading activity for a company.
    
    Returns Form 4 filings showing insider buys/sells.
    """
    ticker = ticker.upper()
    
    # Mock data for demonstration
    mock_insiders = {
        "TSLA": InsiderSummaryResponse(
            ticker="TSLA",
            total_transactions=15,
            net_shares_30d=-50000,
            total_bought_30d=10000,
            total_sold_30d=60000,
            recent_transactions=[
                InsiderTransactionResponse(
                    insider_name="Elon Musk",
                    insider_role="CEO, Director",
                    transaction_type="Sale",
                    transaction_date="2024-01-15",
                    shares=50000,
                    price=185.50,
                    total_value=9275000,
                    shares_owned_after=411000000
                )
            ]
        ),
        "AAPL": InsiderSummaryResponse(
            ticker="AAPL",
            total_transactions=8,
            net_shares_30d=-25000,
            total_bought_30d=5000,
            total_sold_30d=30000,
            recent_transactions=[
                InsiderTransactionResponse(
                    insider_name="Tim Cook",
                    insider_role="CEO",
                    transaction_type="Sale",
                    transaction_date="2024-01-10",
                    shares=25000,
                    price=182.00,
                    total_value=4550000,
                    shares_owned_after=3500000
                )
            ]
        )
    }
    
    if ticker in mock_insiders:
        return mock_insiders[ticker]
    
    # Return empty for unknown tickers
    return InsiderSummaryResponse(
        ticker=ticker,
        total_transactions=0,
        net_shares_30d=0,
        total_bought_30d=0,
        total_sold_30d=0,
        recent_transactions=[]
    )


# ==========================================
# Institutional Holdings Endpoints (13F)
# ==========================================

class HoldingResponse(BaseModel):
    issuer: str
    cusip: str
    value: int
    shares: int
    pct_of_portfolio: float


class InstitutionalHoldingsResponse(BaseModel):
    institution_name: str
    institution_cik: str
    report_date: str
    total_value: int
    total_positions: int
    top_holdings: List[HoldingResponse]


@app.get("/v1/institutions/{cik}/holdings")
async def get_institutional_holdings(
    cik: str,
    api_key: str = Depends(verify_api_key)
):
    """
    Get 13F holdings for an institutional investor.
    
    CIK is the SEC identifier for the institution.
    """
    # Mock data
    return InstitutionalHoldingsResponse(
        institution_name="Sample Fund LP",
        institution_cik=cik,
        report_date="2024-09-30",
        total_value=15000000000,
        total_positions=150,
        top_holdings=[
            HoldingResponse(
                issuer="APPLE INC",
                cusip="037833100",
                value=2500000000,
                shares=13500000,
                pct_of_portfolio=16.7
            ),
            HoldingResponse(
                issuer="MICROSOFT CORP",
                cusip="594918104",
                value=2000000000,
                shares=4800000,
                pct_of_portfolio=13.3
            )
        ]
    )


@app.get("/v1/stock/{ticker}/institutional")
async def get_stock_institutional_holders(
    ticker: str,
    limit: int = Query(default=20, le=100),
    api_key: str = Depends(verify_api_key)
):
    """
    Get top institutional holders of a stock.
    
    Returns institutions with largest positions from 13F filings.
    """
    ticker = ticker.upper()
    
    # Mock data
    return {
        "ticker": ticker,
        "total_institutional_ownership_pct": 72.5,
        "total_institutions": 1250,
        "top_holders": [
            {
                "institution": "Vanguard Group Inc",
                "shares": 150000000,
                "value": 27750000000,
                "pct_of_shares_outstanding": 8.5
            },
            {
                "institution": "BlackRock Inc",
                "shares": 120000000,
                "value": 22200000000,
                "pct_of_shares_outstanding": 6.8
            }
        ]
    }


# ==========================================
# Beneficial Ownership Endpoints (13D/13G)
# ==========================================

class BeneficialOwnerResponse(BaseModel):
    filer_name: str
    form_type: str
    filed_date: str
    shares: int
    percent_of_class: float
    is_activist: bool
    purpose: Optional[str]


@app.get("/v1/stock/{ticker}/beneficial-owners")
async def get_beneficial_owners(
    ticker: str,
    limit: int = Query(default=20, le=50),
    api_key: str = Depends(verify_api_key)
):
    """
    Get 13D and 13G filings for a stock.
    
    Shows investors with >5% ownership stakes.
    """
    ticker = ticker.upper()
    
    # Mock data
    return {
        "ticker": ticker,
        "filings": [
            BeneficialOwnerResponse(
                filer_name="Activist Capital Partners",
                form_type="SC 13D",
                filed_date="2024-01-15",
                shares=15000000,
                percent_of_class=8.5,
                is_activist=True,
                purpose="Seeking board representation and strategic review"
            ),
            BeneficialOwnerResponse(
                filer_name="Vanguard Group Inc",
                form_type="SC 13G/A",
                filed_date="2024-02-10",
                shares=150000000,
                percent_of_class=8.5,
                is_activist=False,
                purpose=None
            )
        ]
    }


# ==========================================
# Metrics Endpoint (for monitoring)
# ==========================================

@app.get("/metrics")
async def metrics():
    """Prometheus-compatible metrics endpoint"""
    return {
        "companies_covered": len(MOCK_COMPANIES),
        "api_version": "0.1.0",
        "requests_total": 0,  # Would be tracked in production
    }


# ==========================================
# Main
# ==========================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
