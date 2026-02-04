#!/usr/bin/env python3
"""Eugene Intelligence MCP Server - Standalone version"""
import sys
import os
import json

# Setup paths before any imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment
from dotenv import load_dotenv
load_dotenv(os.environ.get("DOTENV_PATH", os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")))

from eugene.config import Config

config = Config()
_edgar = None
_xbrl = None
_health = None
_credit = None
_equity = None

def get_edgar():
    global _edgar
    if _edgar is None:
        from eugene.sources.edgar import EDGARClient
        _edgar = EDGARClient(config)
    return _edgar

def get_xbrl():
    global _xbrl
    if _xbrl is None:
        from eugene.sources.xbrl import XBRLClient
        _xbrl = XBRLClient(config)
    return _xbrl

def get_health():
    global _health
    if _health is None:
        from eugene.agents.health import HealthMonitor
        _health = HealthMonitor(config)
    return _health

def get_credit():
    global _credit
    if _credit is None:
        from eugene.agents.credit import CreditMonitorAgent
        _credit = CreditMonitorAgent(config)
    return _credit

def get_equity():
    global _equity
    if _equity is None:
        from eugene.agents.equity import EquityResearchAgent
        _equity = EquityResearchAgent(config)
    return _equity

TOOLS = [
    {
        "name": "company_health",
        "description": "Industry-standard financial metrics for any public company. Returns ratios (current ratio, debt-to-assets, ROE, ROA, margins, Altman Z-Score), absolute values, and 5-year trends. No grades - data speaks for itself. Uses SEC XBRL, instant results, no LLM.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol (e.g., AAPL, JPM, TSLA)"},
                "include_trends": {"type": "boolean", "description": "Include 5-year trends", "default": True}
            },
            "required": ["ticker"]
        }
    },
    {
        "name": "compare_companies",
        "description": "Compare financial metrics across multiple companies side by side. Returns all ratios and trends for each company. Example: compare JPM, BAC, GS",
        "inputSchema": {
            "type": "object",
            "properties": {
                "tickers": {"type": "array", "items": {"type": "string"}, "description": "List of ticker symbols"}
            },
            "required": ["tickers"]
        }
    },
    {
        "name": "get_financials",
        "description": "Raw XBRL financial data for any company. Returns balance sheet, income statement, cash flow items with exact XBRL tags. Instant, deterministic.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol"}
            },
            "required": ["ticker"]
        }
    },
    {
        "name": "get_financial_history",
        "description": "Historical time series for any metric: revenue, net_income, total_assets, total_debt, eps_basic, operating_cash_flow. Up to 10 years.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol"},
                "metric": {"type": "string", "description": "Metric: revenue, net_income, total_assets, total_debt, eps_basic, operating_cash_flow"},
                "years": {"type": "integer", "description": "Years of history", "default": 5}
            },
            "required": ["ticker", "metric"]
        }
    },
    {
        "name": "credit_monitor",
        "description": "Credit analysis with debt structure, maturities, covenants, and risk factors. Uses LLM to analyze 10-K filings. Returns sourced insights.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol"}
            },
            "required": ["ticker"]
        }
    },
    {
        "name": "equity_research",
        "description": "Equity research with revenue breakdown, margins, guidance, risks. Uses LLM to analyze 10-K filings. Returns sourced insights.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol"}
            },
            "required": ["ticker"]
        }
    },
    {
        "name": "get_company_filings",
        "description": "List recent SEC filings (10-K, 10-Q, 8-K) for a company.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol"},
                "filing_type": {"type": "string", "description": "Filter: 10-K, 10-Q, 8-K"},
                "limit": {"type": "integer", "description": "Number of filings", "default": 5}
            },
            "required": ["ticker"]
        }
    }
]

def handle_tool_call(name, args):
    try:
        if name == "company_health":
            report = get_health().analyze(args["ticker"], include_trends=args.get("include_trends", True))
            return report.to_dict()
        elif name == "compare_companies":
            return get_health().compare(args["tickers"])
        elif name == "get_financials":
            data = get_xbrl().get_financials(args["ticker"])
            return {"ticker": data.ticker, "company_name": data.company_name, 
                    "metrics": {k: {"value": data.get(k), "tag": data.get_fact(k).tag if data.get_fact(k) else None} 
                               for k in data.available_keys()}}
        elif name == "get_financial_history":
            history = get_xbrl().get_historical(args["ticker"], args["metric"], years=args.get("years", 5))
            return {"ticker": args["ticker"], "metric": args["metric"],
                    "data": [{"fiscal_year": h.fiscal_year, "value": h.value, "period_end": h.period_end} for h in history]}
        elif name == "credit_monitor":
            result = get_credit().analyze(args["ticker"])
            return result.to_dict()
        elif name == "equity_research":
            result = get_equity().analyze(args["ticker"])
            return result.to_dict()
        elif name == "get_company_filings":
            filings = get_edgar().get_filings(args["ticker"], form_type=args.get("filing_type"), limit=args.get("limit", 5))
            return {"ticker": args["ticker"], "filings": [{"type": f.form_type, "filed": f.filed_date, "accession": f.accession_number} for f in filings]}
        else:
            return {"error": "Unknown tool: {}".format(name)}
    except Exception as e:
        return {"error": str(e)}

def handle_request(req):
    method = req.get("method")
    req_id = req.get("id")
    
    if method == "initialize":
        return {"jsonrpc": "2.0", "id": req_id, "result": {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "eugene-intelligence", "version": "0.5.0",
                          "description": "Financial data infrastructure for AI agents. SEC XBRL + LLM analysis."}
        }}
    elif method == "tools/list":
        return {"jsonrpc": "2.0", "id": req_id, "result": {"tools": TOOLS}}
    elif method == "tools/call":
        params = req.get("params", {})
        tool_name = params.get("name")
        tool_args = params.get("arguments", {})
        result = handle_tool_call(tool_name, tool_args)
        return {"jsonrpc": "2.0", "id": req_id, "result": {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}}
    elif method == "notifications/initialized":
        return None
    else:
        return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": "Method not found"}}

if __name__ == "__main__":
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            resp = handle_request(req)
            if resp:
                sys.stdout.write(json.dumps(resp) + "\n")
                sys.stdout.flush()
        except json.JSONDecodeError:
            sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}) + "\n")
            sys.stdout.flush()
        except Exception as e:
            sys.stderr.write("Error: {}\n".format(e))
            sys.stderr.flush()
