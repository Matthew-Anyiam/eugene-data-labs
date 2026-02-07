# Eugene Intelligence

**Financial context for AI.**

The data layer for agents that need to get finance right.

---

## What is Eugene?

Eugene provides verified market data for AI agents — fundamentals, prices, earnings, insider trades, institutional holdings — through one MCP server.

Every number traced to source. No hallucination.

## Products

| Category | Data |
|----------|------|
| **Fundamentals** | SEC XBRL financials, ratios, 5-year trends |
| **Prices** | 20+ years historical, real-time quotes |
| **Earnings** | EPS actuals vs estimates, transcripts, guidance |
| **Ownership** | Insider transactions (Form 4), Institutional (13F) |
| **Corporate Actions** | Dividends, splits, M&A activity |
| **Filings** | 10-K, 10-Q, 8-K — bulk downloads + real-time |

## Quick Start

### MCP Server (for Claude Desktop)
```json
{
  "mcpServers": {
    "eugene": {
      "command": "python",
      "args": ["-m", "mcp.mcp_server"],
      "cwd": "/path/to/eugene"
    }
  }
}
```

### Python
```python
from eugene.agents.equity_research import EquityResearchAgent
from eugene.config import Config

agent = EquityResearchAgent(Config())
report = agent.generate_report("NVDA", peers=["AMD", "INTC"])
```

## Demo

Try it: [huggingface.co/spaces/Rex165/eugene-intelligence](https://huggingface.co/spaces/Rex165/eugene-intelligence)

## MCP Tools (16+)

- `company_health` — Financial ratios and trends
- `get_stock_prices` — Historical prices and quotes
- `get_earnings` — EPS history and estimates
- `get_insider_trades` — Form 4 insider activity
- `get_13f_holdings` — Institutional ownership
- `equity_report` — Full research report with thesis
- `credit_monitor` — Debt analysis and risk scoring
- And more...

## Contact

matthew@eugeneintelligence.com

---

*Built for agents that need to get finance right.*
