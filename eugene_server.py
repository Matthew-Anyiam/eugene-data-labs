"""
Eugene Intelligence — Unified Data Layer v0.3.0
2 tools: eugene_sec + eugene_economics
Works as both FastAPI and MCP server.

Response envelope: {status, data, metadata, warnings, citations}
"""
import sys, os, logging, time
from datetime import datetime, timezone
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('eugene')

VERSION = '0.3.0'

# =============================================
# Response Envelope
# =============================================

def envelope(data, ticker=None, extract=None, category=None, source=None, citations=None, warnings=None):
    """Standardized response wrapper for all endpoints."""
    meta = {
        'service': 'eugene-intelligence',
        'version': VERSION,
        'retrieved_at': datetime.now(timezone.utc).isoformat(),
    }
    if ticker:
        meta['ticker'] = ticker.upper()
    if extract:
        meta['extract'] = extract
    if category:
        meta['category'] = category
    if source:
        meta['source'] = source
    resp = {
        'status': 'error' if isinstance(data, dict) and 'error' in data else 'success',
        'data': data,
        'metadata': meta,
    }
    if warnings:
        resp['warnings'] = warnings
    if citations:
        resp['citations'] = citations
    return resp


def build_citations(data, ticker=None):
    """Extract per-metric citations from XBRL data."""
    citations = []
    if isinstance(data, dict):
        for key, val in data.items():
            if isinstance(val, dict) and 'xbrl_tag' in val:
                cite = {
                    'metric': key,
                    'xbrl_tag': val.get('xbrl_tag'),
                    'period_end': val.get('period_end'),
                    'filed': val.get('filed'),
                    'form': val.get('form'),
                }
                if ticker:
                    cite['sec_url'] = f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={ticker}&type={val.get('form', '10-K')}&dateb=&owner=include&count=10"
                citations.append(cite)
    return citations if citations else None


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
            raw = get_stock_price(ticker)
            return envelope(raw, ticker=ticker, extract='prices', source='FMP')

        elif extract == 'profile':
            from eugene.sources.fmp import get_company_profile
            raw = get_company_profile(ticker)
            return envelope(raw, ticker=ticker, extract='profile', source='FMP')

        elif extract == 'financials':
            from eugene.sources.xbrl import XBRLClient
            raw = XBRLClient().get_financials(ticker).to_dict()
            data = raw.get('data', raw)
            citations = build_citations(data, ticker)
            return envelope(data, ticker=ticker, extract='financials', source='SEC XBRL',
                          citations=citations)

        elif extract == 'health':
            from eugene.agents.health import HealthMonitor
            from eugene.config import Config
            result = HealthMonitor(Config()).analyze(ticker)
            raw = result.to_dict() if hasattr(result, 'to_dict') else result
            return envelope(raw, ticker=ticker, extract='health', source='SEC XBRL')

        elif extract == 'earnings':
            from eugene.sources.fmp import get_earnings
            raw = get_earnings(ticker)
            return envelope(raw, ticker=ticker, extract='earnings', source='FMP')

        elif extract == 'insider':
            from eugene.sources.insider import get_insider_transactions
            raw = get_insider_transactions(ticker)
            return envelope(raw, ticker=ticker, extract='insider', source='SEC EDGAR Form 4')

        elif extract == 'institutional':
            if institution:
                from eugene.sources.holdings_13f import get_whale_holdings
                raw = get_whale_holdings(institution)
                return envelope(raw, ticker=ticker, extract='institutional', source='SEC 13F-HR')
            from eugene.sources.holdings_13f import get_whale_holdings
            raw = get_whale_holdings(ticker)
            return envelope(raw, ticker=ticker, extract='institutional', source='SEC 13F-HR')

        elif extract == 'filings':
            from eugene.sources.edgar import EDGARClient
            from eugene.config import Config
            client = EDGARClient(Config())
            filings = client.get_filings(ticker, filing_type=filing_type, limit=limit)
            data = [{'type': f.filing_type, 'date': f.filing_date, 'accession': f.accession_number, 'url': f.filing_url} for f in filings]
            return envelope(data, ticker=ticker, extract='filings', source='SEC EDGAR')

        elif extract == 'estimates':
            from eugene.sources.fmp import get_analyst_estimates
            raw = get_analyst_estimates(ticker)
            return envelope(raw, ticker=ticker, extract='estimates', source='FMP')

        elif extract == 'news':
            from eugene.sources.fmp import get_stock_news
            raw = get_stock_news(ticker, limit)
            return envelope(raw, ticker=ticker, extract='news', source='FMP')

        else:
            return envelope({'error': f'Unknown extract: {extract}', 'valid_extracts': SEC_EXTRACTS},
                          ticker=ticker, extract=extract)

    except Exception as e:
        logger.error(f'eugene_sec({ticker}, {extract}) failed: {e}')
        return envelope({'error': str(e)}, ticker=ticker, extract=extract)


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
            raw = get_economic_data(series)
            return envelope(raw, category=series, source='FRED')

        if category == 'treasury':
            from eugene.sources.fred import get_economic_data
            yields = {}
            for s in ['DGS1', 'DGS2', 'DGS5', 'DGS10', 'DGS30']:
                data = get_economic_data(s)
                if 'observations' in data and data['observations']:
                    yields[s] = {'rate': data['observations'][-1].get('value'), 'date': data['observations'][-1].get('date')}
            return envelope(yields, category='treasury', source='FRED')

        from eugene.sources.fred import get_latest_indicators
        raw = get_latest_indicators(category)
        return envelope(raw, category=category, source='FRED')

    except Exception as e:
        logger.error(f'eugene_economics({category}) failed: {e}')
        return envelope({'error': str(e)}, category=category)


# =============================================
# Capabilities (for agent discovery)
# =============================================

def capabilities() -> dict:
    """List all available tools, extracts, and categories."""
    return {
        'service': 'eugene-intelligence',
        'version': VERSION,
        'tools': {
            'eugene_sec': {
                'description': 'All SEC and company data in one call',
                'parameters': {
                    'ticker': 'Stock symbol (required)',
                    'extract': SEC_EXTRACTS,
                    'filing_type': '10-K, 10-Q, 8-K (optional, for filings)',
                    'institution': 'Fund name (optional, for institutional)',
                    'limit': 'Number of results (default 10)',
                },
            },
            'eugene_economics': {
                'description': 'All economic data from FRED in one call',
                'parameters': {
                    'category': ECON_CATEGORIES,
                    'series': 'Any FRED series ID (overrides category)',
                },
            },
        },
    }


# =============================================
# FastAPI Server
# =============================================

def create_api():
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    app = FastAPI(
        title='Eugene Intelligence API',
        description='Financial context for AI agents. 2 endpoints. Every number traced to source.',
        version=VERSION,
        docs_url='/',
        redoc_url='/redoc',
        openapi_url='/openapi.json',
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

    @app.get('/v1/capabilities')
    def capabilities_endpoint():
        return capabilities()

    @app.get('/health')
    def health():
        return {'status': 'ok', 'service': 'eugene-intelligence', 'version': VERSION, 'tools': ['eugene_sec', 'eugene_economics']}

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

    @mcp.tool()
    def caps() -> dict:
        """List all available Eugene tools, extracts, and categories for agent discovery."""
        return capabilities()

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
