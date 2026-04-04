"""
Eugene Intelligence - JWT User Authentication.

Pure-stdlib implementation using HMAC-based password hashing (PBKDF2)
and HMAC-SHA256 JWT tokens. No external dependencies required.
"""

import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import time

logger = logging.getLogger(__name__)

SALT_LENGTH = 32

# Dev fallback — only allowed when EUGENE_ENV != "production"
_DEV_SECRET = "eugene-dev-secret-change-in-prod"
_INSECURE_SECRETS = {_DEV_SECRET, "", "change-me-in-production", "secret"}


def _get_secret() -> str:
    """Return the JWT signing secret from env. Enforces secure secret in production."""
    secret = os.environ.get("JWT_SECRET", _DEV_SECRET)
    env = os.environ.get("EUGENE_ENV", "development")

    if env == "production" and secret in _INSECURE_SECRETS:
        raise RuntimeError(
            "CRITICAL: JWT_SECRET is not set or uses an insecure default. "
            "Set a strong JWT_SECRET environment variable before running in production. "
            "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
        )

    if secret in _INSECURE_SECRETS and not hasattr(_get_secret, "_warned"):
        logger.warning(
            "JWT_SECRET is using an insecure default. Set JWT_SECRET env var for production."
        )
        _get_secret._warned = True

    return secret


# ---------------------------------------------------------------------------
# Password hashing (PBKDF2-SHA256, 600k iterations per NIST 2023)
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    """Hash a password with a random salt using PBKDF2-SHA256."""
    salt = secrets.token_hex(SALT_LENGTH)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 600_000)
    return f"{salt}:{h.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against a PBKDF2-SHA256 hash."""
    try:
        salt, h = hashed.split(":")
        # Support both old 100k and new 600k iteration counts
        check_600k = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 600_000)
        if hmac.compare_digest(h, check_600k.hex()):
            return True
        # Fallback: verify against 100k iterations (existing passwords)
        check_100k = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
        return hmac.compare_digest(h, check_100k.hex())
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Password reset tokens
# ---------------------------------------------------------------------------

# In-memory store for password reset tokens (production should use Redis/DB)
_reset_tokens: dict[str, dict] = {}  # token -> {user_id, email, exp}

RESET_TOKEN_EXPIRY = 3600  # 1 hour


def create_reset_token(user_id: str, email: str) -> str:
    """Create a password reset token (valid for 1 hour)."""
    token = secrets.token_urlsafe(32)
    _reset_tokens[token] = {
        "user_id": user_id,
        "email": email,
        "exp": time.time() + RESET_TOKEN_EXPIRY,
    }
    # Prune expired tokens
    now = time.time()
    expired = [k for k, v in _reset_tokens.items() if v["exp"] < now]
    for k in expired:
        del _reset_tokens[k]
    return token


def verify_reset_token(token: str) -> dict | None:
    """Verify a password reset token. Returns {user_id, email} or None."""
    data = _reset_tokens.get(token)
    if not data:
        return None
    if data["exp"] < time.time():
        del _reset_tokens[token]
        return None
    return {"user_id": data["user_id"], "email": data["email"]}


def consume_reset_token(token: str) -> dict | None:
    """Verify and consume (single-use) a reset token."""
    data = verify_reset_token(token)
    if data:
        _reset_tokens.pop(token, None)
    return data


# ---------------------------------------------------------------------------
# Email verification tokens
# ---------------------------------------------------------------------------

_verify_tokens: dict[str, dict] = {}  # token -> {user_id, email, exp}

VERIFY_TOKEN_EXPIRY = 86400  # 24 hours


def create_verify_token(user_id: str, email: str) -> str:
    """Create an email verification token (valid for 24 hours)."""
    token = secrets.token_urlsafe(32)
    _verify_tokens[token] = {
        "user_id": user_id,
        "email": email,
        "exp": time.time() + VERIFY_TOKEN_EXPIRY,
    }
    return token


def consume_verify_token(token: str) -> dict | None:
    """Verify and consume an email verification token."""
    data = _verify_tokens.get(token)
    if not data:
        return None
    if data["exp"] < time.time():
        del _verify_tokens[token]
        return None
    del _verify_tokens[token]
    return {"user_id": data["user_id"], "email": data["email"]}


# ---------------------------------------------------------------------------
# JWT tokens (HMAC-SHA256, no external deps)
# ---------------------------------------------------------------------------

# Short-lived access token: 4 hours (was 72h)
DEFAULT_ACCESS_TOKEN_HOURS = 4

# Longer refresh window: refresh endpoint issues new 4h tokens
# The frontend auto-refreshes 10 min before expiry


def create_token(
    user_id: str,
    email: str,
    name: str,
    expires_hours: int = DEFAULT_ACCESS_TOKEN_HOURS,
) -> str:
    """Create an HMAC-SHA256 JWT token."""
    secret = _get_secret()
    now = int(time.time())
    payload = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "iss": "eugene-intelligence",
        "aud": "eugene-web",
        "exp": now + expires_hours * 3600,
        "iat": now,
    }
    header_b64 = (
        base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
        .decode()
        .rstrip("=")
    )
    payload_b64 = (
        base64.urlsafe_b64encode(json.dumps(payload).encode())
        .decode()
        .rstrip("=")
    )
    signing_input = f"{header_b64}.{payload_b64}"
    sig = hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode().rstrip("=")
    return f"{signing_input}.{sig_b64}"


def decode_token(token: str) -> dict | None:
    """Decode and verify an HMAC-SHA256 JWT token.

    Returns the payload dict ``{user_id, email, name, exp, iat, iss, aud}``
    or ``None`` if the token is invalid or expired.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        secret = _get_secret()
        signing_input = f"{parts[0]}.{parts[1]}"
        expected_sig = hmac.new(
            secret.encode(), signing_input.encode(), hashlib.sha256
        ).digest()
        # Pad base64 for decoding
        actual_sig = base64.urlsafe_b64decode(parts[2] + "==")
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        padding = 4 - len(parts[1]) % 4
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * padding))
        if payload.get("exp", 0) < time.time():
            return None

        return payload
    except Exception:
        return None
