"""
Eugene Intelligence - Web Demo
Financial data infrastructure for AI agents.
"""
import streamlit as st
import plotly.graph_objects as go
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv()

from eugene.config import Config
from eugene.agents.health import HealthMonitor

st.set_page_config(page_title="Eugene Intelligence", page_icon="📊", layout="wide")

@st.cache_resource
def get_health_monitor():
    return HealthMonitor(Config())

def fmt_usd(val):
    if val is None:
        return "N/A"
    if abs(val) >= 1e9:
        return "${:.1f}B".format(val / 1e9)
    elif abs(val) >= 1e6:
        return "${:.1f}M".format(val / 1e6)
    return "${:,.0f}".format(val)

def plot_trend(data, title, metric_name):
    if not data:
        return None
    fig = go.Figure()
    years = [d["fiscal_year"] for d in data]
    values = [d["value"] / 1e9 if d["value"] else 0 for d in data]
    fig.add_trace(go.Scatter(
        x=years, y=values, mode='lines+markers',
        line=dict(color='#0066cc', width=3),
        marker=dict(size=10)
    ))
    fig.update_layout(
        title=title,
        xaxis_title="Fiscal Year",
        yaxis_title="{} ($B)".format(metric_name),
        template="plotly_white",
        height=300
    )
    return fig

st.title("📊 Eugene Intelligence")
st.markdown("**Financial data infrastructure for AI agents.** Every number sourced to SEC filings.")

col1, col2 = st.columns([2, 1])
with col1:
    ticker_input = st.text_input("Enter ticker(s)", "AAPL", help="Single ticker or comma-separated (e.g., AAPL, MSFT, GOOGL)")
with col2:
    analyze_btn = st.button("Analyze", type="primary", use_container_width=True)

if analyze_btn or ticker_input:
    tickers = [t.strip().upper() for t in ticker_input.split(",") if t.strip()]
    
    if len(tickers) == 1:
        ticker = tickers[0]
        with st.spinner("Fetching {} data from SEC...".format(ticker)):
            try:
                monitor = get_health_monitor()
                report = monitor.analyze(ticker)
                
                st.success("Data loaded for {} ({})".format(report.company_name, ticker))
                
                st.subheader("Key Metrics")
                cols = st.columns(4)
                abs_metrics = [("_revenue", "Revenue"), ("_net_income", "Net Income"), ("_cash", "Cash"), ("_total_debt", "Total Debt")]
                for i, (key, label) in enumerate(abs_metrics):
                    m = report.metrics.get(key, {})
                    val = m.get("value")
                    with cols[i]:
                        st.metric(label, fmt_usd(val) if val else "N/A")
                
                st.subheader("Financial Ratios")
                ratio_cols = st.columns(4)
                key_ratios = [("current_ratio", "Current Ratio"), ("debt_to_assets", "Debt/Assets"), ("roe_pct", "ROE %"), ("net_margin_pct", "Net Margin %")]
                for i, (key, label) in enumerate(key_ratios):
                    m = report.metrics.get(key, {})
                    val = m.get("value")
                    with ratio_cols[i]:
                        st.metric(label, "{:.2f}".format(val) if val else "N/A")
                
                if report.trends:
                    st.subheader("5-Year Trends")
                    chart_cols = st.columns(2)
                    for i, (metric, label) in enumerate([("revenue", "Revenue"), ("net_income", "Net Income")]):
                        trend = report.trends.get(metric, {})
                        values = trend.get("values", [])
                        if values:
                            with chart_cols[i]:
                                fig = plot_trend(values, "{} Trend".format(label), label)
                                if fig:
                                    st.plotly_chart(fig, use_container_width=True)
                                cagr = trend.get("cagr_pct")
                                if cagr:
                                    st.caption("CAGR: {:.1f}%".format(cagr))
                
                st.divider()
                st.caption("Source: SEC XBRL | [GitHub](https://github.com/Matthew-Anyiam/eugene-data-labs)")
            except Exception as e:
                st.error("Error: {}".format(str(e)))
    else:
        with st.spinner("Comparing {} companies...".format(len(tickers))):
            try:
                monitor = get_health_monitor()
                result = monitor.compare(tickers)
                
                st.success("Loaded data for {} companies".format(len(tickers)))
                
                metrics_to_show = [("_revenue", "Revenue", True), ("_net_income", "Net Income", True), ("roe_pct", "ROE %", False), ("roa_pct", "ROA %", False), ("debt_to_assets", "Debt/Assets", False), ("net_margin_pct", "Net Margin %", False)]
                table_data = {"Metric": [m[1] for m in metrics_to_show]}
                for ticker in tickers:
                    company = result["companies"].get(ticker, {})
                    metrics = company.get("metrics", {})
                    col_data = []
                    for key, label, is_usd in metrics_to_show:
                        val = metrics.get(key, {}).get("value")
                        if val is None:
                            col_data.append("-")
                        elif is_usd:
                            col_data.append(fmt_usd(val))
                        else:
                            col_data.append("{:.2f}".format(val))
                    table_data[ticker] = col_data
                st.table(table_data)
                
                st.subheader("Revenue Comparison")
                revenues = []
                for ticker in tickers:
                    company = result["companies"].get(ticker, {})
                    rev = company.get("metrics", {}).get("_revenue", {}).get("value", 0)
                    revenues.append(rev / 1e9 if rev else 0)
                fig = go.Figure(data=[go.Bar(x=tickers, y=revenues, marker_color='#0066cc')])
                fig.update_layout(yaxis_title="Revenue ($B)", template="plotly_white", height=350)
                st.plotly_chart(fig, use_container_width=True)
                
                st.divider()
                st.caption("Source: SEC XBRL | [GitHub](https://github.com/Matthew-Anyiam/eugene-data-labs)")
            except Exception as e:
                st.error("Error: {}".format(str(e)))

st.sidebar.title("About")
st.sidebar.markdown("""
**Eugene Intelligence** - Financial data for AI agents.

**Features:**
- SEC XBRL data
- 12+ financial ratios
- 5-year trends
- Multi-company comparison

[GitHub](https://github.com/Matthew-Anyiam/eugene-data-labs)
""")
