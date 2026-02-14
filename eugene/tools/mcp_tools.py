"""
Eugene Intelligence — Consolidated MCP Tools
4 tools covering all financial data
"""

COMPANY_TYPES = ["prices", "profile", "financials", "health", "earnings", "insider", "institutional", "filings"]

def company(ticker: str, type: str = "prices") -> dict:
    ticker = ticker.upper().strip()
    if type == "prices":
        from eugene.sources.fmp import get_stock_price
        return get_stock_price(ticker)
    elif type == "profile":
        from eugene.sources.fmp import get_company_profile
        return get_company_profile(ticker)
    elif type == "financials":
        from eugene.sources.xbrl import XBRLClient
        client = XBRLClient()
        return client.get_financials(ticker).to_dict()
    elif type == "health":
        from eugene.agents.health import HealthMonitor
        from eugene.config import Config
        result = HealthMonitor(Config()).analyze(ticker)
        return result.to_dict() if hasattr(result, 'to_dict') else result
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
    if category == "treasury":
        from eugene.sources.fred import get_economic_data
        yields = {}
        for s in ["DGS1", "DGS2", "DGS5", "DGS10", "DGS30"]:
            data = get_economic_data(s)
            if "observations" in data and data["observations"]:
                yields[s] = data["observations"][-1].get("value")
        return {"yields": yields, "source": "FRED"}
    else:
        from eugene.sources.fred import get_latest_indicators
        return get_latest_indicators(category)

REGULATORY_TYPES = ["fed_funds_rate", "sec_filings", "company_risk"]

def regulatory(type: str = "fed_funds_rate", ticker: str = None, limit: int = 10) -> dict:
    if type == "fed_funds_rate" or type == "fed_speeches" or type == "fomc":
        from eugene.sources.fred import get_economic_data
        data = get_economic_data("FEDFUNDS")
        if "observations" in data and data["observations"]:
            latest = data["observations"][-1]
            return {"rate": latest.get("value"), "date": latest.get("date"), "source": "FRED"}
        return {"error": "No data"}
    elif type == "sec_press" or type == "sec_enforcement" or type == "sec_filings":
        if not ticker:
            return {"error": "ticker required"}
        from eugene.sources.edgar import EDGARClient
        from eugene.config import Config
        client = EDGARClient(Config())
        filings = client.get_filings(ticker.upper(), limit=limit)
        return {"ticker": ticker.upper(), "filings": [{"type": f.filing_type, "date": f.filing_date, "url": f.filing_url} for f in filings], "source": "SEC EDGAR"}
    elif type == "treasury_debt":
        from eugene.sources.fred import get_economic_data
        yields = {}
        for s in ["DGS2", "DGS10", "DGS30"]:
            data = get_economic_data(s)
            if "observations" in data and data["observations"]:
                yields[s] = data["observations"][-1].get("value")
        return {"yields": yields, "source": "FRED"}
    elif type == "company_risk":
        if not ticker:
            return {"error": "ticker required"}
        from eugene.sources.edgar import EDGARClient
        from eugene.config import Config
        client = EDGARClient(Config())
        filings = client.get_filings(ticker.upper(), filing_type="8-K", limit=limit)
        return {"ticker": ticker.upper(), "recent_8k_count": len(filings), "filings": [{"type": f.filing_type, "date": f.filing_date, "url": f.filing_url} for f in filings], "source": "SEC EDGAR"}
    else:
        return {"error": f"Unknown type: {type}"}

RESEARCH_TYPES = ["equity", "credit"]

def research(ticker: str, type: str = "equity") -> dict:
    ticker = ticker.upper().strip()
    if type == "equity":
        from eugene.agents.equity import EquityResearchAgent
        from eugene.config import Config
        result = EquityResearchAgent(Config()).analyze(ticker)
        if hasattr(result, '__dict__') and not isinstance(result, dict):
            return {"ticker": result.ticker, "data": getattr(result, 'data', {}), "summary": getattr(result, 'summary', '')}
        return result
    elif type == "credit":
        from eugene.agents.credit import CreditMonitorAgent
        from eugene.config import Config
        result = CreditMonitorAgent(Config()).analyze(ticker)
        if hasattr(result, '__dict__') and not isinstance(result, dict):
            return {"ticker": result.ticker, "data": getattr(result, 'data', {}), "summary": getattr(result, 'summary', '')}
        return result
    else:
        return {"error": f"Unknown type: {type}", "valid": RESEARCH_TYPES}
