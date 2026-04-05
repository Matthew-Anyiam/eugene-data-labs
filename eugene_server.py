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
    def world(
        category: str = "news",
        action: str = "get_feed",
        query: str = None,
        topic: str = None,
        ticker: str = None,
        name: str = None,
        timespan: str = "24h",
        threshold: float = 0.8,
        source: str = "all",
        days: int = 7,
        limit: int = 25,
    ) -> dict:
        """World intelligence — news, sanctions, disasters, conflict, supply chain, flights, convergence, private credit.

        category: news|sanctions|disasters|conflict|supply_chain|flights|convergence|private_credit
        action:
          news: get_feed|get_brief|get_sentiment
          sanctions: get_sanctions|screen_entity|get_exposure|get_regulatory_changes
          disasters: get_active|get_impact|get_historical
          conflict: get_events|get_escalation_score|get_conflicts|get_affected_assets
          supply_chain: get_port_status|get_trade_flows|get_route_risk|get_vessel
          flights: get_flights|get_airport|get_anomalies|get_airspace_status
          convergence: get_alerts|get_entity_signals|get_composite_risk|get_dashboard
          private_credit: get_overview|get_bdc_universe|get_bdc_holdings|get_credit_spreads
        query: Search text for news/sanctions
        topic: News topic (geopolitics, trade, energy, tech, finance, climate)
        ticker: Company ticker for exposure checks
        name: Entity name for sanctions screening
        timespan: Time window (1h, 24h, 7d, 30d)
        threshold: Match threshold for sanctions screening (0.0-1.0)
        source: Sanctions list source (ofac, un, all)
        days: Days to look back for regulatory changes
        limit: Max results
        """
        if category == "news":
            from eugene.world.news import get_feed, get_brief, get_sentiment
            if action == "get_feed":
                return get_feed(query=query, topic=topic, timespan=timespan, limit=limit)
            elif action == "get_brief":
                return get_brief(query=query, topic=topic)
            elif action == "get_sentiment":
                if not query:
                    return {"error": "query required for get_sentiment"}
                return get_sentiment(query, timespan=timespan)
            return {"error": f"Unknown news action: {action}"}

        elif category == "sanctions":
            from eugene.world.sanctions_intel import screen, get_list, check_exposure, get_changes
            if action == "screen_entity":
                if not name:
                    return {"error": "name required for screen_entity"}
                lists = [source] if source != "all" else None
                return screen(name, threshold=threshold, lists=lists)
            elif action == "get_sanctions":
                return get_list(source=source, limit=limit)
            elif action == "get_exposure":
                if not ticker:
                    return {"error": "ticker required for get_exposure"}
                return check_exposure(ticker)
            elif action == "get_regulatory_changes":
                return get_changes(days=days, limit=limit)
            return {"error": f"Unknown sanctions action: {action}"}

        elif category == "disasters":
            from eugene.world.disasters_intel import get_active, get_impact, get_historical
            if action == "get_active":
                return get_active(days=days)
            elif action == "get_impact":
                if not query:
                    return {"error": "query required (format: 'lat,lng')"}
                parts = query.split(",")
                if len(parts) != 2:
                    return {"error": "query must be 'lat,lng'"}
                return get_impact(float(parts[0]), float(parts[1]))
            elif action == "get_historical":
                return get_historical(days=days, limit=limit)
            return {"error": f"Unknown disasters action: {action}"}

        elif category == "conflict":
            from eugene.world.conflict_intel import get_events, get_escalation, get_conflicts, get_affected
            if action == "get_events":
                return get_events(country=query, limit=limit)
            elif action == "get_escalation_score":
                if not query:
                    return {"error": "query (country) required"}
                return get_escalation(query)
            elif action == "get_conflicts":
                return get_conflicts(region=query)
            elif action == "get_affected_assets":
                if not query:
                    return {"error": "query (country) required"}
                return get_affected(query)
            return {"error": f"Unknown conflict action: {action}"}

        elif category == "supply_chain":
            from eugene.world.supply_chain_intel import get_ports, get_trade, get_routes, get_vessel as _get_vessel
            if action == "get_port_status":
                return get_ports(port_code=query, country=ticker, limit=limit)
            elif action == "get_trade_flows":
                reporter = query or "US"
                return get_trade(reporter=reporter, partner=ticker, commodity=name, flow=source if source != "all" else "X", limit=limit)
            elif action == "get_route_risk":
                return get_routes(origin=query, destination=ticker)
            elif action == "get_vessel":
                if query and query.isdigit():
                    return _get_vessel(mmsi=query)
                elif query and "," in query:
                    parts = query.split(",")
                    return _get_vessel(lat=float(parts[0]), lng=float(parts[1]))
                return {"error": "query must be MMSI number or 'lat,lng'"}
            return {"error": f"Unknown supply_chain action: {action}"}

        elif category == "flights":
            from eugene.world.flights_intel import get_aircraft, get_airport, get_airspace_anomalies, get_airspace
            if action == "get_flights":
                if query and "," in query:
                    parts = query.split(",")
                    return get_aircraft(lat=float(parts[0]), lng=float(parts[1]), limit=limit)
                elif query:
                    return get_aircraft(icao24=query, limit=limit)
                return {"error": "query must be 'lat,lng' or icao24 address"}
            elif action == "get_airport":
                return get_airport(icao=query, country=ticker, limit=limit)
            elif action == "get_anomalies":
                return get_airspace_anomalies(region=query, limit=limit)
            elif action == "get_airspace_status":
                return get_airspace(region=query)
            return {"error": f"Unknown flights action: {action}"}

        elif category == "convergence":
            from eugene.world.convergence import get_alerts as _conv_alerts, get_entity_signals as _conv_signals, get_composite_risk as _conv_risk, get_dashboard_summary as _conv_dash
            if action == "get_alerts":
                return _conv_alerts(time_window=timespan, limit=limit)
            elif action == "get_entity_signals":
                if not query:
                    return {"error": "query (entity_id) required"}
                return _conv_signals(query, time_window=timespan)
            elif action == "get_composite_risk":
                return _conv_risk(entity_id=query, time_window=timespan, limit=limit)
            elif action == "get_dashboard":
                return _conv_dash(time_window=timespan)
            return {"error": f"Unknown convergence action: {action}"}

        elif category == "private_credit":
            from eugene.sources.private_credit import get_market_overview, get_bdc_universe, get_bdc_holdings, get_credit_spreads
            if action == "get_overview":
                return get_market_overview()
            elif action == "get_bdc_universe":
                return get_bdc_universe()
            elif action == "get_bdc_holdings":
                if not ticker:
                    return {"error": "ticker required (e.g. ARCC, OBDC, FSK)"}
                return get_bdc_holdings(ticker, limit=limit)
            elif action == "get_credit_spreads":
                return get_credit_spreads(series_id=query)
            return {"error": f"Unknown private_credit action: {action}"}

        return {"error": f"Unknown category: {category}. Use: news, sanctions, disasters, conflict, supply_chain, flights, convergence, private_credit"}

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

        # --- JWT user auth endpoints ---

        @mcp.custom_route("/v1/auth/signup", methods=["POST"])
        async def auth_signup(request: Request) -> JSONResponse:
            """User signup. Accepts {email, password, name}."""
            from eugene.endpoint_limiter import auth_limiter, get_client_ip
            client_ip = get_client_ip(request)
            if not auth_limiter.check_and_record(client_ip):
                remaining = auth_limiter.reset_seconds(client_ip)
                return JSONResponse(
                    {"error": f"Too many attempts. Try again in {int(remaining)}s."},
                    status_code=429,
                    headers={"Retry-After": str(int(remaining))},
                )
            import json as _json
            try:
                body = await request.body()
                data = _json.loads(body)
                email = data.get("email", "").strip().lower()
                password = data.get("password", "")
                name = data.get("name", "").strip()

                if not email or "@" not in email:
                    return JSONResponse({"error": "Valid email is required"}, status_code=400)
                if not password or len(password) < 8:
                    return JSONResponse({"error": "Password must be at least 8 characters"}, status_code=400)
                if not name:
                    return JSONResponse({"error": "Name is required"}, status_code=400)

                from eugene.user_auth import hash_password, create_token, create_verify_token
                password_hash = hash_password(password)
                user = eugene.db.create_user(email, name, password_hash)
                if user is None:
                    return JSONResponse({"error": "Email already registered"}, status_code=409)

                # Send email verification token
                verify_token = create_verify_token(str(user["id"]), email)
                logger.info(f"Email verification token for {email}: {verify_token}")
                # TODO: Send verification email with link

                token = create_token(str(user["id"]), user["email"], user["name"])
                return JSONResponse({
                    "token": token,
                    "user": {
                        "id": str(user["id"]),
                        "email": user["email"],
                        "name": user["name"],
                        "email_verified": False,
                        "created_at": user.get("created_at", ""),
                    }
                })
            except Exception:
                logger.exception("Signup failed")
                return JSONResponse({"error": "Failed to create account"}, status_code=500)

        @mcp.custom_route("/v1/auth/login", methods=["POST"])
        async def auth_login(request: Request) -> JSONResponse:
            """User login. Accepts {email, password}."""
            from eugene.endpoint_limiter import auth_limiter, get_client_ip
            client_ip = get_client_ip(request)
            if not auth_limiter.check_and_record(client_ip):
                remaining = auth_limiter.reset_seconds(client_ip)
                return JSONResponse(
                    {"error": f"Too many attempts. Try again in {int(remaining)}s."},
                    status_code=429,
                    headers={"Retry-After": str(int(remaining))},
                )
            import json as _json
            try:
                body = await request.body()
                data = _json.loads(body)
                email = data.get("email", "").strip().lower()
                password = data.get("password", "")

                if not email or not password:
                    return JSONResponse({"error": "Email and password required"}, status_code=400)

                user = eugene.db.get_user_by_email(email)
                if user is None:
                    return JSONResponse({"error": "Invalid email or password"}, status_code=401)

                from eugene.user_auth import verify_password, create_token
                if not verify_password(password, user["password"]):
                    return JSONResponse({"error": "Invalid email or password"}, status_code=401)

                eugene.db.update_last_login(user["id"])
                token = create_token(str(user["id"]), user["email"], user["name"])
                return JSONResponse({
                    "token": token,
                    "user": {
                        "id": str(user["id"]),
                        "email": user["email"],
                        "name": user["name"],
                        "avatar_url": user.get("avatar_url"),
                        "created_at": user.get("created_at", ""),
                    }
                })
            except Exception:
                logger.exception("Login failed")
                return JSONResponse({"error": "Authentication failed"}, status_code=500)

        @mcp.custom_route("/v1/auth/me", methods=["GET"])
        async def auth_me(request: Request) -> JSONResponse:
            """Get current user from JWT token."""
            auth_header = request.headers.get("authorization", "")
            if not auth_header.startswith("Bearer "):
                return JSONResponse({"error": "Missing or invalid authorization header"}, status_code=401)

            token = auth_header[7:]
            from eugene.user_auth import decode_token
            payload = decode_token(token)
            if payload is None:
                return JSONResponse({"error": "Invalid or expired token"}, status_code=401)

            user = eugene.db.get_user_by_id(int(payload["user_id"]))
            if user is None:
                return JSONResponse({"error": "User not found"}, status_code=404)

            return JSONResponse({
                "id": str(user["id"]),
                "email": user["email"],
                "name": user["name"],
                "avatar_url": user.get("avatar_url"),
                "created_at": user.get("created_at", ""),
            })

        @mcp.custom_route("/v1/auth/refresh", methods=["POST"])
        async def auth_refresh(request: Request) -> JSONResponse:
            """Refresh a JWT token."""
            from eugene.endpoint_limiter import refresh_limiter, get_client_ip
            client_ip = get_client_ip(request)
            if not refresh_limiter.check_and_record(client_ip):
                return JSONResponse({"error": "Too many refresh attempts"}, status_code=429)
            auth_header = request.headers.get("authorization", "")
            if not auth_header.startswith("Bearer "):
                return JSONResponse({"error": "Missing authorization header"}, status_code=401)

            token = auth_header[7:]
            from eugene.user_auth import decode_token, create_token
            payload = decode_token(token)
            if payload is None:
                return JSONResponse({"error": "Invalid or expired token"}, status_code=401)

            new_token = create_token(payload["user_id"], payload["email"], payload["name"])
            return JSONResponse({"token": new_token})

        # ── Password reset endpoints ─────────────────────────────────
        @mcp.custom_route("/v1/auth/forgot-password", methods=["POST"])
        async def auth_forgot_password(request: Request) -> JSONResponse:
            """Request a password reset. Accepts {email}.
            Always returns 200 to prevent email enumeration."""
            from eugene.endpoint_limiter import auth_limiter, get_client_ip
            client_ip = get_client_ip(request)
            if not auth_limiter.check_and_record(client_ip):
                return JSONResponse({"message": "If that email exists, a reset link has been sent."})

            import json as _json
            try:
                body = await request.body()
                data = _json.loads(body)
                email = data.get("email", "").strip().lower()

                user = eugene.db.get_user_by_email(email)
                if user:
                    from eugene.user_auth import create_reset_token
                    token = create_reset_token(str(user["id"]), user["email"])
                    # In production, send this via email. For now, log it.
                    logger.info(f"Password reset token for {email}: {token}")
                    # TODO: Send email with reset link: /reset-password?token={token}
            except Exception:
                logger.exception("Forgot password error")

            # Always return success to prevent enumeration
            return JSONResponse({"message": "If that email exists, a reset link has been sent."})

        @mcp.custom_route("/v1/auth/reset-password", methods=["POST"])
        async def auth_reset_password(request: Request) -> JSONResponse:
            """Reset password with a reset token. Accepts {token, new_password}."""
            import json as _json
            try:
                body = await request.body()
                data = _json.loads(body)
                token = data.get("token", "")
                new_password = data.get("new_password", "")

                if not token:
                    return JSONResponse({"error": "Reset token is required"}, status_code=400)
                if len(new_password) < 8:
                    return JSONResponse({"error": "Password must be at least 8 characters"}, status_code=400)

                from eugene.user_auth import consume_reset_token, hash_password
                token_data = consume_reset_token(token)
                if token_data is None:
                    return JSONResponse({"error": "Invalid or expired reset token"}, status_code=400)

                new_hash = hash_password(new_password)
                eugene.db.update_password(int(token_data["user_id"]), new_hash)
                return JSONResponse({"message": "Password has been reset. You can now log in."})
            except Exception:
                logger.exception("Reset password error")
                return JSONResponse({"error": "Failed to reset password"}, status_code=500)

        # ── Email verification endpoints ────────────────────────────
        @mcp.custom_route("/v1/auth/verify-email", methods=["POST"])
        async def auth_verify_email(request: Request) -> JSONResponse:
            """Verify email with a verification token. Accepts {token}."""
            import json as _json
            try:
                body = await request.body()
                data = _json.loads(body)
                token = data.get("token", "")

                if not token:
                    return JSONResponse({"error": "Verification token is required"}, status_code=400)

                from eugene.user_auth import consume_verify_token
                token_data = consume_verify_token(token)
                if token_data is None:
                    return JSONResponse({"error": "Invalid or expired verification token"}, status_code=400)

                eugene.db.set_email_verified(int(token_data["user_id"]))
                return JSONResponse({"message": "Email verified successfully."})
            except Exception:
                logger.exception("Email verification error")
                return JSONResponse({"error": "Verification failed"}, status_code=500)

        @mcp.custom_route("/v1/auth/resend-verification", methods=["POST"])
        async def auth_resend_verification(request: Request) -> JSONResponse:
            """Resend email verification. Requires auth."""
            user_id = _get_user_id(request)
            if user_id is None:
                return JSONResponse({"error": "Unauthorized"}, status_code=401)

            user = eugene.db.get_user_by_id(user_id)
            if not user:
                return JSONResponse({"error": "User not found"}, status_code=404)

            if eugene.db.is_email_verified(user_id):
                return JSONResponse({"message": "Email is already verified."})

            from eugene.user_auth import create_verify_token
            token = create_verify_token(str(user_id), user["email"])
            logger.info(f"Email verification token for {user['email']}: {token}")
            # TODO: Send email with verify link: /verify-email?token={token}

            return JSONResponse({"message": "Verification email has been sent."})

        # ── Helper: extract authenticated user_id from request ──────
        def _get_user_id(request: Request) -> int | None:
            """Extract user_id from Bearer token. Returns None if invalid."""
            auth_header = request.headers.get("authorization", "")
            if not auth_header.startswith("Bearer "):
                return None
            from eugene.user_auth import decode_token
            payload = decode_token(auth_header[7:])
            return int(payload["user_id"]) if payload else None

        # ── Watchlist endpoints ─────────────────────────────────────
        @mcp.custom_route("/v1/watchlists", methods=["GET"])
        async def get_watchlists(request: Request) -> JSONResponse:
            """Get all watchlists for the authenticated user."""
            user_id = _get_user_id(request)
            if user_id is None:
                return JSONResponse({"error": "Unauthorized"}, status_code=401)
            watchlists = eugene.db.get_watchlists(user_id)
            return JSONResponse({"watchlists": watchlists})

        @mcp.custom_route("/v1/watchlists", methods=["POST"])
        async def create_watchlist(request: Request) -> JSONResponse:
            """Create a new watchlist."""
            user_id = _get_user_id(request)
            if user_id is None:
                return JSONResponse({"error": "Unauthorized"}, status_code=401)
            import json as _json
            body = await request.body()
            data = _json.loads(body)
            name = data.get("name", "Untitled")
            tickers = data.get("tickers", [])
            result = eugene.db.create_watchlist(user_id, name, tickers)
            return JSONResponse(result, status_code=201)

        @mcp.custom_route("/v1/watchlists/{watchlist_id}", methods=["PUT"])
        async def update_watchlist(request: Request) -> JSONResponse:
            """Update a watchlist."""
            user_id = _get_user_id(request)
            if user_id is None:
                return JSONResponse({"error": "Unauthorized"}, status_code=401)
            import json as _json
            wid = int(request.path_params["watchlist_id"])
            body = await request.body()
            data = _json.loads(body)
            ok = eugene.db.update_watchlist(wid, user_id, name=data.get("name"), tickers=data.get("tickers"))
            if not ok:
                return JSONResponse({"error": "Not found"}, status_code=404)
            return JSONResponse({"status": "updated"})

        @mcp.custom_route("/v1/watchlists/{watchlist_id}", methods=["DELETE"])
        async def delete_watchlist(request: Request) -> JSONResponse:
            """Delete a watchlist."""
            user_id = _get_user_id(request)
            if user_id is None:
                return JSONResponse({"error": "Unauthorized"}, status_code=401)
            wid = int(request.path_params["watchlist_id"])
            ok = eugene.db.delete_watchlist(wid, user_id)
            if not ok:
                return JSONResponse({"error": "Not found"}, status_code=404)
            return JSONResponse({"status": "deleted"})

        # ── User preferences endpoints ──────────────────────────────
        @mcp.custom_route("/v1/preferences", methods=["GET"])
        async def get_preferences(request: Request) -> JSONResponse:
            """Get user preferences."""
            user_id = _get_user_id(request)
            if user_id is None:
                return JSONResponse({"error": "Unauthorized"}, status_code=401)
            prefs = eugene.db.get_preferences(user_id)
            return JSONResponse(prefs)

        @mcp.custom_route("/v1/preferences", methods=["PUT"])
        async def save_preferences(request: Request) -> JSONResponse:
            """Save user preferences."""
            user_id = _get_user_id(request)
            if user_id is None:
                return JSONResponse({"error": "Unauthorized"}, status_code=401)
            import json as _json
            body = await request.body()
            data = _json.loads(body)
            result = eugene.db.save_preferences(user_id, **data)
            return JSONResponse(result)

        # ── Alerts endpoints ────────────────────────────────────────
        @mcp.custom_route("/v1/alerts", methods=["GET"])
        async def get_alerts(request: Request) -> JSONResponse:
            """Get user's alerts."""
            user_id = _get_user_id(request)
            if user_id is None:
                return JSONResponse({"error": "Unauthorized"}, status_code=401)
            active_only = request.query_params.get("active", "true").lower() == "true"
            alerts = eugene.db.get_alerts(user_id, active_only=active_only)
            return JSONResponse({"alerts": alerts})

        @mcp.custom_route("/v1/alerts", methods=["POST"])
        async def create_alert(request: Request) -> JSONResponse:
            """Create a price alert."""
            user_id = _get_user_id(request)
            if user_id is None:
                return JSONResponse({"error": "Unauthorized"}, status_code=401)
            import json as _json
            body = await request.body()
            data = _json.loads(body)
            ticker = data.get("ticker", "")
            condition = data.get("condition", "")  # above, below, crosses
            value = float(data.get("value", 0))
            if not ticker or not condition or not value:
                return JSONResponse({"error": "ticker, condition, and value are required"}, status_code=400)
            result = eugene.db.create_alert(user_id, ticker, condition, value)
            return JSONResponse(result, status_code=201)

        @mcp.custom_route("/v1/alerts/{alert_id}", methods=["DELETE"])
        async def delete_alert(request: Request) -> JSONResponse:
            """Delete an alert."""
            user_id = _get_user_id(request)
            if user_id is None:
                return JSONResponse({"error": "Unauthorized"}, status_code=401)
            aid = int(request.path_params["alert_id"])
            ok = eugene.db.delete_alert(aid, user_id)
            if not ok:
                return JSONResponse({"error": "Not found"}, status_code=404)
            return JSONResponse({"status": "deleted"})

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

        # --- World Intelligence endpoints ---

        @mcp.custom_route("/v1/world/news", methods=["GET"])
        @require_api_key
        async def world_news_feed(request: Request) -> JSONResponse:
            """Get geopolitical/financial news feed from GDELT."""
            from eugene.world.news import get_feed
            q = request.query_params.get("q")
            topic = request.query_params.get("topic")
            timespan = request.query_params.get("timespan", "24h")
            limit = _safe_int(request.query_params.get("limit", "25"), 25, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            result = await asyncio.to_thread(get_feed, query=q, topic=topic, timespan=timespan, limit=limit)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/news/brief", methods=["GET"])
        @require_api_key
        async def world_news_brief(request: Request) -> JSONResponse:
            """Get AI-powered intelligence brief from recent news."""
            from eugene.world.news import get_brief
            q = request.query_params.get("q")
            topic = request.query_params.get("topic")
            result = await asyncio.to_thread(get_brief, query=q, topic=topic)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/news/sentiment", methods=["GET"])
        @require_api_key
        async def world_news_sentiment(request: Request) -> JSONResponse:
            """Get sentiment analysis for a topic or entity."""
            from eugene.world.news import get_sentiment
            q = request.query_params.get("q", "")
            if not q:
                return JSONResponse({"error": "q parameter required"}, status_code=400)
            timespan = request.query_params.get("timespan", "30d")
            result = await asyncio.to_thread(get_sentiment, q, timespan=timespan)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/sanctions/screen", methods=["GET"])
        @require_api_key
        async def world_sanctions_screen(request: Request) -> JSONResponse:
            """Screen an entity against OFAC + UN sanctions lists."""
            from eugene.world.sanctions_intel import screen
            name = request.query_params.get("name", "").strip()
            if not name:
                return JSONResponse({"error": "name parameter required"}, status_code=400)
            threshold = _safe_float(request.query_params.get("threshold", "0.8"), 0.8, "threshold")
            if isinstance(threshold, JSONResponse):
                return threshold
            result = await asyncio.to_thread(screen, name, threshold=threshold)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/sanctions", methods=["GET"])
        @require_api_key
        async def world_sanctions_list(request: Request) -> JSONResponse:
            """Browse sanctions list entries."""
            from eugene.world.sanctions_intel import get_list
            source = request.query_params.get("source", "ofac")
            entity_type = request.query_params.get("type")
            program = request.query_params.get("program")
            limit = _safe_int(request.query_params.get("limit", "50"), 50, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            offset = _safe_int(request.query_params.get("offset", "0"), 0, "offset")
            if isinstance(offset, JSONResponse):
                return offset
            result = await asyncio.to_thread(get_list, source=source, entity_type=entity_type, program=program, limit=limit, offset=offset)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/sanctions/exposure/{ticker}", methods=["GET"])
        @require_api_key
        async def world_sanctions_exposure(request: Request) -> JSONResponse:
            """Check a company's sanctions exposure."""
            from eugene.world.sanctions_intel import check_exposure
            ticker = request.path_params["ticker"]
            result = await asyncio.to_thread(check_exposure, ticker)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/sanctions/changes", methods=["GET"])
        @require_api_key
        async def world_regulatory_changes(request: Request) -> JSONResponse:
            """Get recent sanctions/regulatory changes from Federal Register."""
            from eugene.world.sanctions_intel import get_changes
            days = _safe_int(request.query_params.get("days", "7"), 7, "days")
            if isinstance(days, JSONResponse):
                return days
            limit = _safe_int(request.query_params.get("limit", "20"), 20, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            result = await asyncio.to_thread(get_changes, days=days, limit=limit)
            return JSONResponse(result)

        # --- Disasters endpoints ---

        @mcp.custom_route("/v1/world/disasters", methods=["GET"])
        @require_api_key
        async def world_disasters_active(request: Request) -> JSONResponse:
            """Get active disasters from USGS + GDACS."""
            from eugene.world.disasters_intel import get_active
            days = _safe_int(request.query_params.get("days", "7"), 7, "days")
            if isinstance(days, JSONResponse):
                return days
            min_mag = _safe_float(request.query_params.get("min_magnitude", "4.0"), 4.0, "min_magnitude")
            if isinstance(min_mag, JSONResponse):
                return min_mag
            include_fires = request.query_params.get("fires", "").lower() in ("true", "1", "yes")
            result = await asyncio.to_thread(get_active, days=days, min_magnitude=min_mag, include_fires=include_fires)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/disasters/earthquakes", methods=["GET"])
        @require_api_key
        async def world_earthquakes(request: Request) -> JSONResponse:
            """Get earthquakes from USGS."""
            from eugene.sources.disasters import get_earthquakes
            min_mag = _safe_float(request.query_params.get("min_magnitude", "4.0"), 4.0, "min_magnitude")
            if isinstance(min_mag, JSONResponse):
                return min_mag
            days = _safe_int(request.query_params.get("days", "7"), 7, "days")
            if isinstance(days, JSONResponse):
                return days
            limit = _safe_int(request.query_params.get("limit", "50"), 50, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            result = await asyncio.to_thread(get_earthquakes, min_magnitude=min_mag, days=days, limit=limit)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/disasters/risk", methods=["GET"])
        @require_api_key
        async def world_climate_risk(request: Request) -> JSONResponse:
            """Assess disaster risk for a location."""
            from eugene.world.disasters_intel import get_impact
            lat = _safe_float(request.query_params.get("lat", "0"), 0, "lat")
            if isinstance(lat, JSONResponse):
                return lat
            lng = _safe_float(request.query_params.get("lng", "0"), 0, "lng")
            if isinstance(lng, JSONResponse):
                return lng
            radius = _safe_float(request.query_params.get("radius_km", "500"), 500, "radius_km")
            if isinstance(radius, JSONResponse):
                return radius
            result = await asyncio.to_thread(get_impact, lat, lng, radius)
            return JSONResponse(result)

        # --- NASA GIBS satellite imagery endpoints ---

        @mcp.custom_route("/v1/world/satellite/layers", methods=["GET"])
        @require_api_key
        async def world_satellite_layers(request: Request) -> JSONResponse:
            """List available NASA GIBS satellite imagery layers."""
            from eugene.world.disasters_intel import list_imagery_layers
            category = request.query_params.get("category")
            layers = list_imagery_layers(category=category)
            return JSONResponse({"layers": layers, "count": len(layers)})

        @mcp.custom_route("/v1/world/satellite/tiles", methods=["GET"])
        @require_api_key
        async def world_satellite_tiles(request: Request) -> JSONResponse:
            """Get WMTS tile config for a GIBS layer (for frontend map rendering)."""
            from eugene.world.disasters_intel import get_imagery_layer
            layer = request.query_params.get("layer", "viirs_truecolor")
            date = request.query_params.get("date")
            try:
                config = get_imagery_layer(layer, date=date)
                return JSONResponse(config)
            except ValueError as e:
                return JSONResponse({"error": str(e)}, status_code=400)

        @mcp.custom_route("/v1/world/satellite/imagery", methods=["GET"])
        @require_api_key
        async def world_satellite_imagery(request: Request) -> JSONResponse:
            """Get satellite imagery layers for a specific location."""
            from eugene.world.disasters_intel import get_satellite_imagery
            lat = _safe_float(request.query_params.get("lat", "0"), 0, "lat")
            if isinstance(lat, JSONResponse):
                return lat
            lng = _safe_float(request.query_params.get("lng", "0"), 0, "lng")
            if isinstance(lng, JSONResponse):
                return lng
            date = request.query_params.get("date")
            result = await asyncio.to_thread(get_satellite_imagery, lat, lng, date)
            return JSONResponse(result)

        # --- NASA EONET natural events ---

        @mcp.custom_route("/v1/world/nasa/events", methods=["GET"])
        @require_api_key
        async def world_nasa_events(request: Request) -> JSONResponse:
            """Get active natural events from NASA EONET."""
            from eugene.world.disasters_intel import get_nasa_events
            category = request.query_params.get("category")
            days = _safe_int(request.query_params.get("days", "30"), 30, "days")
            if isinstance(days, JSONResponse):
                return days
            limit = _safe_int(request.query_params.get("limit", "50"), 50, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            result = await asyncio.to_thread(get_nasa_events, category, days, limit)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/nasa/categories", methods=["GET"])
        @require_api_key
        async def world_nasa_categories(request: Request) -> JSONResponse:
            """List NASA EONET event categories."""
            from eugene.world.disasters_intel import list_event_categories
            cats = await asyncio.to_thread(list_event_categories)
            return JSONResponse({"categories": cats})

        # --- Source health endpoint ---

        @mcp.custom_route("/v1/world/health", methods=["GET"])
        @require_api_key
        async def world_source_health(request: Request) -> JSONResponse:
            """Get health status of all world intelligence data sources."""
            from eugene.world.health import get_tracker
            category = request.query_params.get("category")
            tracker = get_tracker()
            result = tracker.get_status(category=category)
            return JSONResponse(result)

        # --- Conflict endpoints ---

        @mcp.custom_route("/v1/world/conflict/events", methods=["GET"])
        @require_api_key
        async def world_conflict_events(request: Request) -> JSONResponse:
            """Get georeferenced conflict events from UCDP."""
            from eugene.world.conflict_intel import get_events
            country = request.query_params.get("country")
            year_str = request.query_params.get("year")
            year = int(year_str) if year_str else None
            limit = _safe_int(request.query_params.get("limit", "50"), 50, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            result = await asyncio.to_thread(get_events, country=country, year=year, limit=limit)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/conflict/escalation/{country}", methods=["GET"])
        @require_api_key
        async def world_escalation_score(request: Request) -> JSONResponse:
            """Get conflict escalation score for a country."""
            from eugene.world.conflict_intel import get_escalation
            country = request.path_params["country"]
            result = await asyncio.to_thread(get_escalation, country)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/conflict", methods=["GET"])
        @require_api_key
        async def world_active_conflicts(request: Request) -> JSONResponse:
            """Get active armed conflicts from UCDP."""
            from eugene.world.conflict_intel import get_conflicts
            region = request.query_params.get("region")
            result = await asyncio.to_thread(get_conflicts, region=region)
            return JSONResponse(result)

        # --- Supply Chain endpoints ---

        @mcp.custom_route("/v1/world/supply-chain/ports", methods=["GET"])
        @require_api_key
        async def world_ports(request: Request) -> JSONResponse:
            """Get port status with congestion and disruption risk."""
            from eugene.world.supply_chain_intel import get_ports
            port_code = request.query_params.get("port")
            country = request.query_params.get("country")
            limit = _safe_int(request.query_params.get("limit", "20"), 20, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            result = await asyncio.to_thread(get_ports, port_code=port_code, country=country, limit=limit)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/supply-chain/trade", methods=["GET"])
        @require_api_key
        async def world_trade_flows(request: Request) -> JSONResponse:
            """Get international trade flow data from UN Comtrade."""
            from eugene.world.supply_chain_intel import get_trade
            reporter = request.query_params.get("reporter", "US")
            partner = request.query_params.get("partner")
            commodity = request.query_params.get("commodity")
            flow = request.query_params.get("flow", "X")
            limit = _safe_int(request.query_params.get("limit", "50"), 50, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            result = await asyncio.to_thread(get_trade, reporter=reporter, partner=partner, commodity=commodity, flow=flow, limit=limit)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/supply-chain/routes", methods=["GET"])
        @require_api_key
        async def world_route_risk(request: Request) -> JSONResponse:
            """Get shipping route risk across major chokepoints."""
            from eugene.world.supply_chain_intel import get_routes
            origin = request.query_params.get("origin")
            destination = request.query_params.get("destination")
            result = await asyncio.to_thread(get_routes, origin=origin, destination=destination)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/supply-chain/vessels", methods=["GET"])
        @require_api_key
        async def world_vessels(request: Request) -> JSONResponse:
            """Get vessel positions from AIS data."""
            from eugene.world.supply_chain_intel import get_vessel
            mmsi = request.query_params.get("mmsi")
            lat_str = request.query_params.get("lat")
            lng_str = request.query_params.get("lng")
            lat = float(lat_str) if lat_str else None
            lng = float(lng_str) if lng_str else None
            result = await asyncio.to_thread(get_vessel, mmsi=mmsi, lat=lat, lng=lng)
            return JSONResponse(result)

        # --- Chokepoint impact analysis ---

        @mcp.custom_route("/v1/world/supply-chain/chokepoints", methods=["GET"])
        @require_api_key
        async def world_chokepoints(request: Request) -> JSONResponse:
            """Get chokepoint analysis with commodity flows and disruption scenarios."""
            from eugene.world.supply_chain_intel import get_chokepoints
            name = request.query_params.get("name")
            result = get_chokepoints(chokepoint=name)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/supply-chain/chokepoint-impact", methods=["GET"])
        @require_api_key
        async def world_chokepoint_impact(request: Request) -> JSONResponse:
            """Get real-time disruption impact for a chokepoint with live conflict/disaster signals."""
            from eugene.world.supply_chain_intel import get_chokepoint_impact
            name = request.query_params.get("name", "Strait of Hormuz")
            result = await asyncio.to_thread(get_chokepoint_impact, name)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/supply-chain/commodity-exposure", methods=["GET"])
        @require_api_key
        async def world_commodity_exposure(request: Request) -> JSONResponse:
            """Find all chokepoints that affect a given commodity."""
            from eugene.world.supply_chain_intel import get_commodity_exposure
            commodity = request.query_params.get("commodity", "oil")
            result = get_commodity_exposure(commodity)
            return JSONResponse(result)

        # --- Emerging Markets endpoints ---

        @mcp.custom_route("/v1/world/emerging-markets", methods=["GET"])
        @require_api_key
        async def world_em_overview(request: Request) -> JSONResponse:
            """High-level emerging market overview with GDP, inflation, commodity exposure."""
            from eugene.world.supply_chain_intel import get_em_dashboard
            region = request.query_params.get("region")
            result = await asyncio.to_thread(get_em_dashboard, region)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/emerging-markets/country", methods=["GET"])
        @require_api_key
        async def world_em_country(request: Request) -> JSONResponse:
            """Get economic indicators for an emerging market (World Bank data)."""
            from eugene.world.supply_chain_intel import get_em_country
            country = request.query_params.get("country", "BR")
            years = _safe_int(request.query_params.get("years", "5"), 5, "years")
            if isinstance(years, JSONResponse):
                return years
            result = await asyncio.to_thread(get_em_country, country, years=years)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/emerging-markets/rankings", methods=["GET"])
        @require_api_key
        async def world_em_rankings(request: Request) -> JSONResponse:
            """Rank emerging markets by an economic indicator."""
            from eugene.world.supply_chain_intel import get_em_rank
            indicator = request.query_params.get("indicator", "gdp_growth")
            region = request.query_params.get("region")
            result = await asyncio.to_thread(get_em_rank, indicator, region)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/emerging-markets/indicators", methods=["GET"])
        @require_api_key
        async def world_em_indicators(request: Request) -> JSONResponse:
            """List available emerging market indicators."""
            from eugene.world.supply_chain_intel import list_em_indicators
            category = request.query_params.get("category")
            return JSONResponse({"indicators": list_em_indicators(category)})

        @mcp.custom_route("/v1/world/emerging-markets/countries", methods=["GET"])
        @require_api_key
        async def world_em_countries(request: Request) -> JSONResponse:
            """List emerging market countries."""
            from eugene.world.supply_chain_intel import list_em_countries
            region = request.query_params.get("region")
            return JSONResponse({"countries": list_em_countries(region)})

        # --- Flight Intelligence endpoints ---

        @mcp.custom_route("/v1/world/flights", methods=["GET"])
        @require_api_key
        async def world_flights(request: Request) -> JSONResponse:
            """Get real-time aircraft positions from OpenSky Network."""
            from eugene.world.flights_intel import get_aircraft
            icao24 = request.query_params.get("icao24")
            lat_str = request.query_params.get("lat")
            lng_str = request.query_params.get("lng")
            radius = _safe_float(request.query_params.get("radius", "200"), 200, "radius")
            if isinstance(radius, JSONResponse):
                return radius
            limit = _safe_int(request.query_params.get("limit", "50"), 50, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            lat = float(lat_str) if lat_str else None
            lng = float(lng_str) if lng_str else None
            result = await asyncio.to_thread(get_aircraft, lat=lat, lng=lng, radius_km=radius, icao24=icao24, limit=limit)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/flights/airports", methods=["GET"])
        @require_api_key
        async def world_airports(request: Request) -> JSONResponse:
            """Get airport status with traffic density and risk."""
            from eugene.world.flights_intel import get_airport
            icao = request.query_params.get("icao")
            country = request.query_params.get("country")
            limit = _safe_int(request.query_params.get("limit", "20"), 20, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            result = await asyncio.to_thread(get_airport, icao=icao, country=country, limit=limit)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/flights/anomalies", methods=["GET"])
        @require_api_key
        async def world_flight_anomalies(request: Request) -> JSONResponse:
            """Detect airspace anomalies — unusual patterns, military activity."""
            from eugene.world.flights_intel import get_airspace_anomalies
            region = request.query_params.get("region")
            limit = _safe_int(request.query_params.get("limit", "20"), 20, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            result = await asyncio.to_thread(get_airspace_anomalies, region=region, limit=limit)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/flights/airspace", methods=["GET"])
        @require_api_key
        async def world_airspace_status(request: Request) -> JSONResponse:
            """Get airspace status overview by region."""
            from eugene.world.flights_intel import get_airspace
            region = request.query_params.get("region")
            result = await asyncio.to_thread(get_airspace, region=region)
            return JSONResponse(result)

        # --- Convergence + Dashboard endpoints ---

        @mcp.custom_route("/v1/world/convergence/alerts", methods=["GET"])
        @require_api_key
        async def world_convergence_alerts(request: Request) -> JSONResponse:
            """Get convergence alerts — entities with multiple co-occurring signals."""
            from eugene.world.convergence import get_alerts
            window = request.query_params.get("window", "24h")
            min_types = _safe_int(request.query_params.get("min_types", "2"), 2, "min_types")
            if isinstance(min_types, JSONResponse):
                return min_types
            entity_type = request.query_params.get("type")
            limit = _safe_int(request.query_params.get("limit", "20"), 20, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            result = await asyncio.to_thread(get_alerts, time_window=window, min_signal_types=min_types, entity_type=entity_type, limit=limit)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/convergence/entity/{entity_id}", methods=["GET"])
        @require_api_key
        async def world_convergence_entity(request: Request) -> JSONResponse:
            """Get cross-stream signal aggregation for an entity."""
            from eugene.world.convergence import get_entity_signals
            entity_id = request.path_params["entity_id"]
            window = request.query_params.get("window", "7d")
            result = await asyncio.to_thread(get_entity_signals, entity_id, time_window=window)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/convergence/risk", methods=["GET"])
        @require_api_key
        async def world_convergence_risk(request: Request) -> JSONResponse:
            """Get composite risk scores across entities."""
            from eugene.world.convergence import get_composite_risk
            window = request.query_params.get("window", "24h")
            entity_type = request.query_params.get("type")
            entity_id = request.query_params.get("entity_id")
            limit = _safe_int(request.query_params.get("limit", "20"), 20, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            result = await asyncio.to_thread(get_composite_risk, entity_id=entity_id, entity_type=entity_type, time_window=window, limit=limit)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/convergence/dashboard", methods=["GET"])
        @require_api_key
        async def world_convergence_dashboard(request: Request) -> JSONResponse:
            """Get complete intelligence dashboard summary."""
            from eugene.world.convergence import get_dashboard_summary
            window = request.query_params.get("window", "24h")
            result = await asyncio.to_thread(get_dashboard_summary, time_window=window)
            return JSONResponse(result)

        # --- Delta engine endpoints ---

        @mcp.custom_route("/v1/world/convergence/delta", methods=["GET"])
        @require_api_key
        async def world_convergence_delta(request: Request) -> JSONResponse:
            """Run a delta sweep — detect what changed since the last check."""
            from eugene.world.delta import run_sweep
            window = request.query_params.get("window", "1h")
            result = await asyncio.to_thread(run_sweep, window=window)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/convergence/delta/history", methods=["GET"])
        @require_api_key
        async def world_convergence_delta_history(request: Request) -> JSONResponse:
            """Get hot sweep history (last 3 snapshots)."""
            from eugene.world.delta import get_sweep_history
            return JSONResponse({"sweeps": get_sweep_history()})

        # --- Alerting endpoints ---

        @mcp.custom_route("/v1/alerts/status", methods=["GET"])
        @require_api_key
        async def alerts_status(request: Request) -> JSONResponse:
            """Get alerting system status — channels, rate limits, tracking."""
            from eugene.alerts.channels import get_alert_status
            return JSONResponse(get_alert_status())

        @mcp.custom_route("/v1/alerts/evaluate", methods=["POST"])
        @require_api_key
        async def alerts_evaluate(request: Request) -> JSONResponse:
            """Evaluate current convergence alerts and dispatch if warranted."""
            from eugene.world.convergence import get_alerts
            from eugene.world.delta import run_sweep
            from eugene.alerts.channels import evaluate_and_alert

            window = request.query_params.get("window", "24h")
            alerts = await asyncio.to_thread(get_alerts, time_window=window, min_signal_types=2)
            delta = await asyncio.to_thread(run_sweep, window="1h")

            results = []
            for alert in alerts.get("alerts", []):
                result = evaluate_and_alert(alert, delta_summary=delta.get("summary"))
                if result:
                    results.append(result)

            return JSONResponse({
                "evaluated": len(alerts.get("alerts", [])),
                "dispatched": len(results),
                "results": results,
            })

        # --- LLM stats endpoint ---

        @mcp.custom_route("/v1/llm/usage", methods=["GET"])
        @require_api_key
        async def llm_usage(request: Request) -> JSONResponse:
            """Get LLM token usage and provider statistics."""
            from eugene.llm import get_token_usage, available_providers
            return JSONResponse({
                "usage": get_token_usage(),
                "providers": available_providers(),
            })

        # --- Private Credit endpoints ---

        @mcp.custom_route("/v1/world/private-credit", methods=["GET"])
        @require_api_key
        async def world_private_credit_overview(request: Request) -> JSONResponse:
            """Get private credit market overview with stress indicators."""
            from eugene.sources.private_credit import get_market_overview
            result = await asyncio.to_thread(get_market_overview)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/private-credit/bdcs", methods=["GET"])
        @require_api_key
        async def world_bdc_universe(request: Request) -> JSONResponse:
            """Get the tracked BDC universe."""
            from eugene.sources.private_credit import get_bdc_universe
            result = await asyncio.to_thread(get_bdc_universe)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/private-credit/bdcs/{ticker}", methods=["GET"])
        @require_api_key
        async def world_bdc_holdings(request: Request) -> JSONResponse:
            """Get BDC holdings and recent filings."""
            from eugene.sources.private_credit import get_bdc_holdings
            ticker = request.path_params["ticker"]
            limit = _safe_int(request.query_params.get("limit", "50"), 50, "limit")
            if isinstance(limit, JSONResponse):
                return limit
            result = await asyncio.to_thread(get_bdc_holdings, ticker, limit=limit)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/private-credit/spreads", methods=["GET"])
        @require_api_key
        async def world_credit_spreads(request: Request) -> JSONResponse:
            """Get credit spread data from FRED."""
            from eugene.sources.private_credit import get_credit_spreads
            series_id = request.query_params.get("series_id")
            result = await asyncio.to_thread(get_credit_spreads, series_id=series_id)
            return JSONResponse(result)

        @mcp.custom_route("/v1/world/private-credit/bdcs/{ticker}/holdings", methods=["GET"])
        @require_api_key
        async def world_bdc_parsed_holdings(request: Request) -> JSONResponse:
            """Parse actual portfolio holdings from BDC filing."""
            from eugene.sources.private_credit import parse_holdings_from_filing
            ticker = request.path_params["ticker"]
            accession = request.query_params.get("accession")
            result = await asyncio.to_thread(parse_holdings_from_filing, ticker, accession=accession)
            return JSONResponse(result)

        # --- Worker management endpoints ---

        @mcp.custom_route("/v1/workers/status", methods=["GET"])
        @require_api_key
        async def workers_status(request: Request) -> JSONResponse:
            """Check if Celery workers are connected."""
            try:
                from eugene.workers.celery_app import app as celery_app
                inspector = celery_app.control.inspect(timeout=2)
                active = inspector.active()
                return JSONResponse({
                    "workers_online": bool(active),
                    "active_tasks": {k: len(v) for k, v in (active or {}).items()},
                })
            except Exception as e:
                return JSONResponse({"workers_online": False, "error": str(e)})

        @mcp.custom_route("/v1/workers/trigger/{task_name}", methods=["POST"])
        @require_api_key
        async def workers_trigger(request: Request) -> JSONResponse:
            """Trigger an ingestion task on-demand."""
            task_name = request.path_params["task_name"]
            allowed = {
                "news": "eugene.workers.tasks.ingest_news_signals",
                "sanctions": "eugene.workers.tasks.sync_sanctions",
                "disasters": "eugene.workers.tasks.ingest_disaster_signals",
                "conflict": "eugene.workers.tasks.ingest_conflict_signals",
                "ports": "eugene.workers.tasks.ingest_port_signals",
                "sec": "eugene.workers.tasks.ingest_sec_signals",
                "economics": "eugene.workers.tasks.ingest_economic_signals",
                "cleanup": "eugene.workers.tasks.cleanup_old_signals",
                "delta": "eugene.workers.tasks.run_delta_sweep",
            }
            if task_name not in allowed:
                return JSONResponse({"error": f"Unknown task: {task_name}. Available: {', '.join(allowed.keys())}"}, status_code=400)
            try:
                from eugene.workers.celery_app import app as celery_app
                result = celery_app.send_task(allowed[task_name])
                return JSONResponse({"task_id": result.id, "task": task_name, "status": "queued"})
            except Exception as e:
                return JSONResponse({"error": f"Failed to queue task: {e}"}, status_code=500)

        # --- Email briefs endpoints ---

        @mcp.custom_route("/v1/email/brief", methods=["POST"])
        @require_api_key
        async def email_brief(request: Request) -> JSONResponse:
            """Email a research brief, debate, or simulation."""
            from eugene.email_briefs import send_brief, is_configured

            if not is_configured():
                return JSONResponse({"error": "Email not configured on this server. Set SMTP_USER and SMTP_PASS."}, status_code=503)

            try:
                body = await request.body()
                data = json_mod.loads(body)
            except Exception:
                return JSONResponse({"error": "Invalid JSON body"}, status_code=400)

            to_email = data.get("to")
            ticker = data.get("ticker", "")
            brief_type = data.get("type", "research")
            brief_data = data.get("brief")

            if not to_email or not brief_data:
                return JSONResponse({"error": "Required fields: to (email), brief (data), optional: ticker, type"}, status_code=400)

            if brief_type not in ("research", "debate", "simulation"):
                return JSONResponse({"error": "type must be: research, debate, or simulation"}, status_code=400)

            subject = f"{ticker.upper() + ' — ' if ticker else ''}{brief_type.title()} Brief — Eugene Intelligence"
            result = await asyncio.to_thread(send_brief, to_email, subject, brief_data, brief_type)

            status_code = 200 if "status" in result else 500
            return JSONResponse(result, status_code=status_code)

        @mcp.custom_route("/v1/email/status", methods=["GET"])
        @require_api_key
        async def email_status(request: Request) -> JSONResponse:
            """Check if email sending is configured."""
            from eugene.email_briefs import is_configured
            return JSONResponse({"configured": is_configured()})

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

        @mcp.custom_route("/v1/stream/prices", methods=["GET"])
        async def stream_prices(request: Request) -> StreamingResponse:
            """Stream real-time price updates for given tickers via SSE.

            Query params:
              tickers: comma-separated list (e.g. AAPL,MSFT,NVDA)
              interval: seconds between updates (default 5, min 3)
            """
            import json as _json

            tickers_param = request.query_params.get("tickers", "AAPL,MSFT,NVDA")
            interval = max(3, int(request.query_params.get("interval", "5")))
            tickers = [t.strip().upper() for t in tickers_param.split(",") if t.strip()][:20]

            async def event_generator():
                while True:
                    try:
                        prices = {}
                        for ticker in tickers:
                            try:
                                data = await asyncio.to_thread(get_price, ticker)
                                if data:
                                    prices[ticker] = data
                            except Exception:
                                pass

                        if prices:
                            yield f"data: {_json.dumps({'type': 'prices', 'data': prices, 'timestamp': __import__('datetime').datetime.utcnow().isoformat()})}\n\n"

                        await asyncio.sleep(interval)
                    except asyncio.CancelledError:
                        break
                    except Exception as e:
                        yield f"data: {_json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                        await asyncio.sleep(interval)

            return StreamingResponse(
                event_generator(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )

        # ── WebSocket price streaming (bidirectional upgrade from SSE) ──────
        @mcp.custom_route("/v1/ws/prices", methods=["GET"])
        async def ws_prices_http(request: Request) -> JSONResponse:
            """Upgrade hint — clients should connect via WebSocket, not HTTP GET."""
            return JSONResponse({
                "error": "This endpoint requires a WebSocket connection",
                "hint": "Connect via ws:// or wss:// protocol",
            }, status_code=426)

    return mcp


def _create_ws_app(mcp):
    """Wrap the MCP Starlette app to add WebSocket routes."""
    import asyncio
    from starlette.websockets import WebSocket, WebSocketDisconnect
    from starlette.routing import WebSocketRoute
    import json as _json

    async def ws_prices(websocket: WebSocket):
        """Bidirectional WebSocket for price streaming.

        Authentication: pass token as query param ?token=... or in first message.

        Client sends JSON messages:
          {"action": "subscribe", "tickers": ["AAPL", "MSFT"]}
          {"action": "unsubscribe", "tickers": ["MSFT"]}
          {"action": "set_interval", "interval": 3}

        Server sends:
          {"type": "prices", "data": {...}, "timestamp": "..."}
          {"type": "subscribed", "tickers": [...]}
        """
        # Verify auth token from query params
        token = websocket.query_params.get("token", "")
        if token:
            from eugene.user_auth import decode_token
            payload = decode_token(token)
            if payload is None:
                await websocket.close(code=4001, reason="Invalid or expired token")
                return
        # Allow unauthenticated in dev mode (AUTH_DISABLED)
        elif os.environ.get("VITE_AUTH_DISABLED", "").lower() != "true" and not token:
            await websocket.close(code=4001, reason="Authentication required. Pass ?token=<jwt>")
            return

        await websocket.accept()

        tickers: set[str] = set()
        interval = 5
        running = True

        async def send_prices():
            """Background task that streams prices at the configured interval."""
            nonlocal running
            while running:
                if tickers:
                    prices = {}
                    for ticker in list(tickers):
                        try:
                            data = await asyncio.to_thread(get_price, ticker)
                            if data:
                                prices[ticker] = data
                        except Exception:
                            pass
                    if prices:
                        try:
                            await websocket.send_json({
                                "type": "prices",
                                "data": prices,
                                "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
                            })
                        except Exception:
                            break
                await asyncio.sleep(interval)

        send_task = asyncio.create_task(send_prices())

        try:
            while True:
                raw = await websocket.receive_text()
                try:
                    msg = _json.loads(raw)
                except _json.JSONDecodeError:
                    await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                    continue

                action = msg.get("action", "")

                if action == "subscribe":
                    new_tickers = [t.strip().upper() for t in msg.get("tickers", []) if t.strip()]
                    tickers.update(new_tickers[:20])
                    await websocket.send_json({"type": "subscribed", "tickers": sorted(tickers)})

                elif action == "unsubscribe":
                    rm = {t.strip().upper() for t in msg.get("tickers", [])}
                    tickers -= rm
                    await websocket.send_json({"type": "subscribed", "tickers": sorted(tickers)})

                elif action == "set_interval":
                    interval = max(3, int(msg.get("interval", 5)))
                    await websocket.send_json({"type": "interval_set", "interval": interval})

                else:
                    await websocket.send_json({"type": "error", "message": f"Unknown action: {action}"})

        except WebSocketDisconnect:
            pass
        except Exception:
            logger.exception("WebSocket error")
        finally:
            running = False
            send_task.cancel()

    ws_route = WebSocketRoute("/v1/ws/prices", ws_prices)

    # Inject WebSocket route into the MCP app's routes
    if hasattr(mcp, '_app') and mcp._app is not None:
        mcp._app.routes.insert(0, ws_route)

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

    # Add WebSocket routes
    _create_ws_app(mcp)

    # CORS — configurable origins for production
    from starlette.middleware.cors import CORSMiddleware
    cors_origins_env = os.environ.get("CORS_ORIGINS", "*")
    cors_origins = ["*"] if cors_origins_env == "*" else [o.strip() for o in cors_origins_env.split(",")]
    mcp._mcp_server  # ensure internal app exists
    if hasattr(mcp, '_app') and mcp._app is not None:
        mcp._app.add_middleware(
            CORSMiddleware,
            allow_origins=cors_origins,
            allow_credentials=cors_origins_env != "*",
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=["*"],
            expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining",
                           "X-RateLimit-Reset", "X-Request-Count", "Retry-After"],
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
    # Uses middleware for SPA fallback so API routes are never intercepted.
    frontend_dist = Path(__file__).parent / "frontend" / "dist"
    if frontend_dist.is_dir():
        logging.info(f"Serving frontend from {frontend_dist}")
        import mimetypes as _mimetypes

        # Collect root-level static files (favicon.svg, manifest.json, sw.js, etc.)
        _root_static = {f.name for f in frontend_dist.iterdir() if f.is_file()}

        from starlette.routing import Route

        async def _serve_spa(request):
            """Serve static assets or index.html for SPA client-side routes."""
            req_path = request.url.path.lstrip("/")

            # Serve /assets/* (Vite-built JS/CSS bundles)
            if req_path.startswith("assets/"):
                file_path = frontend_dist / req_path
                if file_path.is_file():
                    mt = _mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
                    return FileResponse(str(file_path), media_type=mt)

            # Serve /icons/*
            if req_path.startswith("icons/"):
                file_path = frontend_dist / req_path
                if file_path.is_file():
                    mt = _mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
                    return FileResponse(str(file_path), media_type=mt)

            # Serve known root-level static files
            if req_path in _root_static:
                file_path = frontend_dist / req_path
                mt = _mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
                return FileResponse(str(file_path), media_type=mt)

            # SPA fallback: serve index.html for client-side routing
            return FileResponse(str(frontend_dist / "index.html"), media_type="text/html")

        # Add SPA catch-all as the LAST route — API routes registered by
        # FastMCP custom_route() are checked first.
        mcp_app.routes.append(
            Route("/{path:path}", endpoint=_serve_spa, methods=["GET", "HEAD"])
        )
        # Also handle root "/"
        mcp_app.routes.append(
            Route("/", endpoint=_serve_spa, methods=["GET", "HEAD"])
        )
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
