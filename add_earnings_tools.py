# Add earnings agent tools to mcp_server.py

with open('mcp/mcp_server.py', 'r') as f:
    content = f.read()

# New tool definitions
new_tools = '''
    {
        "name": "earnings_calendar",
        "description": "Get upcoming earnings dates for a watchlist of stocks. Returns days until earnings, EPS estimates, and historical beat rates.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "tickers": {"type": "array", "items": {"type": "string"}, "description": "List of ticker symbols (e.g., ['AAPL', 'NVDA', 'TSLA'])"}
            },
            "required": ["tickers"]
        }
    },
    {
        "name": "post_earnings_moves",
        "description": "Analyze how a stock typically moves after earnings announcements. Shows 1-day and 5-day price changes after beats vs misses.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock symbol"},
                "num_quarters": {"type": "integer", "description": "Number of past quarters to analyze (default 8)", "default": 8}
            },
            "required": ["ticker"]
        }
    },
    {
        "name": "full_earnings_report",
        "description": "Comprehensive earnings intelligence report. Combines upcoming dates, beat/miss history, price reaction patterns, revenue trends, and estimates.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock symbol"}
            },
            "required": ["ticker"]
        }
    },'''

# New handlers
new_handlers = '''
        elif name == "earnings_calendar":
            from eugene.agents.earnings import EarningsAgent
            from eugene.config import Config
            agent = EarningsAgent(Config())
            return agent.get_earnings_calendar(args["tickers"])
        elif name == "post_earnings_moves":
            from eugene.agents.earnings import EarningsAgent
            from eugene.config import Config
            agent = EarningsAgent(Config())
            return agent.analyze_post_earnings_moves(args["ticker"], args.get("num_quarters", 8))
        elif name == "full_earnings_report":
            from eugene.agents.earnings import EarningsAgent
            from eugene.config import Config
            agent = EarningsAgent(Config())
            return agent.full_earnings_report(args["ticker"])'''

# Insert tools before the closing of TOOLS list
import re

# Find last tool definition and add new ones
tools_match = re.search(r'("get_insider_trades".*?"required": \["ticker"\]\s*\}\s*\})', content, re.DOTALL)
if tools_match:
    insert_pos = tools_match.end()
    content = content[:insert_pos] + ',' + new_tools + content[insert_pos:]
    print("Added earnings tool definitions")

# Find handler insertion point (before else: Unknown tool)
handler_match = re.search(r'(elif name == "get_insider_trades":.*?return result)', content, re.DOTALL)
if handler_match:
    insert_pos = handler_match.end()
    content = content[:insert_pos] + new_handlers + content[insert_pos:]
    print("Added earnings handlers")

with open('mcp/mcp_server.py', 'w') as f:
    f.write(content)

print("Done!")
