"""Segmented revenue data from XBRL dimensions."""
from eugene.sources.sec_api import fetch_companyfacts
from eugene.concepts import CANONICAL_CONCEPTS


REVENUE_TAGS = CANONICAL_CONCEPTS["revenue"]["tags"]


def segments_handler(resolved: dict, params: dict) -> dict:
    """Extract segmented revenue from XBRL segment dimensions."""
    cik = resolved["cik"]
    period_type = params.get("period", "FY").upper()
    limit = int(params.get("limit", 5))

    raw = fetch_companyfacts(cik)
    us_gaap = raw.get("facts", {}).get("us-gaap", {})

    business = {}
    geographic = {}

    for tag in REVENUE_TAGS:
        tag_data = us_gaap.get(tag, {})
        values = tag_data.get("units", {}).get("USD", [])

        for v in values:
            form = v.get("form", "")
            if period_type == "FY" and form not in ("10-K", "10-K/A"):
                continue
            if period_type == "Q" and form not in ("10-Q", "10-Q/A"):
                continue

            # Only include segmented data (has dimensions)
            segments = v.get("segments")
            if not segments:
                continue

            period_end = v.get("end")
            if not period_end:
                continue

            for axis, member in segments.items():
                axis_short = axis.split(":")[-1] if ":" in axis else axis
                member_short = member.split(":")[-1] if ":" in member else member

                if "BusinessSegments" in axis_short or "ProductOrService" in axis_short:
                    bucket = business
                elif "Geographical" in axis_short:
                    bucket = geographic
                else:
                    continue

                if period_end not in bucket:
                    bucket[period_end] = {}

                bucket[period_end][member_short] = {
                    "value": v.get("val"),
                    "unit": "USD",
                    "source_tag": f"us-gaap:{tag}",
                    "axis": axis_short,
                }

    # Sort and limit
    for bucket in (business, geographic):
        periods_sorted = sorted(bucket.keys(), reverse=True)[:limit]
        for k in list(bucket.keys()):
            if k not in periods_sorted:
                del bucket[k]

    return {
        "ticker": resolved.get("ticker"),
        "business_segments": business,
        "geographic_segments": geographic,
        "period_type": period_type,
    }
