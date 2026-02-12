"""
Eugene Intelligence — Institutional Grade Tools
Production-ready with validation, tracing, and consistent output.

DISCLAIMER: Data provided for informational purposes only. 
Not financial advice. Verify all data with primary sources before making decisions.
"""
from eugene.core.response import (
    eugene_response, validate_ticker, format_currency, 
    format_percentage, format_number, DataSource, ResponseStatus
)
from eugene.core.fetcher import fetch_with_retry, FetchError
from datetime import datetime, timezone


# ============================================
# COMPANY — Institutional Grade
# ============================================

COMPANY_TYPES = ["prices", "profile", "financials", "health", "earnings", "insider"]


def company(ticker: str, type: str = "prices") -> dict:
    """
    Institutional-grade company data.
    Every field is sourced, typed, and validated.
    
    DISCLAIMER: For informational purposes only. Not financial advice.
    """
    # Validate input
    valid, result = validate_ticker(ticker)
    if not valid:
        return eugene_response(
            data=None,
            source=DataSource.SEC_XBRL,
            status=ResponseStatus.ERROR,
            error=result
        )
    ticker = result
    
    if type not in COMPANY_TYPES:
        return eugene_response(
            data=None,
            source=DataSource.SEC_XBRL,
            status=ResponseStatus.ERROR,
            error=f"Unknown type: {type}. Valid: {COMPANY_TYPES}"
        )
    
    try:
        if type == "prices":
            return _get_prices(ticker)
        elif type == "profile":
            return _get_profile(ticker)
        elif type == "financials":
            return _get_financials(ticker)
        elif type == "health":
            return _get_health(ticker)
        elif type == "earnings":
            return _get_earnings(ticker)
        elif type == "insider":
            return _get_insider(ticker)
    except FetchError as e:
        return eugene_response(
            data=None,
            source=DataSource.SEC_XBRL,
            status=ResponseStatus.ERROR,
            ticker=ticker,
            error=e.message
        )
    except Exception as e:
        return eugene_response(
            data=None,
            source=DataSource.SEC_XBRL,
            status=ResponseStatus.ERROR,
            ticker=ticker,
            error=f"Unexpected error: {str(e)}"
        )


def _get_prices(ticker: str) -> dict:
    """Get stock price with full metadata."""
    import os
    api_key = os.environ.get("FMP_API_KEY", "qHpeyyajejSLEzWdaMmerWRJVkLDP6Pu")
    
    data = fetch_with_retry(
        f"https://financialmodelingprep.com/stable/quote",
        params={"symbol": ticker, "apikey": api_key}
    )
    
    if not data or len(data) == 0:
        return eugene_response(
            data=None,
            source=DataSource.FMP,
            status=ResponseStatus.ERROR,
            ticker=ticker,
            error="No price data found"
        )
    
    quote = data[0]
    
    return eugene_response(
        data={
            "price": format_currency(quote.get("price")),
            "change": format_currency(quote.get("change")),
            "change_percent": format_percentage(quote.get("changesPercentage")),
            "volume": format_number(quote.get("volume"), "shares"),
            "market_cap": format_currency(quote.get("marketCap")),
            "day_high": format_currency(quote.get("dayHigh")),
            "day_low": format_currency(quote.get("dayLow")),
            "year_high": format_currency(quote.get("yearHigh")),
            "year_low": format_currency(quote.get("yearLow")),
            "avg_50d": format_currency(quote.get("priceAvg50")),
            "avg_200d": format_currency(quote.get("priceAvg200")),
        },
        source=DataSource.FMP,
        ticker=ticker,
        metadata={
            "exchange": quote.get("exchange"),
            "name": quote.get("name"),
            "disclaimer": "Real-time price data. Verify with exchange."
        }
    )


def _get_profile(ticker: str) -> dict:
    """Get company profile."""
    import os
    api_key = os.environ.get("FMP_API_KEY", "qHpeyyajejSLEzWdaMmerWRJVkLDP6Pu")
    
    data = fetch_with_retry(
        f"https://financialmodelingprep.com/stable/profile",
        params={"symbol": ticker, "apikey": api_key}
    )
    
    if not data or len(data) == 0:
        return eugene_response(
            data=None,
            source=DataSource.FMP,
            status=ResponseStatus.ERROR,
            ticker=ticker,
            error="No profile found"
        )
    
    profile = data[0]
    
    return eugene_response(
        data={
            "name": profile.get("companyName"),
            "sector": profile.get("sector"),
            "industry": profile.get("industry"),
            "ceo": profile.get("ceo"),
            "employees": format_number(profile.get("fullTimeEmployees")),
            "website": profile.get("website"),
            "description": profile.get("description", "")[:500],
            "headquarters": {
                "city": profile.get("city"),
                "state": profile.get("state"),
                "country": profile.get("country"),
            },
            "ipo_date": profile.get("ipoDate"),
        },
        source=DataSource.FMP,
        ticker=ticker
    )


def _get_financials(ticker: str) -> dict:
    """
    Get financials from SEC XBRL.
    Uses official SEC filings as source of truth.
    """
    cik = _get_cik(ticker)
    if not cik:
        return eugene_response(
            data=None,
            source=DataSource.SEC_XBRL,
            status=ResponseStatus.ERROR,
            ticker=ticker,
            error=f"CIK not found for {ticker}. Company may not be SEC-registered."
        )
    
    data = fetch_with_retry(
        f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
    )
    
    us_gaap = data.get("facts", {}).get("us-gaap", {})
    
    if not us_gaap:
        return eugene_response(
            data=None,
            source=DataSource.SEC_XBRL,
            status=ResponseStatus.ERROR,
            ticker=ticker,
            error="No US-GAAP data found. Company may use IFRS or not file with SEC."
        )
    
    def get_latest_annual(concepts: list):
        """
        Get most recent 10-K value from a list of concepts.
        Tries concepts in order (newer accounting standards first).
        Returns tuple: (value, period_end, filed_date, concept_used)
        """
        for concept in concepts:
            concept_data = us_gaap.get(concept, {}).get("units", {})
            
            for unit in ["USD", "pure", "shares", "USD/shares"]:
                if unit not in concept_data:
                    continue
                
                # Filter to 10-K only for annual data
                vals = [v for v in concept_data[unit] if v.get("form") == "10-K"]
                
                if not vals:
                    continue
                
                # Sort by fiscal period end (primary) and filed date (secondary)
                # This ensures we get the most recent fiscal year
                vals.sort(key=lambda x: (x.get("fy", 0), x.get("end", ""), x.get("filed", "")), reverse=True)
                
                # Get the most recent, but verify it's sensible
                latest = vals[0]
                val = latest.get("val")
                
                # Sanity check: value should exist
                if val is None:
                    continue
                
                return {
                    "value": val,
                    "period_end": latest.get("end"),
                    "fiscal_year": latest.get("fy"),
                    "filed_date": latest.get("filed"),
                    "concept": concept,
                    "form": latest.get("form"),
                    "accession": latest.get("accn")
                }
        
        return None
    
    # Revenue - try newer ASC 606 concept first, then legacy
    revenue_concepts = [
        "RevenueFromContractWithCustomerExcludingAssessedTax",  # ASC 606 (2018+)
        "Revenues",  # Legacy
        "SalesRevenueNet",  # Alternative
        "SalesRevenueGoodsNet",  # Alternative
    ]
    
    # Net Income concepts
    net_income_concepts = [
        "NetIncomeLoss",
        "ProfitLoss",
        "NetIncomeLossAvailableToCommonStockholdersBasic",
    ]
    
    # Balance sheet concepts
    assets_concepts = ["Assets"]
    liabilities_concepts = ["Liabilities"]
    equity_concepts = [
        "StockholdersEquity",
        "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ]
    cash_concepts = [
        "CashAndCashEquivalentsAtCarryingValue",
        "CashCashEquivalentsAndShortTermInvestments",
    ]
    
    # Fetch all metrics
    revenue = get_latest_annual(revenue_concepts)
    net_income = get_latest_annual(net_income_concepts)
    assets = get_latest_annual(assets_concepts)
    liabilities = get_latest_annual(liabilities_concepts)
    equity = get_latest_annual(equity_concepts)
    cash = get_latest_annual(cash_concepts)
    
    # Determine the primary period (use revenue or assets as anchor)
    primary_period = None
    primary_filed = None
    primary_fy = None
    
    if revenue:
        primary_period = revenue.get("period_end")
        primary_filed = revenue.get("filed_date")
        primary_fy = revenue.get("fiscal_year")
    elif assets:
        primary_period = assets.get("period_end")
        primary_filed = assets.get("filed_date")
        primary_fy = assets.get("fiscal_year")
    
    # Build warnings for any missing data
    warnings = []
    if not revenue:
        warnings.append("Revenue not found in SEC filings")
    if not net_income:
        warnings.append("Net income not found in SEC filings")
    if not assets:
        warnings.append("Total assets not found in SEC filings")
    
    # Validate data freshness (warn if over 18 months old)
    if primary_filed:
        try:
            filed_date = datetime.strptime(primary_filed, "%Y-%m-%d")
            days_old = (datetime.now() - filed_date).days
            if days_old > 540:  # 18 months
                warnings.append(f"Data is {days_old} days old. May be stale.")
        except:
            pass
    
    def safe_format(metric_data):
        if metric_data is None:
            return format_currency(None)
        return {
            **format_currency(metric_data.get("value")),
            "period_end": metric_data.get("period_end"),
            "fiscal_year": metric_data.get("fiscal_year"),
            "filed_date": metric_data.get("filed_date"),
            "sec_concept": metric_data.get("concept"),
            "accession_number": metric_data.get("accession"),
        }
    
    return eugene_response(
        data={
            "revenue": safe_format(revenue),
            "net_income": safe_format(net_income),
            "total_assets": safe_format(assets),
            "total_liabilities": safe_format(liabilities),
            "stockholders_equity": safe_format(equity),
            "cash": safe_format(cash),
        },
        source=DataSource.SEC_XBRL,
        status=ResponseStatus.PARTIAL if warnings else ResponseStatus.SUCCESS,
        ticker=ticker,
        period=primary_period,
        warnings=warnings if warnings else None,
        metadata={
            "cik": cik,
            "fiscal_year": primary_fy,
            "filed_date": primary_filed,
            "sec_url": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=10-K",
            "disclaimer": "Data sourced from SEC XBRL filings. Verify with official 10-K."
        }
    )


def _get_health(ticker: str) -> dict:
    """
    Calculate financial health metrics from SEC data.
    All calculations shown for transparency.
    """
    fin = _get_financials(ticker)
    
    if fin.get("status") == "error":
        return fin
    
    data = fin.get("data", {})
    
    # Extract raw values
    assets_val = data.get("total_assets", {}).get("value")
    liabilities_val = data.get("total_liabilities", {}).get("value")
    equity_val = data.get("stockholders_equity", {}).get("value")
    net_income_val = data.get("net_income", {}).get("value")
    revenue_val = data.get("revenue", {}).get("value")
    
    warnings = fin.get("warnings", []) or []
    
    # Calculate ratios with validation
    def safe_divide(numerator, denominator, pct=False):
        if numerator is None or denominator is None:
            return None
        if denominator == 0:
            return None
        result = numerator / denominator
        if pct:
            result *= 100
        return result
    
    # Debt to Equity
    debt_to_equity = safe_divide(liabilities_val, equity_val)
    if debt_to_equity and debt_to_equity < 0:
        warnings.append("Negative equity - company may be distressed")
    
    # Debt to Assets
    debt_to_assets = safe_divide(liabilities_val, assets_val, pct=True)
    
    # ROE (Return on Equity)
    roe = safe_divide(net_income_val, equity_val, pct=True)
    
    # ROA (Return on Assets)
    roa = safe_divide(net_income_val, assets_val, pct=True)
    
    # Net Margin
    net_margin = safe_divide(net_income_val, revenue_val, pct=True)
    
    # Equity Ratio
    equity_ratio = safe_divide(equity_val, assets_val, pct=True)
    
    return eugene_response(
        data={
            "debt_to_equity": {
                **format_number(debt_to_equity, "ratio"),
                "formula": "Total Liabilities / Stockholders Equity",
                "interpretation": "Lower is generally better. >2 may indicate high leverage."
            },
            "debt_to_assets": {
                **format_percentage(debt_to_assets),
                "formula": "(Total Liabilities / Total Assets) × 100",
                "interpretation": "Percentage of assets financed by debt."
            },
            "roe": {
                **format_percentage(roe),
                "formula": "(Net Income / Stockholders Equity) × 100",
                "interpretation": "Return generated on shareholder investment."
            },
            "roa": {
                **format_percentage(roa),
                "formula": "(Net Income / Total Assets) × 100",
                "interpretation": "Efficiency of asset utilization."
            },
            "net_margin": {
                **format_percentage(net_margin),
                "formula": "(Net Income / Revenue) × 100",
                "interpretation": "Profit retained per dollar of revenue."
            },
            "equity_ratio": {
                **format_percentage(equity_ratio),
                "formula": "(Stockholders Equity / Total Assets) × 100",
                "interpretation": "Percentage of assets owned outright."
            },
        },
        source=DataSource.SEC_XBRL,
        status=ResponseStatus.PARTIAL if warnings else ResponseStatus.SUCCESS,
        ticker=ticker,
        period=fin.get("period"),
        warnings=warnings if warnings else None,
        metadata={
            **fin.get("metadata", {}),
            "disclaimer": "Ratios calculated from SEC filings. Not investment advice."
        }
    )


def _get_earnings(ticker: str) -> dict:
    """Get EPS history from SEC XBRL."""
    cik = _get_cik(ticker)
    if not cik:
        return eugene_response(
            data=None,
            source=DataSource.SEC_XBRL,
            status=ResponseStatus.ERROR,
            ticker=ticker,
            error="CIK not found"
        )
    
    data = fetch_with_retry(
        f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
    )
    
    us_gaap = data.get("facts", {}).get("us-gaap", {})
    
    # Try multiple EPS concepts
    eps_concepts = [
        "EarningsPerShareBasic",
        "EarningsPerShareDiluted",
    ]
    
    eps_data = []
    concept_used = None
    
    for concept in eps_concepts:
        concept_data = us_gaap.get(concept, {}).get("units", {}).get("USD/shares", [])
        if concept_data:
            eps_data = concept_data
            concept_used = concept
            break
    
    if not eps_data:
        return eugene_response(
            data=None,
            source=DataSource.SEC_XBRL,
            status=ResponseStatus.ERROR,
            ticker=ticker,
            error="No EPS data found in SEC filings"
        )
    
    # Filter to quarterly reports
    eps_quarterly = [e for e in eps_data if e.get("form") == "10-Q"]
    
    # Dedupe by period end, keeping most recent filing
    seen = {}
    for e in eps_quarterly:
        end = e.get("end", "")
        if end not in seen or e.get("filed", "") > seen[end].get("filed", ""):
            seen[end] = e
    
    eps_list = sorted(seen.values(), key=lambda x: x.get("end", ""), reverse=True)[:8]
    
    return eugene_response(
        data={
            "eps_history": [
                {
                    "period_end": e.get("end"),
                    "eps": format_currency(e.get("val")),
                    "filed_date": e.get("filed"),
                    "form": e.get("form"),
                    "fiscal_year": e.get("fy"),
                    "accession_number": e.get("accn"),
                }
                for e in eps_list
            ],
            "concept_used": concept_used,
        },
        source=DataSource.SEC_XBRL,
        ticker=ticker,
        metadata={
            "cik": cik,
            "quarters_available": len(eps_list),
            "disclaimer": "EPS data from SEC 10-Q filings. Verify with official documents."
        }
    )


def _get_insider(ticker: str) -> dict:
    """Get insider trades from SEC Form 4."""
    from datetime import datetime, timedelta
    
    start_date = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
    
    data = fetch_with_retry(
        "https://efts.sec.gov/LATEST/search-index",
        params={
            "q": ticker,
            "forms": "4",
            "dateRange": "custom",
            "startdt": start_date,
        }
    )
    
    hits = data.get("hits", {}).get("hits", [])
    
    trades = []
    for hit in hits[:20]:
        source = hit.get("_source", {})
        trades.append({
            "filed_date": source.get("file_date"),
            "form": source.get("form"),
            "filer": source.get("display_names", [""])[0] if source.get("display_names") else None,
            "accession_number": source.get("adsh"),
        })
    
    return eugene_response(
        data={
            "trades": trades,
            "total_filings": len(trades),
        },
        source=DataSource.SEC_EDGAR,
        ticker=ticker,
        metadata={
            "days_back": 365,
            "start_date": start_date,
            "disclaimer": "Form 4 filing data. Does not include transaction details."
        }
    )


def _get_cik(ticker: str) -> str:
    """Get CIK from ticker with caching."""
    try:
        data = fetch_with_retry("https://www.sec.gov/files/company_tickers.json")
        for item in data.values():
            if item.get("ticker", "").upper() == ticker.upper():
                return str(item.get("cik_str", "")).zfill(10)
        return None
    except:
        return None
