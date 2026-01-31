"""
Eugene Data Labs - 8-K Filing Parser

Parses 8-K filings to extract material events:
- Acquisitions & dispositions
- Earnings announcements
- Management changes
- Material agreements
- Other material events

8-Ks are messy and unstructured. We fix that.
"""

from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class ItemType(Enum):
    """8-K Item codes and their meanings"""
    ITEM_1_01 = "Entry into Material Definitive Agreement"
    ITEM_1_02 = "Termination of Material Definitive Agreement"
    ITEM_1_03 = "Bankruptcy or Receivership"
    ITEM_2_01 = "Completion of Acquisition or Disposition of Assets"
    ITEM_2_02 = "Results of Operations and Financial Condition"
    ITEM_2_03 = "Creation of Direct Financial Obligation"
    ITEM_2_04 = "Triggering Events That Accelerate Obligation"
    ITEM_2_05 = "Costs Associated with Exit or Disposal"
    ITEM_2_06 = "Material Impairments"
    ITEM_3_01 = "Notice of Delisting"
    ITEM_3_02 = "Unregistered Sales of Equity Securities"
    ITEM_3_03 = "Material Modification of Rights"
    ITEM_4_01 = "Changes in Registrant's Certifying Accountant"
    ITEM_4_02 = "Non-Reliance on Previously Issued Financial Statements"
    ITEM_5_01 = "Changes in Control of Registrant"
    ITEM_5_02 = "Departure/Election of Directors or Officers"
    ITEM_5_03 = "Amendments to Articles of Incorporation or Bylaws"
    ITEM_5_07 = "Submission of Matters to Vote of Security Holders"
    ITEM_7_01 = "Regulation FD Disclosure"
    ITEM_8_01 = "Other Events"
    ITEM_9_01 = "Financial Statements and Exhibits"


@dataclass
class MaterialEvent:
    """A single material event extracted from 8-K"""
    item_code: str
    item_type: str
    headline: str
    summary: str
    raw_text: str
    sentiment: str  # positive, negative, neutral
    materiality: str  # high, medium, low
    confidence: float
    entities: List[str]  # Companies, people, amounts mentioned
    dates: List[str]  # Relevant dates mentioned


@dataclass
class Form8KExtraction:
    """Complete 8-K extraction result"""
    ticker: str
    company_name: str
    cik: str
    filed_date: str
    period_date: str
    accession_number: str
    events: List[MaterialEvent]
    filing_url: str
    extraction_timestamp: str
    overall_sentiment: str
    market_impact: str  # high, medium, low, unknown
    

# Item code patterns for parsing
ITEM_PATTERNS = {
    "1.01": ItemType.ITEM_1_01,
    "1.02": ItemType.ITEM_1_02,
    "1.03": ItemType.ITEM_1_03,
    "2.01": ItemType.ITEM_2_01,
    "2.02": ItemType.ITEM_2_02,
    "2.03": ItemType.ITEM_2_03,
    "2.04": ItemType.ITEM_2_04,
    "2.05": ItemType.ITEM_2_05,
    "2.06": ItemType.ITEM_2_06,
    "3.01": ItemType.ITEM_3_01,
    "3.02": ItemType.ITEM_3_02,
    "3.03": ItemType.ITEM_3_03,
    "4.01": ItemType.ITEM_4_01,
    "4.02": ItemType.ITEM_4_02,
    "5.01": ItemType.ITEM_5_01,
    "5.02": ItemType.ITEM_5_02,
    "5.03": ItemType.ITEM_5_03,
    "5.07": ItemType.ITEM_5_07,
    "7.01": ItemType.ITEM_7_01,
    "8.01": ItemType.ITEM_8_01,
    "9.01": ItemType.ITEM_9_01,
}

# High-impact items that often move stocks
HIGH_IMPACT_ITEMS = ["1.01", "2.01", "2.02", "2.06", "4.02", "5.01", "5.02"]


def parse_8k_sections(raw_text: str) -> Dict[str, str]:
    """
    Split raw 8-K text into sections by Item code.
    
    Returns dict like:
    {
        "1.01": "text for item 1.01...",
        "2.02": "text for item 2.02...",
    }
    """
    import re
    
    sections = {}
    
    # Pattern to match Item X.XX headers
    item_pattern = r'Item\s+(\d+\.\d+)'
    
    # Find all item positions
    matches = list(re.finditer(item_pattern, raw_text, re.IGNORECASE))
    
    for i, match in enumerate(matches):
        item_code = match.group(1)
        start = match.end()
        
        # End is either next item or end of text
        if i + 1 < len(matches):
            end = matches[i + 1].start()
        else:
            end = len(raw_text)
        
        section_text = raw_text[start:end].strip()
        
        # Clean up the text
        section_text = re.sub(r'\s+', ' ', section_text)
        
        sections[item_code] = section_text
    
    return sections


def classify_sentiment(text: str) -> str:
    """Simple sentiment classification based on keywords"""
    text_lower = text.lower()
    
    positive_words = [
        "growth", "increase", "profit", "successful", "exceeded",
        "record", "strong", "improved", "expansion", "acquired"
    ]
    
    negative_words = [
        "loss", "decline", "decrease", "terminated", "resigned",
        "impairment", "restructuring", "layoff", "breach", "default"
    ]
    
    pos_count = sum(1 for word in positive_words if word in text_lower)
    neg_count = sum(1 for word in negative_words if word in text_lower)
    
    if pos_count > neg_count + 2:
        return "positive"
    elif neg_count > pos_count + 2:
        return "negative"
    else:
        return "neutral"


def extract_entities(text: str) -> List[str]:
    """Extract company names, people, and dollar amounts"""
    import re
    
    entities = []
    
    # Dollar amounts
    amounts = re.findall(r'\$[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|M|B))?', text)
    entities.extend(amounts[:5])  # Top 5 amounts
    
    # Percentages
    percentages = re.findall(r'\d+(?:\.\d+)?%', text)
    entities.extend(percentages[:3])
    
    return entities


def extract_dates(text: str) -> List[str]:
    """Extract dates mentioned in text"""
    import re
    
    # Common date patterns
    patterns = [
        r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b',
        r'\b\d{1,2}/\d{1,2}/\d{4}\b',
        r'\b\d{4}-\d{2}-\d{2}\b',
    ]
    
    dates = []
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        dates.extend(matches)
    
    return dates[:5]  # Top 5 dates


def assess_materiality(item_code: str, text: str) -> str:
    """Assess how material/important this event is"""
    # High impact items
    if item_code in HIGH_IMPACT_ITEMS:
        return "high"
    
    # Check for big numbers
    text_lower = text.lower()
    if "billion" in text_lower:
        return "high"
    if "million" in text_lower:
        return "medium"
    
    return "low"


def generate_headline(item_code: str, item_type: str, text: str) -> str:
    """Generate a short headline for the event"""
    # Truncate text to first sentence or 100 chars
    first_sentence = text.split('.')[0][:100]
    
    if item_code == "2.01":
        if "acqui" in text.lower():
            return "Acquisition Completed"
        elif "dispos" in text.lower() or "sold" in text.lower():
            return "Asset Disposition"
        return "M&A Activity"
    
    elif item_code == "2.02":
        return "Earnings/Financial Results Announced"
    
    elif item_code == "5.02":
        if "appoint" in text.lower():
            return "New Executive Appointed"
        elif "resign" in text.lower() or "depart" in text.lower():
            return "Executive Departure"
        return "Management Change"
    
    elif item_code == "1.01":
        return "Material Agreement Signed"
    
    elif item_code == "1.02":
        return "Material Agreement Terminated"
    
    elif item_code == "2.06":
        return "Material Impairment Recorded"
    
    elif item_code == "7.01":
        return "Regulation FD Disclosure"
    
    elif item_code == "8.01":
        return "Other Material Event"
    
    return item_type


def parse_8k(
    raw_text: str,
    ticker: str,
    company_name: str,
    cik: str,
    filed_date: str,
    accession_number: str
) -> Form8KExtraction:
    """
    Main function to parse an 8-K filing.
    
    Args:
        raw_text: Full text of the 8-K filing
        ticker: Company ticker symbol
        company_name: Company name
        cik: SEC CIK number
        filed_date: Date filed
        accession_number: SEC accession number
    
    Returns:
        Form8KExtraction with all extracted events
    """
    # Split into sections
    sections = parse_8k_sections(raw_text)
    
    events = []
    overall_sentiments = []
    has_high_impact = False
    
    for item_code, section_text in sections.items():
        if item_code not in ITEM_PATTERNS:
            continue
        
        item_type = ITEM_PATTERNS[item_code].value
        
        # Skip exhibits section (9.01)
        if item_code == "9.01":
            continue
        
        # Extract event details
        sentiment = classify_sentiment(section_text)
        materiality = assess_materiality(item_code, section_text)
        headline = generate_headline(item_code, item_type, section_text)
        entities = extract_entities(section_text)
        dates = extract_dates(section_text)
        
        if materiality == "high":
            has_high_impact = True
        
        overall_sentiments.append(sentiment)
        
        # Create summary (first 500 chars)
        summary = section_text[:500] + "..." if len(section_text) > 500 else section_text
        
        event = MaterialEvent(
            item_code=item_code,
            item_type=item_type,
            headline=headline,
            summary=summary,
            raw_text=section_text,
            sentiment=sentiment,
            materiality=materiality,
            confidence=0.85,
            entities=entities,
            dates=dates
        )
        
        events.append(event)
    
    # Determine overall sentiment
    if overall_sentiments:
        pos = overall_sentiments.count("positive")
        neg = overall_sentiments.count("negative")
        if pos > neg:
            overall_sentiment = "positive"
        elif neg > pos:
            overall_sentiment = "negative"
        else:
            overall_sentiment = "neutral"
    else:
        overall_sentiment = "neutral"
    
    # Determine market impact
    if has_high_impact:
        market_impact = "high"
    elif events:
        market_impact = "medium"
    else:
        market_impact = "low"
    
    filing_url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_number.replace('-', '')}"
    
    return Form8KExtraction(
        ticker=ticker,
        company_name=company_name,
        cik=cik,
        filed_date=filed_date,
        period_date=filed_date,
        accession_number=accession_number,
        events=events,
        filing_url=filing_url,
        extraction_timestamp=datetime.now().isoformat(),
        overall_sentiment=overall_sentiment,
        market_impact=market_impact
    )


def format_8k_markdown(extraction: Form8KExtraction) -> str:
    """Format 8-K extraction as markdown for agents"""
    
    md = f"""# 8-K Filing: {extraction.company_name} ({extraction.ticker})

**Filed:** {extraction.filed_date}
**Overall Sentiment:** {extraction.overall_sentiment.upper()}
**Market Impact:** {extraction.market_impact.upper()}

---

## Material Events

"""
    
    for event in extraction.events:
        impact_emoji = "🔴" if event.materiality == "high" else "🟡" if event.materiality == "medium" else "⚪"
        sentiment_emoji = "📈" if event.sentiment == "positive" else "📉" if event.sentiment == "negative" else "➖"
        
        md += f"""### {impact_emoji} {event.headline}

**Item {event.item_code}:** {event.item_type}
**Sentiment:** {sentiment_emoji} {event.sentiment}
**Materiality:** {event.materiality}

{event.summary}

"""
        
        if event.entities:
            md += f"**Key figures:** {', '.join(event.entities)}\n\n"
        
        md += "---\n\n"
    
    md += f"""
## Filing Details

- **Accession Number:** {extraction.accession_number}
- **SEC URL:** {extraction.filing_url}
- **Extracted:** {extraction.extraction_timestamp}
"""
    
    return md


# For testing
if __name__ == "__main__":
    # Sample 8-K text
    sample_8k = """
    UNITED STATES SECURITIES AND EXCHANGE COMMISSION
    Washington, D.C. 20549
    FORM 8-K
    
    Item 2.02 Results of Operations and Financial Condition
    
    On January 29, 2025, Tesla, Inc. announced its financial results for the 
    quarter ended December 31, 2024. Revenue was $25.7 billion, exceeding 
    analyst expectations. Net income was $2.3 billion. The company delivered 
    495,000 vehicles during the quarter.
    
    Item 5.02 Departure of Directors or Certain Officers
    
    On January 28, 2025, the Company announced that John Smith, Chief Financial 
    Officer, will be departing effective March 1, 2025. Jane Doe has been 
    appointed as interim CFO.
    
    Item 9.01 Financial Statements and Exhibits
    
    (d) Exhibits
    99.1 Press Release dated January 29, 2025
    """
    
    result = parse_8k(
        raw_text=sample_8k,
        ticker="TSLA",
        company_name="Tesla, Inc.",
        cik="1318605",
        filed_date="2025-01-29",
        accession_number="0001318605-25-000006"
    )
    
    print(format_8k_markdown(result))