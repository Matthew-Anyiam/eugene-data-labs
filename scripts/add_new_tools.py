# Script to add new tools to mcp_server.py

# Read the current file
with open('mcp/mcp_server.py', 'r') as f:
    content = f.read()

# New tool definitions to add to TOOLS list
new_tools = '''
    {
        "name": "get_stock_prices",
        "description": "Historical stock prices for any public company. Returns OHLCV data, current quote, 52-week range, moving averages, and total return. Supports 20+ years of daily data.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock symbol (e.g., AAPL, TSLA)"},
                "period": {"type": "string", "description": "Time period: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, max", "default": "1y"},
                "interval": {"type": "string", "description": "Data frequency: 1d, 1wk, 1mo", "default": "1d"}
            },
            "required": ["ticker"]
        }
    },
    {
        "name": "get_earnings",
        "description": "Earnings history for a company - EPS actuals vs estimates, beat/miss record, revenue trends, and upcoming earnings dates.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock symbol (e.g., NVDA, AAPL)"}
            },
            "required": ["ticker"]
        }
    },
    {
        "name": "get_insider_trades",
        "description": "Insider trading activity (SEC Form 4) for a company. Shows buys, sells, and option exercises by officers, directors, and 10%+ owners.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock symbol (e.g., AAPL, TSLA)"},
                "days_back": {"type": "integer", "description": "Days of history (default 365)", "default": 365}
            },
            "required": ["ticker"]
        }
    },'''

# New handler cases
new_handlers = '''
        elif name == "get_stock_prices":
            from eugene.sources.yahoo import get_stock_prices
            result = get_stock_prices(args["ticker"], args.get("period", "1y"), args.get("interval", "1d"))
            if "prices" in result and len(result["prices"]) > 60:
                result["prices"] = result["prices"][-60:]
            return result
        elif name == "get_earnings":
            from eugene.sources.yahoo import get_earnings_data
            return get_earnings_data(args["ticker"])
        elif name == "get_insider_trades":
            from eugene.sources.insider import get_insider_transactions
            result = get_insider_transactions(args["ticker"], args.get("days_back", 365))
            if "transactions" in result and len(result["transactions"]) > 25:
                result["transactions"] = result["transactions"][:25]
            return result'''

# Find where to insert new tools (before the closing bracket of TOOLS list)
# Find the last tool in TOOLS and add after it
import re

# Add new tools - find last } in TOOLS before ]
tools_pattern = r'(TOOLS = \[.*?"required": \["ticker"\]\s*\}\s*\})'
match = re.search(tools_pattern, content, re.DOTALL)
if match:
    insert_pos = match.end()
    content = content[:insert_pos] + ',' + new_tools + content[insert_pos:]
    print("Added new tool definitions to TOOLS list")
else:
    print("Could not find TOOLS list insertion point")

# Add new handlers - find "else: return {"error": "Unknown tool"
handler_pattern = r'(\s+)(else:\s*\n\s*return \{"error": "Unknown tool)'
match = re.search(handler_pattern, content)
if match:
    indent = match.group(1)
    insert_pos = match.start()
    content = content[:insert_pos] + new_handlers + '\n' + indent + content[insert_pos:]
    print("Added new handler cases")
else:
    print("Could not find handler insertion point")

# Write back
with open('mcp/mcp_server.py', 'w') as f:
    f.write(content)

print("Done! mcp_server.py updated with 3 new tools")
