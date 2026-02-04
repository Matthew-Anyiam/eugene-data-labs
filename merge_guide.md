# Eugene Intelligence — Merge Guide

## Your Current Code: `~/Desktop/eugene/`

```
OLD FILE                              → ACTION         → NEW FILE (from rebuild)
─────────────────────────────────────────────────────────────────────────────────

CORE INFRASTRUCTURE (REPLACE — old versions are mock/scaffolding)
─────────────────────────────────────────────────────────────────
extraction/edgar.py                   → REPLACE        → eugene/sources/edgar.py
extraction/validation.py              → REPLACE        → eugene/validation/engine.py
api/main.py                           → REPLACE        → api/main.py
mcp/server.py                         → REPLACE        → mcp/server.py

NEW FILES (ADD — these don't exist in your old code)
─────────────────────────────────────────────────────
(nothing)                             → ADD            → eugene/config.py
(nothing)                             → ADD            → eugene/extraction/llm.py
(nothing)                             → ADD            → eugene/models/base.py
(nothing)                             → ADD            → eugene/extraction/parsers/employees.py

KEEP AS-IS (old parsers — they're scaffolding but don't conflict)
─────────────────────────────────────────────────────────────────
extraction/parsers/debt.py            → KEEP           (will upgrade later)
extraction/parsers/earnings.py        → KEEP           (will upgrade later)
extraction/parsers/capex.py           → KEEP           (will upgrade later)
extraction/parsers/form4.py           → KEEP           (will upgrade later)
extraction/parsers/form8k.py          → KEEP           (will upgrade later)
extraction/parsers/form3.py           → KEEP           (will upgrade later)
extraction/parsers/form5.py           → KEEP           (will upgrade later)
extraction/parsers/form13d.py         → KEEP           (will upgrade later)
extraction/parsers/form13f.py         → KEEP           (will upgrade later)
extraction/parsers/form13g.py         → KEEP           (will upgrade later)
extraction/fiscal.py                  → KEEP
extraction/formatter.py               → KEEP
extraction/safe_extract.py            → KEEP

KEEP AS-IS (agents, jobs, other modules)
────────────────────────────────────────
agents/credit_monitor.py              → KEEP           (will upgrade later)
agents/equity_research.py             → KEEP           (will upgrade later)
db/models.py                          → KEEP
evaluation/evals.py                   → KEEP
jobs/extract_batch.py                 → KEEP
jobs/resilient_runner.py              → KEEP
monitoring/health.py                  → KEEP
realtime/sec_monitor.py               → KEEP
storage/data_store.py                 → KEEP
scripts/generate_samples.py           → KEEP
eugene_cli.py                         → KEEP
session_state.py                      → KEEP
setup.py                              → KEEP
build_hf_dataset.py                   → KEEP

TEST FILES (KEEP old, ADD new)
──────────────────────────────
test_extraction.py                    → KEEP
test_mock_api.py                      → KEEP
test_offline.py                       → KEEP
run_all_mocks.py                      → KEEP
(nothing)                             → ADD            → test_architecture.py
```

---

## Step-by-Step Commands

Run these in your terminal, one at a time:

```bash
# 1. BACKUP your current code first
cd ~/Desktop
cp -r eugene eugene_backup_$(date +%Y%m%d)

# 2. Go into your project
cd ~/Desktop/eugene

# 3. Create new directories that don't exist yet
mkdir -p eugene/sources
mkdir -p eugene/models
mkdir -p eugene/validation
mkdir -p eugene/extraction/parsers
mkdir -p eugene/services
mkdir -p eugene/storage
mkdir -p eugene/utils

# 4. Extract the rebuild tar to a temp location
cd /tmp
tar -xzf ~/Downloads/eugene_rebuild.tar.gz

# 5. Copy NEW files (things that don't exist in your old code)
cp /tmp/eugene_rebuild/eugene/config.py ~/Desktop/eugene/eugene/config.py
cp /tmp/eugene_rebuild/eugene/extraction/llm.py ~/Desktop/eugene/eugene/extraction/llm.py
cp /tmp/eugene_rebuild/eugene/models/base.py ~/Desktop/eugene/eugene/models/base.py
cp /tmp/eugene_rebuild/eugene/extraction/parsers/employees.py ~/Desktop/eugene/eugene/extraction/parsers/employees.py
cp /tmp/eugene_rebuild/eugene/validation/engine.py ~/Desktop/eugene/eugene/validation/engine.py
cp /tmp/eugene_rebuild/eugene/sources/edgar.py ~/Desktop/eugene/eugene/sources/edgar.py
cp /tmp/eugene_rebuild/test_architecture.py ~/Desktop/eugene/test_architecture.py

# 6. REPLACE old files with new versions
cp /tmp/eugene_rebuild/api/main.py ~/Desktop/eugene/api/main.py
cp /tmp/eugene_rebuild/mcp/server.py ~/Desktop/eugene/mcp/server.py

# 7. Copy supporting files
cp /tmp/eugene_rebuild/requirements.txt ~/Desktop/eugene/requirements_rebuild.txt
cp /tmp/eugene_rebuild/README.md ~/Desktop/eugene/README_rebuild.md
cp -r /tmp/eugene_rebuild/docs ~/Desktop/eugene/docs_rebuild
cp -r /tmp/eugene_rebuild/data ~/Desktop/eugene/data

# 8. Create __init__.py files for new packages
touch ~/Desktop/eugene/eugene/__init__.py
touch ~/Desktop/eugene/eugene/sources/__init__.py
touch ~/Desktop/eugene/eugene/models/__init__.py
touch ~/Desktop/eugene/eugene/validation/__init__.py
touch ~/Desktop/eugene/eugene/services/__init__.py
touch ~/Desktop/eugene/eugene/storage/__init__.py
touch ~/Desktop/eugene/eugene/utils/__init__.py

# 9. Create .env.example
cat > ~/Desktop/eugene/.env.example << 'EOF'
# Required
ANTHROPIC_API_KEY=sk-ant-your-key-here

# SEC EDGAR (required)
SEC_USER_AGENT=Eugene Intelligence rex@example.com

# Optional
EUGENE_LOG_LEVEL=INFO
EUGENE_CACHE_DIR=./data/cache
EOF

# 10. Clean up
rm -rf /tmp/eugene_rebuild
```

---

## After Merge — Your Directory Will Look Like

```
~/Desktop/eugene/
├── agents/                    ← OLD (keep)
│   ├── credit_monitor.py
│   └── equity_research.py
├── api/
│   └── main.py                ← NEW (replaced)
├── db/
│   └── models.py              ← OLD (keep)
├── eugene/                    ← NEW package
│   ├── __init__.py
│   ├── config.py              ← NEW
│   ├── sources/
│   │   └── edgar.py           ← NEW (real EDGAR client)
│   ├── extraction/
│   │   ├── llm.py             ← NEW (LLM engine)
│   │   └── parsers/
│   │       └── employees.py   ← NEW (Michelle's use case)
│   ├── models/
│   │   └── base.py            ← NEW (data models)
│   ├── validation/
│   │   └── engine.py          ← NEW (trust layer)
│   ├── services/
│   ├── storage/
│   └── utils/
├── extraction/                ← OLD (keep — scaffolding parsers)
│   ├── edgar.py               ← OLD (superseded by eugene/sources/edgar.py)
│   ├── parsers/
│   │   ├── debt.py
│   │   ├── earnings.py
│   │   ├── form4.py
│   │   └── ...10 parsers
│   ├── validation.py          ← OLD (superseded by eugene/validation/engine.py)
│   └── ...
├── mcp/
│   └── server.py              ← NEW (replaced)
├── data/                      ← NEW
│   ├── cache/
│   ├── companies/
│   └── extractions/
├── .env.example               ← NEW
├── requirements_rebuild.txt   ← NEW (merge with existing)
└── test_architecture.py       ← NEW
```

---

## Key Points

1. **Two edgar.py files will coexist temporarily:**
   - `extraction/edgar.py` (old, mock/basic)
   - `eugene/sources/edgar.py` (new, real EDGAR client)
   - New code imports from `eugene.sources.edgar`

2. **Two validation files will coexist temporarily:**
   - `extraction/validation.py` (old)
   - `eugene/validation/engine.py` (new)
   - New code imports from `eugene.validation.engine`

3. **Nothing breaks:** Old parsers still work (they're independent). New code lives in the `eugene/` package.

4. **Next step after merge:** Add your Anthropic API key to `.env` and test with real Boeing 10-K.
