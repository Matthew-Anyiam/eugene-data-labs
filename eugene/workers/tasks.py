"""
Celery tasks for Eugene Intelligence real-time ingestion.

Each task ingests data from a specific source category and feeds
signals into the ontology for convergence analysis.
"""

import logging

from eugene.workers.celery_app import app

logger = logging.getLogger(__name__)


@app.task(bind=True, max_retries=3, default_retry_delay=60)
def ingest_news_signals(self):
    """Ingest news signals from GDELT every 15 minutes."""
    try:
        from eugene.world.news import get_feed
        from eugene.ontology.signals import record_signal

        feed = get_feed(timespan="1h", limit=50)
        articles = feed.get("articles", [])
        count = 0
        for article in articles:
            title = article.get("title", "")
            tone = article.get("tone", 0)
            if abs(tone) > 3:
                record_signal(
                    entity_id=article.get("source_country", "GLOBAL"),
                    signal_type="news_sentiment",
                    magnitude=tone / 10.0,
                    metadata={"title": title[:200], "source": "gdelt"},
                )
                count += 1
        logger.info("Ingested %d news signals from %d articles", count, len(articles))
        return {"ingested": count, "total": len(articles)}
    except Exception as exc:
        logger.warning("News ingestion failed: %s", exc)
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=2, default_retry_delay=300)
def sync_sanctions(self):
    """Screen tracked entities against sanctions lists. Runs daily."""
    try:
        from eugene.world.sanctions_intel import screen
        from eugene.ontology.entities import list_entities
        from eugene.ontology.signals import record_signal

        entities = list_entities(entity_type="company", limit=500)
        count = 0
        for entity in entities:
            name = entity.get("name", "")
            if not name:
                continue
            result = screen(name, threshold=0.85)
            matches = result.get("matches", [])
            if matches:
                record_signal(
                    entity_id=entity["id"],
                    signal_type="sanctions_match",
                    magnitude=len(matches) / 10.0,
                    metadata={"matches": len(matches), "top_match": matches[0].get("name", "")},
                )
                count += 1
        logger.info("Sanctions sync complete: %d matches across %d entities", count, len(entities))
        return {"matches": count, "screened": len(entities)}
    except Exception as exc:
        logger.warning("Sanctions sync failed: %s", exc)
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=3, default_retry_delay=60)
def ingest_disaster_signals(self):
    """Ingest disaster signals from USGS + GDACS every 30 minutes."""
    try:
        from eugene.world.disasters_intel import get_active
        from eugene.ontology.signals import record_signal

        result = get_active(days=1)
        events = result.get("events", [])
        count = 0
        for event in events:
            severity = event.get("severity", 0)
            if severity >= 3:
                record_signal(
                    entity_id=event.get("location", "UNKNOWN"),
                    signal_type="disaster_event",
                    magnitude=severity / 10.0,
                    metadata={
                        "type": event.get("type", "unknown"),
                        "title": event.get("title", "")[:200],
                    },
                )
                count += 1
        logger.info("Ingested %d disaster signals from %d events", count, len(events))
        return {"ingested": count, "total": len(events)}
    except Exception as exc:
        logger.warning("Disaster ingestion failed: %s", exc)
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=3, default_retry_delay=60)
def ingest_conflict_signals(self):
    """Ingest conflict signals from UCDP hourly."""
    try:
        from eugene.world.conflict_intel import get_events
        from eugene.ontology.signals import record_signal

        result = get_events(limit=50)
        events = result.get("events", [])
        count = 0
        for event in events:
            record_signal(
                entity_id=event.get("country", "UNKNOWN"),
                signal_type="conflict_event",
                magnitude=event.get("best_estimate", 1) / 100.0,
                metadata={
                    "type": event.get("type_of_violence", ""),
                    "location": event.get("where_description", ""),
                },
            )
            count += 1
        logger.info("Ingested %d conflict signals", count)
        return {"ingested": count}
    except Exception as exc:
        logger.warning("Conflict ingestion failed: %s", exc)
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=3, default_retry_delay=60)
def ingest_port_signals(self):
    """Ingest port congestion signals hourly."""
    try:
        from eugene.world.supply_chain_intel import get_ports
        from eugene.ontology.signals import record_signal

        result = get_ports(limit=50)
        ports = result.get("ports", [])
        count = 0
        for port in ports:
            risk = port.get("risk_score", 0)
            if risk > 0.3:
                record_signal(
                    entity_id=port.get("port_code", port.get("name", "UNKNOWN")),
                    signal_type="port_congestion",
                    magnitude=risk,
                    metadata={"name": port.get("name", ""), "country": port.get("country", "")},
                )
                count += 1
        logger.info("Ingested %d port signals from %d ports", count, len(ports))
        return {"ingested": count, "total": len(ports)}
    except Exception as exc:
        logger.warning("Port ingestion failed: %s", exc)
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=2, default_retry_delay=300)
def ingest_sec_signals(self):
    """Re-ingest SEC data for tracked companies every 2 hours."""
    try:
        from eugene.ontology.ingest import ingest_company
        from eugene.ontology.entities import list_entities

        entities = list_entities(entity_type="company", limit=100)
        count = 0
        for entity in entities:
            ticker = entity.get("ticker")
            if ticker:
                try:
                    ingest_company(ticker)
                    count += 1
                except Exception as e:
                    logger.warning("SEC ingest failed for %s: %s", ticker, e)
        logger.info("Re-ingested SEC data for %d companies", count)
        return {"ingested": count}
    except Exception as exc:
        logger.warning("SEC ingestion failed: %s", exc)
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=2, default_retry_delay=600)
def ingest_economic_signals(self):
    """Ingest FRED economic indicators every 6 hours."""
    try:
        from eugene.sources.fred import get_series
        from eugene.ontology.signals import record_signal

        key_series = [
            ("FEDFUNDS", "fed_funds_rate"),
            ("UNRATE", "unemployment_rate"),
            ("CPIAUCSL", "cpi"),
            ("GDP", "gdp"),
            ("T10Y2Y", "yield_curve"),
        ]
        count = 0
        for series_id, signal_type in key_series:
            try:
                data = get_series(series_id)
                observations = data.get("observations", [])
                if observations:
                    latest = observations[-1]
                    value = float(latest.get("value", 0))
                    record_signal(
                        entity_id="US_ECONOMY",
                        signal_type=signal_type,
                        magnitude=value,
                        metadata={"series_id": series_id, "date": latest.get("date", "")},
                    )
                    count += 1
            except Exception as e:
                logger.warning("FRED ingest failed for %s: %s", series_id, e)
        logger.info("Ingested %d economic signals", count)
        return {"ingested": count}
    except Exception as exc:
        logger.warning("Economic ingestion failed: %s", exc)
        raise self.retry(exc=exc)


@app.task
def cleanup_old_signals():
    """Delete signals older than 90 days. Runs weekly."""
    try:
        from eugene.ontology.signals import cleanup_signals
        deleted = cleanup_signals(days=90)
        logger.info("Cleaned up %d old signals", deleted)
        return {"deleted": deleted}
    except Exception as exc:
        logger.warning("Signal cleanup failed: %s", exc)
        return {"error": str(exc)}


@app.task(bind=True, max_retries=2, default_retry_delay=30)
def ingest_company_task(self, ticker: str):
    """On-demand company ingestion task."""
    try:
        from eugene.ontology.ingest import ingest_company
        result = ingest_company(ticker)
        return result
    except Exception as exc:
        logger.warning("Company ingest failed for %s: %s", ticker, exc)
        raise self.retry(exc=exc)


@app.task
def ingest_batch_task(tickers: list):
    """Batch company ingestion."""
    results = {}
    for ticker in tickers:
        try:
            ingest_company_task.delay(ticker)
            results[ticker] = "queued"
        except Exception as e:
            results[ticker] = f"error: {e}"
    return results
