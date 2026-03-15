"""
Eugene Intelligence - REST API
Financial data infrastructure for AI agents and developers.
"""
import os
import sys
from typing import Optional, List
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from eugene.config import Config
from eugene.sources.xbrl import XBRLClient
from eugene.sources.edgar import EDGARClient

app = FastAPI(
    title="Eugene Intelligence API",
    description="Financial Data Infrastructure for AI Agents. SEC XBRL + computed metrics.",
    version="1.0.0",
    contact={"name": "Eugene Intelligence", "email": "matthew@eugeneintelligence.com"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

config = Config()
_xbrl = None
_edgar = None
def get_xbrl():
    global _xbrl
    if _xbrl is None:
        _xbrl = XBRLClient(config)
    return _xbrl

def get_edgar():
    global _edgar
    if _edgar is None:
        _edgar = EDGARClient(config)
    return _edgar

@app.get("/")
def root():
    return {
        "service": "Eugene Intelligence API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": ["/v1/financials/{ticker}", "/v1/filings/{ticker}", "/v1/history/{ticker}/{metric}", "/v1/company/{ticker}"],
    }

@app.get("/v1/financials/{ticker}")
def get_financials(ticker: str):
    """Get XBRL financial statements for any public company."""
    try:
        ticker = ticker.upper()
        data = get_xbrl().get_financials(ticker)
        financials = {}
        for key in data.available_keys():
            fact = data.get_fact(key)
            if fact:
                financials[key] = {"value": fact.value, "unit": fact.unit, "period_end": fact.period_end, "xbrl_tag": fact.tag}
        return {"ticker": ticker, "company_name": data.company_name, "data_source": "SEC XBRL", "financials": financials}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/v1/filings/{ticker}")
def get_filings(ticker: str, form_type: Optional[str] = None, limit: int = 10):
    """List recent SEC filings for a company."""
    try:
        ticker = ticker.upper()
        edgar = get_edgar()
        filings = edgar.get_filings(ticker, form_type=form_type, limit=limit)
        company = edgar.get_company_info(ticker)
        return {"ticker": ticker, "company_name": company.name, "filings": [{"form_type": f.form_type, "filed_date": f.filed_date, "accession_number": f.accession_number} for f in filings]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/v1/history/{ticker}/{metric}")
def get_history(ticker: str, metric: str, years: int = 5):
    """Get historical time series for any financial metric."""
    try:
        ticker = ticker.upper()
        years = min(years, 10)
        history = get_xbrl().get_historical(ticker, metric, years=years)
        if not history:
            raise HTTPException(status_code=404, detail=f"No data for metric: {metric}")
        data = [{"fiscal_year": h.fiscal_year, "value": h.value, "period_end": h.period_end} for h in history]
        cagr = None
        if len(history) >= 2:
            first, last = history[0].value, history[-1].value
            if first and first > 0 and last and last > 0:
                cagr = round(((last / first) ** (1.0 / (len(history) - 1)) - 1) * 100, 2)
        return {"ticker": ticker, "metric": metric, "data_source": "SEC XBRL", "data": data, "cagr_pct": cagr}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/v1/company/{ticker}")
def get_company(ticker: str):
    """Get company information from SEC EDGAR."""
    try:
        ticker = ticker.upper()
        company = get_edgar().get_company_info(ticker)
        return {"ticker": ticker, "cik": company.cik, "company_name": company.name, "data_source": "SEC EDGAR"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
