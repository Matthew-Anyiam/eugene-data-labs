"""
Eugene Data Labs - Form 5 Parser

Parses Form 5 filings - Annual Statement of Beneficial Ownership.

Form 5 is filed annually to report:
- Transactions that should have been on Form 4 but weren't
- Small acquisitions exempt from Form 4
- Gifts of securities
- Year-end holdings summary

Why it matters:
- Catches transactions insiders "forgot" to report
- Shows gifts (potential tax planning)
- Annual reconciliation of insider holdings
"""

from dataclasses import dataclass
from typing import List, Optional
from datetime import datetime
from enum import Enum
import re


class TransactionType(Enum):
    """Types of Form 5 transactions"""
    PURCHASE = "P"
    SALE = "S"
    GIFT = "G"
    AWARD = "A"
    EXERCISE = "M"
    CONVERSION = "C"
    OTHER = "O"


@dataclass
class Form5Transaction:
    """A single transaction reported on Form 5"""
    security_title: str
    transaction_date: str
    transaction_code: str
    transaction_type: str
    shares: int
    price_per_share: Optional[float]
    shares_after: int
    ownership_nature: str
    late_report: bool  # Was this a late Form 4?
    exempt: bool  # Exempt from Form 4 reporting


@dataclass
class Form5Filing:
    """Extracted data from Form 5"""
    # Filing info
    ticker: str
    company_name: str
    company_cik: str
    filed_date: str
    fiscal_year: str
    accession_number: str
    
    # Insider info
    insider_name: str
    insider_roles: List[str]
    
    # Transactions
    transactions: List[Form5Transaction]
    total_acquired: int
    total_disposed: int
    net_change: int
    
    # Year-end holdings
    year_end_shares: int
    has_derivatives: bool
    
    # Flags
    has_late_reports: bool
    has_gifts: bool
    
    # Analysis
    filing_url: str
    extraction_timestamp: str
    confidence: float


TRANSACTION_CODES = {
    "P": "Open market purchase",
    "S": "Open market sale",
    "G": "Gift",
    "A": "Grant/Award",
    "M": "Option exercise",
    "C": "Conversion",
    "F": "Tax withholding",
    "J": "Other",
}


def parse_transactions(raw_text: str) -> List[Form5Transaction]:
    """Extract transactions from Form 5"""
    transactions = []
    text_lower = raw_text.lower()
    
    # Look for transaction patterns
    # Pattern: date, code, shares, price
    trans_pattern = re.findall(
        r'(\d{1,2}/\d{1,2}/\d{4})\s+([PSGAMCFJ])\s+(\d[\d,]*)\s+\$?([\d.]+)?',
        raw_text,
        re.IGNORECASE
    )
    
    for date, code, shares, price in trans_pattern:
        code = code.upper()
        shares_int = int(shares.replace(",", ""))
        price_float = float(price) if price else None
        
        # Determine if acquisition or disposition
        is_acquisition = code in ["P", "A", "M", "G", "C"]
        
        trans = Form5Transaction(
            security_title="Common Stock",
            transaction_date=date,
            transaction_code=code,
            transaction_type=TRANSACTION_CODES.get(code, "Other"),
            shares=shares_int if is_acquisition else -shares_int,
            price_per_share=price_float,
            shares_after=0,  # Calculated later
            ownership_nature="Direct",
            late_report="late" in text_lower or "should have" in text_lower,
            exempt="exempt" in text_lower
        )
        transactions.append(trans)
    
    # Check for gift mentions without structured data
    if "gift" in text_lower and not any(t.transaction_code == "G" for t in transactions):
        gift_match = re.search(r'gift[:\s]*(\d[\d,]*)\s*shares?', text_lower)
        if gift_match:
            transactions.append(Form5Transaction(
                security_title="Common Stock",
                transaction_date="",
                transaction_code="G",
                transaction_type="Gift",
                shares=-int(gift_match.group(1).replace(",", "")),
                price_per_share=None,
                shares_after=0,
                ownership_nature="Direct",
                late_report=False,
                exempt=True
            ))
    
    return transactions


def parse_form5(
    raw_text: str,
    ticker: str,
    company_name: str,
    company_cik: str,
    filed_date: str,
    accession_number: str,
    insider_name: str = "",
    fiscal_year: str = ""
) -> Form5Filing:
    """
    Main function to parse a Form 5 filing.
    """
    text_lower = raw_text.lower()
    
    # Extract insider name
    if not insider_name:
        name_match = re.search(r'name of reporting person[:\s]*([^\n]+)', text_lower)
        if name_match:
            insider_name = name_match.group(1).strip().title()
        else:
            insider_name = "Unknown Insider"
    
    # Extract fiscal year
    if not fiscal_year:
        year_match = re.search(r'fiscal year[:\s]*(\d{4})', text_lower)
        if year_match:
            fiscal_year = year_match.group(1)
        else:
            fiscal_year = str(datetime.now().year - 1)
    
    # Extract roles
    roles = []
    if "director" in text_lower:
        roles.append("Director")
    if "officer" in text_lower:
        roles.append("Officer")
    if "10%" in text_lower:
        roles.append("10% Owner")
    if not roles:
        roles.append("Insider")
    
    # Parse transactions
    transactions = parse_transactions(raw_text)
    
    # Calculate totals
    total_acquired = sum(t.shares for t in transactions if t.shares > 0)
    total_disposed = abs(sum(t.shares for t in transactions if t.shares < 0))
    net_change = total_acquired - total_disposed
    
    # Year-end holdings
    holdings_match = re.search(r'total[:\s]*(\d[\d,]*)\s*shares?', text_lower)
    year_end_shares = int(holdings_match.group(1).replace(",", "")) if holdings_match else 0
    
    # Flags
    has_derivatives = any(word in text_lower for word in ["option", "warrant", "derivative"])
    has_late_reports = any(t.late_report for t in transactions) or "late" in text_lower
    has_gifts = any(t.transaction_code == "G" for t in transactions) or "gift" in text_lower
    
    # Filing URL
    filing_url = f"https://www.sec.gov/Archives/edgar/data/{company_cik}/{accession_number.replace('-', '')}"
    
    return Form5Filing(
        ticker=ticker,
        company_name=company_name,
        company_cik=company_cik,
        filed_date=filed_date,
        fiscal_year=fiscal_year,
        accession_number=accession_number,
        insider_name=insider_name,
        insider_roles=roles,
        transactions=transactions,
        total_acquired=total_acquired,
        total_disposed=total_disposed,
        net_change=net_change,
        year_end_shares=year_end_shares,
        has_derivatives=has_derivatives,
        has_late_reports=has_late_reports,
        has_gifts=has_gifts,
        filing_url=filing_url,
        extraction_timestamp=datetime.now().isoformat(),
        confidence=0.85
    )


def format_form5_markdown(filing: Form5Filing) -> str:
    """Format Form 5 as markdown for agents"""
    
    # Flags
    flags = []
    if filing.has_late_reports:
        flags.append("⚠️ LATE REPORTS")
    if filing.has_gifts:
        flags.append("🎁 GIFTS")
    
    flags_str = " | ".join(flags) if flags else "None"
    
    md = f"""# Form 5: Annual Insider Summary - {filing.company_name} ({filing.ticker})

## 📅 Fiscal Year {filing.fiscal_year}

**Insider:** {filing.insider_name}
**Roles:** {", ".join(filing.insider_roles)}
**Filed:** {filing.filed_date}
**Flags:** {flags_str}

---

## Summary

| Metric | Value |
|--------|-------|
| Total Acquired | {filing.total_acquired:,} shares |
| Total Disposed | {filing.total_disposed:,} shares |
| Net Change | {filing.net_change:+,} shares |
| Year-End Holdings | {filing.year_end_shares:,} shares |

---

## Transactions

| Date | Type | Shares | Price |
|------|------|--------|-------|
"""
    
    for t in filing.transactions:
        price_str = f"${t.price_per_share:.2f}" if t.price_per_share else "N/A"
        late_flag = " ⚠️" if t.late_report else ""
        md += f"| {t.transaction_date or 'N/A'} | {t.transaction_type}{late_flag} | {t.shares:+,} | {price_str} |\n"
    
    if not filing.transactions:
        md += "| No transactions reported ||||\n"
    
    md += f"""
---

## Why This Matters

"""
    
    if filing.has_late_reports:
        md += "- ⚠️ **Late Reports:** Some transactions were reported late (should have been on Form 4)\n"
    
    if filing.has_gifts:
        md += "- 🎁 **Gifts:** Insider gifted shares (potential estate/tax planning)\n"
    
    if filing.net_change > 0:
        md += f"- 📈 **Net Buyer:** Insider acquired {filing.net_change:,} more shares than disposed\n"
    elif filing.net_change < 0:
        md += f"- 📉 **Net Seller:** Insider disposed {abs(filing.net_change):,} more shares than acquired\n"
    else:
        md += "- ➖ **Neutral:** No net change in holdings\n"
    
    md += f"""
---

## Filing Info

- **Accession Number:** {filing.accession_number}
- **SEC URL:** {filing.filing_url}
- **Extracted:** {filing.extraction_timestamp}
"""
    
    return md


# For testing
if __name__ == "__main__":
    sample_form5 = """
    UNITED STATES SECURITIES AND EXCHANGE COMMISSION
    Washington, D.C. 20549
    
    FORM 5
    ANNUAL STATEMENT OF BENEFICIAL OWNERSHIP
    
    Fiscal Year: 2024
    
    Tesla, Inc.
    (Name of Issuer)
    
    Name of Reporting Person: John Executive
    
    Relationship: Director, Officer
    
    Table I - Transactions During Fiscal Year
    (Transactions that should have been reported on Form 4)
    
    01/15/2024  P  5,000  $245.50
    03/22/2024  G  2,000
    06/10/2024  S  1,000  $180.25
    
    This Form 5 includes transactions that were late and should have
    been reported on Form 4.
    
    Year-End Total: 125,000 shares
    """
    
    result = parse_form5(
        raw_text=sample_form5,
        ticker="TSLA",
        company_name="Tesla, Inc.",
        company_cik="1318605",
        filed_date="2025-02-14",
        accession_number="0001318605-25-000300"
    )
    
    print(format_form5_markdown(result))