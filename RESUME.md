# Eugene Intelligence - Resume Context

**Use this file to resume after Claude crashes or conversation resets.**

Copy everything below and paste it to Claude to restore context:

---

## Quick Context

I'm Rex, building **Eugene Intelligence** - a real-time financial data platform for AI agents.

The codebase is in `eugene/` directory (or `eugene-intelligence.tar.gz`).

## What's Built

| Component | Status | File |
|-----------|--------|------|
| Debt/covenant extraction | ✅ Done | `extraction/parsers/debt.py` |
| Earnings call extraction | ✅ Done | `extraction/parsers/earnings.py` |
| SEC EDGAR client | ✅ Done | `extraction/edgar.py` |
| Quality scoring | ✅ Done | `extraction/validation.py` |
| Fiscal normalization | ✅ Done | `extraction/fiscal.py` |
| Resilient job runner | ✅ Done | `jobs/resilient_runner.py` |
| Health monitoring | ✅ Done | `monitoring/health.py` |
| REST API | ✅ Done | `api/main.py` |
| MCP Server | ✅ Done | `mcp/server.py` |
| CLI | ✅ Done | `eugene_cli.py` |

## Current State

- **Phase**: Building / Testing
- **Last completed**: Resilience layer (checkpointing, retries, circuit breaker)
- **Next step**: Test extraction on real SEC filing

## Key Commands

```bash
# Test extraction
export ANTHROPIC_API_KEY=your-key
python eugene_cli.py extract --ticker TSLA

# Batch with resume
python eugene_cli.py batch --tickers TSLA AAPL MSFT

# Health check
python eugene_cli.py health --metrics
```

## Architecture

```
SEC EDGAR → Download → Parse → Claude Extract → Validate (85%+ quality) → Store → API/MCP
```

## Key Design Decisions

1. **Quality gate**: Extractions below 85% confidence are rejected
2. **Checkpointing**: Jobs resume after crash
3. **Circuit breaker**: Stop after 5 consecutive API failures
4. **Markdown output**: Optimized for LLM consumption
5. **Fiscal calendar**: Normalizes Q1 2024 to actual dates per company

## To Continue Building

Tell Claude:
- "Look at `eugene/PROJECT_STATE.json` for full context"
- "Run `python eugene_cli.py health` to check system status"
- "The next step is testing extraction on real TSLA 10-K"

---

## If Starting Fresh

```bash
# Extract tarball
tar -xzf eugene-intelligence.tar.gz
cd eugene

# Setup
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Set API key
export ANTHROPIC_API_KEY=your-key

# Test
python eugene_cli.py extract --ticker TSLA
```
