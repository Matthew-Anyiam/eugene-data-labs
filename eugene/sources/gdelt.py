"""
GDELT — Global Database of Events, Language, and Tone.

Free, no auth required, updates every 15 minutes.
Uses the GDELT DOC 2.0 API for article search and the GEO 2.0 API for event data.

API docs: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
License: Free, attribution required.
"""

import logging
import requests
from eugene.cache import cached

logger = logging.getLogger(__name__)

GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc"
GDELT_GEO_API = "https://api.gdeltproject.org/api/v2/geo/geo"
GDELT_TV_API = "https://api.gdeltproject.org/api/v2/tv/tv"

TIMEOUT = 15


@cached(ttl=900)  # 15 min cache — matches GDELT update frequency
def search_articles(
    query: str,
    mode: str = "artlist",
    max_records: int = 25,
    timespan: str = "7d",
    sort: str = "datedesc",
    source_country: str | None = None,
    theme: str | None = None,
) -> dict:
    """Search GDELT for news articles.

    Args:
        query: Search query (entity name, topic, etc.)
        mode: artlist (articles), timelinevol (volume timeline), tonechart
        max_records: Max articles to return (max 250)
        timespan: Time window (e.g. '24h', '7d', '30d')
        sort: datedesc, dateasc, toneasc, tonedesc
        source_country: Filter by source country (e.g. 'US', 'GB')
        theme: GDELT theme filter (e.g. 'ECON_BANKRUPTCY', 'CRISISLEX_C03_DEAD')

    Returns:
        Dict with articles list
    """
    params = {
        "query": query,
        "mode": mode,
        "maxrecords": min(max_records, 250),
        "timespan": timespan,
        "sort": sort,
        "format": "json",
    }
    if source_country:
        params["sourcecountry"] = source_country
    if theme:
        params["query"] = f"{query} theme:{theme}"

    try:
        resp = requests.get(GDELT_DOC_API, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        articles = []
        for article in data.get("articles", []):
            articles.append({
                "title": article.get("title", ""),
                "url": article.get("url", ""),
                "source": article.get("domain", "") or article.get("sourcecountry", ""),
                "source_country": article.get("sourcecountry", ""),
                "language": article.get("language", ""),
                "seendate": article.get("seendate", ""),
                "tone": article.get("tone", 0),
                "image": article.get("socialimage", ""),
            })

        return {
            "query": query,
            "articles": articles,
            "count": len(articles),
            "timespan": timespan,
            "source": "gdelt",
        }

    except requests.exceptions.Timeout:
        logger.warning("GDELT API timeout for query: %s", query)
        return {"query": query, "articles": [], "count": 0, "error": "timeout", "source": "gdelt"}
    except Exception as e:
        logger.error("GDELT API error: %s", e)
        return {"query": query, "articles": [], "count": 0, "error": str(e), "source": "gdelt"}


@cached(ttl=900)
def get_volume_timeline(
    query: str,
    timespan: str = "30d",
) -> dict:
    """Get article volume timeline for a query.

    Returns time series of article counts — useful for detecting
    spikes in coverage that may signal emerging events.
    """
    params = {
        "query": query,
        "mode": "timelinevol",
        "timespan": timespan,
        "format": "json",
    }
    try:
        resp = requests.get(GDELT_DOC_API, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        timeline = []
        for series in data.get("timeline", []):
            for point in series.get("data", []):
                timeline.append({
                    "date": point.get("date", ""),
                    "value": point.get("value", 0),
                })

        return {
            "query": query,
            "timeline": timeline,
            "timespan": timespan,
            "source": "gdelt",
        }
    except Exception as e:
        logger.error("GDELT timeline error: %s", e)
        return {"query": query, "timeline": [], "error": str(e), "source": "gdelt"}


@cached(ttl=900)
def get_tone_chart(query: str, timespan: str = "30d") -> dict:
    """Get sentiment tone timeline for a query.

    GDELT tone ranges from -100 (extremely negative) to +100 (extremely positive).
    """
    params = {
        "query": query,
        "mode": "tonechart",
        "timespan": timespan,
        "format": "json",
    }
    try:
        resp = requests.get(GDELT_DOC_API, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        timeline = []
        for series in data.get("timeline", []):
            for point in series.get("data", []):
                timeline.append({
                    "date": point.get("date", ""),
                    "tone": point.get("value", 0),
                })

        return {
            "query": query,
            "tone_timeline": timeline,
            "timespan": timespan,
            "source": "gdelt",
        }
    except Exception as e:
        logger.error("GDELT tone error: %s", e)
        return {"query": query, "tone_timeline": [], "error": str(e), "source": "gdelt"}


@cached(ttl=3600)
def get_geo_events(
    query: str | None = None,
    source_country: str | None = None,
    timespan: str = "7d",
) -> dict:
    """Get geolocated events from GDELT.

    Returns events with lat/lng for map visualization.
    """
    params = {
        "query": query or "",
        "format": "geojson",
        "timespan": timespan,
        "mode": "pointdata",
    }
    if source_country:
        params["sourcecountry"] = source_country

    try:
        resp = requests.get(GDELT_GEO_API, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        features = data.get("features", [])
        events = []
        for f in features[:100]:  # Cap at 100 events
            props = f.get("properties", {})
            coords = f.get("geometry", {}).get("coordinates", [0, 0])
            events.append({
                "name": props.get("name", ""),
                "url": props.get("url", ""),
                "source": props.get("domain", ""),
                "tone": props.get("tone", 0),
                "lat": coords[1] if len(coords) > 1 else 0,
                "lng": coords[0] if len(coords) > 0 else 0,
                "date": props.get("seendate", ""),
            })

        return {
            "query": query,
            "events": events,
            "count": len(events),
            "source": "gdelt",
        }
    except Exception as e:
        logger.error("GDELT geo error: %s", e)
        return {"query": query, "events": [], "count": 0, "error": str(e), "source": "gdelt"}


def get_news_feed(
    query: str | None = None,
    topic: str | None = None,
    timespan: str = "24h",
    limit: int = 25,
) -> dict:
    """High-level news feed combining articles with sentiment.

    This is the primary entry point for the eugene:world news action.
    """
    # Map common topics to GDELT-friendly queries
    topic_queries = {
        "geopolitics": "conflict OR sanctions OR diplomacy OR military",
        "trade": "trade war OR tariff OR export ban OR supply chain",
        "energy": "oil price OR OPEC OR natural gas OR energy crisis",
        "tech": "AI regulation OR antitrust OR semiconductor OR tech ban",
        "finance": "central bank OR interest rate OR inflation OR recession",
        "climate": "climate OR hurricane OR wildfire OR flood OR drought",
    }

    search_q = query or topic_queries.get(topic, topic or "world news")

    articles = search_articles(search_q, max_records=limit, timespan=timespan)
    tone = get_tone_chart(search_q, timespan=timespan)

    # Compute aggregate sentiment
    tones = [a.get("tone", 0) for a in articles.get("articles", []) if a.get("tone")]
    avg_tone = sum(tones) / len(tones) if tones else 0

    sentiment = "neutral"
    if avg_tone > 2:
        sentiment = "positive"
    elif avg_tone > 5:
        sentiment = "very_positive"
    elif avg_tone < -2:
        sentiment = "negative"
    elif avg_tone < -5:
        sentiment = "very_negative"

    return {
        "articles": articles.get("articles", []),
        "count": articles.get("count", 0),
        "sentiment": {
            "label": sentiment,
            "avg_tone": round(avg_tone, 2),
            "sample_size": len(tones),
        },
        "tone_timeline": tone.get("tone_timeline", []),
        "query": search_q,
        "timespan": timespan,
        "source": "gdelt",
    }
