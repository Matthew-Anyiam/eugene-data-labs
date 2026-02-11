# Eugene Intelligence

<p align="center">
  <strong>🔍 Financial context for AI. The data layer for agents that need to get finance right.</strong>
</p>

<p align="center">
  <a href="https://github.com/Matthew-Anyiam/eugene-data-labs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="License"></a>
  <a href="https://github.com/Matthew-Anyiam/eugene-data-labs/stargazers"><img src="https://img.shields.io/github/stars/Matthew-Anyiam/eugene-data-labs?style=for-the-badge" alt="Stars"></a>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-tools">Tools</a> •
  <a href="#-why-eugene">Why Eugene</a> •
  <a href="#-data-sources">Data Sources</a>
</p>

---

## 🎯 What is Eugene?

Eugene provides **verified, source-traced financial data** through one MCP server — fundamentals, prices, earnings, insider trades, institutional holdings, and macro data.

**Every number traced to SEC filings. No hallucination.**

|  |  |  |  |
|--|--|--|--|
| ✅ **SEC XBRL Data** | 🔍 **Source Traced** | 🤖 **MCP Ready** | ⚡ **Real-time Prices** |

---

## ⚡ Quick Start

### Claude Desktop (MCP)

Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "eugene": {
      "command": "python",
      "args": ["-m", "mcp.mcp_server"],
      "cwd": "/path/to/eugene-data-labs",
      "env": {
        "FMP_API_KEY": "your-key",
        "FRED_API_KEY": "your-key"
      }
    }
  }
}
```

### Python
```python
from eugene.tools.consolidated_tools import company_data, market_data

# Get company health metrics
health = company_data(ticker="AAPL", type="health")

# Get treasury yields  
yields = market_data(type="treasury")
```

---

## 🛠️ Tools

| Tool | Description | Types |
|------|-------------|-------|
| `company_data` | Everything about a company | prices, financials, health, profile, filings |
| `earnings_data` | Earnings intelligence | history, calendar, moves, transcript |
| `ownership_data` | Who owns what | insider trades, 13F holdings |
| `market_data` | Macro & economics | FRED, treasury yields |
| `research_agent` | Full equity analysis | Cited insights from SEC filings |
| `credit_agent` | Debt & risk analysis | Covenants, maturities, risk |

---

## 💡 Why Eugene?

| Problem | Eugene Solution |
|---------|-----------------|
| AI hallucinates financial data | Every number traced to SEC XBRL |
| Bloomberg costs $24K/year | Free + affordable tiers |
| Data scattered across APIs | One MCP server |
| Agents can't cite sources | Full source traceability |

---

## 📊 Data Sources

| Source | Data | Cost |
|--------|------|------|
| **SEC EDGAR** | XBRL financials, Form 4, 13F | Free |
| **FRED** | Treasury yields, economics | Free |
| **FMP** | Stock prices, profiles | Free tier |

---

## 🔧 Setup
```bash
git clone https://github.com/Matthew-Anyiam/eugene-data-labs.git
cd eugene-data-labs
pip install -r requirements.txt
cp .env.example .env
# Add: FMP_API_KEY, FRED_API_KEY
```

---

## 📄 License

MIT © [Matthew Anyiam](https://github.com/Matthew-Anyiam)

<p align="center">
  <strong>Built for agents that need to get finance right.</strong>
</p>
