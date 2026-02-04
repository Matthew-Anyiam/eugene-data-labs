"""
Eugene Intelligence - Equity Research Agent
"""
import json, time, logging
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime
from eugene.config import Config, get_config
from eugene.models.sources import SourceCitation, CitedValue, SourcedResponse, SourceType

logger = logging.getLogger(__name__)

EQUITY_RESEARCH_SYSTEM_PROMPT = "You are a senior equity research analyst at a top-tier investment bank. Analyze the provided SEC filing and produce a research-grade analysis.\n\nFor every data point and claim, note which section of the filing it comes from.\n\nExtract:\n1. Financial Performance: revenue, net income, EPS, margins, YoY changes\n2. Segment Breakdown: revenue/profit by business segment\n3. Forward Guidance: any management guidance or outlook statements\n4. Key Metrics: operating metrics specific to the company/industry\n5. Risk Factors: material risks, changes from prior period\n6. Capital Allocation: buybacks, dividends, capex, M&A\n7. Management Commentary: key quotes about strategy and outlook\n\nFor each data point include:\n- source_section: the heading or section it came from\n- source_text: a brief quote from the filing (max 100 chars)\n- confidence: 0.0-1.0\n\nReturn ONLY valid JSON. No markdown, no explanations.\n\nJSON Structure:\n{\n  \"financial_performance\": {\n    \"revenue\": {\"value\": null, \"period\": \"\", \"yoy_change_pct\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0},\n    \"net_income\": {\"value\": null, \"period\": \"\", \"yoy_change_pct\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0},\n    \"eps_diluted\": {\"value\": null, \"period\": \"\", \"yoy_change_pct\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0},\n    \"gross_margin_pct\": {\"value\": null, \"source_section\": \"\", \"confidence\": 0},\n    \"operating_margin_pct\": {\"value\": null, \"source_section\": \"\", \"confidence\": 0},\n    \"net_margin_pct\": {\"value\": null, \"source_section\": \"\", \"confidence\": 0}\n  },\n  \"segments\": [{\"name\": \"\", \"revenue\": null, \"operating_income\": null, \"yoy_revenue_change_pct\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0}],\n  \"guidance\": [{\"metric\": \"\", \"guidance_value\": \"\", \"period\": \"\", \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0}],\n  \"key_metrics\": [{\"metric_name\": \"\", \"value\": null, \"period\": \"\", \"source_section\": \"\", \"confidence\": 0}],\n  \"risk_factors\": [{\"risk\": \"\", \"severity\": \"low\", \"is_new\": false, \"source_section\": \"\", \"source_text\": \"\"}],\n  \"capital_allocation\": {\n    \"capex\": {\"value\": null, \"source_section\": \"\", \"confidence\": 0},\n    \"share_buybacks\": {\"value\": null, \"source_section\": \"\", \"confidence\": 0},\n    \"dividends_paid\": {\"value\": null, \"source_section\": \"\", \"confidence\": 0},\n    \"acquisitions\": {\"value\": null, \"source_section\": \"\", \"confidence\": 0}\n  },\n  \"management_commentary\": [{\"topic\": \"\", \"quote_summary\": \"\", \"source_section\": \"\", \"source_text\": \"\"}],\n  \"summary\": \"\"\n}\n\nAll monetary amounts in millions USD unless specified."

EQUITY_RESEARCH_USER_PROMPT = "Produce equity research analysis for this filing:\n\nCompany: {company_name} ({ticker})\nFiling: {filing_type} filed {filing_date}\n\n<filing_text>\n{text}\n</filing_text>\n\nReturn comprehensive equity research as JSON with source citations for every data point."


class EquityResearchAgent:
    def __init__(self, config=None):
        self.config = config or get_config()
        self._edgar = None
        self._llm = None
        self._xbrl = None

    @property
    def edgar(self):
        if self._edgar is None:
            from eugene.sources.edgar import EDGARClient
            self._edgar = EDGARClient(self.config)
        return self._edgar

    @property
    def llm(self):
        if self._llm is None:
            from eugene.extraction.llm import LLMClient
            self._llm = LLMClient(self.config)
        return self._llm
    @property
    def xbrl(self):
        if self._xbrl is None:
            from eugene.sources.xbrl import XBRLClient
            self._xbrl = XBRLClient(self.config)
        return self._xbrl

    def analyze(self, ticker, filing_type="10-K", focus=None):
        start_time = time.time()
        ticker = ticker.upper()
        company = self.edgar.get_company(ticker)
        filings = self.edgar.get_filings(ticker, filing_type=filing_type, limit=1)
        if not filings:
            return self._empty_response(ticker, company.name, "No {} found for {}".format(filing_type, ticker))
        filing = filings[0]
        html = self.edgar.get_filing_content(filing)
        text = self.edgar.extract_text_from_html(html)
        source_type = SourceType.SEC_10K.value if filing_type == "10-K" else SourceType.SEC_10Q.value
        filing_source = SourceCitation(
            source_type=source_type,
            document_name="{} {} {}".format(company.name, filing_type, filing.filing_date),
            filing_date=filing.filing_date, accession_number=filing.accession_number,
            url=filing.filing_url, accessed_at=datetime.utcnow().isoformat()
        )
        sections = self._find_equity_sections(text, focus)
        analysis_text = "\n\n---\n\n".join(sections)
        if len(analysis_text) > 15000:
            analysis_text = analysis_text[:15000]
        from eugene.extraction.llm import ExtractionRequest
        request = ExtractionRequest(
            text=analysis_text, schema={},
            system_prompt=EQUITY_RESEARCH_SYSTEM_PROMPT,
            user_prompt=EQUITY_RESEARCH_USER_PROMPT.format(
                company_name=company.name, ticker=ticker,
                filing_type=filing_type, filing_date=filing.filing_date,
                text=analysis_text
            ),
            max_tokens=4096, temperature=0.0
        )
        response = self.llm.extract(request)
        if not response.success:
            return self._empty_response(ticker, company.name, "Analysis failed: {}".format(response.error))
        data = response.data or {}
        # Enrich with XBRL: deterministic numbers override LLM extraction
        try:
            xbrl_data = self.xbrl.get_financials(ticker)
            xbrl_enrichment = {}
            xbrl_map = {
                "revenue": "revenue", "net_income": "net_income",
                "operating_income": "operating_income", "eps_basic": "eps_basic",
                "eps_diluted": "eps_diluted", "total_assets": "total_assets",
                "total_equity": "total_equity", "operating_cash_flow": "operating_cash_flow",
                "capital_expenditures": "capital_expenditures",
                "depreciation_amortization": "depreciation_amortization",
                "cash_and_equivalents": "cash_and_equivalents",
            }
            for xbrl_key, label in xbrl_map.items():
                fact = xbrl_data.get_fact(xbrl_key)
                if fact:
                    xbrl_enrichment[label] = {
                        "value": fact.value, "unit": fact.unit,
                        "xbrl_tag": fact.tag, "period_end": fact.period_end,
                        "source": "SEC XBRL (deterministic)"
                    }
            # Historical trends
            xbrl_trends = {}
            for metric in ["revenue", "net_income", "eps_basic"]:
                history = self.xbrl.get_historical(ticker, metric, years=5)
                if len(history) >= 2:
                    xbrl_trends[metric] = [{"fy": h.fiscal_year, "value": h.value} for h in history]
            data["xbrl_financials"] = xbrl_enrichment
            data["xbrl_trends"] = xbrl_trends
        except Exception as e:
            logger.warning("XBRL enrichment failed for {}: {}".format(ticker, e))
        cited_values = self._build_cited_values(data, filing_source)
        elapsed = int((time.time() - start_time) * 1000)
        return SourcedResponse(
            ticker=ticker, company_name=company.name,
            response_type="equity_research", data=data,
            cited_values=cited_values, sources_used=[filing_source],
            summary=data.get("summary"),
            processing_time_ms=elapsed, tokens_used=response.tokens_used
        )

    def _find_equity_sections(self, text, focus=None):
        sections = []
        keywords = ["Revenue", "Net Income", "Net Sales", "Operating Income",
                     "Earnings Per Share", "Segment", "Products and Services",
                     "Results of Operations", "Financial Condition", "Outlook",
                     "Guidance", "Risk Factor", "Capital Expenditure",
                     "Share Repurchase", "Dividend", "Management Discussion"]
        if focus:
            focus_keywords = {
                "revenue": ["Revenue", "Net Sales", "Segment", "Growth"],
                "margins": ["Gross Margin", "Operating Margin", "Cost of"],
                "guidance": ["Outlook", "Guidance", "Expect", "Anticipate"],
                "risk": ["Risk Factor", "Uncertaint", "Could adversely"],
                "capital": ["Repurchase", "Dividend", "Capital Expenditure", "Acquisition"]
            }
            keywords = focus_keywords.get(focus.lower(), keywords)
        found_positions = set()
        for kw in keywords:
            idx = text.find(kw)
            while idx > 0:
                too_close = any(abs(idx - pos) < 1000 for pos in found_positions)
                if not too_close:
                    start = max(0, idx - 200)
                    end = min(len(text), idx + 4000)
                    sections.append(text[start:end])
                    found_positions.add(idx)
                idx = text.find(kw, idx + 1)
                if len(found_positions) > 10:
                    break
            if len(found_positions) > 10:
                break
        if not sections:
            sections.append(text[:10000])
        return sections[:8]

    def _build_cited_values(self, data, source):
        cited = []
        perf = data.get("financial_performance", {})
        for field_name, field_data in perf.items():
            if isinstance(field_data, dict) and field_data.get("value") is not None:
                citation = SourceCitation(
                    source_type=source.source_type, document_name=source.document_name,
                    filing_date=source.filing_date, accession_number=source.accession_number,
                    section=field_data.get("source_section", ""),
                    extracted_text=field_data.get("source_text", ""),
                    confidence=field_data.get("confidence", 0.0), url=source.url
                )
                unit = "millions_usd"
                if "margin" in field_name or "pct" in field_name:
                    unit = "percent"
                elif "eps" in field_name:
                    unit = "usd_per_share"
                cited.append(CitedValue(field_name=field_name, value=field_data["value"],
                                        unit=unit, citations=[citation]))
        for seg in data.get("segments", []):
            if seg.get("revenue") is not None:
                citation = SourceCitation(
                    source_type=source.source_type, document_name=source.document_name,
                    filing_date=source.filing_date, accession_number=source.accession_number,
                    section=seg.get("source_section", ""),
                    extracted_text=seg.get("source_text", ""),
                    confidence=seg.get("confidence", 0.0), url=source.url
                )
                cited.append(CitedValue(
                    field_name="segment_{}_revenue".format(seg["name"]),
                    value=seg["revenue"], unit="millions_usd", citations=[citation]
                ))
        for g in data.get("guidance", []):
            citation = SourceCitation(
                source_type=source.source_type, document_name=source.document_name,
                filing_date=source.filing_date, accession_number=source.accession_number,
                section=g.get("source_section", ""),
                extracted_text=g.get("source_text", ""),
                confidence=g.get("confidence", 0.0), url=source.url
            )
            cited.append(CitedValue(
                field_name="guidance_{}".format(g.get("metric", "unknown")),
                value=g.get("guidance_value"), citations=[citation]
            ))
        capalloc = data.get("capital_allocation", {})
        for field_name, field_data in capalloc.items():
            if isinstance(field_data, dict) and field_data.get("value") is not None:
                citation = SourceCitation(
                    source_type=source.source_type, document_name=source.document_name,
                    filing_date=source.filing_date, accession_number=source.accession_number,
                    section=field_data.get("source_section", ""),
                    confidence=field_data.get("confidence", 0.0), url=source.url
                )
                cited.append(CitedValue(field_name=field_name, value=field_data["value"],
                                        unit="millions_usd", citations=[citation]))
        return cited

    def _empty_response(self, ticker, name, error):
        return SourcedResponse(ticker=ticker, company_name=name, response_type="equity_research", summary=error)
