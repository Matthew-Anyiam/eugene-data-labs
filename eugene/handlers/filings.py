"""Filing list from SEC submissions."""
from eugene.sources.sec_api import fetch_submissions


def filings_handler(resolved: dict, params: dict) -> dict:
    cik = resolved["cik"]
    form_filter = params.get("form")
    date_from = params.get("from")
    date_to = params.get("to")
    limit = int(params.get("limit", 10))

    subs = fetch_submissions(cik)
    recent = subs.get("filings", {}).get("recent", {})

    forms = recent.get("form", [])
    dates = recent.get("filingDate", [])
    accessions = recent.get("accessionNumber", [])
    primary_docs = recent.get("primaryDocument", [])
    descriptions = recent.get("primaryDocDescription", [])

    form_set = set(f.strip() for f in form_filter.split(",")) if form_filter else None

    filings = []
    cik_num = cik.lstrip("0") or "0"
    for i in range(len(forms)):
        if form_set and forms[i] not in form_set:
            continue
        if date_from and dates[i] < date_from:
            continue
        if date_to and dates[i] > date_to:
            continue

        accession_flat = accessions[i].replace("-", "")
        doc = primary_docs[i] if i < len(primary_docs) else ""
        filings.append({
            "form": forms[i],
            "filed_date": dates[i],
            "accession": accessions[i],
            "description": descriptions[i] if i < len(descriptions) else None,
            "url": f"https://www.sec.gov/Archives/edgar/data/{cik_num}/{accession_flat}/{doc}" if doc else None,
        })
        if len(filings) >= limit:
            break

    return {"filings": filings, "total_available": len(forms)}
