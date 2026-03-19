"""Output formatters for the Eugene CLI.

Supports: json (default), table (rich), csv.
"""
import json

try:
    from rich.console import Console
    from rich.table import Table
    HAS_RICH = True
except ImportError:
    HAS_RICH = False


def format_output(data: dict, fmt: str = "json", extract: str = None) -> str:
    """Format response data for CLI output.

    Args:
        data: Eugene response envelope or raw data dict
        fmt: "json", "table", or "csv"
        extract: Which extract was requested (helps choose table format)
    """
    if fmt == "json":
        return json.dumps(data, indent=2, default=str)
    elif fmt == "table":
        return _format_table(data, extract)
    elif fmt == "csv":
        return _format_csv(data, extract)
    return json.dumps(data, indent=2, default=str)


def _unwrap(data: dict) -> tuple:
    """Unwrap envelope to get (resolved, inner_data, status)."""
    if "data" in data and "status" in data:
        return data.get("resolved", {}), data["data"], data["status"]
    return {}, data, "success"


def _format_table(data: dict, extract: str = None) -> str:
    """Format data as a rich table. Returns rendered string."""
    if not HAS_RICH:
        return json.dumps(data, indent=2, default=str)

    from io import StringIO
    buf = StringIO()
    console = Console(file=buf, force_terminal=True, width=120)

    resolved, inner, status = _unwrap(data)

    if status == "error":
        console.print(f"[red]Error:[/red] {inner.get('error', 'Unknown error')}")
        return buf.getvalue()

    # Header
    ticker = resolved.get("ticker", "")
    name = resolved.get("name", "")
    if ticker:
        console.print(f"\n[bold cyan]{ticker}[/bold cyan]  {name}\n")

    # Route to specific formatter
    if extract == "profile":
        _table_profile(console, inner)
    elif extract == "financials":
        _table_financials(console, inner)
    elif extract == "metrics":
        _table_metrics(console, inner)
    elif extract == "technicals":
        _table_technicals(console, inner)
    elif extract == "insiders":
        _table_insiders(console, inner)
    elif extract == "filings":
        _table_filings(console, inner)
    elif extract == "peers":
        _table_peers(console, inner)
    elif extract in ("ohlcv",):
        _table_ohlcv(console, inner)
    else:
        _table_generic(console, inner)

    return buf.getvalue()


def _table_profile(console, data):
    table = Table(title="Company Profile", show_header=False, padding=(0, 2))
    table.add_column("Field", style="dim")
    table.add_column("Value", style="bold")
    for key in ("ticker", "name", "cik", "sic", "sic_description",
                "state_of_incorporation", "fiscal_year_end", "exchange"):
        if key in data:
            table.add_row(key, str(data[key]))
    if "addresses" in data and isinstance(data["addresses"], dict):
        biz = data["addresses"].get("business", {})
        if isinstance(biz, dict):
            addr = f"{biz.get('street1', '')}, {biz.get('city', '')}, {biz.get('stateOrCountry', '')} {biz.get('zipCode', '')}"
            table.add_row("address", addr)
    console.print(table)


def _table_financials(console, data):
    periods = data.get("periods", [])
    if not periods:
        console.print("[yellow]No financial data available[/yellow]")
        return

    table = Table(title="Financial Statements", padding=(0, 1))
    table.add_column("Metric", style="bold")
    for p in periods[:8]:
        label = f"{p.get('fiscal_year', '')} {p.get('period_type', '')}"
        table.add_column(label, justify="right")

    # Collect all metrics
    all_metrics = {}
    for p in periods[:8]:
        for k, v in p.get("metrics", {}).items():
            if k not in all_metrics:
                all_metrics[k] = []
    for metric_name in all_metrics:
        row = [metric_name]
        for p in periods[:8]:
            val = p.get("metrics", {}).get(metric_name, {})
            if isinstance(val, dict):
                v = val.get("value")
            else:
                v = val
            row.append(_fmt_num(v))
        table.add_row(*row)
    console.print(table)


def _table_metrics(console, data):
    categories = data.get("categories", data.get("ratios", {}))
    if isinstance(categories, dict):
        for cat_name, ratios in categories.items():
            table = Table(title=cat_name.replace("_", " ").title(), padding=(0, 1))
            table.add_column("Ratio", style="bold")
            table.add_column("Value", justify="right")
            if isinstance(ratios, dict):
                for k, v in ratios.items():
                    val = v.get("value", v) if isinstance(v, dict) else v
                    table.add_row(k, _fmt_num(val))
            elif isinstance(ratios, list):
                for item in ratios[:20]:
                    if isinstance(item, dict):
                        table.add_row(item.get("name", ""), _fmt_num(item.get("value")))
            console.print(table)
            console.print()
    elif isinstance(data, dict) and "error" not in data:
        _table_generic(console, data)


def _table_technicals(console, data):
    indicators = data if isinstance(data, dict) else {}
    table = Table(title="Technical Indicators", padding=(0, 1))
    table.add_column("Indicator", style="bold")
    table.add_column("Value", justify="right")

    for key in ("sma_20", "sma_50", "sma_200", "ema_12", "ema_26",
                "rsi_14", "macd", "macd_signal", "macd_histogram",
                "bollinger_upper", "bollinger_middle", "bollinger_lower",
                "atr_14", "vwap"):
        if key in indicators:
            val = indicators[key]
            if isinstance(val, list) and val:
                val = val[-1] if isinstance(val[-1], (int, float)) else val[-1].get("value", val[-1])
            table.add_row(key, _fmt_num(val))
    console.print(table)


def _table_insiders(console, data):
    filings = data.get("filings", data.get("trades", []))
    if isinstance(filings, list):
        table = Table(title="Insider Transactions", padding=(0, 1))
        table.add_column("Date", style="dim")
        table.add_column("Name")
        table.add_column("Title", style="dim")
        table.add_column("Type")
        table.add_column("Shares", justify="right")
        for f in filings[:15]:
            if isinstance(f, dict):
                table.add_row(
                    str(f.get("date", f.get("filing_date", "")))[:10],
                    str(f.get("name", f.get("owner", "")))[:25],
                    str(f.get("title", f.get("relationship", "")))[:20],
                    str(f.get("transaction_type", f.get("type", ""))),
                    _fmt_num(f.get("shares", f.get("total_shares"))),
                )
        console.print(table)
    else:
        _table_generic(console, data)


def _table_filings(console, data):
    filings = data.get("filings", data.get("recent", []))
    if isinstance(filings, list):
        table = Table(title="SEC Filings", padding=(0, 1))
        table.add_column("Date", style="dim")
        table.add_column("Form", style="bold")
        table.add_column("Description")
        table.add_column("Accession", style="dim")
        for f in filings[:20]:
            if isinstance(f, dict):
                table.add_row(
                    str(f.get("filingDate", f.get("date", "")))[:10],
                    str(f.get("form", "")),
                    str(f.get("primaryDocDescription", f.get("description", "")))[:50],
                    str(f.get("accessionNumber", f.get("accession", "")))[:20],
                )
        console.print(table)
    else:
        _table_generic(console, data)


def _table_peers(console, data):
    peers = data.get("peers", [])
    if isinstance(peers, list) and peers:
        table = Table(title="Peer Comparison", padding=(0, 1))
        table.add_column("Ticker", style="bold")
        table.add_column("Name")
        table.add_column("Mkt Cap", justify="right")
        table.add_column("P/E", justify="right")
        table.add_column("ROE", justify="right")
        for p in peers[:15]:
            if isinstance(p, dict):
                table.add_row(
                    str(p.get("ticker", "")),
                    str(p.get("name", ""))[:30],
                    _fmt_num(p.get("market_cap")),
                    _fmt_num(p.get("pe_ratio", p.get("pe"))),
                    _fmt_num(p.get("roe")),
                )
        console.print(table)
    else:
        _table_generic(console, data)


def _table_ohlcv(console, data):
    bars = data.get("bars", data.get("historical", []))
    if isinstance(bars, list) and bars:
        table = Table(title="OHLCV", padding=(0, 1))
        table.add_column("Date", style="dim")
        table.add_column("Open", justify="right")
        table.add_column("High", justify="right")
        table.add_column("Low", justify="right")
        table.add_column("Close", justify="right", style="bold")
        table.add_column("Volume", justify="right", style="dim")
        for b in bars[:30]:
            if isinstance(b, dict):
                table.add_row(
                    str(b.get("date", ""))[:10],
                    _fmt_num(b.get("open", b.get("o"))),
                    _fmt_num(b.get("high", b.get("h"))),
                    _fmt_num(b.get("low", b.get("l"))),
                    _fmt_num(b.get("close", b.get("c"))),
                    _fmt_num(b.get("volume", b.get("v"))),
                )
        console.print(table)
    else:
        _table_generic(console, data)


def _table_generic(console, data):
    """Fallback: render any dict/list as a table."""
    if isinstance(data, list):
        if not data:
            console.print("[yellow]No data[/yellow]")
            return
        if isinstance(data[0], dict):
            keys = list(data[0].keys())[:8]
            table = Table(padding=(0, 1))
            for k in keys:
                table.add_column(k)
            for row in data[:30]:
                table.add_row(*[str(row.get(k, ""))[:40] for k in keys])
            console.print(table)
            return
    if isinstance(data, dict):
        table = Table(show_header=False, padding=(0, 2))
        table.add_column("Key", style="dim")
        table.add_column("Value")
        for k, v in data.items():
            if isinstance(v, (dict, list)):
                table.add_row(k, json.dumps(v, default=str)[:80] + ("..." if len(json.dumps(v, default=str)) > 80 else ""))
            else:
                table.add_row(k, str(v))
        console.print(table)


def _fmt_num(v) -> str:
    """Format a number for display."""
    if v is None:
        return "—"
    if isinstance(v, str):
        return v
    if isinstance(v, bool):
        return str(v)
    if isinstance(v, float):
        if abs(v) >= 1_000_000_000:
            return f"{v / 1_000_000_000:.1f}B"
        if abs(v) >= 1_000_000:
            return f"{v / 1_000_000:.1f}M"
        if abs(v) >= 1_000:
            return f"{v:,.0f}"
        if abs(v) < 0.01 and v != 0:
            return f"{v:.4f}"
        return f"{v:.2f}"
    if isinstance(v, int):
        if abs(v) >= 1_000_000_000:
            return f"{v / 1_000_000_000:.1f}B"
        if abs(v) >= 1_000_000:
            return f"{v / 1_000_000:.1f}M"
        return f"{v:,}"
    return str(v)


def _format_csv(data: dict, extract: str = None) -> str:
    """Simple CSV from list-of-dict data."""
    _, inner, _ = _unwrap(data)
    rows = None
    if isinstance(inner, list):
        rows = inner
    elif isinstance(inner, dict):
        for key in ("periods", "filings", "bars", "historical", "peers", "trades"):
            if key in inner and isinstance(inner[key], list):
                rows = inner[key]
                break
    if not rows or not isinstance(rows[0], dict):
        return json.dumps(data, indent=2, default=str)

    import csv
    from io import StringIO
    buf = StringIO()
    keys = list(rows[0].keys())
    writer = csv.DictWriter(buf, fieldnames=keys)
    writer.writeheader()
    for row in rows:
        flat = {}
        for k in keys:
            v = row.get(k)
            if isinstance(v, (dict, list)):
                flat[k] = json.dumps(v, default=str)
            else:
                flat[k] = v
        writer.writerow(flat)
    return buf.getvalue()
