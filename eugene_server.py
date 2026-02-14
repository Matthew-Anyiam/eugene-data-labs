"""
Eugene Intelligence — Unified Data Layer
2 tools: eugene_sec + eugene_economics
Works as both FastAPI and MCP server.
"""
import sys, os, logging
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('eugene')

# =============================================
# CORE: eugene_sec
# =============================================

SEC_EXTRACTS = [
    'prices', 'profile', 'financials', 'health', 'earnings',
    'insider', 'institutional', 'filings', 'estimates', 'news'
]

def eugene_sec(ticker: str, extract: str = 'financials', filing_type: str = None, institution: str = None, limit: int = 10) -> dict:
    """
    All SEC and company data in one call.

    Args:
        ticker: Stock symbol (AAPL, NVDA, TSLA, JPM, etc.)
        extract: What to get — prices | profile | financials | health | earnings | insider | institutional | filings | estimates | news
        filing_type: For filings — 10-K, 10-Q, 8-K (optional)
        institution: For institutional — BERKSHIRE, BLACKROCK, etc. (optional)
        limit: Number of results (default 10)
    """
    ticker = ticker.upper().strip()
    try:
        if extract == 'prices':
            from eugene.sources.fmp import get_stock_price
            return get_stock_price(ticker)
        elif extract == 'profile':
            from eugene.sources.fmp import get_company_profile
            return get_company_profile(ticker)
        elif extract == 'financials':
            from eugene.sources.xbrl import XBRLClient
            return XBRLClient().get_financials(ticker).to_dict()
        elif extract == 'health':
            from eugene.agents.health import HealthMonitor
            from eugene.config import Config
            result = HealthMonitor(Config()).analyze(ticker)
            return result.to_dict() if hasattr(result, 'to_dict') else result
        elif extract == 'earnings':
            from eugene.sources.fmp import get_earnings
            return get_earnings(ticker)
        elif extract == 'insider':
            from eugene.sources.insider import get_insider_transactions
            return get_insider_transactions(ticker)
        elif extract == 'institutional':
            if institution:
                from eugene.sources.holdings_13f import get_whale_holdings
                return get_whale_holdings(institution)
            from eugene.sources.holdings_13f import get_whale_holdings
            return get_whale_holdings(ticker)
        elif extract == 'filings':
            from eugene.sources.edgar import EDGARClient
            from eugene.config import Config
            client = EDGARClient(Config())
            filings = client.get_filings(ticker, filing_type=filing_type, limit=limit)
            return {'ticker': ticker, 'filings': [{'type': f.filing_type, 'date': f.filing_date, 'accession': f.accession_number, 'url': f.filing_url} for f in filings], 'source': 'SEC EDGAR'}
        elif extract == 'estimates':
            from eugene.sources.fmp import get_analyst_estimates
            return get_analyst_estimates(ticker)
        elif extract == 'news':
            from eugene.sources.fmp import get_stock_news
            return get_stock_news(ticker, limit)
        else:
            return {'error': f'Unknown extract: {extract}', 'valid': SEC_EXTRACTS}
    except Exception as e:
        logger.error(f'eugene_sec({ticker}, {extract}) failed: {e}')
        return {'ticker': ticker, 'extract': extract, 'error': str(e)}


# =============================================
# CORE: eugene_economics
# =============================================

ECON_CATEGORIES = [
    'inflation', 'employment', 'gdp', 'housing', 'consumer',
    'manufacturing', 'rates', 'money', 'treasury', 'all'
]

def eugene_economics(category: str = 'all', series: str = None) -> dict:
    """
    All economic and market data in one call.

    Args:
        category: inflation | employment | gdp | housing | consumer | manufacturing | rates | money | treasury | all
        series: Specific FRED series ID (e.g. GDP, UNRATE, CPIAUCSL) — overrides category
    """
    try:
        if series:
            from eugene.sources.fred import get_economic_data
            return get_economic_data(series)
        if category == 'treasury':
            from eugene.sources.fred import get_economic_data
            yields = {}
            for s in ['DGS1', 'DGS2', 'DGS5', 'DGS10', 'DGS30']:
                data = get_economic_data(s)
                if 'observations' in data and data['observations']:
                    yields[s] = {'rate': data['observations'][-1].get('value'), 'date': data['observations'][-1].get('date')}
            return {'type': 'treasury_yields', 'yields': yields, 'source': 'FRED'}
        from eugene.sources.fred import get_latest_indicators
        return get_latest_indicators(category)
    except Exception as e:
        logger.error(f'eugene_economics({category}) failed: {e}')
        return {'category': category, 'error': str(e)}


# =============================================
# FastAPI Server
# =============================================

def create_api():
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    app = FastAPI(
        title='Eugene Intelligence API',
        description='Financial context for AI agents. 2 endpoints. Every number traced to source.',
        version='0.2.0',
        docs_url='/',
    )
    app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])

    @app.get('/v1/sec/{ticker}')
    def sec_endpoint(ticker: str, extract: str = 'financials', filing_type: str = None, institution: str = None, limit: int = 10):
        return eugene_sec(ticker, extract, filing_type, institution, limit)

    @app.get('/v1/economics')
    def economics_endpoint(category: str = 'all', series: str = None):
        return eugene_economics(category, series)

    @app.get('/v1/economics/{category}')
    def economics_category_endpoint(category: str, series: str = None):
        return eugene_economics(category, series)

    @app.get('/health')
    def health():
        return {'status': 'ok', 'service': 'eugene-intelligence', 'version': '0.2.0', 'tools': ['eugene_sec', 'eugene_economics']}

    return app


# =============================================
# MCP Server
# =============================================

def create_mcp():
    from mcp.server.fastmcp import FastMCP

    mcp = FastMCP(
        name='eugene-intelligence',
        instructions='Eugene Intelligence: Financial context for AI agents. 2 tools: eugene_sec (all company/SEC data) and eugene_economics (all FRED/macro data). Every number traced to source.',
    )

    @mcp.tool()
    def sec(ticker: str, extract: str = 'financials', filing_type: str = None, institution: str = None, limit: int = 10) -> dict:
        """All SEC and company data. extract: prices|profile|financials|health|earnings|insider|institutional|filings|estimates|news"""
        return eugene_sec(ticker, extract, filing_type, institution, limit)

    @mcp.tool()
    def economics(category: str = 'all', series: str = None) -> dict:
        """All economic data from FRED. category: inflation|employment|gdp|housing|consumer|manufacturing|rates|money|treasury|all"""
        return eugene_economics(category, series)

    return mcp


# =============================================
# Entry point
# =============================================

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Eugene Intelligence')
    parser.add_argument('--mode', choices=['api', 'mcp'], default='api', help='Run as API server or MCP server')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()

    if args.mode == 'mcp':
        mcp = create_mcp()
        mcp.run()
    else:
        import uvicorn
        app = create_api()
        uvicorn.run(app, host='0.0.0.0', port=args.port)
