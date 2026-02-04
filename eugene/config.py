"""
Eugene Intelligence - Configuration Management

Handles all configuration with validation, environment variables,
and sensible defaults. Uses Pydantic for type safety.
"""

import os
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field
from functools import lru_cache


@dataclass
class APIConfig:
    """API-related configuration"""
    anthropic_api_key: Optional[str] = None
    anthropic_model: str = "claude-sonnet-4-20250514"
    anthropic_max_tokens: int = 4096
    anthropic_temperature: float = 0.0  # Deterministic for extraction
    
    def __post_init__(self):
        if self.anthropic_api_key is None:
            self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
    
    @property
    def is_configured(self) -> bool:
        return self.anthropic_api_key is not None


@dataclass
class SECConfig:
    """SEC EDGAR configuration"""
    user_agent: str = ""
    base_url: str = "https://www.sec.gov"
    edgar_url: str = "https://www.sec.gov/cgi-bin/browse-edgar"
    data_url: str = "https://data.sec.gov"
    rate_limit_per_second: int = 10  # SEC requirement
    request_timeout: int = 30
    max_retries: int = 3
    
    def __post_init__(self):
        if not self.user_agent:
            # SEC requires contact info in user agent
            email = os.getenv("SEC_CONTACT_EMAIL", "contact@example.com")
            name = os.getenv("SEC_CONTACT_NAME", "Eugene Intelligence")
            self.user_agent = f"{name} ({email})"
    
    @property
    def is_valid(self) -> bool:
        return "@" in self.user_agent  # Must have contact email


@dataclass
class CacheConfig:
    """Caching configuration"""
    enabled: bool = True
    directory: Path = field(default_factory=lambda: Path(__file__).parent.parent / "data" / "cache")
    filing_ttl_hours: int = 24 * 7  # Cache filings for 1 week
    extraction_ttl_hours: int = 24  # Cache extractions for 1 day
    max_size_mb: int = 1000  # 1GB max cache size
    
    def __post_init__(self):
        if isinstance(self.directory, str):
            self.directory = Path(self.directory)
        self.directory.mkdir(parents=True, exist_ok=True)


@dataclass
class LogConfig:
    """Logging configuration"""
    level: str = "INFO"
    format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    file: Optional[Path] = None
    
    def __post_init__(self):
        env_level = os.getenv("EUGENE_LOG_LEVEL")
        if env_level:
            self.level = env_level.upper()


@dataclass
class ValidationConfig:
    """Validation configuration"""
    min_confidence_threshold: float = 0.5  # Below this, flag for review
    high_confidence_threshold: float = 0.85  # Above this, production ready
    strict_mode: bool = False  # If True, reject low confidence extractions
    
    def __post_init__(self):
        if not 0 <= self.min_confidence_threshold <= 1:
            raise ValueError("min_confidence_threshold must be between 0 and 1")
        if not 0 <= self.high_confidence_threshold <= 1:
            raise ValueError("high_confidence_threshold must be between 0 and 1")


@dataclass
class ServerConfig:
    """API server configuration"""
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    rate_limit_per_minute: int = 60
    
    def __post_init__(self):
        env_port = os.getenv("EUGENE_PORT")
        if env_port:
            self.port = int(env_port)


@dataclass 
class Config:
    """
    Main configuration class for Eugene Intelligence.
    
    Usage:
        config = Config()  # Uses defaults + environment variables
        
        # Or override specific values:
        config = Config(
            api=APIConfig(anthropic_api_key="sk-..."),
            sec=SECConfig(user_agent="My App (me@email.com)")
        )
    """
    api: APIConfig = field(default_factory=APIConfig)
    sec: SECConfig = field(default_factory=SECConfig)
    cache: CacheConfig = field(default_factory=CacheConfig)
    log: LogConfig = field(default_factory=LogConfig)
    validation: ValidationConfig = field(default_factory=ValidationConfig)
    server: ServerConfig = field(default_factory=ServerConfig)
    
    # Project paths
    project_root: Path = field(default_factory=lambda: Path(__file__).parent.parent)
    data_dir: Path = field(default_factory=lambda: Path(__file__).parent.parent / "data")
    
    def __post_init__(self):
        if isinstance(self.project_root, str):
            self.project_root = Path(self.project_root)
        if isinstance(self.data_dir, str):
            self.data_dir = Path(self.data_dir)
        
        # Create data directories
        (self.data_dir / "cache").mkdir(parents=True, exist_ok=True)
        (self.data_dir / "extractions").mkdir(parents=True, exist_ok=True)
        (self.data_dir / "companies").mkdir(parents=True, exist_ok=True)
    
    @property
    def is_ready(self) -> bool:
        """Check if configuration is ready for production use"""
        return self.api.is_configured and self.sec.is_valid
    
    def validate(self) -> list[str]:
        """Return list of configuration issues"""
        issues = []
        
        if not self.api.anthropic_api_key:
            issues.append("ANTHROPIC_API_KEY not set")
        
        if "@" not in self.sec.user_agent:
            issues.append("SEC user agent must include contact email")
        
        if not self.cache.directory.exists():
            issues.append(f"Cache directory does not exist: {self.cache.directory}")
        
        return issues
    
    def summary(self) -> str:
        """Return configuration summary"""
        return f"""
Eugene Intelligence Configuration
=================================
API Key: {'✓ Set' if self.api.is_configured else '✗ Not set'}
SEC User Agent: {self.sec.user_agent}
Cache: {'Enabled' if self.cache.enabled else 'Disabled'} ({self.cache.directory})
Log Level: {self.log.level}
Validation Threshold: {self.validation.min_confidence_threshold}
Server: {self.server.host}:{self.server.port}
Ready: {'✓ Yes' if self.is_ready else '✗ No'}
"""


@lru_cache()
def get_config() -> Config:
    """
    Get singleton configuration instance.
    
    Cached so the same instance is returned on repeated calls.
    """
    return Config()


# Convenience function
def load_config(**overrides) -> Config:
    """
    Load configuration with optional overrides.
    
    Usage:
        config = load_config(api=APIConfig(anthropic_api_key="sk-..."))
    """
    return Config(**overrides)


if __name__ == "__main__":
    # Test configuration
    config = Config()
    print(config.summary())
    
    issues = config.validate()
    if issues:
        print("\nConfiguration Issues:")
        for issue in issues:
            print(f"  - {issue}")
