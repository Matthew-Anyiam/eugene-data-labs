"""
Eugene Intelligence — Consolidated MCP Tools
6 tools instead of 17. Clean. Logical. Agent-friendly.
"""

# ============================================
# COMPANY DATA — Everything about a company
# ============================================

COMPANY_DATA_TYPES = [
    "prices",      # Stock prices, quotes, technicals
    "financials",  # Balance sheet, income, cash flow
    "health",      # Ratios, Altman Z, trends
    "history",     # Time series for any metric
    "filings",     # SEC 10-K, 10-Q, 8-K
    "compare",     # Side-by-side comparison
    "screen",      # Quick multi-stock screening
    "report",      # Full equity report
    "profile",     # Company overview (NEW)
    "estimates",   # Analyst estimates (NEW)
]

def company_data(
    ticker: str = None,
    tickers: list = None,
    type: str = "health",
    metric: str = None,
    years: int = 5
) -> dict:
    """
    All company-level data in one tool.
    
    Args:
        ticker: Single company (e.g., "AAPL")
        tickers: Multiple companies for compare/screen
        type: prices | financials | health | history | filings | compare | screen | report | profile | estimates
        metric: For history type (revenue, net_income, total_assets, etc.)
        years: For history type (default 5)
    """
    from eugene.sources.xbrl import XBRLClient
    
    if type == "prices":
        from eugene.sources.fmp import get_stock_price
        return get_stock_price(ticker)
    
    elif type == "profile":
        from eugene.sources.fmp import get_company_profile
        return get_company_profile(ticker)
    
    elif type == "estimates":
        from eugene.sources.fmp import get_analyst_estimates
        return get_analyst_estimates(ticker)
    
    elif type == "financials":
        client = XBRLClient()
        return client.get_financials(ticker)
    
    elif type == "health":
        from mcp.mcp_server import get_health
        return get_health().analyze(ticker).to_dict()
    
    elif type == "history":
        client = XBRLClient()
        return client.get_metric_history(ticker, metric, years)
    
    elif type == "filings":
        from eugene.sources.edgar import get_company_filings
        return get_company_filings(ticker)
    
    elif type == "compare":
        from mcp.mcp_server import compare_companies
        return compare_companies(tickers or [ticker])
    
    elif type == "screen":
        from mcp.mcp_server import quick_screen
        return quick_screen(tickers or [ticker])
    
    elif type == "report":
        from mcp.mcp_server import get_equity
        return get_equity(ticker)
    
    else:
        return {"error": f"Unknown type: {type}. Valid: {COMPANY_DATA_TYPES}"}
    

# ============================================
# EARNINGS DATA — Everything earnings-related
# ============================================

EARNINGS_DATA_TYPES = [
    "history",     # EPS actuals vs estimates
    "calendar",    # Upcoming earnings dates
    "moves",       # Post-earnings price moves
    "full",        # Complete earnings report
    "transcript",  # Earnings call transcript
]

def earnings_data(
    ticker: str = None,
    tickers: list = None,
    type: str = "history",
    quarter: str = None
) -> dict:
    """
    All earnings-related data in one tool.
    
    Args:
        ticker: Single company
        tickers: Multiple companies for calendar
        type: history | calendar | moves | full | transcript
        quarter: For transcript (e.g., "Q1 2025")
    """
    if type == "history":
        from eugene.sources.fmp import get_earnings
        return get_earnings(ticker)
    
    elif type == "calendar":
        from mcp.mcp_server import earnings_calendar
        return earnings_calendar(tickers or [ticker])
    
    elif type == "moves":
        from mcp.mcp_server import post_earnings_moves
        return post_earnings_moves(ticker)
    
    elif type == "full":
        from mcp.mcp_server import full_earnings_report
        return full_earnings_report(ticker)
    
    elif type == "transcript":
        from eugene.sources.transcripts import get_earnings_transcript
        return get_earnings_transcript(ticker, quarter)
    
    else:
        return {"error": f"Unknown type: {type}. Valid: {EARNINGS_DATA_TYPES}"}

# ============================================
# OWNERSHIP DATA — Who owns what
# ============================================

OWNERSHIP_DATA_TYPES = [
    "insider",        # Form 4 insider trades
    "institutional",  # 13F holdings
    "congressional",  # Congressional trades (NEW)
]

def ownership_data(
    ticker: str = None,
    institution: str = None,
    type: str = "insider",
    days_back: int = 365
) -> dict:
    """
    All ownership and trading activity data.
    
    Args:
        ticker: Company ticker for insider/institutional ownership
        institution: Institution name for 13F (e.g., "BERKSHIRE")
        type: insider | institutional | congressional
        days_back: For insider trades (default 365)
    """
    if type == "insider":
        from eugene.sources.insider import get_insider_transactions
        return get_insider_transactions(ticker, days_back)
    
    elif type == "institutional":
        from eugene.sources.holdings_13f import get_whale_holdings
        if institution:
            return get_whale_holdings(institution)
        else:
            # Get institutional holders of a ticker
            from eugene.sources.holdings_13f import get_13f_filing
            return get_13f_filing(ticker)
    
    elif type == "congressional":
        return {"status": "coming_soon", "message": "Congressional trading data coming soon"}
    
    else:
        return {"error": f"Unknown type: {type}. Valid: {OWNERSHIP_DATA_TYPES}"}


# ============================================
# # ============================================
# MARKET DATA — Macro and market-wide
# ============================================

MARKET_DATA_TYPES = [
    "economics",  # FRED economic data
    "treasury",   # Yield curve
    "search",     # Search FRED series
    "bundle",     # Economic bundles (inflation, employment, etc.)
    "news",       # Coming soon
    "bulk",       # Coming soon
    "calendar",   # Coming soon
]

def market_data(
    type: str = "economics",
    series: str = None,
    bundle: str = None,
    search: str = None,
    start_date: str = None,
    end_date: str = None
) -> dict:
    """
    Market-wide and macroeconomic data.
    
    Args:
        type: economics | treasury | search | bundle | news | bulk | calendar
        series: FRED series ID (e.g., "GDP", "UNRATE", "CPIAUCSL")
        bundle: Bundle name (e.g., "inflation", "employment", "rates")
        search: Search term to find FRED series
        start_date: Optional start date (YYYY-MM-DD)
        end_date: Optional end date (YYYY-MM-DD)
    """
    from eugene.sources.fred import get_economic_data, get_economic_bundle, search_fred_series
    
    if type == "economics":
        if not series:
            return {"error": "series required. Example: GDP, UNRATE, CPIAUCSL"}
        return get_economic_data(series, start_date, end_date)
    
    elif type == "treasury":
        treasury_series = ["DGS1", "DGS2", "DGS5", "DGS10", "DGS30"]
        results = {}
        for s in treasury_series:
            data = get_economic_data(s)
            if "observations" in data and data["observations"]:
                latest = data["observations"][-1]
                results[s] = {"rate": latest.get("value"), "date": latest.get("date")}
        return {"type": "treasury_yields", "source": "FRED", "yields": results}
    
    elif type == "search":
        if not search:
            return {"error": "search term required"}
        return search_fred_series(search)
    
    elif type == "bundle":
        if not bundle:
            return {"error": "bundle name required. Options: inflation, employment, rates, housing, gdp"}
        return get_economic_bundle(bundle, start_date, end_date)
    
    elif type == "news":
        return {"status": "coming_soon", "message": "News feed coming soon"}
    
    elif type == "bulk":
        return {"status": "coming_soon", "message": "Bulk downloads coming soon"}
    
    elif type == "calendar":
        return {"status": "coming_soon", "message": "Corporate actions calendar coming soon"}
    
    else:
        return {"error": f"Unknown type: {type}. Valid: {MARKET_DATA_TYPES}"}
# ============================================



# ============================================
# RESEARCH AGENT — Full company analysis
# ============================================

def research_agent(ticker: str) -> dict:
    """
    Full-spectrum company analysis combining equity research,
    earnings intelligence, financial health, and fundamentals.
    
    Returns cited, source-traced insights.
    """
    from eugene.agents.research import ResearchAgent
    from eugene.config import Config
    
    config = Config()
    agent = ResearchAgent(config)
    return agent.analyze(ticker)


# ============================================
# CREDIT AGENT — Debt and risk analysis
# ============================================

def credit_agent(ticker: str) -> dict:
    """
    Deep credit intelligence from SEC filing footnotes.
    
    Returns:
        - Debt structure (senior, subordinated, facilities)
        - Covenant terms and compliance
        - Maturity schedules
        - Liquidity analysis
        - Credit risk signals
        - Every number traced to exact filing section
    """
    from eugene.agents.credit import CreditMonitorAgent
    from eugene.config import Config
    
    config = Config()
    agent = CreditMonitorAgent(config)
    return agent.analyze(ticker)


# ============================================
# MCP TOOL DEFINITIONS
# ============================================

TOOLS = [
    {
        "name": "company_data",
        "description": "All company-level data: prices, financials, health metrics, SEC filings, comparisons",
        "parameters": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Company ticker (e.g., AAPL)"},
                "tickers": {"type": "array", "items": {"type": "string"}, "description": "Multiple tickers for compare/screen"},
                "type": {"type": "string", "enum": COMPANY_DATA_TYPES, "description": "Data type to retrieve"},
                "metric": {"type": "string", "description": "For history: revenue, net_income, total_assets, etc."},
                "years": {"type": "integer", "description": "Years of history (default 5)"}
            },
            "required": ["type"]
        }
    },
    {
        "name": "earnings_data",
        "description": "All earnings data: history, calendar, post-earnings moves, transcripts",
        "parameters": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Company ticker"},
                "tickers": {"type": "array", "items": {"type": "string"}, "description": "Multiple tickers for calendar"},
                "type": {"type": "string", "enum": EARNINGS_DATA_TYPES, "description": "Data type"},
                "quarter": {"type": "string", "description": "For transcript: Q1 2025, etc."}
            },
            "required": ["type"]
        }
    },
    {
        "name": "ownership_data",
        "description": "Ownership and trading: insider trades, 13F institutional holdings, congressional trades",
        "parameters": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Company ticker"},
                "institution": {"type": "string", "description": "Institution name for 13F (BERKSHIRE, CITADEL, etc.)"},
                "type": {"type": "string", "enum": OWNERSHIP_DATA_TYPES, "description": "Data type"},
                "days_back": {"type": "integer", "description": "Days of insider trade history (default 365)"}
            },
            "required": ["type"]
        }
    },
    {
        "name": "market_data",
        "description": "Market-wide data: economics (FRED), treasury yields, news, calendars",
        "parameters": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": MARKET_DATA_TYPES, "description": "Data type"},
                "series": {"type": "string", "description": "FRED series ID (GDP, UNRATE, etc.)"},
                "ticker": {"type": "string", "description": "For company-specific news"}
            },
            "required": ["type"]
        }
    },
    {
        "name": "research_agent",
        "description": "Full company analysis: equity research, earnings, health, fundamentals. Returns cited insights.",
        "parameters": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Company ticker"}
            },
            "required": ["ticker"]
        }
    },
    {
        "name": "credit_agent",
        "description": "Credit analysis: debt structure, covenants, maturities, risk signals from SEC footnotes.",
        "parameters": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Company ticker"}
            },
            "required": ["ticker"]
        }
    }
]


def handle_tool_call(name: str, arguments: dict) -> dict:
    """Route tool calls to the appropriate function."""
    if name == "company_data":
        return company_data(**arguments)
    elif name == "earnings_data":
        return earnings_data(**arguments)
    elif name == "ownership_data":
        return ownership_data(**arguments)
    elif name == "market_data":
        return market_data(**arguments)
    elif name == "research_agent":
        return research_agent(**arguments)
    elif name == "credit_agent":
        return credit_agent(**arguments)
    else:
        return {"error": f"Unknown tool: {name}"}


if __name__ == "__main__":
    # Test
    print("Testing consolidated tools...")
    print("\ncompany_data(ticker='AAPL', type='health'):")
    # result = company_data(ticker="AAPL", type="health")
    # print(result)
    print("Tools defined:", [t["name"] for t in TOOLS])
