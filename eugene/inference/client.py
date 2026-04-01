"""
Inference client — calls Modal GPU functions or falls back to local/LLM.

Usage:
    from eugene.inference.client import extract_entities, classify_sentiment

The client transparently handles:
  1. Modal GPU inference (fastest, most accurate)
  2. LLM-based fallback via Claude/OpenAI
  3. Rule-based fallback (no external calls)
"""

import logging
import os

logger = logging.getLogger(__name__)

_modal_available = None


def _check_modal() -> bool:
    """Check if Modal is configured and available."""
    global _modal_available
    if _modal_available is not None:
        return _modal_available

    try:
        if not os.environ.get("MODAL_TOKEN_ID"):
            _modal_available = False
            return False
        import modal  # noqa: F401
        _modal_available = True
    except ImportError:
        _modal_available = False

    return _modal_available


# ---------------------------------------------------------------------------
# NER — Named Entity Recognition
# ---------------------------------------------------------------------------

def extract_entities(text: str) -> list[dict]:
    """Extract named entities from text.

    Tries Modal GPU first, falls back to LLM, then regex.
    """
    if _check_modal():
        try:
            return _ner_modal(text)
        except Exception as e:
            logger.warning("Modal NER failed, falling back: %s", e)

    try:
        return _ner_llm(text)
    except Exception as e:
        logger.warning("LLM NER failed, falling back to regex: %s", e)

    return _ner_regex(text)


def _ner_modal(text: str) -> list[dict]:
    """NER via Modal GPU."""
    from modal import Cls
    NERModel = Cls.lookup("eugene-inference", "NERModel")
    model = NERModel()
    return model.extract_entities.remote(text)


def _ner_llm(text: str) -> list[dict]:
    """NER via LLM (Claude/OpenAI)."""
    from eugene.llm import chat
    import json

    prompt = f"""Extract named entities from this text. Return a JSON array of objects with fields:
- entity: the entity name
- entity_group: one of (person, company, location, other)
- score: confidence 0.0-1.0

Text: {text[:2000]}

Return ONLY a JSON array, no other text."""

    response = chat(
        system="You extract named entities from text. Return only valid JSON.",
        user=prompt,
    )

    try:
        entities = json.loads(response.text)
        if isinstance(entities, list):
            return entities
    except (json.JSONDecodeError, AttributeError):
        pass

    return []


def _ner_regex(text: str) -> list[dict]:
    """Basic regex-based entity extraction as last resort."""
    import re
    entities = []

    pattern = r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b'
    for match in re.finditer(pattern, text):
        name = match.group(1)
        if len(name) > 3 and name not in ("The", "This", "That", "With", "From"):
            entities.append({
                "entity": name,
                "entity_group": "other",
                "score": 0.5,
            })

    for match in re.finditer(r'\$([A-Z]{2,5})\b', text):
        entities.append({
            "entity": match.group(1),
            "entity_group": "company",
            "score": 0.8,
        })

    seen = set()
    unique = []
    for e in entities:
        key = e["entity"].lower()
        if key not in seen:
            seen.add(key)
            unique.append(e)

    return unique[:20]


# ---------------------------------------------------------------------------
# Sentiment Classification
# ---------------------------------------------------------------------------

def classify_sentiment(text: str) -> dict:
    """Classify text sentiment.

    Tries Modal GPU first, falls back to LLM, then rule-based.
    """
    if _check_modal():
        try:
            return _sentiment_modal(text)
        except Exception as e:
            logger.warning("Modal sentiment failed, falling back: %s", e)

    try:
        return _sentiment_llm(text)
    except Exception as e:
        logger.warning("LLM sentiment failed, falling back to rules: %s", e)

    return _sentiment_rules(text)


def _sentiment_modal(text: str) -> dict:
    """Sentiment via Modal GPU."""
    from modal import Cls
    SentimentModel = Cls.lookup("eugene-inference", "SentimentModel")
    model = SentimentModel()
    return model.classify.remote(text)


def _sentiment_llm(text: str) -> dict:
    """Sentiment via LLM."""
    from eugene.llm import chat
    import json

    prompt = f"""Classify the sentiment of this text as positive, negative, or neutral.
Return JSON: {{"label": "positive|negative|neutral", "score": 0.0-1.0, "tone": -1.0 to 1.0}}

Text: {text[:1000]}

Return ONLY JSON."""

    response = chat(
        system="You classify text sentiment. Return only valid JSON.",
        user=prompt,
    )

    try:
        result = json.loads(response.text)
        if isinstance(result, dict) and "label" in result:
            return result
    except (json.JSONDecodeError, AttributeError):
        pass

    return {"label": "neutral", "score": 0.5, "tone": 0.0}


def _sentiment_rules(text: str) -> dict:
    """Rule-based sentiment as last resort."""
    text_lower = text.lower()

    positive_words = {
        "growth", "profit", "gain", "surge", "rally", "bullish", "upgrade",
        "strong", "beat", "record", "outperform", "increase", "rise", "boom",
    }
    negative_words = {
        "loss", "decline", "drop", "crash", "bearish", "downgrade", "weak",
        "miss", "fall", "plunge", "risk", "cut", "layoff", "recession",
    }

    words = set(text_lower.split())
    pos_count = len(words & positive_words)
    neg_count = len(words & negative_words)
    total = pos_count + neg_count

    if total == 0:
        return {"label": "neutral", "score": 0.5, "tone": 0.0}

    if pos_count > neg_count:
        score = pos_count / total
        return {"label": "positive", "score": round(score, 4), "tone": round(score, 4)}
    elif neg_count > pos_count:
        score = neg_count / total
        return {"label": "negative", "score": round(score, 4), "tone": round(-score, 4)}
    else:
        return {"label": "neutral", "score": 0.5, "tone": 0.0}


# ---------------------------------------------------------------------------
# Batch operations
# ---------------------------------------------------------------------------

def batch_extract_entities(texts: list[str]) -> list[list[dict]]:
    """Batch NER extraction."""
    if _check_modal():
        try:
            from modal import Cls
            NERModel = Cls.lookup("eugene-inference", "NERModel")
            model = NERModel()
            return model.batch_extract.remote(texts)
        except Exception:
            pass
    return [extract_entities(t) for t in texts]


def batch_classify_sentiment(texts: list[str]) -> list[dict]:
    """Batch sentiment classification."""
    if _check_modal():
        try:
            from modal import Cls
            SentimentModel = Cls.lookup("eugene-inference", "SentimentModel")
            model = SentimentModel()
            return model.batch_classify.remote(texts)
        except Exception:
            pass
    return [classify_sentiment(t) for t in texts]
