"""Tests for configuration management."""
import os
from pathlib import Path
from unittest.mock import patch

import pytest

from eugene.config import (
    APIConfig, SECConfig, CacheConfig, LogConfig,
    ValidationConfig, ServerConfig, Config, load_config,
)


class TestAPIConfig:
    def test_defaults(self):
        with patch.dict(os.environ, {}, clear=True):
            cfg = APIConfig(fred_api_key=None, fmp_api_key=None, anthropic_api_key=None)
        assert cfg.fred_api_key is None
        assert cfg.fmp_api_key is None
        assert cfg.anthropic_api_key is None
        assert cfg.anthropic_model == "claude-sonnet-4-20250514"

    def test_env_loading(self):
        env = {"FRED_API_KEY": "fred123", "FMP_API_KEY": "fmp456", "ANTHROPIC_API_KEY": "ant789"}
        with patch.dict(os.environ, env, clear=True):
            cfg = APIConfig()
        assert cfg.fred_api_key == "fred123"
        assert cfg.fmp_api_key == "fmp456"
        assert cfg.anthropic_api_key == "ant789"

    def test_anthropic_model_env(self):
        with patch.dict(os.environ, {"ANTHROPIC_MODEL": "claude-3-haiku"}, clear=True):
            cfg = APIConfig()
        assert cfg.anthropic_model == "claude-3-haiku"

    def test_explicit_values_not_overridden(self):
        with patch.dict(os.environ, {"FRED_API_KEY": "from_env"}, clear=True):
            cfg = APIConfig(fred_api_key="explicit")
        assert cfg.fred_api_key == "explicit"

    def test_is_configured(self):
        cfg = APIConfig()
        assert cfg.is_configured is True


class TestSECConfig:
    def test_default_user_agent(self):
        with patch.dict(os.environ, {"SEC_CONTACT_EMAIL": "test@test.com", "SEC_CONTACT_NAME": "Test"}, clear=True):
            cfg = SECConfig()
        assert "test@test.com" in cfg.user_agent
        assert "Test" in cfg.user_agent

    def test_is_valid_with_email(self):
        cfg = SECConfig(user_agent="Bot (me@email.com)")
        assert cfg.is_valid is True

    def test_is_valid_without_email(self):
        cfg = SECConfig(user_agent="No email here")
        assert cfg.is_valid is False

    def test_explicit_user_agent(self):
        cfg = SECConfig(user_agent="Custom Agent (custom@test.com)")
        assert cfg.user_agent == "Custom Agent (custom@test.com)"


class TestCacheConfig:
    def test_creates_directory(self, tmp_path):
        cache_dir = tmp_path / "test_cache"
        cfg = CacheConfig(directory=cache_dir)
        assert cfg.directory.exists()

    def test_string_to_path(self, tmp_path):
        cache_dir = str(tmp_path / "str_cache")
        cfg = CacheConfig(directory=cache_dir)
        assert isinstance(cfg.directory, Path)
        assert cfg.directory.exists()

    def test_defaults(self, tmp_path):
        cfg = CacheConfig(directory=tmp_path)
        assert cfg.enabled is True
        assert cfg.filing_ttl_hours == 24 * 7
        assert cfg.max_size_mb == 1000


class TestLogConfig:
    def test_default_level(self):
        with patch.dict(os.environ, {}, clear=True):
            cfg = LogConfig()
        assert cfg.level == "INFO"

    def test_env_level(self):
        with patch.dict(os.environ, {"EUGENE_LOG_LEVEL": "debug"}, clear=True):
            cfg = LogConfig()
        assert cfg.level == "DEBUG"


class TestValidationConfig:
    def test_defaults(self):
        cfg = ValidationConfig()
        assert cfg.min_confidence_threshold == 0.5
        assert cfg.high_confidence_threshold == 0.85

    def test_invalid_min_threshold(self):
        with pytest.raises(ValueError, match="min_confidence_threshold"):
            ValidationConfig(min_confidence_threshold=1.5)

    def test_invalid_high_threshold(self):
        with pytest.raises(ValueError, match="high_confidence_threshold"):
            ValidationConfig(high_confidence_threshold=-0.1)


class TestServerConfig:
    def test_default_port(self):
        with patch.dict(os.environ, {}, clear=True):
            cfg = ServerConfig()
        assert cfg.port == 8000

    def test_env_port(self):
        with patch.dict(os.environ, {"EUGENE_PORT": "9000"}, clear=True):
            cfg = ServerConfig()
        assert cfg.port == 9000


class TestConfig:
    def test_creation(self, tmp_path):
        Config(
            cache=CacheConfig(directory=tmp_path / "cache"),
            data_dir=tmp_path / "data",
        )
        assert (tmp_path / "data" / "cache").exists()
        assert (tmp_path / "data" / "extractions").exists()

    def test_is_ready(self, tmp_path):
        cfg = Config(
            sec=SECConfig(user_agent="Bot (me@email.com)"),
            cache=CacheConfig(directory=tmp_path / "cache"),
            data_dir=tmp_path / "data",
        )
        assert cfg.is_ready is True

    def test_is_not_ready(self, tmp_path):
        cfg = Config(
            sec=SECConfig(user_agent="No email"),
            cache=CacheConfig(directory=tmp_path / "cache"),
            data_dir=tmp_path / "data",
        )
        assert cfg.is_ready is False

    def test_validate_issues(self, tmp_path):
        with patch.dict(os.environ, {}, clear=True):
            cfg = Config(
                sec=SECConfig(user_agent="No email"),
                api=APIConfig(fred_api_key=None, fmp_api_key=None, anthropic_api_key=None),
                cache=CacheConfig(directory=tmp_path / "cache"),
                data_dir=tmp_path / "data",
            )
        issues = cfg.validate()
        assert any("SEC user agent" in i for i in issues)
        assert any("FRED" in i for i in issues)
        assert any("FMP" in i for i in issues)

    def test_validate_no_issues(self, tmp_path):
        cfg = Config(
            sec=SECConfig(user_agent="Bot (me@email.com)"),
            api=APIConfig(fred_api_key="key1", fmp_api_key="key2"),
            cache=CacheConfig(directory=tmp_path / "cache"),
            data_dir=tmp_path / "data",
        )
        issues = cfg.validate()
        assert len(issues) == 0

    def test_summary(self, tmp_path):
        cfg = Config(
            sec=SECConfig(user_agent="Bot (me@email.com)"),
            api=APIConfig(fred_api_key="key1", fmp_api_key="key2"),
            cache=CacheConfig(directory=tmp_path / "cache"),
            data_dir=tmp_path / "data",
        )
        summary = cfg.summary()
        assert "FRED API Key" in summary
        assert "Set" in summary
        assert "Bot (me@email.com)" in summary

    def test_string_paths(self, tmp_path):
        cfg = Config(
            project_root=str(tmp_path),
            data_dir=str(tmp_path / "data"),
            cache=CacheConfig(directory=tmp_path / "cache"),
        )
        assert isinstance(cfg.project_root, Path)
        assert isinstance(cfg.data_dir, Path)


class TestLoadConfig:
    def test_returns_config(self, tmp_path):
        cfg = load_config(
            cache=CacheConfig(directory=tmp_path / "cache"),
            data_dir=tmp_path / "data",
        )
        assert isinstance(cfg, Config)
