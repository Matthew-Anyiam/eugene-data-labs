"""
Firecrawl — Web search, scraping, and structured extraction.

API docs: https://docs.firecrawl.dev/api-reference
All endpoints use Bearer token auth via FIRECRAWL_API_KEY env var.
"""

import logging
import os
import requests
from eugene.cache import cached

logger = logging.getLogger(__name__)

FIRECRAWL_BASE = "https://api.firecrawl.dev/v2"
FIRECRAWL_API_KEY = os.environ.get("FIRECRAWL_API_KEY", "")
TIMEOUT = 60


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {FIRECRAWL_API_KEY}",
        "Content-Type": "application/json",
    }


def _check_key() -> bool:
    if not FIRECRAWL_API_KEY:
        logger.warning("FIRECRAWL_API_KEY not set — skipping Firecrawl request")
        return False
    return True


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

@cached(ttl=300)
def search(
    query: str,
    limit: int = 5,
    scrape: bool = False,
    sources: list | None = None,
    tbs: str | None = None,
    location: str | None = None,
    country: str = "US",
) -> dict:
    """Search the web via Firecrawl.

    Args:
        query: Search query (max 500 chars)
        limit: Number of results (default 5, max 100)
        scrape: If True, include scrapeOptions to get markdown content
        sources: List of source types, e.g. [{"type": "web"}], [{"type": "news"}]
        tbs: Time-based search filter (e.g. qdr:h, qdr:d, qdr:w, qdr:m, qdr:y)
        location: Geographic targeting (e.g. "San Francisco,California,United States")
        country: ISO country code (default US)

    Returns:
        Search results dict with web/news/images arrays
    """
    if not _check_key():
        return {"error": "FIRECRAWL_API_KEY not configured", "results": []}

    body: dict = {
        "query": query[:500],
        "limit": min(limit, 100),
        "country": country,
    }
    if sources:
        body["sources"] = sources
    if tbs:
        body["tbs"] = tbs
    if location:
        body["location"] = location
    if scrape:
        body["scrapeOptions"] = {"formats": [{"type": "markdown"}]}

    try:
        resp = requests.post(
            f"{FIRECRAWL_BASE}/search",
            json=body,
            headers=_headers(),
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        raw = resp.json()

        # Normalize response — API returns data.web, data.news, data.images
        data = raw.get("data", {})
        results = data.get("web", []) + data.get("news", [])
        return {
            "results": results,
            "count": len(results),
            "credits_used": raw.get("creditsUsed", 0),
            "source": "firecrawl",
        }
    except requests.RequestException as e:
        logger.error("Firecrawl search failed: %s", e)
        return {"error": str(e), "results": [], "count": 0, "source": "firecrawl"}


# ---------------------------------------------------------------------------
# News search (convenience wrapper)
# ---------------------------------------------------------------------------

def search_news(
    query: str,
    limit: int = 10,
    scrape: bool = False,
    country: str = "US",
) -> dict:
    """Search news via Firecrawl.

    Uses sources=[{"type": "news"}] to target news results.

    Args:
        query: News search query
        limit: Number of results (default 10)
        scrape: If True, scrape full article content as markdown
        country: ISO country code (default US)

    Returns:
        News search results
    """
    return search(
        query=query,
        limit=limit,
        scrape=scrape,
        sources=[{"type": "news"}],
        country=country,
    )


# ---------------------------------------------------------------------------
# Scrape a single URL
# ---------------------------------------------------------------------------

@cached(ttl=1800)
def scrape_url(
    url: str,
    formats: list | None = None,
    only_main_content: bool = True,
    timeout: int = 30000,
) -> dict:
    """Scrape a single URL via Firecrawl.

    Args:
        url: The URL to scrape
        formats: Output formats (default: ["markdown"])
        only_main_content: Strip nav/footer/ads (default True)
        timeout: Scrape timeout in ms (default 30000)

    Returns:
        Scraped content dict with markdown/html/etc.
    """
    if not _check_key():
        return {"error": "FIRECRAWL_API_KEY not configured"}

    if formats is None:
        formats = [{"type": "markdown"}]

    body = {
        "url": url,
        "formats": formats,
        "onlyMainContent": only_main_content,
        "timeout": timeout,
    }

    try:
        resp = requests.post(
            f"{FIRECRAWL_BASE}/scrape",
            json=body,
            headers=_headers(),
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        raw = resp.json()
        page = raw.get("data", {})
        return {
            "url": url,
            "markdown": page.get("markdown", ""),
            "html": page.get("html", ""),
            "title": page.get("metadata", {}).get("title", ""),
            "description": page.get("metadata", {}).get("description", ""),
            "status_code": page.get("metadata", {}).get("statusCode", 200),
            "credits_used": raw.get("creditsUsed", 0),
            "source": "firecrawl",
        }
    except requests.RequestException as e:
        logger.error("Firecrawl scrape failed for %s: %s", url, e)
        return {"error": str(e), "url": url, "source": "firecrawl"}


# ---------------------------------------------------------------------------
# Extract structured data
# ---------------------------------------------------------------------------

@cached(ttl=1800)
def extract(
    urls: list,
    schema: dict | None = None,
    prompt: str | None = None,
) -> dict:
    """Extract structured data from URLs via Firecrawl.

    Args:
        urls: List of URLs to extract from
        schema: JSON schema for the extracted data
        prompt: Natural language prompt describing what to extract

    Returns:
        Extracted structured data
    """
    if not _check_key():
        return {"error": "FIRECRAWL_API_KEY not configured"}

    body: dict = {"urls": urls}
    if schema:
        body["schema"] = schema
    if prompt:
        body["prompt"] = prompt

    try:
        resp = requests.post(
            f"{FIRECRAWL_BASE}/extract",
            json=body,
            headers=_headers(),
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        logger.error("Firecrawl extract failed: %s", e)
        return {"error": str(e), "urls": urls}
