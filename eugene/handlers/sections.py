"""Extract narrative sections (MD&A, risk factors, etc.) from filing HTML."""
import re
from eugene.sources.sec_api import fetch_submissions, fetch_filing_html

SECTION_PATTERNS = {
    "business": [
        r"item\s*1[.\s]*business",
        r"item\s*1[.\s]*description\s+of\s+business",
    ],
    "risk_factors": [
        r"item\s*1a[.\s]*risk\s+factors",
    ],
    "mdna": [
        r"item\s*7[.\s]*management.{0,5}s?\s+discussion",
        r"item\s*2[.\s]*management.{0,5}s?\s+discussion",  # 10-Q
    ],
    "legal": [
        r"item\s*3[.\s]*legal\s+proceedings",
        r"item\s*1[.\s]*legal\s+proceedings",  # 10-Q
    ],
}


def sections_handler(resolved: dict, params: dict) -> dict:
    """Fetch and extract narrative sections from latest filing."""
    requested = params.get("section", "mdna")
    section_names = [s.strip() for s in requested.split(",")]
    form = params.get("form", "10-K")

    # Get latest filing of requested type
    cik = resolved["cik"]
    subs = fetch_submissions(cik)
    recent = subs.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    dates = recent.get("filingDate", [])
    accessions = recent.get("accessionNumber", [])
    primary_docs = recent.get("primaryDocument", [])

    form_set = set(f.strip() for f in form.split(","))
    filing = None
    for i in range(len(forms)):
        if forms[i] in form_set:
            filing = {
                "form": forms[i],
                "filed_date": dates[i],
                "accession": accessions[i],
                "primary_doc": primary_docs[i] if i < len(primary_docs) else None,
            }
            break

    if not filing or not filing["primary_doc"]:
        return {"error": f"No {form} filing found", "sections": {}}

    # Fetch HTML
    try:
        html = fetch_filing_html(cik, filing["accession"], filing["primary_doc"])
    except Exception as e:
        return {"error": f"Failed to fetch filing: {str(e)}", "sections": {}}

    # Strip HTML tags
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)

    # Extract each section
    sections = {}
    for name in section_names:
        extracted = _extract_section(text, name)
        if extracted:
            sections[name] = {
                "text": extracted[:50000],
                "char_count": len(extracted),
                "truncated": len(extracted) >= 50000,
            }
        else:
            sections[name] = {"text": None, "reason": f"Section '{name}' not found"}

    return {
        "filing": {
            "form": filing["form"],
            "filed_date": filing["filed_date"],
            "accession": filing["accession"],
        },
        "sections": sections,
    }


def _extract_section(text: str, section: str) -> str:
    """Find section boundaries using regex."""
    patterns = SECTION_PATTERNS.get(section, [])
    if not patterns:
        return None

    start_idx = None
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            start_idx = match.start()
            break

    if start_idx is None:
        return None

    # Find next "Item N" to bound the section
    remaining = text[start_idx + 50:]
    next_item = re.search(r"item\s+\d", remaining, re.IGNORECASE)
    if next_item:
        end_idx = start_idx + 50 + next_item.start()
    else:
        end_idx = min(start_idx + 50000, len(text))

    return text[start_idx:end_idx].strip()
