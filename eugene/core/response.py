"""
Eugene Intelligence — Institutional Grade Response Format
"""
from datetime import datetime, timezone
from typing import Any, Optional, Dict, List
from enum import Enum


class DataSource(str, Enum):
    SEC_XBRL = "SEC XBRL"
    SEC_EDGAR = "SEC EDGAR"
    SEC_RSS = "SEC RSS"
    FMP = "Financial Modeling Prep"
    FRED = "Federal Reserve Economic Data"
    FED_RSS = "Federal Reserve RSS"
    TREASURY = "US Treasury FiscalData"
    ECB = "European Central Bank"


class ResponseStatus(str, Enum):
    SUCCESS = "success"
    PARTIAL = "partial"
    ERROR = "error"


def eugene_response(
    data: Any,
    source: DataSource,
    status: ResponseStatus = ResponseStatus.SUCCESS,
    ticker: str = None,
    period: str = None,
    error: str = None,
    warnings: List[str] = None,
    metadata: Dict = None
) -> dict:
    response = {
        "status": status.value,
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "source": {"name": source.value, "traced": True},
        "data": data,
    }
    if ticker:
        response["ticker"] = ticker.upper()
    if period:
        response["period"] = period
    if error:
        response["error"] = {"message": error, "code": "DATA_ERROR" if "not found" in error.lower() else "API_ERROR"}
    if warnings:
        response["warnings"] = warnings
    if metadata:
        response["metadata"] = metadata
    return response


def validate_ticker(ticker: str) -> tuple:
    if not ticker:
        return False, "Ticker required"
    ticker = ticker.strip().upper()
    if len(ticker) > 5:
        return False, f"Invalid ticker: {ticker}"
    return True, ticker


def format_currency(value: float, currency: str = "USD") -> dict:
    if value is None:
        return {"value": None, "formatted": "N/A", "currency": currency}
    if abs(value) >= 1e12:
        formatted = f"${value/1e12:.2f}T"
    elif abs(value) >= 1e9:
        formatted = f"${value/1e9:.2f}B"
    elif abs(value) >= 1e6:
        formatted = f"${value/1e6:.1f}M"
    else:
        formatted = f"${value:,.2f}"
    return {"value": value, "formatted": formatted, "currency": currency}


def format_percentage(value: float, decimals: int = 2) -> dict:
    if value is None:
        return {"value": None, "formatted": "N/A", "unit": "percent"}
    return {"value": round(value, decimals), "formatted": f"{value:.{decimals}f}%", "unit": "percent"}


def format_number(value: float, unit: str = None) -> dict:
    if value is None:
        return {"value": None, "formatted": "N/A", "unit": unit}
    # Round to 2 decimals for ratios
    if unit == "ratio":
        return {"value": round(value, 2), "formatted": f"{value:.2f}x", "unit": unit}
    return {"value": value, "formatted": f"{value:,.0f}", "unit": unit}
