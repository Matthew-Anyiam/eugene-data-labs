"""
Eugene Data Labs - Credit Monitoring Agent

Monitors companies for credit-relevant events and generates alerts.

Watches for:
- Covenant breaches or near-breaches
- Significant debt changes
- Insider selling (bearish signal)
- Material 8-K events (M&A, earnings, management)
- Rating changes
- Leverage ratio changes

This is the core intelligence layer that turns data into actionable signals.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import json
from pathlib import Path


class AlertSeverity(Enum):
    """Alert severity levels"""
    CRITICAL = "critical"  # Immediate attention needed
    HIGH = "high"          # Important, review soon
    MEDIUM = "medium"      # Notable, monitor
    LOW = "low"            # Informational


class AlertType(Enum):
    """Types of credit alerts"""
    COVENANT_BREACH = "covenant_breach"
    COVENANT_WARNING = "covenant_warning"
    DEBT_INCREASE = "debt_increase"
    DEBT_DECREASE = "debt_decrease"
    LEVERAGE_SPIKE = "leverage_spike"
    INSIDER_SELLING = "insider_selling"
    INSIDER_BUYING = "insider_buying"
    MANAGEMENT_CHANGE = "management_change"
    MATERIAL_EVENT = "material_event"
    EARNINGS_MISS = "earnings_miss"
    EARNINGS_BEAT = "earnings_beat"
    ACTIVIST_INVESTOR = "activist_investor"
    RATING_DOWNGRADE = "rating_downgrade"
    RATING_UPGRADE = "rating_upgrade"


@dataclass
class CreditAlert:
    """A single credit monitoring alert"""
    alert_id: str
    ticker: str
    company_name: str
    alert_type: str
    severity: str
    headline: str
    summary: str
    data: Dict[str, Any]
    source_filing: str
    filing_date: str
    created_at: str
    read: bool = False
    dismissed: bool = False


@dataclass
class CompanyProfile:
    """Credit profile for a monitored company"""
    ticker: str
    company_name: str
    
    # Current metrics
    total_debt: float
    net_debt: float
    leverage_ratio: float
    interest_coverage: float
    
    # Covenant status
    covenants: List[Dict[str, Any]]
    covenant_cushion_min: float  # Smallest cushion
    
    # Recent activity
    last_filing_date: str
    insider_sentiment: str  # bullish, bearish, neutral
    recent_alerts: List[str]
    
    # Watchlist settings
    watching: bool = True
    alert_threshold: str = "medium"  # minimum severity to alert


class CreditMonitorAgent:
    """
    Main Credit Monitoring Agent
    
    Monitors companies and generates alerts for credit-relevant events.
    """
    
    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.alerts_file = self.data_dir / "alerts" / "alerts.json"
        self.watchlist_file = self.data_dir / "watchlist" / "companies.json"
        self.alerts: List[CreditAlert] = []
        self.watchlist: Dict[str, CompanyProfile] = {}
        
        # Create directories
        (self.data_dir / "alerts").mkdir(parents=True, exist_ok=True)
        (self.data_dir / "watchlist").mkdir(parents=True, exist_ok=True)
        
        # Load existing data
        self._load_alerts()
        self._load_watchlist()
    
    def _load_alerts(self):
        """Load existing alerts from file"""
        if self.alerts_file.exists():
            with open(self.alerts_file) as f:
                data = json.load(f)
                self.alerts = [CreditAlert(**a) for a in data]
    
    def _save_alerts(self):
        """Save alerts to file"""
        with open(self.alerts_file, "w") as f:
            json.dump([a.__dict__ for a in self.alerts], f, indent=2)
    
    def _load_watchlist(self):
        """Load watchlist from file"""
        if self.watchlist_file.exists():
            with open(self.watchlist_file) as f:
                data = json.load(f)
                self.watchlist = {k: CompanyProfile(**v) for k, v in data.items()}
    
    def _save_watchlist(self):
        """Save watchlist to file"""
        with open(self.watchlist_file, "w") as f:
            json.dump({k: v.__dict__ for k, v in self.watchlist.items()}, f, indent=2)
    
    def _generate_alert_id(self) -> str:
        """Generate unique alert ID"""
        return f"alert_{datetime.now().strftime('%Y%m%d%H%M%S')}_{len(self.alerts)}"
    
    def add_to_watchlist(self, profile: CompanyProfile):
        """Add company to watchlist"""
        self.watchlist[profile.ticker] = profile
        self._save_watchlist()
        print(f"✓ Added {profile.ticker} to watchlist")
    
    def remove_from_watchlist(self, ticker: str):
        """Remove company from watchlist"""
        if ticker in self.watchlist:
            del self.watchlist[ticker]
            self._save_watchlist()
            print(f"✓ Removed {ticker} from watchlist")
    
    def create_alert(
        self,
        ticker: str,
        company_name: str,
        alert_type: AlertType,
        severity: AlertSeverity,
        headline: str,
        summary: str,
        data: Dict[str, Any],
        source_filing: str,
        filing_date: str
    ) -> CreditAlert:
        """Create and store a new alert"""
        alert = CreditAlert(
            alert_id=self._generate_alert_id(),
            ticker=ticker,
            company_name=company_name,
            alert_type=alert_type.value,
            severity=severity.value,
            headline=headline,
            summary=summary,
            data=data,
            source_filing=source_filing,
            filing_date=filing_date,
            created_at=datetime.now().isoformat()
        )
        
        self.alerts.append(alert)
        self._save_alerts()
        
        # Update company profile if on watchlist
        if ticker in self.watchlist:
            self.watchlist[ticker].recent_alerts.append(alert.alert_id)
            self._save_watchlist()
        
        return alert
    
    # =========================================================================
    # MONITORING FUNCTIONS
    # =========================================================================
    
    def check_covenant_status(self, extraction: Dict[str, Any]) -> List[CreditAlert]:
        """Check covenant compliance and generate alerts"""
        alerts = []
        ticker = extraction.get("ticker", "")
        company_name = extraction.get("company_name", "")
        
        covenants = extraction.get("data", {}).get("covenants", [])
        
        for covenant in covenants:
            name = covenant.get("covenant_name", "Unknown")
            threshold = covenant.get("threshold_value", 0)
            current = covenant.get("current_value", 0)
            direction = covenant.get("threshold_direction", "max")
            in_compliance = covenant.get("in_compliance", True)
            
            # Calculate cushion
            if direction == "max" and threshold > 0:
                cushion = (threshold - current) / threshold * 100
            elif direction == "min" and current > 0:
                cushion = (current - threshold) / current * 100
            else:
                cushion = 100
            
            # Check for breach
            if not in_compliance:
                alert = self.create_alert(
                    ticker=ticker,
                    company_name=company_name,
                    alert_type=AlertType.COVENANT_BREACH,
                    severity=AlertSeverity.CRITICAL,
                    headline=f"COVENANT BREACH: {name}",
                    summary=f"{company_name} has breached the {name} covenant. "
                            f"Current: {current:.2f}x, Threshold: {direction} {threshold:.2f}x",
                    data=covenant,
                    source_filing=extraction.get("filing_type", "10-K"),
                    filing_date=extraction.get("filing_date", "")
                )
                alerts.append(alert)
            
            # Check for warning (cushion < 20%)
            elif cushion < 20:
                alert = self.create_alert(
                    ticker=ticker,
                    company_name=company_name,
                    alert_type=AlertType.COVENANT_WARNING,
                    severity=AlertSeverity.HIGH,
                    headline=f"Covenant Warning: {name} ({cushion:.1f}% cushion)",
                    summary=f"{company_name} is approaching {name} threshold. "
                            f"Current: {current:.2f}x, Threshold: {direction} {threshold:.2f}x, "
                            f"Only {cushion:.1f}% cushion remaining.",
                    data={**covenant, "cushion_pct": cushion},
                    source_filing=extraction.get("filing_type", "10-K"),
                    filing_date=extraction.get("filing_date", "")
                )
                alerts.append(alert)
        
        return alerts
    
    def check_debt_changes(
        self, 
        ticker: str,
        company_name: str,
        current_debt: float,
        previous_debt: float,
        filing_type: str,
        filing_date: str
    ) -> Optional[CreditAlert]:
        """Check for significant debt changes"""
        if previous_debt == 0:
            return None
        
        change_pct = (current_debt - previous_debt) / previous_debt * 100
        
        # Significant increase (>20%)
        if change_pct > 20:
            return self.create_alert(
                ticker=ticker,
                company_name=company_name,
                alert_type=AlertType.DEBT_INCREASE,
                severity=AlertSeverity.HIGH if change_pct > 50 else AlertSeverity.MEDIUM,
                headline=f"Debt Increased {change_pct:.1f}%",
                summary=f"{company_name} total debt increased from ${previous_debt:,.0f}M "
                        f"to ${current_debt:,.0f}M ({change_pct:+.1f}%)",
                data={
                    "previous_debt": previous_debt,
                    "current_debt": current_debt,
                    "change_pct": change_pct
                },
                source_filing=filing_type,
                filing_date=filing_date
            )
        
        # Significant decrease (>20%) - positive signal
        elif change_pct < -20:
            return self.create_alert(
                ticker=ticker,
                company_name=company_name,
                alert_type=AlertType.DEBT_DECREASE,
                severity=AlertSeverity.LOW,
                headline=f"Debt Decreased {abs(change_pct):.1f}%",
                summary=f"{company_name} total debt decreased from ${previous_debt:,.0f}M "
                        f"to ${current_debt:,.0f}M ({change_pct:+.1f}%)",
                data={
                    "previous_debt": previous_debt,
                    "current_debt": current_debt,
                    "change_pct": change_pct
                },
                source_filing=filing_type,
                filing_date=filing_date
            )
        
        return None
    
    def check_insider_activity(
        self,
        ticker: str,
        company_name: str,
        form4_data: Dict[str, Any]
    ) -> Optional[CreditAlert]:
        """Check Form 4 filings for significant insider activity"""
        insider_name = form4_data.get("insider_name", "Unknown")
        transaction_type = form4_data.get("transaction_type", "")
        shares = form4_data.get("shares", 0)
        value = form4_data.get("value", 0)
        
        # Significant selling (>$1M)
        if transaction_type.lower() == "sale" and value > 1_000_000:
            return self.create_alert(
                ticker=ticker,
                company_name=company_name,
                alert_type=AlertType.INSIDER_SELLING,
                severity=AlertSeverity.MEDIUM,
                headline=f"Insider Sale: {insider_name} sold ${value/1e6:.1f}M",
                summary=f"{insider_name} sold {shares:,} shares of {ticker} "
                        f"worth ${value/1e6:.1f}M",
                data=form4_data,
                source_filing="Form 4",
                filing_date=form4_data.get("filing_date", "")
            )
        
        # Significant buying (>$500K) - positive signal
        elif transaction_type.lower() == "purchase" and value > 500_000:
            return self.create_alert(
                ticker=ticker,
                company_name=company_name,
                alert_type=AlertType.INSIDER_BUYING,
                severity=AlertSeverity.LOW,
                headline=f"Insider Purchase: {insider_name} bought ${value/1e6:.1f}M",
                summary=f"{insider_name} purchased {shares:,} shares of {ticker} "
                        f"worth ${value/1e6:.1f}M",
                data=form4_data,
                source_filing="Form 4",
                filing_date=form4_data.get("filing_date", "")
            )
        
        return None
    
    def check_8k_events(
        self,
        ticker: str,
        company_name: str,
        form8k_data: Dict[str, Any]
    ) -> List[CreditAlert]:
        """Check 8-K filings for material events"""
        alerts = []
        events = form8k_data.get("events", [])
        
        for event in events:
            item_code = event.get("item_code", "")
            headline = event.get("headline", "")
            materiality = event.get("materiality", "low")
            sentiment = event.get("sentiment", "neutral")
            
            # High materiality events
            if materiality == "high":
                severity = AlertSeverity.HIGH
            elif materiality == "medium":
                severity = AlertSeverity.MEDIUM
            else:
                continue  # Skip low materiality
            
            # Management changes (5.02)
            if item_code == "5.02":
                alert = self.create_alert(
                    ticker=ticker,
                    company_name=company_name,
                    alert_type=AlertType.MANAGEMENT_CHANGE,
                    severity=severity,
                    headline=f"Management Change: {headline}",
                    summary=event.get("summary", ""),
                    data=event,
                    source_filing="8-K",
                    filing_date=form8k_data.get("filed_date", "")
                )
                alerts.append(alert)
            
            # Earnings (2.02)
            elif item_code == "2.02":
                alert_type = AlertType.EARNINGS_BEAT if sentiment == "positive" else AlertType.EARNINGS_MISS
                alert = self.create_alert(
                    ticker=ticker,
                    company_name=company_name,
                    alert_type=alert_type,
                    severity=severity,
                    headline=headline,
                    summary=event.get("summary", ""),
                    data=event,
                    source_filing="8-K",
                    filing_date=form8k_data.get("filed_date", "")
                )
                alerts.append(alert)
            
            # Other material events
            else:
                alert = self.create_alert(
                    ticker=ticker,
                    company_name=company_name,
                    alert_type=AlertType.MATERIAL_EVENT,
                    severity=severity,
                    headline=headline,
                    summary=event.get("summary", ""),
                    data=event,
                    source_filing="8-K",
                    filing_date=form8k_data.get("filed_date", "")
                )
                alerts.append(alert)
        
        return alerts
    
    def check_activist_investor(
        self,
        ticker: str,
        company_name: str,
        form13d_data: Dict[str, Any]
    ) -> Optional[CreditAlert]:
        """Check 13D filings for activist investors"""
        filer_name = form13d_data.get("filer_name", "Unknown")
        percent_owned = form13d_data.get("percent_of_class", 0)
        purpose = form13d_data.get("purpose", "")
        
        return self.create_alert(
            ticker=ticker,
            company_name=company_name,
            alert_type=AlertType.ACTIVIST_INVESTOR,
            severity=AlertSeverity.HIGH,
            headline=f"Activist Alert: {filer_name} owns {percent_owned:.1f}%",
            summary=f"{filer_name} filed Schedule 13D disclosing {percent_owned:.1f}% "
                    f"ownership of {company_name}. Purpose: {purpose}",
            data=form13d_data,
            source_filing="13D",
            filing_date=form13d_data.get("filing_date", "")
        )
    
    # =========================================================================
    # REPORTING FUNCTIONS
    # =========================================================================
    
    def get_alerts(
        self,
        ticker: Optional[str] = None,
        severity: Optional[str] = None,
        alert_type: Optional[str] = None,
        unread_only: bool = False,
        limit: int = 50
    ) -> List[CreditAlert]:
        """Get filtered alerts"""
        filtered = self.alerts
        
        if ticker:
            filtered = [a for a in filtered if a.ticker == ticker]
        
        if severity:
            filtered = [a for a in filtered if a.severity == severity]
        
        if alert_type:
            filtered = [a for a in filtered if a.alert_type == alert_type]
        
        if unread_only:
            filtered = [a for a in filtered if not a.read]
        
        # Sort by created_at descending
        filtered.sort(key=lambda x: x.created_at, reverse=True)
        
        return filtered[:limit]
    
    def mark_read(self, alert_id: str):
        """Mark alert as read"""
        for alert in self.alerts:
            if alert.alert_id == alert_id:
                alert.read = True
                self._save_alerts()
                return
    
    def dismiss_alert(self, alert_id: str):
        """Dismiss alert"""
        for alert in self.alerts:
            if alert.alert_id == alert_id:
                alert.dismissed = True
                self._save_alerts()
                return
    
    def get_summary(self) -> Dict[str, Any]:
        """Get summary of current alerts"""
        unread = [a for a in self.alerts if not a.read and not a.dismissed]
        
        return {
            "total_alerts": len(self.alerts),
            "unread": len(unread),
            "by_severity": {
                "critical": len([a for a in unread if a.severity == "critical"]),
                "high": len([a for a in unread if a.severity == "high"]),
                "medium": len([a for a in unread if a.severity == "medium"]),
                "low": len([a for a in unread if a.severity == "low"])
            },
            "watchlist_count": len(self.watchlist)
        }
    
    def format_alerts_markdown(self, alerts: List[CreditAlert]) -> str:
        """Format alerts as markdown"""
        if not alerts:
            return "No alerts to display."
        
        severity_emoji = {
            "critical": "🔴",
            "high": "🟠",
            "medium": "🟡",
            "low": "🟢"
        }
        
        md = "# Credit Monitoring Alerts\n\n"
        
        for alert in alerts:
            emoji = severity_emoji.get(alert.severity, "⚪")
            md += f"""## {emoji} {alert.headline}

**{alert.ticker}** | {alert.severity.upper()} | {alert.alert_type}
*{alert.filing_date}*

{alert.summary}

---

"""
        
        return md


# =============================================================================
# CLI / TESTING
# =============================================================================

def demo():
    """Demo the Credit Monitoring Agent"""
    print("=" * 60)
    print("CREDIT MONITORING AGENT - DEMO")
    print("=" * 60)
    print()
    
    # Initialize agent
    agent = CreditMonitorAgent()
    
    # Add company to watchlist
    profile = CompanyProfile(
        ticker="TSLA",
        company_name="Tesla, Inc.",
        total_debt=4000,
        net_debt=-25100,
        leverage_ratio=0.08,
        interest_coverage=48.2,
        covenants=[
            {"name": "Max Leverage", "threshold": 3.5, "current": 0.08, "cushion": 97.7}
        ],
        covenant_cushion_min=97.7,
        last_filing_date="2025-01-29",
        insider_sentiment="neutral",
        recent_alerts=[]
    )
    agent.add_to_watchlist(profile)
    
    # Simulate some alerts
    print("\n--- Simulating Alerts ---\n")
    
    # 1. Covenant warning
    mock_extraction = {
        "ticker": "RISK",
        "company_name": "Risky Corp",
        "filing_type": "10-Q",
        "filing_date": "2025-01-30",
        "data": {
            "covenants": [
                {
                    "covenant_name": "Maximum Leverage Ratio",
                    "threshold_value": 4.0,
                    "current_value": 3.5,
                    "threshold_direction": "max",
                    "in_compliance": True
                }
            ]
        }
    }
    covenant_alerts = agent.check_covenant_status(mock_extraction)
    print(f"Covenant check: {len(covenant_alerts)} alerts")
    
    # 2. Debt increase
    debt_alert = agent.check_debt_changes(
        ticker="DEBT",
        company_name="Debt Corp",
        current_debt=15000,
        previous_debt=10000,
        filing_type="10-K",
        filing_date="2025-01-30"
    )
    print(f"Debt change check: {'1 alert' if debt_alert else 'No alert'}")
    
    # 3. Insider selling
    insider_alert = agent.check_insider_activity(
        ticker="SELL",
        company_name="Selling Corp",
        form4_data={
            "insider_name": "John CEO",
            "transaction_type": "sale",
            "shares": 100000,
            "value": 5000000,
            "filing_date": "2025-01-30"
        }
    )
    print(f"Insider check: {'1 alert' if insider_alert else 'No alert'}")
    
    # 4. 8-K event
    k8_alerts = agent.check_8k_events(
        ticker="EVENT",
        company_name="Event Corp",
        form8k_data={
            "filed_date": "2025-01-30",
            "events": [
                {
                    "item_code": "5.02",
                    "headline": "CFO Resigned",
                    "summary": "Jane CFO has resigned effective March 1.",
                    "materiality": "high",
                    "sentiment": "negative"
                }
            ]
        }
    )
    print(f"8-K check: {len(k8_alerts)} alerts")
    
    # Summary
    print("\n--- Alert Summary ---\n")
    summary = agent.get_summary()
    print(f"Total alerts: {summary['total_alerts']}")
    print(f"Unread: {summary['unread']}")
    print(f"Critical: {summary['by_severity']['critical']}")
    print(f"High: {summary['by_severity']['high']}")
    print(f"Medium: {summary['by_severity']['medium']}")
    print(f"Low: {summary['by_severity']['low']}")
    
    # Show alerts
    print("\n--- Recent Alerts ---\n")
    alerts = agent.get_alerts(limit=5)
    print(agent.format_alerts_markdown(alerts))
    
    print("=" * 60)
    print("DEMO COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    demo()