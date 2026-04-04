"""Tests for eugene.user_auth — PBKDF2 password hashing and HMAC-SHA256 JWT tokens."""

import base64
import json
import time
from unittest.mock import patch

import pytest

from eugene.user_auth import (
    create_token,
    decode_token,
    hash_password,
    verify_password,
)


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------


class TestHashPassword:
    def test_random_salt_produces_different_hashes(self):
        """Same password hashed twice must yield different results (random salt)."""
        h1 = hash_password("hunter2")
        h2 = hash_password("hunter2")
        assert h1 != h2

    def test_format_salt_colon_hex(self):
        """Hash string must be 'salt:hex_digest'."""
        h = hash_password("p@ssword")
        parts = h.split(":")
        assert len(parts) == 2
        salt, digest = parts
        # Salt is token_hex(32) -> 64 hex chars
        assert len(salt) == 64
        # SHA-256 digest -> 64 hex chars
        assert len(digest) == 64


class TestVerifyPassword:
    def test_correct_password(self):
        """verify_password returns True for the original password."""
        hashed = hash_password("correct-horse-battery-staple")
        assert verify_password("correct-horse-battery-staple", hashed) is True

    def test_wrong_password(self):
        """verify_password returns False for a different password."""
        hashed = hash_password("right")
        assert verify_password("wrong", hashed) is False

    def test_tampered_hash(self):
        """Flipping a character in the stored hash must fail verification."""
        hashed = hash_password("mypassword")
        salt, digest = hashed.split(":")
        # Flip the first hex char of the digest
        flipped = "0" if digest[0] != "0" else "1"
        tampered = f"{salt}:{flipped}{digest[1:]}"
        assert verify_password("mypassword", tampered) is False

    def test_garbage_hash_returns_false(self):
        """Completely invalid stored hash must not raise, just return False."""
        assert verify_password("anything", "not-a-valid-hash") is False

    def test_empty_string_hash_returns_false(self):
        assert verify_password("anything", "") is False


# ---------------------------------------------------------------------------
# JWT token creation
# ---------------------------------------------------------------------------


class TestCreateToken:
    def test_returns_three_part_jwt(self):
        """JWT must be three base64url segments separated by dots."""
        token = create_token("u1", "a@b.com", "Alice")
        parts = token.split(".")
        assert len(parts) == 3

    def test_each_segment_is_base64url(self):
        """Each segment must decode as valid base64url."""
        token = create_token("u1", "a@b.com", "Alice")
        for part in token.split("."):
            padded = part + "=" * (4 - len(part) % 4)
            decoded = base64.urlsafe_b64decode(padded)
            assert len(decoded) > 0

    def test_header_contains_alg_hs256(self):
        token = create_token("u1", "a@b.com", "Alice")
        header_b64 = token.split(".")[0]
        header = json.loads(
            base64.urlsafe_b64decode(header_b64 + "==")
        )
        assert header == {"alg": "HS256", "typ": "JWT"}

    def test_payload_contains_expected_fields(self):
        token = create_token("u1", "a@b.com", "Alice")
        payload_b64 = token.split(".")[1]
        payload = json.loads(
            base64.urlsafe_b64decode(payload_b64 + "==")
        )
        assert payload["user_id"] == "u1"
        assert payload["email"] == "a@b.com"
        assert payload["name"] == "Alice"
        assert "exp" in payload
        assert "iat" in payload

    def test_default_expiry_is_4_hours(self):
        token = create_token("u1", "a@b.com", "Alice")
        payload_b64 = token.split(".")[1]
        payload = json.loads(
            base64.urlsafe_b64decode(payload_b64 + "==")
        )
        assert payload["exp"] - payload["iat"] == 4 * 3600

    def test_custom_expiry(self):
        token = create_token("u1", "a@b.com", "Alice", expires_hours=1)
        payload_b64 = token.split(".")[1]
        payload = json.loads(
            base64.urlsafe_b64decode(payload_b64 + "==")
        )
        assert payload["exp"] - payload["iat"] == 3600


# ---------------------------------------------------------------------------
# JWT token decoding
# ---------------------------------------------------------------------------


class TestDecodeToken:
    def test_valid_token_returns_payload(self):
        """decode_token returns the original payload dict for a valid token."""
        token = create_token("u42", "bob@co.org", "Bob")
        payload = decode_token(token)
        assert payload is not None
        assert payload["user_id"] == "u42"
        assert payload["email"] == "bob@co.org"
        assert payload["name"] == "Bob"

    def test_expired_token_returns_none(self):
        """A token whose exp is in the past must return None."""
        token = create_token("u1", "a@b.com", "Alice", expires_hours=1)
        # Advance time past expiry
        future = time.time() + 2 * 3600
        with patch("eugene.user_auth.time") as mock_time:
            mock_time.time.return_value = future
            result = decode_token(token)
        assert result is None

    def test_tampered_signature_returns_none(self):
        """Altering the signature segment must cause rejection."""
        token = create_token("u1", "a@b.com", "Alice")
        parts = token.split(".")
        # Flip a character in the signature
        sig = parts[2]
        flipped = "A" if sig[0] != "A" else "B"
        tampered_token = f"{parts[0]}.{parts[1]}.{flipped}{sig[1:]}"
        assert decode_token(tampered_token) is None

    def test_tampered_payload_returns_none(self):
        """Altering the payload without re-signing must fail signature check."""
        token = create_token("u1", "a@b.com", "Alice")
        parts = token.split(".")
        # Decode payload, modify, re-encode (without re-signing)
        payload = json.loads(
            base64.urlsafe_b64decode(parts[1] + "==")
        )
        payload["user_id"] = "admin"
        new_payload_b64 = (
            base64.urlsafe_b64encode(json.dumps(payload).encode())
            .decode()
            .rstrip("=")
        )
        tampered = f"{parts[0]}.{new_payload_b64}.{parts[2]}"
        assert decode_token(tampered) is None

    def test_garbage_input_returns_none(self):
        assert decode_token("not.a.jwt") is None

    def test_empty_string_returns_none(self):
        assert decode_token("") is None

    def test_too_few_parts_returns_none(self):
        assert decode_token("only.two") is None

    def test_too_many_parts_returns_none(self):
        assert decode_token("a.b.c.d") is None

    def test_wrong_secret_returns_none(self, monkeypatch):
        """Token signed with one secret must not verify under a different secret."""
        token = create_token("u1", "a@b.com", "Alice")
        monkeypatch.setenv("JWT_SECRET", "completely-different-secret")
        assert decode_token(token) is None


# ---------------------------------------------------------------------------
# Roundtrip
# ---------------------------------------------------------------------------


class TestTokenRoundtrip:
    def test_create_then_decode_preserves_payload(self):
        """Full roundtrip: create_token -> decode_token returns matching fields."""
        token = create_token("user-99", "eve@example.com", "Eve", expires_hours=24)
        payload = decode_token(token)
        assert payload is not None
        assert payload["user_id"] == "user-99"
        assert payload["email"] == "eve@example.com"
        assert payload["name"] == "Eve"
        assert payload["exp"] - payload["iat"] == 24 * 3600

    def test_roundtrip_with_special_characters(self):
        """Payload with unicode and special chars survives roundtrip."""
        token = create_token("u-1", "user+tag@example.com", "O'Brien \"Bob\"")
        payload = decode_token(token)
        assert payload is not None
        assert payload["name"] == "O'Brien \"Bob\""
        assert payload["email"] == "user+tag@example.com"
