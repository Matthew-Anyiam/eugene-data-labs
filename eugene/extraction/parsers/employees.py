"""
Eugene Intelligence - Employee & Layoff Tracker

Michelle Leder's top recommendation:
"Tell me anytime a company has lost employees (numbers)"

This parser extracts:
- Current employee count from 10-K
- Year-over-year change
- Layoff announcements from 8-K
- Headcount reduction details
"""

import json
import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from datetime import datetime

from eugene.extraction.llm import (
    LLMClient, MockLLMClient, ExtractionRequest, ExtractionResponse
)
from eugene.validation.engine import validate_employees, ValidationResult

logger = logging.getLogger(__name__)


# ==============================================================================
# Data Models
# ==============================================================================

@dataclass
class EmployeeData:
    """Employee data extracted from a filing"""
    ticker: str
    company_name: str
    
    # Current state
    current_employees: Optional[int] = None
    full_time: Optional[int] = None
    part_time: Optional[int] = None
    contractors: Optional[int] = None
    
    # Change
    prior_year_employees: Optional[int] = None
    year_over_year_change: Optional[int] = None
    yoy_change_pct: Optional[float] = None
    
    # Layoff specific
    has_layoffs: bool = False
    layoff_count: Optional[int] = None
    layoff_percentage: Optional[float] = None
    layoff_date: Optional[str] = None
    layoff_reason: Optional[str] = None
    affected_divisions: List[str] = field(default_factory=list)
    severance_cost: Optional[float] = None  # Millions USD
    
    # Context
    as_of_date: Optional[str] = None
    source_filing: Optional[str] = None
    source_section: Optional[str] = None
    
    # Validation
    confidence: float = 0.0
    validation: Optional[ValidationResult] = None
    
    def __post_init__(self):
        # Calculate YoY change if we have both numbers
        if self.current_employees and self.prior_year_employees:
            self.year_over_year_change = self.current_employees - self.prior_year_employees
            self.yoy_change_pct = round(
                (self.year_over_year_change / self.prior_year_employees) * 100, 1
            )
            
            # Auto-detect layoffs from significant headcount decrease
            if self.year_over_year_change < 0 and abs(self.yoy_change_pct) >= 1.0:
                self.has_layoffs = True
                if self.layoff_count is None:
                    self.layoff_count = abs(self.year_over_year_change)
                if self.layoff_percentage is None:
                    self.layoff_percentage = abs(self.yoy_change_pct)
    
    @property
    def severity(self) -> str:
        """Determine severity of headcount change"""
        if not self.has_layoffs:
            return "none"
        
        pct = abs(self.layoff_percentage or 0)
        if pct >= 20:
            return "critical"  # >20% layoff
        elif pct >= 10:
            return "high"      # 10-20%
        elif pct >= 5:
            return "medium"    # 5-10%
        else:
            return "low"       # <5%
    
    @property
    def summary(self) -> str:
        """Human-readable summary"""
        parts = []
        
        if self.current_employees:
            parts.append(f"{self.company_name} has {self.current_employees:,} employees")
        
        if self.has_layoffs and self.layoff_count:
            parts.append(
                f"reduced headcount by {self.layoff_count:,} "
                f"({self.layoff_percentage:.1f}%)"
            )
        elif self.year_over_year_change:
            direction = "added" if self.year_over_year_change > 0 else "lost"
            parts.append(
                f"{direction} {abs(self.year_over_year_change):,} employees YoY "
                f"({self.yoy_change_pct:+.1f}%)"
            )
        
        if self.layoff_reason:
            parts.append(f"due to {self.layoff_reason}")
        
        return ". ".join(parts) + "."
    
    def to_dict(self) -> dict:
        return {
            "ticker": self.ticker,
            "company_name": self.company_name,
            "employees": {
                "current": self.current_employees,
                "full_time": self.full_time,
                "part_time": self.part_time,
                "contractors": self.contractors,
                "prior_year": self.prior_year_employees,
                "yoy_change": self.year_over_year_change,
                "yoy_change_pct": self.yoy_change_pct
            },
            "layoffs": {
                "has_layoffs": self.has_layoffs,
                "count": self.layoff_count,
                "percentage": self.layoff_percentage,
                "date": self.layoff_date,
                "reason": self.layoff_reason,
                "affected_divisions": self.affected_divisions,
                "severance_cost_millions": self.severance_cost,
                "severity": self.severity
            },
            "summary": self.summary,
            "metadata": {
                "as_of_date": self.as_of_date,
                "source_filing": self.source_filing,
                "confidence": self.confidence,
                "validation": self.validation.to_dict() if self.validation else None
            }
        }


# ==============================================================================
# Extraction Prompts
# ==============================================================================

EMPLOYEE_EXTRACTION_SYSTEM = """You are extracting employee and workforce data from SEC filings.

Extract ALL of the following if mentioned:
1. Total employee count (current year)
2. Prior year employee count
3. Full-time vs part-time vs contractor breakdown
4. Any layoff or restructuring mentions
5. Number of employees affected by layoffs
6. Reason for headcount changes
7. Severance or restructuring costs
8. Which divisions/segments were affected

Rules:
- Return ONLY valid JSON
- Use null for values not mentioned
- Employee counts should be integers
- Costs in millions USD
- Dates in YYYY-MM-DD format
- Include confidence score (0-1) for each field

Return this JSON structure:
{
    "current_employees": <int or null>,
    "prior_year_employees": <int or null>,
    "full_time": <int or null>,
    "part_time": <int or null>,
    "contractors": <int or null>,
    "has_layoffs": <boolean>,
    "layoff_count": <int or null>,
    "layoff_percentage": <float or null>,
    "layoff_date": "<YYYY-MM-DD or null>",
    "layoff_reason": "<string or null>",
    "affected_divisions": ["<division1>", ...],
    "severance_cost": <float in millions or null>,
    "as_of_date": "<YYYY-MM-DD or null>",
    "confidence": <float 0-1>
}
"""

EMPLOYEE_EXTRACTION_USER = """Extract employee and workforce data from this SEC filing section:

<filing_text>
{text}
</filing_text>

Return ONLY the JSON."""


TARIFF_EXTRACTION_SYSTEM = """You are extracting tariff and trade impact data from SEC filings.

Extract:
1. Any mention of tariffs affecting the company
2. Quantified financial impact if disclosed
3. Which products/regions are affected
4. Management's response or mitigation strategy
5. Supply chain disruptions mentioned

Rules:
- Return ONLY valid JSON
- Use null for values not mentioned
- Financial amounts in millions USD
- Include confidence score (0-1)

Return this JSON structure:
{
    "has_tariff_exposure": <boolean>,
    "tariff_mentions": [
        {
            "description": "<what tariff>",
            "impact_millions": <float or null>,
            "affected_products": ["<product>", ...],
            "affected_regions": ["<region>", ...],
            "mitigation_strategy": "<string or null>",
            "confidence": <float 0-1>
        }
    ],
    "total_estimated_impact_millions": <float or null>,
    "supply_chain_disruption": <boolean>,
    "management_commentary": "<string or null>",
    "confidence": <float 0-1>
}
"""

TARIFF_EXTRACTION_USER = """Extract tariff and trade impact data from this filing section:

<filing_text>
{text}
</filing_text>

Return ONLY the JSON."""


# ==============================================================================
# Extraction Functions
# ==============================================================================

def extract_employees(
    text: str,
    ticker: str,
    company_name: str,
    llm_client: Optional[LLMClient] = None,
    source_filing: Optional[str] = None
) -> EmployeeData:
    """
    Extract employee data from filing text.
    
    Args:
        text: Filing text (typically from Item 1 or 8-K)
        ticker: Company ticker
        company_name: Company name
        llm_client: LLM client (uses mock if None)
        source_filing: Accession number
    
    Returns:
        EmployeeData with extracted info
    """
    if llm_client is None:
        llm_client = MockLLMClient()
        logger.warning("Using mock LLM client")
    
    # Build extraction request
    request = ExtractionRequest(
        text=text,
        schema={},
        system_prompt=EMPLOYEE_EXTRACTION_SYSTEM,
        user_prompt=EMPLOYEE_EXTRACTION_USER
    )
    
    # Extract
    response = llm_client.extract_with_retry(request)
    
    if not response.success:
        logger.error(f"Employee extraction failed: {response.error}")
        return EmployeeData(
            ticker=ticker,
            company_name=company_name,
            confidence=0.0,
            source_filing=source_filing
        )
    
    data = response.data
    
    # Build EmployeeData from extraction
    result = EmployeeData(
        ticker=ticker,
        company_name=company_name,
        current_employees=data.get("current_employees"),
        full_time=data.get("full_time"),
        part_time=data.get("part_time"),
        contractors=data.get("contractors"),
        prior_year_employees=data.get("prior_year_employees"),
        has_layoffs=data.get("has_layoffs", False),
        layoff_count=data.get("layoff_count"),
        layoff_percentage=data.get("layoff_percentage"),
        layoff_date=data.get("layoff_date"),
        layoff_reason=data.get("layoff_reason"),
        affected_divisions=data.get("affected_divisions", []),
        severance_cost=data.get("severance_cost"),
        as_of_date=data.get("as_of_date"),
        source_filing=source_filing,
        confidence=data.get("confidence", 0.0)
    )
    
    # Validate
    result.validation = validate_employees(data)
    
    return result


def extract_tariff_impact(
    text: str,
    ticker: str,
    company_name: str,
    llm_client: Optional[LLMClient] = None
) -> Dict[str, Any]:
    """
    Extract tariff impact data from filing text.
    
    Args:
        text: Filing text (typically from Risk Factors or MD&A)
        ticker: Company ticker
        company_name: Company name
        llm_client: LLM client
    
    Returns:
        Dict with tariff impact data
    """
    if llm_client is None:
        llm_client = MockLLMClient()
    
    request = ExtractionRequest(
        text=text,
        schema={},
        system_prompt=TARIFF_EXTRACTION_SYSTEM,
        user_prompt=TARIFF_EXTRACTION_USER
    )
    
    response = llm_client.extract_with_retry(request)
    
    if not response.success:
        return {"error": response.error, "ticker": ticker}
    
    return {
        "ticker": ticker,
        "company_name": company_name,
        **response.data
    }


# ==============================================================================
# Section Finder
# ==============================================================================

def find_employee_sections(text: str) -> List[str]:
    """
    Find sections of a 10-K that likely contain employee information.
    
    Typical locations:
    - Item 1: Business (employee count)
    - Item 2: Properties (sometimes)
    - Item 7: MD&A (restructuring)
    - Item 8: Financial Statements (restructuring charges)
    """
    import re
    
    sections = []
    
    # Common patterns for employee sections
    patterns = [
        # "Human Capital" section (newer 10-Ks)
        r'(?i)(human\s+capital[\s\S]{0,5000}?(?=item\s+\d|$))',
        # "Employees" subsection
        r'(?i)(employees[\s\S]{0,3000}?(?=\n\s*(?:item|properties|risk)))',
        # Employee count mentions
        r'(?i)(.{0,200}(?:approximately|employed|workforce|headcount|full.?time)\s+[\d,]+.{0,500})',
        # Restructuring mentions
        r'(?i)(restructuring[\s\S]{0,3000}?(?=\n\s*(?:item|note\s+\d)))',
        # Layoff/reduction mentions
        r'(?i)(.{0,200}(?:layoff|reduction.?in.?force|workforce\s+reduction|job\s+cut|severance).{0,1000})',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            if len(match.strip()) > 50:  # Skip very short matches
                sections.append(match.strip()[:5000])  # Cap at 5000 chars
    
    return sections


def find_tariff_sections(text: str) -> List[str]:
    """
    Find sections of a 10-K that discuss tariffs/trade impacts.
    
    Typical locations:
    - Item 1A: Risk Factors
    - Item 7: MD&A
    """
    import re
    
    sections = []
    
    patterns = [
        r'(?i)(.{0,200}tariff.{0,2000})',
        r'(?i)(.{0,200}(?:trade\s+war|trade\s+restriction|import\s+dut).{0,2000})',
        r'(?i)(.{0,200}(?:customs\s+dut|export\s+control|trade\s+polic).{0,2000})',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            if len(match.strip()) > 50:
                sections.append(match.strip()[:5000])
    
    return sections


# ==============================================================================
# Pipeline
# ==============================================================================

def analyze_company_employees(
    filing_text: str,
    ticker: str,
    company_name: str,
    llm_client: Optional[LLMClient] = None,
    source_filing: Optional[str] = None
) -> EmployeeData:
    """
    Full pipeline: find sections -> extract -> validate -> return.
    
    This is the main entry point for employee analysis.
    """
    # Step 1: Find relevant sections
    sections = find_employee_sections(filing_text)
    
    if not sections:
        logger.warning(f"No employee sections found for {ticker}")
        return EmployeeData(
            ticker=ticker,
            company_name=company_name,
            confidence=0.0
        )
    
    # Step 2: Combine sections (take top 3 most relevant)
    combined_text = "\n\n---\n\n".join(sections[:3])
    
    # Step 3: Extract
    result = extract_employees(
        text=combined_text,
        ticker=ticker,
        company_name=company_name,
        llm_client=llm_client,
        source_filing=source_filing
    )
    
    # Step 4: Log result
    if result.has_layoffs:
        logger.info(
            f"🚨 LAYOFF DETECTED: {ticker} ({company_name}) - "
            f"{result.layoff_count:,} employees ({result.severity})"
        )
    else:
        logger.info(
            f"📊 {ticker}: {result.current_employees:,} employees"
            if result.current_employees else f"📊 {ticker}: employee data extracted"
        )
    
    return result


# ==============================================================================
# Test
# ==============================================================================

if __name__ == "__main__":
    print("Testing Employee & Layoff Tracker...\n")
    
    # Simulate Boeing 10-K text (Michelle's example)
    boeing_text = """
    Human Capital Resources
    
    As of December 31, 2024, we employed approximately 150,000 people.
    As of December 31, 2023, we employed approximately 172,000 people.
    
    In January 2024, we announced a reduction in workforce of approximately 
    17,000 positions, or about 10% of our global workforce, as part of our 
    ongoing efforts to align our workforce with our financial and operational 
    priorities. The restructuring primarily affected our Commercial Airplanes 
    and Global Services divisions.
    
    We recorded approximately $1.2 billion in severance and restructuring 
    charges related to these workforce reductions during fiscal year 2024.
    """
    
    # Test section finder
    sections = find_employee_sections(boeing_text)
    print(f"1. Found {len(sections)} employee sections")
    assert len(sections) > 0
    print("   ✓ Section finder works\n")
    
    # Test with mock LLM
    mock_client = MockLLMClient()
    mock_client.add_mock_response("employed approximately", {
        "current_employees": 150000,
        "prior_year_employees": 172000,
        "full_time": None,
        "part_time": None,
        "contractors": None,
        "has_layoffs": True,
        "layoff_count": 17000,
        "layoff_percentage": 9.9,
        "layoff_date": "2024-01-15",
        "layoff_reason": "align workforce with financial and operational priorities",
        "affected_divisions": ["Commercial Airplanes", "Global Services"],
        "severance_cost": 1200,
        "as_of_date": "2024-12-31",
        "confidence": 0.91
    })
    
    # Test extraction
    result = extract_employees(
        text=boeing_text,
        ticker="BA",
        company_name="Boeing Co.",
        llm_client=mock_client,
        source_filing="0000012927-25-000001"
    )
    
    print(f"2. Boeing extraction:")
    print(f"   Employees: {result.current_employees:,}")
    print(f"   Prior Year: {result.prior_year_employees:,}")
    print(f"   YoY Change: {result.year_over_year_change:,} ({result.yoy_change_pct:+.1f}%)")
    print(f"   Has Layoffs: {result.has_layoffs}")
    print(f"   Layoff Count: {result.layoff_count:,}")
    print(f"   Severity: {result.severity}")
    print(f"   Confidence: {result.confidence}")
    print(f"   Summary: {result.summary}")
    
    assert result.current_employees == 150000
    assert result.has_layoffs == True
    assert result.layoff_count == 17000
    assert result.severity == "medium"  # ~10%
    print("   ✓ Extraction correct\n")
    
    # Test validation
    print(f"3. Validation:")
    print(f"   Valid: {result.validation.is_valid}")
    print(f"   Checks: {result.validation.checks_passed}/{result.validation.checks_total}")
    assert result.validation.is_valid
    print("   ✓ Validation passed\n")
    
    # Test serialization
    output = result.to_dict()
    print(f"4. JSON Output:")
    print(json.dumps(output, indent=2)[:500] + "...")
    assert "employees" in output
    assert "layoffs" in output
    print("   ✓ Serialization works\n")
    
    # Test tariff section finder
    tariff_text = """
    Risk Factors
    
    Our operations are subject to various tariffs and trade restrictions.
    The imposition of tariffs on imported steel and aluminum has increased 
    our raw material costs by approximately $340 million in fiscal 2024.
    We have partially mitigated this impact through domestic sourcing and 
    price adjustments.
    """
    
    tariff_sections = find_tariff_sections(tariff_text)
    print(f"5. Found {len(tariff_sections)} tariff sections")
    assert len(tariff_sections) > 0
    print("   ✓ Tariff section finder works\n")
    
    print("=" * 50)
    print("✅ Employee & Layoff Tracker tests passed!")
    print("=" * 50)
    print()
    print("What this does:")
    print("  1. Finds employee sections in 10-K filings")
    print("  2. Extracts headcount, layoffs, severance costs")
    print("  3. Validates data integrity")
    print("  4. Returns structured, verified data")
    print("  5. Calculates severity and generates summaries")
    print()
    print("Ready for real EDGAR data + Anthropic API key.")
