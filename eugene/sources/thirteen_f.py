"""
Eugene Intelligence - 13F Holdings Parser
Extracts institutional holdings from SEC 13F filings.
Critical for understanding institutional ownership, concentration, and smart money flows.
"""
import json
import logging
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from eugene.config import Config, get_config
from eugene.models.sources import SourceCitation, CitedValue, SourcedResponse, SourceType

logger = logging.getLogger(__name__)

@dataclass
class Holding:
    """A single holding from a 13F filing."""
    security_name: str
    cusip: str
    ticker: Optional[str]
    shares: int
    market_value: float  # in dollars
    percent_of_portfolio: float
    put_call: Optional[str]  # 'Put', 'Call', or None for equity
    investment_discretion: str  # 'SOLE', 'SHARED', 'NONE'
    voting_authority_sole: int
    voting_authority_shared: int
    voting_authority_none: int

    @property
    def position_size_category(self) -> str:
        """Categorize position size for analysis."""
        if self.percent_of_portfolio >= 5.0:
            return "core_holding"  # >=5%
        elif self.percent_of_portfolio >= 1.0:
            return "significant_holding"  # 1-5%
        elif self.percent_of_portfolio >= 0.1:
            return "standard_holding"  # 0.1-1%
        else:
            return "minor_holding"  # <0.1%

@dataclass
class InstitutionalFiler:
    """Institution filing 13F."""
    cik: str
    name: str
    address: str
    filing_date: str
    period_end: str
    total_portfolio_value: float
    holdings_count: int
    filing_url: str
    accession_number: str

@dataclass
class HoldingsAnalysis:
    """Analysis of institutional holdings patterns."""
    top_holdings: List[Holding]
    sector_concentration: Dict[str, float]
    position_changes: Dict[str, Dict]  # ticker -> {action, shares_change, value_change}
    concentration_metrics: Dict[str, float]
    filing_metadata: InstitutionalFiler

class ThirteenFClient:
    """Fetches and parses 13F institutional holdings filings."""

    def __init__(self, config=None):
        self.config = config or get_config()
        self._edgar = None

    @property
    def edgar(self):
        if self._edgar is None:
            from eugene.sources.edgar import EDGARClient
            self._edgar = EDGARClient(self.config)
        return self._edgar

    def get_institutional_holdings(self, cik_or_name: str, filing_limit: int = 1) -> List[HoldingsAnalysis]:
        """
        Get institutional holdings for a fund/institution.

        Args:
            cik_or_name: CIK number or institution name (e.g., 'Berkshire Hathaway')
            filing_limit: Number of recent 13F filings to analyze

        Returns:
            List of HoldingsAnalysis objects
        """
        try:
            # Handle name lookup
            if not cik_or_name.isdigit():
                institution_cik = self._lookup_institution_cik(cik_or_name)
                if not institution_cik:
                    raise ValueError(f"Could not find CIK for institution: {cik_or_name}")
            else:
                institution_cik = cik_or_name.zfill(10)

            # Get 13F filings
            filings = self._get_13f_filings(institution_cik, limit=filing_limit)

            analyses = []
            for filing in filings:
                try:
                    analysis = self._analyze_13f_filing(filing)
                    if analysis:
                        analyses.append(analysis)
                except Exception as e:
                    logger.warning(f"Failed to analyze filing {filing.get('accession_number')}: {e}")
                    continue

            return analyses

        except Exception as e:
            logger.error(f"Failed to get institutional holdings: {e}")
            return []

    def get_security_holders(self, ticker_or_cusip: str, top_n: int = 50) -> Dict[str, List[Holding]]:
        """
        Get institutional holders of a specific security.

        Args:
            ticker_or_cusip: Stock ticker or CUSIP
            top_n: Number of top holders to return

        Returns:
            Dict mapping institution_name -> List[Holding]
        """
        # This would require building an index of all 13F filings
        # For now, implement basic functionality
        raise NotImplementedError("Security holder lookup requires building 13F index")

    def _lookup_institution_cik(self, institution_name: str) -> Optional[str]:
        """Look up CIK for institution name."""
        # Major institutional investors - expand as needed
        known_institutions = {
            'berkshire hathaway': '0001067983',
            'blackrock': '0001364742',
            'vanguard': '0001085735',
            'fidelity': '0000315066',
            'jpmorgan': '0000019617',
            'goldman sachs': '0000886982',
            'morgan stanley': '0000895421',
            'bank of america': '0000070858',
            'wells fargo': '0000072971',
            'citadel': '0001423053',
            'bridgewater': '0001350694',
            'renaissance technologies': '0001037389',
            'aqr': '0001582982',
            'two sigma': '0001606708'
        }

        name_lower = institution_name.lower()
        for key, cik in known_institutions.items():
            if key in name_lower or name_lower in key:
                return cik

        # Try EDGAR company search as fallback
        try:
            company = self.edgar.search_companies(institution_name)
            if company:
                return company[0].cik
        except:
            pass

        return None

    def _get_13f_filings(self, cik: str, limit: int = 1) -> List[Dict]:
        """Get recent 13F filings for institution."""
        try:
            # Use EDGAR to find 13F-HR filings
            filings = self.edgar.get_filings(cik, filing_type="13F-HR", limit=limit)

            # Convert Filing objects to dicts
            filing_dicts = []
            for filing in filings:
                filing_dict = {
                    'cik': cik,
                    'company_name': getattr(filing, 'company_name', ''),
                    'filing_date': filing.filing_date,
                    'period_end': getattr(filing, 'period_end', filing.filing_date),
                    'filing_url': filing.filing_url,
                    'accession_number': filing.accession_number
                }
                filing_dicts.append(filing_dict)

            return filing_dicts
        except Exception as e:
            logger.warning(f"Failed to get 13F filings for CIK {cik}: {e}")
            return []

    def _analyze_13f_filing(self, filing_info: Dict) -> Optional[HoldingsAnalysis]:
        """Analyze a single 13F filing."""
        try:
            # Get filing content
            # Create a minimal filing object for get_filing_content
            from types import SimpleNamespace
            filing_obj = SimpleNamespace()
            filing_obj.filing_url = filing_info['filing_url']
            filing_obj.accession_number = filing_info['accession_number']

            html_content = self.edgar.get_filing_content(filing_obj)

            # Parse 13F filing - these are typically in XML format within HTML
            holdings = self._parse_13f_content(html_content)

            if not holdings:
                return None

            # Calculate portfolio metrics
            total_value = sum(h.market_value for h in holdings)

            # Create filer info
            filer = InstitutionalFiler(
                cik=filing_info.get('cik', ''),
                name=filing_info.get('company_name', ''),
                address='',  # Would need to extract from filing
                filing_date=filing_info.get('filing_date', ''),
                period_end=filing_info.get('period_end', ''),
                total_portfolio_value=total_value,
                holdings_count=len(holdings),
                filing_url=filing_info.get('filing_url', ''),
                accession_number=filing_info.get('accession_number', '')
            )

            # Sort by market value and get top holdings
            sorted_holdings = sorted(holdings, key=lambda h: h.market_value, reverse=True)

            # Calculate concentration metrics
            top_10_value = sum(h.market_value for h in sorted_holdings[:10])
            top_10_concentration = (top_10_value / total_value) * 100 if total_value > 0 else 0

            concentration_metrics = {
                'top_10_concentration': top_10_concentration,
                'herfindahl_index': self._calculate_herfindahl_index(holdings, total_value),
                'number_of_positions': len(holdings),
                'avg_position_size': total_value / len(holdings) if holdings else 0
            }

            return HoldingsAnalysis(
                top_holdings=sorted_holdings[:25],  # Top 25 holdings
                sector_concentration={},  # Would need sector mapping
                position_changes={},  # Would need previous filing comparison
                concentration_metrics=concentration_metrics,
                filing_metadata=filer
            )

        except Exception as e:
            logger.error(f"Failed to analyze 13F filing: {e}")
            return None

    def _parse_13f_content(self, html_content: str) -> List[Holding]:
        """Parse holdings from 13F filing content."""
        holdings = []

        try:
            # 13F filings contain XML tables - look for common patterns
            # This is a simplified parser - production would need more robust parsing

            # Look for XML content in the HTML
            if '<informationTable>' in html_content:
                # Standard 13F XML format
                holdings = self._parse_13f_xml(html_content)
            else:
                # Try to parse HTML tables
                holdings = self._parse_13f_html_tables(html_content)

        except Exception as e:
            logger.warning(f"Failed to parse 13F content: {e}")

        return holdings

    def _parse_13f_xml(self, content: str) -> List[Holding]:
        """Parse 13F XML format."""
        holdings = []

        try:
            # Extract XML portion
            start_tag = '<informationTable>'
            end_tag = '</informationTable>'

            start_idx = content.find(start_tag)
            if start_idx == -1:
                return holdings

            end_idx = content.find(end_tag, start_idx)
            if end_idx == -1:
                return holdings

            xml_content = content[start_idx:end_idx + len(end_tag)]

            # Parse XML
            root = ET.fromstring(xml_content)

            for info_table in root.findall('.//infoTable'):
                try:
                    # Extract holding data
                    name_elem = info_table.find('nameOfIssuer')
                    cusip_elem = info_table.find('cusip')
                    shares_elem = info_table.find('.//sshPrnamt')
                    value_elem = info_table.find('value')

                    if all(elem is not None for elem in [name_elem, cusip_elem, shares_elem, value_elem]):
                        holding = Holding(
                            security_name=name_elem.text or '',
                            cusip=cusip_elem.text or '',
                            ticker=None,  # Would need CUSIP-to-ticker mapping
                            shares=int(shares_elem.text or 0),
                            market_value=float(value_elem.text or 0) * 1000,  # 13F values in thousands
                            percent_of_portfolio=0.0,  # Calculate after all holdings parsed
                            put_call=None,  # Would extract from putCall element
                            investment_discretion='SOLE',  # Would extract from investmentDiscretion
                            voting_authority_sole=0,
                            voting_authority_shared=0,
                            voting_authority_none=0
                        )
                        holdings.append(holding)

                except Exception as e:
                    logger.warning(f"Failed to parse individual holding: {e}")
                    continue

        except ET.ParseError as e:
            logger.warning(f"XML parsing failed: {e}")

        # Calculate portfolio percentages
        total_value = sum(h.market_value for h in holdings)
        if total_value > 0:
            for holding in holdings:
                holding.percent_of_portfolio = (holding.market_value / total_value) * 100

        return holdings

    def _parse_13f_html_tables(self, content: str) -> List[Holding]:
        """Parse 13F data from HTML tables (fallback method)."""
        holdings = []

        try:
            # Basic regex-based parsing for 13F HTML tables
            import re

            # Look for table rows with holding data
            # Pattern: security name, cusip, shares, value
            # This is a simplified parser - would use BeautifulSoup for production

            # Find table sections that might contain holdings
            table_patterns = [
                r'<td[^>]*class="FormData"[^>]*>([^<]+)</td>',  # Form data cells
                r'<td[^>]*>([A-Z][A-Z0-9\s&,.-]+)</td>',  # Security names
            ]

            rows = []
            for pattern in table_patterns:
                matches = re.findall(pattern, content, re.IGNORECASE)
                rows.extend(matches)

            # Try to identify holdings data from the extracted text
            # Look for patterns like company names followed by numbers
            current_holding = {}
            for i, text in enumerate(rows):
                text = text.strip()
                if not text:
                    continue

                # Check if this looks like a security name (alphabetic with common corp suffixes)
                if re.match(r'^[A-Z][A-Z\s&,.-]+(INC|CORP|CO|LLC|LTD|GROUP|COMPANY).*$', text, re.IGNORECASE):
                    if current_holding and all(k in current_holding for k in ['name', 'cusip', 'shares', 'value']):
                        # Previous holding complete, add it
                        try:
                            holding = Holding(
                                security_name=current_holding['name'],
                                cusip=current_holding['cusip'],
                                ticker=None,
                                shares=int(current_holding['shares']),
                                market_value=float(current_holding['value']) * 1000,  # Convert to dollars
                                percent_of_portfolio=0.0,
                                put_call=None,
                                investment_discretion='SOLE',
                                voting_authority_sole=0,
                                voting_authority_shared=0,
                                voting_authority_none=0
                            )
                            holdings.append(holding)
                        except (ValueError, TypeError):
                            pass

                    # Start new holding
                    current_holding = {'name': text}

                # Check for CUSIP (9 characters, alphanumeric)
                elif re.match(r'^[A-Z0-9]{9}$', text):
                    current_holding['cusip'] = text

                # Check for share counts (large numbers, possibly with commas)
                elif re.match(r'^[\d,]+$', text.replace(',', '')):
                    num = int(text.replace(',', ''))
                    if num > 1000:  # Likely shares (not value in thousands)
                        current_holding['shares'] = num
                    else:  # Likely value in thousands
                        current_holding['value'] = num

            # Add final holding if complete
            if current_holding and all(k in current_holding for k in ['name', 'cusip', 'shares', 'value']):
                try:
                    holding = Holding(
                        security_name=current_holding['name'],
                        cusip=current_holding['cusip'],
                        ticker=None,
                        shares=int(current_holding['shares']),
                        market_value=float(current_holding['value']) * 1000,
                        percent_of_portfolio=0.0,
                        put_call=None,
                        investment_discretion='SOLE',
                        voting_authority_sole=0,
                        voting_authority_shared=0,
                        voting_authority_none=0
                    )
                    holdings.append(holding)
                except (ValueError, TypeError):
                    pass

        except Exception as e:
            logger.warning(f"HTML table parsing failed: {e}")

        # Calculate portfolio percentages
        total_value = sum(h.market_value for h in holdings) if holdings else 0
        if total_value > 0:
            for holding in holdings:
                holding.percent_of_portfolio = (holding.market_value / total_value) * 100

        return holdings

    def _calculate_herfindahl_index(self, holdings: List[Holding], total_value: float) -> float:
        """Calculate Herfindahl-Hirschman Index for portfolio concentration."""
        if not holdings or total_value == 0:
            return 0.0

        hhi = sum((holding.market_value / total_value) ** 2 for holding in holdings) * 10000
        return hhi

# Convenience functions
def get_berkshire_holdings() -> List[HoldingsAnalysis]:
    """Get Berkshire Hathaway's latest 13F holdings."""
    client = ThirteenFClient()
    return client.get_institutional_holdings('berkshire hathaway')

def get_blackrock_holdings() -> List[HoldingsAnalysis]:
    """Get BlackRock's latest 13F holdings."""
    client = ThirteenFClient()
    return client.get_institutional_holdings('blackrock')

def get_institution_holdings(institution_name: str, filing_limit: int = 1) -> List[HoldingsAnalysis]:
    """Get any institution's 13F holdings."""
    client = ThirteenFClient()
    return client.get_institutional_holdings(institution_name, filing_limit)