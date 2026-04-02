"""
Celery application configuration for Eugene Intelligence.

Usage:
  celery -A eugene.workers.celery_app worker --loglevel=info
  celery -A eugene.workers.celery_app beat --loglevel=info

Environment:
  REDIS_URL — Redis connection string (default: redis://localhost:6379/0)
"""

import os

from celery import Celery
from celery.schedules import crontab

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

app = Celery(
    "eugene",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["eugene.workers.tasks"],
)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_soft_time_limit=120,
    task_time_limit=300,
    worker_max_tasks_per_child=100,
    task_default_rate_limit="10/m",
)

app.conf.beat_schedule = {
    "ingest-news-15m": {
        "task": "eugene.workers.tasks.ingest_news_signals",
        "schedule": 900.0,  # 15 minutes
    },
    "sync-sanctions-daily": {
        "task": "eugene.workers.tasks.sync_sanctions",
        "schedule": crontab(hour=6, minute=0),
    },
    "ingest-disasters-30m": {
        "task": "eugene.workers.tasks.ingest_disaster_signals",
        "schedule": 1800.0,  # 30 minutes
    },
    "ingest-conflict-hourly": {
        "task": "eugene.workers.tasks.ingest_conflict_signals",
        "schedule": 3600.0,
    },
    "ingest-ports-hourly": {
        "task": "eugene.workers.tasks.ingest_port_signals",
        "schedule": 3600.0,
    },
    "ingest-sec-2h": {
        "task": "eugene.workers.tasks.ingest_sec_signals",
        "schedule": 7200.0,
    },
    "ingest-economics-6h": {
        "task": "eugene.workers.tasks.ingest_economic_signals",
        "schedule": 21600.0,
    },
    "delta-sweep-30m": {
        "task": "eugene.workers.tasks.run_delta_sweep",
        "schedule": 1800.0,  # 30 minutes — runs after data ingestion tasks
    },
    "cleanup-weekly": {
        "task": "eugene.workers.tasks.cleanup_old_signals",
        "schedule": crontab(hour=3, minute=0, day_of_week="sunday"),
    },
}
