"""
Eugene Intelligence - Database persistence layer.

Supports both SQLite (default) and PostgreSQL (production).

Set DATABASE_URL to a PostgreSQL connection string to use PostgreSQL:
  DATABASE_URL=postgresql://user:pass@host:5432/eugene

Otherwise defaults to SQLite at /tmp/eugene.db.
"""

import logging
import os
import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL", "")
DB_PATH = "/tmp/eugene.db"

_pg_pool = None


def _is_postgres() -> bool:
    """Check if PostgreSQL is configured."""
    return DATABASE_URL.startswith("postgres")


# ---------------------------------------------------------------------------
# Connection helpers
# ---------------------------------------------------------------------------

def _get_pg_pool():
    """Get or create a PostgreSQL connection pool."""
    global _pg_pool
    if _pg_pool is not None:
        return _pg_pool

    try:
        from psycopg2 import pool

        _pg_pool = pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=10,
            dsn=DATABASE_URL,
        )
        logger.info("PostgreSQL connection pool created")
        return _pg_pool
    except ImportError:
        logger.error("psycopg2 not installed. Install with: pip install psycopg2-binary")
        raise
    except Exception as e:
        logger.error("PostgreSQL connection failed: %s", e)
        raise


@contextmanager
def _get_conn():
    """Yield a database connection with auto-commit on success.

    Transparently supports both SQLite and PostgreSQL.
    """
    if _is_postgres():
        pool = _get_pg_pool()
        conn = pool.getconn()
        try:
            yield _PgConnWrapper(conn)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            pool.putconn(conn)
    else:
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


class _PgConnWrapper:
    """Wraps a psycopg2 connection to provide dict-like row access
    consistent with sqlite3.Row behavior."""

    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql: str, params=None):
        """Execute SQL, translating SQLite syntax to PostgreSQL."""
        from psycopg2.extras import RealDictCursor
        sql = _translate_sql(sql)
        cur = self._conn.cursor(cursor_factory=RealDictCursor)
        if params:
            if isinstance(params, list):
                params = tuple(params)
            cur.execute(sql, params)
        else:
            cur.execute(sql)
        return _PgCursorWrapper(cur)

    def executescript(self, sql: str):
        """Execute a multi-statement SQL script."""
        sql = _translate_schema(sql)
        cur = self._conn.cursor()
        cur.execute(sql)
        return cur


class _PgCursorWrapper:
    """Wraps a psycopg2 cursor to provide sqlite3-compatible interface."""

    def __init__(self, cursor):
        self._cursor = cursor

    def fetchone(self):
        row = self._cursor.fetchone()
        if row is None:
            return None
        return _DictRow(row)

    def fetchall(self):
        rows = self._cursor.fetchall()
        return [_DictRow(r) for r in rows]

    @property
    def rowcount(self):
        return self._cursor.rowcount


class _DictRow:
    """Row that supports both dict-like and index access."""

    def __init__(self, data: dict):
        self._data = data

    def __getitem__(self, key):
        if isinstance(key, int):
            return list(self._data.values())[key]
        return self._data[key]

    def __contains__(self, key):
        return key in self._data

    def get(self, key, default=None):
        return self._data.get(key, default)

    def keys(self):
        return self._data.keys()

    def values(self):
        return self._data.values()

    def items(self):
        return self._data.items()


def _translate_sql(sql: str) -> str:
    """Translate SQLite SQL syntax to PostgreSQL equivalents."""
    sql = sql.replace("?", "%s")
    sql = sql.replace("datetime('now')", "NOW()")
    sql = sql.replace("datetime('now', '-1 day')", "NOW() - INTERVAL '1 day'")
    sql = re.sub(
        r"json_extract\((\w+),\s*'\$\.(\w+)'\)",
        r"\1::jsonb->>'\2'",
        sql,
    )
    sql = sql.replace("COLLATE NOCASE", "")
    sql = re.sub(
        r"GROUP_CONCAT\(DISTINCT\s+(\S+)\)",
        r"STRING_AGG(DISTINCT \1::text, ',')",
        sql,
    )
    sql = re.sub(
        r"GROUP_CONCAT\((\S+)\)",
        r"STRING_AGG(\1::text, ',')",
        sql,
    )
    sql = re.sub(
        r"strftime\('([^']+)',\s*(\w+)\)",
        r"to_char(\2, 'YYYY-MM-DD\"T\"HH24:MI:SS')",
        sql,
    )
    return sql


def _translate_schema(sql: str) -> str:
    """Translate SQLite DDL to PostgreSQL equivalents."""
    sql = sql.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
    sql = sql.replace(
        "TEXT NOT NULL DEFAULT (datetime('now'))",
        "TIMESTAMPTZ NOT NULL DEFAULT NOW()",
    )
    sql = sql.replace(
        "TEXT DEFAULT (datetime('now'))",
        "TIMESTAMPTZ DEFAULT NOW()",
    )
    sql = sql.replace(" REAL ", " DOUBLE PRECISION ")
    sql = sql.replace(" REAL,", " DOUBLE PRECISION,")
    sql = re.sub(r"PRAGMA\s+\w+\s*=\s*\w+\s*;?", "", sql)
    sql = sql.replace("?", "%s")
    return sql


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
                api_key     TEXT,
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS rate_limits (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                client_ip   TEXT NOT NULL,
                action      TEXT NOT NULL,
                api_key     TEXT,
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_action
                ON rate_limits (client_ip, action, created_at);

            CREATE INDEX IF NOT EXISTS idx_usage_ip
                ON usage (client_ip, created_at);

            CREATE TABLE IF NOT EXISTS api_keys (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                key         TEXT UNIQUE NOT NULL,
                email       TEXT NOT NULL,
                name        TEXT,
                tier        TEXT DEFAULT 'free',
                daily_limit INTEGER DEFAULT 3,
                created_at  TEXT DEFAULT (datetime('now')),
                last_used   TEXT,
                is_active   INTEGER DEFAULT 1
            );

            CREATE INDEX IF NOT EXISTS idx_api_keys_key
                ON api_keys (key);

            CREATE TABLE IF NOT EXISTS users (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                email       TEXT UNIQUE NOT NULL,
                name        TEXT NOT NULL,
                password    TEXT NOT NULL,
                avatar_url  TEXT,
                tier        TEXT DEFAULT 'free',
                created_at  TEXT NOT NULL DEFAULT (datetime('now')),
                last_login  TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
        """)

    db_type = "PostgreSQL" if _is_postgres() else "SQLite"
    logger.info("%s database initialised at %s", db_type, DATABASE_URL or DB_PATH)


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
def record_api_usage(client_ip: str, endpoint: str, api_key: str = None):
    """Record an API call for analytics."""
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO usage (client_ip, endpoint, api_key) VALUES (?, ?, ?)",
            (client_ip, endpoint, api_key),
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
    """Check if *client_ip* has exceeded the daily research limit."""
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


def _record_research_usage(client_ip: str, api_key: str = None):
    """Record a research generation for rate-limiting purposes."""
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO rate_limits (client_ip, action, api_key) VALUES (?, 'research', ?)",
            (client_ip, api_key),
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
# Users
# ---------------------------------------------------------------------------

def create_user(email: str, name: str, password_hash: str) -> dict | None:
    """Create a user. Returns {id, email, name, created_at} or None if email exists."""
    try:
        with _get_conn() as conn:
            conn.execute(
                "INSERT INTO users (email, name, password) VALUES (?, ?, ?)",
                (email, name, password_hash),
            )
            row = conn.execute(
                "SELECT id, email, name, created_at FROM users WHERE email = ?",
                (email,),
            ).fetchone()
            if row is None:
                return None
            return {"id": row["id"], "email": row["email"], "name": row["name"], "created_at": row["created_at"]}
    except Exception:
        logger.debug("create_user failed (likely duplicate email: %s)", email)
        return None


def get_user_by_email(email: str) -> dict | None:
    """Get user by email, returns full row including password hash."""
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT id, email, name, password, avatar_url, tier, created_at, last_login "
            "FROM users WHERE email = ?",
            (email,),
        ).fetchone()
        if row is None:
            return None
        return {
            "id": row["id"],
            "email": row["email"],
            "name": row["name"],
            "password": row["password"],
            "avatar_url": row["avatar_url"],
            "tier": row["tier"],
            "created_at": row["created_at"],
            "last_login": row["last_login"],
        }


def get_user_by_id(user_id: int) -> dict | None:
    """Get user by ID, excludes password hash."""
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT id, email, name, avatar_url, tier, created_at, last_login "
            "FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if row is None:
            return None
        return {
            "id": row["id"],
            "email": row["email"],
            "name": row["name"],
            "avatar_url": row["avatar_url"],
            "tier": row["tier"],
            "created_at": row["created_at"],
            "last_login": row["last_login"],
        }


def update_last_login(user_id: int):
    """Update last_login timestamp."""
    with _get_conn() as conn:
        conn.execute(
            "UPDATE users SET last_login = datetime('now') WHERE id = ?",
            (user_id,),
        )


# ---------------------------------------------------------------------------
# Auto-initialise on import
# ---------------------------------------------------------------------------
init_db()
