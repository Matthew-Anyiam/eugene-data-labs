"""
Eugene Intelligence - Markdown Output Formatter

Converts extracted data to clean markdown tables optimized for LLM consumption.
Key insight from Fintool: "LLMs are surprisingly good at reasoning over markdown tables.
But they're terrible at reasoning over HTML <table> tags or raw CSV dumps."

This module ensures all data delivered to agents is in clean, readable markdown.
"""

from typing import List, Dict, Any, Optional
from datetime import date
from dataclasses import dataclass


@dataclass
class MarkdownTable:
    """Represents a markdown table"""
    headers: List[str]
    rows: List[List[str]]
    title: Optional[str] = None
    footnotes: Optional[List[str]] = None
    
    def render(self) -> str:
        """Render the table as markdown"""
        lines = []
        
        if self.title:
            lines.append(f"### {self.title}")
            lines.append("")
        
        # Header row
        lines.append("| " + " | ".join(self.headers) + " |")
        
        # Separator
        lines.append("| " + " | ".join(["---"] * len(self.headers)) + " |")
        
        # Data rows
        for row in self.rows:
            # Ensure row has correct number of columns
            padded_row = row + [""] * (len(self.headers) - len(row))
            lines.append("| " + " | ".join(str(cell) for cell in padded_row[:len(self.headers)]) + " |")
        
        if self.footnotes:
            lines.append("")
            for i, note in enumerate(self.footnotes, 1):
                lines.append(f"({i}) {note}")
        
        return "\n".join(lines)


class CreditDataFormatter:
    """
    Formats credit/debt data as clean markdown for agent consumption.
    """
    
    @staticmethod
    def format_currency(value: Optional[float], unit: str = "M") -> str:
        """Format a currency value"""
        if value is None:
            return "—"
        if abs(value) >= 1000:
            return f"${value/1000:,.1f}B"
        return f"${value:,.0f}{unit}"
    
    @staticmethod
    def format_rate(value: Optional[float], is_bps: bool = False) -> str:
        """Format an interest rate"""
        if value is None:
            return "—"
        if is_bps:
            return f"{value:,.0f}bps"
        return f"{value*100:.2f}%"
    
    @staticmethod
    def format_ratio(value: Optional[float], decimals: int = 2) -> str:
        """Format a ratio"""
        if value is None:
            return "—"
        return f"{value:.{decimals}f}x"
    
    @staticmethod
    def format_date(value: Optional[str]) -> str:
        """Format a date string"""
        if value is None:
            return "—"
        try:
            d = date.fromisoformat(value)
            return d.strftime("%b %d, %Y")
        except (ValueError, TypeError):
            return value
    
    def format_credit_summary(self, data: Dict) -> str:
        """
        Format a complete credit summary as markdown.
        
        This is the main output format for agent consumption.
        """
        sections = []
        
        # Header
        ticker = data.get("ticker", data.get("company_ticker", "Unknown"))
        company = data.get("company_name", ticker)
        as_of = data.get("as_of_date", data.get("filing_date", "Unknown"))
        
        sections.append(f"# Credit Summary: {company} ({ticker})")
        sections.append(f"*As of {as_of}*")
        sections.append("")
        
        # Key Metrics
        sections.append(self._format_key_metrics(data))
        sections.append("")
        
        # Debt Instruments
        instruments = data.get("debt_instruments", [])
        if instruments:
            sections.append(self._format_debt_instruments(instruments))
            sections.append("")
        
        # Covenants
        covenants = data.get("covenants", [])
        if covenants:
            sections.append(self._format_covenants(covenants))
            sections.append("")
        
        # Maturity Schedule
        maturities = data.get("maturity_schedule", [])
        if maturities:
            sections.append(self._format_maturity_schedule(maturities))
            sections.append("")
        
        # Analysis Notes
        notes = data.get("extraction_notes") or data.get("analysis")
        if notes:
            sections.append("## Analysis Notes")
            sections.append(notes)
        
        return "\n".join(sections)
    
    def _format_key_metrics(self, data: Dict) -> str:
        """Format key credit metrics"""
        metrics = data.get("aggregate_metrics", data)
        
        total_debt = metrics.get("total_debt") or metrics.get("total_debt_millions")
        net_debt = metrics.get("net_debt") or metrics.get("net_debt_millions")
        cash = metrics.get("cash_and_equivalents") or metrics.get("cash_millions")
        ebitda = metrics.get("ebitda") or metrics.get("ebitda_millions")
        leverage = metrics.get("leverage_ratio")
        coverage = metrics.get("interest_coverage")
        
        table = MarkdownTable(
            title="Key Credit Metrics",
            headers=["Metric", "Value"],
            rows=[
                ["Total Debt", self.format_currency(total_debt)],
                ["Cash & Equivalents", self.format_currency(cash)],
                ["Net Debt", self.format_currency(net_debt)],
                ["EBITDA (LTM)", self.format_currency(ebitda)],
                ["Leverage Ratio", self.format_ratio(leverage) if leverage else "—"],
                ["Interest Coverage", self.format_ratio(coverage) if coverage else "—"],
            ]
        )
        
        return table.render()
    
    def _format_debt_instruments(self, instruments: List[Dict]) -> str:
        """Format debt instruments table"""
        rows = []
        
        for inst in instruments:
            name = inst.get("instrument_name", inst.get("name", "Unknown"))
            inst_type = inst.get("instrument_type", inst.get("type", "—"))
            outstanding = inst.get("outstanding_amount", inst.get("outstanding_millions"))
            
            # Format rate
            rate_type = inst.get("rate_type")
            if rate_type == "fixed":
                rate = self.format_rate(inst.get("interest_rate"))
            elif rate_type == "floating":
                ref = inst.get("reference_rate", "SOFR")
                spread = inst.get("spread_bps")
                rate = f"{ref} + {spread}bps" if spread else "Floating"
            else:
                rate = inst.get("rate", "—")
            
            maturity = self.format_date(inst.get("maturity_date", inst.get("maturity")))
            
            rows.append([
                name,
                inst_type.replace("_", " ").title() if inst_type != "—" else "—",
                self.format_currency(outstanding),
                rate,
                maturity
            ])
        
        table = MarkdownTable(
            title="Debt Instruments",
            headers=["Instrument", "Type", "Outstanding", "Rate", "Maturity"],
            rows=rows
        )
        
        return table.render()
    
    def _format_covenants(self, covenants: List[Dict]) -> str:
        """Format covenants table"""
        rows = []
        
        for cov in covenants:
            name = cov.get("covenant_name", cov.get("name", "Unknown"))
            cov_type = cov.get("covenant_type", cov.get("type", "—"))
            
            threshold = cov.get("threshold_value", cov.get("requirement"))
            current = cov.get("current_value", cov.get("current"))
            direction = cov.get("threshold_direction", "max")
            
            # Format threshold with direction
            if threshold is not None:
                threshold_str = f"{direction.title()} {self.format_ratio(threshold)}"
            else:
                threshold_str = "—"
            
            # Determine compliance status
            in_compliance = cov.get("in_compliance", cov.get("status") == "compliant")
            if in_compliance is True:
                status = "✓ Compliant"
            elif in_compliance is False:
                status = "✗ Breach"
            else:
                status = "—"
            
            # Calculate cushion
            cushion = cov.get("cushion_percent")
            if cushion is not None:
                cushion_str = f"{cushion:.1f}%"
            elif threshold is not None and current is not None:
                if direction == "max":
                    cushion_pct = (threshold - current) / threshold * 100
                else:
                    cushion_pct = (current - threshold) / threshold * 100
                cushion_str = f"{cushion_pct:.1f}%"
            else:
                cushion_str = "—"
            
            rows.append([
                name,
                threshold_str,
                self.format_ratio(current) if current else "—",
                cushion_str,
                status
            ])
        
        table = MarkdownTable(
            title="Financial Covenants",
            headers=["Covenant", "Threshold", "Current", "Cushion", "Status"],
            rows=rows
        )
        
        return table.render()
    
    def _format_maturity_schedule(self, maturities: List[Dict]) -> str:
        """Format maturity schedule table"""
        rows = []
        total = 0
        
        for mat in sorted(maturities, key=lambda x: x.get("fiscal_year", 0)):
            year = mat.get("fiscal_year")
            amount = mat.get("amount_due")
            
            if year and amount:
                total += amount
                rows.append([
                    str(year),
                    self.format_currency(amount)
                ])
        
        # Add total row
        rows.append(["**Total**", f"**{self.format_currency(total)}**"])
        
        table = MarkdownTable(
            title="Debt Maturity Schedule",
            headers=["Year", "Amount Due"],
            rows=rows
        )
        
        return table.render()
    
    def format_comparison(self, companies: List[Dict]) -> str:
        """Format a comparison of multiple companies"""
        if not companies:
            return "No data available for comparison."
        
        sections = []
        sections.append("# Credit Comparison")
        sections.append("")
        
        # Build comparison table
        headers = ["Metric"] + [c.get("ticker", "Unknown") for c in companies]
        
        metrics_to_compare = [
            ("Total Debt", "total_debt", self.format_currency),
            ("Net Debt", "net_debt", self.format_currency),
            ("Leverage Ratio", "leverage_ratio", self.format_ratio),
            ("Interest Coverage", "interest_coverage", self.format_ratio),
        ]
        
        rows = []
        for label, key, formatter in metrics_to_compare:
            row = [label]
            for company in companies:
                metrics = company.get("aggregate_metrics", company)
                value = metrics.get(key)
                row.append(formatter(value) if value else "—")
            rows.append(row)
        
        table = MarkdownTable(
            headers=headers,
            rows=rows
        )
        
        sections.append(table.render())
        
        return "\n".join(sections)
    
    def format_alert(self, alert: Dict) -> str:
        """Format a single alert as markdown"""
        severity = alert.get("severity", "info").upper()
        ticker = alert.get("ticker", alert.get("company_ticker", "Unknown"))
        title = alert.get("title", "Alert")
        message = alert.get("message", "")
        
        emoji = {"INFO": "ℹ️", "WARNING": "⚠️", "CRITICAL": "🚨"}.get(severity, "•")
        
        return f"{emoji} **[{severity}] {ticker}**: {title}\n\n{message}"
    
    def format_alerts(self, alerts: List[Dict]) -> str:
        """Format multiple alerts"""
        if not alerts:
            return "No active alerts."
        
        sections = ["# Credit Alerts", ""]
        
        for alert in alerts:
            sections.append(self.format_alert(alert))
            sections.append("")
        
        return "\n".join(sections)


# Convenience functions
def format_credit_summary(data: Dict) -> str:
    """Format credit data as markdown"""
    formatter = CreditDataFormatter()
    return formatter.format_credit_summary(data)


def format_for_agent(data: Dict, data_type: str = "credit") -> str:
    """
    Format data for agent consumption.
    
    This is the main entry point for preparing data to be sent to LLMs.
    """
    formatter = CreditDataFormatter()
    
    if data_type == "credit":
        return formatter.format_credit_summary(data)
    elif data_type == "comparison":
        return formatter.format_comparison(data if isinstance(data, list) else [data])
    elif data_type == "alert":
        return formatter.format_alert(data)
    elif data_type == "alerts":
        return formatter.format_alerts(data if isinstance(data, list) else [data])
    else:
        return formatter.format_credit_summary(data)


# ============================================
# Testing
# ============================================

if __name__ == "__main__":
    # Test with sample data
    sample_data = {
        "ticker": "ACME",
        "company_name": "ACME Corporation",
        "as_of_date": "2024-12-31",
        "aggregate_metrics": {
            "total_debt": 3500,
            "net_debt": 2800,
            "cash_and_equivalents": 700,
            "ebitda": 950,
            "leverage_ratio": 3.68,
            "interest_coverage": 5.2
        },
        "debt_instruments": [
            {
                "instrument_name": "Senior Secured Term Loan B",
                "instrument_type": "term_loan",
                "outstanding_amount": 2000,
                "rate_type": "floating",
                "reference_rate": "SOFR",
                "spread_bps": 300,
                "maturity_date": "2028-06-30"
            },
            {
                "instrument_name": "Senior Notes 6.25%",
                "instrument_type": "senior_note",
                "outstanding_amount": 1000,
                "rate_type": "fixed",
                "interest_rate": 0.0625,
                "maturity_date": "2030-03-15"
            },
            {
                "instrument_name": "Revolving Credit Facility",
                "instrument_type": "revolver",
                "outstanding_amount": 500,
                "rate_type": "floating",
                "reference_rate": "SOFR",
                "spread_bps": 225,
                "maturity_date": "2027-06-30"
            }
        ],
        "covenants": [
            {
                "covenant_name": "Maximum Total Net Leverage Ratio",
                "covenant_type": "leverage",
                "threshold_value": 5.0,
                "threshold_direction": "max",
                "current_value": 3.68,
                "in_compliance": True
            },
            {
                "covenant_name": "Minimum Interest Coverage Ratio",
                "covenant_type": "interest_coverage",
                "threshold_value": 2.5,
                "threshold_direction": "min",
                "current_value": 5.2,
                "in_compliance": True
            }
        ],
        "maturity_schedule": [
            {"fiscal_year": 2025, "amount_due": 150},
            {"fiscal_year": 2026, "amount_due": 200},
            {"fiscal_year": 2027, "amount_due": 700},
            {"fiscal_year": 2028, "amount_due": 1950},
            {"fiscal_year": 2030, "amount_due": 1000}
        ],
        "extraction_notes": "Company has adequate liquidity with undrawn revolver capacity. No near-term refinancing risk."
    }
    
    print(format_credit_summary(sample_data))
