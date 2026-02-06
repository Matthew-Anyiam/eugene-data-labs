#!/usr/bin/env python3
"""
Eugene Intelligence CLI
Financial data infrastructure for AI agents and humans.

Usage:
    eugene health AAPL
    eugene health AAPL BA TSLA
    eugene compare JPM BAC GS
    eugene financials MSFT
    eugene history AAPL revenue 5
    eugene credit AAPL
    eugene equity AAPL
"""
import sys
import os
import json
import time

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from eugene.config import Config

config = Config()

def fmt_usd(val):
    if val is None:
        return "N/A"
    if isinstance(val, str):
        return val
    if abs(val) >= 1_000_000_000:
        return "${:,.1f}B".format(val / 1_000_000_000)
    elif abs(val) >= 1_000_000:
        return "${:,.1f}M".format(val / 1_000_000)
    else:
        return "${:,.0f}".format(val)

def cmd_health(tickers):
    from eugene.agents.health import HealthMonitor
    monitor = HealthMonitor(config)

    if len(tickers) == 1:
        ticker = tickers[0].upper()
        print("Analyzing {}...".format(ticker))
        start = time.time()
        report = monitor.analyze(ticker)
        elapsed = time.time() - start

        print()
        print("  {} — {}".format(report.company_name, report.ticker))
        print("  Grade: {}".format(report.grade))
        print("  Score: {} / 100".format(report.score))
        print()
        print("  Ratios:")
        for name, info in report.ratios.items():
            val = info.get("value", "N/A")
            interp = info.get("interpretation", "")
            unit = info.get("unit", "")
            if unit == "millions_usd":
                print("    {}: ${:,.0f}M — {}".format(name, val, interp))
            else:
                print("    {}: {} — {}".format(name, val, interp))

        if report.trends:
            print()
            print("  Trends:")
            for metric, trend in report.trends.items():
                direction = trend.get("direction", "")
                cagr = trend.get("cagr_pct")
                values = trend.get("values", [])
                if values:
                    latest = values[-1]
                    arrow = "+" if direction == "up" else "-" if direction == "down" else "="
                    cagr_str = " (CAGR: {}%)".format(cagr) if cagr is not None else ""
                    vals_str = " | ".join(["FY{}: {}".format(v["fiscal_year"], fmt_usd(v["value"])) for v in values])
                    print("    {} [{}]{}: {}".format(metric, arrow, cagr_str, vals_str))

        print()
        print("  Source: SEC XBRL | Time: {:.1f}s | No LLM".format(elapsed))
    else:
        cmd_compare(tickers)

def cmd_compare(tickers):
    from eugene.agents.health import HealthMonitor
    monitor = HealthMonitor(config)

    tickers = [t.upper() for t in tickers]
    print("Comparing {}...".format(", ".join(tickers)))
    start = time.time()
    result = monitor.compare(tickers)
    elapsed = time.time() - start

    print()
    print("  RANKING")
    print("  " + "-" * 60)
    for ticker in result["ranking"]:
        r = result["comparison"][ticker]
        print("  #{} {} — {} (Score: {})".format(
            r["rank"], r.get("company_name", ticker), r["grade"], r["score"]))

    print()
    # Side-by-side metrics
    all_metrics = set()
    for t in result["ranking"]:
        all_metrics.update(result["comparison"][t].get("ratios", {}).keys())

    key_metrics = ["current_ratio", "debt_to_assets", "debt_to_equity",
                   "interest_coverage", "net_debt_to_ebitda", "roe_pct",
                   "roa_pct", "net_margin_pct", "operating_margin_pct",
                   "roic_pct", "free_cash_flow", "altman_z_score"]

    # Header
    header = "  {:<24}".format("Metric")
    for t in result["ranking"]:
        header += " {:>12}".format(t)
    print(header)
    print("  " + "-" * (24 + 13 * len(result["ranking"])))

    for m in key_metrics:
        if not any(m in result["comparison"][t].get("ratios", {}) for t in result["ranking"]):
            continue
        row = "  {:<24}".format(m)
        for t in result["ranking"]:
            val = result["comparison"][t].get("ratios", {}).get(m, {}).get("value", "")
            if isinstance(val, float):
                row += " {:>12.2f}".format(val)
            elif isinstance(val, int):
                row += " {:>12}".format(val)
            elif val == "":
                row += " {:>12}".format("-")
            else:
                row += " {:>12}".format(str(val))
        print(row)

    print()
    print("  Source: SEC XBRL | Time: {:.1f}s | No LLM".format(elapsed))

def cmd_financials(ticker):
    from eugene.sources.xbrl import XBRLClient
    xbrl = XBRLClient(config)

    ticker = ticker.upper()
    print("Fetching XBRL financials for {}...".format(ticker))
    start = time.time()
    data = xbrl.get_financials(ticker)
    elapsed = time.time() - start

    print()
    print("  {} ({})".format(data.company_name, data.ticker))
    print("  {} metrics available".format(len(data.available_keys())))
    print()

    categories = {
        "Balance Sheet": ["total_assets", "total_liabilities", "current_assets",
                         "current_liabilities", "total_equity", "retained_earnings",
                         "cash_and_equivalents"],
        "Income Statement": ["revenue", "operating_income", "net_income",
                            "interest_expense", "eps_basic", "eps_diluted"],
        "Cash Flow": ["operating_cash_flow", "capital_expenditures",
                     "depreciation_amortization"],
        "Debt": ["total_debt", "long_term_debt", "short_term_debt",
                "debt_due_year_1", "debt_due_year_2", "debt_due_year_3",
                "debt_due_year_4", "debt_due_year_5"],
    }

    for cat_name, keys in categories.items():
        has_any = any(k in data.available_keys() for k in keys)
        if not has_any:
            continue
        print("  {}:".format(cat_name))
        for k in keys:
            fact = data.get_fact(k)
            if fact:
                if fact.unit == "USD":
                    print("    {}: {} [{}]".format(k, fmt_usd(fact.value), fact.tag))
                else:
                    print("    {}: {} {} [{}]".format(k, fact.value, fact.unit, fact.tag))
        print()

    print("  Source: SEC XBRL | Time: {:.1f}s".format(elapsed))

def cmd_history(ticker, metric, years):
    from eugene.sources.xbrl import XBRLClient
    xbrl = XBRLClient(config)

    ticker = ticker.upper()
    print("{} — {} ({}y)".format(ticker, metric, years))
    start = time.time()
    history = xbrl.get_historical(ticker, metric, years=years)
    elapsed = time.time() - start

    if not history:
        print("  No data found for metric: {}".format(metric))
        return

    print()
    for h in history:
        if h.unit == "USD":
            print("  FY{}: {}".format(h.fiscal_year, fmt_usd(h.value)))
        else:
            print("  FY{}: {} {}".format(h.fiscal_year, h.value, h.unit))

    if len(history) >= 2:
        first = history[0].value
        last = history[-1].value
        if first and first > 0 and last and last > 0:
            cagr = ((last / first) ** (1.0 / (len(history) - 1)) - 1) * 100
            print()
            print("  CAGR: {:.1f}%".format(cagr))

    print("  Source: SEC XBRL | Time: {:.1f}s".format(elapsed))

def cmd_credit(ticker):
    from eugene.agents.credit import CreditMonitorAgent
    agent = CreditMonitorAgent(config)

    ticker = ticker.upper()
    print("Running credit analysis on {}... (requires LLM)".format(ticker))
    start = time.time()
    result = agent.analyze(ticker)
    elapsed = time.time() - start
    data = result.to_dict()

    print()
    print("  {} ({})".format(result.company_name, ticker))

    h = data["data"].get("financial_health", {})
    rating = h.get("health_rating")
    if rating:
        print("  Health: {} (Score: {})".format(rating.get("grade"), rating.get("score")))

    print()
    print("  Summary: {}".format(data["data"].get("summary", "N/A")[:300]))
    print()
    print("  Cited values: {} | Sources: {} | Tokens: {}".format(
        len(result.cited_values), result.source_count, result.tokens_used))
    print("  Time: {:.1f}s".format(elapsed))

    outfile = "{}_credit.json".format(ticker.lower())
    with open(outfile, "w") as f:
        json.dump(data, f, indent=2)
    print("  Saved: {}".format(outfile))

def cmd_equity(ticker):
    from eugene.agents.equity import EquityResearchAgent
    agent = EquityResearchAgent(config)

    ticker = ticker.upper()
    print("Running equity research on {}... (requires LLM)".format(ticker))
    start = time.time()
    result = agent.analyze(ticker)
    elapsed = time.time() - start
    data = result.to_dict()

    print()
    print("  {} ({})".format(result.company_name, ticker))
    print()
    print("  Summary: {}".format(data["data"].get("summary", "N/A")[:300]))

    xbrl = data["data"].get("xbrl_financials", {})
    if xbrl:
        print()
        print("  XBRL Enrichment ({} metrics):".format(len(xbrl)))
        for key, info in list(xbrl.items())[:5]:
            if info.get("unit") == "USD":
                print("    {}: {}".format(key, fmt_usd(info["value"])))

    print()
    print("  Cited values: {} | Sources: {} | Tokens: {}".format(
        len(result.cited_values), result.source_count, result.tokens_used))
    print("  Time: {:.1f}s".format(elapsed))

    outfile = "{}_equity.json".format(ticker.lower())
    with open(outfile, "w") as f:
        json.dump(data, f, indent=2)
    print("  Saved: {}".format(outfile))

def print_usage():
    print("Eugene Intelligence — Financial Data Infrastructure")
    print()
    print("Usage:")
    print("  python cli.py health AAPL          Health grade for one company")
    print("  python cli.py health AAPL BA TSLA   Health grades for multiple")
    print("  python cli.py compare JPM BAC GS    Side-by-side comparison")
    print("  python cli.py financials MSFT        Raw XBRL financial data")
    print("  python cli.py history AAPL revenue 5 5-year metric history")
    print("  python cli.py credit AAPL            Credit analysis (uses LLM)")
    print("  python cli.py equity AAPL            Equity research (uses LLM)")
    print()
    print("Metrics for history: revenue, net_income, total_assets, total_debt,")
    print("  operating_cash_flow, eps_basic, capital_expenditures, total_equity")

def main():
    if len(sys.argv) < 2:
        print_usage()
        return

    command = sys.argv[1].lower()
    args = sys.argv[2:]

    print()
    print("=" * 50)
    print(" EUGENE INTELLIGENCE")
    print("=" * 50)
    print()

    if command == "health" and args:
        cmd_health(args)
    elif command == "compare" and len(args) >= 2:
        cmd_compare(args)
    elif command == "financials" and args:
        cmd_financials(args[0])
    elif command == "history" and len(args) >= 2:
        metric = args[1]
        years = int(args[2]) if len(args) > 2 else 5
        cmd_history(args[0], metric, years)
    elif command == "credit" and args:
        cmd_credit(args[0])
    elif command == "equity" and args:
        cmd_equity(args[0])
    else:
        print_usage()

if __name__ == "__main__":
    main()
