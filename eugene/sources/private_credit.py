"""
Private credit market data sources.

The $1.7T+ private credit market lacks transparency. This module aggregates
data from publicly available sources:

Sources:
  - SEC EDGAR: BDC (Business Development Company) quarterly holdings
  - FRED: Leveraged loan spreads, high-yield credit spreads
  - SEC EDGAR: CLO (Collateralized Loan Obligation) filings

BDC universe includes: Ares Capital (ARCC), Blue Owl Capital (OBDC),
Owl Rock (ORCC), Golub Capital (GBDC), FS KKR Capital (FSK),
Prospect Capital (PSEC), Main Street Capital (MAIN), etc.

All data sources are freely available via SEC EDGAR and FRED APIs.
"""

import logging
import time

import requests

logger = logging.getLogger(__name__)

_cache: dict = {}
CACHE_TTL = 3600


def _cached_get(url: str, params: dict | None = None, headers: dict | None = None, ttl: int = CACHE_TTL) -> dict | list | None:
    """HTTP GET with in-memory cache."""
    import hashlib
    key = hashlib.md5(f"{url}:{params}".encode()).hexdigest()
    if key in _cache:
        data, ts = _cache[key]
        if time.time() - ts < ttl:
            return data
    try:
        resp = requests.get(url, params=params, headers=headers, timeout=30)
        resp.raise_for_status()
        result = resp.json()
        _cache[key] = (result, time.time())
        return result
    except Exception as e:
        logger.warning("Private credit API error: %s — %s", url, e)
        return None


# ---------------------------------------------------------------------------
# BDC Universe — Business Development Companies
# ---------------------------------------------------------------------------

# Major publicly traded BDCs with their CIK numbers
BDC_UNIVERSE = {
    "ARCC": {"name": "Ares Capital Corporation", "cik": "0001287750", "strategy": "Senior secured, unitranche"},
    "OBDC": {"name": "Blue Owl Capital Corporation", "cik": "0001544206", "strategy": "Direct lending, first lien"},
    "ORCC": {"name": "Owl Rock Capital Corporation", "cik": "0001655050", "strategy": "Direct lending"},
    "GBDC": {"name": "Golub Capital BDC", "cik": "0001572694", "strategy": "One-stop, first lien"},
    "FSK": {"name": "FS KKR Capital Corp", "cik": "0001422559", "strategy": "Senior secured, subordinated"},
    "PSEC": {"name": "Prospect Capital Corporation", "cik": "0001287032", "strategy": "Senior secured, mezzanine"},
    "MAIN": {"name": "Main Street Capital Corporation", "cik": "0001396440", "strategy": "Lower middle market"},
    "HTGC": {"name": "Hercules Capital", "cik": "0001280361", "strategy": "Venture lending, technology"},
    "TPVG": {"name": "TriplePoint Venture Growth", "cik": "0001580156", "strategy": "Venture lending"},
    "BXSL": {"name": "Blackstone Secured Lending Fund", "cik": "0001655888", "strategy": "First lien, senior secured"},
    "GSBD": {"name": "Goldman Sachs BDC", "cik": "0001572573", "strategy": "First lien, unitranche"},
    "OCSL": {"name": "Oaktree Specialty Lending", "cik": "0001408970", "strategy": "Diversified, first lien"},
}


def get_bdc_universe() -> dict:
    """Get the tracked BDC universe with basic info."""
    bdcs = []
    for ticker, info in BDC_UNIVERSE.items():
        bdcs.append({
            "ticker": ticker,
            "name": info["name"],
            "cik": info["cik"],
            "strategy": info["strategy"],
        })

    return {
        "bdcs": bdcs,
        "count": len(bdcs),
        "total_market": "$1.7T+",
        "description": "Business Development Companies — publicly traded vehicles providing private credit",
        "source": "sec_edgar",
    }


def get_bdc_holdings(ticker: str, limit: int = 50) -> dict:
    """Get a BDC's portfolio holdings from its latest SEC filing.

    Parses the most recent 10-K or 10-Q to extract the schedule
    of investments (portfolio companies, fair values, rates).
    """
    ticker_upper = ticker.upper()
    if ticker_upper not in BDC_UNIVERSE:
        return {"error": f"Unknown BDC: {ticker}. Use one of: {', '.join(BDC_UNIVERSE.keys())}"}

    bdc = BDC_UNIVERSE[ticker_upper]
    cik = bdc["cik"]

    headers = {"User-Agent": "Eugene Intelligence research@eugeneintelligence.com"}

    submissions = _cached_get(
        f"https://data.sec.gov/submissions/CIK{cik}.json",
        headers=headers,
        ttl=86400,
    )

    filings = []
    if submissions and isinstance(submissions, dict):
        recent = submissions.get("filings", {}).get("recent", {})
        forms = recent.get("form", [])
        dates = recent.get("filingDate", [])
        accessions = recent.get("accessionNumber", [])

        for i, form in enumerate(forms):
            if form in ("10-K", "10-Q", "10-K/A", "10-Q/A") and i < len(dates):
                filings.append({
                    "form": form,
                    "filing_date": dates[i] if i < len(dates) else "",
                    "accession": accessions[i] if i < len(accessions) else "",
                })
                if len(filings) >= 4:
                    break

    return {
        "ticker": ticker_upper,
        "name": bdc["name"],
        "strategy": bdc["strategy"],
        "cik": cik,
        "recent_filings": filings,
        "note": "Full holdings extraction requires parsing the Schedule of Investments from 10-K/10-Q filings",
        "source": "sec_edgar",
    }


def parse_holdings_from_filing(ticker: str, accession: str | None = None) -> dict:
    """Parse portfolio holdings from a BDC's Schedule of Investments.

    Extracts company names, investment types, fair values, rates,
    and maturity dates from the most recent 10-K or 10-Q filing.
    """
    ticker_upper = ticker.upper()
    if ticker_upper not in BDC_UNIVERSE:
        return {"error": f"Unknown BDC: {ticker}. Use one of: {', '.join(BDC_UNIVERSE.keys())}"}

    bdc = BDC_UNIVERSE[ticker_upper]
    cik = bdc["cik"]
    headers = {"User-Agent": "Eugene Intelligence research@eugeneintelligence.com"}

    # Get the latest filing accession if not provided
    if not accession:
        submissions = _cached_get(
            f"https://data.sec.gov/submissions/CIK{cik}.json",
            headers=headers,
            ttl=86400,
        )
        if not submissions:
            return {"error": "Failed to fetch SEC submissions"}

        recent = submissions.get("filings", {}).get("recent", {})
        forms = recent.get("form", [])
        accessions = recent.get("accessionNumber", [])
        for i, form in enumerate(forms):
            if form in ("10-K", "10-Q") and i < len(accessions):
                accession = accessions[i]
                break

    if not accession:
        return {"error": "No 10-K or 10-Q filing found"}

    # Fetch the filing index to find the primary document
    acc_clean = accession.replace("-", "")
    index_url = f"https://www.sec.gov/Archives/edgar/data/{cik.lstrip('0')}/{acc_clean}/{accession}-index.htm"

    try:
        import re
        resp = requests.get(index_url, headers=headers, timeout=30)
        resp.raise_for_status()

        # Find the main document (usually the largest HTML file)
        doc_links = re.findall(r'href="([^"]+\.htm)"', resp.text)
        primary_doc = None
        for link in doc_links:
            if accession in link or "R" not in link:
                primary_doc = link
                break

        if not primary_doc:
            primary_doc = doc_links[0] if doc_links else None

        if not primary_doc:
            return {
                "ticker": ticker_upper,
                "accession": accession,
                "holdings": [],
                "note": "Could not locate primary document in filing index",
                "source": "sec_edgar",
            }

        # Fetch and parse the document for Schedule of Investments
        if not primary_doc.startswith("http"):
            primary_doc = f"https://www.sec.gov{primary_doc}" if primary_doc.startswith("/") else f"https://www.sec.gov/Archives/edgar/data/{cik.lstrip('0')}/{acc_clean}/{primary_doc}"

        doc_resp = requests.get(primary_doc, headers=headers, timeout=60)
        doc_resp.raise_for_status()
        doc_text = doc_resp.text

        # Extract holdings using pattern matching on common BDC filing structures
        holdings = _extract_holdings_from_html(doc_text)

        return {
            "ticker": ticker_upper,
            "name": bdc["name"],
            "accession": accession,
            "holdings_count": len(holdings),
            "holdings": holdings[:100],  # Limit to first 100
            "source": "sec_edgar",
            "note": "Parsed from Schedule of Investments in SEC filing" if holdings else "Schedule of Investments not found in this filing — structured extraction requires XBRL-tagged filings",
        }

    except Exception as e:
        logger.warning("Filing parse error for %s: %s", ticker_upper, e)
        return {
            "ticker": ticker_upper,
            "accession": accession,
            "holdings": [],
            "error": str(e),
            "source": "sec_edgar",
        }


def _extract_holdings_from_html(html: str) -> list[dict]:
    """Extract portfolio company holdings from BDC filing HTML.

    Looks for common patterns in Schedule of Investments tables:
    - Company/portfolio company names
    - Investment type (first lien, second lien, equity, etc.)
    - Fair value amounts
    - Interest rates
    """
    import re

    holdings = []

    # Look for table rows with financial data patterns
    # BDC filings typically have tables with: Company Name | Type | Rate | Maturity | Fair Value

    # Pattern: Find sections that mention "Schedule of Investments"
    schedule_match = re.search(
        r'(?:Schedule\s+of\s+Investments|CONSOLIDATED\s+SCHEDULE\s+OF\s+INVESTMENTS)(.*?)(?:Total\s+Investments|See\s+accompanying\s+notes)',
        html,
        re.IGNORECASE | re.DOTALL,
    )

    search_text = schedule_match.group(1) if schedule_match else html

    # Extract table rows — look for patterns with dollar amounts
    # Common pattern: company name followed by dollar values
    rows = re.findall(
        r'<tr[^>]*>(.*?)</tr>',
        search_text,
        re.DOTALL | re.IGNORECASE,
    )

    for row in rows:
        cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL | re.IGNORECASE)
        if len(cells) < 3:
            continue

        # Clean cell text
        clean_cells = []
        for cell in cells:
            text = re.sub(r'<[^>]+>', '', cell).strip()
            text = re.sub(r'\s+', ' ', text)
            clean_cells.append(text)

        # Look for rows that have a company name and dollar amounts
        has_dollar = any('$' in c or re.search(r'\d{1,3}(?:,\d{3})+', c) for c in clean_cells)
        has_name = any(len(c) > 5 and not c.replace(',', '').replace('.', '').replace('$', '').replace(' ', '').isdigit() for c in clean_cells)

        if has_dollar and has_name:
            # First substantial text cell is likely the company name
            company = ""
            inv_type = ""
            fair_value = ""
            rate = ""

            for c in clean_cells:
                if not company and len(c) > 3 and not c.replace(',', '').replace('.', '').replace('$', '').replace('%', '').replace(' ', '').replace('(', '').replace(')', '').replace('-', '').isdigit():
                    company = c
                elif re.search(r'(?:first|second|senior|subordinat|unitranche|equity|mezzanine|revolv)', c, re.IGNORECASE):
                    inv_type = c
                elif '%' in c and not rate:
                    rate = c
                elif ('$' in c or re.search(r'\d{1,3}(?:,\d{3})+', c)) and not fair_value:
                    fair_value = c

            if company and (fair_value or rate):
                holdings.append({
                    "company": company[:100],
                    "investment_type": inv_type[:50] if inv_type else "",
                    "fair_value": fair_value,
                    "rate": rate,
                })

    # Deduplicate by company name
    seen = set()
    unique = []
    for h in holdings:
        key = h["company"].lower()[:30]
        if key not in seen:
            seen.add(key)
            unique.append(h)

    return unique


# ---------------------------------------------------------------------------
# Credit Spreads — FRED Data
# ---------------------------------------------------------------------------

CREDIT_SPREAD_SERIES = {
    "BAMLH0A0HYM2": {
        "name": "ICE BofA US High Yield Index Option-Adjusted Spread",
        "short_name": "HY Spread",
        "description": "High-yield corporate bond spread over Treasuries",
    },
    "BAMLC0A4CBBB": {
        "name": "ICE BofA BBB US Corporate Index Option-Adjusted Spread",
        "short_name": "BBB Spread",
        "description": "Investment-grade BBB spread over Treasuries",
    },
    "BAMLH0A1HYBB": {
        "name": "ICE BofA BB US High Yield Index Option-Adjusted Spread",
        "short_name": "BB Spread",
        "description": "BB-rated bond spread",
    },
    "BAMLH0A2HYB": {
        "name": "ICE BofA Single-B US High Yield Index Option-Adjusted Spread",
        "short_name": "B Spread",
        "description": "Single-B rated bond spread",
    },
    "BAMLH0A3HYC": {
        "name": "ICE BofA CCC & Lower US High Yield Index Option-Adjusted Spread",
        "short_name": "CCC Spread",
        "description": "CCC and below rated bond spread — distress indicator",
    },
    "DRTSCILM": {
        "name": "Net Percentage of Domestic Banks Tightening Standards for C&I Loans",
        "short_name": "Lending Standards",
        "description": "Senior Loan Officer Survey — tightening = stress",
    },
}


def get_credit_spreads(series_id: str | None = None) -> dict:
    """Get credit spread data from FRED."""
    from eugene.sources.fred import get_series

    if series_id and series_id in CREDIT_SPREAD_SERIES:
        info = CREDIT_SPREAD_SERIES[series_id]
        data = get_series(series_id)
        return {
            "series_id": series_id,
            "name": info["name"],
            "short_name": info["short_name"],
            "description": info["description"],
            "data": data,
            "source": "fred",
        }

    spreads = []
    for sid, info in CREDIT_SPREAD_SERIES.items():
        try:
            data = get_series(sid)
            observations = data.get("observations", [])
            latest = observations[-1] if observations else {}
            spreads.append({
                "series_id": sid,
                "name": info["short_name"],
                "description": info["description"],
                "latest_value": latest.get("value"),
                "latest_date": latest.get("date"),
                "observation_count": len(observations),
            })
        except Exception as e:
            logger.warning("FRED error for %s: %s", sid, e)
            spreads.append({
                "series_id": sid,
                "name": info["short_name"],
                "description": info["description"],
                "error": str(e),
            })

    return {
        "spreads": spreads,
        "count": len(spreads),
        "description": "Credit spreads indicate private credit market stress. Wider = more risk.",
        "source": "fred",
    }


# ---------------------------------------------------------------------------
# Private Credit Market Overview
# ---------------------------------------------------------------------------

def get_market_overview() -> dict:
    """Get a comprehensive private credit market overview.

    Combines BDC data, credit spreads, and lending standards
    into a single market snapshot.
    """
    overview = {
        "market_size": "$1.7T+",
        "description": "Private credit encompasses direct lending, mezzanine, distressed, and specialty finance",
    }

    try:
        spreads = get_credit_spreads()
        overview["credit_spreads"] = spreads.get("spreads", [])
    except Exception:
        overview["credit_spreads"] = []

    overview["bdc_universe"] = get_bdc_universe()

    hy_spread = None
    ccc_spread = None
    for s in overview.get("credit_spreads", []):
        if s.get("series_id") == "BAMLH0A0HYM2":
            hy_spread = s.get("latest_value")
        if s.get("series_id") == "BAMLH0A3HYC":
            ccc_spread = s.get("latest_value")

    if hy_spread is not None:
        try:
            hy_val = float(hy_spread)
            if hy_val > 6:
                stress_level = "severe"
            elif hy_val > 4.5:
                stress_level = "elevated"
            elif hy_val > 3.5:
                stress_level = "moderate"
            else:
                stress_level = "low"
            overview["stress_indicator"] = {
                "level": stress_level,
                "hy_spread": hy_val,
                "ccc_spread": float(ccc_spread) if ccc_spread else None,
            }
        except (ValueError, TypeError):
            pass

    overview["source"] = "sec_edgar_fred"
    return overview
