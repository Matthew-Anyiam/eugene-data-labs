"""
Eugene Data Labs - CapEx Extractor

Extracts Capital Expenditure data from SEC filings.

Why CapEx matters for credit:
- High CapEx = investing for growth, but burning cash
- CapEx vs Operating Cash Flow = can they fund investments?
- CapEx cuts = potential distress signal or efficiency focus
- Maintenance vs Growth CapEx = sustainability of business

Sources:
- 10-K/10-Q: Cash Flow Statement, MD&A
- Earnings calls: Guidance, management commentary
"""

from dataclasses import dataclass
from typing import List, Optional, Dict
from datetime import datetime
import re


@dataclass
class CapExItem:
    """Individual CapEx line item"""
    category: str  # maintenance, growth, acquisition, other
    description: str
    amount: float  # in millions
    is_estimate: bool  # True if guidance/estimate, False if actual


@dataclass
class CapExExtraction:
    """Complete CapEx extraction result"""
    ticker: str
    company_name: str
    filing_date: str
    period: str  # Q1 2024, FY 2024, etc.
    
    # Current period CapEx
    total_capex: float  # in millions
    maintenance_capex: Optional[float]
    growth_capex: Optional[float]
    
    # Cash flow context
    operating_cash_flow: Optional[float]
    free_cash_flow: Optional[float]  # OCF - CapEx
    capex_to_ocf_ratio: Optional[float]  # CapEx / OCF
    
    # Guidance
    capex_guidance_low: Optional[float]
    capex_guidance_high: Optional[float]
    guidance_period: Optional[str]  # FY 2025, etc.
    
    # Year-over-year comparison
    prior_period_capex: Optional[float]
    capex_change_pct: Optional[float]
    
    # Breakdown
    capex_items: List[CapExItem]
    
    # Analysis
    capex_intensity: Optional[float]  # CapEx / Revenue
    signal: str  # investing, maintaining, cutting, unknown
    
    # Metadata
    extraction_timestamp: str
    confidence: float
    source_text: str


def classify_capex_signal(
    current: float,
    prior: Optional[float],
    guidance_low: Optional[float],
    guidance_high: Optional[float]
) -> str:
    """Classify CapEx signal based on trends"""
    
    if prior and current:
        change = (current - prior) / prior * 100
        
        if change > 20:
            return "investing"  # Significant increase
        elif change < -20:
            return "cutting"  # Significant decrease
        else:
            return "maintaining"  # Stable
    
    return "unknown"


def parse_capex_from_text(raw_text: str) -> Dict:
    """Extract CapEx figures from filing text"""
    text_lower = raw_text.lower()
    
    result = {
        "total_capex": None,
        "operating_cash_flow": None,
        "maintenance_capex": None,
        "growth_capex": None,
        "guidance_low": None,
        "guidance_high": None,
        "items": []
    }
    
    # Pattern: "capital expenditures of $X million/billion"
    capex_patterns = [
        r'capital expenditures?\s+(?:of\s+)?\$?([\d,]+(?:\.\d+)?)\s*(million|billion|M|B)?',
        r'capex\s+(?:of\s+)?\$?([\d,]+(?:\.\d+)?)\s*(million|billion|M|B)?',
        r'property.+equipment.+purchases?\s+\$?([\d,]+(?:\.\d+)?)\s*(million|billion|M|B)?',
    ]
    
    for pattern in capex_patterns:
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            amount = float(match.group(1).replace(",", ""))
            unit = match.group(2) or ""
            
            if unit.lower() in ["billion", "b"]:
                amount *= 1000
            
            if result["total_capex"] is None:
                result["total_capex"] = amount
            break
    
    # Operating cash flow pattern
    ocf_patterns = [
        r'(?:cash (?:provided by|from)|net cash from)\s+operat\w+\s+activit\w+\s+(?:was\s+)?\$?([\d,]+(?:\.\d+)?)\s*(million|billion|M|B)?',
        r'operating cash flow\s+(?:of\s+)?\$?([\d,]+(?:\.\d+)?)\s*(million|billion|M|B)?',
    ]
    
    for pattern in ocf_patterns:
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            amount = float(match.group(1).replace(",", ""))
            unit = match.group(2) or ""
            
            if unit.lower() in ["billion", "b"]:
                amount *= 1000
            
            result["operating_cash_flow"] = amount
            break
    
    # Guidance patterns
    guidance_patterns = [
        r'(?:expect|anticipate|project|plan).+cap(?:ital )?ex(?:penditures)?.+\$?([\d,]+(?:\.\d+)?)\s*(?:to|-)\s*\$?([\d,]+(?:\.\d+)?)\s*(million|billion|M|B)?',
        r'cap(?:ital )?ex(?:penditures)?\s+guidance.+\$?([\d,]+(?:\.\d+)?)\s*(?:to|-)\s*\$?([\d,]+(?:\.\d+)?)\s*(million|billion|M|B)?',
    ]
    
    for pattern in guidance_patterns:
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            low = float(match.group(1).replace(",", ""))
            high = float(match.group(2).replace(",", ""))
            unit = match.group(3) or ""
            
            if unit.lower() in ["billion", "b"]:
                low *= 1000
                high *= 1000
            
            result["guidance_low"] = low
            result["guidance_high"] = high
            break
    
    # Maintenance vs Growth patterns
    if "maintenance" in text_lower:
        maint_match = re.search(
            r'maintenance\s+cap(?:ital )?ex\w*\s+(?:of\s+)?\$?([\d,]+(?:\.\d+)?)',
            raw_text,
            re.IGNORECASE
        )
        if maint_match:
            result["maintenance_capex"] = float(maint_match.group(1).replace(",", ""))
    
    if "growth" in text_lower:
        growth_match = re.search(
            r'growth\s+cap(?:ital )?ex\w*\s+(?:of\s+)?\$?([\d,]+(?:\.\d+)?)',
            raw_text,
            re.IGNORECASE
        )
        if growth_match:
            result["growth_capex"] = float(growth_match.group(1).replace(",", ""))
    
    return result


def extract_capex(
    raw_text: str,
    ticker: str,
    company_name: str,
    filing_date: str,
    period: str,
    prior_capex: Optional[float] = None,
    revenue: Optional[float] = None
) -> CapExExtraction:
    """
    Main function to extract CapEx data from filing text.
    
    Args:
        raw_text: Filing text (10-K, 10-Q, or earnings transcript)
        ticker: Company ticker
        company_name: Company name
        filing_date: Filing date
        period: Period (Q1 2024, FY 2024, etc.)
        prior_capex: Prior period CapEx for comparison
        revenue: Revenue for intensity calculation
    
    Returns:
        CapExExtraction with all extracted data
    """
    # Parse raw text
    parsed = parse_capex_from_text(raw_text)
    
    total_capex = parsed["total_capex"] or 0
    ocf = parsed["operating_cash_flow"]
    
    # Calculate derived metrics
    free_cash_flow = None
    capex_to_ocf = None
    if ocf and total_capex:
        free_cash_flow = ocf - total_capex
        capex_to_ocf = total_capex / ocf if ocf > 0 else None
    
    # Calculate change
    capex_change = None
    if prior_capex and total_capex:
        capex_change = (total_capex - prior_capex) / prior_capex * 100
    
    # Calculate intensity
    capex_intensity = None
    if revenue and total_capex:
        capex_intensity = total_capex / revenue
    
    # Classify signal
    signal = classify_capex_signal(
        total_capex,
        prior_capex,
        parsed["guidance_low"],
        parsed["guidance_high"]
    )
    
    # Build items list
    items = []
    if parsed["maintenance_capex"]:
        items.append(CapExItem(
            category="maintenance",
            description="Maintenance CapEx",
            amount=parsed["maintenance_capex"],
            is_estimate=False
        ))
    if parsed["growth_capex"]:
        items.append(CapExItem(
            category="growth",
            description="Growth CapEx",
            amount=parsed["growth_capex"],
            is_estimate=False
        ))
    
    return CapExExtraction(
        ticker=ticker,
        company_name=company_name,
        filing_date=filing_date,
        period=period,
        total_capex=total_capex,
        maintenance_capex=parsed["maintenance_capex"],
        growth_capex=parsed["growth_capex"],
        operating_cash_flow=ocf,
        free_cash_flow=free_cash_flow,
        capex_to_ocf_ratio=capex_to_ocf,
        capex_guidance_low=parsed["guidance_low"],
        capex_guidance_high=parsed["guidance_high"],
        guidance_period=f"FY {int(filing_date[:4]) + 1}" if parsed["guidance_low"] else None,
        prior_period_capex=prior_capex,
        capex_change_pct=capex_change,
        capex_items=items,
        capex_intensity=capex_intensity,
        signal=signal,
        extraction_timestamp=datetime.now().isoformat(),
        confidence=0.85 if total_capex else 0.5,
        source_text=raw_text[:500] + "..." if len(raw_text) > 500 else raw_text
    )


def format_capex_markdown(extraction: CapExExtraction) -> str:
    """Format CapEx extraction as markdown"""
    
    signal_emoji = {
        "investing": "📈",
        "maintaining": "➖",
        "cutting": "📉",
        "unknown": "❓"
    }
    
    emoji = signal_emoji.get(extraction.signal, "❓")
    
    md = f"""# CapEx Analysis: {extraction.company_name} ({extraction.ticker})

## {emoji} Signal: {extraction.signal.upper()}

**Period:** {extraction.period}
**Filed:** {extraction.filing_date}

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Total CapEx | ${extraction.total_capex:,.0f}M |
"""
    
    if extraction.maintenance_capex:
        md += f"| Maintenance CapEx | ${extraction.maintenance_capex:,.0f}M |\n"
    
    if extraction.growth_capex:
        md += f"| Growth CapEx | ${extraction.growth_capex:,.0f}M |\n"
    
    if extraction.operating_cash_flow:
        md += f"| Operating Cash Flow | ${extraction.operating_cash_flow:,.0f}M |\n"
    
    if extraction.free_cash_flow is not None:
        fcf_sign = "+" if extraction.free_cash_flow >= 0 else ""
        md += f"| Free Cash Flow | {fcf_sign}${extraction.free_cash_flow:,.0f}M |\n"
    
    if extraction.capex_to_ocf_ratio:
        md += f"| CapEx / OCF | {extraction.capex_to_ocf_ratio:.1%} |\n"
    
    if extraction.capex_intensity:
        md += f"| CapEx Intensity | {extraction.capex_intensity:.1%} of Revenue |\n"

    # Year-over-year
    if extraction.capex_change_pct is not None:
        change_emoji = "📈" if extraction.capex_change_pct > 0 else "📉" if extraction.capex_change_pct < 0 else "➖"
        md += f"""
## Year-over-Year

| Metric | Value |
|--------|-------|
| Prior Period CapEx | ${extraction.prior_period_capex:,.0f}M |
| Change | {change_emoji} {extraction.capex_change_pct:+.1f}% |
"""

    # Guidance
    if extraction.capex_guidance_low and extraction.capex_guidance_high:
        md += f"""
## Guidance ({extraction.guidance_period})

| Low | High | Midpoint |
|-----|------|----------|
| ${extraction.capex_guidance_low:,.0f}M | ${extraction.capex_guidance_high:,.0f}M | ${(extraction.capex_guidance_low + extraction.capex_guidance_high) / 2:,.0f}M |
"""

    md += f"""
---

## Credit Implications

"""
    
    if extraction.signal == "investing":
        md += "- 📈 **Increasing CapEx** — Company investing in growth\n"
        md += "- ⚠️ Watch cash burn and debt levels\n"
    elif extraction.signal == "cutting":
        md += "- 📉 **Cutting CapEx** — Could signal distress or efficiency focus\n"
        md += "- 🔍 Review if cuts are strategic or forced\n"
    elif extraction.signal == "maintaining":
        md += "- ➖ **Stable CapEx** — Consistent investment levels\n"
    
    if extraction.free_cash_flow is not None:
        if extraction.free_cash_flow < 0:
            md += f"- ⚠️ **Negative FCF** — CapEx exceeds operating cash flow by ${abs(extraction.free_cash_flow):,.0f}M\n"
        else:
            md += f"- ✅ **Positive FCF** — ${extraction.free_cash_flow:,.0f}M after CapEx\n"
    
    if extraction.capex_to_ocf_ratio and extraction.capex_to_ocf_ratio > 1:
        md += "- 🚨 **CapEx > OCF** — Company funding investment with debt or cash\n"

    md += f"""
---

*Extracted: {extraction.extraction_timestamp}*
"""
    
    return md


# For testing
if __name__ == "__main__":
    sample_text = """
    CASH FLOWS FROM OPERATING ACTIVITIES
    Net cash provided by operating activities was $15,200 million for the year.
    
    CASH FLOWS FROM INVESTING ACTIVITIES
    Capital expenditures of $8,500 million were primarily for manufacturing facilities
    and equipment. Maintenance capex was approximately $3,000 million with growth
    capex of $5,500 million focused on new production capacity.
    
    MANAGEMENT DISCUSSION
    We expect capital expenditures for fiscal 2025 to be in the range of $9,000 to 
    $10,500 million as we continue to invest in expanding capacity.
    """
    
    result = extract_capex(
        raw_text=sample_text,
        ticker="TSLA",
        company_name="Tesla, Inc.",
        filing_date="2025-01-29",
        period="FY 2024",
        prior_capex=7200,  # Prior year
        revenue=96000  # Revenue for intensity
    )
    
    print(format_capex_markdown(result))