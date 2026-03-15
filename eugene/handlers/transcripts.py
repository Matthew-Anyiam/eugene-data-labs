"""Earnings call transcript extraction from 8-K filings."""
import re
import logging

from eugene.sources.sec_api import fetch_submissions, fetch_filing_html
from eugene.sources.transcripts import (
    _contains_transcript,
    _extract_quarter,
    _extract_management_remarks,
    _extract_qa_section,
    _extract_guidance,
    _extract_key_metrics,
    _analyze_tone,
)

logger = logging.getLogger(__name__)


def transcripts_handler(resolved: dict, params: dict) -> dict:
    """Extract earnings call transcripts from recent 8-K filings."""
    cik = resolved["cik"]
    ticker = resolved.get("ticker", "")
    company = resolved.get("company", "")
    limit = int(params.get("limit", 3))

    # Get submissions to find 8-K filings
    subs = fetch_submissions(cik)
    recent = subs.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    dates = recent.get("filingDate", [])
    accessions = recent.get("accessionNumber", [])
    primary_docs = recent.get("primaryDocument", [])

    # Filter to 8-K filings
    eightk_indices = [
        i for i, f in enumerate(forms) if f == "8-K"
    ]

    transcripts = []
    for idx in eightk_indices:
        if len(transcripts) >= limit:
            break

        accession = accessions[idx]
        primary_doc = primary_docs[idx]
        filing_date = dates[idx]

        if not primary_doc:
            continue

        try:
            html = fetch_filing_html(cik, accession, primary_doc)
            # Strip HTML tags
            text = re.sub(r"<[^>]+>", " ", html)
            text = re.sub(r"\s+", " ", text)

            if _contains_transcript(text):
                quarter = _extract_quarter(text, filing_date)
                mgmt = _extract_management_remarks(text)
                qa = _extract_qa_section(text)
                guidance = _extract_guidance(text)
                metrics = _extract_key_metrics(text)
                tone = _analyze_tone(text)

                transcripts.append({
                    "ticker": ticker,
                    "company": company,
                    "quarter": quarter,
                    "filing_date": filing_date,
                    "accession": accession,
                    "management_remarks": mgmt,
                    "qa_section": qa,
                    "guidance_statements": guidance,
                    "key_metrics_mentioned": metrics,
                    "overall_tone": tone["overall_tone"],
                    "confidence_score": tone["confidence_score"],
                    "word_count": len(text.split()),
                    "guidance_count": len(guidance),
                })
        except Exception as e:
            logger.debug("Skipping 8-K %s: %s", accession, e)
            continue

    return {
        "transcripts": transcripts,
        "count": len(transcripts),
        "filings_scanned": len(eightk_indices),
        "source": "SEC EDGAR 8-K filings",
    }
