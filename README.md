# Eugene Intelligence

[![PyPI version](https://badge.fury.io/py/eugene-intelligence.svg)](https://pypi.org/project/eugene-intelligence/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Data Infrastructure for AI Agents**

---

## Install
```bash
pip install eugene-intelligence
```

## Quick Start
```python
from eugene.tools.institutional import company

# Stock quote
result = company("AAPL", "prices")
print(result["data"]["price"]["formatted"])  # $270.58

# SEC financials with full provenance
result = company("AAPL", "financials")
print(result["data"]["revenue"]["formatted"])  # $416.16B
print(result["data"]["revenue"]["sec_concept"])  # RevenueFromContractWithCustomerExcludingAssessedTax
print(result["data"]["revenue"]["accession_number"])  # 0000320193-25-000079

# Financial health ratios
result = company("AAPL", "health")
print(result["data"]["roe"]["formatted"])  # 151.91%
```

---

## MCP Server (Claude Desktop)
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

**4 Tools:**
- `company(ticker, type)` — prices, profile, financials, health, earnings, insider
- `economy_data(category)` — inflation, employment, gdp, housing, treasury, forex
- `regulatory_data(type)` — sec_press, fed_speeches, fomc, treasury_debt
- `research_report(ticker, type)` — equity, credit

---

## Data Sources

| Source | Data |
|--------|------|
| **SEC XBRL** | Financial statements (10-K, 10-Q) with accession numbers |
| **SEC EDGAR** | Insider trades (Form 4), 13F holdings |
| **FRED** | 400K+ economic series |
| **FMP** | Real-time stock prices |
| **Fed RSS** | Speeches, FOMC statements |
| **Treasury** | National debt, yields |

---

## Demo

Try it: [huggingface.co/spaces/Rex165/eugene-intelligence](https://huggingface.co/spaces/Rex165/eugene-intelligence)

---

## Why Eugene?

Every number traced to source. No hallucination.
```json
{
  "revenue": {
    "value": 416161000000,
    "formatted": "$416.16B",
    "period_end": "2025-09-27",
    "filed_date": "2025-10-31",
    "sec_concept": "RevenueFromContractWithCustomerExcludingAssessedTax",
    "accession_number": "0000320193-25-000079"
  }
}
```

---

## Contact

[matthew@eugeneintelligence.com](mailto:matthew@eugeneintelligence.com)

---

*Built for agents that need to get finance right.*
