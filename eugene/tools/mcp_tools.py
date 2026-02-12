"""
Eugene Intelligence — Consolidated MCP Tools
4 tools covering all financial data
"""

# ============================================
# 1. COMPANY — Everything about a company
# ============================================

COMPANY_TYPES = [
    "prices",        # Current quote
    "profile",       # Company info
    "financials",    # SEC XBRL financials
    "health",        # Financial health metrics
    "earnings",      # EPS/revenue history
    "insider",       # Form 4 trades
    "institutional", # 13F holdings
    "filings",       # SEC filings list
]

def company(ticker: str, type: str = "prices") -> dict:
    """
    All company data in one tool.
    
    Args:
        ticker: Stock symbol (e.g., AAPL)
        type: prices | profile | financials | health | earnings | insider | institutional | filings
    """
    ticker = ticker.upper().strip()
    
    if type == "prices":
        from eugene.sources.fmp import get_stock_price
        return get_stock_price(ticker)
    
    elif type == "profile":
        from eugene.sources.fmp import get_company_profile
        return get_company_profile(ticker)
    
    elif type == "financials":
        from eugene.sources.sec import get_company_financials
        return get_company_financials(ticker)
    
    elif type == "health":
        from eugene.sources.sec import get_financial_health
        return get_financial_health(ticker)
    
    elif type == "earnings":
        from eugene.sources.sec import get_earnings_history
        return get_earnings_history(ticker)
    
    elif type == "insider":
        from eugene.sources.insider import get_insider_transactions
        return get_insider_transactions(ticker)
    
    elif type == "institutional":
        from eugene.sources.institutional import get_13f_holders
        return get_13f_holders(ticker)
    
    elif type == "filings":
        from eugene.sources.sec import get_company_filings
        return get_company_filings(ticker)
    
    else:
        return {"error": f"Unknown type: {type}. Valid: {COMPANY_TYPES}"}


# ============================================
# 2. ECONOMY — All macro/market data
# ============================================

ECONOMY_TYPES = [
    "inflation",     # CPI, PCE
    "employment",    # Jobs, unemployment
    "gdp",           # GDP growth
    "housing",       # Starts, permits
    "consumer",      # Retail, sentiment
    "manufacturing", # Industrial production
    "rates",         # Fed funds, spreads
    "treasury",      # Yield curve
    "forex",         # Exchange rates
    "all",           # All indicators
]

def economy(category: str = "all") -> dict:
    """
    Economic and market data.
    
    Args:
        category: inflation | employment | gdp | housing | consumer | manufacturing | rates | treasury | forex | all
    """
    if category == "treasury":
        from eugene.sources.fred import get_economic_data
        yields = {}
        for series in ["DGS1", "DGS2", "DGS5", "DGS10", "DGS30"]:
            data = get_economic_data(series)
            if "observations" in data and data["observations"]:
                yields[series] = data["observations"][-1].get("value")
        return {"yields": yields, "source": "FRED"}
    
    elif category == "forex":
        from eugene.sources.government import get_forex_rates
        return get_forex_rates()
    
    elif category in ["inflation", "employment", "gdp", "housing", "consumer", "manufacturing", "rates", "all"]:
        from eugene.sources.fred import get_latest_indicators
        return get_latest_indicators(category)
    
    else:
        return {"error": f"Unknown category: {category}. Valid: {ECONOMY_TYPES}"}


# ============================================
# 3. REGULATORY — Government & regulatory data
# ============================================

REGULATORY_TYPES = [
    "sec_press",       # SEC press releases
    "sec_enforcement", # Enforcement actions
    "sec_speeches",    # SEC speeches
    "fed_speeches",    # Fed speeches
    "fomc",            # FOMC statements
    "treasury_debt",   # National debt
    "company_risk",    # Check company for enforcement
]

def regulatory(type: str = "sec_press", ticker: str = None, limit: int = 10) -> dict:
    """
    Government and regulatory data.
    
    Args:
        type: sec_press | sec_enforcement | sec_speeches | fed_speeches | fomc | treasury_debt | company_risk
        ticker: Required for company_risk
        limit: Number of items
    """
    if type == "sec_press":
        from eugene.sources.sec_regulatory import get_sec_feed
        return get_sec_feed("press_releases", limit)
    
    elif type == "sec_enforcement":
        from eugene.sources.sec_regulatory import get_enforcement_actions
        return get_enforcement_actions()
    
    elif type == "sec_speeches":
        from eugene.sources.sec_regulatory import get_sec_feed
        return get_sec_feed("speeches", limit)
    
    elif type == "fed_speeches":
        from eugene.sources.government import get_fed_data
        return get_fed_data("speeches", limit)
    
    elif type == "fomc":
        from eugene.sources.government import get_fed_data
        return get_fed_data("fomc", limit)
    
    elif type == "treasury_debt":
        from eugene.sources.government import get_treasury_data
        return get_treasury_data("debt")
    
    elif type == "company_risk":
        if not ticker:
            return {"error": "ticker required for company_risk"}
        from eugene.sources.sec_regulatory import check_company_enforcement
        return check_company_enforcement(ticker)
    
    else:
        return {"error": f"Unknown type: {type}. Valid: {REGULATORY_TYPES}"}


# ============================================
# 4. RESEARCH — AI-powered analysis
# ============================================

RESEARCH_TYPES = [
    "equity",   # Full equity research
    "credit",   # Credit/debt analysis
]

def research(ticker: str, type: str = "equity") -> dict:
    """
    AI-powered financial research.
    
    Args:
        ticker: Stock symbol
        type: equity | credit
    """
    ticker = ticker.upper().strip()
    
    if type == "equity":
        from eugene.agents.research import equity_research
        return equity_research(ticker)
    
    elif type == "credit":
        from eugene.agents.credit import credit_monitor
        return credit_monitor(ticker)
    
    else:
        return {"error": f"Unknown type: {type}. Valid: {RESEARCH_TYPES}"}
