"""
Eugene Intelligence - SQLite persistence layer.

Replaces ephemeral /tmp JSONL files with a durable SQLite database.
Database lives at /tmp/eugene.db (writable by non-root Docker user).
"""

import sqlite3
import logging
from contextlib import contextmanager
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

DB_PATH = "/tmp/eugene.db"


# ---------------------------------------------------------------------------
# Connection helper
# ---------------------------------------------------------------------------
@contextmanager
def _get_conn():
    """Yield a SQLite connection with WAL mode and auto-commit on success."""
    conn = sqlite3.connect(DB_PATH, timeout=5)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Schema initialisation
# ---------------------------------------------------------------------------
def init_db():
    """Create tables if they don't exist."""
    with _get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS feedback (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                type        TEXT NOT NULL,
                message     TEXT NOT NULL,
                email       TEXT,
                page        TEXT,
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS waitlist (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                email       TEXT NOT NULL,
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS usage (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                client_ip   TEXT NOT NULL,
                endpoint    TEXT NOT NULL,
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS rate_limits (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                client_ip   TEXT NOT NULL,
                action      TEXT NOT NULL,
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_action
                ON rate_limits (client_ip, action, created_at);

            CREATE INDEX IF NOT EXISTS idx_usage_ip
                ON usage (client_ip, created_at);
        """)
    logger.info("SQLite database initialised at %s", DB_PATH)


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------
def save_feedback(type: str, message: str, email: str | None, page: str | None):
    """Persist a feedback entry."""
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO feedback (type, message, email, page) VALUES (?, ?, ?, ?)",
            (type, message[:2000], email, page),
        )


def get_feedback_entries(limit: int = 50) -> list[dict]:
    """Return recent feedback entries."""
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT id, type, message, email, page, created_at FROM feedback ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Waitlist
# ---------------------------------------------------------------------------
def save_waitlist(email: str):
    """Add an email to the waitlist."""
    with _get_conn() as conn:
        conn.execute("INSERT INTO waitlist (email) VALUES (?)", (email,))


# ---------------------------------------------------------------------------
# API usage tracking
# ---------------------------------------------------------------------------
def record_api_usage(client_ip: str, endpoint: str):
    """Record an API call for analytics."""
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO usage (client_ip, endpoint) VALUES (?, ?)",
            (client_ip, endpoint),
        )


def get_usage_stats() -> dict:
    """Return aggregate usage statistics."""
    with _get_conn() as conn:
        total = conn.execute("SELECT COUNT(*) FROM usage").fetchone()[0]
        today = conn.execute(
            "SELECT COUNT(*) FROM usage WHERE created_at >= datetime('now', '-1 day')"
        ).fetchone()[0]
        top_endpoints = conn.execute(
            "SELECT endpoint, COUNT(*) as cnt FROM usage GROUP BY endpoint ORDER BY cnt DESC LIMIT 10"
        ).fetchall()
        return {
            "total_requests": total,
            "last_24h": today,
            "top_endpoints": [{"endpoint": r["endpoint"], "count": r["cnt"]} for r in top_endpoints],
        }


# ---------------------------------------------------------------------------
# Research rate limiting
# ---------------------------------------------------------------------------
def check_research_rate_limit(client_ip: str, daily_limit: int = 3) -> dict | None:
    """Check if *client_ip* has exceeded the daily research limit.

    Returns an error dict when the limit is reached, or ``None`` if OK.
    """
    with _get_conn() as conn:
        cutoff = (datetime.utcnow() - timedelta(days=1)).isoformat()
        row = conn.execute(
            "SELECT COUNT(*) FROM rate_limits WHERE client_ip = ? AND action = 'research' AND created_at >= ?",
            (client_ip, cutoff),
        ).fetchone()
        used = row[0]

    if used >= daily_limit:
        return {
            "ticker": "",
            "research": None,
            "rate_limited": True,
            "error": f"Free tier limit: {daily_limit} research briefs per day. Upgrade to Pro for unlimited access.",
            "remaining": 0,
            "source": "eugene-research-agent",
        }
    return None


def _record_research_usage(client_ip: str):
    """Record a research generation for rate-limiting purposes."""
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO rate_limits (client_ip, action) VALUES (?, 'research')",
            (client_ip,),
        )


def get_research_remaining(client_ip: str, daily_limit: int = 3) -> int:
    """Return how many research briefs are left for *client_ip* today."""
    with _get_conn() as conn:
        cutoff = (datetime.utcnow() - timedelta(days=1)).isoformat()
        row = conn.execute(
            "SELECT COUNT(*) FROM rate_limits WHERE client_ip = ? AND action = 'research' AND created_at >= ?",
            (client_ip, cutoff),
        ).fetchone()
        used = row[0]
    return max(0, daily_limit - used)


# ---------------------------------------------------------------------------
# Auto-initialise on import
# ---------------------------------------------------------------------------
init_db()
