"""
Normalize SEC companyfacts → clean financial time series.

This is the core normalizer. It fixes the stale period bug by:
1. Filtering by form type (10-K for FY, 10-Q for Q)
2. Checking duration (365d for FY, 90d for Q) on income/CF
3. Using instant-only values for balance sheet
4. Deduping by period_end (latest filed wins)
5. Best-tag selection (most recent data wins, then coverage, then tag order)
"""
from datetime import datetime
from eugene.sources.sec_api import fetch_companyfacts
from eugene.concepts import CANONICAL_CONCEPTS


def financials_handler(resolved: dict, params: dict) -> dict:
    cik = resolved["cik"]
    period_type = params.get("period", "FY").upper()
    limit = int(params.get("limit", 5))
    requested = params.get("concept")

    # Filter concepts
    if requested:
        concept_names = [c.strip() for c in requested.split(",")] if isinstance(requested, str) else requested
        to_fetch = {k: v for k, v in CANONICAL_CONCEPTS.items()
                    if k in concept_names and not v.get("derived")}
    else:
        to_fetch = {k: v for k, v in CANONICAL_CONCEPTS.items() if not v.get("derived")}

    raw = fetch_companyfacts(cik)
    us_gaap = raw.get("facts", {}).get("us-gaap", {})
    # Also check dei namespace for shares
    dei = raw.get("facts", {}).get("dei", {})

    # Step 1: Find matching data for each concept
    concept_data = {}
    for concept_name, config in to_fetch.items():
        unit_key = config.get("unit", "USD")

        # Pick tag with most recent data (not first match)
        best_filtered = []
        best_tag_name = None
        best_taxonomy = None
        best_latest = None

        for tag in config["tags"]:
            taxonomy = None
            tag_data = us_gaap.get(tag)
            if tag_data:
                taxonomy = "us-gaap"
            else:
                tag_data = dei.get(tag)
                if tag_data:
                    taxonomy = "dei"
            if not tag_data:
                continue

            units = tag_data.get("units", {})
            values = units.get(unit_key, [])
            if not values and unit_key == "USD":
                values = units.get("USD/shares", [])
            if not values:
                continue

            filtered = _filter_values(values, config["statement"], period_type)
            if not filtered:
                continue

            ends = [v.get("end") for v in filtered if v.get("end")]
            if not ends:
                continue
            latest = max(ends)

            # Score: latest date > coverage > tag list order
            better = False
            if best_latest is None or latest > best_latest:
                better = True
            elif latest == best_latest:
                if len(filtered) > len(best_filtered):
                    better = True

            if better:
                best_latest = latest
                best_filtered = filtered
                best_tag_name = tag
                best_taxonomy = taxonomy

        if best_filtered:
            concept_data[concept_name] = {
                "values": best_filtered,
                "source_tag": f"{best_taxonomy}:{best_tag_name}",
                "unit": unit_key,
            }

    # Step 2: Backbone-driven period alignment
    # Prefer income/cash_flow concepts; never let shares_outstanding drive periods
    if concept_data:
        preferred = ("income", "cash_flow")
        income_cf = {
            k: v for k, v in concept_data.items()
            if k != "shares_outstanding"
            and CANONICAL_CONCEPTS.get(k, {}).get("statement") in preferred
        }
        if income_cf:
            pool = income_cf
        else:
            pool = {k: v for k, v in concept_data.items() if k != "shares_outstanding"} or concept_data
        backbone = max(pool, key=lambda k: len(pool[k]["values"]))
        all_periods = set(v.get("end") for v in concept_data[backbone]["values"] if v.get("end"))
    else:
        all_periods = set()
    periods_sorted = sorted(all_periods, reverse=True)[:limit]

    # Step 4: Build period-aligned output
    output = []
    for period_end in periods_sorted:
        metrics = {}
        accession = None
        filed_date = None
        filing_form = None
        fiscal_year = None

        for concept_name, data in concept_data.items():
            match = _best_match(data["values"], period_end)

            if match:
                metrics[concept_name] = {
                    "value": match["val"],
                    "unit": data["unit"],
                    "source_tag": data["source_tag"],
                }
                if not accession or match.get("filed", "") > (filed_date or ""):
                    accession = match.get("accn")
                    filed_date = match.get("filed")
                    filing_form = match.get("form")
                    fiscal_year = match.get("fy")
            else:
                metrics[concept_name] = None

        # Step 5: Derived metrics
        _compute_derived(metrics, requested)

        output.append({
            "period_end": period_end,
            "period_type": period_type,
            "fiscal_year": fiscal_year,
            "filing": filing_form,
            "accession": accession,
            "filed_date": filed_date,
            "metrics": metrics,
        })

    return {
        "periods": output,
        "concepts_found": list(concept_data.keys()),
        "period_type": period_type,
    }


def _filter_values(values: list, statement: str, period_type: str) -> list:
    """Filter XBRL values by form type and duration."""
    filtered = []
    for v in values:
        form = v.get("form", "")

        # Filter by form
        if period_type == "FY" and form not in ("10-K", "10-K/A"):
            continue
        if period_type == "Q" and form not in ("10-Q", "10-Q/A"):
            continue

        # Balance sheet = instant (no start date, or start == end)
        if statement == "balance_sheet":
            if v.get("start") and v["start"] != v["end"]:
                continue
        else:
            # Income / Cash flow = duration, must have start
            if not v.get("start"):
                continue
            try:
                start = datetime.strptime(v["start"], "%Y-%m-%d")
                end = datetime.strptime(v["end"], "%Y-%m-%d")
                days = (end - start).days
            except (ValueError, TypeError):
                continue

            if period_type == "FY" and (days < 350 or days > 380):
                continue
            if period_type == "Q" and (days < 80 or days > 100):
                continue

        filtered.append(v)
    return filtered


def _best_match(values: list, period_end: str) -> dict:
    """Find best value for a period_end (latest filed wins)."""
    match = None
    for v in values:
        if v["end"] == period_end:
            if match is None or v.get("filed", "") > match.get("filed", ""):
                match = v
    return match


def _compute_derived(metrics: dict, requested):
    """Compute derived metrics like free_cf."""
    # Free cash flow
    should_compute = requested is None or "free_cf" in (requested if isinstance(requested, list) else (requested or "").split(","))
    if should_compute:
        ocf = metrics.get("operating_cf")
        capex = metrics.get("capex")
        if ocf and capex and ocf.get("value") is not None and capex.get("value") is not None:
            metrics["free_cf"] = {
                "value": ocf["value"] - capex["value"],
                "unit": "USD",
                "derived": True,
                "formula": "operating_cf - capex",
            }
        else:
            metrics["free_cf"] = None
