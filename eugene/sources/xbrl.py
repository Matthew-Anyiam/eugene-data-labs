"""
Eugene Intelligence - XBRL Parser
Extracts standardized financial data from SEC XBRL API.
No LLM needed. Deterministic. Every company uses the same tags.
"""
import json
import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from datetime import datetime
from eugene.config import Config, get_config

logger = logging.getLogger(__name__)


# Standardized tag mapping: what we want -> possible XBRL tags (in priority order)
FINANCIAL_TAGS = {
    # Balance Sheet
    "total_assets": ["Assets"],
    "total_liabilities": ["Liabilities"],
    "current_assets": ["AssetsCurrent"],
    "current_liabilities": ["LiabilitiesCurrent"],
    "total_equity": [
        "StockholdersEquity",
        "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ],
    "retained_earnings": ["RetainedEarningsAccumulatedDeficit"],

    # Income Statement
    "revenue": [
        "Revenues",
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "SalesRevenueNet",
        "RevenueFromContractWithCustomerIncludingAssessedTax",
    ],
    "operating_income": ["OperatingIncomeLoss"],
    "net_income": [
        "NetIncomeLoss",
        "ProfitLoss",
        "NetIncomeLossAvailableToCommonStockholdersBasic",
    ],
    "ebit": ["OperatingIncomeLoss"],
    "interest_expense": [
        "InterestExpense",
        "InterestExpenseDebt",
        "InterestIncomeExpenseNet",
        "InterestPaidNet",
    ],
    "depreciation_amortization": [
        "DepreciationDepletionAndAmortization",
        "DepreciationAndAmortization",
        "Depreciation",
    ],
    "eps_basic": ["EarningsPerShareBasic"],
    "eps_diluted": ["EarningsPerShareDiluted"],

    # Cash Flow
    "operating_cash_flow": [
        "NetCashProvidedByUsedInOperatingActivities",
        "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
    ],
    "capital_expenditures": [
        "PaymentsToAcquirePropertyPlantAndEquipment",
        "PaymentsToAcquireProductiveAssets",
    ],

    # Debt
    "total_debt": [
        "LongTermDebt",
        "LongTermDebtAndCapitalLeaseObligations",
        "DebtAndCapitalLeaseObligations",
    ],
    "long_term_debt": [
        "LongTermDebtNoncurrent",
        "LongTermDebtAndCapitalLeaseObligationsCurrentAndNoncurrent",
    ],
    "short_term_debt": [
        "ShortTermBorrowings",
        "CommercialPaper",
        "LongTermDebtCurrent",
    ],
    "cash_and_equivalents": [
        "CashAndCashEquivalentsAtCarryingValue",
        "CashCashEquivalentsAndShortTermInvestments",
        "Cash",
    ],

    # Maturity Schedule
    "debt_due_year_1": ["LongTermDebtMaturitiesRepaymentsOfPrincipalInNextTwelveMonths"],
    "debt_due_year_2": ["LongTermDebtMaturitiesRepaymentsOfPrincipalInYearTwo"],
    "debt_due_year_3": ["LongTermDebtMaturitiesRepaymentsOfPrincipalInYearThree"],
    "debt_due_year_4": ["LongTermDebtMaturitiesRepaymentsOfPrincipalInYearFour"],
    "debt_due_year_5": ["LongTermDebtMaturitiesRepaymentsOfPrincipalInYearFive"],

    # Shares
    "shares_outstanding": [
        "CommonStockSharesOutstanding",
        "EntityCommonStockSharesOutstanding",
    ],
}


@dataclass
class XBRLFact:
    """A single XBRL data point with metadata."""
    tag: str
    value: Any
    unit: str
    period_end: str
    filed: str
    form: str
    accession: str
    fiscal_year: Optional[int] = None
    fiscal_period: Optional[str] = None


@dataclass
class XBRLFinancials:
    """Standardized financial data extracted from XBRL."""
    ticker: str
    company_name: str
    cik: str
    facts: Dict[str, XBRLFact]
    raw_tag_count: int
    extracted_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def get(self, key, default=None):
        """Get a fact value by standardized key."""
        fact = self.facts.get(key)
        if fact is None:
            return default
        return fact.value

    def get_fact(self, key):
        """Get full fact object."""
        return self.facts.get(key)

    def to_dict(self):
        result = {
            "ticker": self.ticker,
            "company_name": self.company_name,
            "cik": self.cik,
            "extracted_at": self.extracted_at,
            "raw_tag_count": self.raw_tag_count,
            "data": {},
        }
        for key, fact in self.facts.items():
            result["data"][key] = {
                "value": fact.value,
                "unit": fact.unit,
                "xbrl_tag": fact.tag,
                "period_end": fact.period_end,
                "filed": fact.filed,
                "form": fact.form,
            }
        return result

    def available_keys(self):
        return list(self.facts.keys())


class XBRLClient:
    """Fetches and parses XBRL data from SEC API."""

    def __init__(self, config=None):
        self.config = config or get_config()
        self._edgar = None

    @property
    def edgar(self):
        if self._edgar is None:
            from eugene.sources.edgar import EDGARClient
            self._edgar = EDGARClient(self.config)
        return self._edgar

    def get_financials(self, ticker, fiscal_year=None, form_filter="10-K"):
        """
        Get standardized financial data for a company.

        Args:
            ticker: Stock ticker
            fiscal_year: Specific year, or None for latest
            form_filter: '10-K' for annual, '10-Q' for quarterly, None for all

        Returns:
            XBRLFinancials with standardized data
        """
        ticker = ticker.upper()
        cik = self.edgar.get_cik(ticker)
        company = self.edgar.get_company(ticker)

        # Fetch XBRL company facts
        url = "https://data.sec.gov/api/xbrl/companyfacts/CIK{}.json".format(cik.zfill(10))
        raw = self.edgar._request(url)
        data = json.loads(raw)

        gaap = data.get("facts", {}).get("us-gaap", {})
        dei = data.get("facts", {}).get("dei", {})
        all_tags = {**gaap, **dei}

        facts = {}
        for std_key, tag_candidates in FINANCIAL_TAGS.items():
            fact = self._find_best_fact(all_tags, tag_candidates, form_filter, fiscal_year)
            if fact is not None:
                facts[std_key] = fact

        return XBRLFinancials(
            ticker=ticker,
            company_name=data.get("entityName", company.name),
            cik=cik,
            facts=facts,
            raw_tag_count=len(gaap),
        )

    def _find_best_fact(self, all_tags, tag_candidates, form_filter, fiscal_year):
        """Find the best matching fact from candidate tags.
        Priority: first matching tag, latest filing, matching form type."""
        for tag_name in tag_candidates:
            if tag_name not in all_tags:
                continue

            tag_data = all_tags[tag_name]
            units = tag_data.get("units", {})

            for unit_type, entries in units.items():
                # Filter by form type
                candidates = entries
                if form_filter:
                    candidates = [e for e in entries if e.get("form") == form_filter]

                if not candidates:
                    continue

                # Filter by fiscal year if specified
                if fiscal_year:
                    candidates = [e for e in candidates if e.get("fy") == fiscal_year]

                if not candidates:
                    continue

                # Filter for full-year periods (not quarterly segments)
                # Annual data has fp == "FY", quarterly has "Q1", "Q2", etc.
                if form_filter == "10-K":
                    annual = [e for e in candidates if e.get("fp") == "FY"]
                    if annual:
                        candidates = annual

                # Take the most recently filed entry
                candidates.sort(key=lambda e: e.get("filed", ""), reverse=True)
                best = candidates[0]

                return XBRLFact(
                    tag=tag_name,
                    value=best.get("val"),
                    unit=unit_type,
                    period_end=best.get("end", ""),
                    filed=best.get("filed", ""),
                    form=best.get("form", ""),
                    accession=best.get("accn", ""),
                    fiscal_year=best.get("fy"),
                    fiscal_period=best.get("fp"),
                )

        return None

    def get_historical(self, ticker, key, years=5, form_filter="10-K"):
        """Get historical values for a specific metric.

        Args:
            ticker: Stock ticker
            key: Standardized key from FINANCIAL_TAGS
            years: Number of years to retrieve
            form_filter: Form type filter

        Returns:
            List of XBRLFact objects, oldest first
        """
        ticker = ticker.upper()
        cik = self.edgar.get_cik(ticker)

        url = "https://data.sec.gov/api/xbrl/companyfacts/CIK{}.json".format(cik.zfill(10))
        raw = self.edgar._request(url)
        data = json.loads(raw)

        gaap = data.get("facts", {}).get("us-gaap", {})
        dei = data.get("facts", {}).get("dei", {})
        all_tags = {**gaap, **dei}

        tag_candidates = FINANCIAL_TAGS.get(key, [])
        results = []

        for tag_name in tag_candidates:
            if tag_name not in all_tags:
                continue

            tag_data = all_tags[tag_name]
            for unit_type, entries in tag_data.get("units", {}).items():
                candidates = entries
                if form_filter:
                    candidates = [e for e in entries if e.get("form") == form_filter]

                if form_filter == "10-K":
                    annual = [e for e in candidates if e.get("fp") == "FY"]
                    if annual:
                        candidates = annual

                # Deduplicate by fiscal year (take latest filing per year)
                by_year = {}
                for e in candidates:
                    fy = e.get("fy")
                    if fy and (fy not in by_year or e.get("filed", "") > by_year[fy].get("filed", "")):
                        by_year[fy] = e

                # Sort by year, take last N
                sorted_years = sorted(by_year.keys(), reverse=True)[:years]
                for fy in sorted(sorted_years):
                    e = by_year[fy]
                    results.append(XBRLFact(
                        tag=tag_name,
                        value=e.get("val"),
                        unit=unit_type,
                        period_end=e.get("end", ""),
                        filed=e.get("filed", ""),
                        form=e.get("form", ""),
                        accession=e.get("accn", ""),
                        fiscal_year=fy,
                        fiscal_period=e.get("fp"),
                    ))

            if results:
                break

        return results
