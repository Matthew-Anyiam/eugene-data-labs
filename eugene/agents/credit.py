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

CREDIT_MONITOR_SYSTEM_PROMPT = "You are an institutional credit analyst. Extract comprehensive credit intelligence from SEC filings with institutional-grade precision.\n\nCRITICAL: Every data point must include exact source tracing to enable verification.\n\nExtract:\n1. DEBT MATURITY PROFILE: Complete 5-year breakdown of debt maturities\n2. DEBT INSTRUMENTS: Each issuance with detailed rate analysis (fixed/floating, reset dates)\n3. COVENANTS: All financial covenants with current metrics, thresholds, compliance status\n4. REFINANCING RISK: Upcoming maturities vs liquidity capacity\n5. DISTRESS SIGNALS: Auditor changes, going concern, insider selling, covenant waivers\n6. INTEREST COVERAGE: Current and historical trends where available\n7. LIQUIDITY ANALYSIS: Cash, facilities, and availability\n8. CREDIT RISKS: Market, operational, refinancing risks\n\nFor each data point include:\n- source_section: exact section/note from filing\n- source_text: precise quote (max 150 chars)\n- confidence: 0.0-1.0\n- page_reference: page number if available\n\nReturn ONLY valid JSON. No markdown, no explanations.\n\nJSON Structure:\n{\n  \"debt_overview\": {\n    \"total_debt\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0, \"page_ref\": null},\n    \"total_long_term_debt\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0, \"page_ref\": null},\n    \"total_short_term_debt\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0, \"page_ref\": null},\n    \"cash_and_equivalents\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0, \"page_ref\": null},\n    \"net_debt\": {\"value\": null, \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0, \"page_ref\": null}\n  },\n  \"debt_maturity_profile\": {\n    \"next_12_months\": {\"amount\": 0, \"percentage_of_total\": 0, \"source_section\": \"\"},\n    \"years_2_3\": {\"amount\": 0, \"percentage_of_total\": 0, \"source_section\": \"\"},\n    \"years_4_5\": {\"amount\": 0, \"percentage_of_total\": 0, \"source_section\": \"\"},\n    \"beyond_5_years\": {\"amount\": 0, \"percentage_of_total\": 0, \"source_section\": \"\"},\n    \"annual_breakdown\": [{\"year\": 2025, \"amount\": 0, \"major_instruments\": []}]\n  },\n  \"debt_instruments\": [\n    {\n      \"name\": \"\", \"type\": \"\", \"principal\": 0, \"currency\": \"USD\",\n      \"interest_rate\": null, \"rate_type\": \"fixed|floating|variable\",\n      \"rate_benchmark\": \"\", \"rate_spread\": null, \"reset_frequency\": \"\",\n      \"maturity_date\": null, \"callable\": false, \"conversion_features\": false,\n      \"guarantees\": \"\", \"collateral\": \"\", \"covenants_reference\": \"\",\n      \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0\n    }\n  ],\n  \"financial_covenants\": [\n    {\n      \"covenant_name\": \"\", \"covenant_type\": \"maintenance|incurrence\",\n      \"metric\": \"\", \"threshold\": null, \"operator\": \">\",\n      \"current_value\": null, \"prior_period_value\": null,\n      \"in_compliance\": null, \"cushion_percentage\": null,\n      \"test_frequency\": \"\", \"next_test_date\": null,\n      \"waiver_history\": [], \"amendment_history\": [],\n      \"source_section\": \"\", \"source_text\": \"\", \"confidence\": 0\n    }\n  ],\n  \"refinancing_analysis\": {\n    \"near_term_maturities\": {\"next_12m\": 0, \"next_24m\": 0},\n    \"refinancing_capacity\": {\"available_liquidity\": 0, \"unencumbered_assets\": null},\n    \"market_access\": {\"recent_issuances\": [], \"credit_ratings\": []},\n    \"refinancing_risk_score\": \"low|moderate|high|critical\",\n    \"risk_factors\": []\n  },\n  \"distress_signals\": {\n    \"auditor_changes\": {\"detected\": false, \"details\": \"\", \"source_section\": \"\"},\n    \"going_concern\": {\"detected\": false, \"details\": \"\", \"source_section\": \"\"},\n    \"covenant_waivers\": {\"detected\": false, \"details\": [], \"source_section\": \"\"},\n    \"management_changes\": {\"detected\": false, \"details\": \"\", \"source_section\": \"\"},\n    \"asset_sales\": {\"detected\": false, \"details\": [], \"source_section\": \"\"},\n    \"debt_restructuring\": {\"detected\": false, \"details\": \"\", \"source_section\": \"\"}\n  },\n  \"interest_coverage_analysis\": {\n    \"current_period\": {\"ebit_coverage\": null, \"ebitda_coverage\": null, \"fcf_coverage\": null},\n    \"trend_analysis\": {\"improving|stable|deteriorating\": \"\", \"periods_analyzed\": 0},\n    \"covenant_coverage_ratios\": []\n  },\n  \"liquidity_profile\": {\n    \"cash_and_equivalents\": {\"value\": null, \"source_section\": \"\", \"confidence\": 0},\n    \"credit_facilities\": [\n      {\n        \"facility_type\": \"\", \"total_committed\": 0, \"outstanding\": 0,\n        \"available\": 0, \"maturity\": null, \"pricing\": \"\",\n        \"financial_covenants\": [], \"source_section\": \"\"\n      }\n    ],\n    \"commercial_paper\": {\"program_size\": null, \"outstanding\": null, \"backup_facilities\": null},\n    \"total_liquidity\": null,\n    \"liquidity_runway_months\": null\n  },\n  \"credit_risks\": [\n    {\"category\": \"refinancing|interest_rate|covenant|liquidity|market\", \"risk_description\": \"\", \"severity\": \"low|moderate|high|critical\", \"mitigation\": \"\", \"source_section\": \"\"}\n  ],\n  \"summary\": \"\"\n}\n\nAll monetary amounts in millions USD unless specified."

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

    def _assess_refinancing_risk(self, debt_maturity_data, liquidity_data, market_conditions=None):
        """Assess refinancing risk based on maturity profile and liquidity."""
        near_term_maturities = {
            'next_12m': debt_maturity_data.get('next_12_months', {}).get('amount', 0),
            'next_24m': debt_maturity_data.get('next_12_months', {}).get('amount', 0) +
                       debt_maturity_data.get('years_2_3', {}).get('amount', 0)
        }

        total_liquidity = liquidity_data.get('total_liquidity', 0)

        # Calculate refinancing capacity
        refinancing_capacity = {
            'available_liquidity': total_liquidity,
            'coverage_ratio_12m': total_liquidity / near_term_maturities['next_12m'] if near_term_maturities['next_12m'] > 0 else float('inf'),
            'coverage_ratio_24m': total_liquidity / near_term_maturities['next_24m'] if near_term_maturities['next_24m'] > 0 else float('inf')
        }

        # Determine risk score
        risk_score = "low"
        risk_factors = []

        if refinancing_capacity['coverage_ratio_12m'] < 1.0:
            risk_score = "critical"
            risk_factors.append("Near-term maturities exceed available liquidity")
        elif refinancing_capacity['coverage_ratio_12m'] < 1.5:
            risk_score = "high"
            risk_factors.append("Limited liquidity cushion for near-term maturities")
        elif refinancing_capacity['coverage_ratio_24m'] < 1.0:
            risk_score = "moderate"
            risk_factors.append("24-month maturity wall may strain liquidity")

        return {
            'near_term_maturities': near_term_maturities,
            'refinancing_capacity': refinancing_capacity,
            'refinancing_risk_score': risk_score,
            'risk_factors': risk_factors,
            'market_access': {'recent_issuances': [], 'credit_ratings': []}
        }

    def _enhance_xbrl_sourcing(self, extracted_data, xbrl_data):
        """Add detailed XBRL tag sourcing to every financial metric."""
        if not xbrl_data or not hasattr(xbrl_data, 'get_fact'):
            return extracted_data

        # Add XBRL sources to debt overview
        debt_overview = extracted_data.get('debt_overview', {})
        for metric_name, metric_data in debt_overview.items():
            if isinstance(metric_data, dict):
                xbrl_fact = xbrl_data.get_fact(metric_name)
                if xbrl_fact:
                    metric_data['xbrl_source'] = {
                        'tag': xbrl_fact.tag,
                        'period_end': xbrl_fact.period_end,
                        'unit': xbrl_fact.unit,
                        'fiscal_year': xbrl_fact.fiscal_year,
                        'form': xbrl_fact.form
                    }

        return extracted_data

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

        # Get multi-year data for trend analysis
        historical_data = self.get_multi_year_financials(ticker)

        sections = self._find_credit_sections(text)
        analysis_text = "\n\n---\n\n".join(sections)
        if len(analysis_text) > 20000:  # Increased for institutional analysis
            analysis_text = analysis_text[:20000]
        from eugene.extraction.llm import ExtractionRequest
        request = ExtractionRequest(
            text=analysis_text, schema={},
            system_prompt=CREDIT_MONITOR_SYSTEM_PROMPT,
            user_prompt=CREDIT_MONITOR_USER_PROMPT.format(
                company_name=company.name, ticker=ticker,
                filing_type="10-K", filing_date=filing.filing_date,
                text=analysis_text
            ),
            max_tokens=6144, temperature=0.0  # Increased for detailed analysis
        )
        response = self.llm.extract(request)
        total_tokens += response.tokens_used
        if not response.success:
            return self._empty_response(ticker, company.name, "Extraction failed: {}".format(response.error))
        data = response.data or {}

        # Enhanced analysis with institutional-grade features
        try:
            from eugene.sources.xbrl import XBRLClient
            xbrl = XBRLClient(self.config)
            xbrl_data = xbrl.get_financials(ticker)

            # Traditional health scoring
            health = compute_health_score_xbrl(xbrl_data)
            data["financial_health"] = health

            # Add interest coverage trend analysis
            coverage_analysis = self._analyze_coverage_trends(historical_data)
            data["interest_coverage_analysis"] = {
                "current_period": {
                    "ebit_coverage": coverage_analysis['annual_coverage'][0]['ebit_coverage'] if coverage_analysis['annual_coverage'] else None,
                    "ebitda_coverage": coverage_analysis['annual_coverage'][0]['ebitda_coverage'] if coverage_analysis['annual_coverage'] else None
                },
                "trend_analysis": {
                    "trend": coverage_analysis['trend'],
                    "periods_analyzed": coverage_analysis['periods_analyzed']
                },
                "historical_coverage": coverage_analysis['annual_coverage']
            }

            # Add refinancing risk assessment
            debt_maturity_profile = data.get('debt_maturity_profile', {})
            liquidity_profile = data.get('liquidity_profile', {})
            refinancing_analysis = self._assess_refinancing_risk(debt_maturity_profile, liquidity_profile)
            data["refinancing_analysis"] = refinancing_analysis

            # Add distress signal detection
            distress_signals = self._detect_distress_signals(text, historical_data)
            data["distress_signals"] = distress_signals

            # Add credit rating migration analysis
            rating_analysis = self._assess_credit_rating_migration(ticker, historical_data)
            data["credit_rating_analysis"] = rating_analysis

            # Perform liquidity stress testing
            current_year_metrics = historical_data[0] if historical_data else None
            stress_test = self._perform_liquidity_stress_test(liquidity_profile, debt_maturity_profile, current_year_metrics)
            data["liquidity_stress_test"] = stress_test

            # Enhance with XBRL sourcing
            data = self._enhance_xbrl_sourcing(data, xbrl_data)

        except Exception as e:
            logger.warning("Enhanced analysis failed: {}".format(e))
            health = {"ratios": {}, "health_rating": None, "error": str(e)}
            data["financial_health"] = health

        # Build comprehensive cited values with institutional tracing
        cited_values = self._build_institutional_citations(data, filing_source, historical_data)

        if include_quarterly:
            q_result = self._add_quarterly(ticker, company.name, total_tokens)
            if q_result:
                cited_values.extend(q_result["cited_values"])
                all_sources.extend(q_result["sources"])
                total_tokens += q_result["tokens"]

        # Generate institutional summary
        institutional_summary = self._generate_institutional_summary(data)

        elapsed = int((time.time() - start_time) * 1000)
        return SourcedResponse(
            ticker=ticker, company_name=company.name,
            response_type="institutional_credit_analysis", data=data,
            cited_values=cited_values, sources_used=all_sources,
            summary=institutional_summary,
            processing_time_ms=elapsed, tokens_used=total_tokens
        )

    def get_multi_year_financials(self, ticker, years=5):
        """Get historical financial data for trend analysis."""
        try:
            from eugene.sources.xbrl import XBRLClient
            xbrl = XBRLClient(self.config)

            historical_data = []

            # Get historical data for key metrics
            metrics_to_fetch = ['total_debt', 'interest_expense', 'operating_income',
                               'cash_and_equivalents', 'total_assets', 'depreciation_amortization',
                               'operating_cash_flow']

            # Fetch historical data for each metric
            metric_histories = {}
            for metric in metrics_to_fetch:
                try:
                    metric_histories[metric] = xbrl.get_historical(ticker, metric, years=years)
                except Exception as e:
                    logger.warning(f"Failed to get historical {metric}: {e}")
                    metric_histories[metric] = []

            # Organize by year
            years_data = {}
            for metric, facts in metric_histories.items():
                for fact in facts:
                    year = fact.fiscal_year
                    if year not in years_data:
                        years_data[year] = {
                            'year': year,
                            'filing_date': fact.filed,
                            'accession_number': fact.accession
                        }
                    years_data[year][metric] = fact.value

            # Convert to list and calculate EBITDA
            for year_data in years_data.values():
                year_data['ebitda'] = self._calculate_ebitda(year_data)
                historical_data.append(year_data)

            return sorted(historical_data, key=lambda x: x['year'], reverse=True)
        except Exception as e:
            logger.warning(f"Failed to get multi-year data: {e}")
            return []

    def _calculate_ebitda(self, year_data):
        """Calculate EBITDA from year data."""
        operating_income = year_data.get('operating_income')
        depreciation = year_data.get('depreciation_amortization')

        if operating_income is not None and depreciation is not None:
            return operating_income + depreciation
        return year_data.get('operating_cash_flow')  # fallback

    def _analyze_coverage_trends(self, historical_data):
        """Analyze interest coverage trends over multiple years."""
        coverage_trends = []

        for year_data in historical_data:
            ebit = year_data.get('operating_income')
            ebitda = year_data.get('ebitda')
            interest = year_data.get('interest_expense')

            coverage_ratios = {
                'year': year_data['year'],
                'ebit_coverage': round(ebit / interest, 2) if ebit and interest and interest != 0 else None,
                'ebitda_coverage': round(ebitda / interest, 2) if ebitda and interest and interest != 0 else None
            }
            coverage_trends.append(coverage_ratios)

        # Determine trend
        trend = "stable"
        if len(coverage_trends) >= 3:
            recent_avg = sum(r['ebit_coverage'] for r in coverage_trends[:2] if r['ebit_coverage']) / 2
            older_avg = sum(r['ebit_coverage'] for r in coverage_trends[-2:] if r['ebit_coverage']) / 2

            if recent_avg > older_avg * 1.1:
                trend = "improving"
            elif recent_avg < older_avg * 0.9:
                trend = "deteriorating"

        return {
            'trend': trend,
            'annual_coverage': coverage_trends,
            'periods_analyzed': len(coverage_trends)
        }

    def _detect_distress_signals(self, text, historical_data):
        """Detect distress signals in filing text and historical data."""
        signals = {
            'auditor_changes': {'detected': False, 'details': '', 'source_section': ''},
            'going_concern': {'detected': False, 'details': '', 'source_section': ''},
            'covenant_waivers': {'detected': False, 'details': [], 'source_section': ''},
            'management_changes': {'detected': False, 'details': '', 'source_section': ''},
            'asset_sales': {'detected': False, 'details': [], 'source_section': ''},
            'debt_restructuring': {'detected': False, 'details': '', 'source_section': ''}
        }

        # Auditor changes
        auditor_keywords = ['change in accountant', 'former auditor', 'new auditor', 'audit firm']
        for keyword in auditor_keywords:
            if keyword.lower() in text.lower():
                signals['auditor_changes']['detected'] = True
                signals['auditor_changes']['details'] = 'Potential auditor change detected'
                break

        # Going concern
        concern_keywords = ['going concern', 'substantial doubt', 'ability to continue']
        for keyword in concern_keywords:
            if keyword.lower() in text.lower():
                signals['going_concern']['detected'] = True
                signals['going_concern']['details'] = 'Going concern qualification detected'
                break

        # Covenant waivers
        # Covenant waivers - require context words to avoid false positives
        waiver_patterns = [
            ('waiver', ['obtained', 'granted', 'received', 'requested', 'seeking']),
            ('amendment', ['debt', 'credit', 'loan', 'facility']),
            ('covenant violation', ['breach', 'default', 'non-compliance']),
            ('default', ['event of', 'technical', 'payment'])
        ]
        for keyword, context_words in waiver_patterns:
            keyword_lower = keyword.lower()
            text_lower = text.lower()
            keyword_pos = text_lower.find(keyword_lower)

            while keyword_pos >= 0:
                # Check 200 characters around the keyword for context
                start = max(0, keyword_pos - 200)
                end = min(len(text), keyword_pos + len(keyword) + 200)
                context_text = text_lower[start:end]

                # Check if any context words are present
                has_context = any(ctx.lower() in context_text for ctx in context_words)

                if has_context:
                    signals['covenant_waivers']['detected'] = True
                    signals['covenant_waivers']['details'].append(f'Covenant {keyword} with context detected')
                    break

                keyword_pos = text_lower.find(keyword_lower, keyword_pos + 1)

        # Asset sales (potential liquidity stress)
        asset_keywords = ['asset sale', 'divestiture', 'disposal of assets']
        for keyword in asset_keywords:
            if keyword.lower() in text.lower():
                signals['asset_sales']['detected'] = True
                signals['asset_sales']['details'].append(f'Asset sale activity: {keyword}')

        return signals

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

        # Priority 2: Institutional-grade debt and credit sections
        institutional_keywords = [
            # Core debt terms
            "Term Debt", "Notes Payable", "Long-Term Debt", "Debt Securities",
            "Commercial Paper", "Credit Facilit", "Revolving Credit", "Term Loan",
            # Covenant and compliance
            "Covenant", "Financial Covenant", "Maintenance Covenant", "Incurrence Covenant",
            "Compliance", "Default", "Event of Default", "Waiver", "Amendment",
            # Rate and pricing
            "Interest Rate", "Floating Rate", "Fixed Rate", "LIBOR", "SOFR", "Prime Rate",
            "Credit Spread", "Margin", "Pricing Grid", "Rate Reset",
            # Maturity and refinancing
            "Maturity", "Maturity Profile", "Refinancing", "Redemption", "Call Option",
            "Prepayment", "Mandatory Repayment", "Amortization",
            # Liquidity and facilities
            "Liquidity", "Available Capacity", "Unutilized", "Commitment",
            "Letter of Credit", "Swing Line", "Accordion Feature",
            # Security and guarantees
            "Collateral", "Security Interest", "Guarantee", "Subsidiary Guarantee",
            "Unsecured", "Senior", "Subordinated", "Pari Passu",
            # Distress indicators
            "Going Concern", "Substantial Doubt", "Auditor", "Management Changes",
            "Asset Sale", "Divestiture", "Restructuring"
        ]

        for kw in institutional_keywords:
            idx = text.find(kw)
            while idx > 0:
                too_close = any(abs(idx - pos) < 1500 for pos in found_positions)
                if not too_close:
                    start = max(0, idx - 300)
                    end = min(len(text), idx + 5000)  # Larger sections for detailed analysis
                    sections.append(text[start:end])
                    found_positions.add(idx)
                idx = text.find(kw, idx + 1)

        # Priority 3: Notes to financial statements (critical for covenant details)
        notes_patterns = ["Note ", "NOTE ", "Notes to ", "NOTES TO "]
        for pattern in notes_patterns:
            idx = text.find(pattern)
            count = 0
            while idx > 0 and count < 8:  # Limit to avoid over-extraction
                too_close = any(abs(idx - pos) < 2000 for pos in found_positions)
                if not too_close:
                    start = max(0, idx - 100)
                    end = min(len(text), idx + 6000)
                    sections.append(text[start:end])
                    found_positions.add(idx)
                    count += 1
                idx = text.find(pattern, idx + 1)

        if not sections:
            sections.append(text[:12000])  # Larger fallback for institutional analysis
        return sections[:15]  # More sections for comprehensive analysis

    def _build_institutional_citations(self, data, source, historical_data):
        """Build comprehensive citations with institutional-grade source tracing."""
        cited = []

        # Debt overview with enhanced sourcing
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
                # Add XBRL source if available
                xbrl_source = field_data.get('xbrl_source')
                if xbrl_source:
                    citation.xbrl_tag = xbrl_source.get('tag')
                    citation.xbrl_namespace = xbrl_source.get('namespace')
                    citation.period_end = xbrl_source.get('period_end')

                cited.append(CitedValue(field_name=field_name, value=field_data["value"],
                                        unit="millions_usd", citations=[citation]))

        # Debt instruments with enhanced parsing
        for inst in data.get("debt_instruments", []):
            citation = SourceCitation(
                source_type=source.source_type, document_name=source.document_name,
                filing_date=source.filing_date, accession_number=source.accession_number,
                section=inst.get("source_section", ""), extracted_text=inst.get("source_text", ""),
                confidence=inst.get("confidence", 0.0), url=source.url
            )
            cited.append(CitedValue(
                field_name="debt_instrument_{}".format(inst.get("name", "unknown")),
                value={
                    "principal": inst.get("principal"),
                    "rate": inst.get("interest_rate"),
                    "rate_type": inst.get("rate_type"),
                    "maturity": inst.get("maturity_date"),
                    "callable": inst.get("callable"),
                    "covenants": inst.get("covenants_reference")
                },
                unit="millions_usd", citations=[citation]
            ))

        # Financial covenants with compliance tracking
        for cov in data.get("financial_covenants", []):
            citation = SourceCitation(
                source_type=source.source_type, document_name=source.document_name,
                filing_date=source.filing_date, accession_number=source.accession_number,
                section=cov.get("source_section", ""), extracted_text=cov.get("source_text", ""),
                confidence=cov.get("confidence", 0.0), url=source.url
            )
            cited.append(CitedValue(
                field_name="covenant_{}".format(cov.get("covenant_name", "unknown")),
                value={
                    "threshold": cov.get("threshold"),
                    "current_value": cov.get("current_value"),
                    "in_compliance": cov.get("in_compliance"),
                    "cushion_percentage": cov.get("cushion_percentage"),
                    "test_frequency": cov.get("test_frequency")
                },
                citations=[citation]
            ))

        # Historical trend citations
        coverage_analysis = data.get("interest_coverage_analysis", {})
        if coverage_analysis.get("historical_coverage"):
            for year_data in historical_data:
                if year_data.get('accession_number'):
                    historical_citation = SourceCitation(
                        source_type=SourceType.SEC_10K.value,
                        document_name=f"{source.document_name.split(' ')[0]} 10-K FY{year_data['year']}",
                        filing_date=year_data['filing_date'],
                        accession_number=year_data['accession_number'],
                        url=f"https://www.sec.gov/Archives/edgar/data/{year_data['accession_number']}"
                    )
                    cited.append(CitedValue(
                        field_name=f"interest_coverage_{year_data['year']}",
                        value=year_data.get('operating_income', 0) / year_data.get('interest_expense', 1) if year_data.get('interest_expense') else None,
                        unit="ratio", citations=[historical_citation]
                    ))

        return cited

    def _generate_institutional_summary(self, data):
        """Generate institutional-grade summary focusing on key credit risks."""
        summary_points = []

        # Debt maturity concentration
        maturity_profile = data.get('debt_maturity_profile', {})
        near_term_pct = maturity_profile.get('next_12_months', {}).get('percentage_of_total', 0)
        if near_term_pct > 30:
            summary_points.append(f"HIGH REFINANCING RISK: {near_term_pct}% of debt matures within 12 months")
        elif near_term_pct > 20:
            summary_points.append(f"MODERATE REFINANCING RISK: {near_term_pct}% of debt matures within 12 months")

        # Covenant compliance
        covenants = data.get('financial_covenants', [])
        at_risk_covenants = [c for c in covenants if c.get('cushion_percentage', 100) < 15]
        if at_risk_covenants:
            summary_points.append(f"COVENANT RISK: {len(at_risk_covenants)} covenant(s) with <15% cushion")

        # Coverage trend
        coverage_trend = data.get('interest_coverage_analysis', {}).get('trend_analysis', {}).get('trend')
        if coverage_trend == 'deteriorating':
            summary_points.append("COVERAGE DETERIORATION: Interest coverage ratios declining")

        # Distress signals
        distress = data.get('distress_signals', {})
        active_signals = [k for k, v in distress.items() if v.get('detected')]
        if active_signals:
            summary_points.append(f"DISTRESS SIGNALS: {', '.join(active_signals)} detected")

        # Liquidity assessment
        refinancing = data.get('refinancing_analysis', {})
        risk_score = refinancing.get('refinancing_risk_score')
        if risk_score in ['high', 'critical']:
            summary_points.append(f"LIQUIDITY CONCERN: {risk_score.upper()} refinancing risk")

        if not summary_points:
            summary_points.append("Credit profile appears stable with no immediate concerns identified")

        return " | ".join(summary_points)

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

    def _assess_credit_rating_migration(self, ticker, historical_data):
        """Analyze credit rating changes and migration trends."""
        try:
            # This would integrate with credit rating APIs in production
            # For now, we analyze financial trends that indicate rating pressure
            migration_analysis = {
                'rating_trend': 'stable',
                'key_metrics_trend': {},
                'rating_pressure_indicators': [],
                'peer_comparison': None
            }

            if len(historical_data) >= 3:
                # Analyze key credit metrics over time
                debt_trend = self._analyze_metric_trend([d.get('total_debt') for d in historical_data])
                coverage_trend = self._analyze_coverage_metric_trend(historical_data)

                migration_analysis['key_metrics_trend'] = {
                    'debt_growth': debt_trend,
                    'coverage_trend': coverage_trend
                }

                # Identify rating pressure
                if debt_trend == 'increasing' and coverage_trend == 'deteriorating':
                    migration_analysis['rating_pressure_indicators'].append('Deteriorating leverage and coverage metrics')
                    migration_analysis['rating_trend'] = 'negative'

            return migration_analysis
        except Exception as e:
            logger.warning(f"Credit rating analysis failed: {e}")
            return {'rating_trend': 'unknown', 'error': str(e)}

    def _analyze_metric_trend(self, values):
        """Analyze trend in a series of metric values."""
        clean_values = [v for v in values if v is not None]
        if len(clean_values) < 2:
            return 'insufficient_data'

        recent_avg = sum(clean_values[:2]) / 2 if len(clean_values) >= 2 else clean_values[0]
        older_avg = sum(clean_values[-2:]) / 2 if len(clean_values) >= 2 else clean_values[-1]

        if recent_avg > older_avg * 1.1:
            return 'increasing'
        elif recent_avg < older_avg * 0.9:
            return 'decreasing'
        else:
            return 'stable'

    def _analyze_coverage_metric_trend(self, historical_data):
        """Analyze interest coverage trend specifically."""
        coverage_ratios = []
        for year_data in historical_data:
            ebit = year_data.get('operating_income')
            interest = year_data.get('interest_expense')
            if ebit and interest and interest != 0:
                coverage_ratios.append(ebit / interest)

        return self._analyze_metric_trend(coverage_ratios)

    def _perform_liquidity_stress_test(self, liquidity_data, debt_maturity_data, operating_metrics=None):
        """Perform liquidity stress testing under various scenarios."""
        try:
            base_liquidity = liquidity_data.get('total_liquidity', 0)
            near_term_debt = debt_maturity_data.get('next_12_months', {}).get('amount', 0)

            stress_scenarios = {
                'base_case': {
                    'available_liquidity': base_liquidity,
                    'debt_maturities': near_term_debt,
                    'liquidity_cushion': base_liquidity - near_term_debt,
                    'survival_months': self._calculate_runway(base_liquidity, operating_metrics)
                },
                'mild_stress': {
                    'assumptions': '20% reduction in available credit facilities',
                    'available_liquidity': base_liquidity * 0.8,
                    'debt_maturities': near_term_debt,
                    'liquidity_cushion': (base_liquidity * 0.8) - near_term_debt,
                    'survival_months': self._calculate_runway(base_liquidity * 0.8, operating_metrics)
                },
                'severe_stress': {
                    'assumptions': '50% reduction in facilities, 20% increase in cash burn',
                    'available_liquidity': base_liquidity * 0.5,
                    'debt_maturities': near_term_debt,
                    'increased_burn': True,
                    'liquidity_cushion': (base_liquidity * 0.5) - near_term_debt,
                    'survival_months': self._calculate_runway(base_liquidity * 0.5, operating_metrics, 1.2)
                }
            }

            return stress_scenarios
        except Exception as e:
            logger.warning(f"Liquidity stress test failed: {e}")
            return {'error': str(e)}

    def _calculate_runway(self, available_liquidity, operating_metrics, burn_multiplier=1.0):
        """Calculate liquidity runway in months."""
        if not operating_metrics or not available_liquidity:
            return None

        # Use operating cash flow as proxy for cash generation/burn
        quarterly_ocf = operating_metrics.get('operating_cash_flow', 0) / 4  # Convert annual to quarterly
        monthly_cash_flow = quarterly_ocf / 3

        if monthly_cash_flow >= 0:
            return float('inf')  # Cash generative
        else:
            monthly_burn = abs(monthly_cash_flow) * burn_multiplier
            return available_liquidity / monthly_burn if monthly_burn > 0 else float('inf')

    def _empty_response(self, ticker, name, error):
        return SourcedResponse(ticker=ticker, company_name=name, response_type="institutional_credit_analysis", summary=error)
