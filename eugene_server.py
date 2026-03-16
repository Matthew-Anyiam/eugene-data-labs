"""
Eugene Intelligence v0.8 — Unified SEC Data Server
FastAPI REST + MCP (stdio, SSE, streamable HTTP) in one file.

All sync data-source calls are wrapped in ``asyncio.to_thread()`` so
the async event loop is never blocked by network I/O.

Usage:
  python eugene_server.py           -> API + MCP on port 8000
  python eugene_server.py --mode mcp -> MCP stdio server
"""
import sys
import os
import logging
from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)

from eugene.router import query, capabilities, VERSION
from eugene.sources.fred import get_category, get_series, get_all
from eugene.sources.fmp import (
    get_price, get_profile, get_earnings, get_estimates, get_news,
    get_historical_bars, get_screener, get_crypto_quote,
)
from eugene.auth import require_api_key
from eugene.cache import get_disk_cache


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
        extract: profile|filings|financials|concepts|insiders|ownership|events|sections|exhibits|metrics|ohlcv|technicals|segments|float|corporate_actions|transcripts|peers (comma-separated)
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

        def _safe_int(value: str, default: int, name: str) -> int | JSONResponse:
            """Parse int from query param, return JSONResponse on failure."""
            try:
                return int(value)
            except (ValueError, TypeError):
                return JSONResponse({"error": f"Invalid integer for '{name}': {value}"}, status_code=400)

        def _safe_float(value: str, default: float, name: str) -> float | JSONResponse:
            """Parse float from query param, return JSONResponse on failure."""
            try:
                return float(value)
            except (ValueError, TypeError):
                return JSONResponse({"error": f"Invalid number for '{name}': {value}"}, status_code=400)

        @mcp.custom_route("/", methods=["GET"])
        async def root(request: Request) -> Response:
            # Serve the dashboard
            import pathlib
            html_path = pathlib.Path(__file__).parent / "static" / "index.html"
            if html_path.exists():
                return Response(content=html_path.read_text(), media_type="text/html")
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
                },
                "mcp": {
                    "streamable_http": "/mcp",
                    "sse": "/sse",
                },
            })

        @mcp.custom_route("/api", methods=["GET"])
        async def api_info(request: Request) -> JSONResponse:
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
        @require_api_key
        async def caps_endpoint(request: Request) -> JSONResponse:
            return JSONResponse(capabilities())

        @mcp.custom_route("/v1/concepts", methods=["GET"])
        @require_api_key
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
            limit = _safe_int(request.query_params.get("limit", "10"), 10, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            params = {
                "period": request.query_params.get("period", "FY"),
                "concept": request.query_params.get("concept"),
                "form": request.query_params.get("form"),
                "section": request.query_params.get("section"),
                "interval": request.query_params.get("interval"),
                "from": request.query_params.get("from"),
                "to": request.query_params.get("to"),
                "limit": limit,
            }
            clean = {k: v for k, v in params.items() if v is not None}
            result = await asyncio.to_thread(query, identifier, extract, **clean)
            return JSONResponse(result)

        @mcp.custom_route("/v1/economics/{category}", methods=["GET"])
        @require_api_key
        async def economics_endpoint(request: Request) -> JSONResponse:
            category = request.path_params["category"]
            series_param = request.query_params.get("series")
            if series_param:
                result = await asyncio.to_thread(get_series, series_param)
                return JSONResponse(result)
            if category == "all":
                result = await asyncio.to_thread(get_all)
                return JSONResponse(result)
            result = await asyncio.to_thread(get_category, category)
            return JSONResponse(result)

        # --- v0.6 convenience routes ---

        @mcp.custom_route("/v1/screener", methods=["GET"])
        @require_api_key
        async def screener_endpoint(request: Request) -> JSONResponse:
            p = request.query_params
            parsed = {}
            for name, conv, key in [
                ("marketCapMin", _safe_int, "market_cap_min"),
                ("marketCapMax", _safe_int, "market_cap_max"),
                ("priceMin", _safe_float, "price_min"),
                ("priceMax", _safe_float, "price_max"),
                ("volumeMin", _safe_int, "volume_min"),
                ("betaMin", _safe_float, "beta_min"),
                ("betaMax", _safe_float, "beta_max"),
            ]:
                if name in p:
                    val = conv(p[name], 0, name)
                    if isinstance(val, JSONResponse):
                        return val
                    parsed[key] = val
            limit = _safe_int(p.get("limit", "50"), 50, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            result = await asyncio.to_thread(
                get_screener,
                **parsed, sector=p.get("sector"), country=p.get("country"), limit=limit,
            )
            return JSONResponse(result)

        @mcp.custom_route("/v1/crypto/{symbol}", methods=["GET"])
        @require_api_key
        async def crypto_endpoint(request: Request) -> JSONResponse:
            symbol = request.path_params["symbol"]
            interval = request.query_params.get("interval", "quote")
            if interval == "quote":
                result = await asyncio.to_thread(get_crypto_quote, symbol)
                return JSONResponse(result)
            result = await asyncio.to_thread(get_historical_bars, symbol, interval=interval)
            return JSONResponse(result)

        @mcp.custom_route("/v1/sec/{ticker}/prices", methods=["GET"])
        @require_api_key
        async def prices_compat(request: Request) -> JSONResponse:
            result = await asyncio.to_thread(get_price, request.path_params["ticker"])
            return JSONResponse(result)

        @mcp.custom_route("/v1/sec/{ticker}/profile", methods=["GET"])
        @require_api_key
        async def profile_compat(request: Request) -> JSONResponse:
            result = await asyncio.to_thread(get_profile, request.path_params["ticker"])
            return JSONResponse(result)

        @mcp.custom_route("/v1/sec/{ticker}/ohlcv", methods=["GET"])
        @require_api_key
        async def ohlcv_compat(request: Request) -> JSONResponse:
            ticker = request.path_params["ticker"]
            interval = request.query_params.get("interval", "daily")
            from_date = request.query_params.get("from")
            to_date = request.query_params.get("to")
            result = await asyncio.to_thread(get_historical_bars, ticker, interval, from_date, to_date)
            return JSONResponse(result)

        @mcp.custom_route("/v1/sec/{ticker}/earnings", methods=["GET"])
        @require_api_key
        async def earnings_compat(request: Request) -> JSONResponse:
            result = await asyncio.to_thread(get_earnings, request.path_params["ticker"])
            return JSONResponse(result)

        @mcp.custom_route("/v1/sec/{ticker}/estimates", methods=["GET"])
        @require_api_key
        async def estimates_compat(request: Request) -> JSONResponse:
            result = await asyncio.to_thread(get_estimates, request.path_params["ticker"])
            return JSONResponse(result)

        @mcp.custom_route("/v1/sec/{ticker}/news", methods=["GET"])
        @require_api_key
        async def news_compat(request: Request) -> JSONResponse:
            result = await asyncio.to_thread(get_news, request.path_params["ticker"])
            return JSONResponse(result)

        @mcp.custom_route("/v1/sec/{identifier}/export", methods=["GET"])
        @require_api_key
        async def export_endpoint(request: Request) -> Response:
            identifier = request.path_params["identifier"]
            fmt = request.query_params.get("format", "json")
            extract = request.query_params.get("extract", "financials")
            limit = _safe_int(request.query_params.get("limit", "10"), 10, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            params = {
                "period": request.query_params.get("period", "FY"),
                "limit": limit,
            }
            if fmt == "csv":
                from eugene.handlers.export import export_financials_csv
                csv_data = await asyncio.to_thread(export_financials_csv, identifier, extract, **params)
                return Response(
                    content=csv_data, media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename={identifier}_{extract}.csv"},
                )
            else:
                result = await asyncio.to_thread(query, identifier, extract, **params)
                return JSONResponse(result)

        @mcp.custom_route("/v1/stream/filings", methods=["GET"])
        @require_api_key
        async def stream_filings(request: Request) -> StreamingResponse:
            """SSE endpoint for real-time SEC filing alerts."""
            form_filter = request.query_params.get("form")
            ticker_filter = request.query_params.get("ticker")

            async def event_generator():
                from eugene.sources.realtime import get_recent_filings
                seen = set()
                while True:
                    try:
                        filings = await asyncio.to_thread(get_recent_filings, minutes=2)
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
                        logger.exception("SSE filing stream error")
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

    # Warm up disk cache (evict expired entries on startup)
    dc = get_disk_cache()
    expired = dc.evict_expired()
    if expired:
        logging.info(f"Disk cache: evicted {expired} expired entries")
    logging.info(f"Disk cache: {dc.size()} entries in {dc.cache_dir}")

    # Pre-load SEC ticker map so first request doesn't wait
    try:
        from eugene.sources.sec_api import fetch_tickers
        tickers = fetch_tickers()
        logging.info(f"Ticker map: {len(tickers)} companies loaded")
    except Exception as e:
        logging.warning(f"Ticker map warmup failed (will retry on first request): {e}")

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
