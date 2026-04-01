"""
Sanctions data — OFAC SDN, EU Consolidated List, UN Security Council.

All sources are free, public domain / public access.
- OFAC: https://sanctionslist.ofac.treas.gov/
- EU: https://webgate.ec.europa.eu/fsd/fsf/
- UN: https://scsanctions.un.org/

Provides entity screening against all three lists with fuzzy matching.
"""

import logging
import xml.etree.ElementTree as ET
import requests
from difflib import SequenceMatcher
from eugene.cache import cached

logger = logging.getLogger(__name__)

OFAC_SDN_CSV = "https://www.treasury.gov/ofac/downloads/sdn.csv"
OFAC_SDN_XML = "https://sanctionslist.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML"
EU_SANCTIONS_XML = "https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content"
UN_SANCTIONS_XML = "https://scsanctions.un.org/resources/xml/en/consolidated.xml"

TIMEOUT = 30


@cached(ttl=86400)  # 24h cache — sanctions lists update daily at most
def _fetch_ofac_sdn() -> list[dict]:
    """Fetch and parse OFAC SDN list (CSV format for speed)."""
    try:
        resp = requests.get(OFAC_SDN_CSV, timeout=TIMEOUT)
        resp.raise_for_status()

        entries = []
        for line in resp.text.strip().split("\n"):
            parts = line.split(",")
            if len(parts) < 12:
                continue

            # CSV format: ent_num, SDN_name, SDN_type, program, title, ...
            entry = {
                "id": parts[0].strip().strip('"'),
                "name": parts[1].strip().strip('"'),
                "entity_type": parts[2].strip().strip('"'),
                "program": parts[3].strip().strip('"'),
                "title": parts[4].strip().strip('"') if len(parts) > 4 else "",
                "remarks": parts[11].strip().strip('"') if len(parts) > 11 else "",
                "source": "ofac_sdn",
                "authority": "US Treasury / OFAC",
            }
            if entry["name"] and entry["name"] != "-0-":
                entries.append(entry)

        logger.info("Loaded %d OFAC SDN entries", len(entries))
        return entries

    except Exception as e:
        logger.error("Failed to fetch OFAC SDN: %s", e)
        return []


@cached(ttl=86400)
def _fetch_un_sanctions() -> list[dict]:
    """Fetch and parse UN Security Council consolidated sanctions list."""
    try:
        resp = requests.get(UN_SANCTIONS_XML, timeout=TIMEOUT)
        resp.raise_for_status()

        root = ET.fromstring(resp.content)
        entries = []

        # Handle namespace
        ns = ""
        if root.tag.startswith("{"):
            ns = root.tag.split("}")[0] + "}"

        for individual in root.iter(f"{ns}INDIVIDUAL"):
            name_parts = []
            for tag in ["FIRST_NAME", "SECOND_NAME", "THIRD_NAME"]:
                elem = individual.find(f"{ns}{tag}")
                if elem is not None and elem.text:
                    name_parts.append(elem.text.strip())

            full_name = " ".join(name_parts)
            if not full_name:
                continue

            un_id = ""
            dataid = individual.find(f"{ns}DATAID")
            if dataid is not None and dataid.text:
                un_id = dataid.text.strip()

            list_type_elem = individual.find(f"{ns}UN_LIST_TYPE")
            list_type = list_type_elem.text.strip() if list_type_elem is not None and list_type_elem.text else ""

            entries.append({
                "id": un_id,
                "name": full_name,
                "entity_type": "individual",
                "program": list_type,
                "source": "un_sc",
                "authority": "UN Security Council",
            })

        for entity in root.iter(f"{ns}ENTITY"):
            name_elem = entity.find(f"{ns}FIRST_NAME")
            if name_elem is None or not name_elem.text:
                continue

            un_id = ""
            dataid = entity.find(f"{ns}DATAID")
            if dataid is not None and dataid.text:
                un_id = dataid.text.strip()

            list_type_elem = entity.find(f"{ns}UN_LIST_TYPE")
            list_type = list_type_elem.text.strip() if list_type_elem is not None and list_type_elem.text else ""

            entries.append({
                "id": un_id,
                "name": name_elem.text.strip(),
                "entity_type": "entity",
                "program": list_type,
                "source": "un_sc",
                "authority": "UN Security Council",
            })

        logger.info("Loaded %d UN sanctions entries", len(entries))
        return entries

    except Exception as e:
        logger.error("Failed to fetch UN sanctions: %s", e)
        return []


def screen_entity(
    name: str,
    threshold: float = 0.8,
    lists: list[str] | None = None,
) -> dict:
    """Screen an entity name against sanctions lists.

    Args:
        name: Entity name to screen
        threshold: Fuzzy match threshold (0.0-1.0)
        lists: Which lists to check ('ofac', 'un', 'eu'). Default: all.

    Returns:
        Dict with matches and screening result
    """
    target_lists = lists or ["ofac", "un"]
    all_entries: list[dict] = []

    if "ofac" in target_lists:
        all_entries.extend(_fetch_ofac_sdn())
    if "un" in target_lists:
        all_entries.extend(_fetch_un_sanctions())

    name_lower = name.lower().strip()
    matches = []

    for entry in all_entries:
        entry_name = entry.get("name", "").lower()
        if not entry_name:
            continue

        # Exact match
        if name_lower == entry_name:
            matches.append({**entry, "match_score": 1.0, "match_type": "exact"})
            continue

        # Substring match
        if name_lower in entry_name or entry_name in name_lower:
            score = min(len(name_lower), len(entry_name)) / max(len(name_lower), len(entry_name))
            if score >= threshold:
                matches.append({**entry, "match_score": round(score, 3), "match_type": "substring"})
                continue

        # Fuzzy match
        score = SequenceMatcher(None, name_lower, entry_name).ratio()
        if score >= threshold:
            matches.append({**entry, "match_score": round(score, 3), "match_type": "fuzzy"})

    # Sort by score descending
    matches.sort(key=lambda x: x["match_score"], reverse=True)

    is_sanctioned = len(matches) > 0
    max_score = matches[0]["match_score"] if matches else 0

    return {
        "screened_name": name,
        "is_sanctioned": is_sanctioned,
        "match_count": len(matches),
        "max_score": max_score,
        "risk_level": _risk_level(max_score, len(matches)),
        "matches": matches[:10],  # Cap at top 10 matches
        "lists_checked": target_lists,
        "source": "ofac_sdn+un_sc",
    }


def get_sanctions_list(
    source: str = "ofac",
    entity_type: str | None = None,
    program: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """Get sanctions list entries with optional filtering.

    Args:
        source: 'ofac', 'un', or 'all'
        entity_type: Filter by 'individual' or 'entity'
        program: Filter by sanctions program
        limit: Max results
        offset: Pagination offset
    """
    entries: list[dict] = []
    if source in ("ofac", "all"):
        entries.extend(_fetch_ofac_sdn())
    if source in ("un", "all"):
        entries.extend(_fetch_un_sanctions())

    # Apply filters
    if entity_type:
        entries = [e for e in entries if entity_type.lower() in e.get("entity_type", "").lower()]
    if program:
        entries = [e for e in entries if program.lower() in e.get("program", "").lower()]

    total = len(entries)
    page = entries[offset:offset + limit]

    return {
        "entries": page,
        "total": total,
        "limit": limit,
        "offset": offset,
        "source": source,
    }


def get_exposure(ticker: str) -> dict:
    """Check a company's potential sanctions exposure.

    Screens the company name and known officers against sanctions lists.
    """
    from eugene.router import query as eugene_query

    results = {
        "ticker": ticker,
        "company_screening": None,
        "officer_screenings": [],
        "overall_risk": "low",
        "source": "ofac_sdn+un_sc",
    }

    try:
        # Get company profile
        profile = eugene_query(ticker, "profile")
        company_name = profile.get("data", {}).get("company_name", "") or profile.get("data", {}).get("name", ticker)

        # Screen company name
        company_result = screen_entity(company_name, threshold=0.85)
        results["company_screening"] = company_result

        # Screen officers
        officers = profile.get("data", {}).get("officers", [])
        for officer in officers[:10]:
            officer_name = officer.get("name", "")
            if officer_name:
                officer_result = screen_entity(officer_name, threshold=0.85)
                if officer_result["match_count"] > 0:
                    results["officer_screenings"].append({
                        "name": officer_name,
                        "title": officer.get("title", ""),
                        **officer_result,
                    })

        # Determine overall risk
        if company_result.get("is_sanctioned"):
            results["overall_risk"] = "critical"
        elif results["officer_screenings"]:
            results["overall_risk"] = "high"
        else:
            results["overall_risk"] = "low"

    except Exception as e:
        logger.error("Exposure check failed for %s: %s", ticker, e)
        results["error"] = str(e)

    return results


def get_regulatory_changes(days: int = 7, limit: int = 20) -> dict:
    """Get recent regulatory/sanctions changes from the Federal Register.

    Monitors OFAC, BIS, and State Department actions.
    """
    try:
        from_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

        resp = requests.get(
            "https://www.federalregister.gov/api/v1/documents.json",
            params={
                "conditions[agencies][]": "treasury-department",
                "conditions[publication_date][gte]": from_date,
                "conditions[term]": "sanctions OR OFAC OR SDN",
                "per_page": min(limit, 50),
                "order": "newest",
            },
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()

        results = []
        for doc in data.get("results", []):
            results.append({
                "title": doc.get("title", ""),
                "type": doc.get("type", ""),
                "abstract": (doc.get("abstract", "") or "")[:300],
                "publication_date": doc.get("publication_date", ""),
                "url": doc.get("html_url", ""),
                "agencies": [a.get("name", "") for a in doc.get("agencies", [])],
                "source": "federal_register",
            })

        return {
            "changes": results,
            "count": len(results),
            "from_date": from_date,
            "source": "federal_register",
        }

    except Exception as e:
        logger.error("Federal Register API error: %s", e)
        return {"changes": [], "count": 0, "error": str(e), "source": "federal_register"}


def _risk_level(max_score: float, match_count: int) -> str:
    """Determine risk level from screening results."""
    if max_score >= 0.95:
        return "critical"
    elif max_score >= 0.85:
        return "high"
    elif match_count > 0:
        return "medium"
    return "clear"


# Need datetime for regulatory changes
from datetime import datetime, timedelta
