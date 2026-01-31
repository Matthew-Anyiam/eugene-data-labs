# Copilot instructions for Eugene Data Labs

Purpose: Help AI coding agents quickly become productive in this repository.

1. Big picture
- Eugene extracts credit/covenant data from SEC filings, validates quality, and exposes results via a REST API and an MCP server for agent use. See the architecture diagram in `README.md`.

2. Key components (what to edit)
- `api/main.py`: FastAPI mock API used for local development and tests — many endpoints return mock data. For production wiring, replace mocks with DB queries (see `db/models.py`).
- `extraction/`: core extractors, parsers, and formatters. `extraction/parsers/debt.py` and `extraction/formatter.py` are good examples of prompt-driven extraction → normalized output.
- `extraction/validation.py`: implements the confidence/quality gate (>=85% to serve). Preserve scoring behavior when changing extraction outputs.
- `mcp/server.py`: MCP server entrypoint for Claude integration. MCP-related changes should keep the simple CLI integration in `README.md` working.
- `storage/data_store.py` and `db/models.py`: where persisted data will live; changes here affect downstream API behavior.
- `jobs/resilient_runner.py`: batching, checkpointing, and retries. Follow its retry/backoff patterns when adding long-running jobs.

3. Local dev & workflows (concrete commands)
- Setup and run virtualenv: `./run.sh setup` (creates `venv` and installs `requirements.txt`).
- Run a single extraction: `./run.sh extract TSLA` or `python eugene_cli.py extract --ticker TSLA`.
- Start API server (local): `./run.sh api` or `python eugene_cli.py api --port 8000`. The API uses FastAPI; `api/main.py` runs with Uvicorn when executed directly.
- Run tests: `./run.sh test` runs `python test_offline.py`. There are also `test_mock_api.py` and `test_extraction.py` scripts referenced in `README.md`.

4. Environment & integrations
- Required env var: `ANTHROPIC_API_KEY` (Anthropic/Claude) — extraction/parsers call Claude via this key. Tests and `run.sh` check for it.
- Optional: `DATABASE_URL`, `EUGENE_S3_BUCKET`, `HF_TOKEN` for persistence, S3 store, and HuggingFace publishing.
- MCP integration: add `python mcp/server.py` as an MCP server in Claude Desktop config (see `README.md`).

5. Project conventions & patterns
- Confidence gating: do not serve extractions below 85% — `extraction/validation.py` enforces this. If you change extraction output shape, update validation and `extraction/formatter.py`.
- Minimal global state: prefer passing `session` or `context` objects (see `session_state.py`) rather than module-level globals.
- Mock-first API: `api/main.py` intentionally uses in-memory `MOCK_*` data for fast iteration. When migrating to DB, keep identical response models to avoid breaking clients.
- Tests are script-based (not full pytest suite). Use the existing test scripts to verify behavior quickly.

6. PR & change guidance for agents
- Keep changes small and focused. If modifying extraction prompts or parser outputs, run a sample extraction (`./run.sh extract TSLA`) and confirm confidence scores and `extraction/validation.py` behavior.
- When adding dependencies, update `requirements.txt` and prefer pinning to a minor version range.
- Avoid changing public REST contracts in `api/main.py` without a migration plan; many components assume those shapes.

7. Troubleshooting quick tips
- If API returns 401 locally, the local key check accepts keys starting with `eugene_` (see `api/main.py:verify_api_key`).
- If `./run.sh` fails, ensure `python3` on PATH is Python 3.10+ and `venv` activation succeeds (`source venv/bin/activate`).

8. Where to look first when asked to implement X
- New REST endpoint: mirror patterns in `api/main.py` and add Pydantic model in same file.
- New extractor or parser: add under `extraction/parsers/`, follow `debt.py` patterns for prompts and post-processing, and add a validation rule in `extraction/validation.py`.
- Persistent storage integration: update `storage/data_store.py` and migrate mock reads in `api/main.py` to `db/models.py` + data store calls.

If anything here is unclear or you want more detail (example prompts, validation thresholds, or a test run), tell me which section to expand.
