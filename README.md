# Eugene Intelligence

**Financial context for AI. The data layer for agents that need to get finance right.**

---

## What is Eugene?

Eugene provides verified, structured financial data for AI agents — fundamentals, prices, earnings, insider trades, institutional holdings, economic indicators — through a unified API and MCP server.

Every number traced to its source. No hallucination.

## 2 Tools. Complete Coverage.

| Tool | What It Covers | Sources |
|------|---------------|---------|
| `eugene_sec` | Company financials, prices, health ratios, earnings, insider trades, 13F holdings, SEC filings, analyst estimates, news | SEC XBRL, EDGAR, FMP |
| `eugene_economics` | Inflation, employment, GDP, housing, rates, yield curve, money supply | FRED |

## Quick Start

### Install
```bash
pip install eugene-intelligence
```

### API
```bash
python eugene_server.py
# Open http://localhost:8000 for Swagger docs
```
```bash
# Company financials from SEC XBRL
curl "http://localhost:8000/v1/sec/AAPL?extract=financials"

# Stock price
curl "http://localhost:8000/v1/sec/AAPL?extract=prices"

# Treasury yield curve
curl "http://localhost:8000/v1/economics/treasury"

# Insider trades
curl "http://localhost:8000/v1/sec/TSLA?extract=insider"

# All economic indicators
curl "http://localhost:8000/v1/economics/all"
```

### Python
```python
from eugene_server import eugene_sec, eugene_economics

# SEC XBRL financials — traced to exact filing
financials = eugene_sec("AAPL", extract="financials")
print(financials["revenue"])  # value, xbrl_tag, period_end, filed date

# Stock price
price = eugene_sec("NVDA", extract="prices")

# Financial health ratios
health = eugene_sec("BA", extract="health")

# Treasury yield curve
yields = eugene_economics("treasury")

# Insider trades
insider = eugene_sec("TSLA", extract="insider")

# 13F institutional holdings
holdings = eugene_sec("AAPL", extract="institutional")
```

### MCP Server (for Claude, Cursor, etc.)
```bash
python eugene_server.py --mode mcp
```

Claude Desktop config:
```json
{
  "mcpServers": {
    "eugene": {
      "command": "python3",
      "args": ["eugene_server.py", "--mode", "mcp"],
      "cwd": "/path/to/eugene"
    }
  }
}
```

## API Reference

### `eugene_sec` — Company & SEC Data
```
GET /v1/sec/{ticker}?extract={type}
```

| Extract | Description | Source |
|---------|-------------|--------|
| `financials` | Balance sheet, income statement, cash flow | SEC XBRL |
| `prices` | Current quote, day range, 52-week, moving averages | FMP |
| `profile` | Company overview, sector, CEO, employees | FMP |
| `health` | D/E, ROE, ROA, margins, interest coverage | SEC XBRL |
| `earnings` | EPS actuals vs estimates | FMP |
| `insider` | Form 4 insider trades | SEC EDGAR |
| `institutional` | 13F holdings (Berkshire, BlackRock, etc.) | SEC 13F-HR |
| `filings` | 10-K, 10-Q, 8-K filing list | SEC EDGAR |
| `estimates` | Analyst price targets | FMP |
| `news` | Recent company news | FMP |

### `eugene_economics` — Macro & Market Data
```
GET /v1/economics/{category}
```

| Category | Data |
|----------|------|
| `treasury` | Full yield curve (1Y-30Y) |
| `inflation` | CPI, PCE |
| `employment` | Unemployment, payrolls, claims |
| `gdp` | GDP growth |
| `housing` | Starts, permits, mortgage rates |
| `rates` | Fed funds, spreads |
| `all` | Everything |

## Why Eugene?

- **Source-traced**: Every number links to exact SEC filing, XBRL tag, and accession number
- **Deterministic**: No LLM in the data layer. Pure extraction
- **Agent-native**: Built for MCP and API consumption, not human terminals
- **XBRL-native**: Direct SEC XBRL parsing, not scraped tables

## Demo

Try it: [huggingface.co/spaces/Rex165/eugene-intelligence](https://huggingface.co/spaces/Rex165/eugene-intelligence)

## Products

| Product | Status | Description |
|---------|--------|-------------|
| **Eugene Data** | Live | API + MCP — this repo |
| **Eugene Agents** | Q2 2026 | Credit analysis, equity research, Excel agent |
| **TerminalX** | Q3 2026 | Free Bloomberg alternative |
| **Eugene Extract** | Q4 2026 | Financial document parsing (Reducto competitor) |

## Contact

[matthew@eugeneintelligence.com](mailto:matthew@eugeneintelligence.com)

---

*Built for agents that need to get finance right.*
