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

from eugene.monitoring import setup_logging, RequestLoggingMiddleware, get_stats
setup_logging(level=os.environ.get("LOG_LEVEL", "INFO"))

logger = logging.getLogger(__name__)

from eugene.router import query, capabilities, VERSION
from eugene.sources.fred import get_category, get_series, get_all
from eugene.sources.fmp import (
    get_price, get_profile, get_earnings, get_estimates, get_news,
    get_historical_bars, get_screener, get_crypto_quote,
)
from eugene.auth import require_api_key, _extract_key
from eugene.cache import get_disk_cache
from eugene.research import generate_research, check_rate_limit, record_usage, get_remaining
from eugene.debate import generate_debate
from eugene import simulation as sim_module
import eugene.db  # ensure init_db() runs on startup


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
        extract: profile|filings|financials|concepts|insiders|ownership|events|sections|exhibits|metrics|ohlcv|technicals|segments|float|corporate_actions|transcripts|peers|news|predictions
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
    def ontology(
        action: str = "resolve_entity",
        query: str = None,
        entity_id: str = None,
        entity_type: str = None,
        relationship: str = None,
        direction: str = "both",
        max_depth: int = 2,
        time_window: str = "24h",
        limit: int = 20,
    ) -> dict:
        """Entity graph — resolve, traverse, and query relationships across all Eugene data.

        action: resolve_entity|get_entity|get_relationships|traverse|search_entities|get_convergence|get_stats|ingest
        query: Search string for resolve/search (ticker, name, CIK)
        entity_id: Entity UUID for get/traverse/relationships
        entity_type: Filter by type (company, person, institution, filing, transaction, economic_indicator)
        relationship: Filter edges (officer_of, holds, filed, transacted, peer_of, exposed_to)
        direction: Edge direction (outbound, inbound, both)
        max_depth: Traversal depth (1-4)
        time_window: Signal window (1h, 24h, 7d, 30d)
        limit: Max results
        """
        from eugene.ontology import (
            resolve_entity as _resolve, get_entity as _get, get_relationships as _rels,
            traverse as _traverse, search_entities as _search, get_convergence as _conv,
        )
        from eugene.ontology.ingest import ingest_company, get_ingestion_stats

        if action == "resolve_entity":
            if not query:
                return {"error": "query parameter required for resolve_entity"}
            return {"matches": _resolve(query, entity_type=entity_type, limit=limit)}
        elif action == "get_entity":
            if not entity_id:
                return {"error": "entity_id required"}
            result = _get(entity_id)
            return result or {"error": "Entity not found"}
        elif action == "get_relationships":
            if not entity_id:
                return {"error": "entity_id required"}
            return _rels(entity_id, relationship=relationship, direction=direction, limit=limit)
        elif action == "traverse":
            if not entity_id:
                return {"error": "entity_id required"}
            return _traverse(entity_id, max_depth=max_depth, relationship_filter=relationship, limit=limit)
        elif action == "search_entities":
            return _search(query=query, entity_type=entity_type, limit=limit)
        elif action == "get_convergence":
            return _conv(entity_id=entity_id, time_window=time_window, limit=limit)
        elif action == "get_stats":
            return get_ingestion_stats()
        elif action == "ingest":
            if not query:
                return {"error": "query (ticker) required for ingest"}
            return ingest_company(query)
        else:
            return {"error": f"Unknown action: {action}"}

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

        def _is_pro_user(request: Request) -> bool:
            """Check if request is from authenticated user with non-free tier."""
            user = getattr(request.state, "user", None)
            return user is not None and user.get("tier", "free") != "free"

        def _get_api_key_from_request(request: Request) -> str | None:
            """Get the eug_ API key from request state if available."""
            user = getattr(request.state, "user", None)
            return user.get("key") if user else None

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
            # Serve the React frontend if available, fall back to static page
            import pathlib
            frontend_index = pathlib.Path(__file__).parent / "frontend" / "dist" / "index.html"
            if frontend_index.exists():
                return Response(content=frontend_index.read_text(), media_type="text/html")
            static_index = pathlib.Path(__file__).parent / "static" / "index.html"
            if static_index.exists():
                return Response(content=static_index.read_text(), media_type="text/html")
            return JSONResponse({
                "service": "Eugene Intelligence",
                "version": VERSION,
                "status": "ok",
            })

        @mcp.custom_route("/v1/info", methods=["GET"])
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

        # --- Auth endpoints ---

        @mcp.custom_route("/v1/auth/register", methods=["POST"])
        async def auth_register(request: Request) -> JSONResponse:
            """Register a new API key.  Accepts {email, name}."""
            import json as _json
            try:
                body = await request.body()
                data = _json.loads(body)
                email = data.get("email", "").strip()
                name = data.get("name", "").strip() or None
                if not email or "@" not in email:
                    return JSONResponse({"error": "Valid email is required"}, status_code=400)
                from eugene.apikeys import generate_key
                result = generate_key(email=email, name=name)
                return JSONResponse(result)
            except Exception:
                logger.exception("Registration failed")
                return JSONResponse({"error": "Failed to register"}, status_code=500)

        @mcp.custom_route("/v1/auth/usage", methods=["GET"])
        @require_api_key
        async def auth_usage(request: Request) -> JSONResponse:
            """Return usage stats for the authenticated API key."""
            key = _extract_key(request)
            if not key or not key.startswith("eug_"):
                return JSONResponse({"error": "Valid eug_ API key required"}, status_code=401)
            from eugene.apikeys import get_usage
            stats = get_usage(key)
            return JSONResponse(stats)

        @mcp.custom_route("/v1/waitlist", methods=["POST"])
        async def waitlist(request: Request) -> JSONResponse:
            """Collect waitlist emails."""
            import json as _json
            try:
                body = await request.body()
                data = _json.loads(body)
                email = data.get("email", "").strip()
                if not email or "@" not in email:
                    return JSONResponse({"error": "Invalid email"}, status_code=400)
                eugene.db.save_waitlist(email)
                return JSONResponse({"status": "ok", "message": "Added to waitlist"})
            except Exception:
                return JSONResponse({"error": "Failed to process request"}, status_code=500)

        @mcp.custom_route("/v1/feedback", methods=["POST"])
        async def feedback(request: Request) -> JSONResponse:
            """Collect user feedback and feature requests."""
            import json as _json
            try:
                body = await request.body()
                data = _json.loads(body)
                fb_type = data.get("type", "feedback")  # feedback, feature, bug
                message = data.get("message", "").strip()
                email = data.get("email", "").strip()
                page = data.get("page", "")
                if not message or len(message) < 5:
                    return JSONResponse({"error": "Message too short"}, status_code=400)
                eugene.db.save_feedback(
                    type=fb_type,
                    message=message,
                    email=email if email and "@" in email else None,
                    page=page,
                )
                return JSONResponse({"status": "ok", "message": "Thank you for your feedback!"})
            except Exception:
                return JSONResponse({"error": "Failed to process request"}, status_code=500)

        @mcp.custom_route("/health", methods=["GET"])
        async def health(request: Request) -> JSONResponse:
            stats = get_stats()
            return JSONResponse({
                "status": "ok",
                "version": VERSION,
                "uptime_seconds": stats["uptime_seconds"],
                "total_requests": stats["total_requests"],
            })

        @mcp.custom_route("/v1/providers", methods=["GET"])
        async def providers_endpoint(request: Request) -> JSONResponse:
            from eugene.llm import available_providers
            return JSONResponse({"providers": available_providers()})

        @mcp.custom_route("/v1/stats", methods=["GET"])
        async def stats_endpoint(request: Request) -> JSONResponse:
            return JSONResponse(get_stats())

        @mcp.custom_route("/v1/admin/feedback", methods=["GET"])
        async def admin_feedback(request: Request) -> JSONResponse:
            """Return recent feedback entries from SQLite."""
            try:
                entries = eugene.db.get_feedback_entries(limit=200)
                return JSONResponse({"entries": entries, "count": len(entries)})
            except Exception:
                return JSONResponse({"error": "Failed to read feedback"}, status_code=500)

        @mcp.custom_route("/v1/docs", methods=["GET"])
        async def openapi_docs(request: Request) -> Response:
            """Serve Swagger UI for interactive API exploration."""
            html = """<!DOCTYPE html>
<html><head><title>Eugene Intelligence API Docs</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head><body>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url:'/v1/openapi.json',dom_id:'#swagger-ui',deepLinking:true})</script>
</body></html>"""
            return Response(content=html, media_type="text/html")

        @mcp.custom_route("/v1/openapi.json", methods=["GET"])
        async def openapi_json(request: Request) -> JSONResponse:
            from eugene.openapi import openapi_spec
            return JSONResponse(openapi_spec())

        @mcp.custom_route("/v1/usage", methods=["GET"])
        @require_api_key
        async def usage_endpoint(request: Request) -> JSONResponse:
            """Per-key usage stats."""
            from eugene.usage import usage_tracker
            key = request.headers.get("x-api-key") or request.query_params.get("api_key")
            if key:
                stats = usage_tracker.get_stats(key)
            else:
                stats = {"message": "No key provided (open mode)"}
            return JSONResponse(stats)

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
            ticker = request.path_params["ticker"]
            limit = _safe_int(request.query_params.get("limit", "10"), 10, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            # Use SEC EDGAR EFTS (free); fall back to FMP if EFTS returns nothing
            result = await asyncio.to_thread(query, ticker, "news", limit=limit)
            news_data = result.get("data", {})
            if isinstance(news_data, dict) and news_data.get("count", 0) > 0:
                return JSONResponse(result)
            # Fallback to FMP (may fail on Starter plan, but try)
            try:
                fmp_result = await asyncio.to_thread(get_news, ticker)
                if fmp_result and not isinstance(fmp_result, dict):
                    return JSONResponse(fmp_result)
                if isinstance(fmp_result, dict) and not fmp_result.get("error"):
                    return JSONResponse(fmp_result)
            except Exception:
                pass
            return JSONResponse(result)

        @mcp.custom_route("/v1/predictions", methods=["GET"])
        @require_api_key
        async def predictions_endpoint(request: Request) -> JSONResponse:
            """Get prediction market data from Polymarket + Kalshi."""
            from eugene.sources.predictions import get_predictions
            topic = request.query_params.get("topic") or request.query_params.get("q")
            limit = _safe_int(request.query_params.get("limit", "10"), 10, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            result = await asyncio.to_thread(get_predictions, query=topic, topic=topic, limit=limit)
            return JSONResponse(result)

        @mcp.custom_route("/v1/sec/{ticker}/predictions", methods=["GET"])
        @require_api_key
        async def ticker_predictions_endpoint(request: Request) -> JSONResponse:
            """Get prediction market data related to a specific ticker."""
            ticker = request.path_params["ticker"]
            limit = _safe_int(request.query_params.get("limit", "10"), 10, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            result = await asyncio.to_thread(query, ticker, "predictions", limit=limit)
            return JSONResponse(result)

        @mcp.custom_route("/v1/sec/{ticker}/research", methods=["GET"])
        @require_api_key
        async def research_endpoint(request: Request) -> JSONResponse:
            try:
                client_ip = request.client.host if request.client else "unknown"
                api_key = _get_api_key_from_request(request)
                # Pro users bypass rate limiting
                if not _is_pro_user(request):
                    limited = check_rate_limit(client_ip)
                    if limited:
                        limited["ticker"] = request.path_params["ticker"]
                        return JSONResponse(limited, status_code=429)
                scenario = request.query_params.get("scenario")
                result = await asyncio.to_thread(generate_research, request.path_params["ticker"], scenario=scenario)
                # Only count if successful (cached hits are free)
                if result.get("research"):
                    record_usage(client_ip)
                eugene.db.record_api_usage(client_ip, f"/v1/sec/{request.path_params['ticker']}/research", api_key=api_key)
                result["remaining"] = get_remaining(client_ip) if not _is_pro_user(request) else 999
                return JSONResponse(result)
            except Exception as e:
                return JSONResponse(
                    {"ticker": request.path_params.get("ticker", ""), "research": None,
                     "error": str(e), "source": "eugene-research-agent"},
                    status_code=500,
                )

        @mcp.custom_route("/v1/sec/{ticker}/debate", methods=["GET"])
        @require_api_key
        async def debate_endpoint(request: Request) -> JSONResponse:
            try:
                client_ip = request.client.host if request.client else "unknown"
                api_key = _get_api_key_from_request(request)
                if not _is_pro_user(request):
                    limited = check_rate_limit(client_ip)
                    if limited:
                        limited["ticker"] = request.path_params["ticker"]
                        return JSONResponse(limited, status_code=429)
                result = await asyncio.to_thread(generate_debate, request.path_params["ticker"])
                if result.get("bull_case"):
                    record_usage(client_ip)
                eugene.db.record_api_usage(client_ip, f"/v1/sec/{request.path_params['ticker']}/debate", api_key=api_key)
                result["remaining"] = get_remaining(client_ip) if not _is_pro_user(request) else 999
                return JSONResponse(result)
            except Exception as e:
                return JSONResponse(
                    {"ticker": request.path_params.get("ticker", ""), "mode": "debate",
                     "error": str(e), "source": "eugene-debate-agent"},
                    status_code=500,
                )

        @mcp.custom_route("/v1/sec/{ticker}/simulate", methods=["GET"])
        @require_api_key
        async def simulation_endpoint(request: Request) -> JSONResponse:
            try:
                client_ip = request.client.host if request.client else "unknown"
                api_key = _get_api_key_from_request(request)
                # Pro users bypass rate limiting
                if not _is_pro_user(request):
                    limited = sim_module.check_rate_limit(client_ip)
                    if limited:
                        limited["ticker"] = request.path_params["ticker"]
                        return JSONResponse(limited, status_code=429)
                scenario = request.query_params.get("scenario")
                result = await asyncio.to_thread(
                    sim_module.run_simulation,
                    request.path_params["ticker"],
                    scenario,
                )
                # Only count if successful
                if result.get("consensus"):
                    sim_module.record_usage(client_ip)
                eugene.db.record_api_usage(client_ip, f"/v1/sec/{request.path_params['ticker']}/simulate", api_key=api_key)
                result["remaining"] = sim_module.get_remaining(client_ip) if not _is_pro_user(request) else 999
                return JSONResponse(result)
            except Exception as e:
                return JSONResponse(
                    {"ticker": request.path_params.get("ticker", ""), "mode": "simulation",
                     "error": str(e), "source": "eugene-simulation-engine"},
                    status_code=500,
                )

        # --- Ontology endpoints ---

        @mcp.custom_route("/v1/ontology/resolve", methods=["GET"])
        @require_api_key
        async def ontology_resolve(request: Request) -> JSONResponse:
            """Resolve an entity by name, ticker, CIK, or any identifier."""
            from eugene.ontology import resolve_entity as _resolve
            q = request.query_params.get("q", "").strip()
            if not q:
                return JSONResponse({"error": "q parameter required"}, status_code=400)
            entity_type = request.query_params.get("type")
            limit = _safe_int(request.query_params.get("limit", "5"), 5, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            matches = await asyncio.to_thread(_resolve, q, entity_type=entity_type, limit=limit)
            return JSONResponse({"query": q, "matches": matches})

        @mcp.custom_route("/v1/ontology/entity/{entity_id}", methods=["GET"])
        @require_api_key
        async def ontology_get_entity(request: Request) -> JSONResponse:
            """Get full entity profile with relationships."""
            from eugene.ontology import get_entity as _get
            entity_id = request.path_params["entity_id"]
            result = await asyncio.to_thread(_get, entity_id)
            if not result:
                return JSONResponse({"error": "Entity not found"}, status_code=404)
            return JSONResponse(result)

        @mcp.custom_route("/v1/ontology/entity/{entity_id}/relationships", methods=["GET"])
        @require_api_key
        async def ontology_relationships(request: Request) -> JSONResponse:
            """Get edges for an entity."""
            from eugene.ontology import get_relationships as _rels
            entity_id = request.path_params["entity_id"]
            relationship = request.query_params.get("relationship")
            direction = request.query_params.get("direction", "both")
            limit = _safe_int(request.query_params.get("limit", "50"), 50, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            result = await asyncio.to_thread(_rels, entity_id, relationship=relationship, direction=direction, limit=limit)
            return JSONResponse(result)

        @mcp.custom_route("/v1/ontology/entity/{entity_id}/traverse", methods=["GET"])
        @require_api_key
        async def ontology_traverse(request: Request) -> JSONResponse:
            """Multi-hop graph traversal from an entity."""
            from eugene.ontology import traverse as _traverse
            entity_id = request.path_params["entity_id"]
            max_depth = _safe_int(request.query_params.get("depth", "2"), 2, "depth")
            if isinstance(max_depth, JSONResponse):
                return max_depth
            relationship = request.query_params.get("relationship")
            limit = _safe_int(request.query_params.get("limit", "100"), 100, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            result = await asyncio.to_thread(_traverse, entity_id, max_depth=max_depth, relationship_filter=relationship, limit=limit)
            return JSONResponse(result)

        @mcp.custom_route("/v1/ontology/search", methods=["GET"])
        @require_api_key
        async def ontology_search(request: Request) -> JSONResponse:
            """Full-text + attribute search across entities."""
            from eugene.ontology import search_entities as _search
            q = request.query_params.get("q")
            entity_type = request.query_params.get("type")
            limit = _safe_int(request.query_params.get("limit", "20"), 20, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            offset = _safe_int(request.query_params.get("offset", "0"), 0, "offset")
            if isinstance(offset, JSONResponse):
                return offset
            result = await asyncio.to_thread(_search, query=q, entity_type=entity_type, limit=limit, offset=offset)
            return JSONResponse(result)

        @mcp.custom_route("/v1/ontology/convergence", methods=["GET"])
        @require_api_key
        async def ontology_convergence(request: Request) -> JSONResponse:
            """Get convergence alerts — entities with multiple signal types."""
            from eugene.ontology import get_convergence as _conv
            entity_id = request.query_params.get("entity_id")
            time_window = request.query_params.get("window", "24h")
            min_types = _safe_int(request.query_params.get("min_types", "2"), 2, "min_types")
            if isinstance(min_types, JSONResponse):
                return min_types
            limit = _safe_int(request.query_params.get("limit", "20"), 20, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            result = await asyncio.to_thread(_conv, entity_id=entity_id, time_window=time_window, min_signal_types=min_types, limit=limit)
            return JSONResponse(result)

        @mcp.custom_route("/v1/ontology/entity/{entity_id}/signals", methods=["GET"])
        @require_api_key
        async def ontology_signals(request: Request) -> JSONResponse:
            """Get signals for an entity."""
            from eugene.ontology.signals import get_entity_signals
            entity_id = request.path_params["entity_id"]
            signal_type = request.query_params.get("type")
            time_window = request.query_params.get("window", "7d")
            limit = _safe_int(request.query_params.get("limit", "50"), 50, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            result = await asyncio.to_thread(get_entity_signals, entity_id, signal_type=signal_type, time_window=time_window, limit=limit)
            return JSONResponse(result)

        @mcp.custom_route("/v1/ontology/ingest", methods=["POST"])
        @require_api_key
        async def ontology_ingest(request: Request) -> JSONResponse:
            """Ingest a company into the ontology from SEC data."""
            import json as _json
            try:
                body = await request.body()
                data = _json.loads(body) if body else {}
                ticker = data.get("ticker", "").strip().upper()
                if not ticker:
                    return JSONResponse({"error": "ticker required"}, status_code=400)
                from eugene.ontology.ingest import ingest_company
                result = await asyncio.to_thread(ingest_company, ticker)
                return JSONResponse({"ticker": ticker, **result})
            except Exception as e:
                logger.exception("Ontology ingest failed")
                return JSONResponse({"error": str(e)}, status_code=500)

        @mcp.custom_route("/v1/ontology/ingest/batch", methods=["POST"])
        @require_api_key
        async def ontology_ingest_batch(request: Request) -> JSONResponse:
            """Ingest multiple companies into the ontology."""
            import json as _json
            try:
                body = await request.body()
                data = _json.loads(body) if body else {}
                tickers = data.get("tickers", [])
                if not tickers:
                    return JSONResponse({"error": "tickers list required"}, status_code=400)
                if len(tickers) > 50:
                    return JSONResponse({"error": "Max 50 tickers per batch"}, status_code=400)
                from eugene.ontology.ingest import ingest_batch
                result = await asyncio.to_thread(ingest_batch, [t.strip().upper() for t in tickers])
                return JSONResponse(result)
            except Exception as e:
                logger.exception("Batch ingest failed")
                return JSONResponse({"error": str(e)}, status_code=500)

        @mcp.custom_route("/v1/ontology/stats", methods=["GET"])
        @require_api_key
        async def ontology_stats(request: Request) -> JSONResponse:
            """Get ontology statistics."""
            from eugene.ontology.ingest import get_ingestion_stats
            result = await asyncio.to_thread(get_ingestion_stats)
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

    # CORS — allow browser clients from any origin
    from starlette.middleware.cors import CORSMiddleware
    mcp._mcp_server  # ensure internal app exists
    if hasattr(mcp, '_app') and mcp._app is not None:
        mcp._app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=["*"],
            expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining",
                           "X-RateLimit-Reset", "X-Request-Count"],
        )

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

    # Get the underlying ASGI app from FastMCP and wrap it with
    # CORS middleware and SPA static file serving for the frontend.
    from starlette.middleware.cors import CORSMiddleware
    from starlette.staticfiles import StaticFiles
    from starlette.responses import FileResponse
    from pathlib import Path
    import uvicorn

    # Build the MCP ASGI app via streamable_http_app()
    mcp_app = mcp.streamable_http_app()

    # Add request logging middleware (must be added before CORS so it wraps the full pipeline)
    mcp_app.add_middleware(RequestLoggingMiddleware)

    # Wrap with CORS
    mcp_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount frontend static files if the dist directory exists.
    # SPAStaticFiles serves static assets and falls back to index.html
    # for client-side routing (React Router).
    frontend_dist = Path(__file__).parent / "frontend" / "dist"
    if frontend_dist.is_dir():
        logging.info(f"Serving frontend from {frontend_dist}")

        class SPAStaticFiles(StaticFiles):
            async def get_response(self, path, scope):
                try:
                    response = await super().get_response(path, scope)
                    if response.status_code == 404:
                        return FileResponse(
                            str(Path(self.directory) / "index.html"),
                            media_type="text/html",
                        )
                    return response
                except Exception:
                    return FileResponse(
                        str(Path(self.directory) / "index.html"),
                        media_type="text/html",
                    )

        mcp_app.mount("/", SPAStaticFiles(directory=str(frontend_dist), html=True), name="spa")
    else:
        logging.info("No frontend/dist found -- serving API only")

    uvicorn.run(mcp_app, host="0.0.0.0", port=port)


# ---------------------------------------------------------------------------
# ENTRY POINT
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    if "--mode" in sys.argv and "mcp" in sys.argv:
        run_mcp()
    else:
        run_api()
