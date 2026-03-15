"""Tests for eugene.auth — API key validation."""
import pytest
from unittest.mock import MagicMock
from eugene.auth import require_api_key, _get_valid_keys


def test_open_mode_no_keys(monkeypatch):
    """When EUGENE_API_KEYS is empty, all requests pass through."""
    monkeypatch.delenv("EUGENE_API_KEYS", raising=False)
    keys = _get_valid_keys()
    assert keys == set()


def test_key_parsing(monkeypatch):
    """Comma-separated keys are parsed correctly."""
    monkeypatch.setenv("EUGENE_API_KEYS", "key1, key2 , key3")
    keys = _get_valid_keys()
    assert keys == {"key1", "key2", "key3"}


def test_empty_string_ignored(monkeypatch):
    monkeypatch.setenv("EUGENE_API_KEYS", "key1,,, key2,")
    keys = _get_valid_keys()
    assert keys == {"key1", "key2"}


@pytest.mark.asyncio
async def test_valid_key_passes(monkeypatch):
    monkeypatch.setenv("EUGENE_API_KEYS", "secret123")

    @require_api_key
    async def handler(request):
        return {"ok": True}

    request = MagicMock()
    request.headers = {"x-api-key": "secret123"}
    request.query_params = {}
    result = await handler(request)
    assert result == {"ok": True}


@pytest.mark.asyncio
async def test_invalid_key_returns_401(monkeypatch):
    monkeypatch.setenv("EUGENE_API_KEYS", "secret123")

    @require_api_key
    async def handler(request):
        return {"ok": True}

    request = MagicMock()
    request.headers = {}
    request.query_params = {}
    result = await handler(request)
    assert result.status_code == 401


@pytest.mark.asyncio
async def test_query_param_key(monkeypatch):
    monkeypatch.setenv("EUGENE_API_KEYS", "qkey")

    @require_api_key
    async def handler(request):
        return {"ok": True}

    request = MagicMock()
    request.headers = {}
    request.query_params = {"api_key": "qkey"}
    result = await handler(request)
    assert result == {"ok": True}


@pytest.mark.asyncio
async def test_open_mode_passes_without_key(monkeypatch):
    monkeypatch.delenv("EUGENE_API_KEYS", raising=False)

    @require_api_key
    async def handler(request):
        return {"ok": True}

    request = MagicMock()
    request.headers = {}
    request.query_params = {}
    result = await handler(request)
    assert result == {"ok": True}
