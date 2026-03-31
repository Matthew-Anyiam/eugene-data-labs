"""
Eugene Intelligence - API Key Management.

Generates, validates, and manages API keys stored in SQLite.
Key format: ``eug_`` + 32 random hex characters.
"""

import secrets
import logging
from datetime import datetime, timedelta

from eugene.db import _get_conn

logger = logging.getLogger(__name__)

KEY_PREFIX = "eug_"
KEY_HEX_LENGTH = 32  # 32 hex chars = 16 bytes of randomness


# ---------------------------------------------------------------------------
# Key generation
# ---------------------------------------------------------------------------

def generate_key(email: str, name: str = None, tier: str = "free") -> dict:
    """Create a new API key for the given email.

    Returns ``{key, email, name, tier, daily_limit}``.
    """
    key = KEY_PREFIX + secrets.token_hex(KEY_HEX_LENGTH // 2)
    daily_limit = _tier_limit(tier)

    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO api_keys (key, email, name, tier, daily_limit) VALUES (?, ?, ?, ?, ?)",
            (key, email.strip().lower(), name, tier, daily_limit),
        )

    logger.info("Generated API key for %s (tier=%s)", email, tier)
    return {
        "key": key,
        "email": email.strip().lower(),
        "name": name,
        "tier": tier,
        "daily_limit": daily_limit,
    }


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_key(key: str) -> dict | None:
    """Look up an API key and return user info if valid and active.

    Updates ``last_used`` on success.  Returns ``None`` when the key is
    invalid, revoked, or not found.
    """
    if not key or not key.startswith(KEY_PREFIX):
        return None

    with _get_conn() as conn:
        row = conn.execute(
            "SELECT id, key, email, name, tier, daily_limit, is_active "
            "FROM api_keys WHERE key = ?",
            (key,),
        ).fetchone()

        if not row:
            return None
        if not row["is_active"]:
            return None

        conn.execute(
            "UPDATE api_keys SET last_used = datetime('now') WHERE id = ?",
            (row["id"],),
        )

    return {
        "id": row["id"],
        "key": row["key"],
        "email": row["email"],
        "name": row["name"],
        "tier": row["tier"],
        "daily_limit": row["daily_limit"],
    }


# ---------------------------------------------------------------------------
# Usage stats
# ---------------------------------------------------------------------------

def get_usage(key: str) -> dict:
    """Return usage statistics for the given API key.

    Queries the ``usage`` table joined through the key's IP activity, and
    also counts rate-limited research calls.
    """
    with _get_conn() as conn:
        # Get key info
        row = conn.execute(
            "SELECT id, email, tier, daily_limit, created_at, last_used "
            "FROM api_keys WHERE key = ?",
            (key,),
        ).fetchone()

        if not row:
            return {"error": "Key not found"}

        # Count research usage in last 24h via rate_limits table
        # We track by api_key in rate_limits if available, otherwise show totals
        cutoff = (datetime.utcnow() - timedelta(days=1)).isoformat()

        # Total API calls recorded for this key
        total_calls = conn.execute(
            "SELECT COUNT(*) FROM usage WHERE api_key = ?",
            (key,),
        ).fetchone()[0]

        today_calls = conn.execute(
            "SELECT COUNT(*) FROM usage WHERE api_key = ? AND created_at >= ?",
            (key, cutoff),
        ).fetchone()[0]

        # Research usage from rate_limits
        research_today = conn.execute(
            "SELECT COUNT(*) FROM rate_limits WHERE api_key = ? AND action = 'research' AND created_at >= ?",
            (key, cutoff),
        ).fetchone()[0]

    return {
        "email": row["email"],
        "tier": row["tier"],
        "daily_limit": row["daily_limit"],
        "created_at": row["created_at"],
        "last_used": row["last_used"],
        "total_requests": total_calls,
        "requests_today": today_calls,
        "research_today": research_today,
        "research_remaining": max(0, row["daily_limit"] - research_today),
    }


# ---------------------------------------------------------------------------
# Revoke / list
# ---------------------------------------------------------------------------

def revoke_key(key: str) -> bool:
    """Deactivate an API key.  Returns True if a key was found and revoked."""
    with _get_conn() as conn:
        cur = conn.execute(
            "UPDATE api_keys SET is_active = 0 WHERE key = ? AND is_active = 1",
            (key,),
        )
    return cur.rowcount > 0


def list_keys(email: str) -> list[dict]:
    """List all API keys (active and revoked) for an email address."""
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT key, email, name, tier, daily_limit, created_at, last_used, is_active "
            "FROM api_keys WHERE email = ? ORDER BY created_at DESC",
            (email.strip().lower(),),
        ).fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _tier_limit(tier: str) -> int:
    """Return the daily research limit for a tier."""
    limits = {
        "free": 3,
        "pro": 1000,
        "enterprise": 10000,
    }
    return limits.get(tier, 3)
