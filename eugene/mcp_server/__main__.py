"""
Eugene Intelligence MCP Server
Data Infrastructure for AI Agents
4 tools: company, economy, regulatory, research
"""
from mcp.server.fastmcp import FastMCP
from eugene.tools.institutional import company as inst_company
from eugene.tools.mcp_tools import economy, regulatory, research

mcp = FastMCP("eugene-intelligence")


@mcp.tool()
def company(ticker: str, type: str = "prices") -> dict:
    """
    Company data: prices, profile, financials, health, earnings, insider.
    
    Examples:
    - company("AAPL", "prices") → stock quote
    - company("AAPL", "financials") → SEC XBRL financials
    - company("TSLA", "insider") → insider trades
    - company("JPM", "health") → financial health metrics
    """
    return inst_company(ticker, type)


@mcp.tool()
def economy_data(category: str = "all") -> dict:
    """
    Economic data: inflation, employment, gdp, housing, treasury, forex.
    
    Examples:
    - economy_data("treasury") → yield curve
    - economy_data("inflation") → CPI, PCE
    - economy_data("forex") → exchange rates
    """
    return economy(category)


@mcp.tool()
def regulatory_data(type: str = "sec_press", ticker: str = None, limit: int = 10) -> dict:
    """
    Government & regulatory data: sec_press, sec_enforcement, fed_speeches, fomc, treasury_debt.
    
    Examples:
    - regulatory_data("fed_speeches") → Fed speeches
    - regulatory_data("fomc") → FOMC statements
    - regulatory_data("company_risk", ticker="AAPL") → check enforcement
    """
    return regulatory(type, ticker, limit)


@mcp.tool()
def research_report(ticker: str, type: str = "equity") -> dict:
    """
    AI-powered research: equity analysis, credit monitoring.
    
    Examples:
    - research_report("NVDA", "equity") → equity research
    - research_report("BA", "credit") → credit analysis
    """
    return research(ticker, type)


if __name__ == "__main__":
    mcp.run()
