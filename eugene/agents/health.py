"""
Eugene Intelligence - Company Health Monitor
Pure XBRL + Python. No LLM. Deterministic.
Presents industry-standard financial metrics with context.
No grades. No scores. Data speaks for itself.
"""
import logging
from typing import Optional, Dict, List
from dataclasses import dataclass, field
from datetime import datetime
from eugene.config import Config, get_config
from eugene.sources.xbrl import XBRLClient

logger = logging.getLogger(__name__)


METRIC_DEFINITIONS = {
    "current_ratio": {
        "name": "Current Ratio",
        "formula": "Current Assets / Current Liabilities",
        "what_it_measures": "Short-term liquidity — can the company pay bills due within a year",
        "industry_note": "Below 1.0 is common in tech and retail (negative working capital models). Manufacturing typically needs above 1.5.",
    },
    "quick_ratio": {
        "name": "Quick Ratio",
        "formula": "(Current Assets - Inventory) / Current Liabilities",
        "what_it_measures": "Liquidity excluding inventory — stricter than current ratio",
        "industry_note": "Most relevant for companies with significant inventory.",
    },
    "debt_to_assets": {
        "name": "Debt-to-Assets",
        "formula": "Total Debt / Total Assets",
        "what_it_measures": "What proportion of assets are funded by debt",
        "industry_note": "Utilities and telecoms often run 0.5-0.7. Tech companies typically below 0.3. Banks are structurally different.",
    },
    "debt_to_equity": {
        "name": "Debt-to-Equity",
        "formula": "Total Debt / Total Equity",
        "what_it_measures": "Leverage — how much debt relative to shareholder equity",
        "industry_note": "Negative equity is common in companies with heavy buybacks (e.g., Starbucks, Boeing). Does not necessarily indicate distress.",
    },
    "interest_coverage": {
        "name": "Interest Coverage",
        "formula": "EBIT / Interest Expense",
        "what_it_measures": "How easily the company can pay interest on outstanding debt",
        "industry_note": "Below 1.5x is a warning sign across all sectors. Above 8x is very comfortable.",
    },
    "net_debt_to_ebitda": {
        "name": "Net Debt / EBITDA",
        "formula": "(Total Debt - Cash) / EBITDA",
        "what_it_measures": "How many years of earnings needed to pay off net debt",
        "industry_note": "Negative means net cash position. Below 2x is conservative. Above 4x warrants attention. Leveraged buyouts often run 5-7x.",
    },
    "roe_pct": {
        "name": "Return on Equity (ROE)",
        "formula": "Net Income / Total Equity * 100",
        "what_it_measures": "How effectively shareholder capital generates profit",
        "industry_note": "15-20% is strong for most industries. Banks target 10-15%. Can be artificially high with low equity base.",
    },
    "roa_pct": {
        "name": "Return on Assets (ROA)",
        "formula": "Net Income / Total Assets * 100",
        "what_it_measures": "How efficiently assets generate profit",
        "industry_note": "Asset-light businesses (tech, services) typically higher. Banks run 0.8-1.5% due to massive balance sheets.",
    },
    "roic_pct": {
        "name": "Return on Invested Capital (ROIC)",
        "formula": "EBIT / (Total Debt + Total Equity) * 100",
        "what_it_measures": "Return generated on all invested capital (debt + equity)",
        "industry_note": "Above cost of capital (~8-10%) means value creation. Warren Buffett's preferred metric.",
    },
    "net_margin_pct": {
        "name": "Net Profit Margin",
        "formula": "Net Income / Revenue * 100",
        "what_it_measures": "How much of each dollar of revenue becomes profit",
        "industry_note": "Software/SaaS: 20-40%. Banks: 25-35%. Retail/grocery: 1-3%. Manufacturing: 5-15%.",
    },
    "operating_margin_pct": {
        "name": "Operating Margin",
        "formula": "Operating Income / Revenue * 100",
        "what_it_measures": "Profitability from core operations before interest and taxes",
        "industry_note": "Better than net margin for comparing across tax jurisdictions and capital structures.",
    },
    "free_cash_flow": {
        "name": "Free Cash Flow",
        "formula": "Operating Cash Flow - Capital Expenditures",
        "what_it_measures": "Cash available after maintaining/expanding the asset base",
        "industry_note": "The ultimate measure of financial flexibility. Negative FCF is normal for high-growth companies investing heavily.",
    },
    "altman_z_score": {
        "name": "Altman Z-Score",
        "formula": "1.2*(WC/TA) + 1.4*(RE/TA) + 3.3*(EBIT/TA) + 0.6*(Equity/TL) + 1.0*(Rev/TA)",
        "what_it_measures": "Bankruptcy probability model developed by Edward Altman in 1968",
        "industry_note": "Above 3.0: safe. 1.8-3.0: grey zone. Below 1.8: distress. Designed for manufacturing — less reliable for tech, banks, and companies with heavy buybacks. Uses book equity here, not market cap.",
    },
    "revenue_per_employee": {
        "name": "Revenue per Employee",
        "formula": "Revenue / Number of Employees",
        "what_it_measures": "Workforce productivity and business model efficiency",
        "industry_note": "Tech companies often exceed $500K. Labor-intensive industries much lower.",
    },
}


@dataclass
class HealthReport:
    ticker: str
    company_name: str
    metrics: Dict
    trends: Dict
    xbrl_sources: Dict
    computed_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    data_source: str = "SEC XBRL (deterministic, no LLM)"

    def to_dict(self):
        return {
            "ticker": self.ticker,
            "company_name": self.company_name,
            "metrics": self.metrics,
            "trends": self.trends,
            "xbrl_sources": self.xbrl_sources,
            "computed_at": self.computed_at,
            "data_source": self.data_source,
        }


class HealthMonitor:
    """Presents industry-standard financial metrics for any public company.
    No grades. No scores. Data and context only.
    Three inputs: XBRL data, Python math, metric definitions."""

    def __init__(self, config=None):
        self.config = config or get_config()
        self._xbrl = None

    @property
    def xbrl(self):
        if self._xbrl is None:
            self._xbrl = XBRLClient(self.config)
        return self._xbrl

    def analyze(self, ticker, include_trends=True, years=5):
        ticker = ticker.upper()
        financials = self.xbrl.get_financials(ticker)
        metrics, sources = self._compute_metrics(financials)
        trends = {}
        if include_trends:
            trends = self._compute_trends(ticker, years)
        return HealthReport(
            ticker=ticker,
            company_name=financials.company_name,
            metrics=metrics,
            trends=trends,
            xbrl_sources=sources,
        )

    def compare(self, tickers, include_trends=True, years=5):
        """Compare metrics across multiple companies. No ranking — just data side by side."""
        results = {}
        for ticker in tickers:
            try:
                report = self.analyze(ticker, include_trends=include_trends, years=years)
                results[ticker.upper()] = report.to_dict()
            except Exception as e:
                logger.warning("Failed to analyze {}: {}".format(ticker, e))
                results[ticker.upper()] = {"error": str(e)}
        return {
            "companies": results,
            "metric_definitions": {k: v for k, v in METRIC_DEFINITIONS.items()
                                   if any(k in results[t].get("metrics", {}) for t in results if "metrics" in results[t])},
            "count": len(tickers),
            "computed_at": datetime.utcnow().isoformat(),
            "data_source": "SEC XBRL (deterministic, no LLM)",
        }

    def _compute_metrics(self, xbrl_financials):
        metrics = {}
        sources = {}

        def g(key):
            return xbrl_financials.get(key)

        def track(metric_name, inputs):
            tag_sources = {}
            for k in inputs:
                fact = xbrl_financials.get_fact(k)
                if fact:
                    tag_sources[k] = {"xbrl_tag": fact.tag, "value": fact.value, "period_end": fact.period_end}
            sources[metric_name] = tag_sources

        def add_metric(name, value, inputs):
            defn = METRIC_DEFINITIONS.get(name, {})
            metrics[name] = {
                "value": value,
                "name": defn.get("name", name),
                "formula": defn.get("formula", ""),
                "what_it_measures": defn.get("what_it_measures", ""),
                "industry_note": defn.get("industry_note", ""),
            }
            track(name, inputs)

        total_assets = g("total_assets")
        total_liabilities = g("total_liabilities")
        current_assets = g("current_assets")
        current_liabilities = g("current_liabilities")
        total_equity = g("total_equity")
        retained_earnings = g("retained_earnings")
        revenue = g("revenue")
        ebit = g("operating_income")
        net_income = g("net_income")
        interest_expense = g("interest_expense")
        operating_cf = g("operating_cash_flow")
        capex = g("capital_expenditures")
        dep_amort = g("depreciation_amortization")
        total_debt = g("total_debt")
        cash = g("cash_and_equivalents")

        net_debt = (total_debt - cash) if total_debt is not None and cash is not None else None
        ebitda = (ebit + dep_amort) if ebit is not None and dep_amort is not None else None
        if ebitda is None and operating_cf is not None:
            ebitda = operating_cf
        fcf = (operating_cf - abs(capex)) if operating_cf is not None and capex is not None else None

        # Liquidity
        if current_assets and current_liabilities and current_liabilities != 0:
            add_metric("current_ratio", round(current_assets / current_liabilities, 2),
                       ["current_assets", "current_liabilities"])

        # Leverage
        if total_debt and total_assets and total_assets != 0:
            add_metric("debt_to_assets", round(total_debt / total_assets, 3),
                       ["total_debt", "total_assets"])

        if total_debt and total_equity and total_equity != 0:
            add_metric("debt_to_equity", round(total_debt / abs(total_equity), 2),
                       ["total_debt", "total_equity"])
            if total_equity < 0:
                metrics["debt_to_equity"]["note"] = "Negative equity — common with heavy share buybacks"

        # Debt Service
        if ebit and interest_expense and interest_expense != 0:
            add_metric("interest_coverage", round(ebit / interest_expense, 2),
                       ["operating_income", "interest_expense"])

        if net_debt is not None and ebitda and ebitda != 0:
            add_metric("net_debt_to_ebitda", round(net_debt / ebitda, 2),
                       ["total_debt", "cash_and_equivalents", "operating_income", "depreciation_amortization"])

        # Profitability
        if net_income and total_equity and total_equity > 0:
            add_metric("roe_pct", round((net_income / total_equity) * 100, 1),
                       ["net_income", "total_equity"])

        if net_income and total_assets and total_assets != 0:
            add_metric("roa_pct", round((net_income / total_assets) * 100, 2),
                       ["net_income", "total_assets"])

        if ebit and total_debt is not None and total_equity is not None:
            invested = total_debt + total_equity
            if invested > 0:
                add_metric("roic_pct", round((ebit / invested) * 100, 1),
                           ["operating_income", "total_debt", "total_equity"])

        if net_income and revenue and revenue != 0:
            add_metric("net_margin_pct", round((net_income / revenue) * 100, 1),
                       ["net_income", "revenue"])

        if ebit and revenue and revenue != 0:
            add_metric("operating_margin_pct", round((ebit / revenue) * 100, 1),
                       ["operating_income", "revenue"])

        # Cash Generation
        if fcf is not None:
            add_metric("free_cash_flow", round(fcf / 1_000_000, 1),
                       ["operating_cash_flow", "capital_expenditures"])
            metrics["free_cash_flow"]["unit"] = "millions_usd"

        # Bankruptcy Model
        if all(v is not None for v in [current_assets, current_liabilities, total_assets,
               ebit, total_equity, total_liabilities, revenue]) and total_assets != 0 and total_liabilities != 0:
            wc = current_assets - current_liabilities
            re_val = retained_earnings if retained_earnings is not None else 0
            x1 = wc / total_assets
            x2 = re_val / total_assets
            x3 = ebit / total_assets
            x4 = (total_equity / total_liabilities) if total_equity > 0 else 0
            x5 = revenue / total_assets
            z = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5
            add_metric("altman_z_score", round(z, 2),
                       ["current_assets", "current_liabilities", "total_assets",
                        "retained_earnings", "operating_income", "total_equity",
                        "total_liabilities", "revenue"])

        # Key absolute values for context
        if revenue:
            metrics["_revenue"] = {"value": revenue, "unit": "USD", "label": "Total Revenue"}
            track("_revenue", ["revenue"])
        if net_income:
            metrics["_net_income"] = {"value": net_income, "unit": "USD", "label": "Net Income"}
            track("_net_income", ["net_income"])
        if total_debt:
            metrics["_total_debt"] = {"value": total_debt, "unit": "USD", "label": "Total Debt"}
            track("_total_debt", ["total_debt"])
        if cash:
            metrics["_cash"] = {"value": cash, "unit": "USD", "label": "Cash & Equivalents"}
            track("_cash", ["cash_and_equivalents"])
        if total_assets:
            metrics["_total_assets"] = {"value": total_assets, "unit": "USD", "label": "Total Assets"}
            track("_total_assets", ["total_assets"])

        return metrics, sources

    def _compute_trends(self, ticker, years):
        trends = {}
        trend_metrics = ["revenue", "net_income", "operating_cash_flow", "total_debt",
                        "total_assets", "eps_basic"]
        for metric in trend_metrics:
            try:
                history = self.xbrl.get_historical(ticker, metric, years=years)
                if len(history) >= 2:
                    values = [{"fiscal_year": h.fiscal_year, "value": h.value} for h in history]
                    first = history[0].value
                    last = history[-1].value
                    cagr = None
                    if first and first > 0 and last and last > 0 and len(history) > 1:
                        cagr = round(((last / first) ** (1.0 / (len(history) - 1)) - 1) * 100, 1)
                    change_pct = round(((last - first) / abs(first)) * 100, 1) if first and first != 0 else None
                    trends[metric] = {
                        "values": values,
                        "cagr_pct": cagr,
                        "total_change_pct": change_pct,
                        "direction": "up" if last > first else "down" if last < first else "flat",
                        "years": len(history),
                    }
            except Exception as e:
                logger.warning("Trend failed for {} {}: {}".format(ticker, metric, e))
        return trends
