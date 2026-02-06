"""
Eugene Intelligence - Form 4 Parser (Insider Trading)

Parses SEC Form 4 filings to extract insider transactions.
Form 4 is filed when company insiders (officers, directors, 10% owners) 
buy or sell company stock.

Form 4 is XML-structured, making it easy to parse programmatically.
"""

import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import List, Dict, Optional, Any
import re
import logging

logger = logging.getLogger(__name__)


@dataclass
class InsiderInfo:
    """Information about the insider"""
    name: str
    cik: str
    is_director: bool = False
    is_officer: bool = False
    is_ten_percent_owner: bool = False
    is_other: bool = False
    officer_title: Optional[str] = None
    
    @property
    def role(self) -> str:
        roles = []
        if self.is_director:
            roles.append("Director")
        if self.is_officer:
            roles.append(f"Officer ({self.officer_title})" if self.officer_title else "Officer")
        if self.is_ten_percent_owner:
            roles.append("10% Owner")
        if self.is_other:
            roles.append("Other")
        return ", ".join(roles) or "Unknown"


@dataclass
class InsiderTransaction:
    """A single transaction from Form 4"""
    security_title: str
    transaction_date: date
    transaction_code: str  # P=Purchase, S=Sale, A=Award, etc.
    shares: float
    price_per_share: Optional[float]
    acquired_disposed: str  # A=Acquired, D=Disposed
    shares_owned_after: float
    direct_indirect: str  # D=Direct, I=Indirect
    
    @property
    def transaction_type(self) -> str:
        codes = {
            "P": "Purchase",
            "S": "Sale",
            "A": "Award",
            "D": "Return to Issuer",
            "F": "Tax Withholding",
            "I": "Discretionary",
            "M": "Option Exercise",
            "C": "Conversion",
            "E": "Expiration",
            "G": "Gift",
            "L": "Small Acquisition",
            "W": "Will/Inheritance",
            "Z": "Trust",
            "J": "Other",
            "K": "Swap",
            "U": "Merger"
        }
        return codes.get(self.transaction_code, self.transaction_code)
    
    @property
    def total_value(self) -> Optional[float]:
        if self.price_per_share:
            return self.shares * self.price_per_share
        return None
    
    @property
    def is_buy(self) -> bool:
        return self.transaction_code == "P" or self.acquired_disposed == "A"
    
    @property
    def is_sell(self) -> bool:
        return self.transaction_code == "S" or self.acquired_disposed == "D"


@dataclass
class Form4Filing:
    """Parsed Form 4 filing"""
    accession_number: str
    filed_date: date
    company_name: str
    company_ticker: str
    company_cik: str
    insider: InsiderInfo
    transactions: List[InsiderTransaction]
    footnotes: Dict[str, str] = field(default_factory=dict)
    
    @property
    def total_bought(self) -> float:
        return sum(t.shares for t in self.transactions if t.is_buy)
    
    @property
    def total_sold(self) -> float:
        return sum(t.shares for t in self.transactions if t.is_sell)
    
    @property
    def total_value_bought(self) -> Optional[float]:
        values = [t.total_value for t in self.transactions if t.is_buy and t.total_value]
        return sum(values) if values else None
    
    @property
    def total_value_sold(self) -> Optional[float]:
        values = [t.total_value for t in self.transactions if t.is_sell and t.total_value]
        return sum(values) if values else None
    
    def to_dict(self) -> Dict:
        return {
            "accession_number": self.accession_number,
            "filed_date": self.filed_date.isoformat(),
            "company": {
                "name": self.company_name,
                "ticker": self.company_ticker,
                "cik": self.company_cik
            },
            "insider": {
                "name": self.insider.name,
                "cik": self.insider.cik,
                "role": self.insider.role,
                "is_director": self.insider.is_director,
                "is_officer": self.insider.is_officer,
                "is_ten_percent_owner": self.insider.is_ten_percent_owner,
                "officer_title": self.insider.officer_title
            },
            "transactions": [
                {
                    "security": t.security_title,
                    "date": t.transaction_date.isoformat(),
                    "type": t.transaction_type,
                    "code": t.transaction_code,
                    "shares": t.shares,
                    "price": t.price_per_share,
                    "total_value": t.total_value,
                    "acquired_disposed": t.acquired_disposed,
                    "shares_owned_after": t.shares_owned_after,
                    "ownership": t.direct_indirect
                }
                for t in self.transactions
            ],
            "summary": {
                "total_bought_shares": self.total_bought,
                "total_sold_shares": self.total_sold,
                "total_bought_value": self.total_value_bought,
                "total_sold_value": self.total_value_sold,
                "net_shares": self.total_bought - self.total_sold
            },
            "footnotes": self.footnotes
        }


def parse_form4_xml(xml_content: str, accession_number: str = "", filed_date: date = None) -> Form4Filing:
    """
    Parse Form 4 XML content.
    
    Args:
        xml_content: Raw XML from SEC EDGAR
        accession_number: SEC accession number
        filed_date: Date the form was filed
    
    Returns:
        Parsed Form4Filing object
    """
    # Clean XML - remove namespace prefixes that complicate parsing
    xml_content = re.sub(r'xmlns[^"]*"[^"]*"', '', xml_content)
    xml_content = re.sub(r'<([a-zA-Z]+):', r'<', xml_content)
    xml_content = re.sub(r'</([a-zA-Z]+):', r'</', xml_content)
    
    root = ET.fromstring(xml_content)
    
    # Parse issuer (company) info
    issuer = root.find('.//issuer')
    company_cik = _get_text(issuer, 'issuerCik', '')
    company_name = _get_text(issuer, 'issuerName', '')
    company_ticker = _get_text(issuer, 'issuerTradingSymbol', '')
    
    # Parse reporting owner (insider) info
    owner = root.find('.//reportingOwner')
    owner_id = owner.find('reportingOwnerId') if owner else None
    owner_rel = owner.find('reportingOwnerRelationship') if owner else None
    
    insider = InsiderInfo(
        name=_get_text(owner_id, 'rptOwnerName', 'Unknown'),
        cik=_get_text(owner_id, 'rptOwnerCik', ''),
        is_director=_get_bool(owner_rel, 'isDirector'),
        is_officer=_get_bool(owner_rel, 'isOfficer'),
        is_ten_percent_owner=_get_bool(owner_rel, 'isTenPercentOwner'),
        is_other=_get_bool(owner_rel, 'isOther'),
        officer_title=_get_text(owner_rel, 'officerTitle', None)
    )
    
    # Parse transactions
    transactions = []
    
    # Non-derivative transactions (common stock)
    for txn in root.findall('.//nonDerivativeTransaction'):
        t = _parse_transaction(txn)
        if t:
            transactions.append(t)
    
    # Derivative transactions (options, etc.) - record exercises
    for txn in root.findall('.//derivativeTransaction'):
        t = _parse_derivative_transaction(txn)
        if t:
            transactions.append(t)
    
    # Parse footnotes
    footnotes = {}
    for fn in root.findall('.//footnote'):
        fn_id = fn.get('id', '')
        fn_text = fn.text or ''
        if fn_id:
            footnotes[fn_id] = fn_text
    
    return Form4Filing(
        accession_number=accession_number,
        filed_date=filed_date or date.today(),
        company_name=company_name,
        company_ticker=company_ticker,
        company_cik=company_cik,
        insider=insider,
        transactions=transactions,
        footnotes=footnotes
    )


def _parse_transaction(txn_element) -> Optional[InsiderTransaction]:
    """Parse a non-derivative transaction"""
    try:
        security = _get_text(txn_element, './/securityTitle/value', 'Common Stock')
        
        txn_date_str = _get_text(txn_element, './/transactionDate/value', '')
        txn_date = _parse_date(txn_date_str)
        
        txn_code = _get_text(txn_element, './/transactionCoding/transactionCode', '')
        
        shares_str = _get_text(txn_element, './/transactionAmounts/transactionShares/value', '0')
        shares = float(shares_str) if shares_str else 0
        
        price_str = _get_text(txn_element, './/transactionAmounts/transactionPricePerShare/value', '')
        price = float(price_str) if price_str else None
        
        acq_disp = _get_text(txn_element, './/transactionAmounts/transactionAcquiredDisposedCode/value', '')
        
        owned_after_str = _get_text(txn_element, './/postTransactionAmounts/sharesOwnedFollowingTransaction/value', '0')
        owned_after = float(owned_after_str) if owned_after_str else 0
        
        ownership = _get_text(txn_element, './/ownershipNature/directOrIndirectOwnership/value', 'D')
        
        return InsiderTransaction(
            security_title=security,
            transaction_date=txn_date,
            transaction_code=txn_code,
            shares=shares,
            price_per_share=price,
            acquired_disposed=acq_disp,
            shares_owned_after=owned_after,
            direct_indirect=ownership
        )
    except Exception as e:
        logger.warning(f"Failed to parse transaction: {e}")
        return None


def _parse_derivative_transaction(txn_element) -> Optional[InsiderTransaction]:
    """Parse a derivative transaction (options, etc.)"""
    try:
        # For derivatives, we care about exercises that result in shares
        security = _get_text(txn_element, './/securityTitle/value', 'Option')
        
        txn_date_str = _get_text(txn_element, './/transactionDate/value', '')
        txn_date = _parse_date(txn_date_str)
        
        txn_code = _get_text(txn_element, './/transactionCoding/transactionCode', '')
        
        # For derivatives, get underlying shares if exercised
        shares_str = _get_text(txn_element, './/transactionAmounts/transactionShares/value', '0')
        shares = float(shares_str) if shares_str else 0
        
        # Get exercise price
        price_str = _get_text(txn_element, './/transactionAmounts/transactionPricePerShare/value', '')
        price = float(price_str) if price_str else None
        
        acq_disp = _get_text(txn_element, './/transactionAmounts/transactionAcquiredDisposedCode/value', '')
        
        owned_after_str = _get_text(txn_element, './/postTransactionAmounts/sharesOwnedFollowingTransaction/value', '0')
        owned_after = float(owned_after_str) if owned_after_str else 0
        
        ownership = _get_text(txn_element, './/ownershipNature/directOrIndirectOwnership/value', 'D')
        
        return InsiderTransaction(
            security_title=security,
            transaction_date=txn_date,
            transaction_code=txn_code,
            shares=shares,
            price_per_share=price,
            acquired_disposed=acq_disp,
            shares_owned_after=owned_after,
            direct_indirect=ownership
        )
    except Exception as e:
        logger.warning(f"Failed to parse derivative transaction: {e}")
        return None


def _get_text(element, path: str, default: str = '') -> str:
    """Safely get text from XML element"""
    if element is None:
        return default
    
    if '/' in path:
        found = element.find(path)
    else:
        found = element.find(path)
    
    if found is not None and found.text:
        return found.text.strip()
    return default


def _get_bool(element, path: str) -> bool:
    """Get boolean value from XML"""
    text = _get_text(element, path, '').lower()
    return text in ('1', 'true', 'yes')


def _parse_date(date_str: str) -> date:
    """Parse date string to date object"""
    if not date_str:
        return date.today()
    
    try:
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        try:
            return datetime.strptime(date_str, '%m/%d/%Y').date()
        except ValueError:
            return date.today()


def format_form4_markdown(filing: Form4Filing) -> str:
    """Format Form 4 as markdown"""
    lines = []
    
    lines.append(f"# Form 4: {filing.company_name} ({filing.company_ticker})")
    lines.append(f"*Filed: {filing.filed_date}*")
    lines.append("")
    
    lines.append("## Insider")
    lines.append(f"**{filing.insider.name}**")
    lines.append(f"Role: {filing.insider.role}")
    lines.append("")
    
    lines.append("## Transactions")
    lines.append("")
    lines.append("| Date | Type | Shares | Price | Value | After |")
    lines.append("|------|------|--------|-------|-------|-------|")
    
    for t in filing.transactions:
        value = f"${t.total_value:,.0f}" if t.total_value else "—"
        price = f"${t.price_per_share:.2f}" if t.price_per_share else "—"
        direction = "+" if t.is_buy else "-"
        
        lines.append(
            f"| {t.transaction_date} | {t.transaction_type} | "
            f"{direction}{t.shares:,.0f} | {price} | {value} | {t.shares_owned_after:,.0f} |"
        )
    
    lines.append("")
    
    # Summary
    lines.append("## Summary")
    if filing.total_bought > 0:
        value = f" (${filing.total_value_bought:,.0f})" if filing.total_value_bought else ""
        lines.append(f"- **Bought:** {filing.total_bought:,.0f} shares{value}")
    if filing.total_sold > 0:
        value = f" (${filing.total_value_sold:,.0f})" if filing.total_value_sold else ""
        lines.append(f"- **Sold:** {filing.total_sold:,.0f} shares{value}")
    
    net = filing.total_bought - filing.total_sold
    direction = "increased" if net > 0 else "decreased"
    lines.append(f"- **Net:** Position {direction} by {abs(net):,.0f} shares")
    
    return "\n".join(lines)


# ============================================
# Testing
# ============================================

if __name__ == "__main__":
    # Sample Form 4 XML for testing
    sample_xml = """<?xml version="1.0"?>
    <ownershipDocument>
        <issuer>
            <issuerCik>0000320193</issuerCik>
            <issuerName>Apple Inc</issuerName>
            <issuerTradingSymbol>AAPL</issuerTradingSymbol>
        </issuer>
        <reportingOwner>
            <reportingOwnerId>
                <rptOwnerCik>0001234567</rptOwnerCik>
                <rptOwnerName>Cook Timothy D</rptOwnerName>
            </reportingOwnerId>
            <reportingOwnerRelationship>
                <isDirector>1</isDirector>
                <isOfficer>1</isOfficer>
                <isTenPercentOwner>0</isTenPercentOwner>
                <isOther>0</isOther>
                <officerTitle>Chief Executive Officer</officerTitle>
            </reportingOwnerRelationship>
        </reportingOwner>
        <nonDerivativeTable>
            <nonDerivativeTransaction>
                <securityTitle><value>Common Stock</value></securityTitle>
                <transactionDate><value>2024-01-15</value></transactionDate>
                <transactionCoding>
                    <transactionCode>S</transactionCode>
                </transactionCoding>
                <transactionAmounts>
                    <transactionShares><value>50000</value></transactionShares>
                    <transactionPricePerShare><value>185.50</value></transactionPricePerShare>
                    <transactionAcquiredDisposedCode><value>D</value></transactionAcquiredDisposedCode>
                </transactionAmounts>
                <postTransactionAmounts>
                    <sharesOwnedFollowingTransaction><value>3500000</value></sharesOwnedFollowingTransaction>
                </postTransactionAmounts>
                <ownershipNature>
                    <directOrIndirectOwnership><value>D</value></directOrIndirectOwnership>
                </ownershipNature>
            </nonDerivativeTransaction>
        </nonDerivativeTable>
    </ownershipDocument>
    """
    
    filing = parse_form4_xml(sample_xml, "0000000000-24-000001", date(2024, 1, 16))
    
    print(format_form4_markdown(filing))
    print("\n" + "=" * 60)
    print("JSON Output:")
    print("=" * 60)
    
    import json
    print(json.dumps(filing.to_dict(), indent=2))
