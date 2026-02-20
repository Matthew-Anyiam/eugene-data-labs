"""Resolve ticker / CIK / accession → full company identity."""
import re
from eugene.cache import cached
from eugene.sources.sec_api import fetch_tickers, fetch_submissions

ACCESSION_RE = re.compile(r"^\d{10}-\d{2}-\d{6}$")
CIK_RE = re.compile(r"^\d{1,10}$")


@cached(ttl=86400)
def _load_ticker_map() -> dict:
    """Build ticker → {cik, company} lookup from SEC."""
    data = fetch_tickers()
    result = {}
    for entry in data.values():
        result[entry["ticker"].upper()] = {
            "cik": str(entry["cik_str"]).zfill(10),
            "company": entry["title"],
        }
    return result


def resolve(identifier: str) -> dict:
    """
    Resolve any identifier to {ticker, cik, company, sic, fiscal_year_end}.
    
    Accepts:
      - Ticker: AAPL
      - CIK: 320193 or 0000320193
      - Accession: 0000320193-24-000123
    """
    identifier = identifier.strip()

    # --- Accession number ---
    if ACCESSION_RE.match(identifier):
        cik = identifier.split("-")[0]
        try:
            subs = fetch_submissions(cik)
            tickers = subs.get("tickers", [])
            return {
                "ticker": tickers[0] if tickers else None,
                "cik": cik,
                "company": subs.get("name", ""),
                "sic": subs.get("sic", ""),
                "fiscal_year_end": subs.get("fiscalYearEnd", ""),
                "accession": identifier,
            }
        except Exception as e:
            return {"error": f"Could not resolve accession {identifier}: {e}"}

    # --- CIK (pure digits) ---
    if CIK_RE.match(identifier):
        cik = identifier.zfill(10)
        try:
            subs = fetch_submissions(cik)
            tickers = subs.get("tickers", [])
            return {
                "ticker": tickers[0] if tickers else None,
                "cik": cik,
                "company": subs.get("name", ""),
                "sic": subs.get("sic", ""),
                "fiscal_year_end": subs.get("fiscalYearEnd", ""),
            }
        except Exception as e:
            return {"error": f"Could not resolve CIK {identifier}: {e}"}

    # --- Ticker ---
    ticker = identifier.upper().replace(" ", "")
    ticker_map = _load_ticker_map()
    if ticker not in ticker_map:
        return {"error": f"Unknown ticker: {ticker}"}

    entry = ticker_map[ticker]
    cik = entry["cik"]
    try:
        subs = fetch_submissions(cik)
    except Exception:
        subs = {}

    return {
        "ticker": ticker,
        "cik": cik,
        "company": entry.get("company", subs.get("name", "")),
        "sic": subs.get("sic", ""),
        "fiscal_year_end": subs.get("fiscalYearEnd", ""),
    }
