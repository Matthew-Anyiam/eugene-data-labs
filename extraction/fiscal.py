"""
Eugene Intelligence - Fiscal Calendar & Period Normalization

Handles the complexity of fiscal periods across different companies.
Critical insight from Fintool: "Q1 2024" means different things for different companies.

- Apple Q1 = October-December (fiscal year ends September)
- Microsoft Q1 = July-September (fiscal year ends June)
- Most companies Q1 = January-March (calendar year)

Every date reference must be normalized to absolute date ranges.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional, Dict, List, Tuple
from enum import Enum
import re


class FiscalYearEnd(Enum):
    """Common fiscal year end months"""
    JANUARY = 1
    FEBRUARY = 2
    MARCH = 3
    APRIL = 4
    MAY = 5
    JUNE = 6
    JULY = 7
    AUGUST = 8
    SEPTEMBER = 9
    OCTOBER = 10
    NOVEMBER = 11
    DECEMBER = 12  # Calendar year


@dataclass
class FiscalPeriod:
    """Represents a fiscal period with absolute dates"""
    company_ticker: str
    fiscal_year: int
    fiscal_quarter: Optional[int]  # 1-4, or None for full year
    period_start: date
    period_end: date
    period_type: str  # "annual", "quarterly", "ytd"
    
    @property
    def label(self) -> str:
        if self.fiscal_quarter:
            return f"FY{self.fiscal_year} Q{self.fiscal_quarter}"
        return f"FY{self.fiscal_year}"
    
    @property
    def days(self) -> int:
        return (self.period_end - self.period_start).days + 1
    
    def contains(self, d: date) -> bool:
        return self.period_start <= d <= self.period_end
    
    def to_dict(self) -> Dict:
        return {
            "ticker": self.company_ticker,
            "fiscal_year": self.fiscal_year,
            "fiscal_quarter": self.fiscal_quarter,
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "period_type": self.period_type,
            "label": self.label
        }


@dataclass
class CompanyFiscalCalendar:
    """Fiscal calendar for a specific company"""
    ticker: str
    company_name: str
    fiscal_year_end_month: int  # 1-12
    fiscal_year_end_day: int    # Usually last day of month
    
    def get_fiscal_year_for_date(self, d: date) -> int:
        """Determine which fiscal year a date falls into"""
        fy_end = date(d.year, self.fiscal_year_end_month, self.fiscal_year_end_day)
        
        if d <= fy_end:
            return d.year
        else:
            return d.year + 1
    
    def get_fiscal_quarter_for_date(self, d: date) -> Tuple[int, int]:
        """Determine fiscal year and quarter for a date"""
        fiscal_year = self.get_fiscal_year_for_date(d)
        
        # Calculate quarter boundaries
        fy_end = date(
            fiscal_year if self.fiscal_year_end_month >= d.month else fiscal_year - 1,
            self.fiscal_year_end_month,
            self.fiscal_year_end_day
        )
        
        # Q4 ends at fiscal year end
        q4_end = fy_end
        q4_start = self._add_months(q4_end, -3) + timedelta(days=1)
        
        q3_end = q4_start - timedelta(days=1)
        q3_start = self._add_months(q3_end, -3) + timedelta(days=1)
        
        q2_end = q3_start - timedelta(days=1)
        q2_start = self._add_months(q2_end, -3) + timedelta(days=1)
        
        q1_end = q2_start - timedelta(days=1)
        q1_start = self._add_months(q1_end, -3) + timedelta(days=1)
        
        if q1_start <= d <= q1_end:
            return fiscal_year, 1
        elif q2_start <= d <= q2_end:
            return fiscal_year, 2
        elif q3_start <= d <= q3_end:
            return fiscal_year, 3
        else:
            return fiscal_year, 4
    
    def get_period(self, fiscal_year: int, quarter: Optional[int] = None) -> FiscalPeriod:
        """Get the date range for a fiscal period"""
        
        # Fiscal year end date
        fy_end = date(fiscal_year, self.fiscal_year_end_month, self.fiscal_year_end_day)
        
        # Adjust for fiscal years that end in months 1-6 (next calendar year)
        if self.fiscal_year_end_month <= 6:
            fy_end = date(fiscal_year, self.fiscal_year_end_month, self.fiscal_year_end_day)
        
        fy_start = self._add_months(fy_end, -12) + timedelta(days=1)
        
        if quarter is None:
            # Full fiscal year
            return FiscalPeriod(
                company_ticker=self.ticker,
                fiscal_year=fiscal_year,
                fiscal_quarter=None,
                period_start=fy_start,
                period_end=fy_end,
                period_type="annual"
            )
        
        # Calculate quarter boundaries
        q4_end = fy_end
        q4_start = self._add_months(q4_end, -3) + timedelta(days=1)
        
        q3_end = q4_start - timedelta(days=1)
        q3_start = self._add_months(q3_end, -3) + timedelta(days=1)
        
        q2_end = q3_start - timedelta(days=1)
        q2_start = self._add_months(q2_end, -3) + timedelta(days=1)
        
        q1_end = q2_start - timedelta(days=1)
        q1_start = self._add_months(q1_end, -3) + timedelta(days=1)
        
        quarters = {
            1: (q1_start, q1_end),
            2: (q2_start, q2_end),
            3: (q3_start, q3_end),
            4: (q4_start, q4_end)
        }
        
        start, end = quarters[quarter]
        
        return FiscalPeriod(
            company_ticker=self.ticker,
            fiscal_year=fiscal_year,
            fiscal_quarter=quarter,
            period_start=start,
            period_end=end,
            period_type="quarterly"
        )
    
    def _add_months(self, d: date, months: int) -> date:
        """Add months to a date"""
        month = d.month + months
        year = d.year
        
        while month > 12:
            month -= 12
            year += 1
        while month < 1:
            month += 12
            year -= 1
        
        # Handle month-end edge cases
        day = min(d.day, self._days_in_month(year, month))
        
        return date(year, month, day)
    
    def _days_in_month(self, year: int, month: int) -> int:
        """Get number of days in a month"""
        if month in [4, 6, 9, 11]:
            return 30
        elif month == 2:
            if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0):
                return 29
            return 28
        return 31


class FiscalCalendarDatabase:
    """
    Database of company fiscal calendars.
    
    In production, this would be backed by PostgreSQL.
    For now, we maintain common companies in memory.
    """
    
    # Known fiscal year ends for major companies
    # Format: ticker -> (month, day)
    KNOWN_CALENDARS = {
        # September fiscal year end
        "AAPL": (9, 30),   # Apple
        "MSFT": (6, 30),   # Microsoft
        "ORCL": (5, 31),   # Oracle
        "CRM": (1, 31),    # Salesforce
        "ADBE": (11, 30),  # Adobe
        "NKE": (5, 31),    # Nike
        "FDX": (5, 31),    # FedEx
        "COST": (8, 31),   # Costco
        "WMT": (1, 31),    # Walmart
        
        # Calendar year (most companies)
        "GOOGL": (12, 31),
        "GOOG": (12, 31),
        "AMZN": (12, 31),
        "META": (12, 31),
        "NVDA": (1, 31),   # NVIDIA (January FYE)
        "TSLA": (12, 31),
        "JPM": (12, 31),
        "BAC": (12, 31),
        "V": (9, 30),      # Visa
        "MA": (12, 31),
        "JNJ": (12, 31),
        "PG": (6, 30),     # P&G
        "HD": (1, 31),     # Home Depot (January FYE)
        "CVX": (12, 31),
        "XOM": (12, 31),
    }
    
    def __init__(self):
        self._calendars: Dict[str, CompanyFiscalCalendar] = {}
        self._load_known_calendars()
    
    def _load_known_calendars(self):
        """Load known fiscal calendars"""
        for ticker, (month, day) in self.KNOWN_CALENDARS.items():
            self._calendars[ticker] = CompanyFiscalCalendar(
                ticker=ticker,
                company_name=ticker,  # Would be full name in production
                fiscal_year_end_month=month,
                fiscal_year_end_day=day
            )
    
    def get_calendar(self, ticker: str) -> CompanyFiscalCalendar:
        """
        Get fiscal calendar for a company.
        Defaults to calendar year if unknown.
        """
        ticker = ticker.upper()
        
        if ticker in self._calendars:
            return self._calendars[ticker]
        
        # Default to calendar year
        return CompanyFiscalCalendar(
            ticker=ticker,
            company_name=ticker,
            fiscal_year_end_month=12,
            fiscal_year_end_day=31
        )
    
    def normalize_period(
        self, 
        ticker: str, 
        period_str: str,
        reference_date: Optional[date] = None
    ) -> FiscalPeriod:
        """
        Normalize a period string to absolute dates.
        
        Examples:
            "Q1 2024" -> FiscalPeriod with actual dates
            "FY2024" -> Full fiscal year period
            "Last quarter" -> Based on reference_date
            "2024" -> Full fiscal year
        """
        ticker = ticker.upper()
        calendar = self.get_calendar(ticker)
        reference_date = reference_date or date.today()
        
        period_str = period_str.strip().upper()
        
        # Pattern: Q1 2024, Q1'24, 1Q24, 1Q 2024
        quarter_pattern = r"(?:Q|FQ)?(\d)[Q']?\s*'?(\d{2,4})"
        quarter_match = re.search(quarter_pattern, period_str)
        
        if quarter_match:
            quarter = int(quarter_match.group(1))
            year = int(quarter_match.group(2))
            if year < 100:
                year += 2000
            return calendar.get_period(year, quarter)
        
        # Pattern: FY2024, FY24, 2024
        year_pattern = r"(?:FY)?'?(\d{2,4})"
        year_match = re.search(year_pattern, period_str)
        
        if year_match:
            year = int(year_match.group(1))
            if year < 100:
                year += 2000
            return calendar.get_period(year)
        
        # Relative patterns
        if "LAST QUARTER" in period_str or "PRIOR QUARTER" in period_str:
            fy, q = calendar.get_fiscal_quarter_for_date(reference_date)
            if q == 1:
                return calendar.get_period(fy - 1, 4)
            return calendar.get_period(fy, q - 1)
        
        if "THIS QUARTER" in period_str or "CURRENT QUARTER" in period_str:
            fy, q = calendar.get_fiscal_quarter_for_date(reference_date)
            return calendar.get_period(fy, q)
        
        if "LAST YEAR" in period_str or "PRIOR YEAR" in period_str:
            fy = calendar.get_fiscal_year_for_date(reference_date)
            return calendar.get_period(fy - 1)
        
        if "THIS YEAR" in period_str or "CURRENT YEAR" in period_str:
            fy = calendar.get_fiscal_year_for_date(reference_date)
            return calendar.get_period(fy)
        
        # Default: try to parse as year
        try:
            year = int(period_str)
            if year < 100:
                year += 2000
            return calendar.get_period(year)
        except ValueError:
            pass
        
        # Fallback: current fiscal year
        fy = calendar.get_fiscal_year_for_date(reference_date)
        return calendar.get_period(fy)
    
    def add_calendar(
        self, 
        ticker: str, 
        company_name: str,
        fiscal_year_end_month: int,
        fiscal_year_end_day: int
    ):
        """Add or update a company's fiscal calendar"""
        ticker = ticker.upper()
        self._calendars[ticker] = CompanyFiscalCalendar(
            ticker=ticker,
            company_name=company_name,
            fiscal_year_end_month=fiscal_year_end_month,
            fiscal_year_end_day=fiscal_year_end_day
        )


# Global instance
_fiscal_db = None

def get_fiscal_database() -> FiscalCalendarDatabase:
    """Get the global fiscal calendar database"""
    global _fiscal_db
    if _fiscal_db is None:
        _fiscal_db = FiscalCalendarDatabase()
    return _fiscal_db


def normalize_period(ticker: str, period_str: str) -> FiscalPeriod:
    """Convenience function to normalize a period string"""
    return get_fiscal_database().normalize_period(ticker, period_str)


def get_fiscal_period(ticker: str, year: int, quarter: Optional[int] = None) -> FiscalPeriod:
    """Convenience function to get a fiscal period"""
    calendar = get_fiscal_database().get_calendar(ticker)
    return calendar.get_period(year, quarter)


# ============================================
# Testing
# ============================================

if __name__ == "__main__":
    db = FiscalCalendarDatabase()
    
    print("=" * 60)
    print("FISCAL PERIOD NORMALIZATION TESTS")
    print("=" * 60)
    
    # Test Apple (September FYE)
    print("\nApple (FYE: September 30)")
    print("-" * 40)
    
    apple_q1 = db.normalize_period("AAPL", "Q1 2024")
    print(f"Q1 2024: {apple_q1.period_start} to {apple_q1.period_end}")
    print(f"  (This is Oct-Dec 2023 for Apple)")
    
    apple_fy = db.normalize_period("AAPL", "FY2024")
    print(f"FY2024:  {apple_fy.period_start} to {apple_fy.period_end}")
    
    # Test Microsoft (June FYE)
    print("\nMicrosoft (FYE: June 30)")
    print("-" * 40)
    
    msft_q1 = db.normalize_period("MSFT", "Q1 2024")
    print(f"Q1 2024: {msft_q1.period_start} to {msft_q1.period_end}")
    print(f"  (This is Jul-Sep 2023 for Microsoft)")
    
    msft_fy = db.normalize_period("MSFT", "FY2024")
    print(f"FY2024:  {msft_fy.period_start} to {msft_fy.period_end}")
    
    # Test calendar year company
    print("\nTesla (FYE: December 31)")
    print("-" * 40)
    
    tsla_q1 = db.normalize_period("TSLA", "Q1 2024")
    print(f"Q1 2024: {tsla_q1.period_start} to {tsla_q1.period_end}")
    
    tsla_fy = db.normalize_period("TSLA", "FY2024")
    print(f"FY2024:  {tsla_fy.period_start} to {tsla_fy.period_end}")
    
    # Test relative periods
    print("\nRelative Period Tests (reference: today)")
    print("-" * 40)
    
    last_q = db.normalize_period("AAPL", "last quarter")
    print(f"Apple 'last quarter': {last_q.label} ({last_q.period_start} to {last_q.period_end})")
    
    # Show why this matters
    print("\n" + "=" * 60)
    print("WHY THIS MATTERS")
    print("=" * 60)
    print("""
When comparing Q1 2024 across companies:
- Apple Q1 2024:     Oct 1, 2023 - Dec 31, 2023
- Microsoft Q1 2024: Jul 1, 2023 - Sep 30, 2023  
- Tesla Q1 2024:     Jan 1, 2024 - Mar 31, 2024

Without normalization, you'd compare Apple's October revenue
to Tesla's January revenue and call it "same quarter."
    """)
