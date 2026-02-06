"""
Eugene Intelligence - 13F Parser (Institutional Holdings)

Parses SEC Form 13F-HR filings to extract institutional holdings.
13F is filed quarterly by institutional investment managers with 
$100M+ in AUM, disclosing their equity holdings.

13F data is XML-structured (information table).
"""

import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import List, Dict, Optional, Tuple
import re
import logging

logger = logging.getLogger(__name__)


@dataclass
class Holding:
    """A single position in a 13F filing"""
    issuer_name: str
    title_of_class: str
    cusip: str
    value_thousands: int  # In thousands of dollars
    shares_or_principal: int
    shares_or_principal_type: str  # "SH" for shares, "PRN" for principal
    investment_discretion: str  # "SOLE", "SHARED", "DFND", "OTR"
    voting_authority_sole: int
    voting_authority_shared: int
    voting_authority_none: int
    put_call: Optional[str] = None  # "PUT", "CALL", or None
    
    @property
    def value(self) -> int:
        """Value in dollars"""
        return self.value_thousands * 1000
    
    @property
    def is_option(self) -> bool:
        return self.put_call is not None


@dataclass
class Form13FFiling:
    """Parsed 13F-HR filing"""
    accession_number: str
    filed_date: date
    report_date: date  # Quarter end date
    filer_name: str
    filer_cik: str
    holdings: List[Holding]
    
    # Computed properties
    @property
    def total_value(self) -> int:
        """Total portfolio value in dollars"""
        return sum(h.value for h in self.holdings)
    
    @property
    def total_positions(self) -> int:
        return len(self.holdings)
    
    @property
    def top_holdings(self) -> List[Holding]:
        """Top 10 holdings by value"""
        return sorted(self.holdings, key=lambda h: h.value, reverse=True)[:10]
    
    def get_holding(self, cusip: str = None, name: str = None) -> Optional[Holding]:
        """Find a specific holding"""
        for h in self.holdings:
            if cusip and h.cusip == cusip:
                return h
            if name and name.lower() in h.issuer_name.lower():
                return h
        return None
    
    def to_dict(self) -> Dict:
        return {
            "accession_number": self.accession_number,
            "filed_date": self.filed_date.isoformat(),
            "report_date": self.report_date.isoformat(),
            "filer": {
                "name": self.filer_name,
                "cik": self.filer_cik
            },
            "summary": {
                "total_value": self.total_value,
                "total_positions": self.total_positions,
                "total_value_formatted": f"${self.total_value:,.0f}"
            },
            "holdings": [
                {
                    "issuer": h.issuer_name,
                    "class": h.title_of_class,
                    "cusip": h.cusip,
                    "value": h.value,
                    "shares": h.shares_or_principal,
                    "type": h.shares_or_principal_type,
                    "discretion": h.investment_discretion,
                    "put_call": h.put_call
                }
                for h in self.holdings
            ],
            "top_10": [
                {
                    "issuer": h.issuer_name,
                    "value": h.value,
                    "shares": h.shares_or_principal,
                    "pct_of_portfolio": h.value / self.total_value * 100 if self.total_value else 0
                }
                for h in self.top_holdings
            ]
        }


def parse_13f_xml(xml_content: str, accession_number: str = "", 
                  filed_date: date = None, filer_name: str = "", 
                  filer_cik: str = "") -> Form13FFiling:
    """
    Parse 13F information table XML.
    
    Note: The 13F consists of multiple files:
    - Primary document (cover page)
    - Information table (holdings) - this is what we parse
    
    Args:
        xml_content: XML content of the information table
        accession_number: SEC accession number
        filed_date: Filing date
        filer_name: Name of the filer (from cover page)
        filer_cik: CIK of the filer
    
    Returns:
        Parsed Form13FFiling
    """
    # Clean XML
    xml_content = re.sub(r'xmlns[^"]*"[^"]*"', '', xml_content)
    xml_content = re.sub(r'<ns1:', '<', xml_content)
    xml_content = re.sub(r'</ns1:', '</', xml_content)
    
    root = ET.fromstring(xml_content)
    
    # Try to find report date
    report_date = filed_date or date.today()
    
    holdings = []
    
    # Parse each info table entry
    for entry in root.findall('.//infoTable'):
        holding = _parse_holding(entry)
        if holding:
            holdings.append(holding)
    
    return Form13FFiling(
        accession_number=accession_number,
        filed_date=filed_date or date.today(),
        report_date=report_date,
        filer_name=filer_name,
        filer_cik=filer_cik,
        holdings=holdings
    )


def _parse_holding(entry) -> Optional[Holding]:
    """Parse a single holding entry"""
    try:
        issuer = _get_text(entry, 'nameOfIssuer', '')
        title = _get_text(entry, 'titleOfClass', '')
        cusip = _get_text(entry, 'cusip', '')
        
        value_str = _get_text(entry, 'value', '0')
        value = int(value_str) if value_str else 0
        
        # Shares/principal info
        shrs_prn = entry.find('shrsOrPrnAmt')
        shares_str = _get_text(shrs_prn, 'sshPrnamt', '0')
        shares = int(shares_str) if shares_str else 0
        shares_type = _get_text(shrs_prn, 'sshPrnamtType', 'SH')
        
        discretion = _get_text(entry, 'investmentDiscretion', 'SOLE')
        
        # Voting authority
        voting = entry.find('votingAuthority')
        vote_sole = int(_get_text(voting, 'Sole', '0') or 0)
        vote_shared = int(_get_text(voting, 'Shared', '0') or 0)
        vote_none = int(_get_text(voting, 'None', '0') or 0)
        
        # Put/Call indicator
        put_call = _get_text(entry, 'putCall', None)
        if put_call and put_call not in ('PUT', 'CALL'):
            put_call = None
        
        return Holding(
            issuer_name=issuer,
            title_of_class=title,
            cusip=cusip,
            value_thousands=value,
            shares_or_principal=shares,
            shares_or_principal_type=shares_type,
            investment_discretion=discretion,
            voting_authority_sole=vote_sole,
            voting_authority_shared=vote_shared,
            voting_authority_none=vote_none,
            put_call=put_call
        )
    except Exception as e:
        logger.warning(f"Failed to parse holding: {e}")
        return None


def _get_text(element, tag: str, default: str = '') -> str:
    """Safely get text from XML element"""
    if element is None:
        return default
    found = element.find(tag)
    if found is not None and found.text:
        return found.text.strip()
    return default


def compare_13f_filings(current: Form13FFiling, previous: Form13FFiling) -> Dict:
    """
    Compare two 13F filings to identify changes.
    
    Returns changes in positions (new, closed, increased, decreased).
    """
    current_holdings = {h.cusip: h for h in current.holdings}
    previous_holdings = {h.cusip: h for h in previous.holdings}
    
    current_cusips = set(current_holdings.keys())
    previous_cusips = set(previous_holdings.keys())
    
    # New positions
    new_positions = []
    for cusip in current_cusips - previous_cusips:
        h = current_holdings[cusip]
        new_positions.append({
            "issuer": h.issuer_name,
            "cusip": cusip,
            "shares": h.shares_or_principal,
            "value": h.value
        })
    
    # Closed positions
    closed_positions = []
    for cusip in previous_cusips - current_cusips:
        h = previous_holdings[cusip]
        closed_positions.append({
            "issuer": h.issuer_name,
            "cusip": cusip,
            "shares": h.shares_or_principal,
            "value": h.value
        })
    
    # Changed positions
    increased = []
    decreased = []
    for cusip in current_cusips & previous_cusips:
        curr = current_holdings[cusip]
        prev = previous_holdings[cusip]
        
        share_change = curr.shares_or_principal - prev.shares_or_principal
        pct_change = share_change / prev.shares_or_principal if prev.shares_or_principal else 0
        
        if abs(pct_change) >= 0.05:  # 5% threshold
            change = {
                "issuer": curr.issuer_name,
                "cusip": cusip,
                "shares_before": prev.shares_or_principal,
                "shares_after": curr.shares_or_principal,
                "share_change": share_change,
                "pct_change": pct_change * 100
            }
            
            if share_change > 0:
                increased.append(change)
            else:
                decreased.append(change)
    
    # Sort by magnitude of change
    increased.sort(key=lambda x: x["share_change"], reverse=True)
    decreased.sort(key=lambda x: x["share_change"])
    
    return {
        "filer": current.filer_name,
        "current_quarter": current.report_date.isoformat(),
        "previous_quarter": previous.report_date.isoformat(),
        "portfolio_change": {
            "value_before": previous.total_value,
            "value_after": current.total_value,
            "value_change": current.total_value - previous.total_value,
            "positions_before": previous.total_positions,
            "positions_after": current.total_positions
        },
        "new_positions": new_positions[:20],
        "closed_positions": closed_positions[:20],
        "increased_positions": increased[:20],
        "decreased_positions": decreased[:20]
    }


def format_13f_markdown(filing: Form13FFiling) -> str:
    """Format 13F as markdown"""
    lines = []
    
    lines.append(f"# 13F Holdings: {filing.filer_name}")
    lines.append(f"*Report Date: {filing.report_date} | Filed: {filing.filed_date}*")
    lines.append("")
    
    lines.append("## Summary")
    lines.append(f"- **Total Value:** ${filing.total_value:,.0f}")
    lines.append(f"- **Positions:** {filing.total_positions}")
    lines.append("")
    
    lines.append("## Top 10 Holdings")
    lines.append("")
    lines.append("| Issuer | Value | Shares | % of Portfolio |")
    lines.append("|--------|-------|--------|----------------|")
    
    for h in filing.top_holdings:
        pct = h.value / filing.total_value * 100 if filing.total_value else 0
        lines.append(
            f"| {h.issuer_name[:30]} | ${h.value:,.0f} | "
            f"{h.shares_or_principal:,.0f} | {pct:.1f}% |"
        )
    
    return "\n".join(lines)


# ============================================
# Testing
# ============================================

if __name__ == "__main__":
    # Sample 13F XML for testing
    sample_xml = """<?xml version="1.0"?>
    <informationTable>
        <infoTable>
            <nameOfIssuer>APPLE INC</nameOfIssuer>
            <titleOfClass>COM</titleOfClass>
            <cusip>037833100</cusip>
            <value>5000000</value>
            <shrsOrPrnAmt>
                <sshPrnamt>27000</sshPrnamt>
                <sshPrnamtType>SH</sshPrnamtType>
            </shrsOrPrnAmt>
            <investmentDiscretion>SOLE</investmentDiscretion>
            <votingAuthority>
                <Sole>27000</Sole>
                <Shared>0</Shared>
                <None>0</None>
            </votingAuthority>
        </infoTable>
        <infoTable>
            <nameOfIssuer>MICROSOFT CORP</nameOfIssuer>
            <titleOfClass>COM</titleOfClass>
            <cusip>594918104</cusip>
            <value>4500000</value>
            <shrsOrPrnAmt>
                <sshPrnamt>11000</sshPrnamt>
                <sshPrnamtType>SH</sshPrnamtType>
            </shrsOrPrnAmt>
            <investmentDiscretion>SOLE</investmentDiscretion>
            <votingAuthority>
                <Sole>11000</Sole>
                <Shared>0</Shared>
                <None>0</None>
            </votingAuthority>
        </infoTable>
        <infoTable>
            <nameOfIssuer>NVIDIA CORP</nameOfIssuer>
            <titleOfClass>COM</titleOfClass>
            <cusip>67066G104</cusip>
            <value>3500000</value>
            <shrsOrPrnAmt>
                <sshPrnamt>7000</sshPrnamt>
                <sshPrnamtType>SH</sshPrnamtType>
            </shrsOrPrnAmt>
            <investmentDiscretion>SOLE</investmentDiscretion>
            <votingAuthority>
                <Sole>7000</Sole>
                <Shared>0</Shared>
                <None>0</None>
            </votingAuthority>
        </infoTable>
    </informationTable>
    """
    
    filing = parse_13f_xml(
        sample_xml, 
        "0000000000-24-000001", 
        date(2024, 2, 14),
        "Berkshire Hathaway Inc",
        "0001067983"
    )
    
    print(format_13f_markdown(filing))
    print("\n" + "=" * 60)
    print("JSON Output:")
    print("=" * 60)
    
    import json
    print(json.dumps(filing.to_dict(), indent=2))
