"""
World Intelligence — News module.

Aggregates geopolitical and financial news from GDELT with sentiment analysis.
Generates AI-powered intelligence briefs from news data.
"""

import logging
from eugene.sources.gdelt import (
    get_news_feed,
    get_volume_timeline,
    get_tone_chart,
)

logger = logging.getLogger(__name__)


def get_feed(
    query: str | None = None,
    topic: str | None = None,
    timespan: str = "24h",
    limit: int = 25,
) -> dict:
    """Get curated news feed with sentiment.

    Args:
        query: Free-text search query
        topic: Predefined topic (geopolitics, trade, energy, tech, finance, climate)
        timespan: Time window (1h, 24h, 7d, 30d)
        limit: Max articles

    Returns:
        News feed with articles, sentiment, and metadata
    """
    return get_news_feed(query=query, topic=topic, timespan=timespan, limit=limit)


def get_sentiment(
    query: str,
    timespan: str = "30d",
) -> dict:
    """Get sentiment analysis for a topic or entity over time.

    Returns tone timeline and aggregate sentiment metrics.
    """
    tone_data = get_tone_chart(query, timespan=timespan)
    volume_data = get_volume_timeline(query, timespan=timespan)

    tones = [p.get("tone", 0) for p in tone_data.get("tone_timeline", []) if p.get("tone")]
    avg_tone = sum(tones) / len(tones) if tones else 0

    # Detect sentiment shifts
    if len(tones) >= 2:
        recent = tones[:len(tones) // 3] if len(tones) >= 3 else tones[:1]
        earlier = tones[len(tones) // 3:] if len(tones) >= 3 else tones[1:]
        recent_avg = sum(recent) / len(recent) if recent else 0
        earlier_avg = sum(earlier) / len(earlier) if earlier else 0
        shift = recent_avg - earlier_avg
    else:
        shift = 0

    sentiment_label = "neutral"
    if avg_tone > 2:
        sentiment_label = "positive"
    elif avg_tone > 5:
        sentiment_label = "very_positive"
    elif avg_tone < -2:
        sentiment_label = "negative"
    elif avg_tone < -5:
        sentiment_label = "very_negative"

    shift_label = "stable"
    if shift > 2:
        shift_label = "improving"
    elif shift < -2:
        shift_label = "deteriorating"

    return {
        "query": query,
        "sentiment": {
            "label": sentiment_label,
            "avg_tone": round(avg_tone, 2),
            "shift": round(shift, 2),
            "shift_label": shift_label,
        },
        "tone_timeline": tone_data.get("tone_timeline", []),
        "volume_timeline": volume_data.get("timeline", []),
        "timespan": timespan,
        "source": "gdelt",
    }


def get_brief(
    query: str | None = None,
    topic: str | None = None,
) -> dict:
    """Generate a structured intelligence brief from recent news.

    Combines article data with sentiment to produce an actionable summary.
    Uses LLM when available, falls back to structured extraction.
    """
    feed = get_feed(query=query, topic=topic, timespan="24h", limit=15)
    sentiment = get_sentiment(query or topic or "world events", timespan="7d")

    articles = feed.get("articles", [])
    if not articles:
        return {
            "brief": "No recent articles found for this query.",
            "articles": [],
            "sentiment": sentiment.get("sentiment", {}),
            "source": "gdelt",
        }

    # Try LLM-powered brief
    try:
        brief_text = _generate_ai_brief(articles, sentiment, query or topic)
    except Exception:
        brief_text = _generate_structured_brief(articles, sentiment)

    return {
        "brief": brief_text,
        "articles": articles[:5],  # Top 5 for reference
        "sentiment": sentiment.get("sentiment", {}),
        "article_count": len(articles),
        "source": "gdelt",
    }


def _generate_ai_brief(articles: list, sentiment: dict, query: str | None) -> str:
    """Generate AI-powered brief from articles."""
    from eugene.llm import chat

    headlines = "\n".join([f"- {a['title']} (tone: {a.get('tone', 0):.1f})" for a in articles[:15]])
    sent = sentiment.get("sentiment", {})

    prompt = f"""Analyze these recent headlines and provide a 3-4 sentence intelligence brief.
Focus on: key developments, emerging patterns, and potential market/geopolitical implications.

Query: {query or 'general world events'}
Overall sentiment: {sent.get('label', 'neutral')} (avg tone: {sent.get('avg_tone', 0)})
Sentiment trend: {sent.get('shift_label', 'stable')}

Headlines:
{headlines}

Provide a concise intelligence brief (3-4 sentences, no bullet points):"""

    response = chat(
        system="You are a geopolitical intelligence analyst. Provide concise, factual intelligence briefs. No speculation.",
        user=prompt,
    )
    return response.text


def _generate_structured_brief(articles: list, sentiment: dict) -> str:
    """Fallback structured brief without LLM."""
    count = len(articles)
    sent = sentiment.get("sentiment", {})
    label = sent.get("label", "neutral")
    shift = sent.get("shift_label", "stable")

    top_3 = [a["title"] for a in articles[:3]]
    brief_parts = [
        f"{count} articles tracked in the last 24 hours.",
        f"Overall sentiment: {label} (trend: {shift}).",
        f"Key headlines: {'; '.join(top_3)}.",
    ]
    return " ".join(brief_parts)
