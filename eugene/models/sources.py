from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class SourceType(Enum):
    SEC_10K = "sec_10k"
    SEC_10Q = "sec_10q"
    SEC_8K = "sec_8k"
    EARNINGS_TRANSCRIPT = "earnings_transcript"
    CREDIT_RATING = "credit_rating"
    FRED_ECONOMIC = "fred_economic"
    MARKET_DATA = "market_data"

@dataclass
class SourceCitation:
    source_type: str
    document_name: str
    filing_date: Optional[str] = None
    accession_number: Optional[str] = None
    section: Optional[str] = None
    page: Optional[int] = None
    url: Optional[str] = None
    extracted_text: Optional[str] = None
    confidence: float = 0.0
    accessed_at: Optional[str] = None

    def to_dict(self) -> dict:
        d = {"source_type": self.source_type, "document": self.document_name, "confidence": round(self.confidence, 3)}
        if self.filing_date: d["filing_date"] = self.filing_date
        if self.accession_number: d["accession_number"] = self.accession_number
        if self.section: d["section"] = self.section
        if self.url: d["url"] = self.url
        if self.extracted_text: d["source_text"] = self.extracted_text[:500]
        return d

@dataclass
class CitedValue:
    field_name: str
    value: Any
    unit: Optional[str] = None
    citations: List[SourceCitation] = field(default_factory=list)

    @property
    def confidence(self) -> float:
        return max((c.confidence for c in self.citations), default=0.0)

    @property
    def is_multi_sourced(self) -> bool:
        return len(self.citations) > 1

    def to_dict(self) -> dict:
        return {"field": self.field_name, "value": self.value, "unit": self.unit,
                "confidence": round(self.confidence, 3), "multi_sourced": self.is_multi_sourced,
                "sources": [c.to_dict() for c in self.citations]}

@dataclass
class SourcedResponse:
    ticker: str
    company_name: str
    response_type: str
    generated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    data: Dict[str, Any] = field(default_factory=dict)
    cited_values: List[CitedValue] = field(default_factory=list)
    sources_used: List[SourceCitation] = field(default_factory=list)
    summary: Optional[str] = None
    processing_time_ms: int = 0
    tokens_used: int = 0

    @property
    def source_count(self) -> int:
        return len(self.sources_used)

    @property
    def avg_confidence(self) -> float:
        if not self.cited_values: return 0.0
        return sum(cv.confidence for cv in self.cited_values) / len(self.cited_values)

    def to_dict(self) -> dict:
        return {"ticker": self.ticker, "company": self.company_name, "type": self.response_type,
                "generated_at": self.generated_at, "summary": self.summary, "data": self.data,
                "cited_values": [cv.to_dict() for cv in self.cited_values],
                "sources": {"count": self.source_count, "avg_confidence": round(self.avg_confidence, 3),
                            "documents": [s.to_dict() for s in self.sources_used]},
                "meta": {"processing_time_ms": self.processing_time_ms, "tokens_used": self.tokens_used}}