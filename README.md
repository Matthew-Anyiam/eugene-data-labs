# Eugene Intelligence v0.4

**Financial context for AI. Every number traced to source.**

One endpoint. All SEC EDGAR data. Clean, normalized, source-traceable.

## Quick Start

```bash
pip install -r requirements.txt
python eugene_server.py           # API on port 8000
python eugene_server.py --mode mcp  # MCP server
```

## API

### One Endpoint

```
GET /v1/sec/{identifier}?extract=financials&period=FY&limit=5
```

Identifier: ticker (`AAPL`), CIK (`320193`), or accession number.

### Extracts

| Extract | Description | Source |
|---------|-------------|--------|
| `financials` | Normalized fundamentals with provenance | SEC XBRL CompanyFacts |
| `profile` | Company name, CIK, SIC, address | SEC Submissions |
| `filings` | Filing list with accession + URL | SEC Submissions |
| `concepts` | Raw XBRL concept time series | SEC CompanyFacts |
| `insiders` | Form 4 insider trade filings | SEC EDGAR |
| `ownership` | 13F institutional holdings | SEC EDGAR |
| `events` | 8-K material events | SEC EDGAR |
| `sections` | MD&A, risk factors, business text | Filing HTML |
| `exhibits` | Exhibit list with URLs | Filing Index |

### Canonical Concepts (financials)

revenue, net_income, operating_income, gross_profit, eps_basic, eps_diluted,
operating_cf, capex, free_cf (derived), total_assets, total_liabilities,
stockholders_equity, cash, total_debt, shares_outstanding

### Examples

```bash
# Company fundamentals (FY, 5 years)
curl "localhost:8000/v1/sec/AAPL?extract=financials&period=FY&limit=5"

# Quarterly data
curl "localhost:8000/v1/sec/MSFT?extract=financials&period=Q&limit=8"

# Just revenue
curl "localhost:8000/v1/sec/NVDA?extract=financials&concept=revenue&limit=10"

# Company profile
curl "localhost:8000/v1/sec/TSLA?extract=profile"

# Filing list (10-Ks only)
curl "localhost:8000/v1/sec/JPM?extract=filings&form=10-K"

# MD&A + risk factors
curl "localhost:8000/v1/sec/BA?extract=sections&section=mdna,risk_factors"

# Multiple extracts at once
curl "localhost:8000/v1/sec/AAPL?extract=profile,financials,filings"

# Economics
curl "localhost:8000/v1/economics/treasury"
curl "localhost:8000/v1/economics/all"
```

### Response Shape

Every response:

```json
{
  "status": "success",
  "identifier": "AAPL",
  "resolved": {"ticker": "AAPL", "cik": "0000320193", "company": "Apple Inc."},
  "data": { ... },
  "provenance": [{"source": "SEC CompanyFacts (XBRL)", "url": "..."}],
  "metadata": {"service": "eugene-intelligence", "version": "0.4.0"}
}
```

Every financial metric:

```json
{
  "revenue": {
    "value": 391035000000,
    "unit": "USD",
    "source_tag": "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax"
  }
}
```

### MCP (Claude Desktop)

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

Tools: `sec`, `economics`, `caps`

## Architecture

```
eugene_server.py              → FastAPI + MCP entry point
eugene/
  router.py                   → Request parsing, routing, envelope
  resolver.py                 → ticker/CIK/accession → identity
  concepts.py                 → Canonical concept mapping (XBRL → stable keys)
  cache.py                    → In-memory TTL cache
  handlers/
    financials.py             → Normalized fundamentals (THE core normalizer)
    filings.py                → Filing list
    profile.py                → Company profile
    concepts_raw.py           → Raw XBRL concept series
    sections.py               → MD&A, risk factors text extraction
    insiders.py               → Form 4 filings
    ownership.py              → 13F filings
    events.py                 → 8-K events
    exhibits.py               → Exhibit list
  sources/
    sec_api.py                → All SEC HTTP calls (one place)
    fmp.py                    → Market data (prices, earnings)
    fred.py                   → Economic data (FRED)
```

## Environment Variables

```
SEC_USER_AGENT=Eugene Intelligence (you@email.com)
SEC_CONTACT_NAME=Eugene Intelligence
SEC_CONTACT_EMAIL=matthew@eugeneintelligence.com
FMP_API_KEY=your_fmp_key
FRED_API_KEY=your_fred_key
PORT=8000
```

---

*Built for agents that need to get finance right.*
