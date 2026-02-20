"""Raw XBRL concept time series from SEC companyfacts."""
from eugene.sources.sec_api import fetch_companyfacts


def concepts_handler(resolved: dict, params: dict) -> dict:
    """Fetch raw time series for any XBRL concept tag."""
    cik = resolved["cik"]
    concept = params.get("concept")
    if not concept:
        return {"error": "concept parameter required (e.g. concept=Revenues)"}

    tags = [t.strip() for t in concept.split(",")]
    limit = int(params.get("limit", 20))
    form_filter = params.get("form")

    raw = fetch_companyfacts(cik)
    us_gaap = raw.get("facts", {}).get("us-gaap", {})
    dei = raw.get("facts", {}).get("dei", {})

    results = {}
    for tag in tags:
        tag_data = us_gaap.get(tag, {}) or dei.get(tag, {})
        if not tag_data:
            results[tag] = {"error": f"Tag '{tag}' not found"}
            continue

        all_values = []
        for unit_key, values in tag_data.get("units", {}).items():
            for v in values:
                if form_filter and v.get("form") not in form_filter.split(","):
                    continue
                all_values.append({
                    "value": v.get("val"),
                    "unit": unit_key,
                    "period_end": v.get("end"),
                    "period_start": v.get("start"),
                    "filed": v.get("filed"),
                    "form": v.get("form"),
                    "accession": v.get("accn"),
                    "fiscal_year": v.get("fy"),
                    "fiscal_period": v.get("fp"),
                })

        # Sort by period_end descending
        all_values.sort(key=lambda x: x.get("period_end", ""), reverse=True)
        results[tag] = {
            "values": all_values[:limit],
            "total": len(all_values),
            "description": tag_data.get("label", ""),
        }

    return {"concepts": results}
