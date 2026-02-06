"""
Eugene Data Labs - Schedule 13G Parser

Parses Schedule 13G filings for passive large ownership (>5%).

13G vs 13D:
- 13G = Passive investor, no intent to influence
- 13D = Active investor, may seek control

Why it matters:
- Large passive holders (Vanguard, BlackRock) signal institutional confidence
- Conversion from 13G to 13D = investor turning activist
- Sudden 13G filings = accumulation by major funds
"""

from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
import re


class FilerType(Enum):
    """Types of 13G filers"""
    INSTITUTIONAL = "Institutional Investment Manager"
    PASSIVE = "Passive Investor"
    EXEMPT = "Exempt Investor"
    QUALIFIED = "Qualified Institutional Buyer"
    UNKNOWN = "Unknown"


@dataclass
class Schedule13GFiling:
    """Extracted data from Schedule 13G"""
    # Filing info
    ticker: str
    company_name: str
    company_cik: str
    filed_date: str
    event_date: str  # Date of event triggering filing
    accession_number: str
    
    # Filer info
    filer_name: str
    filer_type: str
    filer_address: str
    
    # Ownership details
    shares_owned: int
    percent_of_class: float
    share_class: str  # Common, Preferred, etc.
    sole_voting_power: int
    shared_voting_power: int
    sole_dispositive_power: int
    shared_dispositive_power: int
    
    # Change info
    is_amendment: bool
    previous_percent: Optional[float]
    change_percent: Optional[float]
    
    # Analysis
    filing_url: str
    extraction_timestamp: str
    confidence: float


@dataclass 
class OwnershipChange:
    """Tracks ownership changes over time"""
    ticker: str
    filer_name: str
    date: str
    old_percent: float
    new_percent: float
    change: float
    signal: str  # "accumulating", "reducing", "new_position", "exited"


# Major institutional investors (for identification)
MAJOR_INSTITUTIONS = [
    "blackrock",
    "vanguard", 
    "state street",
    "fidelity",
    "capital group",
    "t. rowe price",
    "wellington",
    "geode capital",
    "northern trust",
    "jp morgan",
    "morgan stanley",
    "goldman sachs",
    "citadel",
    "renaissance",
    "two sigma",
    "bridgewater",
    "aqr capital",
    "millennium",
    "point72",
    "elliott"
]


def identify_filer_type(filer_name: str) -> str:
    """Identify what type of filer this is"""
    name_lower = filer_name.lower()
    
    # Check for major institutions
    for inst in MAJOR_INSTITUTIONS:
        if inst in name_lower:
            return FilerType.INSTITUTIONAL.value
    
    # Check for common patterns
    if any(x in name_lower for x in ["llc", "lp", "partners", "capital", "management", "advisors"]):
        return FilerType.INSTITUTIONAL.value
    
    if any(x in name_lower for x in ["trust", "pension", "retirement"]):
        return FilerType.QUALIFIED.value
    
    return FilerType.PASSIVE.value


def parse_shares(text: str) -> int:
    """Extract share count from text"""
    # Remove commas and find numbers
    text = text.replace(",", "")
    
    # Look for patterns like "1234567 shares" or just numbers
    match = re.search(r'(\d+)\s*(?:shares)?', text, re.IGNORECASE)
    if match:
        return int(match.group(1))
    
    return 0


def parse_percent(text: str) -> float:
    """Extract percentage from text"""
    # Look for patterns like "5.2%" or "5.2 percent"
    match = re.search(r'(\d+\.?\d*)\s*%', text)
    if match:
        return float(match.group(1))
    
    match = re.search(r'(\d+\.?\d*)\s*percent', text, re.IGNORECASE)
    if match:
        return float(match.group(1))
    
    return 0.0


def extract_voting_power(raw_text: str) -> Dict[str, int]:
    """Extract voting and dispositive power numbers"""
    result = {
        "sole_voting": 0,
        "shared_voting": 0,
        "sole_dispositive": 0,
        "shared_dispositive": 0
    }
    
    text_lower = raw_text.lower()
    
    # Patterns for voting power
    sole_voting_match = re.search(r'sole voting power[:\s]+(\d[\d,]*)', text_lower)
    if sole_voting_match:
        result["sole_voting"] = int(sole_voting_match.group(1).replace(",", ""))
    
    shared_voting_match = re.search(r'shared voting power[:\s]+(\d[\d,]*)', text_lower)
    if shared_voting_match:
        result["shared_voting"] = int(shared_voting_match.group(1).replace(",", ""))
    
    sole_disp_match = re.search(r'sole dispositive power[:\s]+(\d[\d,]*)', text_lower)
    if sole_disp_match:
        result["sole_dispositive"] = int(sole_disp_match.group(1).replace(",", ""))
    
    shared_disp_match = re.search(r'shared dispositive power[:\s]+(\d[\d,]*)', text_lower)
    if shared_disp_match:
        result["shared_dispositive"] = int(shared_disp_match.group(1).replace(",", ""))
    
    return result


def detect_amendment(raw_text: str) -> bool:
    """Check if this is an amendment to a previous filing"""
    text_lower = raw_text.lower()
    return "amendment" in text_lower or "/a" in text_lower


def parse_13g(
    raw_text: str,
    ticker: str,
    company_name: str,
    company_cik: str,
    filed_date: str,
    accession_number: str,
    filer_name: str = "",
    previous_percent: Optional[float] = None
) -> Schedule13GFiling:
    """
    Main function to parse a Schedule 13G filing.
    
    Args:
        raw_text: Full text of the 13G filing
        ticker: Company ticker
        company_name: Company name
        company_cik: Company CIK
        filed_date: Filing date
        accession_number: SEC accession number
        filer_name: Name of filer (if known)
        previous_percent: Previous ownership percent (for tracking changes)
    
    Returns:
        Schedule13GFiling with extracted data
    """
    text_lower = raw_text.lower()
    
    # Extract filer name if not provided
    if not filer_name:
        # Look for "Name of Reporting Person" pattern
        name_match = re.search(r'name of reporting person[:\s]+([^\n]+)', text_lower)
        if name_match:
            filer_name = name_match.group(1).strip().title()
        else:
            filer_name = "Unknown Filer"
    
    # Identify filer type
    filer_type = identify_filer_type(filer_name)
    
    # Extract address
    address_match = re.search(r'address[:\s]+([^\n]+(?:\n[^\n]+)?)', text_lower)
    filer_address = address_match.group(1).strip() if address_match else ""
    
    # Extract shares owned
    shares_match = re.search(r'aggregate amount[^:]*[:\s]+(\d[\d,]*)', text_lower)
    shares_owned = int(shares_match.group(1).replace(",", "")) if shares_match else 0
    
    # Extract percent of class
    percent_match = re.search(r'percent of class[:\s]+(\d+\.?\d*)', text_lower)
    percent_of_class = float(percent_match.group(1)) if percent_match else 0.0
    
    # Alternative percent pattern
    if percent_of_class == 0:
        percent_of_class = parse_percent(raw_text)
    
    # Extract share class
    class_match = re.search(r'class of securities[:\s]+([^\n]+)', text_lower)
    share_class = class_match.group(1).strip().title() if class_match else "Common Stock"
    
    # Extract voting/dispositive power
    power = extract_voting_power(raw_text)
    
    # Check if amendment
    is_amendment = detect_amendment(raw_text)
    
    # Calculate change if previous data available
    change_percent = None
    if previous_percent is not None:
        change_percent = percent_of_class - previous_percent
    
    # Event date (often same as filed date for 13G)
    event_match = re.search(r'date of event[:\s]+([^\n]+)', text_lower)
    event_date = event_match.group(1).strip() if event_match else filed_date
    
    # Build filing URL
    filing_url = f"https://www.sec.gov/Archives/edgar/data/{company_cik}/{accession_number.replace('-', '')}"
    
    return Schedule13GFiling(
        ticker=ticker,
        company_name=company_name,
        company_cik=company_cik,
        filed_date=filed_date,
        event_date=event_date,
        accession_number=accession_number,
        filer_name=filer_name,
        filer_type=filer_type,
        filer_address=filer_address,
        shares_owned=shares_owned,
        percent_of_class=percent_of_class,
        share_class=share_class,
        sole_voting_power=power["sole_voting"],
        shared_voting_power=power["shared_voting"],
        sole_dispositive_power=power["sole_dispositive"],
        shared_dispositive_power=power["shared_dispositive"],
        is_amendment=is_amendment,
        previous_percent=previous_percent,
        change_percent=change_percent,
        filing_url=filing_url,
        extraction_timestamp=datetime.now().isoformat(),
        confidence=0.85
    )


def analyze_ownership_signal(filing: Schedule13GFiling) -> str:
    """Analyze what this filing signals"""
    
    # New position
    if not filing.is_amendment and filing.previous_percent is None:
        if filing.percent_of_class >= 10:
            return "MAJOR_NEW_POSITION"
        return "NEW_POSITION"
    
    # Check for changes
    if filing.change_percent is not None:
        if filing.change_percent > 2:
            return "SIGNIFICANT_ACCUMULATION"
        elif filing.change_percent > 0:
            return "ACCUMULATING"
        elif filing.change_percent < -2:
            return "SIGNIFICANT_REDUCTION"
        elif filing.change_percent < 0:
            return "REDUCING"
    
    return "MAINTAINING"


def format_13g_markdown(filing: Schedule13GFiling) -> str:
    """Format 13G filing as markdown for agents"""
    
    signal = analyze_ownership_signal(filing)
    
    # Signal emoji
    signal_emoji = {
        "MAJOR_NEW_POSITION": "🚨",
        "NEW_POSITION": "📥",
        "SIGNIFICANT_ACCUMULATION": "📈",
        "ACCUMULATING": "↗️",
        "MAINTAINING": "➖",
        "REDUCING": "↘️",
        "SIGNIFICANT_REDUCTION": "📉"
    }.get(signal, "📋")
    
    md = f"""# Schedule 13G: {filing.company_name} ({filing.ticker})

## {signal_emoji} {signal.replace("_", " ").title()}

**Filed:** {filing.filed_date}
**Filer:** {filing.filer_name}
**Type:** {filing.filer_type}

---

## Ownership Details

| Metric | Value |
|--------|-------|
| Shares Owned | {filing.shares_owned:,} |
| Percent of Class | {filing.percent_of_class:.2f}% |
| Share Class | {filing.share_class} |
"""

    if filing.change_percent is not None:
        direction = "📈" if filing.change_percent > 0 else "📉" if filing.change_percent < 0 else "➖"
        md += f"| Change | {direction} {filing.change_percent:+.2f}% |\n"

    md += f"""
## Voting Power

| Type | Shares |
|------|--------|
| Sole Voting | {filing.sole_voting_power:,} |
| Shared Voting | {filing.shared_voting_power:,} |
| Sole Dispositive | {filing.sole_dispositive_power:,} |
| Shared Dispositive | {filing.shared_dispositive_power:,} |

---

## Filing Info

- **Amendment:** {"Yes" if filing.is_amendment else "No"}
- **Accession Number:** {filing.accession_number}
- **SEC URL:** {filing.filing_url}
- **Extracted:** {filing.extraction_timestamp}
"""
    
    return md


def compare_to_13d(g_filing: Schedule13GFiling) -> str:
    """
    Generate insight comparing passive (13G) vs active (13D) ownership.
    
    If someone switches from 13G to 13D, they're signaling activist intent.
    """
    insight = f"""
## 13G vs 13D Context

**{g_filing.filer_name}** filed a **Schedule 13G** (passive ownership).

This means:
- They own >{g_filing.percent_of_class:.1f}% but have **no activist intent**
- They are a passive, long-term holder
- Common for index funds, pension funds

⚠️ **Watch for:** If they later file a **13D**, it signals:
- Change to activist stance
- Potential push for board seats, M&A, or strategy changes
"""
    return insight


# For testing
if __name__ == "__main__":
    # Sample 13G text
    sample_13g = """
    UNITED STATES SECURITIES AND EXCHANGE COMMISSION
    Washington, D.C. 20549
    
    SCHEDULE 13G
    Under the Securities Exchange Act of 1934
    (Amendment No. 2)
    
    Tesla, Inc.
    (Name of Issuer)
    
    Common Stock
    (Title of Class of Securities)
    
    88160R101
    (CUSIP Number)
    
    December 31, 2024
    (Date of Event Which Requires Filing)
    
    Name of Reporting Person: The Vanguard Group
    
    Address: 100 Vanguard Blvd, Malvern, PA 19355
    
    Aggregate Amount Beneficially Owned: 78,432,981
    
    Percent of Class: 7.2%
    
    Sole Voting Power: 0
    Shared Voting Power: 1,234,567
    Sole Dispositive Power: 75,432,981
    Shared Dispositive Power: 3,000,000
    
    Type of Reporting Person: IA
    """
    
    result = parse_13g(
        raw_text=sample_13g,
        ticker="TSLA",
        company_name="Tesla, Inc.",
        company_cik="1318605",
        filed_date="2025-01-15",
        accession_number="0001318605-25-000123",
        previous_percent=6.8  # Previous filing was 6.8%
    )
    
    print(format_13g_markdown(result))
    print(compare_to_13d(result))