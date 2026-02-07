"""
Eugene Intelligence - Earnings Transcripts Parser
Extracts and analyzes earnings call transcripts from SEC 8-K filings.
Critical for understanding management guidance, sentiment, and forward-looking statements.
"""
import json
import logging
import re
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from eugene.config import Config, get_config
from eugene.models.sources import SourceCitation, CitedValue, SourcedResponse, SourceType

logger = logging.getLogger(__name__)

@dataclass
class ManagementRemark:
    """A single management remark from earnings call."""
    speaker: str
    title: str  # CEO, CFO, etc.
    text: str
    timestamp: Optional[str] = None

@dataclass
class QAExchange:
    """Question and answer exchange from earnings call."""
    analyst: str
    firm: str
    question: str
    answer: str
    answerer: str  # Which executive answered
    sentiment: str = "neutral"  # positive, negative, neutral

@dataclass
class GuidanceStatement:
    """Forward-looking guidance statement."""
    statement: str
    metric: str  # revenue, eps, margin, etc.
    period: str  # Q4 2025, FY 2025, etc.
    value_range: Optional[str] = None  # "10-12%", "$50-55B"
    confidence_level: str = "medium"  # high, medium, low

@dataclass
class EarningsTranscript:
    """Complete earnings call transcript analysis."""
    ticker: str
    company_name: str
    quarter: str
    filing_date: str
    source_url: str
    accession_number: str

    # Content sections
    management_remarks: List[ManagementRemark]
    qa_section: List[QAExchange]
    guidance_statements: List[GuidanceStatement]

    # Extracted metrics
    key_metrics_mentioned: Dict[str, str]

    # Analysis
    overall_tone: str  # confident, cautious, defensive, mixed
    confidence_score: float  # 0-100
    guidance_count: int

    # Metadata
    word_count: int
    executive_speakers: List[str]
    analyst_firms: List[str]

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)

class EarningsTranscriptExtractor:
    """Extracts and analyzes earnings transcripts from SEC filings."""

    def __init__(self, config=None):
        self.config = config or get_config()
        self._edgar = None

        # Transcript indicators in 8-K filings
        self.transcript_keywords = [
            'transcript', 'prepared remarks', 'conference call', 'earnings call',
            'q&a session', 'question and answer', 'management discussion',
            'call transcript', 'earnings conference'
        ]

        # Common executive titles for speaker identification
        self.exec_titles = {
            'ceo', 'chief executive officer', 'president',
            'cfo', 'chief financial officer', 'treasurer',
            'coo', 'chief operating officer', 'operations',
            'cmo', 'chief marketing officer', 'marketing',
            'cto', 'chief technology officer', 'technology'
        }

        # Guidance keywords for forward-looking statements
        self.guidance_keywords = [
            'expect', 'anticipate', 'forecast', 'project', 'estimate',
            'guidance', 'outlook', 'target', 'goal', 'plan',
            'looking ahead', 'going forward', 'we believe',
            'guidance range', 'full year', 'next quarter'
        ]

        # Sentiment indicators
        self.positive_words = {
            'strong', 'excellent', 'outstanding', 'robust', 'solid',
            'confident', 'optimistic', 'growth', 'momentum', 'success',
            'exceeded', 'beat', 'outperform', 'record', 'best'
        }

        self.negative_words = {
            'challenging', 'difficult', 'pressure', 'headwinds', 'concerns',
            'cautious', 'uncertain', 'weakness', 'decline', 'disappointing',
            'missed', 'below', 'shortfall', 'struggle', 'risk'
        }

    @property
    def edgar(self):
        if self._edgar is None:
            from eugene.sources.edgar import EDGARClient
            self._edgar = EDGARClient(self.config)
        return self._edgar

    def get_earnings_transcript(self, ticker: str, quarter: str = None) -> Optional[EarningsTranscript]:
        """
        Get earnings transcript for a company and quarter.

        Args:
            ticker: Stock ticker symbol
            quarter: Specific quarter (e.g., "Q1 2025") or None for most recent

        Returns:
            EarningsTranscript object or None if not found
        """
        try:
            ticker = ticker.upper()
            company = self.edgar.get_company(ticker)

            # Search for recent 8-K filings that might contain transcripts
            filings_8k = self.edgar.get_filings(ticker, filing_type="8-K", limit=20)

            for filing in filings_8k:
                try:
                    # Get filing content
                    html_content = self.edgar.get_filing_content(filing)
                    text_content = self.edgar.extract_text_from_html(html_content)

                    # Check if this filing contains a transcript
                    if self._contains_transcript(text_content):
                        transcript = self._parse_transcript(
                            text_content, ticker, company.name, filing
                        )

                        if transcript and (quarter is None or transcript.quarter == quarter):
                            return transcript

                except Exception as e:
                    logger.warning(f"Failed to process filing {filing.accession_number}: {e}")
                    continue

            logger.info(f"No earnings transcript found for {ticker} {quarter or 'recent'}")
            return None

        except Exception as e:
            logger.error(f"Failed to get earnings transcript for {ticker}: {e}")
            return None

    def _contains_transcript(self, text: str) -> bool:
        """Check if filing text contains a transcript."""
        text_lower = text.lower()

        # Look for transcript indicators
        for keyword in self.transcript_keywords:
            if keyword in text_lower:
                # Additional validation - should have Q&A or speaker patterns
                if any(pattern in text_lower for pattern in ['q&a', 'question:', 'analyst:']):
                    return True

                # Or management speaker patterns
                if any(title in text_lower for title in ['ceo:', 'cfo:', 'president:']):
                    return True

        return False

    def _parse_transcript(self, text: str, ticker: str, company_name: str, filing) -> Optional[EarningsTranscript]:
        """Parse transcript content from filing text."""
        try:
            # Extract quarter information
            quarter = self._extract_quarter(text, filing.filing_date)

            # Parse management remarks section
            management_remarks = self._extract_management_remarks(text)

            # Parse Q&A section
            qa_section = self._extract_qa_section(text)

            # Extract guidance statements
            guidance_statements = self.extract_guidance(text)

            # Extract key metrics mentioned
            key_metrics = self._extract_key_metrics(text)

            # Analyze tone and sentiment
            tone_analysis = self.analyze_tone(text)

            # Get executive speakers
            executives = list(set([remark.speaker for remark in management_remarks]))

            # Get analyst firms
            firms = list(set([qa.firm for qa in qa_section if qa.firm]))

            transcript = EarningsTranscript(
                ticker=ticker,
                company_name=company_name,
                quarter=quarter,
                filing_date=filing.filing_date,
                source_url=filing.filing_url,
                accession_number=filing.accession_number,
                management_remarks=management_remarks,
                qa_section=qa_section,
                guidance_statements=guidance_statements,
                key_metrics_mentioned=key_metrics,
                overall_tone=tone_analysis['overall_tone'],
                confidence_score=tone_analysis['confidence_score'],
                guidance_count=len(guidance_statements),
                word_count=len(text.split()),
                executive_speakers=executives,
                analyst_firms=firms
            )

            return transcript

        except Exception as e:
            logger.error(f"Failed to parse transcript: {e}")
            return None

    def _extract_quarter(self, text: str, filing_date: str) -> str:
        """Extract quarter information from transcript text."""
        # Look for explicit quarter mentions
        quarter_patterns = [
            r'(Q[1-4]\s+20\d{2})',
            r'(first|second|third|fourth)\s+quarter\s+(20\d{2})',
            r'(Q[1-4])\s+(20\d{2})'
        ]

        for pattern in quarter_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                match = matches[0]
                if isinstance(match, tuple):
                    if match[0].startswith(('Q', 'q')):
                        return f"{match[0].upper()} {match[1]}"
                    else:
                        quarter_map = {
                            'first': 'Q1', 'second': 'Q2',
                            'third': 'Q3', 'fourth': 'Q4'
                        }
                        return f"{quarter_map.get(match[0].lower(), 'Q1')} {match[1]}"
                else:
                    return match

        # Fallback: estimate from filing date
        try:
            filing_dt = datetime.fromisoformat(filing_date.replace('Z', '+00:00'))
            year = filing_dt.year
            month = filing_dt.month

            if month <= 3:
                return f"Q4 {year - 1}"  # Q4 results typically filed in Q1
            elif month <= 6:
                return f"Q1 {year}"
            elif month <= 9:
                return f"Q2 {year}"
            else:
                return f"Q3 {year}"
        except:
            return "Unknown"

    def _extract_management_remarks(self, text: str) -> List[ManagementRemark]:
        """Extract management prepared remarks."""
        remarks = []

        try:
            # Look for speaker patterns like "John Smith, CEO:" or "CEO Smith:"
            speaker_pattern = r'([A-Z][a-zA-Z\s.-]+(?:CEO|CFO|COO|CTO|President|Chief[^:]*)):\s*([^:]+(?::(?![A-Z][a-zA-Z\s.-]+(?:CEO|CFO|COO|CTO|President|Chief)).*?))(?=\n[A-Z][a-zA-Z\s.-]+(?:CEO|CFO|COO|CTO|President|Chief)|$)'

            matches = re.findall(speaker_pattern, text, re.MULTILINE | re.DOTALL)

            for match in matches:
                speaker_info = match[0].strip()
                speech_text = match[1].strip()

                # Extract name and title
                speaker_name, title = self._parse_speaker_info(speaker_info)

                if len(speech_text) > 50:  # Filter out very short statements
                    remarks.append(ManagementRemark(
                        speaker=speaker_name,
                        title=title,
                        text=speech_text[:2000]  # Limit length
                    ))

        except Exception as e:
            logger.warning(f"Failed to extract management remarks: {e}")

        return remarks

    def _extract_qa_section(self, text: str) -> List[QAExchange]:
        """Extract Q&A exchanges."""
        qa_exchanges = []

        try:
            # Look for Q&A section
            qa_start_patterns = [
                r'questions?\s+and\s+answers?',
                r'q\s*&\s*a',
                r'analyst\s+questions?',
                r'question\s+and\s+answer'
            ]

            qa_start_pos = -1
            for pattern in qa_start_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    qa_start_pos = match.start()
                    break

            if qa_start_pos == -1:
                return qa_exchanges

            qa_text = text[qa_start_pos:]

            # Look for analyst questions
            # Pattern: "Analyst Name, Firm: Question text"
            analyst_pattern = r'([A-Z][a-zA-Z\s.-]+),\s+([A-Z][a-zA-Z\s&.-]+):\s*([^:]+?)(?=(?:[A-Z][a-zA-Z\s.-]+(?:CEO|CFO|COO|President|Chief)|[A-Z][a-zA-Z\s.-]+,\s+[A-Z][a-zA-Z\s&.-]+:)|$)'

            analyst_matches = re.findall(analyst_pattern, qa_text, re.MULTILINE | re.DOTALL)

            for i, match in enumerate(analyst_matches):
                analyst_name = match[0].strip()
                firm_name = match[1].strip()
                question_text = match[2].strip()

                # Try to find the corresponding answer
                answer_text = ""
                answerer = "Management"

                # Look for management response after this question
                if i + 1 < len(analyst_matches):
                    # Answer is between this question and next question
                    next_question_pos = qa_text.find(analyst_matches[i + 1][0])
                    current_question_pos = qa_text.find(question_text)

                    if current_question_pos != -1 and next_question_pos != -1:
                        potential_answer = qa_text[current_question_pos + len(question_text):next_question_pos]

                        # Look for executive response
                        exec_response = re.search(r'([A-Z][a-zA-Z\s.-]+(?:CEO|CFO|COO|President|Chief[^:]*)):\s*([^:]+)', potential_answer)
                        if exec_response:
                            answerer = exec_response.group(1).strip()
                            answer_text = exec_response.group(2).strip()

                if len(question_text) > 20:  # Filter very short questions
                    qa_exchanges.append(QAExchange(
                        analyst=analyst_name,
                        firm=firm_name,
                        question=question_text[:1000],  # Limit length
                        answer=answer_text[:1000],      # Limit length
                        answerer=answerer
                    ))

        except Exception as e:
            logger.warning(f"Failed to extract Q&A section: {e}")

        return qa_exchanges

    def _parse_speaker_info(self, speaker_info: str) -> Tuple[str, str]:
        """Parse speaker name and title."""
        # Common patterns: "John Smith, CEO" or "CEO John Smith"

        for title in self.exec_titles:
            title_upper = title.upper()
            if title_upper in speaker_info.upper():
                # Remove title to get name
                name = re.sub(r'[,\s]*' + re.escape(title_upper) + r'[,\s]*', ' ', speaker_info, flags=re.IGNORECASE)
                name = ' '.join(name.split())  # Clean whitespace
                return name or "Unknown", title_upper

        # Fallback
        return speaker_info, "Executive"

    def extract_guidance(self, text: str) -> List[GuidanceStatement]:
        """Extract forward-looking guidance statements."""
        guidance_statements = []

        try:
            sentences = re.split(r'[.!?]+', text)

            for sentence in sentences:
                sentence = sentence.strip()

                # Check if sentence contains guidance keywords
                has_guidance_keyword = any(keyword in sentence.lower() for keyword in self.guidance_keywords)

                if has_guidance_keyword and len(sentence) > 30:
                    # Look for specific metrics and numbers
                    metric = self._identify_metric(sentence)
                    period = self._identify_period(sentence)
                    value_range = self._extract_value_range(sentence)

                    confidence = self._assess_confidence(sentence)

                    guidance_statements.append(GuidanceStatement(
                        statement=sentence[:500],  # Limit length
                        metric=metric,
                        period=period,
                        value_range=value_range,
                        confidence_level=confidence
                    ))

        except Exception as e:
            logger.warning(f"Failed to extract guidance: {e}")

        return guidance_statements

    def _identify_metric(self, text: str) -> str:
        """Identify the financial metric being discussed."""
        text_lower = text.lower()

        metric_keywords = {
            'revenue': ['revenue', 'sales', 'net sales', 'total revenue'],
            'earnings': ['earnings', 'eps', 'earnings per share', 'net income'],
            'margin': ['margin', 'gross margin', 'operating margin', 'profit margin'],
            'cash_flow': ['cash flow', 'free cash flow', 'operating cash flow'],
            'growth': ['growth', 'growth rate', 'year-over-year'],
            'capex': ['capital expenditure', 'capex', 'capital spending']
        }

        for metric, keywords in metric_keywords.items():
            if any(keyword in text_lower for keyword in keywords):
                return metric

        return 'general'

    def _identify_period(self, text: str) -> str:
        """Identify the time period for guidance."""
        text_lower = text.lower()

        # Look for period indicators
        period_patterns = [
            r'(q[1-4]\s+20\d{2})',
            r'(full\s+year\s+20\d{2})',
            r'(fy\s*20\d{2})',
            r'(fiscal\s+20\d{2})',
            r'(20\d{2})',
            r'(next\s+quarter)',
            r'(next\s+year)',
            r'(this\s+quarter)',
            r'(this\s+year)'
        ]

        for pattern in period_patterns:
            match = re.search(pattern, text_lower)
            if match:
                return match.group(1)

        return 'unspecified'

    def _extract_value_range(self, text: str) -> Optional[str]:
        """Extract numerical ranges or values."""
        # Look for percentage ranges: "10-12%", "between 5% and 7%"
        percent_pattern = r'(\d+(?:\.\d+)?%?\s*(?:-|to|and)\s*\d+(?:\.\d+)?%)|(\d+(?:\.\d+)?%)'
        percent_match = re.search(percent_pattern, text)
        if percent_match:
            return percent_match.group(0)

        # Look for dollar amounts: "$5B-$7B", "between $100M and $150M"
        dollar_pattern = r'\$\d+(?:\.\d+)?[MBK]?\s*(?:-|to|and)\s*\$?\d+(?:\.\d+)?[MBK]?|\$\d+(?:\.\d+)?[MBK]?'
        dollar_match = re.search(dollar_pattern, text)
        if dollar_match:
            return dollar_match.group(0)

        return None

    def _assess_confidence(self, text: str) -> str:
        """Assess confidence level of guidance statement."""
        text_lower = text.lower()

        high_confidence_words = ['confident', 'expect', 'will', 'committed', 'target']
        medium_confidence_words = ['believe', 'anticipate', 'estimate', 'forecast']
        low_confidence_words = ['may', 'might', 'could', 'potentially', 'uncertain']

        if any(word in text_lower for word in high_confidence_words):
            return 'high'
        elif any(word in text_lower for word in low_confidence_words):
            return 'low'
        elif any(word in text_lower for word in medium_confidence_words):
            return 'medium'

        return 'medium'

    def analyze_tone(self, text: str) -> Dict[str, any]:
        """Analyze overall tone and sentiment of transcript."""
        try:
            words = text.lower().split()

            # Count sentiment words
            positive_count = sum(1 for word in words if word in self.positive_words)
            negative_count = sum(1 for word in words if word in self.negative_words)
            total_words = len(words)

            # Calculate sentiment scores
            positive_score = (positive_count / total_words) * 100 if total_words > 0 else 0
            negative_score = (negative_count / total_words) * 100 if total_words > 0 else 0

            # Determine overall tone
            if positive_score > negative_score * 1.5:
                overall_tone = "confident"
                confidence_score = min(80 + (positive_score - negative_score) * 5, 95)
            elif negative_score > positive_score * 1.5:
                overall_tone = "cautious"
                confidence_score = max(20, 60 - (negative_score - positive_score) * 5)
            elif abs(positive_score - negative_score) < 0.5:
                overall_tone = "mixed"
                confidence_score = 50
            else:
                overall_tone = "neutral"
                confidence_score = 60

            # Look for defensive language
            defensive_words = ['challenging', 'headwinds', 'uncertainty', 'difficult']
            if any(word in text.lower() for word in defensive_words):
                overall_tone = "defensive"
                confidence_score = max(confidence_score - 15, 25)

            return {
                'overall_tone': overall_tone,
                'confidence_score': confidence_score,
                'positive_score': positive_score,
                'negative_score': negative_score,
                'sentiment_word_count': positive_count + negative_count
            }

        except Exception as e:
            logger.warning(f"Failed to analyze tone: {e}")
            return {
                'overall_tone': 'neutral',
                'confidence_score': 50.0,
                'positive_score': 0.0,
                'negative_score': 0.0,
                'sentiment_word_count': 0
            }

    def _extract_key_metrics(self, text: str) -> Dict[str, str]:
        """Extract key financial metrics mentioned in transcript."""
        metrics = {}

        try:
            # Revenue patterns
            revenue_pattern = r'revenue.{0,50}?\$?(\d+(?:\.\d+)?)\s*(?:billion|million|B|M)'
            revenue_match = re.search(revenue_pattern, text, re.IGNORECASE)
            if revenue_match:
                metrics['revenue'] = revenue_match.group(0)

            # EPS patterns
            eps_pattern = r'earnings per share.{0,50}?\$?(\d+(?:\.\d+)?)'
            eps_match = re.search(eps_pattern, text, re.IGNORECASE)
            if eps_match:
                metrics['eps'] = eps_match.group(0)

            # Margin patterns
            margin_pattern = r'(?:gross|operating|profit)\s+margin.{0,50}?(\d+(?:\.\d+)?%)'
            margin_match = re.search(margin_pattern, text, re.IGNORECASE)
            if margin_match:
                metrics['margin'] = margin_match.group(0)

        except Exception as e:
            logger.warning(f"Failed to extract key metrics: {e}")

        return metrics

# Convenience functions
def get_latest_earnings_transcript(ticker: str) -> Optional[EarningsTranscript]:
    """Get the most recent earnings transcript for a company."""
    extractor = EarningsTranscriptExtractor()
    return extractor.get_earnings_transcript(ticker)

def get_earnings_guidance(ticker: str) -> List[GuidanceStatement]:
    """Get guidance statements from latest earnings transcript."""
    transcript = get_latest_earnings_transcript(ticker)
    return transcript.guidance_statements if transcript else []