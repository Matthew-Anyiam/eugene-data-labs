"""Extract narrative sections (MD&A, risk factors, etc.) from filing HTML."""
import html
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
        filing_html = fetch_filing_html(cik, filing["accession"], filing["primary_doc"])
    except Exception as e:
        return {"error": f"Failed to fetch filing: {str(e)}", "sections": {}}

    # Strip HTML tags and decode entities
    text = re.sub(r"<[^>]+>", " ", filing_html)
    text = html.unescape(text)
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
    """Find section boundaries using regex.

    SEC filings have a TOC followed by actual content. We find all matches of the
    section heading and pick the one followed by the most content (the real section,
    not the TOC entry).
    """
    patterns = SECTION_PATTERNS.get(section, [])
    if not patterns:
        return None

    # Find ALL matches of the heading
    candidates = []
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            candidates.append(match.start())

    if not candidates:
        return None

    # For each candidate, measure content length to next major section heading
    # Pick the one with the most content (the real section, not TOC)
    best_start = None
    best_length = 0

    end_pattern = _next_section_pattern(section)

    for start_idx in candidates:
        remaining = text[start_idx + 50:]
        # Find standalone section heading (not inline references like "in Part II, Item 8")
        # Standalone headings are preceded by whitespace/newline, not by a comma or preposition
        end_offset = None
        for m in re.finditer(end_pattern, remaining, re.IGNORECASE):
            # Check what precedes the match — skip if it's an inline reference
            before = remaining[max(0, m.start() - 15):m.start()]
            if re.search(r"(Part\s+II,?\s*|in\s+|see\s+|under\s+)", before, re.IGNORECASE):
                continue
            end_offset = m.start()
            break

        section_len = end_offset if end_offset else min(50000, len(remaining))
        if section_len > best_length:
            best_length = section_len
            best_start = start_idx

    if best_start is None:
        return None

    end_idx = best_start + 50 + best_length
    extracted = text[best_start:end_idx].strip()

    if len(extracted) < 200:
        return None

    return extracted[:50000]


def _next_section_pattern(section: str) -> str:
    """Return regex for the next major section heading after the given section."""
    patterns = {
        "business": r"item\s*1a\b",
        "risk_factors": r"item\s*(?:1b|2)\b",
        "mdna": r"item\s*(?:7a|8)\b",
        "legal": r"item\s*4\b",
    }
    return patterns.get(section, r"item\s+\d")
