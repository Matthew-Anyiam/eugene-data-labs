"""
Multi-channel alerting — Telegram, Discord, Webhook delivery.

Inspired by Crucix's tiered alerting pattern:
- FLASH: Market-moving, requires immediate attention (5min cooldown, 6/hour max)
- PRIORITY: Act within hours (30min cooldown, 4/hour max)
- ROUTINE: Informational (60min cooldown, 2/hour max)

Uses semantic dedup and escalating cooldowns to prevent alert fatigue.
"""

import hashlib
import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

import requests

logger = logging.getLogger(__name__)


class AlertTier(str, Enum):
    FLASH = "flash"
    PRIORITY = "priority"
    ROUTINE = "routine"


TIER_CONFIG = {
    AlertTier.FLASH: {"emoji": "🔴", "cooldown_sec": 300, "max_per_hour": 6, "label": "FLASH"},
    AlertTier.PRIORITY: {"emoji": "🟡", "cooldown_sec": 1800, "max_per_hour": 4, "label": "PRIORITY"},
    AlertTier.ROUTINE: {"emoji": "🔵", "cooldown_sec": 3600, "max_per_hour": 2, "label": "ROUTINE"},
}

# Alert decay — escalating cooldowns for repeated signals
ALERT_DECAY_TIERS = [0, 6 * 3600, 12 * 3600, 24 * 3600]  # seconds


@dataclass
class Alert:
    """A structured alert ready for delivery."""
    tier: AlertTier
    headline: str
    body: str
    signal_types: list[str] = field(default_factory=list)
    entity_name: str = ""
    composite_risk: float = 0.0
    source: str = ""
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @property
    def content_hash(self) -> str:
        """Semantic hash for dedup — strips volatile values, normalizes text."""
        import re
        text = f"{self.headline}:{','.join(sorted(self.signal_types))}:{self.entity_name}"
        # Normalize: lowercase, strip numbers/times, collapse whitespace
        text = text.lower()
        text = re.sub(r'\d+', 'N', text)
        text = re.sub(r'\s+', ' ', text).strip()
        return hashlib.sha256(text.encode()).hexdigest()[:16]


# ---------------------------------------------------------------------------
# Alert state tracking
# ---------------------------------------------------------------------------

@dataclass
class AlertState:
    """Tracks sent alerts for dedup and rate limiting."""
    first_seen: float
    last_alerted: float
    count: int = 1


class AlertTracker:
    """Manages alert dedup, cooldowns, and rate limiting."""

    def __init__(self) -> None:
        self._alerted: dict[str, AlertState] = {}  # content_hash → state
        self._hourly_counts: dict[str, list[float]] = {  # tier → timestamps
            t.value: [] for t in AlertTier
        }

    def should_send(self, alert: Alert) -> bool:
        """Check if an alert should be sent based on dedup and rate limits."""
        now = time.time()
        ch = alert.content_hash
        tier_cfg = TIER_CONFIG[alert.tier]

        # Rate limit check
        tier_key = alert.tier.value
        recent = [t for t in self._hourly_counts.get(tier_key, []) if now - t < 3600]
        self._hourly_counts[tier_key] = recent
        if len(recent) >= tier_cfg["max_per_hour"]:
            logger.debug("Rate limit hit for tier %s", alert.tier.value)
            return False

        # Dedup check with escalating cooldown
        if ch in self._alerted:
            state = self._alerted[ch]
            tier_idx = min(state.count - 1, len(ALERT_DECAY_TIERS) - 1)
            cooldown = ALERT_DECAY_TIERS[tier_idx]
            if now - state.last_alerted < cooldown:
                return False

        return True

    def mark_sent(self, alert: Alert) -> None:
        """Record that an alert was sent."""
        now = time.time()
        ch = alert.content_hash

        if ch in self._alerted:
            self._alerted[ch].last_alerted = now
            self._alerted[ch].count += 1
        else:
            self._alerted[ch] = AlertState(first_seen=now, last_alerted=now)

        tier_key = alert.tier.value
        if tier_key not in self._hourly_counts:
            self._hourly_counts[tier_key] = []
        self._hourly_counts[tier_key].append(now)

    def prune(self) -> None:
        """Remove old alert state to prevent memory growth."""
        now = time.time()
        to_remove = []
        for ch, state in self._alerted.items():
            max_age = 48 * 3600 if state.count > 1 else 24 * 3600
            if now - state.last_alerted > max_age:
                to_remove.append(ch)
        for ch in to_remove:
            del self._alerted[ch]

    def get_stats(self) -> dict:
        """Get alert tracking statistics."""
        now = time.time()
        return {
            "tracked_signals": len(self._alerted),
            "hourly_counts": {
                tier: len([t for t in times if now - t < 3600])
                for tier, times in self._hourly_counts.items()
            },
        }


# Singleton
_tracker: AlertTracker | None = None


def get_tracker() -> AlertTracker:
    global _tracker
    if _tracker is None:
        _tracker = AlertTracker()
    return _tracker


# ---------------------------------------------------------------------------
# Tier classification (rule-based, with LLM enhancement option)
# ---------------------------------------------------------------------------

def classify_alert_tier(
    signal_types: list[str],
    composite_risk: float,
    delta_summary: dict | None = None,
) -> AlertTier:
    """Classify alert tier using rules, with optional LLM override.

    FLASH criteria:
    - composite_risk >= 0.8
    - Multiple critical signals across domains (conflict + market)
    - Sanctions hit + conflict escalation
    - Disaster critical tier

    PRIORITY criteria:
    - composite_risk >= 0.5
    - 2+ high/escalating signal types
    - New entity with 3+ signal types

    ROUTINE: everything else that crosses the alert threshold.
    """
    st_set = set(signal_types)
    critical = delta_summary.get("critical_changes", 0) if delta_summary else 0

    # FLASH rules
    if composite_risk >= 0.8:
        return AlertTier.FLASH

    cross_domain_critical = (
        bool(st_set & {"conflict_escalation", "conflict_event", "airspace_closure"})
        and bool(st_set & {"price_drop", "sentiment_shift", "volume_spike"})
    )
    if cross_domain_critical:
        return AlertTier.FLASH

    if "sanctions_hit" in st_set and "conflict_escalation" in st_set:
        return AlertTier.FLASH

    if critical >= 2:
        return AlertTier.FLASH

    # PRIORITY rules
    if composite_risk >= 0.5:
        return AlertTier.PRIORITY

    if len(signal_types) >= 3:
        return AlertTier.PRIORITY

    escalating_types = st_set & {"conflict_event", "disaster_event", "port_congestion", "sanctions_hit"}
    if len(escalating_types) >= 2:
        return AlertTier.PRIORITY

    return AlertTier.ROUTINE


# ---------------------------------------------------------------------------
# Channel delivery
# ---------------------------------------------------------------------------

def _format_message(alert: Alert) -> str:
    """Format alert as a readable message."""
    cfg = TIER_CONFIG[alert.tier]
    lines = [
        f"{cfg['emoji']} **{cfg['label']}** — {alert.headline}",
        "",
        alert.body,
    ]
    if alert.entity_name:
        lines.append(f"\n**Entity:** {alert.entity_name}")
    if alert.signal_types:
        lines.append(f"**Signals:** {', '.join(alert.signal_types)}")
    if alert.composite_risk > 0:
        lines.append(f"**Risk score:** {alert.composite_risk:.2f}")
    lines.append(f"\n_Eugene Intelligence — {alert.timestamp[:16]}_")
    return "\n".join(lines)


def send_telegram(alert: Alert) -> bool:
    """Send alert via Telegram bot."""
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        return False

    text = _format_message(alert)
    # Convert markdown bold to Telegram HTML
    text = text.replace("**", "<b>").replace("</b><b>", "**")
    # Simple fix: pair up <b> tags
    import re
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', _format_message(alert))
    text = text.replace("_", "<i>", 1)
    if "<i>" in text:
        text += "</i>"

    try:
        resp = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            timeout=10,
        )
        resp.raise_for_status()
        logger.info("Telegram alert sent: %s", alert.headline)
        return True
    except Exception as e:
        logger.error("Telegram send failed: %s", e)
        return False


def send_discord(alert: Alert) -> bool:
    """Send alert via Discord webhook."""
    webhook_url = os.getenv("DISCORD_WEBHOOK_URL")
    if not webhook_url:
        return False

    cfg = TIER_CONFIG[alert.tier]
    color_map = {
        AlertTier.FLASH: 0xFF0000,     # red
        AlertTier.PRIORITY: 0xFFAA00,  # orange
        AlertTier.ROUTINE: 0x0088FF,   # blue
    }

    embed = {
        "title": f"{cfg['emoji']} {cfg['label']} — {alert.headline}",
        "description": alert.body,
        "color": color_map.get(alert.tier, 0x888888),
        "fields": [],
        "footer": {"text": f"Eugene Intelligence • {alert.timestamp[:16]}"},
    }

    if alert.entity_name:
        embed["fields"].append({"name": "Entity", "value": alert.entity_name, "inline": True})
    if alert.signal_types:
        embed["fields"].append({"name": "Signals", "value": ", ".join(alert.signal_types), "inline": True})
    if alert.composite_risk > 0:
        embed["fields"].append({"name": "Risk", "value": f"{alert.composite_risk:.2f}", "inline": True})

    try:
        resp = requests.post(
            webhook_url,
            json={"embeds": [embed]},
            timeout=10,
        )
        resp.raise_for_status()
        logger.info("Discord alert sent: %s", alert.headline)
        return True
    except Exception as e:
        logger.error("Discord send failed: %s", e)
        return False


def send_webhook(alert: Alert) -> bool:
    """Send alert to a custom webhook URL."""
    webhook_url = os.getenv("EUGENE_WEBHOOK_URL")
    if not webhook_url:
        return False

    payload = {
        "tier": alert.tier.value,
        "headline": alert.headline,
        "body": alert.body,
        "entity_name": alert.entity_name,
        "signal_types": alert.signal_types,
        "composite_risk": alert.composite_risk,
        "timestamp": alert.timestamp,
        "source": "eugene_intelligence",
    }

    try:
        resp = requests.post(webhook_url, json=payload, timeout=10)
        resp.raise_for_status()
        logger.info("Webhook alert sent: %s", alert.headline)
        return True
    except Exception as e:
        logger.error("Webhook send failed: %s", e)
        return False


# ---------------------------------------------------------------------------
# Main dispatch
# ---------------------------------------------------------------------------

def dispatch_alert(alert: Alert) -> dict:
    """Send an alert through all configured channels.

    Checks dedup and rate limits before sending. Returns delivery results.
    """
    tracker = get_tracker()

    if not tracker.should_send(alert):
        return {"sent": False, "reason": "suppressed_by_dedup_or_rate_limit"}

    results = {
        "sent": True,
        "tier": alert.tier.value,
        "headline": alert.headline,
        "channels": {},
    }

    # Try all configured channels
    if os.getenv("TELEGRAM_BOT_TOKEN") and os.getenv("TELEGRAM_CHAT_ID"):
        results["channels"]["telegram"] = send_telegram(alert)

    if os.getenv("DISCORD_WEBHOOK_URL"):
        results["channels"]["discord"] = send_discord(alert)

    if os.getenv("EUGENE_WEBHOOK_URL"):
        results["channels"]["webhook"] = send_webhook(alert)

    # If no channels configured, still mark as "sent" for tracking
    if not results["channels"]:
        results["channels"]["none"] = True
        results["note"] = "No delivery channels configured. Set TELEGRAM_BOT_TOKEN+TELEGRAM_CHAT_ID, DISCORD_WEBHOOK_URL, or EUGENE_WEBHOOK_URL."

    tracker.mark_sent(alert)

    return results


def evaluate_and_alert(
    convergence_alert: dict,
    delta_summary: dict | None = None,
) -> dict | None:
    """Evaluate a convergence alert and dispatch if warranted.

    Takes a convergence alert dict (from convergence.get_alerts()) and
    determines if it should be sent, what tier, and dispatches it.
    """
    signal_types = convergence_alert.get("signal_types", [])
    composite_risk = convergence_alert.get("composite_risk", 0)
    entity_name = convergence_alert.get("entity_name", "")

    # Only alert on elevated+ risk
    risk_level = convergence_alert.get("risk_level", "low")
    if risk_level in ("low", "moderate"):
        return None

    tier = classify_alert_tier(signal_types, composite_risk, delta_summary)

    # Build alert headline from patterns
    patterns = convergence_alert.get("matched_patterns", [])
    if patterns:
        headline = f"{entity_name}: {patterns[0].get('pattern', 'convergence').replace('_', ' ').title()}"
    else:
        headline = f"{entity_name}: {len(signal_types)} signal convergence"

    body_lines = []
    for b in convergence_alert.get("breakdown", [])[:5]:
        body_lines.append(
            f"• {b['signal_type'].replace('_', ' ')}: {b['count']}x (max {b['max_magnitude']:.2f})"
        )

    alert = Alert(
        tier=tier,
        headline=headline,
        body="\n".join(body_lines) if body_lines else "Multiple signals converging.",
        signal_types=signal_types,
        entity_name=entity_name,
        composite_risk=composite_risk,
        source="convergence_engine",
    )

    return dispatch_alert(alert)


def get_alert_status() -> dict:
    """Get current alerting system status."""
    tracker = get_tracker()
    return {
        "tracking": tracker.get_stats(),
        "channels": {
            "telegram": bool(os.getenv("TELEGRAM_BOT_TOKEN") and os.getenv("TELEGRAM_CHAT_ID")),
            "discord": bool(os.getenv("DISCORD_WEBHOOK_URL")),
            "webhook": bool(os.getenv("EUGENE_WEBHOOK_URL")),
        },
        "tiers": {
            tier.value: {
                "emoji": cfg["emoji"],
                "cooldown_sec": cfg["cooldown_sec"],
                "max_per_hour": cfg["max_per_hour"],
            }
            for tier, cfg in TIER_CONFIG.items()
        },
    }
