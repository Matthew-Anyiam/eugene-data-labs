# Eugene Intelligence v0.8

**Financial data infrastructure for AI agents. Every number traced to source.**

The first MCP-native financial data platform. One tool call gets you normalized SEC financials, 50+ computed ratios, live prices, technicals, crypto, and macro data — all with full provenance tracking. Built with async HTTP, persistent disk caching, and comprehensive error handling.

## Quick Start

```bash
pip install -e .

# Three ways to run
eugene caps                        # CLI — list all capabilities
python eugene_server.py            # REST API + MCP on port 8000
python eugene_server.py --mode mcp # MCP stdio server (for Claude Desktop)
```

## What You Can Do

```bash
# SEC fundamentals with clean IS/BS/CF grouping
eugene sec AAPL -e financials -l 5

# 50+ financial ratios (PE, ROE, margins, leverage, growth)
eugene sec AAPL -e metrics

# Technical indicators (SMA, EMA, RSI, MACD, Bollinger, ATR, VWAP)
eugene sec AAPL -e technicals

# Daily price bars
eugene ohlcv AAPL -i daily --from 2026-01-01 --to 2026-03-14

# Live crypto quotes
eugene crypto BTCUSD

# Corporate actions (dividends + splits + 8-K events merged)
eugene sec AAPL -e corporate_actions

# Download as CSV
eugene export AAPL -f csv

# Stock screening
eugene screener --sector Technology --market-cap-min 1000000000
```

## 17 Extract Types

| Extract | Description | Source |
|---------|-------------|--------|
| `profile` | Company name, CIK, SIC, address | SEC Submissions |
| `filings` | Filing list with accession + URL | SEC Submissions |
| `financials` | Normalized IS/BS/CF with provenance | SEC XBRL CompanyFacts |
| `concepts` | Raw XBRL concept time series | SEC CompanyFacts |
| `insiders` | Form 4 insider trade filings | SEC EDGAR |
| `ownership` | 13F institutional holdings | SEC EDGAR |
| `events` | 8-K material events | SEC EDGAR |
| `sections` | MD&A, risk factors, business text | Filing HTML |
| `exhibits` | Exhibit list with URLs | Filing Index |
| `metrics` | 50+ financial ratios (7 categories) | XBRL + FMP Market Data |
| `ohlcv` | Daily OHLCV price bars | FMP Historical Charts |
| `technicals` | SMA/EMA/RSI/MACD/Bollinger/ATR/VWAP | Computed from OHLCV |
| `segments` | Business + geographic revenue segments | SEC XBRL Dimensions |
| `float` | Float shares, outstanding, free float | FMP Shares Float |
| `corporate_actions` | Dividends, splits, 8-K events merged | FMP + SEC EDGAR |
| `transcripts` | Earnings call transcripts with Q&A | SEC EDGAR 8-K |
| `peers` | Relative valuation vs sector peers | SEC XBRL + FMP |

## 28 Canonical Concepts

Financials are normalized into clean IS/BS/CF groupings:

**Income Statement:** revenue, net_income, operating_income, gross_profit, eps_basic, eps_diluted, cost_of_revenue, ebitda (derived)

**Balance Sheet:** total_assets, total_liabilities, stockholders_equity, cash, total_debt, current_assets, current_liabilities, inventory, accounts_receivable, accounts_payable, short_term_debt, long_term_debt

**Cash Flow:** operating_cf, capex, free_cf (derived), depreciation_amortization, dividends_paid

**Other:** shares_outstanding, interest_expense

## REST API

```
GET  /                              API discovery
GET  /health                        Health check
GET  /v1/capabilities               All 19 extracts listed
GET  /v1/sec/{identifier}           SEC data (any extract)
GET  /v1/sec/{ticker}/ohlcv         OHLCV price bars
GET  /v1/sec/{id}/export            CSV flat file download
GET  /v1/screener                   Stock screener
GET  /v1/crypto/{symbol}            Crypto quotes
GET  /v1/stream/filings             SSE real-time SEC filing alerts
GET  /v1/economics/{category}       FRED macro data
```

### Examples

```bash
# Fundamentals (FY, 5 years)
curl "localhost:8000/v1/sec/AAPL?extract=financials&period=FY&limit=5"

# Financial ratios
curl "localhost:8000/v1/sec/AAPL?extract=metrics&limit=1"

# OHLCV bars
curl "localhost:8000/v1/sec/AAPL/ohlcv?from=2026-01-01&to=2026-03-14"

# Crypto
curl "localhost:8000/v1/crypto/BTCUSD"

# CSV export
curl "localhost:8000/v1/sec/AAPL/export?format=csv&limit=3"

# Real-time filing stream (SSE)
curl "localhost:8000/v1/stream/filings"

# Economics
curl "localhost:8000/v1/economics/inflation"
```

### Response Shape

Every response includes full provenance:

```json
{
  "status": "success",
  "identifier": "AAPL",
  "resolved": {"ticker": "AAPL", "cik": "0000320193", "company": "Apple Inc."},
  "data": {
    "periods": [{
      "period_end": "2025-09-27",
      "metrics": { ... },
      "income_statement": { ... },
      "balance_sheet": { ... },
      "cash_flow_statement": { ... }
    }]
  },
  "provenance": [{"source": "SEC CompanyFacts (XBRL)", "url": "..."}],
  "metadata": {"service": "eugene-intelligence", "version": "0.8.0"}
}
```

Every financial metric traces back to its XBRL source:

```json
{
  "revenue": {
    "value": 416161000000,
    "unit": "USD",
    "source_tag": "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax"
  }
}
```

## MCP (Model Context Protocol)

### Claude Desktop

```json
{
  "mcpServers": {
    "eugene": {
      "command": "python3",
      "args": ["eugene_server.py", "--mode", "mcp"]
    }
  }
}
```

### 5 MCP Tools

| Tool | Description |
|------|-------------|
| `sec` | All SEC EDGAR data — 19 extract types via one tool |
| `economics` | FRED macro data (inflation, employment, GDP, housing, rates) |
| `screener` | Stock screening by sector, market cap, price, volume, beta |
| `crypto` | Live crypto quotes (BTC, ETH, SOL, etc.) |
| `caps` | Lists all capabilities and parameters |

### Streamable HTTP

The server also exposes MCP via streamable HTTP at `/mcp` and SSE at `/sse`, so any MCP client can connect over the network.

## Architecture

```
eugene_server.py                  FastAPI + MCP entry point (REST + stdio + SSE + streamable HTTP)
eugene/
  router.py                      Request parsing, routing, envelope (19 handlers)
  resolver.py                    ticker/CIK/accession -> identity
  concepts.py                    28 canonical concept mappings (XBRL -> stable keys)
  cache.py                       L1 in-memory + L2 persistent disk cache
  rate_limit.py                  Sync + async rate limiters
  errors.py                      Error taxonomy (NotFound, Source, Validation, RateLimit)
  auth.py                        API key authentication
  cli.py                         Click CLI (eugene command)
  handlers/
    financials.py                Normalized IS/BS/CF with derived metrics
    metrics.py                   50+ financial ratios (7 categories)
    technicals.py                SMA/EMA/RSI/MACD/Bollinger/ATR/VWAP
    ohlcv.py                     OHLCV daily price bars
    segments.py                  XBRL dimension parsing (business/geographic)
    float_data.py                Share float data
    corporate_actions.py         Dividends + splits + 8-K events merged
    export.py                    CSV flat file generation
    filings.py, profile.py       Filing list, company profile
    concepts_raw.py              Raw XBRL concept series
    sections.py                  MD&A, risk factors text extraction
    insiders.py, ownership.py    Form 4, 13F filings
    events.py, exhibits.py       8-K events, exhibit list
    options.py, orderbook.py     Coming soon stubs
  sources/
    sec_api.py                   All SEC HTTP calls (one place)
    fmp.py                       Market data (prices, OHLCV, screener, crypto, float)
    fred.py                      Economic data (FRED)
```

## Environment Variables

```
SEC_USER_AGENT=Eugene Intelligence (you@email.com)
SEC_CONTACT_NAME=Eugene Intelligence
SEC_CONTACT_EMAIL=your@email.com
FMP_API_KEY=your_fmp_key
FRED_API_KEY=your_fred_key
PORT=8000
```

---

*Built for agents that need to get finance right.*
