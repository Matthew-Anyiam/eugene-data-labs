"""Auto-generated OpenAPI 3.1 specification for Eugene Intelligence REST API."""
from eugene.router import VERSION, VALID_EXTRACTS


def openapi_spec() -> dict:
    """Return full OpenAPI 3.1 spec dict."""
    extract_enum = VALID_EXTRACTS
    extract_desc = ", ".join(f"`{e}`" for e in extract_enum)

    return {
        "openapi": "3.1.0",
        "info": {
            "title": "Eugene Intelligence API",
            "version": VERSION,
            "description": (
                "Financial data infrastructure for AI agents. "
                "SEC EDGAR, FRED, FMP — normalized, provenance-tracked, and ready for LLMs.\n\n"
                f"**{len(extract_enum)} extract types** available via the unified `/v1/sec/{{identifier}}` endpoint."
            ),
            "contact": {"name": "Eugene Intelligence", "url": "https://github.com/Matthew-Anyiam/eugene-data-labs"},
            "license": {"name": "MIT", "url": "https://opensource.org/licenses/MIT"},
        },
        "servers": [
            {"url": "/", "description": "Current server"},
        ],
        "paths": {
            "/health": {
                "get": {
                    "summary": "Health check",
                    "operationId": "health",
                    "tags": ["System"],
                    "responses": {
                        "200": {
                            "description": "Service is healthy",
                            "content": {"application/json": {"schema": {
                                "type": "object",
                                "properties": {
                                    "status": {"type": "string", "example": "ok"},
                                    "version": {"type": "string", "example": VERSION},
                                },
                            }}},
                        },
                    },
                },
            },
            "/v1/capabilities": {
                "get": {
                    "summary": "List all extracts, concepts, and parameters",
                    "operationId": "capabilities",
                    "tags": ["Discovery"],
                    "security": [{"ApiKeyHeader": []}, {"ApiKeyQuery": []}],
                    "responses": {"200": {"description": "Capabilities manifest"}},
                },
            },
            "/v1/concepts": {
                "get": {
                    "summary": "List all 28 canonical financial concepts",
                    "operationId": "concepts",
                    "tags": ["Discovery"],
                    "security": [{"ApiKeyHeader": []}, {"ApiKeyQuery": []}],
                    "responses": {"200": {"description": "Concept definitions with IS/BS/CF grouping"}},
                },
            },
            "/v1/sec/{identifier}": {
                "get": {
                    "summary": "Unified SEC data endpoint",
                    "description": (
                        f"Fetch any combination of {len(extract_enum)} extract types for a company.\n\n"
                        f"Available extracts: {extract_desc}"
                    ),
                    "operationId": "sec_query",
                    "tags": ["SEC Data"],
                    "security": [{"ApiKeyHeader": []}, {"ApiKeyQuery": []}],
                    "parameters": [
                        {
                            "name": "identifier",
                            "in": "path",
                            "required": True,
                            "description": "Ticker (AAPL), CIK (320193), or accession number",
                            "schema": {"type": "string"},
                            "examples": {
                                "ticker": {"value": "AAPL"},
                                "cik": {"value": "320193"},
                            },
                        },
                        {
                            "name": "extract",
                            "in": "query",
                            "description": "Comma-separated extract types",
                            "schema": {"type": "string", "default": "financials"},
                        },
                        {
                            "name": "period",
                            "in": "query",
                            "description": "Fiscal period type",
                            "schema": {"type": "string", "enum": ["FY", "Q"], "default": "FY"},
                        },
                        {
                            "name": "concept",
                            "in": "query",
                            "description": "Canonical concept or raw XBRL tag (for financials/concepts)",
                            "schema": {"type": "string"},
                        },
                        {
                            "name": "form",
                            "in": "query",
                            "description": "Filter by form type",
                            "schema": {"type": "string", "enum": ["10-K", "10-Q", "8-K", "4", "13F-HR"]},
                        },
                        {
                            "name": "section",
                            "in": "query",
                            "description": "Filing section to extract",
                            "schema": {"type": "string", "enum": ["mdna", "risk_factors", "business", "legal"]},
                        },
                        {
                            "name": "from",
                            "in": "query",
                            "description": "Start date (YYYY-MM-DD)",
                            "schema": {"type": "string", "format": "date"},
                        },
                        {
                            "name": "to",
                            "in": "query",
                            "description": "End date (YYYY-MM-DD)",
                            "schema": {"type": "string", "format": "date"},
                        },
                        {
                            "name": "limit",
                            "in": "query",
                            "description": "Max results",
                            "schema": {"type": "integer", "default": 10, "minimum": 1, "maximum": 100},
                        },
                    ],
                    "responses": {
                        "200": {
                            "description": "Successful query",
                            "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Envelope"}}},
                        },
                        "401": {"description": "Invalid or missing API key"},
                        "422": {"description": "Validation error (bad extract, bad param)"},
                    },
                },
            },
            "/v1/sec/{identifier}/export": {
                "get": {
                    "summary": "Export data as CSV or JSON",
                    "operationId": "export",
                    "tags": ["SEC Data"],
                    "security": [{"ApiKeyHeader": []}, {"ApiKeyQuery": []}],
                    "parameters": [
                        {"name": "identifier", "in": "path", "required": True, "schema": {"type": "string"}},
                        {"name": "format", "in": "query", "schema": {"type": "string", "enum": ["json", "csv"], "default": "json"}},
                        {"name": "extract", "in": "query", "schema": {"type": "string", "default": "financials"}},
                        {"name": "limit", "in": "query", "schema": {"type": "integer", "default": 10}},
                    ],
                    "responses": {
                        "200": {"description": "CSV or JSON download"},
                    },
                },
            },
            "/v1/economics/{category}": {
                "get": {
                    "summary": "FRED economic data by category",
                    "operationId": "economics",
                    "tags": ["Economics"],
                    "security": [{"ApiKeyHeader": []}, {"ApiKeyQuery": []}],
                    "parameters": [
                        {
                            "name": "category",
                            "in": "path",
                            "required": True,
                            "schema": {
                                "type": "string",
                                "enum": ["inflation", "employment", "gdp", "housing", "consumer",
                                         "manufacturing", "rates", "money", "treasury", "all"],
                            },
                        },
                        {"name": "series", "in": "query", "description": "Specific FRED series ID", "schema": {"type": "string"}},
                    ],
                    "responses": {"200": {"description": "Economic data series"}},
                },
            },
            "/v1/screener": {
                "get": {
                    "summary": "Stock screener with multi-factor filters",
                    "operationId": "screener",
                    "tags": ["Market Data"],
                    "security": [{"ApiKeyHeader": []}, {"ApiKeyQuery": []}],
                    "parameters": [
                        {"name": "marketCapMin", "in": "query", "schema": {"type": "integer"}},
                        {"name": "marketCapMax", "in": "query", "schema": {"type": "integer"}},
                        {"name": "priceMin", "in": "query", "schema": {"type": "number"}},
                        {"name": "priceMax", "in": "query", "schema": {"type": "number"}},
                        {"name": "volumeMin", "in": "query", "schema": {"type": "integer"}},
                        {"name": "sector", "in": "query", "schema": {"type": "string"}},
                        {"name": "country", "in": "query", "schema": {"type": "string"}},
                        {"name": "betaMin", "in": "query", "schema": {"type": "number"}},
                        {"name": "betaMax", "in": "query", "schema": {"type": "number"}},
                        {"name": "limit", "in": "query", "schema": {"type": "integer", "default": 50}},
                    ],
                    "responses": {"200": {"description": "Screened stock list"}},
                },
            },
            "/v1/crypto/{symbol}": {
                "get": {
                    "summary": "Crypto quotes and historical bars",
                    "operationId": "crypto",
                    "tags": ["Market Data"],
                    "security": [{"ApiKeyHeader": []}, {"ApiKeyQuery": []}],
                    "parameters": [
                        {"name": "symbol", "in": "path", "required": True, "schema": {"type": "string"}, "example": "BTCUSD"},
                        {"name": "interval", "in": "query", "schema": {"type": "string", "enum": ["quote", "daily", "1hour", "5min"], "default": "quote"}},
                    ],
                    "responses": {"200": {"description": "Crypto data"}},
                },
            },
            "/v1/stream/filings": {
                "get": {
                    "summary": "Real-time SEC filing alerts (SSE)",
                    "operationId": "stream_filings",
                    "tags": ["Streaming"],
                    "security": [{"ApiKeyHeader": []}, {"ApiKeyQuery": []}],
                    "parameters": [
                        {"name": "form", "in": "query", "description": "Filter by form type", "schema": {"type": "string"}},
                        {"name": "ticker", "in": "query", "description": "Filter by ticker", "schema": {"type": "string"}},
                    ],
                    "responses": {
                        "200": {
                            "description": "Server-Sent Events stream",
                            "content": {"text/event-stream": {}},
                        },
                    },
                },
            },
        },
        "components": {
            "schemas": {
                "Envelope": {
                    "type": "object",
                    "properties": {
                        "status": {"type": "string", "enum": ["success", "error"]},
                        "identifier": {"type": "string"},
                        "resolved": {
                            "type": "object",
                            "properties": {
                                "ticker": {"type": "string"},
                                "cik": {"type": "string"},
                                "name": {"type": "string"},
                            },
                        },
                        "requested": {"type": "object"},
                        "data": {"type": "object", "description": "Extract-specific payload"},
                        "provenance": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "extract": {"type": "string"},
                                    "source": {"type": "string"},
                                    "url": {"type": "string"},
                                    "retrieved_at": {"type": "string", "format": "date-time"},
                                    "quality": {"type": "object"},
                                },
                            },
                        },
                        "metadata": {
                            "type": "object",
                            "properties": {
                                "service": {"type": "string"},
                                "version": {"type": "string"},
                            },
                        },
                    },
                },
            },
            "securitySchemes": {
                "ApiKeyHeader": {
                    "type": "apiKey",
                    "in": "header",
                    "name": "X-API-Key",
                    "description": "API key via header (set EUGENE_API_KEYS env var to enable)",
                },
                "ApiKeyQuery": {
                    "type": "apiKey",
                    "in": "query",
                    "name": "api_key",
                    "description": "API key via query parameter",
                },
            },
        },
        "tags": [
            {"name": "System", "description": "Health and status"},
            {"name": "Discovery", "description": "API capabilities and concept definitions"},
            {"name": "SEC Data", "description": "Unified SEC EDGAR data (financials, filings, insiders, etc.)"},
            {"name": "Economics", "description": "FRED macroeconomic data"},
            {"name": "Market Data", "description": "Stock screener and crypto quotes"},
            {"name": "Streaming", "description": "Real-time data feeds (SSE)"},
        ],
    }
