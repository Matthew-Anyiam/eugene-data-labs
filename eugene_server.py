"""
Eugene Intelligence v0.5 — Unified SEC Data Server
FastAPI REST + MCP (stdio, SSE, streamable HTTP) in one file.

Usage:
  python eugene_server.py           → API + MCP on port 8000
  python eugene_server.py --mode mcp → MCP stdio server
"""
import sys
import os
from dotenv import load_dotenv
load_dotenv()

from eugene.router import query, capabilities, VALID_EXTRACTS
from eugene.sources.fred import get_category, get_series, get_all, FRED_SERIES
from eugene.sources.fmp import get_price, get_profile, get_earnings, get_estimates, get_news
from eugene.concepts import VALID_CONCEPTS


# ---------------------------------------------------------------------------
# BUILD MCP SERVER WITH ALL TOOLS + REST ROUTES
# ---------------------------------------------------------------------------
def _build_mcp(include_rest: bool = False):
    """Build the FastMCP server with all tools registered."""
    from mcp.server.fastmcp import FastMCP
    mcp = FastMCP(
        "eugene-intelligence",
        stateless_http=True,
    )

    # --- MCP Tools ---
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

    # --- REST routes (added to MCP Starlette app) ---
    if include_rest:
        from starlette.requests import Request
        from starlette.responses import JSONResponse

        @mcp.custom_route("/health", methods=["GET"])
        async def health(request: Request) -> JSONResponse:
            return JSONResponse({"status": "ok", "version": "0.5.0"})

        @mcp.custom_route("/v1/capabilities", methods=["GET"])
        async def caps_endpoint(request: Request) -> JSONResponse:
            return JSONResponse(capabilities())

        @mcp.custom_route("/v1/concepts", methods=["GET"])
        async def concepts_list(request: Request) -> JSONResponse:
            from eugene.concepts import CANONICAL_CONCEPTS
            return JSONResponse({
                "concepts": {
                    name: {
                        "description": c.get("description", ""),
                        "statement": c.get("statement", ""),
                        "derived": c.get("derived", False),
                    }
                    for name, c in CANONICAL_CONCEPTS.items()
                }
            })

        @mcp.custom_route("/v1/sec/{identifier}", methods=["GET"])
        async def sec_endpoint(request: Request) -> JSONResponse:
            identifier = request.path_params["identifier"]
            extract = request.query_params.get("extract", "financials")
            params = {
                "period": request.query_params.get("period", "FY"),
                "concept": request.query_params.get("concept"),
                "form": request.query_params.get("form"),
                "section": request.query_params.get("section"),
                "limit": int(request.query_params.get("limit", "10")),
            }
            return JSONResponse(query(identifier, extract, **{k: v for k, v in params.items() if v is not None}))

        @mcp.custom_route("/v1/economics/{category}", methods=["GET"])
        async def economics_endpoint(request: Request) -> JSONResponse:
            category = request.path_params["category"]
            series_param = request.query_params.get("series")
            if series_param:
                return JSONResponse(get_series(series_param))
            if category == "all":
                return JSONResponse(get_all())
            return JSONResponse(get_category(category))

        @mcp.custom_route("/v1/sec/{ticker}/prices", methods=["GET"])
        async def prices_compat(request: Request) -> JSONResponse:
            return JSONResponse(get_price(request.path_params["ticker"]))

        @mcp.custom_route("/v1/sec/{ticker}/profile", methods=["GET"])
        async def profile_compat(request: Request) -> JSONResponse:
            return JSONResponse(get_profile(request.path_params["ticker"]))

        @mcp.custom_route("/v1/sec/{ticker}/earnings", methods=["GET"])
        async def earnings_compat(request: Request) -> JSONResponse:
            return JSONResponse(get_earnings(request.path_params["ticker"]))

        @mcp.custom_route("/v1/sec/{ticker}/estimates", methods=["GET"])
        async def estimates_compat(request: Request) -> JSONResponse:
            return JSONResponse(get_estimates(request.path_params["ticker"]))

        @mcp.custom_route("/v1/sec/{ticker}/news", methods=["GET"])
        async def news_compat(request: Request) -> JSONResponse:
            return JSONResponse(get_news(request.path_params["ticker"]))

    return mcp


# ---------------------------------------------------------------------------
# MCP STDIO MODE
# ---------------------------------------------------------------------------
def run_mcp():
    mcp = _build_mcp()
    mcp.run()


# ---------------------------------------------------------------------------
# API + MCP HTTP MODE
# ---------------------------------------------------------------------------
def run_api():
    import logging
    logging.basicConfig(level=logging.INFO)

    port = int(os.environ.get("PORT", 8000))
    mcp = _build_mcp(include_rest=True)
    mcp.settings.port = port
    mcp.settings.host = "0.0.0.0"

    logging.info(f"Starting Eugene v0.5 on port {port}")
    logging.info(f"REST API: http://0.0.0.0:{port}/health")
    logging.info(f"MCP (streamable HTTP): http://0.0.0.0:{port}/mcp")
    logging.info(f"MCP (SSE): http://0.0.0.0:{port}/sse")

    mcp.run(transport="streamable-http")


# ---------------------------------------------------------------------------
# ENTRY POINT
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    if "--mode" in sys.argv and "mcp" in sys.argv:
        run_mcp()
    else:
        run_api()
