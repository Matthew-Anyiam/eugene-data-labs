"""
Eugene Intelligence - Debt & Covenant Extraction

Uses Claude API to extract structured debt information from SEC filings.
"""

import os
import json
import re
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict
from datetime import date
from anthropic import Anthropic


# Initialize Claude client
client = Anthropic()

MODEL = "claude-sonnet-4-20250514"


# ==========================================
# Data Classes for Extraction Results
# ==========================================

@dataclass
class ExtractedDebtInstrument:
    """Extracted debt instrument data"""
    instrument_name: str
    instrument_type: Optional[str]  # term_loan, revolver, bond, etc.
    seniority: Optional[str]  # senior_secured, senior_unsecured, subordinated
    principal_amount: Optional[float]  # in millions
    outstanding_amount: Optional[float]
    available_amount: Optional[float]  # for revolvers
    currency: str = "USD"
    rate_type: Optional[str] = None  # fixed, floating
    interest_rate: Optional[float] = None  # as decimal
    spread_bps: Optional[int] = None  # basis points
    reference_rate: Optional[str] = None  # SOFR, etc.
    maturity_date: Optional[str] = None  # ISO format
    issue_date: Optional[str] = None
    callable: Optional[bool] = None
    collateral: Optional[str] = None
    guarantors: Optional[str] = None
    source_text: Optional[str] = None
    confidence_score: Optional[float] = None


@dataclass
class ExtractedCovenant:
    """Extracted covenant data"""
    covenant_type: str  # leverage, interest_coverage, etc.
    covenant_name: Optional[str]
    threshold_value: Optional[float]
    threshold_direction: str  # max or min
    current_value: Optional[float]
    measurement_period: Optional[str]
    definition: Optional[str]
    source_text: Optional[str]
    confidence_score: Optional[float]


@dataclass
class ExtractedMaturitySchedule:
    """Extracted maturity schedule"""
    fiscal_year: int
    amount_due: float  # in millions
    breakdown: Optional[Dict[str, float]] = None


@dataclass
class DebtExtractionResult:
    """Complete extraction result"""
    company_ticker: str
    filing_date: str
    period_end_date: Optional[str]
    
    # Aggregate metrics
    total_debt: Optional[float]
    net_debt: Optional[float]
    cash_and_equivalents: Optional[float]
    ebitda: Optional[float]
    interest_expense: Optional[float]
    
    # Detailed extractions
    debt_instruments: List[ExtractedDebtInstrument]
    covenants: List[ExtractedCovenant]
    maturity_schedule: List[ExtractedMaturitySchedule]
    
    # Metadata
    extraction_notes: Optional[str] = None
    raw_response: Optional[str] = None


# ==========================================
# Extraction Prompts
# ==========================================

DEBT_EXTRACTION_PROMPT = """You are a financial analyst expert at extracting debt and credit information from SEC filings.

Analyze the following text from a company's SEC filing and extract ALL debt-related information.

<filing_text>
{filing_text}
</filing_text>

Extract the following information and return it as a JSON object:

1. **debt_instruments**: Array of all debt instruments. For each instrument extract:
   - instrument_name: Full name (e.g., "Senior Secured Term Loan B")
   - instrument_type: One of [term_loan, revolver, senior_note, subordinated_note, bond, convertible, other]
   - seniority: One of [senior_secured, senior_unsecured, subordinated, junior]
   - principal_amount: Original principal in millions USD
   - outstanding_amount: Current outstanding in millions USD
   - available_amount: Available capacity for revolvers in millions USD
   - rate_type: "fixed" or "floating"
   - interest_rate: For fixed rate debt, as decimal (5.5% = 0.055)
   - spread_bps: For floating rate debt, spread in basis points (250 = 2.50%)
   - reference_rate: Reference rate name (SOFR, LIBOR, Prime, etc.)
   - maturity_date: In YYYY-MM-DD format
   - issue_date: In YYYY-MM-DD format if available
   - callable: true/false if the debt is callable
   - collateral: Description of collateral if secured
   - guarantors: Description of guarantors if any
   - source_text: The exact text this was extracted from (brief quote)
   - confidence_score: Your confidence 0-1

2. **covenants**: Array of financial covenants. For each covenant extract:
   - covenant_type: One of [leverage, interest_coverage, fixed_charge, liquidity, net_worth, asset_coverage, capex_limit, other]
   - covenant_name: Full name as stated in filing
   - threshold_value: The limit/requirement (e.g., 4.5 for max 4.5x leverage)
   - threshold_direction: "max" or "min"
   - current_value: Current actual value if disclosed
   - measurement_period: How it's measured (quarterly, trailing_12m, etc.)
   - definition: How the ratio is calculated
   - source_text: Brief quote from source
   - confidence_score: 0-1

3. **maturity_schedule**: Array of scheduled maturities by year:
   - fiscal_year: The year (e.g., 2025)
   - amount_due: Amount maturing in millions USD
   - breakdown: Optional dict mapping instrument types to amounts

4. **aggregate_metrics**:
   - total_debt: Total debt in millions USD
   - net_debt: Net debt (total debt minus cash) in millions USD
   - cash_and_equivalents: Cash in millions USD
   - ebitda: EBITDA if disclosed in millions USD
   - interest_expense: Annual interest expense in millions USD

5. **extraction_notes**: Any important context or caveats about the extraction

Return ONLY valid JSON. Do not include any text before or after the JSON object.

Example response format:
{{
  "debt_instruments": [
    {{
      "instrument_name": "Senior Secured Term Loan B",
      "instrument_type": "term_loan",
      "seniority": "senior_secured",
      "principal_amount": 2000,
      "outstanding_amount": 1850,
      "available_amount": null,
      "rate_type": "floating",
      "interest_rate": null,
      "spread_bps": 275,
      "reference_rate": "SOFR",
      "maturity_date": "2028-06-30",
      "issue_date": "2021-06-30",
      "callable": true,
      "collateral": "Substantially all assets",
      "guarantors": "Domestic subsidiaries",
      "source_text": "The Term Loan B bears interest at SOFR plus 2.75%...",
      "confidence_score": 0.95
    }}
  ],
  "covenants": [
    {{
      "covenant_type": "leverage",
      "covenant_name": "Maximum Consolidated Total Net Leverage Ratio",
      "threshold_value": 4.5,
      "threshold_direction": "max",
      "current_value": 3.2,
      "measurement_period": "trailing_12m",
      "definition": "Consolidated Total Debt to Consolidated EBITDA",
      "source_text": "The Company shall maintain a Consolidated Total Net Leverage Ratio not exceeding 4.50 to 1.00...",
      "confidence_score": 0.9
    }}
  ],
  "maturity_schedule": [
    {{"fiscal_year": 2025, "amount_due": 150, "breakdown": {{"term_loan": 150}}}},
    {{"fiscal_year": 2026, "amount_due": 200, "breakdown": null}}
  ],
  "aggregate_metrics": {{
    "total_debt": 5200,
    "net_debt": 4100,
    "cash_and_equivalents": 1100,
    "ebitda": 1500,
    "interest_expense": 280
  }},
  "extraction_notes": "Company has additional off-balance sheet obligations not included in total debt figures."
}}
"""


# ==========================================
# Extraction Functions
# ==========================================

def extract_debt_from_text(
    filing_text: str,
    company_ticker: str,
    filing_date: str,
    period_end_date: Optional[str] = None
) -> DebtExtractionResult:
    """
    Extract debt information from filing text using Claude.
    
    Args:
        filing_text: The text content of the filing (or relevant section)
        company_ticker: Company ticker symbol
        filing_date: Date of the filing
        period_end_date: Period end date for the filing
    
    Returns:
        DebtExtractionResult with all extracted data
    """
    
    # Truncate if too long (Claude has context limits)
    max_chars = 150000  # ~37.5k tokens
    if len(filing_text) > max_chars:
        filing_text = filing_text[:max_chars]
        filing_text += "\n\n[TEXT TRUNCATED]"
    
    prompt = DEBT_EXTRACTION_PROMPT.format(filing_text=filing_text)
    
    # Call Claude
    response = client.messages.create(
        model=MODEL,
        max_tokens=8000,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    
    raw_response = response.content[0].text
    
    # Parse JSON response
    try:
        # Try to find JSON in the response
        json_match = re.search(r'\{[\s\S]*\}', raw_response)
        if json_match:
            data = json.loads(json_match.group())
        else:
            data = json.loads(raw_response)
    except json.JSONDecodeError as e:
        # If parsing fails, return empty result with error note
        return DebtExtractionResult(
            company_ticker=company_ticker,
            filing_date=filing_date,
            period_end_date=period_end_date,
            total_debt=None,
            net_debt=None,
            cash_and_equivalents=None,
            ebitda=None,
            interest_expense=None,
            debt_instruments=[],
            covenants=[],
            maturity_schedule=[],
            extraction_notes=f"JSON parsing error: {str(e)}",
            raw_response=raw_response
        )
    
    # Parse debt instruments
    debt_instruments = []
    for item in data.get("debt_instruments", []):
        debt_instruments.append(ExtractedDebtInstrument(
            instrument_name=item.get("instrument_name", "Unknown"),
            instrument_type=item.get("instrument_type"),
            seniority=item.get("seniority"),
            principal_amount=item.get("principal_amount"),
            outstanding_amount=item.get("outstanding_amount"),
            available_amount=item.get("available_amount"),
            currency=item.get("currency", "USD"),
            rate_type=item.get("rate_type"),
            interest_rate=item.get("interest_rate"),
            spread_bps=item.get("spread_bps"),
            reference_rate=item.get("reference_rate"),
            maturity_date=item.get("maturity_date"),
            issue_date=item.get("issue_date"),
            callable=item.get("callable"),
            collateral=item.get("collateral"),
            guarantors=item.get("guarantors"),
            source_text=item.get("source_text"),
            confidence_score=item.get("confidence_score")
        ))
    
    # Parse covenants
    covenants = []
    for item in data.get("covenants", []):
        covenants.append(ExtractedCovenant(
            covenant_type=item.get("covenant_type", "other"),
            covenant_name=item.get("covenant_name"),
            threshold_value=item.get("threshold_value"),
            threshold_direction=item.get("threshold_direction", "max"),
            current_value=item.get("current_value"),
            measurement_period=item.get("measurement_period"),
            definition=item.get("definition"),
            source_text=item.get("source_text"),
            confidence_score=item.get("confidence_score")
        ))
    
    # Parse maturity schedule
    maturity_schedule = []
    for item in data.get("maturity_schedule", []):
        maturity_schedule.append(ExtractedMaturitySchedule(
            fiscal_year=item.get("fiscal_year"),
            amount_due=item.get("amount_due"),
            breakdown=item.get("breakdown")
        ))
    
    # Parse aggregate metrics
    metrics = data.get("aggregate_metrics", {})
    
    return DebtExtractionResult(
        company_ticker=company_ticker,
        filing_date=filing_date,
        period_end_date=period_end_date,
        total_debt=metrics.get("total_debt"),
        net_debt=metrics.get("net_debt"),
        cash_and_equivalents=metrics.get("cash_and_equivalents"),
        ebitda=metrics.get("ebitda"),
        interest_expense=metrics.get("interest_expense"),
        debt_instruments=debt_instruments,
        covenants=covenants,
        maturity_schedule=maturity_schedule,
        extraction_notes=data.get("extraction_notes"),
        raw_response=raw_response
    )


def extract_debt_section(full_filing_text: str) -> str:
    """
    Extract just the debt-related sections from a full filing.
    This reduces token usage by focusing on relevant content.
    """
    
    # Sections to look for
    section_patterns = [
        # Note patterns
        r'(?i)(note\s*\d+[\s\-–—\.]*(?:long[- ]?term\s+)?debt[\s\S]{0,30000}?)(?=note\s*\d+[^\d]|item\s*\d|$)',
        r'(?i)(note\s*\d+[\s\-–—\.]*borrowings[\s\S]{0,30000}?)(?=note\s*\d+[^\d]|item\s*\d|$)',
        r'(?i)(note\s*\d+[\s\-–—\.]*credit\s+(?:facilities|agreements?)[\s\S]{0,30000}?)(?=note\s*\d+[^\d]|item\s*\d|$)',
        r'(?i)(note\s*\d+[\s\-–—\.]*financing[\s\S]{0,20000}?)(?=note\s*\d+[^\d]|item\s*\d|$)',
        
        # MD&A patterns
        r'(?i)(liquidity\s+and\s+capital\s+resources[\s\S]{0,40000}?)(?=item\s*\d|critical\s+accounting|$)',
        
        # Specific mentions
        r'(?i)(credit\s+agreement[\s\S]{0,15000}?)(?=\n\n[A-Z]|\Z)',
        r'(?i)(term\s+loan[\s\S]{0,10000}?)(?=\n\n[A-Z]|\Z)',
        r'(?i)(senior\s+notes[\s\S]{0,10000}?)(?=\n\n[A-Z]|\Z)',
    ]
    
    extracted_sections = []
    
    for pattern in section_patterns:
        matches = re.findall(pattern, full_filing_text)
        for match in matches:
            if len(match) > 500:  # Only keep substantial matches
                extracted_sections.append(match)
    
    if not extracted_sections:
        # Fallback: return first 100k characters
        return full_filing_text[:100000]
    
    # Deduplicate and combine
    combined = "\n\n---\n\n".join(extracted_sections)
    
    # Limit total size
    if len(combined) > 200000:
        combined = combined[:200000]
    
    return combined


def result_to_dict(result: DebtExtractionResult) -> Dict[str, Any]:
    """Convert extraction result to dictionary for JSON serialization"""
    base_dict = {
        "company_ticker": result.company_ticker,
        "filing_date": result.filing_date,
        "period_end_date": result.period_end_date,
        "total_debt": result.total_debt,
        "net_debt": result.net_debt,
        "cash_and_equivalents": result.cash_and_equivalents,
        "ebitda": result.ebitda,
        "interest_expense": result.interest_expense,
        "debt_instruments": [asdict(d) for d in result.debt_instruments],
        "covenants": [asdict(c) for c in result.covenants],
        "maturity_schedule": [asdict(m) for m in result.maturity_schedule],
        "extraction_notes": result.extraction_notes
    }
    
    # Add aggregate_metrics for validation compatibility
    base_dict["aggregate_metrics"] = {
        "total_debt": result.total_debt,
        "net_debt": result.net_debt,
        "cash_and_equivalents": result.cash_and_equivalents,
        "ebitda": result.ebitda,
        "interest_expense": result.interest_expense
    }
    
    return base_dict


def extract_and_validate(
    filing_text: str,
    company_ticker: str,
    filing_date: str,
    period_end_date: Optional[str] = None,
    min_confidence: float = 0.85
) -> Tuple[DebtExtractionResult, Dict[str, Any]]:
    """
    Extract debt data and validate quality.
    
    Returns:
        Tuple of (extraction_result, quality_report)
        
    The quality_report includes:
        - overall_confidence: float
        - should_serve: bool
        - needs_review: bool
        - validation_errors: list
        - validation_warnings: list
    """
    # Import validation module
    from extraction.validation import validate_extraction, ExtractionQuality
    
    # Run extraction
    result = extract_debt_from_text(
        filing_text=filing_text,
        company_ticker=company_ticker,
        filing_date=filing_date,
        period_end_date=period_end_date
    )
    
    # Validate
    result_dict = result_to_dict(result)
    quality = validate_extraction(result_dict)
    
    quality_report = {
        "overall_confidence": quality.overall_confidence,
        "should_serve": quality.should_serve,
        "needs_review": quality.needs_review,
        "validation_errors": quality.validation_errors,
        "validation_warnings": quality.validation_warnings,
        "flags": [f.value for f in quality.flags],
        "meets_threshold": quality.overall_confidence >= min_confidence
    }
    
    return result, quality_report


# ==========================================
# Testing
# ==========================================

if __name__ == "__main__":
    # Test with a sample debt disclosure
    sample_text = """
    NOTE 8 - DEBT
    
    Long-term debt consists of the following (in millions):
    
                                        December 31, 2024    December 31, 2023
    Senior Secured Term Loan B              $1,850              $1,900
    Senior Notes due 2029 (5.50%)           $1,000              $1,000
    Senior Notes due 2031 (4.75%)           $750                $750
    Revolving Credit Facility               $200                $0
    Total debt                              $3,800              $3,650
    Less: Current portion                   ($150)              ($100)
    Long-term debt                          $3,650              $3,550
    
    Senior Secured Credit Facilities
    
    The Company maintains a senior secured credit facility consisting of:
    - A $2,000 million Term Loan B maturing June 30, 2028, bearing interest at SOFR plus 2.75%
    - A $500 million revolving credit facility maturing June 30, 2027, bearing interest at SOFR plus 2.25%
    
    As of December 31, 2024, $200 million was drawn on the revolving credit facility, 
    with $300 million available.
    
    The credit agreement contains financial covenants including:
    - Maximum Consolidated Total Net Leverage Ratio of 4.50 to 1.00
    - Minimum Interest Coverage Ratio of 3.00 to 1.00
    
    As of December 31, 2024, the Company was in compliance with all covenants. 
    The Consolidated Total Net Leverage Ratio was 3.2x and the Interest Coverage Ratio was 5.5x.
    
    Scheduled Maturities
    
    Scheduled maturities of long-term debt are as follows (in millions):
    
    2025: $150
    2026: $200
    2027: $350 (includes revolver maturity)
    2028: $1,600
    2029: $1,000
    2030 and thereafter: $750
    """
    
    print("Testing debt extraction...")
    print("-" * 50)
    
    result = extract_debt_from_text(
        filing_text=sample_text,
        company_ticker="TEST",
        filing_date="2025-01-15",
        period_end_date="2024-12-31"
    )
    
    print(f"Total Debt: ${result.total_debt}M")
    print(f"Net Debt: ${result.net_debt}M")
    print()
    
    print("Debt Instruments:")
    for inst in result.debt_instruments:
        print(f"  - {inst.instrument_name}: ${inst.outstanding_amount}M")
        if inst.maturity_date:
            print(f"    Maturity: {inst.maturity_date}")
        if inst.spread_bps:
            print(f"    Rate: {inst.reference_rate} + {inst.spread_bps}bps")
    print()
    
    print("Covenants:")
    for cov in result.covenants:
        status = "✓" if cov.current_value and cov.threshold_value and \
                       ((cov.threshold_direction == "max" and cov.current_value < cov.threshold_value) or
                        (cov.threshold_direction == "min" and cov.current_value > cov.threshold_value)) else "?"
        print(f"  {status} {cov.covenant_name}: {cov.current_value}x (limit: {cov.threshold_direction} {cov.threshold_value}x)")
    print()
    
    print("Maturity Schedule:")
    for mat in result.maturity_schedule:
        print(f"  {mat.fiscal_year}: ${mat.amount_due}M")
