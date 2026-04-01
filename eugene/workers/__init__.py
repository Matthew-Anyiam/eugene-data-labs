"""
Eugene Intelligence — Real-time ingestion workers.

Celery + Redis for async background processing of data sources.

Requires:
  - celery[redis] package
  - REDIS_URL env var (defaults to redis://localhost:6379/0)
"""
