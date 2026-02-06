# Changelog

All notable changes to Eugene Data Labs will be documented in this file.

## [0.1.0] - 2025-01-31

### Added

**Core Extraction**
- Debt/covenant extraction from 10-K/10-Q filings (`extraction/parsers/debt.py`)
- Earnings call extraction with guidance, tone analysis (`extraction/parsers/earnings.py`)
- SEC EDGAR client for fetching filings (`extraction/edgar.py`)

**Quality & Validation**
- Quality scoring with 85% threshold for serving (`extraction/validation.py`)
- Fiscal period normalization for company-specific calendars (`extraction/fiscal.py`)
- Markdown formatter optimized for LLM consumption (`extraction/formatter.py`)

**Resilience**
- Checkpointing for job resumption after crash (`jobs/resilient_runner.py`)
- Retry with exponential backoff
- Circuit breaker for repeated failures
- Rate limiting for API calls
- Safe extraction wrapper with error categorization (`extraction/safe_extract.py`)

**Delivery**
- FastAPI REST endpoints (`api/main.py`)
- MCP server for Claude Desktop integration (`mcp/server.py`)
- Simple web UI for testing (`web/index.html`)

**Infrastructure**
- Real-time SEC filing monitor (`realtime/sec_monitor.py`)
- Health checks and metrics (`monitoring/health.py`)
- Local/S3 data store (`storage/data_store.py`)
- Database models for PostgreSQL (`db/models.py`)

**Developer Experience**
- Unified CLI (`eugene_cli.py`)
- Shell runner script (`run.sh`)
- Session state for conversation continuity (`session_state.py`)
- Offline test suite (`test_offline.py`)
- Mock API test (`test_mock_api.py`)
- HuggingFace dataset builder (`build_hf_dataset.py`)

**Skills**
- Credit analysis skill (`skills/credit/SKILL.md`)
- Covenant monitoring skill (`skills/credit/COVENANT_MONITORING.md`)

**Evaluation**
- Domain-specific eval framework (`evaluation/evals.py`)
- Test cases for numeric precision, date accuracy, covenant extraction

### Technical Decisions

1. **Quality gate at 85%** - Based on Fintool's approach; credit data is high-stakes
2. **Markdown output** - LLMs reason better over markdown tables than HTML/CSV
3. **Fiscal normalization** - Critical for comparing companies with different FYEs
4. **Checkpointing** - Jobs can take hours; must survive interruption
5. **Skills system** - Domain expertise in markdown files, not code

### Known Limitations

- No network access in Claude.ai sandbox (tested with mocks)
- Real extraction requires ANTHROPIC_API_KEY
- S3 backend not tested (local file backend used)
- PostgreSQL integration not complete

## [Unreleased]

### Planned
- Full S&P 500 coverage
- WebSocket streaming delivery
- HuggingFace dataset publication
- Open source "Covenant" agent
- Production PostgreSQL persistence
