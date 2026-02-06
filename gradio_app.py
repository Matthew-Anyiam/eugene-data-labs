"""
Eugene Intelligence — Gradio Web App
"""

import gradio as gr
from eugene.config import Config
from eugene.agents.health import HealthMonitor
from eugene.agents.earnings import EarningsAgent
from eugene.agents.equity_research import EquityResearchAgent
from eugene.sources.yahoo import get_stock_prices, get_earnings_data
from eugene.sources.insider import get_insider_transactions

config = Config()
health = HealthMonitor(config)
earnings_agent = EarningsAgent(config)
equity_agent = EquityResearchAgent(config)

def analyze_fundamentals(tickers_input):
    if not tickers_input.strip(): return "Enter a ticker"
    tickers = [t.strip().upper() for t in tickers_input.split(",")]
    if len(tickers) == 1:
        report = health.analyze(tickers[0])
        return f"## {report.company_name} ({report.ticker})\n\n" + "\n".join([f"**{k}:** {v}" for k, v in report.to_dict().get("metrics", {}).items()])
    return str(health.compare(tickers[:5]))

def analyze_prices(ticker, period="1y"):
    if not ticker.strip(): return "Enter a ticker"
    data = get_stock_prices(ticker.strip().upper(), period, "1d")
    if "error" in data: return f"❌ {data['error']}"
    quote, stats = data.get("current_quote", {}), data.get("summary_stats", {})
    output = f"## {data.get('company_name', ticker)} ({data['ticker']})\n"
    output += f"**Price:** ${quote.get('price', 'N/A')} | **P/E:** {quote.get('pe_ratio', 'N/A')} | **Beta:** {quote.get('beta', 'N/A')}\n\n"
    output += f"**Return:** {stats.get('total_return_pct', 'N/A')}% | **52W:** ${stats.get('52_week_low', 'N/A')} - ${stats.get('52_week_high', 'N/A')}\n"
    return output

def analyze_earnings(ticker):
    if not ticker.strip(): return "Enter a ticker"
    data = get_earnings_data(ticker.strip().upper())
    if "error" in data: return f"❌ {data['error']}"
    track = data.get("track_record", {})
    output = f"## {data.get('company_name', ticker)} — Earnings\n\n"
    output += f"**Beat Rate:** {track.get('beat_rate_pct', 'N/A')}% | **Next:** {data.get('next_earnings', {}).get('date', 'TBD')}\n"
    return output

def analyze_insider(ticker, days=365):
    if not ticker.strip(): return "Enter a ticker"
    data = get_insider_transactions(ticker.strip().upper(), int(days))
    if "error" in data: return f"❌ {data['error']}"
    s = data.get("summary", {})
    signal = s.get("signal", "neutral")
    emoji = "🟢" if signal == "net_buying" else "🔴" if signal == "net_selling" else "⚪"
    output = f"## {data.get('company_name', ticker)} — Insider Activity\n\n"
    output += f"### Signal: {emoji} {signal.upper()}\n\n"
    output += f"**Buys:** {s.get('total_buys', 0)} (${s.get('total_buy_value', 0):,.0f}) | **Sells:** {s.get('total_sells', 0)} (${s.get('total_sell_value', 0):,.0f})\n"
    return output

def analyze_earnings_calendar(tickers_input):
    if not tickers_input.strip(): return "Enter tickers"
    tickers = [t.strip().upper() for t in tickers_input.split(",")]
    data = earnings_agent.get_earnings_calendar(tickers)
    output = f"## Earnings Calendar\n\n| Ticker | Date | Days | Beat Rate |\n|--------|------|------|----------|\n"
    for e in data.get("calendar", []):
        output += f"| {e['ticker']} | {e['earnings_date']} | {e['days_until']} | {e.get('beat_rate_pct', 'N/A')}% |\n"
    return output

def analyze_post_earnings(ticker):
    if not ticker.strip(): return "Enter a ticker"
    data = earnings_agent.analyze_post_earnings_moves(ticker.strip().upper(), 8)
    if "error" in data: return f"❌ {data['error']}"
    s = data.get("summary", {})
    output = f"## {data.get('company_name', ticker)} — Post-Earnings Moves\n\n"
    output += f"**Avg on Beat:** {s.get('avg_move_on_beat_pct', 'N/A')}% | **Avg on Miss:** {s.get('avg_move_on_miss_pct', 'N/A')}%\n\n"
    output += "| Date | Result | 1D Move | 5D Move |\n|------|--------|---------|--------|\n"
    for h in data.get("history", [])[:6]:
        emoji = "✅" if h["result"] == "beat" else "❌" if h["result"] == "miss" else "➖"
        output += f"| {h['date']} | {emoji} | {h.get('move_1d_pct', 'N/A')}% | {h.get('move_5d_pct', 'N/A')}% |\n"
    return output

def generate_equity_report(ticker, peers_input=""):
    if not ticker.strip(): return "Enter a ticker"
    peers = [p.strip().upper() for p in peers_input.split(",") if p.strip()] if peers_input else []
    report = equity_agent.generate_report(ticker.strip().upper(), peers)
    
    o = report.get("overview", {})
    fh = report.get("financial_health", {})
    prof = fh.get("profitability", {})
    lev = fh.get("leverage", {})
    perf = report.get("price_performance", {})
    val = report.get("valuation", {})
    earn = report.get("earnings", {})
    ins = report.get("insider_activity", {})
    risk = report.get("risks", {})
    thesis = report.get("thesis", {})
    
    output = f"# {o.get('company_name', ticker)} ({report['ticker']}) — Equity Research\n\n"
    output += f"*Generated: {report['generated_at']}*\n\n"
    
    # Overview
    mcap = o.get('market_cap')
    mcap_str = f"${mcap/1e9:.1f}B" if mcap and mcap > 1e9 else f"${mcap/1e6:.0f}M" if mcap else "N/A"
    output += f"**Market Cap:** {mcap_str} | **Price:** ${o.get('current_price', 'N/A')}\n\n"
    
    # Financial Health
    output += "## Financial Health\n"
    output += f"| Metric | Value |\n|--------|-------|\n"
    output += f"| ROE | {prof.get('roe_pct', 'N/A')}% |\n"
    output += f"| ROA | {prof.get('roa_pct', 'N/A')}% |\n"
    output += f"| Net Margin | {prof.get('net_margin_pct', 'N/A')}% |\n"
    output += f"| Debt/Equity | {lev.get('debt_to_equity', 'N/A')}x |\n\n"
    
    # Price Performance
    output += "## Price Performance\n"
    output += f"| 1M | 3M | 6M | 1Y | 5Y |\n|----|----|----|----|----|\n"
    output += f"| {perf.get('return_1M', 'N/A')}% | {perf.get('return_3M', 'N/A')}% | {perf.get('return_6M', 'N/A')}% | {perf.get('return_1Y', 'N/A')}% | {perf.get('return_5Y', 'N/A')}% |\n\n"
    output += f"**52W Range:** ${perf.get('52_week_low', 'N/A')} - ${perf.get('52_week_high', 'N/A')} | **Beta:** {perf.get('beta', 'N/A')}\n\n"
    
    # Valuation
    output += "## Valuation\n"
    output += f"**P/E:** {val.get('pe_ratio', 'N/A')}x | **Fwd P/E:** {val.get('forward_pe', 'N/A')}x | **P/S:** {val.get('ps_ratio', 'N/A')}x | **Div Yield:** {val.get('dividend_yield_pct', 'N/A')}%\n\n"
    
    # Earnings
    output += "## Earnings Quality\n"
    output += f"**Beat Rate:** {earn.get('beat_rate_pct', 'N/A')}% | **Next Earnings:** {earn.get('next_earnings', 'TBD')}\n"
    output += f"**EPS Growth:** {earn.get('earnings_growth_pct', 'N/A')}% | **Rev Growth:** {earn.get('revenue_growth_pct', 'N/A')}%\n\n"
    
    # Insider
    signal = ins.get('signal', 'neutral')
    emoji = "🟢" if signal == "net_buying" else "🔴" if signal == "net_selling" else "⚪"
    output += f"## Insider Activity: {emoji} {signal.upper()}\n"
    output += f"**Net Value:** ${ins.get('net_value', 0):,.0f} ({ins.get('total_buys', 0)} buys, {ins.get('total_sells', 0)} sells)\n\n"
    
    # Risk
    output += f"## Risk Assessment: {risk.get('risk_level', 'N/A')} (Score: {risk.get('risk_score', 0)})\n"
    for r in risk.get("identified_risks", []):
        output += f"- ⚠️ **{r['type']}:** {r['detail']}\n"
    output += "\n"
    
    # Thesis
    output += "## Investment Thesis\n"
    output += "### Bull Case 🐂\n"
    for b in thesis.get("bull_case", []):
        output += f"- {b}\n"
    output += "\n### Bear Case 🐻\n"
    for b in thesis.get("bear_case", []):
        output += f"- {b}\n"
    output += f"\n### Summary\n{thesis.get('summary', '')}\n"
    
    # Peer comparison
    if "peer_comparison" in report:
        pc = report["peer_comparison"]
        output += "\n## Peer Comparison\n"
        output += "| Ticker | Mkt Cap | P/E | 1Y Ret | ROE | Margin |\n"
        output += "|--------|---------|-----|--------|-----|--------|\n"
        for t, m in pc.get("metrics", {}).items():
            if "error" in m: continue
            mc = m.get('market_cap')
            mc_str = f"${mc/1e9:.0f}B" if mc and mc > 1e9 else "N/A"
            output += f"| {t} | {mc_str} | {m.get('pe_ratio', 'N/A')}x | {m.get('return_1y_pct', 'N/A')}% | {m.get('roe_pct', 'N/A')}% | {m.get('net_margin_pct', 'N/A')}% |\n"
    
    return output

with gr.Blocks(title="Eugene Intelligence") as demo:
    gr.Markdown("# 🏛️ Eugene Intelligence\n**Financial data infrastructure for AI agents.**")
    
    with gr.Tabs():
        with gr.TabItem("🔬 Equity Research"):
            gr.Markdown("Comprehensive equity research report with financials, valuation, earnings, insider activity, risk assessment, and investment thesis.")
            with gr.Row():
                er_ticker = gr.Textbox(label="Ticker", placeholder="NVDA")
                er_peers = gr.Textbox(label="Peers (optional)", placeholder="AMD, INTC")
            er_btn = gr.Button("Generate Report", variant="primary")
            er_output = gr.Markdown()
            er_btn.click(generate_equity_report, inputs=[er_ticker, er_peers], outputs=er_output)
        
        with gr.TabItem("📊 Fundamentals"):
            f_input = gr.Textbox(label="Ticker(s)", placeholder="AAPL or JPM, BAC, GS")
            f_btn = gr.Button("Analyze", variant="primary")
            f_output = gr.Markdown()
            f_btn.click(analyze_fundamentals, inputs=f_input, outputs=f_output)
        
        with gr.TabItem("📈 Stock Prices"):
            with gr.Row():
                p_ticker = gr.Textbox(label="Ticker", placeholder="AAPL")
                p_period = gr.Dropdown(choices=["1mo", "3mo", "6mo", "1y", "2y", "5y", "max"], value="1y", label="Period")
            p_btn = gr.Button("Get Prices", variant="primary")
            p_output = gr.Markdown()
            p_btn.click(analyze_prices, inputs=[p_ticker, p_period], outputs=p_output)
        
        with gr.TabItem("💰 Earnings"):
            e_input = gr.Textbox(label="Ticker", placeholder="NVDA")
            e_btn = gr.Button("Get Earnings", variant="primary")
            e_output = gr.Markdown()
            e_btn.click(analyze_earnings, inputs=e_input, outputs=e_output)
        
        with gr.TabItem("📅 Earnings Calendar"):
            cal_input = gr.Textbox(label="Tickers", placeholder="AAPL, NVDA, TSLA, META, GOOGL")
            cal_btn = gr.Button("Get Calendar", variant="primary")
            cal_output = gr.Markdown()
            cal_btn.click(analyze_earnings_calendar, inputs=cal_input, outputs=cal_output)
        
        with gr.TabItem("📉 Post-Earnings Moves"):
            pe_input = gr.Textbox(label="Ticker", placeholder="NVDA")
            pe_btn = gr.Button("Analyze", variant="primary")
            pe_output = gr.Markdown()
            pe_btn.click(analyze_post_earnings, inputs=pe_input, outputs=pe_output)
        
        with gr.TabItem("🕵️ Insider Trades"):
            with gr.Row():
                i_ticker = gr.Textbox(label="Ticker", placeholder="TSLA")
                i_days = gr.Slider(minimum=30, maximum=730, value=365, label="Days Back")
            i_btn = gr.Button("Get Activity", variant="primary")
            i_output = gr.Markdown()
            i_btn.click(analyze_insider, inputs=[i_ticker, i_days], outputs=i_output)
    
    gr.Markdown("---\n[GitHub](https://github.com/Matthew-Anyiam/eugene-data-labs) · matthew@eugeneintelligence.com")

demo.launch()
