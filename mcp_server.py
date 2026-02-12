"""
Eugene Intelligence MCP Server
4 tools: company, economy, regulatory, research
"""
from mcp.server.fastmcp import FastMCP
from eugene.tools.mcp_tools import company, economy, regulatory, research

mcp = FastMCP("eugene-intelligence")


@mcp.tool()
def company_tool(ticker: str, type: str = "prices") -> dict:
    """
    All company data: prices, profile, financials, health, earnings, insider, institutional, filings.
    
    Examples:
    - company_tool("AAPL", "prices") → current stock quote
    - company_tool("TSLA", "insider") → insider trades
    - company_tool("JPM", "health") → financial health metrics
    """
    return company(ticker, type)


@mcp.tool()
def economy_tool(category: str = "all") -> dict:
    """
    Economic data: inflation, employment, gdp, housing, consumer, manufacturing, rates, treasury, forex.
    
    Examples:
    - economy_tool("treasury") → yield curve
    - economy_tool("inflation") → CPI, PCE
    - economy_tool("forex") → exchange rates
    """
    return economy(category)


@mcp.tool()
def regulatory_tool(type: str = "sec_press", ticker: str = None, limit: int = 10) -> dict:
    """
    Government & regulatory data: sec_press, sec_enforcement, fed_speeches, fomc, treasury_debt, company_risk.
    
    Examples:
    - regulatory_tool("fed_speeches") → Fed speeches
    - regulatory_tool("fomc") → FOMC statements
    - regulatory_tool("company_risk", ticker="AAPL") → check enforcement actions
    """
    return regulatory(type, ticker, limit)


@mcp.tool()
def research_tool(ticker: str, type: str = "equity") -> dict:
    """
    AI-powered research: equity analysis, credit monitoring.
    
    Examples:
    - research_tool("NVDA", "equity") → full equity research report
    - research_tool("BA", "credit") → credit/debt analysis
    """
    return research(ticker, type)


if __name__ == "__main__":
    mcp.run()
