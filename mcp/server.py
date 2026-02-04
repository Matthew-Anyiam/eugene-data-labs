"""
Eugene Intelligence - MCP Server v0.4.0
Financial context infrastructure for AI agents.
"""
import json, sys, logging, os
from dotenv import load_dotenv
load_dotenv(os.environ.get("DOTENV_PATH", ".env"))
from typing import Optional, Dict, Any
from dotenv import load_dotenv
load_dotenv()
from eugene.config import Config, get_config

logger = logging.getLogger(__name__)

TOOLS = [
    {
        "name": "credit_monitor",
        "description": "Get comprehensive credit analysis for a company. Analyzes SEC filings to extract debt structure, maturity schedule, covenants, liquidity, and credit risks. Every data point is cited to its source document and section.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol (e.g., AAPL, TSLA, BA)"},
                "include_quarterly": {"type": "boolean", "description": "Also analyze latest 10-Q", "default": False}
            },
            "required": ["ticker"]
        }
    },
    {
        "name": "equity_research",
        "description": "Generate equity research analysis for a company. Extracts revenue, earnings, margins, segments, guidance, risk factors, and capital allocation from SEC filings. Every insight is sourced and verifiable.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol"},
                "filing_type": {"type": "string", "description": "10-K (annual) or 10-Q (quarterly)", "default": "10-K", "enum": ["10-K", "10-Q"]},
                "focus": {"type": "string", "description": "Optional focus: revenue, margins, guidance, risk, capital", "enum": ["revenue", "margins", "guidance", "risk", "capital"]}
            },
            "required": ["ticker"]
        }
    },
    {
        "name": "get_company_filings",
        "description": "List recent SEC filings for a company. Returns filing dates, types, accession numbers.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol"},
                "filing_type": {"type": "string", "description": "Filter: 10-K, 10-Q, 8-K, etc."},
                "limit": {"type": "integer", "description": "Number of filings (default 5)", "default": 5}
            },
            "required": ["ticker"]
        }
    },
    {
        "name": "get_company_info",
        "description": "Get basic company information from SEC EDGAR.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol"}
            },
            "required": ["ticker"]
        }
    },
    {
        "name": "get_filing_section",
        "description": "Extract a specific section from a company SEC filing. Returns sourced text with citation.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol"},
                "filing_type": {"type": "string", "description": "Filing type", "default": "10-K"},
                "section_keyword": {"type": "string", "description": "Keyword to find section (e.g., Risk Factor, Revenue, Debt)"}
            },
            "required": ["ticker", "section_keyword"]
        }
    },
    {
        "name": "get_financials",
        "description": "Get standardized financial data for any public company using XBRL. Returns balance sheet, income statement, cash flow, and debt data in a consistent format regardless of how the company reports. No LLM needed - direct from SEC structured data.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol"},
                "fiscal_year": {"type": "integer", "description": "Specific fiscal year (optional, defaults to latest)"},
                "form_type": {"type": "string", "description": "10-K for annual, 10-Q for quarterly", "default": "10-K"}
            },
            "required": ["ticker"]
        }
    },
    {
        "name": "company_health",
        "description": "Get a financial health report with letter grade (A-F), ratios, and trend analysis for any public company. Uses XBRL data - no LLM, instant results. Computes current ratio, debt-to-assets, interest coverage, ROE, ROA, ROIC, margins, Altman Z-Score, free cash flow, and more.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol"},
                "include_trends": {"type": "boolean", "description": "Include 5-year trend analysis", "default": True},
                "years": {"type": "integer", "description": "Years of trend history", "default": 5}
            },
            "required": ["ticker"]
        }
    },
    {
        "name": "compare_companies",
        "description": "Compare financial health across multiple companies. Returns ranked health grades, ratios, and trends side by side. Example: compare JPM vs BAC vs GS.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "tickers": {"type": "array", "items": {"type": "string"}, "description": "List of ticker symbols to compare"},
                "include_trends": {"type": "boolean", "description": "Include trend analysis", "default": True},
                "years": {"type": "integer", "description": "Years of history", "default": 5}
            },
            "required": ["tickers"]
        }
    },
    {
        "name": "get_financial_history",
        "description": "Get historical time series for any financial metric. Supports revenue, net_income, total_assets, total_debt, operating_cash_flow, eps_basic, and 30+ other standardized metrics. Returns up to 10 years of annual data.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol"},
                "metric": {"type": "string", "description": "Metric key: revenue, net_income, total_assets, total_liabilities, operating_income, operating_cash_flow, capital_expenditures, total_debt, eps_basic, eps_diluted, etc."},
                "years": {"type": "integer", "description": "Number of years of history", "default": 5},
                "form_type": {"type": "string", "description": "10-K for annual, 10-Q for quarterly", "default": "10-K"}
            },
            "required": ["ticker", "metric"]
        }
    }
]


class MCPServer:
    def __init__(self, config=None):
        self.config = config or get_config()
        self._edgar = None
        self._credit_agent = None
        self._equity_agent = None
        self._xbrl = None
        self._health = None

    @property
    def edgar(self):
        if self._edgar is None:
            from eugene.sources.edgar import EDGARClient
            self._edgar = EDGARClient(self.config)
        return self._edgar

    @property
    def credit_agent(self):
        if self._credit_agent is None:
            from eugene.agents.credit import CreditMonitorAgent
            self._credit_agent = CreditMonitorAgent(self.config)
        return self._credit_agent

    @property
    def equity_agent(self):
        if self._equity_agent is None:
            from eugene.agents.equity import EquityResearchAgent
            self._equity_agent = EquityResearchAgent(self.config)
        return self._equity_agent
    @property
    def xbrl(self):
        if self._xbrl is None:
            from eugene.sources.xbrl import XBRLClient
            self._xbrl = XBRLClient(self.config)
        return self._xbrl
    @property
    def health(self):
        if self._health is None:
            from eugene.agents.health import HealthMonitor
            self._health = HealthMonitor(self.config)
        return self._health

    def handle_request(self, request):
        method = request.get("method", "")
        request_id = request.get("id")
        if method == "initialize":
            return {"jsonrpc": "2.0", "id": request_id, "result": {
                "protocolVersion": "2024-11-05", "capabilities": {"tools": {}},
                "serverInfo": {"name": "eugene-intelligence", "version": "0.4.0",
                               "description": "Financial context infrastructure. Structured and verified data from SEC filings, with credit intelligence and equity research. Every claim is sourced."}
            }}
        elif method == "tools/list":
            return {"jsonrpc": "2.0", "id": request_id, "result": {"tools": TOOLS}}
        elif method == "tools/call":
            return self._handle_tool_call(request_id, request.get("params", {}))
        elif method == "notifications/initialized":
            return None
        else:
            return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32601, "message": "Unknown method: {}".format(method)}}

    def _handle_tool_call(self, request_id, params):
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})
        try:
            if tool_name == "credit_monitor":
                result = self._credit_monitor(arguments)
            elif tool_name == "equity_research":
                result = self._equity_research(arguments)
            elif tool_name == "get_company_filings":
                result = self._get_company_filings(arguments)
            elif tool_name == "get_company_info":
                result = self._get_company_info(arguments)
            elif tool_name == "get_filing_section":
                result = self._get_filing_section(arguments)
            elif tool_name == "company_health":
                result = self._company_health(arguments)
            elif tool_name == "compare_companies":
                result = self._compare_companies(arguments)
            elif tool_name == "get_financials":
                result = self._get_financials(arguments)
            elif tool_name == "get_financial_history":
                result = self._get_financial_history(arguments)
            else:
                return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32602, "message": "Unknown tool: {}".format(tool_name)}}
            return {"jsonrpc": "2.0", "id": request_id, "result": {"content": [{"type": "text", "text": json.dumps(result, indent=2, default=str)}]}}
        except Exception as e:
            logger.error("Tool call error: {}".format(e), exc_info=True)
            return {"jsonrpc": "2.0", "id": request_id, "result": {"content": [{"type": "text", "text": json.dumps({"error": str(e), "tool": tool_name})}], "isError": True}}

    def _credit_monitor(self, args):
        ticker = args["ticker"].upper()
        result = self.credit_agent.analyze(ticker=ticker, include_quarterly=args.get("include_quarterly", False))
        return result.to_dict()

    def _equity_research(self, args):
        ticker = args["ticker"].upper()
        result = self.equity_agent.analyze(ticker=ticker, filing_type=args.get("filing_type", "10-K"), focus=args.get("focus"))
        return result.to_dict()

    def _get_company_filings(self, args):
        ticker = args["ticker"].upper()
        filings = self.edgar.get_filings(ticker, filing_type=args.get("filing_type"), limit=args.get("limit", 5))
        return {"ticker": ticker, "count": len(filings), "filings": [f.to_dict() for f in filings]}

    def _get_company_info(self, args):
        ticker = args["ticker"].upper()
        company = self.edgar.get_company(ticker)
        return {"ticker": ticker, "name": company.name, "cik": company.cik, "sic": company.sic, "state": company.state}

    def _get_filing_section(self, args):
        ticker = args["ticker"].upper()
        filing_type = args.get("filing_type", "10-K")
        keyword = args["section_keyword"]
        filings = self.edgar.get_filings(ticker, filing_type=filing_type, limit=1)
        if not filings:
            return {"error": "No {} found for {}".format(filing_type, ticker)}
        filing = filings[0]
        html = self.edgar.get_filing_content(filing)
        text = self.edgar.extract_text_from_html(html)
        idx = text.find(keyword)
        if idx < 0:
            idx = text.lower().find(keyword.lower())
        if idx < 0:
            return {"ticker": ticker, "section": keyword, "found": False, "message": "Section not found"}
        start = max(0, idx - 200)
        end = min(len(text), idx + 5000)
        return {"ticker": ticker, "filing_type": filing_type, "filing_date": filing.filing_date,
                "section": keyword, "found": True, "text": text[start:end],
                "source": {"document": "{} {}".format(filing.company_name, filing_type),
                           "accession_number": filing.accession_number, "filing_date": filing.filing_date, "url": filing.filing_url}}

    def run_stdio(self):
        """Run server over stdin/stdout for MCP clients."""
        import sys
        try:
            for line in sys.stdin:
                
                line = line.strip()
                if not line:
                    continue
                try:
                    request = json.loads(line)
                    response = self.handle_request(request)
                    if response is not None:
                        sys.stdout.write(json.dumps(response) + "\n")
                        sys.stdout.flush()
                except json.JSONDecodeError:
                    sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}) + "\n")
                    sys.stdout.flush()
                except Exception as e:
                    sys.stderr.write("Eugene error: {}\n".format(e))
                    sys.stderr.flush()
        except KeyboardInterrupt:
            pass
        except Exception as e:
            sys.stderr.write("Eugene fatal: {}\n".format(e))
            sys.stderr.flush()

if __name__ == "__main__":
    if "--test" in sys.argv:
        print("Testing MCP Server v0.4.0...")
        server = MCPServer()
        response = server.handle_request({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"capabilities": {}}})
        assert response["result"]["serverInfo"]["version"] == "0.4.0"
        print("  Initialize OK")
        response = server.handle_request({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
        tools = response["result"]["tools"]
        names = [t["name"] for t in tools]
        print("  {} tools: {}".format(len(tools), ", ".join(names)))
        print("\nAll tests passed!")
    else:
        MCPServer().run_stdio()