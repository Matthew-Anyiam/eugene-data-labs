"""
Eugene Intelligence - Equity Research Agent

Builds comprehensive company profiles using publicly available information.

Features:
- Company overview (sector, industry, description)
- Financial summary (revenue, earnings, margins, valuation)
- SEC filing intelligence (10-K highlights, risk factors, MD&A)
- Ownership & insider activity (13F, 13D, Form 4)
- Credit profile (debt, covenants, ratings)
- News & sentiment

This agent aggregates data from multiple parsers to create
a complete picture for equity research and due diligence.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime
from pathlib import Path
import json


@dataclass
class CompanyOverview:
    """Basic company information"""
    ticker: str
    name: str
    sector: str
    industry: str
    description: str
    employees: Optional[int] = None
    headquarters: Optional[str] = None
    website: Optional[str] = None
    cik: Optional[str] = None
    founded: Optional[str] = None


@dataclass
class Executive:
    """Company executive"""
    name: str
    title: str
    age: Optional[int] = None
    tenure_years: Optional[float] = None
    compensation: Optional[float] = None


@dataclass
class FinancialSummary:
    """Key financial metrics"""
    # Income Statement
    revenue: Optional[float] = None
    revenue_growth: Optional[float] = None
    gross_profit: Optional[float] = None
    gross_margin: Optional[float] = None
    operating_income: Optional[float] = None
    operating_margin: Optional[float] = None
    net_income: Optional[float] = None
    net_margin: Optional[float] = None
    eps: Optional[float] = None
    
    # Balance Sheet
    total_assets: Optional[float] = None
    total_liabilities: Optional[float] = None
    total_equity: Optional[float] = None
    cash: Optional[float] = None
    total_debt: Optional[float] = None
    net_debt: Optional[float] = None
    
    # Cash Flow
    operating_cash_flow: Optional[float] = None
    capex: Optional[float] = None
    free_cash_flow: Optional[float] = None
    
    # Valuation
    market_cap: Optional[float] = None
    enterprise_value: Optional[float] = None
    pe_ratio: Optional[float] = None
    ev_ebitda: Optional[float] = None
    price_to_book: Optional[float] = None
    price_to_sales: Optional[float] = None
    
    # Period
    period: Optional[str] = None
    period_end: Optional[str] = None


@dataclass
class BusinessSegment:
    """Business segment data"""
    name: str
    revenue: float
    revenue_pct: float
    operating_income: Optional[float] = None
    description: Optional[str] = None


@dataclass
class RiskFactor:
    """Risk factor from 10-K"""
    category: str
    title: str
    summary: str
    severity: str  # high, medium, low


@dataclass
class InsiderSummary:
    """Insider activity summary"""
    period_days: int = 90
    total_buys: int = 0
    total_sells: int = 0
    buy_value: float = 0
    sell_value: float = 0
    net_sentiment: str = "neutral"  # bullish, bearish, neutral
    notable_transactions: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class InstitutionalSummary:
    """Institutional ownership summary"""
    total_institutional_pct: float = 0
    top_holders: List[Dict[str, Any]] = field(default_factory=list)
    recent_changes: List[Dict[str, Any]] = field(default_factory=list)
    activist_investors: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class CreditSummary:
    """Credit profile summary"""
    total_debt: float = 0
    net_debt: float = 0
    leverage_ratio: Optional[float] = None
    interest_coverage: Optional[float] = None
    credit_rating: Optional[str] = None
    outlook: Optional[str] = None
    covenant_status: str = "unknown"
    covenant_cushion_min: Optional[float] = None
    next_maturity: Optional[str] = None
    next_maturity_amount: Optional[float] = None


@dataclass
class GuidanceSummary:
    """Management guidance"""
    metric: str
    period: str
    low: Optional[float] = None
    high: Optional[float] = None
    prior_low: Optional[float] = None
    prior_high: Optional[float] = None
    direction: str = "unchanged"  # raised, lowered, unchanged, initiated


@dataclass
class CompanyProfile:
    """Complete company profile"""
    # Basic info
    overview: CompanyOverview
    executives: List[Executive]
    
    # Financials
    financials: FinancialSummary
    segments: List[BusinessSegment]
    
    # SEC intelligence
    risk_factors: List[RiskFactor]
    recent_8k_events: List[Dict[str, Any]]
    
    # Ownership
    insider_activity: InsiderSummary
    institutional_ownership: InstitutionalSummary
    
    # Credit
    credit_profile: CreditSummary
    
    # Guidance
    guidance: List[GuidanceSummary]
    
    # Metadata
    last_updated: str
    data_sources: List[str]
    confidence_score: float


class EquityResearchAgent:
    """
    Equity Research Agent
    
    Builds comprehensive company profiles by aggregating
    data from multiple sources and parsers.
    """
    
    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.profiles_dir = self.data_dir / "profiles"
        self.profiles_dir.mkdir(parents=True, exist_ok=True)
    
    def build_profile(
        self,
        ticker: str,
        company_name: str = "",
        sector: str = "",
        industry: str = ""
    ) -> CompanyProfile:
        """
        Build a comprehensive company profile.
        
        In production, this would pull from:
        - SEC EDGAR API
        - Market data APIs
        - News APIs
        - Internal parsers
        
        For MVP, we build from available sample data.
        """
        
        # Load sample data if available
        sample_file = self.data_dir / "samples" / f"{ticker.lower()}_10k_2023.json"
        sample_data = {}
        if sample_file.exists():
            with open(sample_file) as f:
                sample_data = json.load(f)
        
        # Load extraction data if available
        extraction_file = self.data_dir / "extractions" / f"{ticker}_mock.json"
        extraction_data = {}
        if extraction_file.exists():
            with open(extraction_file) as f:
                extraction_data = json.load(f)
        
        # Build overview
        overview = CompanyOverview(
            ticker=ticker,
            name=company_name or sample_data.get("company", {}).get("name", ticker),
            sector=sector or self._infer_sector(ticker),
            industry=industry or self._infer_industry(ticker),
            description=self._get_description(ticker),
            cik=sample_data.get("company", {}).get("cik")
        )
        
        # Build executives (mock for now)
        executives = self._get_executives(ticker)
        
        # Build financials
        financials = self._build_financials(ticker, sample_data, extraction_data)
        
        # Build segments
        segments = self._get_segments(ticker)
        
        # Build risk factors
        risk_factors = self._get_risk_factors(ticker)
        
        # Get recent 8-K events
        recent_8k = self._get_recent_8k(ticker)
        
        # Build insider summary
        insider_activity = self._build_insider_summary(ticker)
        
        # Build institutional summary
        institutional = self._build_institutional_summary(ticker)
        
        # Build credit summary
        credit = self._build_credit_summary(ticker, sample_data, extraction_data)
        
        # Build guidance
        guidance = self._get_guidance(ticker)
        
        profile = CompanyProfile(
            overview=overview,
            executives=executives,
            financials=financials,
            segments=segments,
            risk_factors=risk_factors,
            recent_8k_events=recent_8k,
            insider_activity=insider_activity,
            institutional_ownership=institutional,
            credit_profile=credit,
            guidance=guidance,
            last_updated=datetime.now().isoformat(),
            data_sources=["SEC EDGAR", "Sample Data", "Mock Extraction"],
            confidence_score=0.75
        )
        
        # Save profile
        self._save_profile(profile)
        
        return profile
    
    def _infer_sector(self, ticker: str) -> str:
        """Infer sector from ticker"""
        sectors = {
            "TSLA": "Consumer Discretionary",
            "AAPL": "Technology",
            "MSFT": "Technology",
            "GOOGL": "Technology",
            "AMZN": "Consumer Discretionary",
            "META": "Technology",
            "NVDA": "Technology",
            "JPM": "Financials",
            "WMT": "Consumer Staples",
            "BRK.A": "Financials"
        }
        return sectors.get(ticker, "Unknown")
    
    def _infer_industry(self, ticker: str) -> str:
        """Infer industry from ticker"""
        industries = {
            "TSLA": "Auto Manufacturers",
            "AAPL": "Consumer Electronics",
            "MSFT": "Software - Infrastructure",
            "GOOGL": "Internet Content & Information",
            "AMZN": "Internet Retail",
            "META": "Internet Content & Information",
            "NVDA": "Semiconductors",
            "JPM": "Banks - Diversified",
            "WMT": "Discount Stores",
            "BRK.A": "Insurance - Diversified"
        }
        return industries.get(ticker, "Unknown")
    
    def _get_description(self, ticker: str) -> str:
        """Get company description"""
        descriptions = {
            "TSLA": "Tesla designs, develops, manufactures, and sells electric vehicles, energy storage systems, and solar products.",
            "AAPL": "Apple designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories.",
            "MSFT": "Microsoft develops, licenses, and supports software, services, devices, and solutions worldwide.",
            "GOOGL": "Alphabet provides online advertising services, cloud computing, and various software and hardware products.",
            "AMZN": "Amazon engages in retail sale of consumer products, advertising, and subscription services through online and physical stores.",
            "META": "Meta builds technologies that help people connect, find communities, and grow businesses through its family of apps.",
            "NVDA": "NVIDIA designs and manufactures graphics processors and related software for gaming, professional visualization, data centers, and automotive.",
            "JPM": "JPMorgan Chase is a global financial services firm offering investment banking, financial services, and asset management.",
            "WMT": "Walmart operates retail stores and eCommerce websites offering merchandise and services at everyday low prices.",
            "BRK.A": "Berkshire Hathaway is a holding company owning subsidiaries in insurance, freight rail, utilities, and manufacturing."
        }
        return descriptions.get(ticker, "Company description not available.")
    
    def _get_executives(self, ticker: str) -> List[Executive]:
        """Get company executives"""
        # Mock data - in production would come from SEC filings
        exec_data = {
            "TSLA": [
                Executive(name="Elon Musk", title="CEO & Technoking"),
                Executive(name="Vaibhav Taneja", title="CFO"),
                Executive(name="Tom Zhu", title="SVP, Automotive")
            ],
            "AAPL": [
                Executive(name="Tim Cook", title="CEO"),
                Executive(name="Luca Maestri", title="CFO"),
                Executive(name="Jeff Williams", title="COO")
            ],
            "MSFT": [
                Executive(name="Satya Nadella", title="Chairman & CEO"),
                Executive(name="Amy Hood", title="CFO"),
                Executive(name="Judson Althoff", title="Chief Commercial Officer")
            ]
        }
        return exec_data.get(ticker, [Executive(name="Unknown", title="CEO")])
    
    def _build_financials(
        self,
        ticker: str,
        sample_data: Dict,
        extraction_data: Dict
    ) -> FinancialSummary:
        """Build financial summary"""
        # Mock financial data
        financials_map = {
            "TSLA": FinancialSummary(
                revenue=96800, revenue_growth=0.19,
                gross_margin=0.183, operating_margin=0.095,
                net_income=12600, net_margin=0.13, eps=3.91,
                cash=29100, total_debt=4000, net_debt=-25100,
                operating_cash_flow=13300, capex=8900, free_cash_flow=4400,
                market_cap=785000, pe_ratio=65.2, ev_ebitda=42.1,
                period="FY 2024", period_end="2024-12-31"
            ),
            "AAPL": FinancialSummary(
                revenue=383300, revenue_growth=0.02,
                gross_margin=0.438, operating_margin=0.297,
                net_income=97000, net_margin=0.253, eps=6.13,
                cash=61600, total_debt=111100, net_debt=49500,
                operating_cash_flow=110500, capex=10900, free_cash_flow=99600,
                market_cap=2900000, pe_ratio=28.5, ev_ebitda=21.3,
                period="FY 2024", period_end="2024-09-30"
            ),
            "MSFT": FinancialSummary(
                revenue=245100, revenue_growth=0.16,
                gross_margin=0.695, operating_margin=0.445,
                net_income=88100, net_margin=0.36, eps=11.80,
                cash=80500, total_debt=47000, net_debt=-33500,
                operating_cash_flow=87600, capex=28300, free_cash_flow=59300,
                market_cap=3100000, pe_ratio=35.2, ev_ebitda=24.8,
                period="FY 2024", period_end="2024-06-30"
            )
        }
        return financials_map.get(ticker, FinancialSummary())
    
    def _get_segments(self, ticker: str) -> List[BusinessSegment]:
        """Get business segments"""
        segments_map = {
            "TSLA": [
                BusinessSegment(name="Automotive", revenue=82400, revenue_pct=0.85),
                BusinessSegment(name="Energy Generation & Storage", revenue=10200, revenue_pct=0.105),
                BusinessSegment(name="Services & Other", revenue=4200, revenue_pct=0.045)
            ],
            "AAPL": [
                BusinessSegment(name="iPhone", revenue=200600, revenue_pct=0.523),
                BusinessSegment(name="Services", revenue=85200, revenue_pct=0.222),
                BusinessSegment(name="Mac", revenue=29400, revenue_pct=0.077),
                BusinessSegment(name="iPad", revenue=28300, revenue_pct=0.074),
                BusinessSegment(name="Wearables, Home & Accessories", revenue=39800, revenue_pct=0.104)
            ],
            "AMZN": [
                BusinessSegment(name="North America", revenue=353000, revenue_pct=0.60),
                BusinessSegment(name="International", revenue=131200, revenue_pct=0.22),
                BusinessSegment(name="AWS", revenue=90800, revenue_pct=0.155),
                BusinessSegment(name="Advertising", revenue=46900, revenue_pct=0.08)
            ]
        }
        return segments_map.get(ticker, [])
    
    def _get_risk_factors(self, ticker: str) -> List[RiskFactor]:
        """Get risk factors from 10-K"""
        # Mock risk factors
        return [
            RiskFactor(
                category="Competition",
                title="Intense competition in our industry",
                summary="We face significant competition from established and emerging companies.",
                severity="high"
            ),
            RiskFactor(
                category="Regulatory",
                title="Regulatory and legal risks",
                summary="We are subject to various regulations that could impact our operations.",
                severity="medium"
            ),
            RiskFactor(
                category="Economic",
                title="Macroeconomic conditions",
                summary="Economic downturns could adversely affect demand for our products.",
                severity="medium"
            )
        ]
    
    def _get_recent_8k(self, ticker: str) -> List[Dict[str, Any]]:
        """Get recent 8-K events"""
        return [
            {
                "date": "2025-01-29",
                "item": "2.02",
                "event": "Q4 2024 Earnings Release",
                "summary": "Company reported quarterly results"
            }
        ]
    
    def _build_insider_summary(self, ticker: str) -> InsiderSummary:
        """Build insider activity summary"""
        # Mock insider data
        return InsiderSummary(
            period_days=90,
            total_buys=2,
            total_sells=5,
            buy_value=1200000,
            sell_value=8400000,
            net_sentiment="neutral",
            notable_transactions=[
                {"insider": "CFO", "type": "sell", "shares": 10000, "value": 2500000}
            ]
        )
    
    def _build_institutional_summary(self, ticker: str) -> InstitutionalSummary:
        """Build institutional ownership summary"""
        return InstitutionalSummary(
            total_institutional_pct=72.5,
            top_holders=[
                {"name": "Vanguard", "pct": 7.2},
                {"name": "BlackRock", "pct": 5.8},
                {"name": "State Street", "pct": 3.9}
            ],
            recent_changes=[
                {"name": "Vanguard", "change": "+0.4%", "direction": "increased"}
            ],
            activist_investors=[]
        )
    
    def _build_credit_summary(
        self,
        ticker: str,
        sample_data: Dict,
        extraction_data: Dict
    ) -> CreditSummary:
        """Build credit profile summary"""
        credit_map = {
            "TSLA": CreditSummary(
                total_debt=4000,
                net_debt=-25100,
                leverage_ratio=0.08,
                interest_coverage=48.2,
                credit_rating="BB+",
                outlook="Stable",
                covenant_status="compliant",
                covenant_cushion_min=97.7
            ),
            "AAPL": CreditSummary(
                total_debt=111100,
                net_debt=49500,
                leverage_ratio=1.5,
                interest_coverage=29.3,
                credit_rating="AA+",
                outlook="Stable",
                covenant_status="compliant",
                covenant_cushion_min=85.0
            )
        }
        return credit_map.get(ticker, CreditSummary())
    
    def _get_guidance(self, ticker: str) -> List[GuidanceSummary]:
        """Get management guidance"""
        guidance_map = {
            "TSLA": [
                GuidanceSummary(
                    metric="Vehicle Deliveries",
                    period="FY 2025",
                    low=2000000,
                    high=2200000,
                    direction="initiated"
                )
            ],
            "AAPL": [
                GuidanceSummary(
                    metric="Revenue",
                    period="Q1 FY2025",
                    low=117000,
                    high=121000,
                    direction="unchanged"
                )
            ]
        }
        return guidance_map.get(ticker, [])
    
    def _save_profile(self, profile: CompanyProfile):
        """Save profile to file"""
        filepath = self.profiles_dir / f"{profile.overview.ticker}_profile.json"
        
        # Convert to dict for JSON serialization
        profile_dict = {
            "overview": profile.overview.__dict__,
            "executives": [e.__dict__ for e in profile.executives],
            "financials": profile.financials.__dict__,
            "segments": [s.__dict__ for s in profile.segments],
            "risk_factors": [r.__dict__ for r in profile.risk_factors],
            "recent_8k_events": profile.recent_8k_events,
            "insider_activity": profile.insider_activity.__dict__,
            "institutional_ownership": profile.institutional_ownership.__dict__,
            "credit_profile": profile.credit_profile.__dict__,
            "guidance": [g.__dict__ for g in profile.guidance],
            "last_updated": profile.last_updated,
            "data_sources": profile.data_sources,
            "confidence_score": profile.confidence_score
        }
        
        with open(filepath, "w") as f:
            json.dump(profile_dict, f, indent=2)
    
    def format_profile_markdown(self, profile: CompanyProfile) -> str:
        """Format profile as markdown"""
        o = profile.overview
        f = profile.financials
        c = profile.credit_profile
        ins = profile.insider_activity
        inst = profile.institutional_ownership
        
        md = f"""# Company Profile: {o.name} ({o.ticker})

## Overview

| Field | Value |
|-------|-------|
| Sector | {o.sector} |
| Industry | {o.industry} |
| CIK | {o.cik or 'N/A'} |

**Description:** {o.description}

---

## Executives

| Name | Title |
|------|-------|
"""
        for exec in profile.executives:
            md += f"| {exec.name} | {exec.title} |\n"
        
        md += f"""
---

## Financial Summary ({f.period or 'Latest'})

### Income Statement

| Metric | Value |
|--------|-------|
| Revenue | ${f.revenue:,.0f}M | 
| Revenue Growth | {f.revenue_growth*100 if f.revenue_growth else 'N/A':.1f}% |
| Gross Margin | {f.gross_margin*100 if f.gross_margin else 'N/A':.1f}% |
| Operating Margin | {f.operating_margin*100 if f.operating_margin else 'N/A':.1f}% |
| Net Income | ${f.net_income:,.0f}M |
| EPS | ${f.eps:.2f} |

### Balance Sheet

| Metric | Value |
|--------|-------|
| Cash | ${f.cash:,.0f}M |
| Total Debt | ${f.total_debt:,.0f}M |
| Net Debt | ${f.net_debt:,.0f}M |

### Cash Flow

| Metric | Value |
|--------|-------|
| Operating Cash Flow | ${f.operating_cash_flow:,.0f}M |
| CapEx | ${f.capex:,.0f}M |
| Free Cash Flow | ${f.free_cash_flow:,.0f}M |

### Valuation

| Metric | Value |
|--------|-------|
| Market Cap | ${f.market_cap:,.0f}M |
| P/E Ratio | {f.pe_ratio:.1f}x |
| EV/EBITDA | {f.ev_ebitda:.1f}x |

---

## Business Segments

| Segment | Revenue | % of Total |
|---------|---------|------------|
"""
        for seg in profile.segments:
            md += f"| {seg.name} | ${seg.revenue:,.0f}M | {seg.revenue_pct*100:.1f}% |\n"
        
        md += f"""
---

## Credit Profile

| Metric | Value |
|--------|-------|
| Total Debt | ${c.total_debt:,.0f}M |
| Net Debt | ${c.net_debt:,.0f}M |
| Leverage Ratio | {c.leverage_ratio:.2f}x |
| Interest Coverage | {c.interest_coverage:.1f}x |
| Credit Rating | {c.credit_rating or 'N/A'} ({c.outlook or 'N/A'}) |
| Covenant Status | {c.covenant_status} |
| Min Covenant Cushion | {c.covenant_cushion_min:.1f}% |

---

## Insider Activity (Last {ins.period_days} Days)

| Metric | Value |
|--------|-------|
| Total Buys | {ins.total_buys} (${ins.buy_value/1e6:.1f}M) |
| Total Sells | {ins.total_sells} (${ins.sell_value/1e6:.1f}M) |
| Net Sentiment | {ins.net_sentiment.upper()} |

---

## Institutional Ownership

**Total Institutional:** {inst.total_institutional_pct:.1f}%

### Top Holders

| Institution | % Owned |
|-------------|---------|
"""
        for holder in inst.top_holders:
            md += f"| {holder['name']} | {holder['pct']:.1f}% |\n"
        
        md += f"""
---

## Risk Factors

"""
        for risk in profile.risk_factors:
            severity_emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(risk.severity, "⚪")
            md += f"### {severity_emoji} {risk.title}\n\n{risk.summary}\n\n"
        
        md += f"""
---

## Management Guidance

| Metric | Period | Range | Direction |
|--------|--------|-------|-----------|
"""
        for g in profile.guidance:
            range_str = f"${g.low:,.0f}M - ${g.high:,.0f}M" if g.low and g.high else "N/A"
            md += f"| {g.metric} | {g.period} | {range_str} | {g.direction} |\n"
        
        md += f"""
---

*Last Updated: {profile.last_updated}*
*Data Sources: {', '.join(profile.data_sources)}*
*Confidence Score: {profile.confidence_score:.0%}*
"""
        
        return md


# For testing
if __name__ == "__main__":
    print("=" * 60)
    print("EQUITY RESEARCH AGENT - DEMO")
    print("=" * 60)
    print()
    
    agent = EquityResearchAgent()
    
    # Build Tesla profile
    print("Building Tesla profile...")
    profile = agent.build_profile("TSLA", "Tesla, Inc.")
    
    # Print markdown
    print(agent.format_profile_markdown(profile))
    
    print("=" * 60)
    print("Profile saved to data/profiles/TSLA_profile.json")
    print("=" * 60)