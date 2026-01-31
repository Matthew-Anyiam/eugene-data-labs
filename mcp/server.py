"""
Eugene Intelligence - MCP Server

Model Context Protocol server for AI agent integration.
Allows Claude and other AI agents to query Eugene data directly.
"""

import json
from typing import Any
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    Tool,
    TextContent,
    CallToolResult,
)

# Initialize MCP server
server = Server("eugene-intelligence")


# ==========================================
# Mock Data (Same as API - would share DB)
# ==========================================

MOCK_COMPANIES = {
    "AAPL": {"ticker": "AAPL", "name": "Apple Inc.", "sector": "Technology"},
    "MSFT": {"ticker": "MSFT", "name": "Microsoft Corporation", "sector": "Technology"},
    "TSLA": {"ticker": "TSLA", "name": "Tesla Inc.", "sector": "Consumer Discretionary"},
    "JPM": {"ticker": "JPM", "name": "JPMorgan Chase & Co.", "sector": "Financials"},
}

MOCK_CREDIT_DATA = {
    "TSLA": {
        "ticker": "TSLA",
        "company_name": "Tesla Inc.",
        "as_of_date": "2024-09-30",
        "total_debt_millions": 5500,
        "net_debt_millions": -8000,
        "cash_millions": 13500,
        "ebitda_millions": 12000,
        "leverage_ratio": 0.46,
        "interest_coverage": 25.0,
        "debt_instruments": [
            {
                "name": "2025 Convertible Notes",
                "type": "convertible",
                "outstanding_millions": 1800,
                "rate": "2.00% fixed",
                "maturity": "2025-05-15"
            },
            {
                "name": "Automotive Asset-Backed Notes",
                "type": "asset_backed",
                "outstanding_millions": 3700,
                "rate": "4.50% fixed",
                "maturity": "2028-12-15"
            }
        ],
        "covenants": [],
        "maturity_schedule": {
            "2025": 1800,
            "2026": 500,
            "2027": 700,
            "2028": 2500
        },
        "analysis": "Tesla maintains a net cash position with minimal leverage. No financial covenants on outstanding debt. Near-term maturity of $1.8B convertible notes in May 2025 is easily covered by $13.5B cash position."
    },
    "JPM": {
        "ticker": "JPM",
        "company_name": "JPMorgan Chase & Co.",
        "as_of_date": "2024-09-30",
        "total_debt_millions": 350000,
        "tier1_capital_ratio": 15.3,
        "cet1_ratio": 15.0,
        "leverage_ratio": 6.5,
        "debt_instruments": [
            {
                "name": "Senior Notes (Various)",
                "type": "senior_unsecured",
                "outstanding_millions": 200000,
                "rate": "Various 3-6%",
                "maturity": "2025-2054"
            },
            {
                "name": "Subordinated Debt",
                "type": "subordinated",
                "outstanding_millions": 25000,
                "rate": "Various 4-7%",
                "maturity": "2026-2049"
            }
        ],
        "covenants": [
            {
                "type": "regulatory",
                "name": "Minimum CET1 Ratio",
                "requirement": 11.4,
                "current": 15.0,
                "status": "compliant",
                "cushion_percent": 31.6
            }
        ],
        "analysis": "JPMorgan maintains strong capital ratios well above regulatory minimums. CET1 ratio of 15.0% provides 360bps cushion above the 11.4% requirement. Bank is well-positioned for stress scenarios."
    }
}


# ==========================================
# Tool Definitions
# ==========================================

@server.list_tools()
async def list_tools() -> list[Tool]:
    """List available tools"""
    return [
        Tool(
            name="get_company_info",
            description="Get basic information about a company including name, sector, and coverage status",
            inputSchema={
                "type": "object",
                "properties": {
                    "ticker": {
                        "type": "string",
                        "description": "Stock ticker symbol (e.g., AAPL, MSFT, TSLA)"
                    }
                },
                "required": ["ticker"]
            }
        ),
        Tool(
            name="get_credit_summary",
            description="Get comprehensive credit analysis for a company including debt levels, leverage ratios, debt instruments, covenants, and maturity schedule. Use this to understand a company's debt structure and credit risk.",
            inputSchema={
                "type": "object",
                "properties": {
                    "ticker": {
                        "type": "string",
                        "description": "Stock ticker symbol"
                    }
                },
                "required": ["ticker"]
            }
        ),
        Tool(
            name="get_debt_instruments",
            description="Get detailed information about a company's individual debt instruments including bonds, loans, credit facilities, and convertible notes",
            inputSchema={
                "type": "object",
                "properties": {
                    "ticker": {
                        "type": "string",
                        "description": "Stock ticker symbol"
                    }
                },
                "required": ["ticker"]
            }
        ),
        Tool(
            name="get_covenants",
            description="Get financial covenant information for a company including leverage limits, coverage requirements, current compliance status, and covenant cushion",
            inputSchema={
                "type": "object",
                "properties": {
                    "ticker": {
                        "type": "string",
                        "description": "Stock ticker symbol"
                    }
                },
                "required": ["ticker"]
            }
        ),
        Tool(
            name="get_maturity_schedule",
            description="Get the debt maturity schedule showing when debt payments are due by year",
            inputSchema={
                "type": "object",
                "properties": {
                    "ticker": {
                        "type": "string",
                        "description": "Stock ticker symbol"
                    }
                },
                "required": ["ticker"]
            }
        ),
        Tool(
            name="compare_credit",
            description="Compare credit metrics between two companies",
            inputSchema={
                "type": "object",
                "properties": {
                    "ticker1": {
                        "type": "string",
                        "description": "First company ticker"
                    },
                    "ticker2": {
                        "type": "string",
                        "description": "Second company ticker"
                    }
                },
                "required": ["ticker1", "ticker2"]
            }
        ),
        Tool(
            name="list_covered_companies",
            description="List all companies with credit data coverage",
            inputSchema={
                "type": "object",
                "properties": {
                    "sector": {
                        "type": "string",
                        "description": "Optional: filter by sector"
                    }
                }
            }
        ),
        Tool(
            name="get_credit_alerts",
            description="Get recent credit alerts and warnings for monitored companies",
            inputSchema={
                "type": "object",
                "properties": {
                    "ticker": {
                        "type": "string",
                        "description": "Optional: filter by ticker"
                    },
                    "severity": {
                        "type": "string",
                        "enum": ["info", "warning", "critical"],
                        "description": "Optional: filter by severity"
                    }
                }
            }
        )
    ]


# ==========================================
# Tool Implementations
# ==========================================

@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    """Handle tool calls"""
    
    if name == "get_company_info":
        ticker = arguments.get("ticker", "").upper()
        
        if ticker in MOCK_COMPANIES:
            company = MOCK_COMPANIES[ticker]
            has_credit = ticker in MOCK_CREDIT_DATA
            
            result = {
                "ticker": company["ticker"],
                "name": company["name"],
                "sector": company["sector"],
                "credit_coverage": has_credit,
                "data_as_of": MOCK_CREDIT_DATA.get(ticker, {}).get("as_of_date", "N/A")
            }
            return [TextContent(type="text", text=json.dumps(result, indent=2))]
        else:
            return [TextContent(type="text", text=f"Company {ticker} not found in Eugene database")]
    
    elif name == "get_credit_summary":
        ticker = arguments.get("ticker", "").upper()
        
        if ticker in MOCK_CREDIT_DATA:
            data = MOCK_CREDIT_DATA[ticker]
            
            summary = {
                "ticker": data["ticker"],
                "company": data["company_name"],
                "as_of_date": data["as_of_date"],
                "key_metrics": {
                    "total_debt_millions": data.get("total_debt_millions"),
                    "net_debt_millions": data.get("net_debt_millions"),
                    "cash_millions": data.get("cash_millions"),
                    "leverage_ratio": data.get("leverage_ratio"),
                    "interest_coverage": data.get("interest_coverage"),
                },
                "debt_instrument_count": len(data.get("debt_instruments", [])),
                "covenant_count": len(data.get("covenants", [])),
                "analysis": data.get("analysis", "")
            }
            return [TextContent(type="text", text=json.dumps(summary, indent=2))]
        else:
            return [TextContent(type="text", text=f"Credit data for {ticker} not available. Coverage includes: {', '.join(MOCK_CREDIT_DATA.keys())}")]
    
    elif name == "get_debt_instruments":
        ticker = arguments.get("ticker", "").upper()
        
        if ticker in MOCK_CREDIT_DATA:
            instruments = MOCK_CREDIT_DATA[ticker].get("debt_instruments", [])
            result = {
                "ticker": ticker,
                "debt_instruments": instruments,
                "total_instruments": len(instruments)
            }
            return [TextContent(type="text", text=json.dumps(result, indent=2))]
        else:
            return [TextContent(type="text", text=f"Debt data for {ticker} not available")]
    
    elif name == "get_covenants":
        ticker = arguments.get("ticker", "").upper()
        
        if ticker in MOCK_CREDIT_DATA:
            covenants = MOCK_CREDIT_DATA[ticker].get("covenants", [])
            
            if not covenants:
                return [TextContent(type="text", text=f"{ticker} has no financial covenants on its outstanding debt (common for investment-grade or convertible debt)")]
            
            result = {
                "ticker": ticker,
                "covenants": covenants,
                "all_compliant": all(c.get("status") == "compliant" for c in covenants)
            }
            return [TextContent(type="text", text=json.dumps(result, indent=2))]
        else:
            return [TextContent(type="text", text=f"Covenant data for {ticker} not available")]
    
    elif name == "get_maturity_schedule":
        ticker = arguments.get("ticker", "").upper()
        
        if ticker in MOCK_CREDIT_DATA:
            schedule = MOCK_CREDIT_DATA[ticker].get("maturity_schedule", {})
            total = sum(schedule.values())
            
            result = {
                "ticker": ticker,
                "maturity_schedule_millions": schedule,
                "total_debt_millions": total,
                "near_term_18m": sum(v for k, v in schedule.items() if int(k) <= 2026)
            }
            return [TextContent(type="text", text=json.dumps(result, indent=2))]
        else:
            return [TextContent(type="text", text=f"Maturity data for {ticker} not available")]
    
    elif name == "compare_credit":
        ticker1 = arguments.get("ticker1", "").upper()
        ticker2 = arguments.get("ticker2", "").upper()
        
        results = {}
        for ticker in [ticker1, ticker2]:
            if ticker in MOCK_CREDIT_DATA:
                data = MOCK_CREDIT_DATA[ticker]
                results[ticker] = {
                    "company": data["company_name"],
                    "total_debt_millions": data.get("total_debt_millions"),
                    "leverage_ratio": data.get("leverage_ratio"),
                    "interest_coverage": data.get("interest_coverage"),
                    "has_covenants": len(data.get("covenants", [])) > 0
                }
            else:
                results[ticker] = {"error": "not_found"}
        
        return [TextContent(type="text", text=json.dumps(results, indent=2))]
    
    elif name == "list_covered_companies":
        sector = arguments.get("sector", "").lower() if arguments.get("sector") else None
        
        companies = []
        for ticker, company in MOCK_COMPANIES.items():
            if sector and company.get("sector", "").lower() != sector:
                continue
            companies.append({
                "ticker": ticker,
                "name": company["name"],
                "sector": company["sector"],
                "has_credit_data": ticker in MOCK_CREDIT_DATA
            })
        
        return [TextContent(type="text", text=json.dumps({"companies": companies, "total": len(companies)}, indent=2))]
    
    elif name == "get_credit_alerts":
        ticker = arguments.get("ticker", "").upper() if arguments.get("ticker") else None
        severity = arguments.get("severity", "").lower() if arguments.get("severity") else None
        
        # Mock alerts
        alerts = [
            {
                "ticker": "XYZ",
                "type": "covenant_warning",
                "severity": "warning",
                "message": "Leverage ratio at 4.1x, approaching 4.5x covenant limit",
                "date": "2025-01-15"
            },
            {
                "ticker": "ABC",
                "type": "maturity_alert",
                "severity": "info",
                "message": "$500M debt maturing in next 18 months",
                "date": "2025-01-14"
            }
        ]
        
        if ticker:
            alerts = [a for a in alerts if a["ticker"] == ticker]
        if severity:
            alerts = [a for a in alerts if a["severity"] == severity]
        
        return [TextContent(type="text", text=json.dumps({"alerts": alerts}, indent=2))]
    
    else:
        return [TextContent(type="text", text=f"Unknown tool: {name}")]


# ==========================================
# Main
# ==========================================

async def main():
    """Run the MCP server"""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
