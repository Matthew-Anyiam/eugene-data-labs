"""
Eugene Intelligence API
Financial context for AI. https://eugeneintelligence.com
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

app = FastAPI(
    title="Eugene Intelligence API",
    description="Financial context for AI agents. Every number traced to source.",
    version="0.1.0",
    docs_url="/",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/v1/company/{ticker}/prices")
def company_prices(ticker: str):
    from eugene.sources.fmp import get_stock_price
    return get_stock_price(ticker.upper())

@app.get("/v1/company/{ticker}/profile")
def company_profile(ticker: str):
    from eugene.sources.fmp import get_company_profile
    return get_company_profile(ticker.upper())

@app.get("/v1/company/{ticker}/financials")
def company_financials(ticker: str):
    from eugene.sources.xbrl import XBRLClient
    return XBRLClient().get_financials(ticker.upper()).to_dict()

@app.get("/v1/company/{ticker}/health")
def company_health(ticker: str):
    from eugene.agents.health import HealthMonitor
    from eugene.config import Config
    result = HealthMonitor(Config()).analyze(ticker.upper())
    return result.to_dict() if hasattr(result, "to_dict") else result

@app.get("/v1/company/{ticker}/earnings")
def company_earnings(ticker: str):
    from eugene.sources.fmp import get_earnings
    return get_earnings(ticker.upper())

@app.get("/v1/company/{ticker}/insider")
def company_insider(ticker: str):
    from eugene.sources.insider import get_insider_transactions
    return get_insider_transactions(ticker.upper())

@app.get("/v1/company/{ticker}/institutional")
def company_institutional(ticker: str):
    from eugene.sources.holdings_13f import get_whale_holdings
    return get_whale_holdings(ticker.upper())

@app.get("/v1/company/{ticker}/filings")
def company_filings(ticker: str, filing_type: str = None, limit: int = 10):
    from eugene.sources.edgar import EDGARClient
    from eugene.config import Config
    client = EDGARClient(Config())
    filings = client.get_filings(ticker.upper(), filing_type=filing_type, limit=limit)
    return {"ticker": ticker.upper(), "filings": [{"type": f.filing_type, "date": f.filing_date, "accession": f.accession_number, "url": f.filing_url} for f in filings], "source": "SEC EDGAR"}

@app.get("/v1/company/{ticker}/estimates")
def company_estimates(ticker: str):
    from eugene.sources.fmp import get_analyst_estimates
    return get_analyst_estimates(ticker.upper())

@app.get("/v1/company/{ticker}/news")
def company_news(ticker: str, limit: int = 20):
    from eugene.sources.fmp import get_stock_news
    return get_stock_news(ticker.upper(), limit)

@app.get("/v1/economy/{category}")
def economy(category: str):
    if category == "treasury":
        from eugene.sources.fred import get_economic_data
        yields = {}
        for s in ["DGS1", "DGS2", "DGS5", "DGS10", "DGS30"]:
            data = get_economic_data(s)
            if "observations" in data and data["observations"]:
                yields[s] = data["observations"][-1].get("value")
        return {"yields": yields, "source": "FRED"}
    from eugene.sources.fred import get_latest_indicators
    return get_latest_indicators(category)

@app.get("/v1/regulatory/fed-funds-rate")
def fed_funds_rate():
    from eugene.sources.fred import get_economic_data
    data = get_economic_data("FEDFUNDS")
    if "observations" in data and data["observations"]:
        latest = data["observations"][-1]
        return {"rate": latest.get("value"), "date": latest.get("date"), "source": "FRED"}
    return {"error": "No data"}

@app.get("/v1/research/{ticker}/equity")
def research_equity(ticker: str):
    from eugene.agents.equity import EquityResearchAgent
    from eugene.config import Config
    result = EquityResearchAgent(Config()).analyze(ticker.upper())
    if hasattr(result, "__dict__") and not isinstance(result, dict):
        return {"ticker": result.ticker, "data": getattr(result, "data", {}), "summary": getattr(result, "summary", "")}
    return result

@app.get("/v1/research/{ticker}/credit")
def research_credit(ticker: str):
    from eugene.agents.credit import CreditMonitorAgent
    from eugene.config import Config
    result = CreditMonitorAgent(Config()).analyze(ticker.upper())
    if hasattr(result, "__dict__") and not isinstance(result, dict):
        return {"ticker": result.ticker, "data": getattr(result, "data", {}), "summary": getattr(result, "summary", "")}
    return result

@app.get("/v1/health")
def api_health():
    return {"status": "ok", "service": "eugene-intelligence", "version": "0.1.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
