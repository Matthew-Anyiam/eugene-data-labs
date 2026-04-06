"""
World Intelligence — Research module.

Web search, news search, page scraping, and research briefs
powered by Firecrawl.
"""

import logging
from eugene.sources.firecrawl import (
    search as fc_search,
    search_news as fc_search_news,
    scrape_url as fc_scrape_url,
)

logger = logging.getLogger(__name__)


def search_web(
    query: str,
    limit: int = 5,
    scrape: bool = False,
) -> dict:
    """Search the web.

    Args:
        query: Search query
        limit: Max results (default 5)
        scrape: If True, include page content as markdown

    Returns:
        Search results
    """
    return fc_search(query=query, limit=limit, scrape=scrape)


def search_news(
    query: str,
    limit: int = 10,
    scrape: bool = False,
    country: str = "US",
) -> dict:
    """Search news articles.

    Args:
        query: News search query
        limit: Max results (default 10)
        scrape: If True, include full article content
        country: ISO country code (default US)

    Returns:
        News search results
    """
    return fc_search_news(query=query, limit=limit, scrape=scrape, country=country)


def scrape_page(url: str) -> dict:
    """Scrape a single page and return markdown content.

    Args:
        url: URL to scrape

    Returns:
        Scraped content with markdown
    """
    return fc_scrape_url(url=url)


def research_topic(query: str, depth: int = 5) -> dict:
    """Build a structured research brief by searching and scraping top results.

    Searches the web, scrapes the top results, and returns a consolidated
    research brief with sources and key content.

    Args:
        query: Research topic / search query
        depth: Number of top results to scrape (default 5)

    Returns:
        Research brief with sources and scraped content
    """
    # Step 1: search
    search_results = fc_search(query=query, limit=depth, scrape=False)

    if "error" in search_results and not search_results.get("results"):
        return search_results

    # Collect web results from the response
    web_results = search_results.get("data", search_results.get("web", []))
    if not web_results and isinstance(search_results.get("results"), list):
        web_results = search_results["results"]

    # Step 2: scrape each result
    sources = []
    for item in web_results[:depth]:
        url = item.get("url", "")
        if not url:
            continue

        scraped = fc_scrape_url(url=url)
        content = ""
        if scraped and "error" not in scraped:
            data = scraped.get("data", scraped)
            content = data.get("markdown", data.get("content", ""))

        sources.append({
            "url": url,
            "title": item.get("title", ""),
            "description": item.get("description", ""),
            "markdown": content[:5000] if content else "",
        })

    return {
        "query": query,
        "source_count": len(sources),
        "sources": sources,
    }
