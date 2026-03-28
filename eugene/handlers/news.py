"""Corporate news via SEC EDGAR Full-Text Search (EFTS).

Uses 8-K and 6-K filings as a free proxy for corporate news,
since FMP Starter plan does not include a news endpoint.
"""
import logging
from datetime import datetime, timedelta

from eugene.sources.sec_api import search_fulltext

logger = logging.getLogger(__name__)


def news_handler(resolved: dict, params: dict) -> dict:
    """Fetch recent 8-K/6-K filings as corporate news items.

    Uses SEC EFTS full-text search to find recent material-event
    filings for the given company.
    """
    ticker = resolved.get("ticker", "")
    company = resolved.get("company", "")
    _ = resolved.get("cik", "")
    limit = int(params.get("limit", 10))

    # Date range: default last 30 days
    today = datetime.utcnow().date()
    start = today - timedelta(days=30)
    date_from = params.get("from") or start.isoformat()
    date_to = params.get("to") or today.isoformat()

    forms = ["8-K", "8-K/A", "6-K"]

    # Try searching by ticker first (more precise for well-known tickers),
    # then fall back to company name if ticker yields nothing.
    news_items = []
    for query_term in [ticker, f'"{company}"' if company else None]:
        if not query_term:
            continue
        try:
            raw = search_fulltext(
                query=query_term,
                forms=forms,
                date_from=date_from,
                date_to=date_to,
                limit=limit,
            )
            hits = _parse_hits(raw, ticker, limit)
            if hits:
                news_items = hits
                break
        except Exception as e:
            logger.warning("EFTS search failed for %r: %s", query_term, e)
            continue

    return {
        "news": news_items,
        "count": len(news_items),
        "source": "SEC EDGAR EFTS",
    }


def _parse_hits(raw: dict, ticker: str, limit: int) -> list[dict]:
    """Extract news-like items from EFTS search response.

    The EFTS response shape is:
      { "hits": { "hits": [ { "_source": { ... } }, ... ] } }
    """
    hits_outer = raw.get("hits", {})
    hits_list = hits_outer.get("hits", [])

    items = []
    for hit in hits_list[:limit]:
        source = hit.get("_source", {})
        # _source fields: file_date, display_names, display_date_filed,
        # form_type, file_description, file_num, period_of_report, etc.
        title = (
            source.get("file_description")
            or source.get("display_names", [""])[0]
            or source.get("form_type", "SEC Filing")
        )
        filed_date = source.get("file_date", source.get("display_date_filed", ""))
        form_type = source.get("form_type", "")

        # Build a URL to the filing on SEC EDGAR
        accession = source.get("accession_no", "")
        url = ""
        if accession:
            acc_flat = accession.replace("-", "")
            entity_id = source.get("entity_id", "")
            if entity_id:
                cik_num = entity_id.lstrip("0") or "0"
                url = f"https://www.sec.gov/Archives/edgar/data/{cik_num}/{acc_flat}/{accession}-index.htm"
            else:
                url = f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={accession}&type=&dateb=&owner=include&count=1"

        items.append({
            "title": title,
            "date": filed_date,
            "source": "SEC EDGAR",
            "form": form_type,
            "url": url,
            "ticker": ticker,
        })

    return items
