"""CSV/JSON export of financial data."""
import csv
import io
import json


def export_financials_csv(identifier: str, extract: str = "financials", **params) -> str:
    """Generate CSV string from financials query results."""
    from eugene.router import query
    result = query(identifier, extract, **params)
    data = result.get("data", {})

    # If single extract was unwrapped
    if "periods" not in data and isinstance(data, dict):
        # data IS the financials result directly
        periods = data.get("periods", [])
    else:
        periods = data.get("periods", [])

    if not periods:
        return ""

    # Collect all concept names across all periods
    all_concepts = set()
    for period in periods:
        metrics = period.get("metrics", {})
        for k, v in metrics.items():
            if v is not None:
                all_concepts.add(k)

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    concepts_sorted = sorted(all_concepts)
    header = ["period_end", "period_type", "fiscal_year", "filing"] + concepts_sorted
    writer.writerow(header)

    # Rows
    for period in periods:
        row = [
            period.get("period_end"),
            period.get("period_type"),
            period.get("fiscal_year"),
            period.get("filing"),
        ]
        for concept in concepts_sorted:
            m = period.get("metrics", {}).get(concept)
            row.append(m.get("value") if m and isinstance(m, dict) else "")
        writer.writerow(row)

    return output.getvalue()
