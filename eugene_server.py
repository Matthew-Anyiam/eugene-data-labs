"""
Eugene Intelligence v0.6 — Unified SEC Data Server
FastAPI REST + MCP (stdio, SSE, streamable HTTP) in one file.

Usage:
  python eugene_server.py           -> API + MCP on port 8000
  python eugene_server.py --mode mcp -> MCP stdio server
"""
import sys
import os
from dotenv import load_dotenv
load_dotenv()

from eugene.router import query, capabilities, VALID_EXTRACTS, VERSION
from eugene.sources.fred import get_category, get_series, get_all, FRED_SERIES
from eugene.sources.fmp import (
    get_price, get_profile, get_earnings, get_estimates, get_news,
    get_historical_bars, get_screener, get_crypto_quote, get_shares_float,
)
from eugene.concepts import VALID_CONCEPTS
from eugene.auth import require_api_key


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
        extract: profile|filings|financials|concepts|insiders|ownership|events|sections|exhibits|metrics|ohlcv|technicals|segments|float|corporate_actions (comma-separated)
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
    def screener(
        market_cap_min: int = None, market_cap_max: int = None,
        price_min: float = None, price_max: float = None,
        volume_min: int = None, sector: str = None,
        country: str = None, beta_min: float = None,
        beta_max: float = None, limit: int = 50,
    ) -> dict:
        """Screen stocks by market cap, price, volume, sector, beta, country.

        sector: Technology|Healthcare|Financial Services|Consumer Cyclical|...
        country: US|GB|DE|JP|CN|...
        """
        return get_screener(
            market_cap_min=market_cap_min, market_cap_max=market_cap_max,
            price_min=price_min, price_max=price_max,
            volume_min=volume_min, sector=sector, country=country,
            beta_min=beta_min, beta_max=beta_max, limit=limit,
        )

    @mcp.tool()
    def crypto(symbol: str, type: str = "quote") -> dict:
        """Crypto quotes and historical data.

        symbol: BTCUSD, ETHUSD, SOLUSD, etc.
        type: quote|daily|1hour|5min
        """
        if type == "quote":
            return get_crypto_quote(symbol)
        return get_historical_bars(symbol, interval=type)

    @mcp.tool()
    def caps() -> dict:
        """List all available Eugene tools, extracts, and capabilities."""
        return capabilities()

    # --- REST routes (added to MCP Starlette app) ---
    if include_rest:
        from starlette.requests import Request
        from starlette.responses import JSONResponse, Response, StreamingResponse
        import asyncio
        import json as json_mod

        @mcp.custom_route("/", methods=["GET"])
        async def root(request: Request) -> JSONResponse:
            return JSONResponse({
                "service": "Eugene Intelligence",
                "version": VERSION,
                "status": "ok",
                "docs": {
                    "health": "/health",
                    "capabilities": "/v1/capabilities",
                    "concepts": "/v1/concepts",
                },
                "endpoints": {
                    "sec_data": "/v1/sec/{identifier}?extract=financials",
                    "economics": "/v1/economics/{category}",
                    "screener": "/v1/screener?sector=Technology",
                    "crypto": "/v1/crypto/{symbol}",
                    "export": "/v1/sec/{identifier}/export?format=csv",
                    "stream": "/v1/stream/filings",
                    "prices": "/v1/sec/{ticker}/prices",
                    "profile": "/v1/sec/{ticker}/profile",
                    "ohlcv": "/v1/sec/{ticker}/ohlcv",
                    "earnings": "/v1/sec/{ticker}/earnings",
                    "estimates": "/v1/sec/{ticker}/estimates",
                    "news": "/v1/sec/{ticker}/news",
                },
                "mcp": {
                    "streamable_http": "/mcp",
                    "sse": "/sse",
                },
            })

        @mcp.custom_route("/health", methods=["GET"])
        async def health(request: Request) -> JSONResponse:
            return JSONResponse({"status": "ok", "version": VERSION})

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
        @require_api_key
        async def sec_endpoint(request: Request) -> JSONResponse:
            identifier = request.path_params["identifier"]
            extract = request.query_params.get("extract", "financials")
            params = {
                "period": request.query_params.get("period", "FY"),
                "concept": request.query_params.get("concept"),
                "form": request.query_params.get("form"),
                "section": request.query_params.get("section"),
                "interval": request.query_params.get("interval"),
                "from": request.query_params.get("from"),
                "to": request.query_params.get("to"),
                "limit": int(request.query_params.get("limit", "10")),
            }
            return JSONResponse(query(identifier, extract, **{k: v for k, v in params.items() if v is not None}))

        @mcp.custom_route("/v1/economics/{category}", methods=["GET"])
        @require_api_key
        async def economics_endpoint(request: Request) -> JSONResponse:
            category = request.path_params["category"]
            series_param = request.query_params.get("series")
            if series_param:
                return JSONResponse(get_series(series_param))
            if category == "all":
                return JSONResponse(get_all())
            return JSONResponse(get_category(category))

        # --- v0.6 convenience routes ---

        @mcp.custom_route("/v1/screener", methods=["GET"])
        @require_api_key
        async def screener_endpoint(request: Request) -> JSONResponse:
            p = request.query_params
            return JSONResponse(get_screener(
                market_cap_min=int(p["marketCapMin"]) if "marketCapMin" in p else None,
                market_cap_max=int(p["marketCapMax"]) if "marketCapMax" in p else None,
                price_min=float(p["priceMin"]) if "priceMin" in p else None,
                price_max=float(p["priceMax"]) if "priceMax" in p else None,
                volume_min=int(p["volumeMin"]) if "volumeMin" in p else None,
                sector=p.get("sector"),
                country=p.get("country"),
                beta_min=float(p["betaMin"]) if "betaMin" in p else None,
                beta_max=float(p["betaMax"]) if "betaMax" in p else None,
                limit=int(p.get("limit", "50")),
            ))

        @mcp.custom_route("/v1/crypto/{symbol}", methods=["GET"])
        @require_api_key
        async def crypto_endpoint(request: Request) -> JSONResponse:
            symbol = request.path_params["symbol"]
            interval = request.query_params.get("interval", "quote")
            if interval == "quote":
                return JSONResponse(get_crypto_quote(symbol))
            return JSONResponse(get_historical_bars(symbol, interval=interval))

        @mcp.custom_route("/v1/sec/{ticker}/prices", methods=["GET"])
        @require_api_key
        async def prices_compat(request: Request) -> JSONResponse:
            return JSONResponse(get_price(request.path_params["ticker"]))

        @mcp.custom_route("/v1/sec/{ticker}/profile", methods=["GET"])
        @require_api_key
        async def profile_compat(request: Request) -> JSONResponse:
            return JSONResponse(get_profile(request.path_params["ticker"]))

        @mcp.custom_route("/v1/sec/{ticker}/ohlcv", methods=["GET"])
        @require_api_key
        async def ohlcv_compat(request: Request) -> JSONResponse:
            ticker = request.path_params["ticker"]
            interval = request.query_params.get("interval", "daily")
            from_date = request.query_params.get("from")
            to_date = request.query_params.get("to")
            return JSONResponse(get_historical_bars(ticker, interval, from_date, to_date))

        @mcp.custom_route("/v1/sec/{ticker}/earnings", methods=["GET"])
        @require_api_key
        async def earnings_compat(request: Request) -> JSONResponse:
            return JSONResponse(get_earnings(request.path_params["ticker"]))

        @mcp.custom_route("/v1/sec/{ticker}/estimates", methods=["GET"])
        @require_api_key
        async def estimates_compat(request: Request) -> JSONResponse:
            return JSONResponse(get_estimates(request.path_params["ticker"]))

        @mcp.custom_route("/v1/sec/{ticker}/news", methods=["GET"])
        @require_api_key
        async def news_compat(request: Request) -> JSONResponse:
            return JSONResponse(get_news(request.path_params["ticker"]))

        @mcp.custom_route("/v1/sec/{identifier}/export", methods=["GET"])
        @require_api_key
        async def export_endpoint(request: Request) -> Response:
            identifier = request.path_params["identifier"]
            fmt = request.query_params.get("format", "json")
            extract = request.query_params.get("extract", "financials")
            params = {
                "period": request.query_params.get("period", "FY"),
                "limit": int(request.query_params.get("limit", "10")),
            }
            if fmt == "csv":
                from eugene.handlers.export import export_financials_csv
                csv_data = export_financials_csv(identifier, extract, **params)
                return Response(
                    content=csv_data, media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename={identifier}_{extract}.csv"},
                )
            else:
                return JSONResponse(query(identifier, extract, **params))

        @mcp.custom_route("/v1/stream/filings", methods=["GET"])
        async def stream_filings(request: Request) -> StreamingResponse:
            """SSE endpoint for real-time SEC filing alerts."""
            form_filter = request.query_params.get("form")
            ticker_filter = request.query_params.get("ticker")

            async def event_generator():
                from eugene.sources.realtime import get_recent_filings
                seen = set()
                while True:
                    try:
                        filings = get_recent_filings(minutes=2)
                        for filing in filings:
                            fid = filing.get("accession_number", filing.get("url", ""))
                            if fid in seen:
                                continue
                            seen.add(fid)
                            if form_filter and filing.get("form_type") != form_filter:
                                continue
                            if ticker_filter and ticker_filter.upper() not in (filing.get("title") or "").upper():
                                continue
                            yield f"data: {json_mod.dumps(filing, default=str)}\n\n"
                        if len(seen) > 500:
                            seen.clear()
                        await asyncio.sleep(30)
                    except asyncio.CancelledError:
                        break
                    except Exception:
                        await asyncio.sleep(60)

            return StreamingResponse(
                event_generator(),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
            )

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

    logging.info(f"Starting Eugene v{VERSION} on port {port}")
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
