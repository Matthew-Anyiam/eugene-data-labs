# Eugene Intelligence

Financial data infrastructure for AI agents.

## What it does

Eugene gives AI agents instant access to structured financial data from SEC filings. No scraping, no hallucination — every number traced to its source.
```
> Compare the financial health of JPM, BAC, and GS

JPM: ROE 12.9%, $362B cash, Net Margin 29.3%
BAC: ROE 10.2%, $177B cash, Net Margin 29.0%  
GS:  ROE 9.6%,  $242B cash
```

## Quick Start

**CLI:**
```bash
python cli.py health AAPL
python cli.py compare JPM BAC GS
python cli.py financials MSFT
python cli.py history AAPL revenue 5
```

**Claude Desktop:**

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "eugene": {
      "command": "python3",
      "args": ["/path/to/eugene/mcp/mcp_server.py"],
      "env": {
        "PYTHONPATH": "/path/to/eugene",
        "DOTENV_PATH": "/path/to/eugene/.env"
      }
    }
  }
}
```

## MCP Tools

| Tool | Description | Speed |
|------|-------------|-------|
| `company_health` | 12 financial ratios + 5-year trends | ~3s |
| `compare_companies` | Side-by-side metrics for multiple tickers | ~5s |
| `get_financials` | Raw XBRL data (balance sheet, income, cash flow) | ~2s |
| `get_financial_history` | Time series for any metric | ~2s |
| `credit_monitor` | Debt analysis with LLM insights | ~15s |
| `equity_research` | Revenue breakdown, guidance, risks | ~15s |
| `get_company_filings` | List SEC filings | ~1s |

## How it works

1. **XBRL** — SEC's machine-readable financial data. Deterministic, no parsing errors.
2. **LLM** — Qualitative analysis of 10-K text (credit, equity research).
3. **Python** — Ratio computation, trend analysis, no hallucination on math.

Every claim cites its source. Every number comes from SEC filings.

## Setup
```bash
pip install python-dotenv anthropic requests
cp .env.example .env  # Add your Anthropic API key
python cli.py health AAPL
```

## License

MIT
