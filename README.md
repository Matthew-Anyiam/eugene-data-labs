# Eugene Intelligence

**Data Infrastructure for AI Agents**

---

## What is Eugene?

Eugene provides verified financial data for AI agents — SEC filings, market data, economic indicators, regulatory news — through one MCP server.

Every number traced to source. No hallucination.

---

## Quick Start

### MCP Server (Claude Desktop)

Add to your Claude config:
```json
{
  "mcpServers": {
    "eugene": {
      "command": "python",
      "args": ["mcp_server.py"],
      "cwd": "/path/to/eugene"
    }
  }
}
```

### Python
```python
from eugene.tools.institutional import company

# Get stock price
result = company("AAPL", "prices")
print(result["data"]["price"]["formatted"])  # $275.50

# Get SEC financials
result = company("AAPL", "financials")
print(result["data"]["revenue"]["formatted"])  # $416.16B
```

---

## MCP Tools (4)

| Tool | Description | Types |
|------|-------------|-------|
| `company` | Company data | prices, profile, financials, health, earnings, insider |
| `economy_data` | Economic indicators | inflation, employment, gdp, housing, treasury, forex |
| `regulatory_data` | Government & regulatory | sec_press, fed_speeches, fomc, treasury_debt |
| `research_report` | AI-powered analysis | equity, credit |

---

## Data Sources

- **SEC XBRL** — Financial statements (10-K, 10-Q)
- **SEC EDGAR** — Insider trades (Form 4), 13F holdings
- **FRED** — 400K+ economic series
- **FMP** — Real-time stock prices
- **Fed RSS** — Speeches, FOMC statements
- **Treasury** — National debt, yields

---

## Demo

Try it: [huggingface.co/spaces/Rex165/eugene-intelligence](https://huggingface.co/spaces/Rex165/eugene-intelligence)

---

## Project Structure
```
eugene/
├── eugene/                 # Core package
│   ├── core/              # Response formatting, HTTP client
│   ├── sources/           # Data sources (SEC, FRED, FMP)
│   ├── tools/             # MCP tools
│   └── agents/            # AI research agents
├── api/                   # REST API (FastAPI)
├── mcp_server.py          # MCP server entry point
└── requirements.txt
```

---

## Contact

[matthew@eugeneintelligence.com](mailto:matthew@eugeneintelligence.com)

---

*Built for agents that need to get finance right.*
