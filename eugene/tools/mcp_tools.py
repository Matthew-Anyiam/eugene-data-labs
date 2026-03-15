"""
Eugene Intelligence — Consolidated MCP Tools
4 tools covering all financial data
"""

COMPANY_TYPES = ["prices", "profile", "financials", "earnings", "insider", "institutional", "filings"]

def company(ticker: str, type: str = "prices") -> dict:
    ticker = ticker.upper().strip()
    if type == "prices":
        from eugene.sources.fmp import get_price
        return get_price(ticker)
    elif type == "profile":
        from eugene.sources.fmp import get_profile
        return get_profile(ticker)
    elif type == "financials":
        from eugene.sources.xbrl import XBRLClient
        client = XBRLClient()
        return client.get_financials(ticker).to_dict()
    elif type == "earnings":
        from eugene.sources.fmp import get_earnings
        return get_earnings(ticker)
    elif type == "insider":
        from eugene.sources.insider import get_insider_transactions
        return get_insider_transactions(ticker)
    elif type == "institutional":
        from eugene.sources.holdings_13f import get_whale_holdings
        return get_whale_holdings(ticker)
    elif type == "filings":
        from eugene.sources.edgar import EDGARClient
        from eugene.config import Config
        client = EDGARClient(Config())
        filings = client.get_filings(ticker, limit=10)
        return {"ticker": ticker, "filings": [{"type": f.filing_type, "date": f.filing_date, "url": f.filing_url} for f in filings], "source": "SEC EDGAR"}
    else:
        return {"error": f"Unknown type: {type}", "valid": COMPANY_TYPES}

ECONOMY_TYPES = ["inflation", "employment", "gdp", "housing", "consumer", "manufacturing", "rates", "treasury", "all"]

def economy(category: str = "all") -> dict:
    from eugene.sources.fred import get_category, get_all
    if category == "all":
        return get_all()
    return get_category(category)

REGULATORY_TYPES = ["fed_funds_rate", "sec_filings", "company_risk"]

def regulatory(type: str = "fed_funds_rate", ticker: str = None, limit: int = 10) -> dict:
    if type == "fed_funds_rate" or type == "fed_speeches" or type == "fomc":
        from eugene.sources.fred import get_series
        return get_series("FEDFUNDS")
    elif type == "sec_press" or type == "sec_enforcement" or type == "sec_filings":
        if not ticker:
            return {"error": "ticker required"}
        from eugene.router import query
        return query(ticker.upper(), "filings", limit=limit)
    elif type == "treasury_debt":
        from eugene.sources.fred import get_category
        return get_category("treasury")
    elif type == "company_risk":
        if not ticker:
            return {"error": "ticker required"}
        from eugene.router import query
        return query(ticker.upper(), "events", limit=limit)
    else:
        return {"error": f"Unknown type: {type}"}

