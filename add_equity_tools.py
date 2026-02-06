with open('mcp/mcp_server.py', 'r') as f:
    content = f.read()

new_tools = '''
    {
        "name": "equity_report",
        "description": "Comprehensive equity research report. Combines financials, valuation, price performance, earnings quality, insider activity, peer comparison, risk assessment, and investment thesis with bull/bear cases.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock symbol"},
                "peers": {"type": "array", "items": {"type": "string"}, "description": "Optional peer tickers for comparison (e.g., ['AMD', 'INTC'])"}
            },
            "required": ["ticker"]
        }
    },
    {
        "name": "quick_screen",
        "description": "Quick screening of multiple stocks. Returns key metrics (price, P/E, 1Y return, insider signal) for comparison.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "tickers": {"type": "array", "items": {"type": "string"}, "description": "List of ticker symbols to screen"}
            },
            "required": ["tickers"]
        }
    },'''

new_handlers = '''
        elif name == "equity_report":
            from eugene.agents.equity_research import EquityResearchAgent
            from eugene.config import Config
            agent = EquityResearchAgent(Config())
            return agent.generate_report(args["ticker"], args.get("peers", []))
        elif name == "quick_screen":
            from eugene.agents.equity_research import EquityResearchAgent
            from eugene.config import Config
            agent = EquityResearchAgent(Config())
            return agent.quick_screen(args["tickers"])'''

import re

# Add tools
match = re.search(r'("full_earnings_report".*?"required": \["ticker"\]\s*\}\s*\})', content, re.DOTALL)
if match:
    content = content[:match.end()] + ',' + new_tools + content[match.end():]
    print("Added equity tool definitions")

# Add handlers
match = re.search(r'(elif name == "full_earnings_report":.*?return.*?full_earnings_report\(args\["ticker"\]\))', content, re.DOTALL)
if match:
    content = content[:match.end()] + new_handlers + content[match.end():]
    print("Added equity handlers")

with open('mcp/mcp_server.py', 'w') as f:
    f.write(content)

print("Done!")
