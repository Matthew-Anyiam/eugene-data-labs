"""
Eugene Intelligence v0.4 — Unified SEC Data Server
FastAPI + MCP in one file.

Usage:
  python eugene_server.py           → FastAPI on port 8000
  python eugene_server.py --mode mcp → MCP stdio server
"""
import sys
import os
from eugene.router import query, capabilities, VALID_EXTRACTS
from eugene.sources.fred import get_category, get_series, get_all, FRED_SERIES
from eugene.sources.fmp import get_price, get_profile, get_earnings, get_estimates, get_news
from eugene.concepts import VALID_CONCEPTS

# ---------------------------------------------------------------------------
# MCP MODE
# ---------------------------------------------------------------------------
def run_mcp():
    from mcp.server.fastmcp import FastMCP
    mcp = FastMCP("eugene-intelligence")

    @mcp.tool()
    def sec(
        identifier: str,
        extract: str = "financials",
        period: str = "FY",
        concept: str = None,
        form: str = None,
        section: str = None,
        date_from: str = None,
        date_to: str = None,
        limit: int = 10,
    ) -> dict:
        """All SEC EDGAR data in one tool.

        identifier: ticker (AAPL), CIK (320193), or accession number
        extract: profile|filings|financials|concepts|insiders|ownership|events|sections|exhibits (comma-separated)
        period: FY|Q (for financials)
        concept: canonical concept (revenue,net_income,...) or raw XBRL tag
        form: 10-K|10-Q|8-K|4|13F-HR (filter)
        section: mdna|risk_factors|business|legal (for sections)
        limit: max results (default 10)
        """
        params = {
            "period": period, "concept": concept, "form": form,
            "section": section, "from": date_from, "to": date_to,
            "limit": limit,
        }
        return query(identifier, extract, **{k: v for k, v in params.items() if v is not None})

    @mcp.tool()
    def economics(category: str = "all", series: str = None) -> dict:
        """All economic data from FRED.

        category: inflation|employment|gdp|housing|consumer|manufacturing|rates|money|treasury|all
        series: specific FRED series ID (e.g. CPIAUCSL)
        """
        if series:
            return get_series(series)
        if category == "all":
            return get_all()
        return get_category(category)

    @mcp.tool()
    def caps() -> dict:
        """List all available Eugene tools, extracts, and capabilities."""
        return capabilities()

    mcp.run()


# ---------------------------------------------------------------------------
# FASTAPI MODE
# ---------------------------------------------------------------------------
def run_api():
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    import uvicorn

    app = FastAPI(
        title="Eugene Intelligence",
        description="Financial context for AI. SEC EDGAR + FRED. Every number traced to source.",
        version="0.4.0",
        docs_url="/",
        redoc_url="/redoc",
    )

    @app.get("/health")
    def health():
        return {"status": "ok", "version": "0.4.0"}

    @app.get("/v1/capabilities")
    def caps_endpoint():
        return capabilities()

    @app.get("/v1/concepts")
    def concepts_list():
        from eugene.concepts import CANONICAL_CONCEPTS
        return {
            "concepts": {
                name: {
                    "description": c.get("description", ""),
                    "statement": c.get("statement", ""),
                    "derived": c.get("derived", False),
                }
                for name, c in CANONICAL_CONCEPTS.items()
            }
        }

    @app.get("/v1/sec/{identifier}")
    def sec_endpoint(
        identifier: str,
        extract: str = "financials",
        period: str = "FY",
        concept: str = None,
        form: str = None,
        section: str = None,
        limit: int = 10,
        
    ):
        params = {
            "period": period, "concept": concept, "form": form,
            "section": section, "limit": limit,
        }
        return query(identifier, extract, **{k: v for k, v in params.items() if v is not None})

    @app.get("/v1/economics/{category}")
    def economics_endpoint(category: str = "all", series: str = None):
        if series:
            return get_series(series)
        if category == "all":
            return get_all()
        return get_category(category)

    # Keep v0.3 routes for backward compatibility
    @app.get("/v1/sec/{ticker}/prices")
    def prices_compat(ticker: str):
        return get_price(ticker)

    @app.get("/v1/sec/{ticker}/profile")
    def profile_compat(ticker: str):
        return get_profile(ticker)

    @app.get("/v1/sec/{ticker}/earnings")
    def earnings_compat(ticker: str):
        return get_earnings(ticker)

    @app.get("/v1/sec/{ticker}/estimates")
    def estimates_compat(ticker: str):
        return get_estimates(ticker)

    @app.get("/v1/sec/{ticker}/news")
    def news_compat(ticker: str):
        return get_news(ticker)

    port = int(os.environ.get("PORT", 8000))
    import logging
    logging.basicConfig(level=logging.INFO)
    logging.info(f"Starting Eugene v0.4 on port {port}")
    try:
        from eugene.router import query
        logging.info("Router imported OK")
    except Exception as e:
        logging.error(f"Import failed: {e}")
    uvicorn.run(app, host="0.0.0.0", port=port)


# ---------------------------------------------------------------------------
# ENTRY POINT
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    if "--mode" in sys.argv and "mcp" in sys.argv:
        run_mcp()
    else:
        run_api()
