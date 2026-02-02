"""
Eugene Intelligence - Macro Intelligence Parser

Extracts and structures macroeconomic data for AI agents.

Data Sources:
- Federal Reserve (FOMC minutes, speeches, rates)
- Bureau of Labor Statistics (CPI, unemployment, jobs)
- Bureau of Economic Analysis (GDP, PCE)
- Treasury (yields, auctions)

This gives agents context on the macro environment
to inform credit and equity analysis.
"""

from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class FedSentiment(Enum):
    """Federal Reserve policy sentiment"""
    HAWKISH = "hawkish"
    DOVISH = "dovish"
    NEUTRAL = "neutral"
    MIXED = "mixed"


class EconomicTrend(Enum):
    """Economic indicator trend"""
    IMPROVING = "improving"
    DETERIORATING = "deteriorating"
    STABLE = "stable"
    UNCERTAIN = "uncertain"


@dataclass
class FedMeeting:
    """FOMC meeting summary"""
    meeting_date: str
    rate_decision: str  # hold, hike, cut
    rate_change_bps: int  # basis points change
    new_rate_low: float
    new_rate_high: float
    vote_split: str  # e.g., "11-1" or "unanimous"
    dissents: List[str]
    key_themes: List[str]
    sentiment: str  # hawkish, dovish, neutral
    forward_guidance: str
    confidence: float


@dataclass
class EconomicIndicator:
    """Economic data point"""
    name: str
    value: float
    unit: str  # percent, millions, index
    period: str  # e.g., "January 2025"
    release_date: str
    prior_value: Optional[float]
    change: Optional[float]
    consensus_estimate: Optional[float]
    surprise: Optional[float]  # actual - consensus
    trend: str  # improving, deteriorating, stable
    source: str  # BLS, BEA, etc.


@dataclass
class YieldCurve:
    """Treasury yield curve snapshot"""
    date: str
    t_1m: float
    t_3m: float
    t_6m: float
    t_1y: float
    t_2y: float
    t_5y: float
    t_10y: float
    t_30y: float
    spread_2_10: float  # 10Y - 2Y spread
    inverted: bool
    signal: str  # normal, flat, inverted


@dataclass
class MacroSnapshot:
    """Complete macro environment snapshot"""
    as_of: str
    
    # Fed Policy
    fed_funds_rate_low: float
    fed_funds_rate_high: float
    fed_sentiment: str
    next_fomc_date: Optional[str]
    rate_expectations: str  # e.g., "2 cuts expected in 2025"
    
    # Growth
    gdp_growth: Optional[float]
    gdp_trend: str
    
    # Inflation
    cpi_yoy: Optional[float]
    core_cpi_yoy: Optional[float]
    pce_yoy: Optional[float]
    inflation_trend: str
    
    # Labor
    unemployment_rate: Optional[float]
    nonfarm_payrolls: Optional[int]  # monthly change
    labor_trend: str
    
    # Yields
    yield_curve: YieldCurve
    
    # Overall Assessment
    economic_outlook: str  # expansion, slowdown, recession risk
    key_risks: List[str]
    
    # Metadata
    last_updated: str
    confidence: float


# Mock Fed meeting data
FOMC_HISTORY = [
    FedMeeting(
        meeting_date="2025-01-29",
        rate_decision="hold",
        rate_change_bps=0,
        new_rate_low=4.25,
        new_rate_high=4.50,
        vote_split="unanimous",
        dissents=[],
        key_themes=["inflation progress", "labor market resilience", "data dependent"],
        sentiment="neutral",
        forward_guidance="Committee will continue to monitor incoming data",
        confidence=0.9
    ),
    FedMeeting(
        meeting_date="2024-12-18",
        rate_decision="cut",
        rate_change_bps=-25,
        new_rate_low=4.25,
        new_rate_high=4.50,
        vote_split="11-1",
        dissents=["Hammack"],
        key_themes=["inflation moderating", "growth solid", "gradual approach"],
        sentiment="dovish",
        forward_guidance="Pace of cuts may slow in 2025",
        confidence=0.9
    ),
]

# Mock economic indicators
ECONOMIC_DATA = {
    "GDP": EconomicIndicator(
        name="Real GDP Growth",
        value=2.8,
        unit="percent",
        period="Q4 2024",
        release_date="2025-01-30",
        prior_value=3.1,
        change=-0.3,
        consensus_estimate=2.6,
        surprise=0.2,
        trend="stable",
        source="BEA"
    ),
    "CPI": EconomicIndicator(
        name="CPI YoY",
        value=2.9,
        unit="percent",
        period="December 2024",
        release_date="2025-01-15",
        prior_value=2.7,
        change=0.2,
        consensus_estimate=2.8,
        surprise=0.1,
        trend="stable",
        source="BLS"
    ),
    "CORE_CPI": EconomicIndicator(
        name="Core CPI YoY",
        value=3.2,
        unit="percent",
        period="December 2024",
        release_date="2025-01-15",
        prior_value=3.3,
        change=-0.1,
        consensus_estimate=3.3,
        surprise=-0.1,
        trend="improving",
        source="BLS"
    ),
    "UNEMPLOYMENT": EconomicIndicator(
        name="Unemployment Rate",
        value=4.1,
        unit="percent",
        period="December 2024",
        release_date="2025-01-10",
        prior_value=4.2,
        change=-0.1,
        consensus_estimate=4.2,
        surprise=-0.1,
        trend="stable",
        source="BLS"
    ),
    "NFP": EconomicIndicator(
        name="Nonfarm Payrolls",
        value=256000,
        unit="jobs",
        period="December 2024",
        release_date="2025-01-10",
        prior_value=212000,
        change=44000,
        consensus_estimate=164000,
        surprise=92000,
        trend="improving",
        source="BLS"
    ),
    "PCE": EconomicIndicator(
        name="PCE Price Index YoY",
        value=2.6,
        unit="percent",
        period="November 2024",
        release_date="2024-12-20",
        prior_value=2.3,
        change=0.3,
        consensus_estimate=2.5,
        surprise=0.1,
        trend="stable",
        source="BEA"
    ),
}

# Mock yield curve
CURRENT_YIELDS = YieldCurve(
    date="2025-01-31",
    t_1m=4.32,
    t_3m=4.31,
    t_6m=4.26,
    t_1y=4.18,
    t_2y=4.21,
    t_5y=4.35,
    t_10y=4.54,
    t_30y=4.77,
    spread_2_10=0.33,
    inverted=False,
    signal="normal"
)


def get_latest_fomc() -> FedMeeting:
    """Get most recent FOMC meeting"""
    return FOMC_HISTORY[0]


def get_indicator(name: str) -> Optional[EconomicIndicator]:
    """Get economic indicator by name"""
    return ECONOMIC_DATA.get(name.upper())


def get_yield_curve() -> YieldCurve:
    """Get current yield curve"""
    return CURRENT_YIELDS


def assess_fed_sentiment(meeting: FedMeeting) -> str:
    """Assess overall Fed sentiment"""
    hawkish_words = ["inflation", "vigilant", "restrictive", "higher for longer"]
    dovish_words = ["progress", "easing", "cut", "normalizing", "balanced"]
    
    text = " ".join(meeting.key_themes + [meeting.forward_guidance]).lower()
    
    hawkish_count = sum(1 for word in hawkish_words if word in text)
    dovish_count = sum(1 for word in dovish_words if word in text)
    
    if hawkish_count > dovish_count + 1:
        return "hawkish"
    elif dovish_count > hawkish_count + 1:
        return "dovish"
    else:
        return "neutral"


def build_macro_snapshot() -> MacroSnapshot:
    """Build complete macro environment snapshot"""
    fomc = get_latest_fomc()
    yields = get_yield_curve()
    
    gdp = get_indicator("GDP")
    cpi = get_indicator("CPI")
    core_cpi = get_indicator("CORE_CPI")
    pce = get_indicator("PCE")
    unemployment = get_indicator("UNEMPLOYMENT")
    nfp = get_indicator("NFP")
    
    # Determine inflation trend
    if core_cpi and core_cpi.change and core_cpi.change < 0:
        inflation_trend = "improving"
    elif cpi and cpi.change and cpi.change > 0.3:
        inflation_trend = "deteriorating"
    else:
        inflation_trend = "stable"
    
    # Determine labor trend
    if nfp and nfp.surprise and nfp.surprise > 50000:
        labor_trend = "strong"
    elif unemployment and unemployment.change and unemployment.change > 0.2:
        labor_trend = "weakening"
    else:
        labor_trend = "stable"
    
    # Determine economic outlook
    if yields.inverted:
        outlook = "recession risk"
    elif gdp and gdp.value and gdp.value > 2.5:
        outlook = "expansion"
    elif gdp and gdp.value and gdp.value < 1.0:
        outlook = "slowdown"
    else:
        outlook = "moderate growth"
    
    # Key risks
    risks = []
    if cpi and cpi.value and cpi.value > 3.0:
        risks.append("Inflation above target")
    if yields.spread_2_10 < 0:
        risks.append("Yield curve inversion - recession signal")
    if unemployment and unemployment.value and unemployment.value > 4.5:
        risks.append("Rising unemployment")
    if not risks:
        risks.append("Geopolitical uncertainty")
    
    return MacroSnapshot(
        as_of=datetime.now().strftime("%Y-%m-%d"),
        fed_funds_rate_low=fomc.new_rate_low,
        fed_funds_rate_high=fomc.new_rate_high,
        fed_sentiment=fomc.sentiment,
        next_fomc_date="2025-03-19",
        rate_expectations="1-2 cuts expected in 2025",
        gdp_growth=gdp.value if gdp else None,
        gdp_trend=gdp.trend if gdp else "unknown",
        cpi_yoy=cpi.value if cpi else None,
        core_cpi_yoy=core_cpi.value if core_cpi else None,
        pce_yoy=pce.value if pce else None,
        inflation_trend=inflation_trend,
        unemployment_rate=unemployment.value if unemployment else None,
        nonfarm_payrolls=int(nfp.value) if nfp else None,
        labor_trend=labor_trend,
        yield_curve=yields,
        economic_outlook=outlook,
        key_risks=risks,
        last_updated=datetime.now().isoformat(),
        confidence=0.85
    )


def format_macro_markdown(snapshot: MacroSnapshot) -> str:
    """Format macro snapshot as markdown"""
    yc = snapshot.yield_curve
    
    # Yield curve visual
    curve_signal = "🟢 Normal" if yc.signal == "normal" else "🔴 Inverted" if yc.inverted else "🟡 Flat"
    
    md = f"""# Macro Intelligence Report

**As of:** {snapshot.as_of}

---

## Federal Reserve

| Metric | Value |
|--------|-------|
| Fed Funds Rate | {snapshot.fed_funds_rate_low:.2f}% - {snapshot.fed_funds_rate_high:.2f}% |
| Fed Sentiment | {snapshot.fed_sentiment.upper()} |
| Next FOMC | {snapshot.next_fomc_date or 'TBD'} |
| Rate Expectations | {snapshot.rate_expectations} |

---

## Economic Indicators

### Growth

| Metric | Value | Trend |
|--------|-------|-------|
| Real GDP Growth | {snapshot.gdp_growth:.1f}% | {snapshot.gdp_trend} |

### Inflation

| Metric | Value | Trend |
|--------|-------|-------|
| CPI YoY | {snapshot.cpi_yoy:.1f}% | {snapshot.inflation_trend} |
| Core CPI YoY | {snapshot.core_cpi_yoy:.1f}% | {snapshot.inflation_trend} |
| PCE YoY | {snapshot.pce_yoy:.1f}% | {snapshot.inflation_trend} |

### Labor Market

| Metric | Value | Trend |
|--------|-------|-------|
| Unemployment Rate | {snapshot.unemployment_rate:.1f}% | {snapshot.labor_trend} |
| Nonfarm Payrolls | +{snapshot.nonfarm_payrolls:,} | {snapshot.labor_trend} |

---

## Yield Curve

**Signal:** {curve_signal}
**2Y-10Y Spread:** {yc.spread_2_10:.2f}%

| Tenor | Yield |
|-------|-------|
| 1M | {yc.t_1m:.2f}% |
| 3M | {yc.t_3m:.2f}% |
| 6M | {yc.t_6m:.2f}% |
| 1Y | {yc.t_1y:.2f}% |
| 2Y | {yc.t_2y:.2f}% |
| 5Y | {yc.t_5y:.2f}% |
| 10Y | {yc.t_10y:.2f}% |
| 30Y | {yc.t_30y:.2f}% |

---

## Economic Outlook

**Assessment:** {snapshot.economic_outlook.upper()}

### Key Risks

"""
    for risk in snapshot.key_risks:
        md += f"- ⚠️ {risk}\n"
    
    md += f"""
---

*Last Updated: {snapshot.last_updated}*
*Confidence: {snapshot.confidence:.0%}*
"""
    
    return md


# For testing
if __name__ == "__main__":
    print("=" * 60)
    print("MACRO INTELLIGENCE - DEMO")
    print("=" * 60)
    print()
    
    snapshot = build_macro_snapshot()
    print(format_macro_markdown(snapshot))
    
    print("=" * 60)
    print("DEMO COMPLETE")
    print("=" * 60)