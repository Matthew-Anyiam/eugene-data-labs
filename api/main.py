"""
Eugene Intelligence - REST API

FastAPI application for serving financial data.
This is the real API, not scaffolding.
"""

import logging
import time
from typing import Optional
from contextlib import asynccontextmanager

try:
    from fastapi import FastAPI, HTTPException, Query
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False

from eugene.config import Config, get_config
from eugene.extraction.llm import LLMClient, MockLLMClient
from eugene.sources.edgar import EDGARClient, EDGARError, FilingNotFoundError

logger = logging.getLogger(__name__)


def create_app(config: Optional[Config] = None, mock: bool = False) -> "FastAPI":
    """
    Create FastAPI application.
    
    Args:
        config: Configuration (uses default if None)
        mock: If True, use mock LLM client
    
    Returns:
        FastAPI app
    """
    if not HAS_FASTAPI:
        raise ImportError("FastAPI not installed. Run: pip install fastapi uvicorn")
    
    config = config or get_config()
    
    # Initialize clients
    llm_client = MockLLMClient(config) if mock else LLMClient(config)
    
    app = FastAPI(
        title="Eugene Intelligence API",
        description="Financial Context Infrastructure for AI Agents",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc"
    )
    
    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Store clients in app state
    app.state.config = config
    app.state.llm_client = llm_client
    app.state.start_time = time.time()
    
    # =========================================================================
    # Health Endpoints
    # =========================================================================
    
    @app.get("/health")
    async def health():
        """Service health check"""
        uptime = time.time() - app.state.start_time
        return {
            "status": "healthy",
            "version": "0.1.0",
            "uptime_seconds": round(uptime, 1),
            "api_key_configured": config.api.is_configured,
            "mode": "mock" if mock else "live"
        }
    
    @app.get("/health/ready")
    async def readiness():
        """Readiness check - is the service ready to handle requests?"""
        issues = config.validate()
        is_ready = len(issues) == 0 or mock
        
        return {
            "ready": is_ready,
            "issues": issues if not is_ready else [],
            "mode": "mock" if mock else "live"
        }
    
    # =========================================================================
    # Company Endpoints
    # =========================================================================
    
    @app.get("/v1/company/{ticker}")
    async def get_company(ticker: str):
        """Get company information from EDGAR"""
        try:
            edgar = EDGARClient(config)
            company = edgar.get_company(ticker.upper())
            
            return {
                "data": {
                    "ticker": ticker.upper(),
                    "name": company.name,
                    "cik": company.cik,
                    "sic": company.sic,
                    "state": company.state
                }
            }
        except FilingNotFoundError:
            raise HTTPException(status_code=404, detail=f"Company not found: {ticker}")
        except EDGARError as e:
            raise HTTPException(status_code=502, detail=f"EDGAR error: {str(e)}")
    
    @app.get("/v1/company/{ticker}/filings")
    async def get_company_filings(
        ticker: str,
        filing_type: Optional[str] = Query(None, description="10-K, 10-Q, 8-K, etc"),
        limit: int = Query(10, ge=1, le=50)
    ):
        """Get recent filings for a company"""
        try:
            edgar = EDGARClient(config)
            filings = edgar.get_filings(
                ticker.upper(),
                filing_type=filing_type,
                limit=limit
            )
            
            return {
                "data": {
                    "ticker": ticker.upper(),
                    "count": len(filings),
                    "filings": [f.to_dict() for f in filings]
                }
            }
        except FilingNotFoundError:
            raise HTTPException(status_code=404, detail=f"Company not found: {ticker}")
        except EDGARError as e:
            raise HTTPException(status_code=502, detail=f"EDGAR error: {str(e)}")
    
    # =========================================================================
    # Credit Intelligence Endpoints
    # =========================================================================
    
    @app.get("/v1/credit/{ticker}/debt")
    async def get_debt_schedule(ticker: str):
        """
        Get structured debt schedule for a company.
        
        Extracts from latest 10-K:
        - Individual debt instruments
        - Total debt
        - Maturity schedule
        """
        from eugene.extraction.llm import create_debt_extraction_request
        from eugene.models.base import DebtInstrument, DebtExtraction, ExtractionMetadata
        from eugene.validation.engine import validate_debt
        
        try:
            # 1. Get latest 10-K
            edgar = EDGARClient(config)
            filings = edgar.get_filings(ticker.upper(), filing_type="10-K", limit=1)
            
            if not filings:
                raise HTTPException(status_code=404, detail=f"No 10-K found for {ticker}")
            
            filing = filings[0]
            
            # 2. Get filing content
            content = edgar.get_filing_content(filing)
            text = edgar.extract_text_from_html(content)
            
            # 3. Extract debt info via LLM
            request = create_debt_extraction_request(text[:10000])  # First 10K chars
            response = app.state.llm_client.extract_with_retry(request)
            
            if not response.success:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Extraction failed: {response.error}"
                )
            
            # 4. Validate
            validation = validate_debt(response.data)
            
            # 5. Return
            return {
                "data": response.data,
                "metadata": {
                    "ticker": ticker.upper(),
                    "source_filing": filing.accession_number,
                    "filing_date": filing.filing_date,
                    "confidence": validation.confidence_score,
                    "validation": validation.to_dict()
                }
            }
            
        except HTTPException:
            raise
        except EDGARError as e:
            raise HTTPException(status_code=502, detail=f"EDGAR error: {str(e)}")
        except Exception as e:
            logger.error(f"Error extracting debt for {ticker}: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    # =========================================================================
    # Employee / Layoff Endpoints
    # =========================================================================
    
    @app.get("/v1/employees/{ticker}")
    async def get_employees(ticker: str):
        """
        Get employee data and layoff info for a company.
        
        Michelle Leder's #1 recommended use case:
        "Tell me anytime a company has lost employees"
        """
        from eugene.extraction.parsers.employees import (
            analyze_company_employees, find_employee_sections
        )
        
        try:
            # 1. Get latest 10-K
            edgar = EDGARClient(config)
            filings = edgar.get_filings(ticker.upper(), filing_type="10-K", limit=1)
            
            if not filings:
                raise HTTPException(status_code=404, detail=f"No 10-K found for {ticker}")
            
            filing = filings[0]
            
            # 2. Get filing content
            content = edgar.get_filing_content(filing)
            text = edgar.extract_text_from_html(content)
            
            # 3. Analyze
            result = analyze_company_employees(
                filing_text=text,
                ticker=ticker.upper(),
                company_name=filing.company_name,
                llm_client=app.state.llm_client,
                source_filing=filing.accession_number
            )
            
            return {
                "data": result.to_dict(),
                "metadata": {
                    "source_filing": filing.accession_number,
                    "filing_date": filing.filing_date,
                    "alert": result.severity != "none",
                    "alert_severity": result.severity
                }
            }
            
        except HTTPException:
            raise
        except EDGARError as e:
            raise HTTPException(status_code=502, detail=f"EDGAR error: {str(e)}")
        except Exception as e:
            logger.error(f"Error analyzing employees for {ticker}: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    # =========================================================================
    # Tariff Impact Endpoint
    # =========================================================================
    
    @app.get("/v1/tariffs/{ticker}")
    async def get_tariff_impact(ticker: str):
        """
        Get tariff/trade impact analysis for a company.
        
        Extracts from Risk Factors and MD&A sections.
        """
        from eugene.extraction.parsers.employees import (
            extract_tariff_impact, find_tariff_sections
        )
        
        try:
            edgar = EDGARClient(config)
            filings = edgar.get_filings(ticker.upper(), filing_type="10-K", limit=1)
            
            if not filings:
                raise HTTPException(status_code=404, detail=f"No 10-K found for {ticker}")
            
            filing = filings[0]
            content = edgar.get_filing_content(filing)
            text = edgar.extract_text_from_html(content)
            
            # Find tariff sections
            sections = find_tariff_sections(text)
            
            if not sections:
                return {
                    "data": {
                        "ticker": ticker.upper(),
                        "has_tariff_exposure": False,
                        "message": "No tariff-related disclosures found"
                    }
                }
            
            combined = "\n\n".join(sections[:3])
            result = extract_tariff_impact(
                text=combined,
                ticker=ticker.upper(),
                company_name=filing.company_name,
                llm_client=app.state.llm_client
            )
            
            return {
                "data": result,
                "metadata": {
                    "source_filing": filing.accession_number,
                    "filing_date": filing.filing_date,
                    "sections_analyzed": len(sections)
                }
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error analyzing tariffs for {ticker}: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    # =========================================================================
    # Error Handlers
    # =========================================================================
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request, exc):
        logger.error(f"Unhandled error: {exc}")
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "type": type(exc).__name__,
                    "message": str(exc)
                }
            }
        )
    
    return app


# Create default app instance
app = create_app(mock=True)  # Default to mock mode


if __name__ == "__main__":
    import uvicorn
    
    print("Starting Eugene Intelligence API...")
    print("Mode: MOCK (no API key needed)")
    print("Docs: http://localhost:8000/docs")
    print()
    
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
