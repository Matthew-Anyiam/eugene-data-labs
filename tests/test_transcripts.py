"""Tests for transcripts handler."""


MOCK_SUBMISSIONS = {
    "cik": "320193",
    "name": "Apple Inc.",
    "filings": {
        "recent": {
            "form": ["8-K", "10-Q", "8-K", "8-K"],
            "filingDate": ["2025-01-30", "2025-01-15", "2025-01-05", "2024-10-31"],
            "accessionNumber": ["0000320193-25-000001", "0000320193-25-000002", "0000320193-25-000003", "0000320193-24-000004"],
            "primaryDocument": ["doc1.htm", "filing.htm", "doc3.htm", "doc4.htm"],
        }
    },
}

TRANSCRIPT_HTML = """
<html><body>
<p>Apple Inc. Q1 2025 Earnings Call Transcript</p>
<p>Conference Call Participants:</p>
<p>Tim Cook, CEO: We delivered outstanding results this quarter with strong growth
across all our product categories. Revenue exceeded our expectations.</p>
<p>Q&A Session</p>
<p>Analyst: Can you provide guidance on next quarter?</p>
<p>Tim Cook, CEO: We expect continued momentum going forward and anticipate
strong performance in the services segment. We forecast growth in the range of
5-7 percent for the next quarter.</p>
</body></html>
"""

NON_TRANSCRIPT_HTML = """
<html><body>
<p>Item 2.02 Results of Operations and Financial Condition</p>
<p>The company reported revenue of $100 billion for the quarter.</p>
</body></html>
"""


def test_transcripts_handler_finds_transcripts(monkeypatch):
    from eugene.handlers.transcripts import transcripts_handler

    monkeypatch.setattr(
        "eugene.handlers.transcripts.fetch_submissions",
        lambda cik: MOCK_SUBMISSIONS,
    )

    call_count = {"n": 0}

    def mock_fetch_html(cik, accession, doc):
        call_count["n"] += 1
        if accession == "0000320193-25-000001":
            return TRANSCRIPT_HTML
        return NON_TRANSCRIPT_HTML

    monkeypatch.setattr(
        "eugene.handlers.transcripts.fetch_filing_html",
        mock_fetch_html,
    )

    resolved = {"cik": "320193", "ticker": "AAPL", "company": "Apple Inc."}
    result = transcripts_handler(resolved, {"limit": "3"})

    assert result["count"] >= 1
    assert result["filings_scanned"] == 3  # only 8-Ks
    t = result["transcripts"][0]
    assert t["ticker"] == "AAPL"
    assert t["overall_tone"] in ("confident", "neutral", "cautious")
    assert t["word_count"] > 0


def test_transcripts_handler_no_transcripts(monkeypatch):
    from eugene.handlers.transcripts import transcripts_handler

    monkeypatch.setattr(
        "eugene.handlers.transcripts.fetch_submissions",
        lambda cik: MOCK_SUBMISSIONS,
    )
    monkeypatch.setattr(
        "eugene.handlers.transcripts.fetch_filing_html",
        lambda cik, acc, doc: NON_TRANSCRIPT_HTML,
    )

    resolved = {"cik": "320193", "ticker": "AAPL", "company": "Apple Inc."}
    result = transcripts_handler(resolved, {"limit": "5"})

    assert result["count"] == 0
    assert result["transcripts"] == []


def test_transcripts_handler_resilient_to_fetch_errors(monkeypatch):
    from eugene.handlers.transcripts import transcripts_handler

    monkeypatch.setattr(
        "eugene.handlers.transcripts.fetch_submissions",
        lambda cik: MOCK_SUBMISSIONS,
    )

    def mock_fetch_fail(cik, accession, doc):
        raise ConnectionError("timeout")

    monkeypatch.setattr(
        "eugene.handlers.transcripts.fetch_filing_html",
        mock_fetch_fail,
    )

    resolved = {"cik": "320193", "ticker": "AAPL", "company": "Apple Inc."}
    result = transcripts_handler(resolved, {"limit": "3"})

    # Should return empty, not crash
    assert result["count"] == 0
    assert result["filings_scanned"] == 3


def test_contains_transcript():
    from eugene.sources.transcripts import _contains_transcript

    assert _contains_transcript("This is our earnings call transcript. Q&A session follows.")
    assert not _contains_transcript("Item 2.02 Results of Operations")


def test_extract_guidance():
    from eugene.sources.transcripts import _extract_guidance

    text = "We expect revenue to grow 10% next year. The weather was nice. We anticipate strong margins and continued momentum going forward in our core business."
    guidance = _extract_guidance(text)
    assert len(guidance) >= 2


def test_analyze_tone():
    from eugene.sources.transcripts import _analyze_tone

    positive_text = "We delivered strong outstanding excellent growth record results this quarter"
    result = _analyze_tone(positive_text)
    assert result["overall_tone"] == "confident"

    negative_text = "We faced challenging difficult pressure uncertain weakness decline this quarter"
    result = _analyze_tone(negative_text)
    assert result["overall_tone"] == "cautious"
