"""
Eugene Intelligence - JWT User Authentication.

Pure-stdlib implementation using HMAC-based password hashing (PBKDF2)
and HMAC-SHA256 JWT tokens. No external dependencies required.
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time

SALT_LENGTH = 32


def _get_secret() -> str:
    """Return the JWT signing secret from env or a dev default."""
    return os.environ.get("JWT_SECRET", "eugene-dev-secret-change-in-prod")


# ---------------------------------------------------------------------------
# Password hashing (PBKDF2-SHA256)
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    """Hash a password with a random salt using PBKDF2-SHA256."""
    salt = secrets.token_hex(SALT_LENGTH)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return f"{salt}:{h.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against a PBKDF2-SHA256 hash."""
    try:
        salt, h = hashed.split(":")
        check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
        return hmac.compare_digest(h, check.hex())
    except Exception:
        return False


# ---------------------------------------------------------------------------
# JWT tokens (HMAC-SHA256, no external deps)
# ---------------------------------------------------------------------------

def create_token(
    user_id: str,
    email: str,
    name: str,
    expires_hours: int = 72,
) -> str:
    """Create an HMAC-SHA256 JWT token."""
    secret = _get_secret()
    now = int(time.time())
    payload = {
        "user_id": user_id,
        "email": email,
        "name": name,
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

    Returns the payload dict ``{user_id, email, name, exp, iat}``
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
