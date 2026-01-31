#!/usr/bin/env python3
"""
Eugene Data Labs - CLI

Unified command-line interface for all Eugene operations.

Usage:
    python eugene_cli.py extract --ticker TSLA
    python eugene_cli.py batch --tickers TSLA AAPL MSFT
    python eugene_cli.py monitor --tickers TSLA AAPL
    python eugene_cli.py health
    python eugene_cli.py api
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent))


def cmd_extract(args):
    """Run single extraction"""
    from extraction.safe_extract import run_safe_extraction
    from extraction.formatter import format_credit_summary
    
    print(f"Extracting {args.filing_type} for {args.ticker}...")
    print()
    
    result = run_safe_extraction(args.ticker, args.filing_type)
    
    if result.success:
        print("✓ Extraction successful\n")
        
        if args.format == "markdown":
            # Format as markdown
            extraction_data = result.data.get("extraction", {})
            extraction_data["ticker"] = args.ticker
            print(format_credit_summary(extraction_data))
        else:
            # JSON output
            import json
            print(json.dumps(result.data, indent=2, default=str))
        
        if result.warnings:
            print(f"\nWarnings: {result.warnings}")
    else:
        print("✗ Extraction failed\n")
        print(f"Stage: {result.error.stage}")
        print(f"Error: {result.error.message}")
        
        if result.partial_data:
            print(f"\nPartial data saved for stages: {list(result.partial_data.keys())}")
        
        sys.exit(1)


def cmd_batch(args):
    """Run batch extraction"""
    from jobs.resilient_runner import ResilientRunner, RetryPolicy, RateLimiter
    
    runner = ResilientRunner(
        retry_policy=RetryPolicy(max_retries=args.retries),
        rate_limiter=RateLimiter(requests_per_minute=args.rate_limit)
    )
    
    result = asyncio.run(runner.run_extraction_job(
        tickers=args.tickers,
        filing_type=args.filing_type,
        resume=not args.no_resume
    ))
    
    print("\n" + "=" * 60)
    print("JOB COMPLETE")
    print("=" * 60)
    print(f"Status: {result['status']}")
    print(f"Completed: {result['completed']}")
    print(f"Failed: {result['failed']}")
    
    if result.get('failed_tickers'):
        print(f"Failed: {', '.join(result['failed_tickers'])}")


def cmd_monitor(args):
    """Run real-time SEC monitor"""
    from realtime.sec_monitor import SECFilingMonitor
    
    async def run_monitor():
        monitor = SECFilingMonitor(poll_interval=args.interval)
        
        def on_filing(filing):
            print(f"\n{'='*60}")
            print(f"NEW FILING: {filing.filing_type}")
            print(f"Company: {filing.company_name}")
            print(f"Ticker: {filing.ticker or 'N/A'}")
            print(f"URL: {filing.filing_url}")
            print(f"{'='*60}")
        
        monitor.subscribe(
            subscriber_id="cli",
            tickers=args.tickers,
            filing_types=args.types,
            callback=on_filing
        )
        
        print(f"Monitoring SEC EDGAR (polling every {args.interval}s)...")
        print(f"Tickers: {args.tickers or 'ALL'}")
        print(f"Types: {args.types or 'ALL'}")
        print("Press Ctrl+C to stop\n")
        
        await monitor.start()
    
    try:
        asyncio.run(run_monitor())
    except KeyboardInterrupt:
        print("\nStopped")


def cmd_health(args):
    """Run health checks"""
    from monitoring.health import get_health_checker, get_metrics_collector
    
    async def run_health():
        checker = get_health_checker()
        health = await checker.check_all()
        
        print("=" * 60)
        print(f"SYSTEM HEALTH: {'✓ HEALTHY' if health.healthy else '✗ UNHEALTHY'}")
        print("=" * 60)
        print()
        
        for component in health.components:
            status = "✓" if component.healthy else "✗"
            latency = f" ({component.latency_ms:.0f}ms)" if component.latency_ms else ""
            print(f"{status} {component.name}: {component.message}{latency}")
        
        if args.metrics:
            print()
            metrics = get_metrics_collector()
            summary = metrics.get_summary()
            
            print("=" * 60)
            print("METRICS")
            print("=" * 60)
            print(f"Extractions: {summary['total_extractions']} ({summary['success_rate']:.0%} success)")
            print(f"Tickers: {summary['tickers_covered']}")
            print(f"API calls: {summary['api_calls']}")
    
    asyncio.run(run_health())


def cmd_api(args):
    """Start API server"""
    import uvicorn
    
    print(f"Starting Eugene API on port {args.port}...")
    uvicorn.run(
        "api.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload
    )


def cmd_mcp(args):
    """Start MCP server"""
    print("Starting MCP server...")
    print("Connect from Claude Desktop using:")
    print(f'  "command": "python", "args": ["{Path(__file__).parent}/mcp/server.py"]')
    
    from mcp.server import main
    asyncio.run(main())


def main():
    parser = argparse.ArgumentParser(
        description="Eugene Data Labs CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  eugene_cli.py extract --ticker TSLA
  eugene_cli.py batch --tickers TSLA AAPL MSFT --retries 3
  eugene_cli.py monitor --tickers TSLA AAPL
  eugene_cli.py health --metrics
  eugene_cli.py api --port 8000
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # Extract command
    extract_parser = subparsers.add_parser("extract", help="Extract data from a single filing")
    extract_parser.add_argument("--ticker", "-t", required=True, help="Stock ticker")
    extract_parser.add_argument("--filing-type", "-f", default="10-K", help="Filing type")
    extract_parser.add_argument("--format", choices=["json", "markdown"], default="markdown")
    
    # Batch command
    batch_parser = subparsers.add_parser("batch", help="Run batch extraction")
    batch_parser.add_argument("--tickers", "-t", nargs="+", required=True, help="Tickers to process")
    batch_parser.add_argument("--filing-type", "-f", default="10-K", help="Filing type")
    batch_parser.add_argument("--retries", type=int, default=3, help="Max retries per ticker")
    batch_parser.add_argument("--rate-limit", type=int, default=20, help="Requests per minute")
    batch_parser.add_argument("--no-resume", action="store_true", help="Don't resume from checkpoint")
    
    # Monitor command
    monitor_parser = subparsers.add_parser("monitor", help="Monitor SEC filings in real-time")
    monitor_parser.add_argument("--tickers", "-t", nargs="+", help="Tickers to watch")
    monitor_parser.add_argument("--types", nargs="+", help="Filing types to watch")
    monitor_parser.add_argument("--interval", type=int, default=60, help="Poll interval (seconds)")
    
    # Health command
    health_parser = subparsers.add_parser("health", help="Run health checks")
    health_parser.add_argument("--metrics", "-m", action="store_true", help="Show metrics")
    
    # API command
    api_parser = subparsers.add_parser("api", help="Start API server")
    api_parser.add_argument("--host", default="0.0.0.0", help="Host to bind")
    api_parser.add_argument("--port", "-p", type=int, default=8000, help="Port to bind")
    api_parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    
    # MCP command
    mcp_parser = subparsers.add_parser("mcp", help="Start MCP server")
    
    args = parser.parse_args()
    
    # Check API key for commands that need it
    if args.command in ["extract", "batch"]:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            print("Error: ANTHROPIC_API_KEY not set")
            print("Set it with: export ANTHROPIC_API_KEY=your-key")
            sys.exit(1)
    
    # Dispatch to command
    if args.command == "extract":
        cmd_extract(args)
    elif args.command == "batch":
        cmd_batch(args)
    elif args.command == "monitor":
        cmd_monitor(args)
    elif args.command == "health":
        cmd_health(args)
    elif args.command == "api":
        cmd_api(args)
    elif args.command == "mcp":
        cmd_mcp(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
