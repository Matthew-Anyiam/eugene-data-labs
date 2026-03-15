"""Eugene Intelligence CLI."""
import os
import json
import sys

import click
from dotenv import load_dotenv

load_dotenv()


def _api_headers():
    """Build headers with API key if set."""
    key = os.environ.get("EUGENE_API_KEY", "")
    if key:
        return {"X-API-Key": key}
    return {}


def _print_json(data):
    click.echo(json.dumps(data, indent=2, default=str))


@click.group()
@click.version_option(version="0.5.0", prog_name="eugene")
def main():
    """Eugene Intelligence — financial data for AI agents."""
    pass


@main.command()
def caps():
    """List all available tools, extracts, and capabilities."""
    from eugene.router import capabilities
    _print_json(capabilities())


@main.command()
@click.argument("identifier")
@click.option("-e", "--extract", default="financials",
              help="Extract type(s): profile,filings,financials,concepts,insiders,ownership,events,sections,exhibits")
@click.option("-p", "--period", default="FY", help="FY or Q")
@click.option("-c", "--concept", default=None, help="Concept name or XBRL tag")
@click.option("-f", "--form", default=None, help="10-K, 10-Q, 8-K, 4, 13F-HR")
@click.option("-s", "--section", default=None, help="mdna, risk_factors, business, legal")
@click.option("--from", "date_from", default=None, help="Start date YYYY-MM-DD")
@click.option("--to", "date_to", default=None, help="End date YYYY-MM-DD")
@click.option("-l", "--limit", default=10, type=int, help="Max results")
def sec(identifier, extract, period, concept, form, section, date_from, date_to, limit):
    """Query SEC EDGAR data. Example: eugene sec AAPL -e profile"""
    from eugene.router import query
    params = {
        "period": period, "concept": concept, "form": form,
        "section": section, "from": date_from, "to": date_to,
        "limit": limit,
    }
    result = query(identifier, extract, **{k: v for k, v in params.items() if v is not None})
    _print_json(result)


@main.command()
@click.option("-c", "--category", default="all",
              help="inflation, employment, gdp, housing, consumer, manufacturing, rates, money, treasury, all")
@click.option("-s", "--series", default=None, help="Specific FRED series ID (e.g. CPIAUCSL)")
def econ(category, series):
    """Query FRED economic data. Example: eugene econ -c inflation"""
    from eugene.sources.fred import get_category, get_series, get_all
    if series:
        _print_json(get_series(series))
    elif category == "all":
        _print_json(get_all())
    else:
        _print_json(get_category(category))


@main.command()
@click.argument("ticker")
def prices(ticker):
    """Live quote from FMP. Example: eugene prices AAPL"""
    from eugene.sources.fmp import get_price
    _print_json(get_price(ticker))


if __name__ == "__main__":
    main()
