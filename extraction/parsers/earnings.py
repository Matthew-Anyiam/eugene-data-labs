"""
Eugene Intelligence - Earnings Call Extraction

Extracts structured data from earnings call transcripts:
- Quantitative guidance (revenue, margins, CapEx)
- Segment commentary
- Management tone and confidence
- Risk signals
- Analyst questions and concerns

Transcripts are typically available 1-4 hours after the call ends.
"""

import os
import re
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any
from datetime import datetime
from enum import Enum


class SpeakerRole(Enum):
    CEO = "ceo"
    CFO = "cfo"
    COO = "coo"
    OTHER_EXECUTIVE = "other_executive"
    ANALYST = "analyst"
    OPERATOR = "operator"
    UNKNOWN = "unknown"


class GuidanceType(Enum):
    REVENUE = "revenue"
    EPS = "eps"
    OPERATING_INCOME = "operating_income"
    GROSS_MARGIN = "gross_margin"
    OPERATING_MARGIN = "operating_margin"
    CAPEX = "capex"
    FREE_CASH_FLOW = "free_cash_flow"
    OTHER = "other"


class GuidancePeriod(Enum):
    Q1 = "q1"
    Q2 = "q2"
    Q3 = "q3"
    Q4 = "q4"
    FULL_YEAR = "full_year"
    NEXT_QUARTER = "next_quarter"
    NEXT_YEAR = "next_year"


class ToneIndicator(Enum):
    CONFIDENT = "confident"
    CAUTIOUS = "cautious"
    UNCERTAIN = "uncertain"
    OPTIMISTIC = "optimistic"
    PESSIMISTIC = "pessimistic"
    NEUTRAL = "neutral"


@dataclass
class Speaker:
    """A speaker in the earnings call"""
    name: str
    role: SpeakerRole
    title: Optional[str] = None
    company: Optional[str] = None  # For analysts


@dataclass
class GuidanceItem:
    """A single piece of quantitative guidance"""
    metric: GuidanceType
    period: GuidancePeriod
    fiscal_year: int
    low: Optional[float] = None
    high: Optional[float] = None
    point: Optional[float] = None
    unit: str = ""  # "millions", "billions", "percent", etc.
    prior_low: Optional[float] = None
    prior_high: Optional[float] = None
    revision: Optional[str] = None  # "raised", "lowered", "maintained", "initiated"
    verbatim: Optional[str] = None
    confidence: float = 0.0


@dataclass
class SegmentCommentary:
    """Commentary about a business segment"""
    segment_name: str
    segment_type: str  # "geographic", "product", "business_unit"
    revenue_mention: Optional[str] = None
    growth_mention: Optional[str] = None
    outlook: Optional[str] = None
    key_points: List[str] = field(default_factory=list)


@dataclass
class RiskSignal:
    """A risk or concern mentioned in the call"""
    category: str  # "macro", "competition", "supply_chain", "demand", "regulatory", etc.
    description: str
    severity: str  # "low", "medium", "high"
    mentioned_by: str
    verbatim: Optional[str] = None


@dataclass
class AnalystQuestion:
    """An analyst question from Q&A"""
    analyst_name: str
    analyst_firm: Optional[str] = None
    question: str
    topic: str
    follow_up: bool = False


@dataclass
class ToneAssessment:
    """Overall tone assessment of the call"""
    overall: ToneIndicator
    ceo_tone: Optional[ToneIndicator] = None
    cfo_tone: Optional[ToneIndicator] = None
    confidence_score: float = 0.0  # 0-1
    hedging_frequency: float = 0.0  # Higher = more hedging language
    key_phrases: List[str] = field(default_factory=list)


@dataclass
class EarningsCallExtraction:
    """Complete extraction from an earnings call"""
    company_ticker: str
    company_name: str
    call_date: str
    fiscal_quarter: int
    fiscal_year: int
    
    # Extracted data
    guidance: List[GuidanceItem] = field(default_factory=list)
    segments: List[SegmentCommentary] = field(default_factory=list)
    risks: List[RiskSignal] = field(default_factory=list)
    analyst_questions: List[AnalystQuestion] = field(default_factory=list)
    tone: Optional[ToneAssessment] = None
    
    # Key quotes
    key_quotes: List[str] = field(default_factory=list)
    
    # Metadata
    call_duration_minutes: Optional[int] = None
    participants: List[Speaker] = field(default_factory=list)
    extraction_notes: Optional[str] = None


def extract_earnings_call(
    transcript_text: str,
    company_ticker: str,
    company_name: str,
    call_date: str,
    fiscal_quarter: int,
    fiscal_year: int
) -> EarningsCallExtraction:
    """
    Extract structured data from an earnings call transcript.
    
    Uses Claude to parse the transcript and extract:
    - Quantitative guidance
    - Segment commentary
    - Risk signals
    - Management tone
    
    Args:
        transcript_text: Full transcript text
        company_ticker: Stock ticker
        company_name: Company name
        call_date: Date of the call (YYYY-MM-DD)
        fiscal_quarter: Fiscal quarter (1-4)
        fiscal_year: Fiscal year
    
    Returns:
        EarningsCallExtraction with all extracted data
    """
    import anthropic
    
    client = anthropic.Anthropic()
    
    # Truncate if too long (Claude has context limits)
    max_chars = 100000
    if len(transcript_text) > max_chars:
        # Keep intro, prepared remarks, and Q&A
        transcript_text = transcript_text[:max_chars]
    
    extraction_prompt = f"""Analyze this earnings call transcript and extract structured data.

COMPANY: {company_name} ({company_ticker})
CALL DATE: {call_date}
FISCAL PERIOD: Q{fiscal_quarter} FY{fiscal_year}

TRANSCRIPT:
{transcript_text}

---

Extract the following and return as JSON:

{{
    "guidance": [
        {{
            "metric": "revenue|eps|operating_income|gross_margin|operating_margin|capex|free_cash_flow|other",
            "period": "q1|q2|q3|q4|full_year|next_quarter|next_year",
            "fiscal_year": 2024,
            "low": null or number,
            "high": null or number,
            "point": null or number (if single number given),
            "unit": "millions|billions|percent|dollars_per_share",
            "revision": "raised|lowered|maintained|initiated|null",
            "verbatim": "exact quote from transcript",
            "confidence": 0.0-1.0
        }}
    ],
    "segments": [
        {{
            "segment_name": "Name of segment",
            "segment_type": "geographic|product|business_unit",
            "revenue_mention": "What they said about revenue",
            "growth_mention": "What they said about growth",
            "outlook": "Their outlook for this segment",
            "key_points": ["point 1", "point 2"]
        }}
    ],
    "risks": [
        {{
            "category": "macro|competition|supply_chain|demand|regulatory|operational|other",
            "description": "Brief description of the risk",
            "severity": "low|medium|high",
            "mentioned_by": "CEO|CFO|analyst",
            "verbatim": "exact quote if notable"
        }}
    ],
    "analyst_questions": [
        {{
            "analyst_name": "Name",
            "analyst_firm": "Firm name",
            "question": "The question asked",
            "topic": "guidance|margins|competition|capex|m&a|other"
        }}
    ],
    "tone": {{
        "overall": "confident|cautious|uncertain|optimistic|pessimistic|neutral",
        "ceo_tone": "confident|cautious|uncertain|optimistic|pessimistic|neutral",
        "cfo_tone": "confident|cautious|uncertain|optimistic|pessimistic|neutral",
        "confidence_score": 0.0-1.0,
        "hedging_frequency": 0.0-1.0 (how much hedging language used),
        "key_phrases": ["notable phrases indicating tone"]
    }},
    "key_quotes": [
        "Important direct quotes from executives"
    ],
    "participants": [
        {{
            "name": "Full Name",
            "role": "ceo|cfo|coo|other_executive|analyst|operator",
            "title": "Official title",
            "company": "For analysts, their firm"
        }}
    ]
}}

IMPORTANT:
1. Only include guidance if specific numbers are given
2. Note if guidance was raised, lowered, or maintained vs prior
3. Capture the exact verbatim quotes for key guidance
4. Assess tone based on language used, not just what was said
5. Identify hedging language: "could", "might", "uncertain", "challenging"
6. Return valid JSON only, no other text"""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=8000,
        messages=[
            {"role": "user", "content": extraction_prompt}
        ]
    )
    
    # Parse response
    response_text = response.content[0].text
    
    # Extract JSON from response
    json_match = re.search(r'\{[\s\S]*\}', response_text)
    if not json_match:
        raise ValueError("No JSON found in response")
    
    import json
    data = json.loads(json_match.group())
    
    # Build extraction result
    result = EarningsCallExtraction(
        company_ticker=company_ticker,
        company_name=company_name,
        call_date=call_date,
        fiscal_quarter=fiscal_quarter,
        fiscal_year=fiscal_year
    )
    
    # Parse guidance
    for g in data.get("guidance", []):
        try:
            result.guidance.append(GuidanceItem(
                metric=GuidanceType(g.get("metric", "other")),
                period=GuidancePeriod(g.get("period", "full_year")),
                fiscal_year=g.get("fiscal_year", fiscal_year),
                low=g.get("low"),
                high=g.get("high"),
                point=g.get("point"),
                unit=g.get("unit", ""),
                revision=g.get("revision"),
                verbatim=g.get("verbatim"),
                confidence=g.get("confidence", 0.8)
            ))
        except (ValueError, KeyError):
            continue
    
    # Parse segments
    for s in data.get("segments", []):
        result.segments.append(SegmentCommentary(
            segment_name=s.get("segment_name", ""),
            segment_type=s.get("segment_type", "business_unit"),
            revenue_mention=s.get("revenue_mention"),
            growth_mention=s.get("growth_mention"),
            outlook=s.get("outlook"),
            key_points=s.get("key_points", [])
        ))
    
    # Parse risks
    for r in data.get("risks", []):
        result.risks.append(RiskSignal(
            category=r.get("category", "other"),
            description=r.get("description", ""),
            severity=r.get("severity", "medium"),
            mentioned_by=r.get("mentioned_by", "unknown"),
            verbatim=r.get("verbatim")
        ))
    
    # Parse analyst questions
    for q in data.get("analyst_questions", []):
        result.analyst_questions.append(AnalystQuestion(
            analyst_name=q.get("analyst_name", "Unknown"),
            analyst_firm=q.get("analyst_firm"),
            question=q.get("question", ""),
            topic=q.get("topic", "other")
        ))
    
    # Parse tone
    tone_data = data.get("tone", {})
    if tone_data:
        try:
            result.tone = ToneAssessment(
                overall=ToneIndicator(tone_data.get("overall", "neutral")),
                ceo_tone=ToneIndicator(tone_data.get("ceo_tone")) if tone_data.get("ceo_tone") else None,
                cfo_tone=ToneIndicator(tone_data.get("cfo_tone")) if tone_data.get("cfo_tone") else None,
                confidence_score=tone_data.get("confidence_score", 0.5),
                hedging_frequency=tone_data.get("hedging_frequency", 0.5),
                key_phrases=tone_data.get("key_phrases", [])
            )
        except ValueError:
            result.tone = ToneAssessment(overall=ToneIndicator.NEUTRAL)
    
    # Key quotes
    result.key_quotes = data.get("key_quotes", [])
    
    # Participants
    for p in data.get("participants", []):
        try:
            result.participants.append(Speaker(
                name=p.get("name", "Unknown"),
                role=SpeakerRole(p.get("role", "unknown")),
                title=p.get("title"),
                company=p.get("company")
            ))
        except ValueError:
            continue
    
    return result


def format_earnings_extraction(extraction: EarningsCallExtraction) -> str:
    """Format extraction as markdown for display"""
    lines = []
    
    lines.append(f"# Earnings Call Analysis: {extraction.company_name} ({extraction.company_ticker})")
    lines.append(f"*Q{extraction.fiscal_quarter} FY{extraction.fiscal_year} | {extraction.call_date}*")
    lines.append("")
    
    # Tone Summary
    if extraction.tone:
        lines.append("## Management Tone")
        lines.append(f"**Overall:** {extraction.tone.overall.value.title()}")
        lines.append(f"**Confidence Score:** {extraction.tone.confidence_score:.0%}")
        if extraction.tone.key_phrases:
            lines.append(f"**Key Phrases:** {', '.join(extraction.tone.key_phrases[:5])}")
        lines.append("")
    
    # Guidance
    if extraction.guidance:
        lines.append("## Guidance")
        lines.append("")
        lines.append("| Metric | Period | Range/Value | Revision |")
        lines.append("|--------|--------|-------------|----------|")
        
        for g in extraction.guidance:
            metric = g.metric.value.replace("_", " ").title()
            period = f"{g.period.value.upper()} {g.fiscal_year}"
            
            if g.low and g.high:
                value = f"{g.low}-{g.high} {g.unit}"
            elif g.point:
                value = f"{g.point} {g.unit}"
            else:
                value = "—"
            
            revision = g.revision.title() if g.revision else "—"
            
            lines.append(f"| {metric} | {period} | {value} | {revision} |")
        
        lines.append("")
    
    # Segment Commentary
    if extraction.segments:
        lines.append("## Segment Commentary")
        lines.append("")
        
        for seg in extraction.segments:
            lines.append(f"### {seg.segment_name}")
            if seg.outlook:
                lines.append(f"**Outlook:** {seg.outlook}")
            if seg.key_points:
                for point in seg.key_points:
                    lines.append(f"- {point}")
            lines.append("")
    
    # Risk Signals
    if extraction.risks:
        lines.append("## Risk Signals")
        lines.append("")
        
        for risk in extraction.risks:
            severity_emoji = {"low": "🟡", "medium": "🟠", "high": "🔴"}.get(risk.severity, "⚪")
            lines.append(f"{severity_emoji} **{risk.category.title()}**: {risk.description}")
        
        lines.append("")
    
    # Key Quotes
    if extraction.key_quotes:
        lines.append("## Key Quotes")
        lines.append("")
        
        for quote in extraction.key_quotes[:5]:
            lines.append(f"> {quote}")
            lines.append("")
    
    # Analyst Focus
    if extraction.analyst_questions:
        topics = {}
        for q in extraction.analyst_questions:
            topics[q.topic] = topics.get(q.topic, 0) + 1
        
        lines.append("## Analyst Focus Areas")
        lines.append("")
        for topic, count in sorted(topics.items(), key=lambda x: -x[1]):
            lines.append(f"- {topic.replace('_', ' ').title()}: {count} questions")
        lines.append("")
    
    return "\n".join(lines)


def extraction_to_dict(extraction: EarningsCallExtraction) -> Dict[str, Any]:
    """Convert extraction to dictionary for JSON serialization"""
    return {
        "company_ticker": extraction.company_ticker,
        "company_name": extraction.company_name,
        "call_date": extraction.call_date,
        "fiscal_quarter": extraction.fiscal_quarter,
        "fiscal_year": extraction.fiscal_year,
        "guidance": [asdict(g) for g in extraction.guidance],
        "segments": [asdict(s) for s in extraction.segments],
        "risks": [asdict(r) for r in extraction.risks],
        "analyst_questions": [asdict(q) for q in extraction.analyst_questions],
        "tone": asdict(extraction.tone) if extraction.tone else None,
        "key_quotes": extraction.key_quotes,
        "participants": [asdict(p) for p in extraction.participants],
        "extraction_notes": extraction.extraction_notes
    }


# ============================================
# Testing
# ============================================

if __name__ == "__main__":
    # Test with a sample transcript excerpt
    sample_transcript = """
    OPERATOR: Good afternoon. Welcome to Apple Inc.'s Q1 Fiscal Year 2024 Earnings Call.
    
    TIM COOK, CEO: Thank you. Good afternoon everyone. We're pleased to report another 
    record quarter with revenue of $119.6 billion, up 2% year-over-year. This was our 
    highest quarterly revenue ever.
    
    iPhone revenue was $69.7 billion, up 6% year-over-year. We continue to see strong 
    demand for iPhone 15 Pro and Pro Max. Services revenue reached an all-time record 
    of $23.1 billion, up 11% year-over-year.
    
    Looking ahead, we expect continued momentum in Services and are optimistic about 
    our product pipeline for the remainder of the fiscal year.
    
    LUCA MAESTRI, CFO: For the March quarter, we expect revenue to be between $90 and 
    $94 billion. We expect gross margin to be between 46% and 47%. We expect OpEx to 
    be between $14.3 and $14.5 billion.
    
    We are raising our dividend by 4% and announcing an additional $110 billion for 
    share repurchases.
    
    ANALYST (Morgan Stanley): Tim, can you talk about what you're seeing in China? 
    There's been some concern about competition from Huawei.
    
    TIM COOK: We had a good quarter in Greater China. Revenue was down 13% but we 
    remain confident in our long-term position. The premium smartphone market in China 
    is competitive but we're focused on delivering the best products.
    """
    
    print("Testing earnings call extraction...")
    print("(Note: Requires ANTHROPIC_API_KEY)")
    
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key:
        result = extract_earnings_call(
            transcript_text=sample_transcript,
            company_ticker="AAPL",
            company_name="Apple Inc.",
            call_date="2024-02-01",
            fiscal_quarter=1,
            fiscal_year=2024
        )
        
        print(format_earnings_extraction(result))
    else:
        print("Set ANTHROPIC_API_KEY to test extraction")
