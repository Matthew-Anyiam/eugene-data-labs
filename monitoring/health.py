"""
Eugene Intelligence - Health Check & Monitoring

Monitors system health:
- API connectivity
- Storage availability
- Recent extraction success rate
- Error trends
"""

import os
import asyncio
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from pathlib import Path
import json
import logging

logger = logging.getLogger(__name__)


@dataclass
class HealthStatus:
    """Health status of a component"""
    name: str
    healthy: bool
    message: str
    latency_ms: Optional[float] = None
    last_check: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "healthy": self.healthy,
            "message": self.message,
            "latency_ms": self.latency_ms,
            "last_check": self.last_check.isoformat()
        }


@dataclass
class SystemHealth:
    """Overall system health"""
    healthy: bool
    components: List[HealthStatus]
    timestamp: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict:
        return {
            "healthy": self.healthy,
            "timestamp": self.timestamp.isoformat(),
            "components": [c.to_dict() for c in self.components]
        }


class HealthChecker:
    """
    Checks health of Eugene Intelligence system components.
    """
    
    def __init__(
        self,
        data_dir: str = "data",
        checkpoint_dir: str = "data/checkpoints",
        extraction_dir: str = "data/extractions"
    ):
        self.data_dir = Path(data_dir)
        self.checkpoint_dir = Path(checkpoint_dir)
        self.extraction_dir = Path(extraction_dir)
    
    async def check_all(self) -> SystemHealth:
        """Run all health checks"""
        components = []
        
        # Check each component
        components.append(await self.check_anthropic_api())
        components.append(await self.check_sec_edgar())
        components.append(self.check_storage())
        components.append(self.check_recent_extractions())
        
        # Overall health
        healthy = all(c.healthy for c in components)
        
        return SystemHealth(
            healthy=healthy,
            components=components
        )
    
    async def check_anthropic_api(self) -> HealthStatus:
        """Check Anthropic API connectivity"""
        start = time.time()
        
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            return HealthStatus(
                name="anthropic_api",
                healthy=False,
                message="ANTHROPIC_API_KEY not set"
            )
        
        try:
            import anthropic
            client = anthropic.Anthropic()
            
            # Quick test message
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=10,
                messages=[{"role": "user", "content": "Say 'ok'"}]
            )
            
            latency = (time.time() - start) * 1000
            
            return HealthStatus(
                name="anthropic_api",
                healthy=True,
                message="API responding",
                latency_ms=latency
            )
            
        except Exception as e:
            return HealthStatus(
                name="anthropic_api",
                healthy=False,
                message=f"API error: {str(e)[:100]}"
            )
    
    async def check_sec_edgar(self) -> HealthStatus:
        """Check SEC EDGAR connectivity"""
        start = time.time()
        
        try:
            import aiohttp
            
            url = "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=AAPL&type=10-K&dateb=&owner=include&count=1&output=atom"
            headers = {"User-Agent": "Eugene Intelligence research@eugeneintelligence.com"}
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, timeout=10) as resp:
                    if resp.status == 200:
                        latency = (time.time() - start) * 1000
                        return HealthStatus(
                            name="sec_edgar",
                            healthy=True,
                            message="EDGAR responding",
                            latency_ms=latency
                        )
                    else:
                        return HealthStatus(
                            name="sec_edgar",
                            healthy=False,
                            message=f"EDGAR returned status {resp.status}"
                        )
                        
        except asyncio.TimeoutError:
            return HealthStatus(
                name="sec_edgar",
                healthy=False,
                message="EDGAR timeout"
            )
        except Exception as e:
            return HealthStatus(
                name="sec_edgar",
                healthy=False,
                message=f"EDGAR error: {str(e)[:100]}"
            )
    
    def check_storage(self) -> HealthStatus:
        """Check storage availability"""
        try:
            # Check directories exist and are writable
            for path in [self.data_dir, self.checkpoint_dir, self.extraction_dir]:
                path.mkdir(parents=True, exist_ok=True)
                
                # Try to write a test file
                test_file = path / ".health_check"
                test_file.write_text(datetime.now().isoformat())
                test_file.unlink()
            
            # Check disk space
            import shutil
            total, used, free = shutil.disk_usage(self.data_dir)
            free_gb = free / (1024 ** 3)
            
            if free_gb < 1:
                return HealthStatus(
                    name="storage",
                    healthy=False,
                    message=f"Low disk space: {free_gb:.2f} GB free"
                )
            
            return HealthStatus(
                name="storage",
                healthy=True,
                message=f"Storage OK ({free_gb:.1f} GB free)"
            )
            
        except Exception as e:
            return HealthStatus(
                name="storage",
                healthy=False,
                message=f"Storage error: {str(e)[:100]}"
            )
    
    def check_recent_extractions(self) -> HealthStatus:
        """Check recent extraction success rate"""
        try:
            if not self.extraction_dir.exists():
                return HealthStatus(
                    name="extractions",
                    healthy=True,
                    message="No extractions yet"
                )
            
            # Look at extractions from last 24 hours
            cutoff = datetime.now() - timedelta(hours=24)
            
            total = 0
            successful = 0
            failed = 0
            
            for path in self.extraction_dir.glob("*.json"):
                try:
                    stat = path.stat()
                    mod_time = datetime.fromtimestamp(stat.st_mtime)
                    
                    if mod_time < cutoff:
                        continue
                    
                    total += 1
                    
                    with open(path) as f:
                        data = json.load(f)
                    
                    if data.get("quality_score", 0) >= 0.85:
                        successful += 1
                    else:
                        failed += 1
                        
                except:
                    continue
            
            if total == 0:
                return HealthStatus(
                    name="extractions",
                    healthy=True,
                    message="No recent extractions"
                )
            
            success_rate = successful / total
            
            if success_rate < 0.5:
                return HealthStatus(
                    name="extractions",
                    healthy=False,
                    message=f"Low success rate: {success_rate:.0%} ({successful}/{total})"
                )
            
            return HealthStatus(
                name="extractions",
                healthy=True,
                message=f"Success rate: {success_rate:.0%} ({successful}/{total})"
            )
            
        except Exception as e:
            return HealthStatus(
                name="extractions",
                healthy=True,  # Don't fail health on this
                message=f"Could not check extractions: {str(e)[:50]}"
            )


class MetricsCollector:
    """
    Collects and stores metrics for monitoring.
    """
    
    def __init__(self, metrics_file: str = "data/metrics.json"):
        self.metrics_file = Path(metrics_file)
        self.metrics_file.parent.mkdir(parents=True, exist_ok=True)
        self._metrics = self._load_metrics()
    
    def _load_metrics(self) -> Dict:
        """Load metrics from disk"""
        if self.metrics_file.exists():
            try:
                with open(self.metrics_file) as f:
                    return json.load(f)
            except:
                pass
        
        return {
            "extractions": {
                "total": 0,
                "successful": 0,
                "failed": 0,
                "by_ticker": {}
            },
            "api_calls": {
                "total": 0,
                "errors": 0
            },
            "errors": {
                "by_category": {},
                "recent": []
            },
            "last_updated": datetime.now().isoformat()
        }
    
    def _save_metrics(self):
        """Save metrics to disk"""
        self._metrics["last_updated"] = datetime.now().isoformat()
        with open(self.metrics_file, 'w') as f:
            json.dump(self._metrics, f, indent=2)
    
    def record_extraction(self, ticker: str, success: bool, quality_score: float = 0):
        """Record an extraction attempt"""
        self._metrics["extractions"]["total"] += 1
        
        if success:
            self._metrics["extractions"]["successful"] += 1
        else:
            self._metrics["extractions"]["failed"] += 1
        
        # By ticker
        if ticker not in self._metrics["extractions"]["by_ticker"]:
            self._metrics["extractions"]["by_ticker"][ticker] = {
                "total": 0,
                "successful": 0,
                "last_quality": 0
            }
        
        self._metrics["extractions"]["by_ticker"][ticker]["total"] += 1
        if success:
            self._metrics["extractions"]["by_ticker"][ticker]["successful"] += 1
            self._metrics["extractions"]["by_ticker"][ticker]["last_quality"] = quality_score
        
        self._save_metrics()
    
    def record_api_call(self, success: bool):
        """Record an API call"""
        self._metrics["api_calls"]["total"] += 1
        if not success:
            self._metrics["api_calls"]["errors"] += 1
        self._save_metrics()
    
    def record_error(self, category: str, message: str, ticker: str = None):
        """Record an error"""
        # By category
        if category not in self._metrics["errors"]["by_category"]:
            self._metrics["errors"]["by_category"][category] = 0
        self._metrics["errors"]["by_category"][category] += 1
        
        # Recent errors (keep last 100)
        self._metrics["errors"]["recent"].append({
            "category": category,
            "message": message[:200],
            "ticker": ticker,
            "timestamp": datetime.now().isoformat()
        })
        self._metrics["errors"]["recent"] = self._metrics["errors"]["recent"][-100:]
        
        self._save_metrics()
    
    def get_summary(self) -> Dict:
        """Get metrics summary"""
        extractions = self._metrics["extractions"]
        
        success_rate = 0
        if extractions["total"] > 0:
            success_rate = extractions["successful"] / extractions["total"]
        
        return {
            "total_extractions": extractions["total"],
            "success_rate": success_rate,
            "tickers_covered": len(extractions["by_ticker"]),
            "api_calls": self._metrics["api_calls"]["total"],
            "api_error_rate": (
                self._metrics["api_calls"]["errors"] / self._metrics["api_calls"]["total"]
                if self._metrics["api_calls"]["total"] > 0 else 0
            ),
            "error_categories": self._metrics["errors"]["by_category"],
            "recent_errors": self._metrics["errors"]["recent"][-10:],
            "last_updated": self._metrics["last_updated"]
        }


# Global instances
_health_checker: Optional[HealthChecker] = None
_metrics_collector: Optional[MetricsCollector] = None


def get_health_checker() -> HealthChecker:
    global _health_checker
    if _health_checker is None:
        _health_checker = HealthChecker()
    return _health_checker


def get_metrics_collector() -> MetricsCollector:
    global _metrics_collector
    if _metrics_collector is None:
        _metrics_collector = MetricsCollector()
    return _metrics_collector


# ============================================
# CLI
# ============================================

async def main():
    """Run health check"""
    print("Running health checks...\n")
    
    checker = get_health_checker()
    health = await checker.check_all()
    
    print("=" * 60)
    print(f"SYSTEM HEALTH: {'✓ HEALTHY' if health.healthy else '✗ UNHEALTHY'}")
    print("=" * 60)
    print()
    
    for component in health.components:
        status = "✓" if component.healthy else "✗"
        latency = f" ({component.latency_ms:.0f}ms)" if component.latency_ms else ""
        print(f"{status} {component.name}: {component.message}{latency}")
    
    print()
    
    # Show metrics summary
    metrics = get_metrics_collector()
    summary = metrics.get_summary()
    
    print("=" * 60)
    print("METRICS SUMMARY")
    print("=" * 60)
    print(f"Total extractions: {summary['total_extractions']}")
    print(f"Success rate: {summary['success_rate']:.0%}")
    print(f"Tickers covered: {summary['tickers_covered']}")
    print(f"API calls: {summary['api_calls']}")
    
    if summary['error_categories']:
        print(f"\nErrors by category:")
        for cat, count in summary['error_categories'].items():
            print(f"  {cat}: {count}")


if __name__ == "__main__":
    asyncio.run(main())
