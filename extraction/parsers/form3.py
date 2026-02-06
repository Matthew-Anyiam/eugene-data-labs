"""
Eugene Data Labs - Form 3 Parser

Parses Form 3 filings - Initial Statement of Beneficial Ownership.

Form 3 is filed when someone becomes an insider:
- New officer or director
- 10%+ beneficial owner

Why it matters:
- Signals new leadership
- Shows initial holdings of new insiders
- Baseline for tracking future Form 4 trades
"""

from dataclasses import dataclass
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum
import re


class InsiderRole(Enum):
    """Types of insider roles"""
    DIRECTOR = "Director"
    OFFICER = "Officer"
    TEN_PERCENT_OWNER = "10% Owner"
    OTHER = "Other"


@dataclass
class SecurityHolding:
    """A single security holding"""
    security_title: str
    shares_owned: int
    ownership_nature: str  # Direct (D) or Indirect (I)
    indirect_explanation: str  # If indirect, explain (e.g., "By Trust")


@dataclass
class Form3Filing:
    """Extracted data from Form 3"""
    # Filing info
    ticker: str
    company_name: str
    company_cik: str
    filed_date: str
    accession_number: str
    
    # Insider info
    insider_name: str
    insider_address: str
    insider_roles: List[str]
    date_became_insider: str
    
    # Holdings
    holdings: List[SecurityHolding]
    total_shares: int
    has_derivatives: bool
    
    # Analysis
    filing_url: str
    extraction_timestamp: str
    confidence: float


def parse_roles(raw_text: str) -> List[str]:
    """Extract insider roles from filing"""
    roles = []
    text_lower = raw_text.lower()
    
    if "director" in text_lower:
        roles.append(InsiderRole.DIRECTOR.value)
    if "officer" in text_lower:
        # Try to get specific title
        officer_match = re.search(r'(chief\s+\w+\s+officer|ceo|cfo|coo|cto|president|vp|vice president)', text_lower)
        if officer_match:
            roles.append(officer_match.group(1).upper())
        else:
            roles.append(InsiderRole.OFFICER.value)
    if "10%" in text_lower or "ten percent" in text_lower:
        roles.append(InsiderRole.TEN_PERCENT_OWNER.value)
    
    if not roles:
        roles.append(InsiderRole.OTHER.value)
    
    return roles


def parse_holdings(raw_text: str) -> List[SecurityHolding]:
    """Extract security holdings from filing"""
    holdings = []
    
    # Pattern for common stock
    stock_pattern = re.search(
        r'common stock[:\s]*(\d[\d,]*)\s*shares?',
        raw_text,
        re.IGNORECASE
    )
    
    if stock_pattern:
        shares = int(stock_pattern.group(1).replace(",", ""))
        holdings.append(SecurityHolding(
            security_title="Common Stock",
            shares_owned=shares,
            ownership_nature="Direct",
            indirect_explanation=""
        ))
    
    # Pattern for any shares mentioned
    shares_pattern = re.findall(
        r'(\d[\d,]*)\s*shares?\s+of\s+([^,\n]+)',
        raw_text,
        re.IGNORECASE
    )
    
    for shares_str, security in shares_pattern:
        shares = int(shares_str.replace(",", ""))
        if not any(h.shares_owned == shares for h in holdings):
            holdings.append(SecurityHolding(
                security_title=security.strip().title(),
                shares_owned=shares,
                ownership_nature="Direct",
                indirect_explanation=""
            ))
    
    # Check for indirect ownership
    if "indirect" in raw_text.lower():
        for holding in holdings:
            if "trust" in raw_text.lower():
                holding.ownership_nature = "Indirect"
                holding.indirect_explanation = "By Trust"
            elif "spouse" in raw_text.lower():
                holding.ownership_nature = "Indirect"
                holding.indirect_explanation = "By Spouse"
    
    return holdings


def parse_form3(
    raw_text: str,
    ticker: str,
    company_name: str,
    company_cik: str,
    filed_date: str,
    accession_number: str,
    insider_name: str = ""
) -> Form3Filing:
    """
    Main function to parse a Form 3 filing.
    
    Args:
        raw_text: Full text of Form 3
        ticker: Company ticker
        company_name: Company name
        company_cik: Company CIK
        filed_date: Filing date
        accession_number: SEC accession number
        insider_name: Name of insider (if known)
    
    Returns:
        Form3Filing with extracted data
    """
    text_lower = raw_text.lower()
    
    # Extract insider name if not provided
    if not insider_name:
        name_match = re.search(
            r'name of reporting person[:\s]*([^\n]+)',
            text_lower
        )
        if name_match:
            insider_name = name_match.group(1).strip().title()
        else:
            insider_name = "Unknown Insider"
    
    # Extract address
    address_match = re.search(
        r'address[:\s]*([^\n]+(?:\n[^\n]+)?)',
        text_lower
    )
    insider_address = address_match.group(1).strip() if address_match else ""
    
    # Extract roles
    roles = parse_roles(raw_text)
    
    # Extract date became insider
    date_match = re.search(
        r'date of event[:\s]*([^\n]+)',
        text_lower
    )
    date_became_insider = date_match.group(1).strip() if date_match else filed_date
    
    # Extract holdings
    holdings = parse_holdings(raw_text)
    
    # Calculate total shares
    total_shares = sum(h.shares_owned for h in holdings)
    
    # Check for derivatives
    has_derivatives = any(
        word in text_lower 
        for word in ["option", "warrant", "convertible", "derivative"]
    )
    
    # Build filing URL
    filing_url = f"https://www.sec.gov/Archives/edgar/data/{company_cik}/{accession_number.replace('-', '')}"
    
    return Form3Filing(
        ticker=ticker,
        company_name=company_name,
        company_cik=company_cik,
        filed_date=filed_date,
        accession_number=accession_number,
        insider_name=insider_name,
        insider_address=insider_address,
        insider_roles=roles,
        date_became_insider=date_became_insider,
        holdings=holdings,
        total_shares=total_shares,
        has_derivatives=has_derivatives,
        filing_url=filing_url,
        extraction_timestamp=datetime.now().isoformat(),
        confidence=0.85
    )


def format_form3_markdown(filing: Form3Filing) -> str:
    """Format Form 3 as markdown for agents"""
    
    roles_str = ", ".join(filing.insider_roles)
    
    md = f"""# Form 3: New Insider - {filing.company_name} ({filing.ticker})

## 🆕 {filing.insider_name}

**Roles:** {roles_str}
**Date Became Insider:** {filing.date_became_insider}
**Filed:** {filing.filed_date}

---

## Initial Holdings

| Security | Shares | Ownership |
|----------|--------|-----------|
"""
    
    for holding in filing.holdings:
        ownership = holding.ownership_nature
        if holding.indirect_explanation:
            ownership += f" ({holding.indirect_explanation})"
        md += f"| {holding.security_title} | {holding.shares_owned:,} | {ownership} |\n"
    
    md += f"""
**Total Shares:** {filing.total_shares:,}
**Has Derivatives:** {"Yes" if filing.has_derivatives else "No"}

---

## Why This Matters

- New insider at {filing.company_name}
- Baseline for tracking future trades (Form 4)
- Role: {roles_str}

---

## Filing Info

- **Accession Number:** {filing.accession_number}
- **SEC URL:** {filing.filing_url}
- **Extracted:** {filing.extraction_timestamp}
"""
    
    return md


# For testing
if __name__ == "__main__":
    sample_form3 = """
    UNITED STATES SECURITIES AND EXCHANGE COMMISSION
    Washington, D.C. 20549
    
    FORM 3
    INITIAL STATEMENT OF BENEFICIAL OWNERSHIP OF SECURITIES
    
    Tesla, Inc.
    (Name of Issuer)
    
    Name of Reporting Person: Jane Smith
    
    Address: 123 Tech Drive, Austin, TX 78701
    
    Relationship of Reporting Person to Issuer:
    Director
    Officer (Chief Financial Officer)
    
    Date of Event Requiring Statement: January 15, 2025
    
    Table I - Non-Derivative Securities Beneficially Owned
    
    Common Stock: 50,000 shares
    
    Nature of Ownership: Direct
    """
    
    result = parse_form3(
        raw_text=sample_form3,
        ticker="TSLA",
        company_name="Tesla, Inc.",
        company_cik="1318605",
        filed_date="2025-01-17",
        accession_number="0001318605-25-000200"
    )
    
    print(format_form3_markdown(result))