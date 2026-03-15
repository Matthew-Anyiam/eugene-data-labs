"""Shared test fixtures. All external API calls are mocked."""
import os
import pytest

# Ensure no real API calls happen
os.environ.setdefault("FMP_API_KEY", "test-key")
os.environ.setdefault("FRED_API_KEY", "test-key")
os.environ.setdefault("SEC_USER_AGENT", "TestAgent/1.0 (test@test.com)")


@pytest.fixture
def sample_companyfacts():
    """Minimal SEC companyfacts JSON for testing financials handler."""
    return {
        "cik": 320193,
        "entityName": "Apple Inc",
        "facts": {
            "us-gaap": {
                "RevenueFromContractWithCustomerExcludingAssessedTax": {
                    "label": "Revenue",
                    "units": {
                        "USD": [
                            {
                                "end": "2024-09-28", "val": 391035000000,
                                "accn": "0000320193-24-000123", "fy": 2024,
                                "fp": "FY", "form": "10-K", "filed": "2024-11-01",
                                "start": "2023-10-01",
                            },
                            {
                                "end": "2023-09-30", "val": 383285000000,
                                "accn": "0000320193-23-000100", "fy": 2023,
                                "fp": "FY", "form": "10-K", "filed": "2023-11-01",
                                "start": "2022-10-01",
                            },
                        ]
                    }
                },
                "NetIncomeLoss": {
                    "label": "Net Income",
                    "units": {
                        "USD": [
                            {
                                "end": "2024-09-28", "val": 93736000000,
                                "accn": "0000320193-24-000123", "fy": 2024,
                                "fp": "FY", "form": "10-K", "filed": "2024-11-01",
                                "start": "2023-10-01",
                            },
                            {
                                "end": "2023-09-30", "val": 96995000000,
                                "accn": "0000320193-23-000100", "fy": 2023,
                                "fp": "FY", "form": "10-K", "filed": "2023-11-01",
                                "start": "2022-10-01",
                            },
                        ]
                    }
                },
                "Assets": {
                    "label": "Total Assets",
                    "units": {
                        "USD": [
                            {
                                "end": "2024-09-28", "val": 364980000000,
                                "accn": "0000320193-24-000123", "fy": 2024,
                                "fp": "FY", "form": "10-K", "filed": "2024-11-01",
                            },
                        ]
                    }
                },
                "StockholdersEquity": {
                    "label": "Stockholders Equity",
                    "units": {
                        "USD": [
                            {
                                "end": "2024-09-28", "val": 56950000000,
                                "accn": "0000320193-24-000123", "fy": 2024,
                                "fp": "FY", "form": "10-K", "filed": "2024-11-01",
                            },
                        ]
                    }
                },
            },
            "dei": {},
        }
    }


@pytest.fixture
def sample_price():
    """Sample FMP price response."""
    return {
        "ticker": "AAPL", "price": 175.50, "change": 2.30,
        "change_percent": 1.33, "volume": 45000000,
        "market_cap": 2700000000000, "day_high": 176.0,
        "day_low": 173.0, "year_high": 199.62, "year_low": 164.08,
        "avg_50": 172.5, "avg_200": 178.3,
    }


@pytest.fixture
def sample_ohlcv_bars():
    """Sample OHLCV bar data (newest-first like FMP returns)."""
    return [
        {"date": "2024-01-05", "open": 185, "high": 186, "low": 184, "close": 185.5, "volume": 40000000},
        {"date": "2024-01-04", "open": 184, "high": 185.5, "low": 183, "close": 184.5, "volume": 42000000},
        {"date": "2024-01-03", "open": 183, "high": 184, "low": 182, "close": 183.0, "volume": 38000000},
        {"date": "2024-01-02", "open": 182, "high": 183.5, "low": 181, "close": 182.5, "volume": 35000000},
    ]
