"""
Eugene Intelligence - Earnings Transcripts
Parse 8-K filings for earnings call transcripts and management guidance.
"""
import re
import logging
from typing import Optional, Dict, List
from eugene.config import Config, get_config

logger = logging.getLogger(__name__)

def get_earnings_transcript(ticker: str, quarter: str = None) -> Optional[Dict]:
    """
    Get earnings transcript from SEC 8-K filings.

    Args:
        ticker: Stock ticker symbol
        quarter: Specific quarter (optional)

    Returns:
        Dictionary with transcript data or None if not found
    """
    try:
        from eugene.sources.edgar import EDGARClient

        config = get_config()
        edgar = EDGARClient(config)

        # Get company info
        company = edgar.get_company(ticker)

        # Search recent 8-K filings for transcripts
        filings_8k = edgar.get_filings(ticker, filing_type="8-K", limit=10)

        for filing in filings_8k:
            try:
                # Get filing content
                html_content = edgar.get_filing_content(filing)
                text_content = edgar.extract_text_from_html(html_content)

                # Check if this filing contains a transcript
                if _contains_transcript(text_content):
                    return _parse_transcript(
                        text_content, ticker, company.name, filing
                    )

            except Exception as e:
                logger.warning(f"Failed to process filing {filing.accession_number}: {e}")
                continue

        logger.info(f"No earnings transcript found for {ticker}")
        return None

    except Exception as e:
        logger.error(f"Failed to get earnings transcript for {ticker}: {e}")
        return None

def _contains_transcript(text: str) -> bool:
    """Check if filing text contains a transcript."""
    text_lower = text.lower()

    # Look for transcript indicators
    transcript_keywords = [
        'transcript', 'prepared remarks', 'conference call', 'earnings call',
        'q&a session', 'question and answer', 'management discussion'
    ]

    for keyword in transcript_keywords:
        if keyword in text_lower:
            # Additional validation - should have Q&A or speaker patterns
            if any(pattern in text_lower for pattern in ['q&a', 'question:', 'analyst:']):
                return True
            # Or management speaker patterns
            if any(title in text_lower for title in ['ceo:', 'cfo:', 'president:']):
                return True

    return False

def _parse_transcript(text: str, ticker: str, company_name: str, filing) -> Dict:
    """Parse transcript content from filing text."""
    try:
        # Extract quarter information
        quarter = _extract_quarter(text, filing.filing_date)

        # Parse management remarks
        management_remarks = _extract_management_remarks(text)

        # Parse Q&A section
        qa_section = _extract_qa_section(text)

        # Extract guidance statements
        guidance_statements = _extract_guidance(text)

        # Extract key metrics
        key_metrics = _extract_key_metrics(text)

        # Analyze tone
        tone_analysis = _analyze_tone(text)

        return {
            "ticker": ticker,
            "company_name": company_name,
            "quarter": quarter,
            "filing_date": filing.filing_date,
            "source_url": filing.filing_url,
            "accession_number": filing.accession_number,
            "management_remarks": management_remarks,
            "qa_section": qa_section,
            "guidance_statements": guidance_statements,
            "key_metrics_mentioned": key_metrics,
            "overall_tone": tone_analysis["overall_tone"],
            "confidence_score": tone_analysis["confidence_score"],
            "word_count": len(text.split()),
            "guidance_count": len(guidance_statements)
        }

    except Exception as e:
        logger.error(f"Failed to parse transcript: {e}")
        return {}

def _extract_quarter(text: str, filing_date: str) -> str:
    """Extract quarter information."""
    # Look for explicit quarter mentions
    quarter_pattern = r'(Q[1-4]\s+20\d{2})'
    match = re.search(quarter_pattern, text, re.IGNORECASE)
    if match:
        return match.group(1)

    # Fallback: estimate from filing date
    try:
        from datetime import datetime
        filing_dt = datetime.fromisoformat(filing_date.replace('Z', '+00:00'))
        year = filing_dt.year
        month = filing_dt.month

        if month <= 3:
            return f"Q4 {year - 1}"
        elif month <= 6:
            return f"Q1 {year}"
        elif month <= 9:
            return f"Q2 {year}"
        else:
            return f"Q3 {year}"
    except:
        return "Unknown"

def _extract_management_remarks(text: str) -> List[Dict]:
    """Extract management prepared remarks."""
    remarks = []

    # Look for speaker patterns
    speaker_pattern = r'([A-Z][a-zA-Z\s.-]+(?:CEO|CFO|COO|President)):\s*([^\n:]+(?:\n(?![A-Z][a-zA-Z\s.-]+:)[^\n]*)*)'

    matches = re.findall(speaker_pattern, text, re.MULTILINE)

    for match in matches:
        speaker_info = match[0].strip()
        speech_text = match[1].strip()

        if len(speech_text) > 50:
            remarks.append({
                "speaker": speaker_info,
                "text": speech_text[:1000]  # Limit length
            })

    return remarks

def _extract_qa_section(text: str) -> List[Dict]:
    """Extract Q&A exchanges."""
    qa_exchanges = []

    # Look for analyst questions
    analyst_pattern = r'([A-Z][a-zA-Z\s.-]+),\s+([A-Z][a-zA-Z\s&.-]+):\s*([^\n:]+(?:\n(?![A-Z][a-zA-Z\s.-]+[:,])[^\n]*)*)'

    matches = re.findall(analyst_pattern, text, re.MULTILINE)

    for match in matches:
        analyst_name = match[0].strip()
        firm_name = match[1].strip()
        question_text = match[2].strip()

        if len(question_text) > 20:
            qa_exchanges.append({
                "analyst": analyst_name,
                "firm": firm_name,
                "question": question_text[:500],
                "answer": ""  # Would need more complex parsing to match answers
            })

    return qa_exchanges

def _extract_guidance(text: str) -> List[str]:
    """Extract forward-looking guidance statements."""
    guidance_statements = []

    guidance_keywords = [
        'expect', 'anticipate', 'forecast', 'guidance', 'outlook',
        'target', 'looking ahead', 'going forward'
    ]

    sentences = re.split(r'[.!?]+', text)

    for sentence in sentences:
        sentence = sentence.strip()

        # Check if sentence contains guidance keywords
        has_guidance = any(keyword in sentence.lower() for keyword in guidance_keywords)

        if has_guidance and len(sentence) > 30:
            guidance_statements.append(sentence[:300])

    return guidance_statements

def _extract_key_metrics(text: str) -> Dict[str, str]:
    """Extract key financial metrics mentioned."""
    metrics = {}

    # Revenue patterns
    revenue_match = re.search(r'revenue.{0,50}?\$?(\d+(?:\.\d+)?)\s*(?:billion|million|B|M)', text, re.IGNORECASE)
    if revenue_match:
        metrics['revenue'] = revenue_match.group(0)

    # EPS patterns
    eps_match = re.search(r'earnings per share.{0,50}?\$?(\d+(?:\.\d+)?)', text, re.IGNORECASE)
    if eps_match:
        metrics['eps'] = eps_match.group(0)

    # Margin patterns
    margin_match = re.search(r'(?:gross|operating|profit)\s+margin.{0,50}?(\d+(?:\.\d+)?%)', text, re.IGNORECASE)
    if margin_match:
        metrics['margin'] = margin_match.group(0)

    return metrics

def _analyze_tone(text: str) -> Dict:
    """Analyze overall tone and sentiment."""

    positive_words = {
        'strong', 'excellent', 'outstanding', 'confident', 'optimistic',
        'growth', 'exceeded', 'beat', 'record', 'solid'
    }

    negative_words = {
        'challenging', 'difficult', 'pressure', 'cautious', 'uncertain',
        'weakness', 'decline', 'disappointing', 'missed', 'struggle'
    }

    words = text.lower().split()

    positive_count = sum(1 for word in words if word in positive_words)
    negative_count = sum(1 for word in words if word in negative_words)
    total_words = len(words)

    positive_score = (positive_count / total_words) * 100 if total_words > 0 else 0
    negative_score = (negative_count / total_words) * 100 if total_words > 0 else 0

    # Determine overall tone
    if positive_score > negative_score * 1.5:
        overall_tone = "confident"
        confidence_score = min(80 + (positive_score - negative_score) * 5, 95)
    elif negative_score > positive_score * 1.5:
        overall_tone = "cautious"
        confidence_score = max(20, 60 - (negative_score - positive_score) * 5)
    else:
        overall_tone = "neutral"
        confidence_score = 50

    return {
        "overall_tone": overall_tone,
        "confidence_score": confidence_score
    }