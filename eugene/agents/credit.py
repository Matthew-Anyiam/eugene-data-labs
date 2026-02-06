"""
Eugene Intelligence - Credit Monitor Agent
With company financial health scoring.
"""
import json, time, logging
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime
from eugene.config import Config, get_config
from eugene.models.sources import SourceCitation, CitedValue, SourcedResponse, SourceType

logger = logging.getLogger(__name__)

CREDIT_MONITOR_SYSTEM_PROMPT = "You are a credit analyst at a major investment bank. Analyze the provided SEC filing text and extract a comprehensive credit profile.\n\nFor every data point, note which section of the filing it comes from.\n\nExtract:\n1. Debt overview: total debt, net debt, debt/equity, debt composition\n2. Debt instruments: each issuance with rate, maturity, principal\n3. Maturity profile: what is due when\n4. Covenants: financial maintenance covenants, compliance status\n5. Liquidity: cash, credit facilities, available capacity\n6. Credit risks: any risk factors related to leverage, refinancing, rates\n7. Recent changes: any new issuances, repayments, amendments\n8. Balance sheet health: total assets, total liabilities, current assets, current liabilities, EBIT or operating income, interest expense, retained earnings, total equity, revenue, EBITDA if available, free cash flow or operating cash flow and capex\n\nFor each data point include:\n- source_section: the heading or note number it came from\n- source_text: a brief quote from the filing (max 100 chars)\n- confidence: 0.0-1.0\n\nReturn ONLY valid JSON. No markdown, no explanations.\n\nJSON Structure:\n{\n  \"debt_overview\": {\n    \"total_debt\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0},\n    \"total_long_term_debt\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0},\n    \"total_short_term_debt\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0},\n    \"cash_and_equivalents\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0},\n    \"net_debt\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0},\n    \"total_equity\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0},\n    \"debt_to_equity\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0}\n  },\n  \"instruments\": [{\"name\": \"\", \"type\": \"\", \"principal\": 0, \"interest_rate\": null, \"rate_type\": null, \"maturity_date\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0}],\n  \"maturity_schedule\": [{\"year\": 0, \"amount\": 0, \"source_section\": \"\"}],\n  \"covenants\": [{\"name\": \"\", \"type\": \"\", \"threshold\": null, \"current_value\": null, \"in_compliance\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0}],\n  \"liquidity\": {\n    \"cash_and_equivalents\": {\"value\": null, \"source_section\": \"\", \"confidence\": 0},\n    \"credit_facility_total\": {\"value\": null, \"source_section\": \"\", \"confidence\": 0},\n    \"credit_facility_available\": {\"value\": null, \"source_section\": \"\", \"confidence\": 0},\n    \"commercial_paper_outstanding\": {\"value\": null, \"source_section\": \"\", \"confidence\": 0}\n  },\n  \"credit_risks\": [{\"risk\": \"\", \"source_section\": \"\", \"source_text\": \"\", \"severity\": \"low\"}],\n  \"recent_changes\": [{\"change\": \"\", \"date\": null, \"source_section\": \"\", \"source_text\": \"\"}],\n  \"balance_sheet\": {\n    \"total_assets\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0},\n    \"total_liabilities\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0},\n    \"current_assets\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0},\n    \"current_liabilities\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0},\n    \"total_equity\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0},\n    \"retained_earnings\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0},\n    \"revenue\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0},\n    \"ebit\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0},\n    \"ebitda\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0},\n    \"interest_expense\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0},\n    \"operating_cash_flow\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0},\n    \"capital_expenditures\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0},\n    \"depreciation_amortization\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0}\n  },\n  \"summary\": \"\"\n}\n\nAll monetary amounts in millions USD."

CREDIT_MONITOR_USER_PROMPT = "Analyze this SEC filing for credit intelligence:\n\nCompany: {company_name} ({ticker})\nFiling: {filing_type} filed {filing_date}\n\n<filing_text>\n{text}\n</filing_text>\n\nReturn comprehensive credit analysis as JSON with source citations for every data point."


def compute_health_score_xbrl(xbrl_financials):
    """Compute financial health ratios from XBRL data.
    No LLM involved. Deterministic. Standardized across all companies."""

    def g(key):
        """Get value from XBRL, return None if missing."""
        return xbrl_financials.get(key)

    total_assets = g("total_assets")
    total_liabilities = g("total_liabilities")
    current_assets = g("current_assets")
    current_liabilities = g("current_liabilities")
    total_equity = g("total_equity")
    retained_earnings = g("retained_earnings")
    revenue = g("revenue")
    ebit = g("operating_income")
    interest_expense = g("interest_expense")
    operating_cf = g("operating_cash_flow")
    capex = g("capital_expenditures")
    dep_amort = g("depreciation_amortization")
    total_debt = g("total_debt")
    cash = g("cash_and_equivalents")

    # Derived values
    net_debt = (total_debt - cash) if total_debt is not None and cash is not None else None
    ebitda = (ebit + dep_amort) if ebit is not None and dep_amort is not None else None
    if ebitda is None and operating_cf is not None:
        ebitda = operating_cf  # rough proxy
    fcf = (operating_cf - abs(capex)) if operating_cf is not None and capex is not None else None

    ratios = {}
    sources = {}

    # Track which XBRL tags back each ratio
    def add_ratio(name, value, interpretation, inputs):
        ratios[name] = {"value": value, "interpretation": interpretation}
        tag_sources = {}
        for input_key in inputs:
            fact = xbrl_financials.get_fact(input_key)
            if fact:
                tag_sources[input_key] = {"xbrl_tag": fact.tag, "value": fact.value, "period_end": fact.period_end}
        sources[name] = tag_sources

    # Current Ratio
    if current_assets and current_liabilities and current_liabilities != 0:
        r = round(current_assets / current_liabilities, 2)
        if r >= 2.0: interp = "Strong short-term liquidity"
        elif r >= 1.5: interp = "Good short-term liquidity"
        elif r >= 1.0: interp = "Adequate short-term liquidity"
        elif r >= 0.7: interp = "Below 1.0 but may be normal for sector (tech, retail)"
        else: interp = "Low liquidity, monitor closely"
        add_ratio("current_ratio", r, interp, ["current_assets", "current_liabilities"])

    # Debt-to-Assets
    if total_debt and total_assets and total_assets != 0:
        r = round(total_debt / total_assets, 3)
        if r <= 0.3: interp = "Conservative leverage"
        elif r <= 0.5: interp = "Moderate leverage"
        elif r <= 0.7: interp = "Elevated leverage"
        else: interp = "High leverage"
        add_ratio("debt_to_assets", r, interp, ["total_debt", "total_assets"])

    # Debt-to-Equity
    if total_debt and total_equity and total_equity != 0:
        r = round(total_debt / abs(total_equity), 2)
        if total_equity < 0:
            interp = "Negative equity - debt exceeds assets or heavy buybacks"
        elif r <= 0.5: interp = "Low leverage"
        elif r <= 1.5: interp = "Moderate leverage"
        else: interp = "High leverage"
        add_ratio("debt_to_equity", r, interp, ["total_debt", "total_equity"])

    # Interest Coverage
    if ebit and interest_expense and interest_expense != 0:
        r = round(ebit / interest_expense, 2)
        if r >= 8.0: interp = "Very strong debt service capacity"
        elif r >= 3.0: interp = "Adequate debt service capacity"
        elif r >= 1.5: interp = "Thin coverage, monitor closely"
        else: interp = "Distressed, may struggle to service debt"
        add_ratio("interest_coverage", r, interp, ["operating_income", "interest_expense"])

    # Net Debt / EBITDA
    if net_debt is not None and ebitda and ebitda != 0:
        r = round(net_debt / ebitda, 2)
        if r < 0: interp = "Net cash position"
        elif r <= 2.0: interp = "Low leverage"
        elif r <= 4.0: interp = "Moderate leverage"
        elif r <= 6.0: interp = "Elevated leverage"
        else: interp = "High leverage"
        add_ratio("net_debt_to_ebitda", r, interp, ["total_debt", "cash_and_equivalents", "operating_income", "depreciation_amortization"])

    # Free Cash Flow
    if fcf is not None:
        interp = "Positive FCF generation" if fcf > 0 else "Negative FCF, cash burn"
        add_ratio("free_cash_flow", round(fcf / 1_000_000, 1), interp + " (in $M)", ["operating_cash_flow", "capital_expenditures"])

    # Altman Z-Score
    if all(v is not None for v in [current_assets, current_liabilities, total_assets, ebit, total_equity, total_liabilities, revenue]) and total_assets != 0 and total_liabilities != 0:
        wc = current_assets - current_liabilities
        re_val = retained_earnings if retained_earnings is not None else 0
        x1 = wc / total_assets
        x2 = re_val / total_assets
        x3 = ebit / total_assets
        x4 = total_equity / total_liabilities if total_equity > 0 else 0
        x5 = revenue / total_assets
        z = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5
        if z > 2.99: interp = "Safe zone - low bankruptcy risk"
        elif z > 1.81: interp = "Grey zone - moderate risk"
        else: interp = "Distress zone - elevated bankruptcy risk"
        add_ratio("altman_z_score", round(z, 2), interp, ["current_assets", "current_liabilities", "total_assets", "retained_earnings", "operating_income", "total_equity", "total_liabilities", "revenue"])
        ratios["altman_z_score"]["note"] = "Uses book equity (not market cap)"

    # ROIC: Return on Invested Capital
    if ebit and total_debt is not None and total_equity is not None:
        invested = total_debt + total_equity
        if invested > 0:
            r = round((ebit / invested) * 100, 1)
            if r >= 15: interp = "Excellent capital efficiency"
            elif r >= 10: interp = "Good capital efficiency"
            elif r >= 5: interp = "Moderate capital efficiency"
            else: interp = "Low capital efficiency"
            add_ratio("roic_pct", r, interp, ["operating_income", "total_debt", "total_equity"])

    # Scoring
    score_points = 0
    score_max = 0

    def score(ratio_name, weight, thresholds):
        nonlocal score_points, score_max
        if ratio_name not in ratios:
            return
        score_max += weight
        val = ratios[ratio_name]["value"]
        for threshold, points in thresholds:
            if val >= threshold if not isinstance(threshold, tuple) else threshold[0] <= val <= threshold[1]:
                score_points += points
                return
        score_points += 0

    score("current_ratio", 15, [(2.0, 15), (1.5, 12), (1.0, 9), (0.7, 5)])
    score("interest_coverage", 25, [(8.0, 25), (3.0, 18), (1.5, 8)])
    score("debt_to_assets", 15, [(0, 15)])  # handled manually below
    score("net_debt_to_ebitda", 20, [(0, 20)])  # handled manually below
    score("altman_z_score", 15, [(2.99, 15), (1.81, 8)])
    score("roic_pct", 10, [(15, 10), (10, 7), (5, 4)])

    # Manual scoring for inverted metrics (lower = better)
    if "debt_to_assets" in ratios:
        score_max = score_max  # already added
        r = ratios["debt_to_assets"]["value"]
        # Undo the auto-score and redo
        score_points -= 15 if r >= 0 else 0
        if r <= 0.3: score_points += 15
        elif r <= 0.5: score_points += 10
        elif r <= 0.7: score_points += 4
        else: score_points += 0

    if "net_debt_to_ebitda" in ratios:
        r = ratios["net_debt_to_ebitda"]["value"]
        score_points -= 20 if r >= 0 else 0
        if r < 0: score_points += 20
        elif r <= 2.0: score_points += 16
        elif r <= 4.0: score_points += 10
        else: score_points += 0

    health_rating = None
    if score_max > 0:
        pct = max(0, score_points) / score_max
        health_rating = {"score": round(pct * 100), "max_score": 100, "components_available": score_max}
        if pct >= 0.85: health_rating["grade"] = "A - Excellent financial health"
        elif pct >= 0.70: health_rating["grade"] = "B - Good financial health"
        elif pct >= 0.50: health_rating["grade"] = "C - Fair, some concerns"
        elif pct >= 0.30: health_rating["grade"] = "D - Weak, significant concerns"
        else: health_rating["grade"] = "F - Distressed"

    return {
        "ratios": ratios,
        "health_rating": health_rating,
        "free_cash_flow_raw": fcf,
        "xbrl_sources": sources,
        "data_source": "SEC XBRL (no LLM)",
    }


class CreditMonitorAgent:
    def __init__(self, config=None):
        self.config = config or get_config()
        self._edgar = None
        self._llm = None

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

    def analyze(self, ticker, include_quarterly=False):
        start_time = time.time()
        ticker = ticker.upper()
        total_tokens = 0
        all_sources = []
        company = self.edgar.get_company(ticker)
        filings_10k = self.edgar.get_filings(ticker, filing_type="10-K", limit=1)
        if not filings_10k:
            return self._empty_response(ticker, company.name, "No 10-K filing found")
        filing = filings_10k[0]
        html = self.edgar.get_filing_content(filing)
        text = self.edgar.extract_text_from_html(html)
        filing_source = SourceCitation(
            source_type=SourceType.SEC_10K.value,
            document_name="{} 10-K FY{}".format(company.name, filing.filing_date[:4]),
            filing_date=filing.filing_date,
            accession_number=filing.accession_number,
            url=filing.filing_url,
            accessed_at=datetime.utcnow().isoformat()
        )
        all_sources.append(filing_source)
        sections = self._find_credit_sections(text)
        analysis_text = "\n\n---\n\n".join(sections)
        if len(analysis_text) > 15000:
            analysis_text = analysis_text[:15000]
        from eugene.extraction.llm import ExtractionRequest
        request = ExtractionRequest(
            text=analysis_text, schema={},
            system_prompt=CREDIT_MONITOR_SYSTEM_PROMPT,
            user_prompt=CREDIT_MONITOR_USER_PROMPT.format(
                company_name=company.name, ticker=ticker,
                filing_type="10-K", filing_date=filing.filing_date,
                text=analysis_text
            ),
            max_tokens=4096, temperature=0.0
        )
        response = self.llm.extract(request)
        total_tokens += response.tokens_used
        if not response.success:
            return self._empty_response(ticker, company.name, "Extraction failed: {}".format(response.error))
        data = response.data or {}

        # Compute health score from extracted data - Python does the math
        # Health scoring via XBRL - deterministic, no LLM needed
        try:
            from eugene.sources.xbrl import XBRLClient
            xbrl = XBRLClient(self.config)
            xbrl_data = xbrl.get_financials(ticker)
            health = compute_health_score_xbrl(xbrl_data)
        except Exception as e:
            logger.warning("XBRL health scoring failed: {}".format(e))
            health = {"ratios": {}, "health_rating": None, "error": str(e)}
        data["financial_health"] = health

        cited_values = self._build_cited_values(data, filing_source)
        if include_quarterly:
            q_result = self._add_quarterly(ticker, company.name, total_tokens)
            if q_result:
                cited_values.extend(q_result["cited_values"])
                all_sources.extend(q_result["sources"])
                total_tokens += q_result["tokens"]
        elapsed = int((time.time() - start_time) * 1000)
        return SourcedResponse(
            ticker=ticker, company_name=company.name,
            response_type="credit_monitor", data=data,
            cited_values=cited_values, sources_used=all_sources,
            summary=data.get("summary"),
            processing_time_ms=elapsed, tokens_used=total_tokens
        )

    def _find_credit_sections(self, text):
        sections = []
        found_positions = set()

        # Priority 1: Core financial statements (large chunks, these have the numbers)
        core_statements = [
            ("STATEMENTS OF OPERATIONS", 4000),
            ("CONSOLIDATED BALANCE SHEET", 4000),
            ("Cash generated by operating", 4000),
            ("CONSOLIDATED STATEMENTS OF CASH", 4000),
        ]
        for marker, size in core_statements:
            idx = text.find(marker)
            if idx < 0:
                idx = text.lower().find(marker.lower())
            if idx >= 0:
                start = max(0, idx - 100)
                end = min(len(text), idx + size)
                sections.append(text[start:end])
                found_positions.add(idx)

        # Priority 2: Debt and credit specific sections
        debt_keywords = ["Term Debt", "Notes Payable", "Long-Term Debt", "Debt Securities",
                         "Commercial Paper", "Credit Facilit", "Revolving", "Covenant",
                         "Indebtedness", "Liquidity and Capital", "Debt Maturity",
                         "Debt Maturit", "Interest Expense"]
        for kw in debt_keywords:
            idx = text.find(kw)
            while idx > 0:
                too_close = any(abs(idx - pos) < 1000 for pos in found_positions)
                if not too_close:
                    start = max(0, idx - 200)
                    end = min(len(text), idx + 4000)
                    sections.append(text[start:end])
                    found_positions.add(idx)
                idx = text.find(kw, idx + 1)

        if not sections:
            sections.append(text[:8000])
        return sections[:12]

    def _build_cited_values(self, data, source):
        cited = []
        overview = data.get("debt_overview", {})
        for field_name, field_data in overview.items():
            if isinstance(field_data, dict) and field_data.get("value") is not None:
                citation = SourceCitation(
                    source_type=source.source_type, document_name=source.document_name,
                    filing_date=source.filing_date, accession_number=source.accession_number,
                    section=field_data.get("source_section", ""),
                    extracted_text=field_data.get("source_text", ""),
                    confidence=field_data.get("confidence", 0.0), url=source.url
                )
                cited.append(CitedValue(field_name=field_name, value=field_data["value"],
                                        unit="millions_usd", citations=[citation]))
        for inst in data.get("instruments", []):
            citation = SourceCitation(
                source_type=source.source_type, document_name=source.document_name,
                filing_date=source.filing_date, accession_number=source.accession_number,
                section=inst.get("source_section", ""), extracted_text=inst.get("source_text", ""),
                confidence=inst.get("confidence", 0.0), url=source.url
            )
            cited.append(CitedValue(
                field_name="instrument_{}".format(inst.get("name", "unknown")),
                value=inst.get("principal"), unit="millions_usd", citations=[citation]
            ))
        for cov in data.get("covenants", []):
            citation = SourceCitation(
                source_type=source.source_type, document_name=source.document_name,
                filing_date=source.filing_date, accession_number=source.accession_number,
                section=cov.get("source_section", ""), extracted_text=cov.get("source_text", ""),
                confidence=cov.get("confidence", 0.0), url=source.url
            )
            cited.append(CitedValue(
                field_name="covenant_{}".format(cov.get("name", "unknown")),
                value={"threshold": cov.get("threshold"), "current_value": cov.get("current_value"),
                       "in_compliance": cov.get("in_compliance")},
                citations=[citation]
            ))
        bs = data.get("balance_sheet", {})
        for field_name, field_data in bs.items():
            if isinstance(field_data, dict) and field_data.get("value") is not None:
                citation = SourceCitation(
                    source_type=source.source_type, document_name=source.document_name,
                    filing_date=source.filing_date, accession_number=source.accession_number,
                    section=field_data.get("source_section", ""),
                    extracted_text=field_data.get("source_text", ""),
                    confidence=field_data.get("confidence", 0.0), url=source.url
                )
                cited.append(CitedValue(field_name="bs_{}".format(field_name), value=field_data["value"],
                                        unit="millions_usd", citations=[citation]))
        return cited

    def _add_quarterly(self, ticker, company_name, current_tokens):
        try:
            filings_10q = self.edgar.get_filings(ticker, filing_type="10-Q", limit=1)
            if not filings_10q:
                return None
            filing = filings_10q[0]
            html = self.edgar.get_filing_content(filing)
            text = self.edgar.extract_text_from_html(html)
            source = SourceCitation(
                source_type=SourceType.SEC_10Q.value,
                document_name="{} 10-Q {}".format(company_name, filing.filing_date),
                filing_date=filing.filing_date, accession_number=filing.accession_number,
                url=filing.filing_url, accessed_at=datetime.utcnow().isoformat()
            )
            sections = self._find_credit_sections(text)
            analysis_text = "\n\n---\n\n".join(sections)[:10000]
            from eugene.extraction.llm import ExtractionRequest
            request = ExtractionRequest(
                text=analysis_text, schema={},
                system_prompt=CREDIT_MONITOR_SYSTEM_PROMPT,
                user_prompt=CREDIT_MONITOR_USER_PROMPT.format(
                    company_name=company_name, ticker=ticker,
                    filing_type="10-Q", filing_date=filing.filing_date, text=analysis_text
                ),
                max_tokens=4096, temperature=0.0
            )
            response = self.llm.extract(request)
            if not response.success:
                return None
            cited_values = self._build_cited_values(response.data or {}, source)
            return {"cited_values": cited_values, "sources": [source], "tokens": response.tokens_used}
        except Exception as e:
            logger.warning("Failed to add quarterly data: {}".format(e))
            return None

    def _empty_response(self, ticker, name, error):
        return SourcedResponse(ticker=ticker, company_name=name, response_type="credit_monitor", summary=error)
