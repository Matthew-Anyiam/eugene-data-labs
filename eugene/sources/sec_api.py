"""Single module for all SEC EDGAR HTTP calls."""
import os
import requests
from eugene.cache import cached

SEC_HEADERS = {
    "User-Agent": os.environ.get(
        "SEC_USER_AGENT",
        f"{os.environ.get('SEC_CONTACT_NAME', 'Eugene Intelligence')} ({os.environ.get('SEC_CONTACT_EMAIL', 'matthew@eugeneintelligence.com')})"
    ),
    "Accept-Encoding": "gzip, deflate",
}
BASE = "https://data.sec.gov"
EFTS_BASE = "https://efts.sec.gov"


@cached(ttl=86400)
def fetch_tickers() -> dict:
    """SEC company tickers JSON → {ticker: {cik_str, title}}."""
    r = requests.get("https://www.sec.gov/files/company_tickers.json", headers=SEC_HEADERS, timeout=15)
    r.raise_for_status()
    return r.json()


@cached(ttl=3600)
def fetch_submissions(cik: str) -> dict:
    """SEC submissions (filings metadata + company info)."""
    cik = cik.zfill(10)
    r = requests.get(f"{BASE}/submissions/CIK{cik}.json", headers=SEC_HEADERS, timeout=15)
    r.raise_for_status()
    return r.json()


@cached(ttl=3600)
def fetch_companyfacts(cik: str) -> dict:
    """SEC XBRL companyfacts (all concepts, all periods)."""
    cik = cik.zfill(10)
    r = requests.get(f"{BASE}/api/xbrl/companyfacts/CIK{cik}.json", headers=SEC_HEADERS, timeout=30)
    r.raise_for_status()
    return r.json()


def fetch_filing_html(cik: str, accession: str, primary_doc: str) -> str:
    """Fetch a specific filing document (HTML)."""
    cik = cik.lstrip("0") or "0"
    accession_flat = accession.replace("-", "")
    url = f"{BASE}/Archives/edgar/data/{cik}/{accession_flat}/{primary_doc}"
    r = requests.get(url, headers=SEC_HEADERS, timeout=30)
    r.raise_for_status()
    return r.text


def search_fulltext(query: str, forms: list = None, date_from: str = None, date_to: str = None, limit: int = 10) -> dict:
    """EDGAR full-text search (EFTS)."""
    params = {"q": query, "forms": ",".join(forms or []), "dateRange": "custom"}
    if date_from:
        params["startdt"] = date_from
    if date_to:
        params["enddt"] = date_to
    params = {k: v for k, v in params.items() if v}
    r = requests.get(f"{EFTS_BASE}/LATEST/search-index", headers=SEC_HEADERS, params=params, timeout=15)
    r.raise_for_status()
    return r.json()
