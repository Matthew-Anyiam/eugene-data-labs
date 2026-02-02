# Eugene Intelligence

> Financial context infrastructure for AI agents

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)

**Eugene Intelligence** is an API and MCP layer that gives agents continuously updated financial context — SEC filings, credit intelligence, market data — so they don't hallucinate and you skip manual ingestion.

Your financial agent is only as good as its data. If it's reasoning over hallucinated numbers, it's useless—or dangerous. Eugene gives your agent grounded, sourced, verified financial data it can trust.

## Architecture
```
┌─────────────────────────────────────────────────────┐
│  AGENTS (the customers)                             │
│  Credit analysis, portfolio monitoring, research,   │
│  due diligence, compliance, trading signals...      │
└────────────────────────┬────────────────────────────┘
                         │ MCP / API
┌────────────────────────▼────────────────────────────┐
│  EUGENE INTELLIGENCE                                │
│  "Financial intelligence for agents"                │
│                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ Credit      │ │ Equity      │ │ Macro       │   │
│  │ Intelligence│ │ Intelligence│ │ Intelligence│   │
│  └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                     │
│  • Debt schedules    • Guidance      • Fed minutes │
│  • Covenants         • Segment data  • Economic    │
│  • Ratings           • Insider txns  • Policy      │
│  • Lease obligations • Comps         • Indicators  │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│  EXTRACTION + VALIDATION LAYER (the moat)           │
│  SEC filings, earnings calls, credit agreements,    │
│  Fed transcripts, economic releases...              │
└─────────────────────────────────────────────────────┘
```

## The Problem
```
Without Eugene:
   Agent → LLM → hallucinates "Apple has $50B debt maturing 2025"

With Eugene:
   Agent → LLM → calls get_debt_schedule("AAPL") → verified, sourced, cites 10-K exhibit
```

## Market Position
```
FactSet + AlphaSense + Refinitiv + Bloomberg
            │
            │  built for humans
            ▼
    ┌───────────────┐
    │     GAP       │  unstructured → structured
    │               │  human-readable → agent-readable
    └───────────────┘
            │
            │  built for agents
            ▼
   Eugene Intelligence
```

**Competitors** scrape SEC filings or provide raw text.

**Eugene's value** is in the quality and structure of the context—parsed, normalized, verified data that eliminates the need for agents to interpret messy footnotes themselves.

## Coverage
```
Eugene Intelligence
        │
        ├── Coverage
        │       ├── 20,000+ stocks
        │       ├── 30+ years historical data
        │       └── Real-time updates
        │
        ├── Regulatory Filings
        │       ├── SEC (10-K, 10-Q, 8-K, Forms 3/4/5, 13D/F/G)
        │       ├── International (20-F, 6-K, 40-F)
        │       └── State filings
        │
        ├── Market Data
        │       ├── Prices & volume
        │       ├── Options flow
        │       ├── Short interest
        │       └── Dark pool activity
        │
        ├── Credit Intelligence
        │       ├── Debt schedules
        │       ├── Covenant terms
        │       ├── Lease obligations
        │       ├── Credit ratings
        │       └── Default probabilities
        │
        ├── Alternative Data
        │       ├── Earnings call transcripts
        │       ├── News & sentiment
        │       ├── Insider behavior
        │       └── Institutional positioning
        │
        └── Corporate Events
                ├── M&A activity
                ├── IPOs & SPACs
                ├── Bankruptcies
                └── Management changes
```

## Product Layers
```
Eugene Intelligence
        │
        ├── Data-as-a-Service (API, datasets)
        │       └── "I'm building my own agent, give me the data"
        │
        ├── Agents-as-a-Service (workflows, monitoring)
        │       └── "I don't want to build, just do the work"
        │
        └── MCP Servers (tool interface)
                └── "My agent needs to call your data/agents natively"
```

## Quick Start
```bash
# Clone
git clone https://github.com/Matthew-Anyiam/eugene-data-labs.git
cd eugene-data-labs

# Setup
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Test
python test_offline.py

# Run mock extraction
python run_all_mocks.py
```

## Intelligence Pillars

### Credit Intelligence ✅ Built

| Data | Source | Example |
|------|--------|---------|
| Debt Schedules | 10-K/10-Q | Term Loan B, $2B, SOFR+275bps, due 2028 |
| Covenant Terms | 10-K/10-Q | Max Leverage 4.5x, Current 3.2x, 29% cushion |
| Lease Obligations | 10-K/10-Q | Operating leases $1.2B |
| CapEx & FCF | 10-K/10-Q | CapEx $8.5B, OCF $15.2B, FCF $6.7B |

### Equity Intelligence 🔲 Building

| Data | Source | Example |
|------|--------|---------|
| Company Profile | SEC + Public | Sector, industry, executives, business segments |
| Guidance | Earnings calls | Revenue $90-94B, raised from $88-92B |
| Segment Data | 10-K | AWS $80B, Advertising $38B |
| Insider Transactions | Forms 3/4/5 | CEO bought 50,000 shares at $245 |
| Comparables | Computed | P/E vs peers, margin vs industry |

### Macro Intelligence 🔲 Planned

| Data | Source | Example |
|------|--------|---------|
| Fed Minutes | Federal Reserve | Hawkish/dovish sentiment |
| Economic Indicators | BLS, BEA | CPI, GDP, unemployment |
| Policy Changes | Government | Rate decisions, fiscal policy |

## Parsers Built

| Parser | Filing Type | Purpose |
|--------|-------------|---------|
| `debt.py` | 10-K/10-Q | Debt instruments, covenants, maturities |
| `earnings.py` | Transcripts | Guidance, management tone, sentiment |
| `capex.py` | 10-K/10-Q | Capital expenditures, free cash flow |
| `form8k.py` | 8-K | Material events extraction |
| `form3.py` | Form 3 | Initial insider ownership |
| `form4.py` | Form 4 | Insider trades |
| `form5.py` | Form 5 | Annual insider summary |
| `form13d.py` | Schedule 13D | Active ownership (>5%) |
| `form13f.py` | Schedule 13F | Institutional holdings |
| `form13g.py` | Schedule 13G | Passive ownership (>5%) |

## Agents Built

| Agent | Purpose | Status |
|-------|---------|--------|
| Credit Monitoring Agent | Covenant alerts, debt changes, insider activity | ✅ Built |
| Equity Research Agent | Company profiles, research summaries | 🔲 Building |

## MCP Server

Eugene MCP server becomes the bridge between raw SEC filings and the structured context agents need. When an agent queries Eugene via MCP, it gets exactly the debt schedules, covenant terms, or lease obligations relevant to its task.
```json
{
  "mcpServers": {
    "eugene": {
      "command": "python",
      "args": ["/path/to/eugene/mcp/server.py"]
    }
  }
}
```

Then ask Claude: *"What are Tesla's debt covenants?"*

## API Usage
```python
# Python
from extraction.parsers.debt import extract_debt
result = extract_debt(ticker="TSLA", filing_type="10-K")

# REST API
curl http://localhost:8000/v1/credit/TSLA

# MCP
# Agent calls get_debt_schedule("TSLA") → returns structured data
```

## Project Structure
```
eugene-data-labs/
├── agents/
│   └── credit_monitor.py    # Credit Monitoring Agent
├── api/
│   └── main.py              # FastAPI REST endpoints
├── extraction/
│   └── parsers/             # All filing parsers
├── mcp/
│   └── server.py            # MCP server for Claude
├── data/
│   ├── samples/             # Sample company data
│   └── extractions/         # Extraction outputs
├── web/
│   └── index.html           # Dashboard UI
└── run_all_mocks.py         # Batch mock extraction
```

## Sample Companies

| Ticker | Company | Sector |
|--------|---------|--------|
| TSLA | Tesla | Auto |
| AAPL | Apple | Tech |
| MSFT | Microsoft | Tech |
| GOOGL | Alphabet | Tech |
| AMZN | Amazon | Retail/Cloud |
| META | Meta | Tech |
| NVDA | NVIDIA | Semiconductors |
| JPM | JPMorgan | Banking |
| WMT | Walmart | Retail |
| BRK.A | Berkshire | Conglomerate |

## Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| MVP | SEC filings, Credit Intelligence | ✅ Built |
| Phase 2 | Equity Intelligence, Research Agent | 🔲 Building |
| Phase 3 | Macro Intelligence | 🔲 Planned |
| Phase 4 | Market data, real-time | 🔲 Planned |
| Phase 5 | International filings | 🔲 Planned |

## vs Competitors

| Dimension | FinancialDatasets.ai | Eugene Intelligence |
|-----------|---------------------|---------------------|
| Data types | Prices, fundamentals, SEC text | Same + **structured credit intelligence** |
| SEC filings | Raw text extraction | **Parsed, normalized, verified** |
| Delivery | API | API + **MCP for agents** |
| Unique value | Broad coverage | **Depth of extraction** |

> FinancialDatasets.ai gives you the text. Eugene gives you the answer.

## License

MIT

---

Built by [Matthew Rex Anyiam](https://github.com/Matthew-Anyiam) | Eugene Intelligence
