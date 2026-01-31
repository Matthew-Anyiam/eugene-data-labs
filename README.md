# Eugene Data Labs

> The most accurate market and financial data for agents — to reason, extract, and act

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)

Eugene extracts structured credit and debt data from SEC filings that nobody else has — covenant details, maturity schedules, credit facility terms — and delivers it in formats optimized for AI agents.

## Why Eugene?

| Provider | Has | Doesn't Have |
|----------|-----|--------------|
| Bloomberg | Everything | Accessible pricing, agent-native delivery |
| FinancialDatasets.ai | Prices, statements | Covenant details, debt terms |
| Polygon | Real-time prices | Filing intelligence |
| **Eugene** | Extracted credit intelligence | — |

**Eugene's edge:**
- 🎯 **Extraction layer** — Covenants, debt terms, guidance from unstructured filings
- 🤖 **Agent-native** — MCP server, markdown output optimized for LLMs
- ✅ **Quality-gated** — Only serves extractions above 85% confidence
- ⚡ **Real-time** — SEC filing monitor with push notifications

## Quick Start

```bash
# Clone
git clone https://github.com/rexyang624/eugene-data-labs.git
cd eugene-data-labs

# Setup
./run.sh setup

# Set API key
export ANTHROPIC_API_KEY=your-key

# Extract Tesla's credit data
./run.sh extract TSLA
```

## What We Extract

| Data | Source | Example |
|------|--------|---------|
| **Debt Instruments** | 10-K/10-Q | Term Loan B, $2B, SOFR+275bps, due 2028 |
| **Covenants** | 10-K/10-Q | Max Leverage 4.5x, Current 3.2x, 29% cushion |
| **Maturity Schedule** | 10-K/10-Q | 2024: $500M, 2025: $750M, 2026: $1.2B |
| **Earnings Guidance** | Transcripts | Revenue $90-94B, raised from $88-92B |
| **Management Tone** | Transcripts | Confident, low hedging language |

## Sample Output

```markdown
# Credit Summary: Tesla, Inc. (TSLA)

### Key Credit Metrics
| Metric | Value |
|--------|-------|
| Total Debt | $4.0B |
| Net Debt | $(25.1B) |
| Leverage | 0.32x |
| Interest Coverage | 48.2x |

### Financial Covenants
| Covenant | Threshold | Current | Cushion | Status |
|----------|-----------|---------|---------|--------|
| Max Leverage | 3.50x | 0.08x | 97.7% | ✓ Compliant |
| Min Coverage | 3.00x | 48.20x | 1507% | ✓ Compliant |
```

## Architecture

```
SEC EDGAR ──→ Download ──→ Parse ──→ Claude Extract ──→ Validate ──→ Store
                                          │                           │
                                          │                           ▼
                                          │                    ┌─────────────┐
                                          │                    │   Delivery  │
                                          │                    ├─────────────┤
                                          │                    │ • REST API  │
                                          │                    │ • MCP Server│
                                          │                    │ • WebSocket │
                                          │                    └─────────────┘
                                          │
                                    Quality Gate
                                    (≥85% confidence)
```

## Project Structure

```
eugene/
├── api/                    # FastAPI REST endpoints
├── db/                     # Database models
├── evaluation/             # Domain-specific eval framework
├── extraction/
│   ├── parsers/           # Claude-powered extractors
│   │   ├── debt.py        # Debt/covenant extraction
│   │   └── earnings.py    # Earnings call extraction
│   ├── validation.py      # Quality scoring
│   ├── fiscal.py          # Fiscal period normalization
│   └── formatter.py       # Markdown output
├── jobs/
│   └── resilient_runner.py # Checkpoints, retries, circuit breaker
├── mcp/                    # MCP server for Claude Desktop
├── monitoring/             # Health checks, metrics
├── realtime/               # SEC filing monitor
├── skills/                 # Agent skills (markdown)
├── storage/                # S3/local data store
├── web/                    # Simple web UI
├── eugene_cli.py           # Unified CLI
└── run.sh                  # Local runner script
```

## Usage

### CLI Commands

```bash
# Single extraction
./run.sh extract TSLA

# Batch extraction (with auto-resume)
./run.sh batch TSLA AAPL MSFT GOOGL AMZN

# Start API server
./run.sh api

# Start web UI
./run.sh web

# Health check
./run.sh health

# Run tests
./run.sh test
```

### Python API

```python
from extraction.safe_extract import run_safe_extraction

result = run_safe_extraction("TSLA", "10-K")

if result.success:
    print(f"Total debt: ${result.data['aggregate_metrics']['total_debt']}M")
else:
    print(f"Failed: {result.error.message}")
```

### REST API

```bash
# Start server
python eugene_cli.py api --port 8000

# Get credit summary
curl http://localhost:8000/v1/credit/TSLA

# Get debt instruments
curl http://localhost:8000/v1/credit/TSLA/debt

# Get covenants
curl http://localhost:8000/v1/credit/TSLA/covenants
```

### MCP Server (Claude Desktop)

Add to Claude Desktop config:
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

## Key Features

### Quality Scoring

Every extraction gets a confidence score. Only high-quality data is served:

- **≥85%**: Served to users
- **70-85%**: Flagged for review
- **<70%**: Rejected

### Fiscal Period Normalization

"Q1 2024" means different dates for different companies:

| Company | Q1 2024 |
|---------|---------|
| Apple | Oct 1, 2023 - Dec 31, 2023 |
| Microsoft | Jul 1, 2023 - Sep 30, 2023 |
| Tesla | Jan 1, 2024 - Mar 31, 2024 |

Eugene normalizes all periods to absolute dates.

### Resilient Processing

- **Checkpointing**: Resume after crash
- **Retries**: Exponential backoff
- **Circuit breaker**: Stop after repeated failures
- **Rate limiting**: Respect SEC and API limits

### Session State

Save and resume work across conversations:

```bash
# Save state
python session_state.py save --note "Working on batch extraction"

# Get resume prompt for new Claude session
python session_state.py resume
```

## Development

### Run Tests

```bash
# Offline tests (no API needed)
python test_offline.py

# Mock API test
python test_mock_api.py

# Full test (needs API key)
python test_extraction.py --ticker TSLA
```

### Build HuggingFace Dataset

```bash
# After running extractions
python build_hf_dataset.py --source data/extractions --output data/hf_dataset

# Push to Hub
python build_hf_dataset.py --push --repo your-username/credit-data
```

## Roadmap

- [x] Debt/covenant extraction
- [x] Earnings call extraction
- [x] Quality scoring & validation
- [x] Fiscal period normalization
- [x] Resilient job runner
- [x] REST API
- [x] MCP server
- [x] Web UI
- [ ] PostgreSQL persistence
- [ ] S&P 500 full coverage
- [ ] WebSocket streaming
- [ ] HuggingFace dataset publication
- [ ] Open source "Covenant" agent

## Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=your-claude-api-key

# Optional
DATABASE_URL=postgresql://user:pass@localhost:5432/eugene
EUGENE_S3_BUCKET=your-bucket-name
HF_TOKEN=your-huggingface-token
```

## Contributing

Contributions welcome! Please:

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Run tests: `python test_offline.py`
5. Submit a PR

## License

MIT

## Acknowledgments

Architecture informed by lessons from [Fintool](https://fintool.com) and the broader financial AI community.

---

Built by [Rex Yang](https://github.com/rexyang624) | [Eugene Data Labs](https://eugenedatalabs.com)
