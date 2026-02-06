"""
Eugene Intelligence - 13D/13G Parser (Beneficial Ownership)

Parses SEC Schedule 13D and 13G filings for beneficial ownership.

- 13D: Filed when someone acquires >5% of a company with intent to influence
- 13G: Filed for passive investors acquiring >5% (less detailed)

These filings signal activist investors, takeover attempts, and large stakes.
"""

import re
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import List, Dict, Optional, Any
from bs4 import BeautifulSoup
import logging

logger = logging.getLogger(__name__)


@dataclass
class BeneficialOwner:
    """A beneficial owner from 13D/13G"""
    name: str
    address: Optional[str] = None
    citizenship: Optional[str] = None
    

@dataclass
class Schedule13Filing:
    """Parsed 13D or 13G filing"""
    accession_number: str
    form_type: str  # "13D", "13D/A", "13G", "13G/A"
    filed_date: date
    event_date: Optional[date]  # Date of event requiring filing
    
    # Subject company
    company_name: str
    company_cusip: str
    company_cik: Optional[str] = None
    
    # Filing party
    filer_name: str
    filer_cik: Optional[str] = None
    
    # Ownership details
    shares_beneficially_owned: int = 0
    percent_of_class: float = 0.0
    sole_voting_power: int = 0
    shared_voting_power: int = 0
    sole_dispositive_power: int = 0
    shared_dispositive_power: int = 0
    
    # Additional info
    type_of_reporting_person: Optional[str] = None  # IA, BD, BK, CO, etc.
    item_4_purpose: Optional[str] = None  # Purpose of transaction (13D only)
    
    @property
    def is_activist(self) -> bool:
        """13D filers typically have activist intent"""
        return "13D" in self.form_type
    
    @property
    def is_amendment(self) -> bool:
        return "/A" in self.form_type
    
    def to_dict(self) -> Dict:
        return {
            "accession_number": self.accession_number,
            "form_type": self.form_type,
            "filed_date": self.filed_date.isoformat(),
            "event_date": self.event_date.isoformat() if self.event_date else None,
            "company": {
                "name": self.company_name,
                "cusip": self.company_cusip,
                "cik": self.company_cik
            },
            "filer": {
                "name": self.filer_name,
                "cik": self.filer_cik,
                "type": self.type_of_reporting_person
            },
            "ownership": {
                "shares": self.shares_beneficially_owned,
                "percent": self.percent_of_class,
                "voting_power": {
                    "sole": self.sole_voting_power,
                    "shared": self.shared_voting_power
                },
                "dispositive_power": {
                    "sole": self.sole_dispositive_power,
                    "shared": self.shared_dispositive_power
                }
            },
            "is_activist": self.is_activist,
            "purpose": self.item_4_purpose
        }


def parse_13d_13g(html_content: str, accession_number: str = "", 
                  form_type: str = "13D", filed_date: date = None) -> Schedule13Filing:
    """
    Parse a 13D or 13G filing.
    
    These filings are HTML/text, not structured XML, so we need to 
    extract data using patterns and heuristics.
    
    Args:
        html_content: Raw HTML/text content
        accession_number: SEC accession number
        form_type: "13D", "13D/A", "13G", or "13G/A"
        filed_date: Filing date
    
    Returns:
        Parsed Schedule13Filing
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    text = soup.get_text(separator='\n')
    
    # Extract company info
    company_name = _extract_company_name(text)
    company_cusip = _extract_cusip(text)
    
    # Extract filer info
    filer_name = _extract_filer_name(text)
    
    # Extract ownership numbers
    shares = _extract_shares(text)
    percent = _extract_percent(text)
    
    # Extract voting/dispositive power
    sole_voting = _extract_number_after_pattern(text, r"sole.*voting.*power[:\s]*(\d[\d,]*)")
    shared_voting = _extract_number_after_pattern(text, r"shared.*voting.*power[:\s]*(\d[\d,]*)")
    sole_disp = _extract_number_after_pattern(text, r"sole.*dispositive.*power[:\s]*(\d[\d,]*)")
    shared_disp = _extract_number_after_pattern(text, r"shared.*dispositive.*power[:\s]*(\d[\d,]*)")
    
    # Extract purpose (Item 4 for 13D)
    purpose = None
    if "13D" in form_type:
        purpose = _extract_purpose(text)
    
    # Extract type of reporting person
    reporting_type = _extract_reporting_type(text)
    
    # Event date
    event_date = _extract_event_date(text)
    
    return Schedule13Filing(
        accession_number=accession_number,
        form_type=form_type,
        filed_date=filed_date or date.today(),
        event_date=event_date,
        company_name=company_name,
        company_cusip=company_cusip,
        filer_name=filer_name,
        shares_beneficially_owned=shares,
        percent_of_class=percent,
        sole_voting_power=sole_voting,
        shared_voting_power=shared_voting,
        sole_dispositive_power=sole_disp,
        shared_dispositive_power=shared_disp,
        type_of_reporting_person=reporting_type,
        item_4_purpose=purpose
    )


def _extract_company_name(text: str) -> str:
    """Extract subject company name"""
    patterns = [
        r"name of issuer[:\s]+([^\n]+)",
        r"subject company[:\s]+([^\n]+)",
        r"item 1[^\n]*\n+([^\n]+)",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            name = match.group(1).strip()
            # Clean up
            name = re.sub(r'\(.*\)', '', name).strip()
            if len(name) > 3:
                return name
    
    return "Unknown"


def _extract_cusip(text: str) -> str:
    """Extract CUSIP number"""
    patterns = [
        r"cusip[^\d]*(\d{6,9}[A-Z0-9]*)",
        r"cusip number[:\s]+([A-Z0-9]{6,9})",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    
    return ""


def _extract_filer_name(text: str) -> str:
    """Extract filing party name"""
    patterns = [
        r"name of person[s]? filing[:\s]+([^\n]+)",
        r"reporting person[:\s]+([^\n]+)",
        r"filed by[:\s]+([^\n]+)",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            name = match.group(1).strip()
            if len(name) > 3:
                return name
    
    return "Unknown"


def _extract_shares(text: str) -> int:
    """Extract number of shares beneficially owned"""
    patterns = [
        r"aggregate.*number.*shares[:\s]*([\d,]+)",
        r"shares.*beneficially.*owned[:\s]*([\d,]+)",
        r"(\d[\d,]+)\s*shares",
        r"item 5[^\n]*\n[^\d]*([\d,]+)",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            num_str = match.group(1).replace(',', '')
            try:
                num = int(num_str)
                if num > 1000:  # Sanity check
                    return num
            except:
                continue
    
    return 0


def _extract_percent(text: str) -> float:
    """Extract percent of class"""
    patterns = [
        r"percent of class[:\s]*([\d.]+)\s*%",
        r"([\d.]+)\s*%\s*of.*class",
        r"([\d.]+)%",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                pct = float(match.group(1))
                if 0 < pct <= 100:
                    return pct
            except:
                continue
    
    return 0.0


def _extract_number_after_pattern(text: str, pattern: str) -> int:
    """Extract number matching a pattern"""
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        try:
            return int(match.group(1).replace(',', ''))
        except:
            pass
    return 0


def _extract_purpose(text: str) -> Optional[str]:
    """Extract purpose from Item 4 (13D only)"""
    # Find Item 4 section
    match = re.search(
        r"item\s*4[.\s:]+purpose.*?(?=item\s*5|\Z)",
        text, 
        re.IGNORECASE | re.DOTALL
    )
    
    if match:
        purpose_text = match.group(0)
        # Clean up
        purpose_text = re.sub(r'item\s*4[.\s:]+purpose[^\n]*\n*', '', purpose_text, flags=re.IGNORECASE)
        purpose_text = purpose_text.strip()[:500]  # Limit length
        
        if len(purpose_text) > 20:
            return purpose_text
    
    return None


def _extract_reporting_type(text: str) -> Optional[str]:
    """Extract type of reporting person"""
    types = {
        "IA": "Investment Adviser",
        "BD": "Broker Dealer",
        "BK": "Bank",
        "CO": "Corporation",
        "CP": "Corporation Pension",
        "EP": "Employee Benefit Plan",
        "HC": "Holding Company",
        "IN": "Individual",
        "IV": "Investment Company",
        "OO": "Other",
        "PN": "Partnership"
    }
    
    match = re.search(r"type of reporting person[:\s]*([A-Z]{2})", text, re.IGNORECASE)
    if match:
        code = match.group(1).upper()
        return types.get(code, code)
    
    return None


def _extract_event_date(text: str) -> Optional[date]:
    """Extract date of event requiring filing"""
    patterns = [
        r"date of event[:\s]*([\d/\-]+)",
        r"(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            date_str = match.group(1)
            try:
                for fmt in ['%m/%d/%Y', '%m-%d-%Y', '%Y-%m-%d', '%m/%d/%y']:
                    try:
                        return datetime.strptime(date_str, fmt).date()
                    except:
                        continue
            except:
                continue
    
    return None


def format_13d_13g_markdown(filing: Schedule13Filing) -> str:
    """Format filing as markdown"""
    lines = []
    
    form_type = "Schedule 13D" if "13D" in filing.form_type else "Schedule 13G"
    activist = " (Activist)" if filing.is_activist else " (Passive)"
    
    lines.append(f"# {form_type}{activist}: {filing.company_name}")
    lines.append(f"*Filed: {filing.filed_date}*")
    lines.append("")
    
    lines.append("## Beneficial Owner")
    lines.append(f"**{filing.filer_name}**")
    if filing.type_of_reporting_person:
        lines.append(f"Type: {filing.type_of_reporting_person}")
    lines.append("")
    
    lines.append("## Ownership")
    lines.append(f"- **Shares:** {filing.shares_beneficially_owned:,}")
    lines.append(f"- **Percent of Class:** {filing.percent_of_class:.2f}%")
    lines.append("")
    
    if filing.sole_voting_power or filing.shared_voting_power:
        lines.append("### Voting Power")
        lines.append(f"- Sole: {filing.sole_voting_power:,}")
        lines.append(f"- Shared: {filing.shared_voting_power:,}")
        lines.append("")
    
    if filing.item_4_purpose:
        lines.append("## Purpose")
        lines.append(filing.item_4_purpose)
        lines.append("")
    
    return "\n".join(lines)


# ============================================
# Signal Detection
# ============================================

def detect_activist_signals(filing: Schedule13Filing) -> Dict:
    """
    Detect signals that suggest activist intentions.
    """
    signals = []
    risk_score = 0
    
    # 13D vs 13G
    if filing.is_activist:
        signals.append("Filed 13D (indicates intent to influence)")
        risk_score += 30
    
    # Large stake
    if filing.percent_of_class >= 10:
        signals.append(f"Large stake ({filing.percent_of_class:.1f}%)")
        risk_score += 20
    elif filing.percent_of_class >= 5:
        signals.append(f"Significant stake ({filing.percent_of_class:.1f}%)")
        risk_score += 10
    
    # Purpose analysis (for 13D)
    if filing.item_4_purpose:
        purpose_lower = filing.item_4_purpose.lower()
        
        activist_keywords = [
            ("board", "Seeking board representation"),
            ("change", "Seeking changes"),
            ("merger", "Mentions merger/acquisition"),
            ("acquisition", "Mentions merger/acquisition"),
            ("sale", "Mentions potential sale"),
            ("strategic", "Mentions strategic alternatives"),
            ("management", "Mentions management changes"),
            ("vote", "Plans to influence voting"),
            ("proxy", "Mentions proxy contest"),
        ]
        
        for keyword, description in activist_keywords:
            if keyword in purpose_lower:
                signals.append(description)
                risk_score += 15
    
    return {
        "is_activist_filing": filing.is_activist,
        "risk_score": min(risk_score, 100),
        "signals": signals,
        "recommendation": (
            "High activist risk - monitor closely" if risk_score >= 50
            else "Moderate activist risk" if risk_score >= 25
            else "Low activist risk - likely passive"
        )
    }


# ============================================
# Testing
# ============================================

if __name__ == "__main__":
    # Sample 13D content
    sample_content = """
    UNITED STATES SECURITIES AND EXCHANGE COMMISSION
    Washington, D.C. 20549
    
    SCHEDULE 13D
    
    Under the Securities Exchange Act of 1934
    (Amendment No. )*
    
    ITEM 1. SECURITY AND ISSUER
    Name of Issuer: Target Corporation Inc.
    CUSIP: 87612E106
    
    ITEM 2. IDENTITY AND BACKGROUND
    Name of Person Filing: Activist Capital Partners LP
    
    ITEM 5. INTEREST IN SECURITIES OF THE ISSUER
    Aggregate Number of Shares: 15,000,000
    Percent of Class: 8.5%
    
    Sole Voting Power: 15,000,000
    Shared Voting Power: 0
    Sole Dispositive Power: 15,000,000
    Shared Dispositive Power: 0
    
    Type of Reporting Person: IA
    
    ITEM 4. PURPOSE OF TRANSACTION
    The Reporting Person acquired the Shares for investment purposes. The Reporting 
    Person intends to engage in discussions with the Issuer's management and Board 
    of Directors concerning the Issuer's business, strategy, and potential strategic 
    alternatives to enhance shareholder value. The Reporting Person may seek 
    representation on the Board of Directors.
    """
    
    filing = parse_13d_13g(
        sample_content,
        "0000000000-24-000001",
        "13D",
        date(2024, 1, 15)
    )
    
    print(format_13d_13g_markdown(filing))
    print("\n" + "=" * 60)
    print("Activist Analysis:")
    print("=" * 60)
    
    import json
    analysis = detect_activist_signals(filing)
    print(json.dumps(analysis, indent=2))
