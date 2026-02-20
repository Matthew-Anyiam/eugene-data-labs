"""Exhibit list from SEC filing index."""
from eugene.sources.sec_api import fetch_submissions


def exhibits_handler(resolved: dict, params: dict) -> dict:
    """List exhibits from recent filings. Full exhibit parsing is v1."""
    cik = resolved["cik"]
    form_filter = params.get("form", "10-K")
    limit = int(params.get("limit", 5))

    subs = fetch_submissions(cik)
    recent = subs.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    dates = recent.get("filingDate", [])
    accessions = recent.get("accessionNumber", [])
    primary_docs = recent.get("primaryDocument", [])
    descriptions = recent.get("primaryDocDescription", [])

    form_set = set(f.strip() for f in form_filter.split(","))
    cik_num = cik.lstrip("0") or "0"

    filings_with_docs = []
    for i in range(len(forms)):
        if forms[i] not in form_set:
            continue
        accession_flat = accessions[i].replace("-", "")
        filings_with_docs.append({
            "form": forms[i],
            "filed_date": dates[i],
            "accession": accessions[i],
            "index_url": f"https://www.sec.gov/Archives/edgar/data/{cik_num}/{accession_flat}/",
            "primary_doc": primary_docs[i] if i < len(primary_docs) else None,
            "description": descriptions[i] if i < len(descriptions) else None,
        })
        if len(filings_with_docs) >= limit:
            break

    return {
        "filings": filings_with_docs,
        "note": "Visit index_url to see all exhibits for each filing. Full exhibit parsing coming in v1.",
    }
