"""Eugene Intelligence CLI."""
import os
import json

import click
from dotenv import load_dotenv

load_dotenv()

from eugene.router import VERSION  # noqa: E402
from eugene.formatter import format_output  # noqa: E402


def _api_headers():
    """Build headers with API key if set."""
    key = os.environ.get("EUGENE_API_KEY", "")
    if key:
        return {"X-API-Key": key}
    return {}


def _output(data, fmt="json", extract=None):
    """Output data in the requested format."""
    if fmt == "json":
        click.echo(json.dumps(data, indent=2, default=str))
    else:
        click.echo(format_output(data, fmt=fmt, extract=extract))


@click.group()
@click.version_option(version=VERSION, prog_name="eugene")
def main():
    """Eugene Intelligence — financial data for AI agents."""
    pass


@main.command()
def caps():
    """List all available tools, extracts, and capabilities."""
    from eugene.router import capabilities
    _output(capabilities(), fmt="table")


@main.command()
def info():
    """Show Eugene version, extract types, and configuration status."""
    from eugene.router import VERSION, VALID_EXTRACTS
    has_fmp = bool(os.environ.get("FMP_API_KEY"))
    has_fred = bool(os.environ.get("FRED_API_KEY"))
    has_sec = bool(os.environ.get("SEC_USER_AGENT"))
    has_auth = bool(os.environ.get("EUGENE_API_KEYS"))

    click.echo(f"Eugene Intelligence v{VERSION}")
    click.echo(f"  Extracts: {len(VALID_EXTRACTS)} ({', '.join(VALID_EXTRACTS)})")
    click.echo()
    click.echo("API Keys:")
    click.echo(f"  SEC_USER_AGENT:  {'configured' if has_sec else 'missing (required for SEC)'}")
    click.echo(f"  FMP_API_KEY:     {'configured' if has_fmp else 'missing (prices, screener, crypto disabled)'}")
    click.echo(f"  FRED_API_KEY:    {'configured' if has_fred else 'missing (economics disabled)'}")
    key_count = len([k for k in os.environ.get('EUGENE_API_KEYS', '').split(',') if k.strip()])
    click.echo(f"  EUGENE_API_KEYS: {f'set ({key_count} keys)' if has_auth else 'not set (open mode)'}")


@main.command()
def status():
    """Quick health check — test connectivity to all data sources."""
    from eugene.router import VERSION
    click.echo(f"Eugene Intelligence v{VERSION}\n")

    # SEC
    click.echo("SEC EDGAR ... ", nl=False)
    try:
        from eugene.sources.sec_api import fetch_submissions
        data = fetch_submissions("0000320193")
        click.echo(f"ok ({data.get('name', 'Apple Inc.')})")
    except Exception as e:
        click.echo(f"FAIL ({e})")

    # FMP
    click.echo("FMP (quote) ... ", nl=False)
    try:
        from eugene.sources.fmp import get_price
        p = get_price("AAPL")
        if "error" in p:
            click.echo(f"error ({p['error']})")
        else:
            click.echo(f"ok (AAPL ${p.get('price', '?')})")
    except Exception as e:
        click.echo(f"FAIL ({e})")

    # FRED
    click.echo("FRED ........ ", nl=False)
    try:
        from eugene.sources.fred import get_category
        data = get_category("rates")
        if "error" in data:
            click.echo(f"error ({data['error']})")
        else:
            click.echo(f"ok ({len(data.get('data', []))} series)")
    except Exception as e:
        click.echo(f"FAIL ({e})")


@main.command()
@click.argument("identifier")
@click.option("-e", "--extract", default="financials",
              help="Extract type(s): profile,filings,financials,concepts,insiders,ownership,"
                   "events,sections,exhibits,metrics,ohlcv,technicals,segments,float,corporate_actions")
@click.option("-p", "--period", default="FY", help="FY or Q")
@click.option("-c", "--concept", default=None, help="Concept name or XBRL tag")
@click.option("-f", "--form", default=None, help="10-K, 10-Q, 8-K, 4, 13F-HR")
@click.option("-s", "--section", default=None, help="mdna, risk_factors, business, legal")
@click.option("-i", "--interval", default=None, help="daily, 1hour, 5min (for ohlcv)")
@click.option("--from", "date_from", default=None, help="Start date YYYY-MM-DD")
@click.option("--to", "date_to", default=None, help="End date YYYY-MM-DD")
@click.option("-l", "--limit", default=10, type=int, help="Max results")
@click.option("-o", "--output", "fmt", default="table", type=click.Choice(["json", "table", "csv"]),
              help="Output format (default: table)")
def sec(identifier, extract, period, concept, form, section, interval, date_from, date_to, limit, fmt):
    """Query SEC EDGAR data. Example: eugene sec AAPL -e profile"""
    from eugene.router import query
    params = {
        "period": period, "concept": concept, "form": form,
        "section": section, "interval": interval,
        "from": date_from, "to": date_to, "limit": limit,
    }
    result = query(identifier, extract, **{k: v for k, v in params.items() if v is not None})
    _output(result, fmt=fmt, extract=extract.split(",")[0])


@main.command()
@click.option("-c", "--category", default="all",
              help="inflation, employment, gdp, housing, consumer, manufacturing, rates, money, treasury, all")
@click.option("-s", "--series", default=None, help="Specific FRED series ID (e.g. CPIAUCSL)")
@click.option("-o", "--output", "fmt", default="table", type=click.Choice(["json", "table", "csv"]),
              help="Output format (default: table)")
def econ(category, series, fmt):
    """Query FRED economic data. Example: eugene econ -c inflation"""
    from eugene.sources.fred import get_category, get_series, get_all
    if series:
        _output(get_series(series), fmt=fmt)
    elif category == "all":
        _output(get_all(), fmt=fmt)
    else:
        _output(get_category(category), fmt=fmt)


@main.command()
@click.argument("ticker")
@click.option("-o", "--output", "fmt", default="table", type=click.Choice(["json", "table", "csv"]),
              help="Output format (default: table)")
def prices(ticker, fmt):
    """Live quote from FMP. Example: eugene prices AAPL"""
    from eugene.sources.fmp import get_price
    _output(get_price(ticker), fmt=fmt)


@main.command()
@click.argument("ticker")
@click.option("-i", "--interval", default="daily",
              help="1min, 5min, 15min, 30min, 1hour, 4hour, daily")
@click.option("--from", "date_from", default=None, help="Start date YYYY-MM-DD")
@click.option("--to", "date_to", default=None, help="End date YYYY-MM-DD")
@click.option("-o", "--output", "fmt", default="table", type=click.Choice(["json", "table", "csv"]),
              help="Output format (default: table)")
def ohlcv(ticker, interval, date_from, date_to, fmt):
    """Historical OHLCV bars. Example: eugene ohlcv AAPL -i daily"""
    from eugene.sources.fmp import get_historical_bars
    _output(get_historical_bars(ticker, interval, date_from, date_to), fmt=fmt, extract="ohlcv")


@main.command()
@click.option("--sector", default=None, help="Technology, Healthcare, Financial Services, etc.")
@click.option("--country", default=None, help="US, GB, DE, JP, CN, etc.")
@click.option("--market-cap-min", type=int, default=None, help="Min market cap")
@click.option("--market-cap-max", type=int, default=None, help="Max market cap")
@click.option("--price-min", type=float, default=None, help="Min price")
@click.option("--price-max", type=float, default=None, help="Max price")
@click.option("--volume-min", type=int, default=None, help="Min volume")
@click.option("-l", "--limit", default=50, type=int, help="Max results")
@click.option("-o", "--output", "fmt", default="table", type=click.Choice(["json", "table", "csv"]),
              help="Output format (default: table)")
def screener(sector, country, market_cap_min, market_cap_max,
             price_min, price_max, volume_min, limit, fmt):
    """Screen stocks. Example: eugene screener --sector Technology --market-cap-min 1000000000"""
    from eugene.sources.fmp import get_screener
    _output(get_screener(
        sector=sector, country=country,
        market_cap_min=market_cap_min, market_cap_max=market_cap_max,
        price_min=price_min, price_max=price_max,
        volume_min=volume_min, limit=limit,
    ), fmt=fmt)


@main.command()
@click.argument("symbol")
@click.option("-t", "--type", "data_type", default="quote",
              help="quote, daily, 1hour, 5min")
@click.option("-o", "--output", "fmt", default="table", type=click.Choice(["json", "table", "csv"]),
              help="Output format (default: table)")
def crypto(symbol, data_type, fmt):
    """Crypto data. Example: eugene crypto BTCUSD"""
    from eugene.sources.fmp import get_crypto_quote, get_historical_bars
    if data_type == "quote":
        _output(get_crypto_quote(symbol), fmt=fmt)
    else:
        _output(get_historical_bars(symbol, interval=data_type), fmt=fmt)


@main.command(name="export")
@click.argument("identifier")
@click.option("-e", "--extract", default="financials", help="Extract type")
@click.option("-f", "--format", "fmt", default="json", help="json or csv")
@click.option("-o", "--output", default=None, help="Output file path")
@click.option("-l", "--limit", default=10, type=int, help="Max periods")
@click.option("-p", "--period", default="FY", help="FY or Q")
def export_cmd(identifier, extract, fmt, output, limit, period):
    """Export data to CSV/JSON. Example: eugene export AAPL -f csv -o aapl.csv"""
    if fmt == "csv":
        from eugene.handlers.export import export_financials_csv
        data = export_financials_csv(identifier, extract, limit=limit, period=period)
    else:
        from eugene.router import query
        data = json.dumps(query(identifier, extract, limit=limit, period=period), indent=2, default=str)
    if output:
        with open(output, "w") as f:
            f.write(data)
        click.echo(f"Written to {output}")
    else:
        click.echo(data)


if __name__ == "__main__":
    main()
