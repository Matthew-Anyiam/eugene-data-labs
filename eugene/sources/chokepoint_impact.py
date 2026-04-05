"""
Chokepoint Impact Analysis — connects supply chain disruptions to commodity prices.

Maps shipping chokepoints to the commodities that flow through them,
calculates disruption impact scores, and identifies affected countries/sectors.
"""

import logging
from datetime import datetime, timezone
from eugene.cache import cached

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Chokepoint → Commodity mapping with flow data
# ---------------------------------------------------------------------------

CHOKEPOINT_FLOWS = {
    "Strait of Hormuz": {
        "lat": 26.56, "lng": 56.25,
        "trade_share_pct": 21,
        "daily_flow": {
            "crude_oil": {"volume": "20.5M bbl/day", "pct_global": 21},
            "lng": {"volume": "5.1 Bcf/day", "pct_global": 25},
            "refined_petroleum": {"volume": "4.5M bbl/day", "pct_global": 18},
        },
        "key_exporters": ["SA", "AE", "IQ", "KW", "QA", "IR", "OM"],
        "key_importers": ["CN", "JP", "IN", "KR", "TW", "EU"],
        "commodities_affected": [
            {"commodity": "Crude Oil (Brent)", "impact": "critical", "price_sensitivity": 0.85,
             "description": "21% of global seaborne oil. Closure adds $5-15/bbl disruption premium."},
            {"commodity": "LNG", "impact": "critical", "price_sensitivity": 0.80,
             "description": "25% of global LNG. Qatar is world's largest exporter through this strait."},
            {"commodity": "Refined Products", "impact": "high", "price_sensitivity": 0.65,
             "description": "Major refined product flow from Gulf refineries to Asia."},
            {"commodity": "Petrochemicals", "impact": "high", "price_sensitivity": 0.55,
             "description": "Gulf petrochemical exports (ethylene, propylene, plastics)."},
        ],
        "disruption_scenarios": [
            {"scenario": "Minor tensions (naval escorts)", "oil_premium_usd": 3, "duration_days": 30, "probability": "moderate"},
            {"scenario": "Partial blockade (insurance rates spike)", "oil_premium_usd": 10, "duration_days": 60, "probability": "low"},
            {"scenario": "Full closure", "oil_premium_usd": 30, "duration_days": 90, "probability": "very_low"},
        ],
        "alternative_routes": [
            {"route": "East-West Pipeline (Saudi Arabia)", "capacity": "5M bbl/day", "adds_days": 0},
            {"route": "IPSA Pipeline (Iraq-Saudi)", "capacity": "1.65M bbl/day", "adds_days": 0},
            {"route": "Cape of Good Hope", "capacity": "unlimited", "adds_days": 15},
        ],
    },
    "Suez Canal": {
        "lat": 30.45, "lng": 32.35,
        "trade_share_pct": 12,
        "daily_flow": {
            "crude_oil": {"volume": "5.5M bbl/day", "pct_global": 9},
            "container_traffic": {"volume": "55 ships/day", "pct_global": 12},
            "lng": {"volume": "2.0 Bcf/day", "pct_global": 8},
        },
        "key_exporters": ["SA", "IQ", "AE", "KW", "QA", "EG"],
        "key_importers": ["EU", "US", "TR"],
        "commodities_affected": [
            {"commodity": "Crude Oil", "impact": "high", "price_sensitivity": 0.50,
             "description": "9% of seaborne oil. Disruption reroutes via Cape of Good Hope (+10 days)."},
            {"commodity": "Container Goods", "impact": "critical", "price_sensitivity": 0.70,
             "description": "12% of global trade. Consumer goods, electronics, auto parts EU↔Asia."},
            {"commodity": "LNG", "impact": "moderate", "price_sensitivity": 0.40,
             "description": "Qatar LNG to Europe transits Suez. Reroute adds 10+ days."},
            {"commodity": "Grain", "impact": "high", "price_sensitivity": 0.55,
             "description": "Black Sea grain exports to Asia transit Suez. Food security risk."},
        ],
        "disruption_scenarios": [
            {"scenario": "Houthi attacks (elevated insurance)", "oil_premium_usd": 2, "duration_days": 180, "probability": "current"},
            {"scenario": "Canal blockage (Ever Given style)", "oil_premium_usd": 5, "duration_days": 7, "probability": "low"},
            {"scenario": "Extended closure", "oil_premium_usd": 8, "duration_days": 90, "probability": "very_low"},
        ],
        "alternative_routes": [
            {"route": "Cape of Good Hope", "capacity": "unlimited", "adds_days": 10},
            {"route": "SUMED Pipeline (oil only)", "capacity": "2.5M bbl/day", "adds_days": 0},
        ],
    },
    "Strait of Malacca": {
        "lat": 1.43, "lng": 103.5,
        "trade_share_pct": 25,
        "daily_flow": {
            "crude_oil": {"volume": "16M bbl/day", "pct_global": 16},
            "container_traffic": {"volume": "83K ships/year", "pct_global": 25},
            "lng": {"volume": "4.5 Bcf/day", "pct_global": 20},
        },
        "key_exporters": ["SA", "AE", "IQ", "AU", "ID", "MY"],
        "key_importers": ["CN", "JP", "KR", "TW"],
        "commodities_affected": [
            {"commodity": "Crude Oil", "impact": "critical", "price_sensitivity": 0.75,
             "description": "16% of global seaborne oil. China's main oil import route."},
            {"commodity": "LNG", "impact": "high", "price_sensitivity": 0.65,
             "description": "Major LNG artery for Northeast Asian importers."},
            {"commodity": "Palm Oil", "impact": "critical", "price_sensitivity": 0.90,
             "description": "Malaysia and Indonesia are 85% of global palm oil exports."},
            {"commodity": "Electronics/Semiconductors", "impact": "critical", "price_sensitivity": 0.80,
             "description": "Key route for semiconductor supply chain (TSMC, Samsung)."},
            {"commodity": "Rubber", "impact": "high", "price_sensitivity": 0.70,
             "description": "Thailand, Indonesia, Malaysia produce 70% of natural rubber."},
        ],
        "disruption_scenarios": [
            {"scenario": "Piracy surge", "oil_premium_usd": 1, "duration_days": 90, "probability": "low"},
            {"scenario": "Naval standoff", "oil_premium_usd": 8, "duration_days": 30, "probability": "very_low"},
            {"scenario": "Full closure", "oil_premium_usd": 25, "duration_days": 60, "probability": "extremely_low"},
        ],
        "alternative_routes": [
            {"route": "Lombok Strait", "capacity": "limited", "adds_days": 2},
            {"route": "Sunda Strait", "capacity": "limited", "adds_days": 1},
            {"route": "Philippine Sea route", "capacity": "unlimited", "adds_days": 3},
        ],
    },
    "Bab el-Mandeb": {
        "lat": 12.58, "lng": 43.33,
        "trade_share_pct": 9,
        "daily_flow": {
            "crude_oil": {"volume": "6.2M bbl/day", "pct_global": 9},
            "container_traffic": {"volume": "30 ships/day", "pct_global": 9},
        },
        "key_exporters": ["SA", "IQ", "KW", "AE"],
        "key_importers": ["EU", "US"],
        "commodities_affected": [
            {"commodity": "Crude Oil", "impact": "high", "price_sensitivity": 0.50,
             "description": "Gates Red Sea access to Suez. Disruption forces Cape reroute."},
            {"commodity": "Container Goods", "impact": "high", "price_sensitivity": 0.55,
             "description": "Houthi attacks forced major carriers to reroute (2024+)."},
        ],
        "disruption_scenarios": [
            {"scenario": "Houthi attacks (ongoing)", "oil_premium_usd": 2, "duration_days": 365, "probability": "current"},
            {"scenario": "Full blockade", "oil_premium_usd": 10, "duration_days": 90, "probability": "low"},
        ],
        "alternative_routes": [
            {"route": "Cape of Good Hope", "capacity": "unlimited", "adds_days": 12},
        ],
    },
    "Panama Canal": {
        "lat": 9.08, "lng": -79.68,
        "trade_share_pct": 5,
        "daily_flow": {
            "container_traffic": {"volume": "38 ships/day", "pct_global": 5},
            "lng": {"volume": "1.5 Bcf/day", "pct_global": 6},
            "grain": {"volume": "60M tons/year", "pct_global": 5},
        },
        "key_exporters": ["US", "BR", "CO"],
        "key_importers": ["CN", "JP", "KR"],
        "commodities_affected": [
            {"commodity": "LNG", "impact": "moderate", "price_sensitivity": 0.35,
             "description": "US Gulf LNG to Asia. Drought restrictions limit transit capacity."},
            {"commodity": "Grain/Soybeans", "impact": "moderate", "price_sensitivity": 0.40,
             "description": "US grain exports to Asia transit Panama. Drought limits vessel drafts."},
            {"commodity": "Container Goods", "impact": "moderate", "price_sensitivity": 0.35,
             "description": "US East Coast ↔ Asia trade. Alternatives via Suez or US rail."},
        ],
        "disruption_scenarios": [
            {"scenario": "Drought restrictions (2023-style)", "oil_premium_usd": 0, "duration_days": 180, "probability": "recurring"},
            {"scenario": "Extended low water", "oil_premium_usd": 1, "duration_days": 365, "probability": "moderate"},
        ],
        "alternative_routes": [
            {"route": "Suez Canal (via Atlantic)", "capacity": "unlimited", "adds_days": 8},
            {"route": "US intermodal rail", "capacity": "limited", "adds_days": 5},
        ],
    },
    "Turkish Straits": {
        "lat": 41.12, "lng": 29.05,
        "trade_share_pct": 3,
        "daily_flow": {
            "crude_oil": {"volume": "3.3M bbl/day", "pct_global": 3},
            "grain": {"volume": "grain corridor", "pct_global": 10},
        },
        "key_exporters": ["RU", "KZ", "AZ", "UA"],
        "key_importers": ["EU", "EG", "TR"],
        "commodities_affected": [
            {"commodity": "Crude Oil (Urals)", "impact": "moderate", "price_sensitivity": 0.35,
             "description": "Kazakh and Russian oil exports to Mediterranean."},
            {"commodity": "Wheat/Grain", "impact": "critical", "price_sensitivity": 0.80,
             "description": "Black Sea grain corridor. Ukraine/Russia supply 25% of global wheat exports."},
            {"commodity": "Sunflower Oil", "impact": "high", "price_sensitivity": 0.75,
             "description": "Ukraine supplies 46% of global sunflower oil."},
        ],
        "disruption_scenarios": [
            {"scenario": "Grain deal collapse", "oil_premium_usd": 0, "duration_days": 180, "probability": "moderate"},
            {"scenario": "Naval blockade (Black Sea)", "oil_premium_usd": 3, "duration_days": 90, "probability": "low"},
        ],
        "alternative_routes": [
            {"route": "Danube river barges to EU", "capacity": "limited", "adds_days": 5},
            {"route": "Rail via Poland/Romania", "capacity": "limited", "adds_days": 7},
        ],
    },
}


# ---------------------------------------------------------------------------
# Impact analysis functions
# ---------------------------------------------------------------------------

def get_chokepoint_analysis(chokepoint: str | None = None) -> dict:
    """Get detailed chokepoint analysis with commodity impact.

    Args:
        chokepoint: Chokepoint name (partial match OK). None = return all.

    Returns:
        Dict with chokepoint details, commodity flows, scenarios, and alternatives.
    """
    if chokepoint:
        # Fuzzy match
        key = None
        for k in CHOKEPOINT_FLOWS:
            if chokepoint.lower() in k.lower():
                key = k
                break
        if not key:
            return {
                "error": f"Unknown chokepoint: {chokepoint}",
                "available": list(CHOKEPOINT_FLOWS.keys()),
            }
        data = CHOKEPOINT_FLOWS[key]
        return {
            "chokepoint": key,
            **data,
            "source": "eugene_analysis",
        }

    # Return summary of all chokepoints
    summary = []
    for name, data in CHOKEPOINT_FLOWS.items():
        commodity_count = len(data.get("commodities_affected", []))
        critical_count = sum(1 for c in data.get("commodities_affected", []) if c["impact"] == "critical")
        summary.append({
            "name": name,
            "lat": data["lat"],
            "lng": data["lng"],
            "trade_share_pct": data["trade_share_pct"],
            "commodities_affected": commodity_count,
            "critical_commodities": critical_count,
            "key_exporters": data["key_exporters"],
            "has_active_disruption": any(
                s.get("probability") == "current"
                for s in data.get("disruption_scenarios", [])
            ),
        })

    summary.sort(key=lambda x: x["trade_share_pct"], reverse=True)
    return {
        "chokepoints": summary,
        "count": len(summary),
        "source": "eugene_analysis",
    }


@cached(ttl=1800)  # 30min
def get_disruption_impact(chokepoint: str) -> dict:
    """Calculate real-time disruption impact for a chokepoint.

    Combines static flow data with live conflict/disaster signals
    to assess current disruption risk and commodity price impact.
    """
    analysis = get_chokepoint_analysis(chokepoint)
    if "error" in analysis:
        return analysis

    name = analysis["chokepoint"]
    lat = analysis["lat"]
    lng = analysis["lng"]

    # Pull live signals
    risk_score = 0.0
    active_signals = []

    try:
        from eugene.sources.disasters import get_active_disasters
        disasters = get_active_disasters(days=7, min_magnitude=5.0)
        for d in disasters.get("disasters", []):
            dlat = d.get("lat", 0)
            dlng = d.get("lng", 0)
            dist = ((dlat - lat) ** 2 + (dlng - lng) ** 2) ** 0.5 * 111
            if dist < 500:
                risk_score += 0.2
                active_signals.append({
                    "type": "disaster",
                    "name": d.get("name", ""),
                    "distance_km": round(dist),
                    "severity": d.get("severity_tier", d.get("alert_level", "")),
                })
    except Exception as e:
        logger.warning("Could not fetch disaster signals: %s", e)

    try:
        from eugene.sources.conflict import get_conflict_events
        conflicts = get_conflict_events(limit=50)
        for c in conflicts.get("events", []):
            clat = c.get("latitude", 0)
            clng = c.get("longitude", 0)
            if clat and clng:
                dist = ((clat - lat) ** 2 + (clng - lng) ** 2) ** 0.5 * 111
                if dist < 500:
                    risk_score += 0.3
                    active_signals.append({
                        "type": "conflict",
                        "name": c.get("side_a", "") + " vs " + c.get("side_b", ""),
                        "distance_km": round(dist),
                        "deaths": c.get("deaths_total", 0),
                    })
    except Exception as e:
        logger.warning("Could not fetch conflict signals: %s", e)

    # Check for active disruption scenarios
    active_scenario = None
    for scenario in analysis.get("disruption_scenarios", []):
        if scenario.get("probability") == "current":
            active_scenario = scenario
            risk_score += 0.4

    risk_score = min(risk_score, 1.0)
    risk_level = "critical" if risk_score > 0.7 else "high" if risk_score > 0.4 else "elevated" if risk_score > 0.2 else "normal"

    # Calculate estimated commodity price impacts
    commodity_impacts = []
    for c in analysis.get("commodities_affected", []):
        base_sensitivity = c["price_sensitivity"]
        estimated_impact_pct = round(base_sensitivity * risk_score * 15, 1)  # up to ~15% price move
        commodity_impacts.append({
            "commodity": c["commodity"],
            "base_impact": c["impact"],
            "price_sensitivity": base_sensitivity,
            "estimated_price_impact_pct": estimated_impact_pct,
            "description": c["description"],
        })

    return {
        "chokepoint": name,
        "risk_score": round(risk_score, 2),
        "risk_level": risk_level,
        "active_signals": active_signals,
        "active_scenario": active_scenario,
        "commodity_impacts": commodity_impacts,
        "affected_exporters": analysis.get("key_exporters", []),
        "affected_importers": analysis.get("key_importers", []),
        "alternative_routes": analysis.get("alternative_routes", []),
        "daily_flow": analysis.get("daily_flow", {}),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "eugene_analysis",
    }


def get_commodity_chokepoint_exposure(commodity: str) -> dict:
    """Find all chokepoints that affect a given commodity.

    Args:
        commodity: Commodity name (partial match, e.g., 'oil', 'lng', 'grain')

    Returns:
        Dict with all chokepoints where this commodity flows, ranked by exposure.
    """
    commodity_lower = commodity.lower()
    exposures = []

    for name, data in CHOKEPOINT_FLOWS.items():
        for c in data.get("commodities_affected", []):
            if commodity_lower in c["commodity"].lower() or commodity_lower in c.get("description", "").lower():
                exposures.append({
                    "chokepoint": name,
                    "lat": data["lat"],
                    "lng": data["lng"],
                    "trade_share_pct": data["trade_share_pct"],
                    "commodity": c["commodity"],
                    "impact_level": c["impact"],
                    "price_sensitivity": c["price_sensitivity"],
                    "description": c["description"],
                    "key_exporters": data["key_exporters"],
                    "has_active_disruption": any(
                        s.get("probability") == "current"
                        for s in data.get("disruption_scenarios", [])
                    ),
                })

    exposures.sort(key=lambda x: x["price_sensitivity"], reverse=True)

    return {
        "commodity_query": commodity,
        "exposures": exposures,
        "count": len(exposures),
        "total_trade_share_pct": sum(e["trade_share_pct"] for e in exposures),
        "source": "eugene_analysis",
    }
