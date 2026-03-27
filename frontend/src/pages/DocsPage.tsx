import { useState } from 'react';
import { Tabs } from '../components/ui/Tabs';
import { CodeBlock, InlineCode } from '../components/ui/CodeBlock';

const TABS = ['Getting Started', 'API', 'MCP', 'Extracts', 'Concepts'];

function ParamRow({ name, type, desc, required, def }: {
  name: string; type?: string; desc: string; required?: boolean; def?: string;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 border-b border-slate-100 py-2.5 last:border-0 dark:border-slate-800/50 sm:grid-cols-[140px_80px_1fr]">
      <div className="flex items-center gap-1.5">
        <code className="text-xs font-medium">{name}</code>
        {required && <span className="rounded bg-red-50 px-1 py-px text-[10px] font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">required</span>}
        {type && <span className="hidden text-xs text-slate-400 sm:inline">{type}</span>}
      </div>
      <p className="col-span-full text-xs leading-relaxed text-slate-600 dark:text-slate-400 sm:col-span-1">
        {desc}{def ? ` Default: ${def}.` : ''}
      </p>
    </div>
  );
}

function Endpoint({ method, path, desc, params, example }: {
  method: string;
  path: string;
  desc: string;
  params?: { name: string; type?: string; desc: string; required?: boolean; def?: string }[];
  example?: string;
}) {
  return (
    <div className="border-b border-slate-200 py-5 last:border-0 dark:border-slate-800">
      <div className="flex items-center gap-2">
        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
          {method}
        </span>
        <code className="text-sm font-medium">{path}</code>
      </div>
      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{desc}</p>
      {params && params.length > 0 && (
        <div className="mt-3 rounded-md border border-slate-100 px-3 dark:border-slate-800">
          {params.map((p) => <ParamRow key={p.name} {...p} />)}
        </div>
      )}
      {example && <div className="mt-3"><CodeBlock>{example}</CodeBlock></div>}
    </div>
  );
}

function GettingStartedSection() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold">1. Install</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Install Eugene from PyPI:
        </p>
        <div className="mt-3"><CodeBlock>pip install eugene-data</CodeBlock></div>
      </div>

      <div>
        <h3 className="text-lg font-semibold">2. Configure</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          SEC EDGAR and XBRL data works out of the box — no API key needed. For market data
          (quotes, screener, technicals) and economics, Eugene uses upstream providers that
          require keys. Set them once:
        </p>
        <div className="mt-3">
          <CodeBlock>{`eugene config set FMP_API_KEY your-key
eugene config set FRED_API_KEY your-key    # optional, for economics`}</CodeBlock>
        </div>
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          Without these keys, SEC filings, financials, XBRL concepts, insiders, ownership, events,
          and filing sections all still work. You only need keys for real-time prices, screener, technicals, and FRED.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold">3. Start</h3>
        <div className="mt-3">
          <CodeBlock>{`# REST API server
eugene start

# MCP server (for Claude, Cursor, etc.)
eugene serve`}</CodeBlock>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold">4. Query</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          One endpoint, one identifier, one response — regardless of how many sources it pulls from:
        </p>
        <div className="mt-3">
          <CodeBlock>{`# Financials from SEC XBRL — no API key needed
curl "http://localhost:8000/v1/sec/AAPL?extract=financials&period=FY&limit=3"

# Combine multiple extracts in one call
curl "http://localhost:8000/v1/sec/AAPL?extract=profile,financials,insiders,metrics"

# Screen for large-cap tech stocks
curl "http://localhost:8000/v1/screener?sector=Technology&marketCapMin=100000000000"

# Economics from FRED
curl "http://localhost:8000/v1/economics/inflation"`}</CodeBlock>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold">5. Response format</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Every SEC response uses the same envelope:
        </p>
        <div className="mt-3">
          <CodeBlock>{`{
  "status": "success",
  "identifier": "AAPL",
  "resolved": {
    "ticker": "AAPL",
    "cik": "320193",
    "company": "Apple Inc"
  },
  "data": { ... },
  "provenance": [
    {
      "extract": "financials",
      "source": "SEC CompanyFacts (XBRL)",
      "url": "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
      "retrieved_at": "2026-03-24T12:00:00Z"
    }
  ],
  "metadata": {
    "service": "eugene-intelligence",
    "version": "0.8.1"
  }
}`}</CodeBlock>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold">Error responses</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Errors return standard HTTP codes with a JSON body:
        </p>
        <div className="mt-3 space-y-3">
          <div className="rounded-md border border-slate-100 px-3 dark:border-slate-800">
            <ParamRow name="401" desc="Missing or invalid X-API-Key header." />
            <ParamRow name="404" desc="Ticker/CIK not found in SEC EDGAR." />
            <ParamRow name="422" desc="Invalid parameter (bad extract type, malformed date, etc.)." />
            <ParamRow name="429" desc="Rate limit exceeded. Default: 10 req/sec. Retry after the Retry-After header." />
            <ParamRow name="500" desc="Internal server error. Check provenance for partial data." />
          </div>
          <CodeBlock>{`# Example error response
{
  "status": "error",
  "error": "Ticker 'ZZZZZ' not found in SEC EDGAR",
  "identifier": "ZZZZZ",
  "data": null
}`}</CodeBlock>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold">Rate limits</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Default: 10 requests/second per API key. SEC EDGAR has its own rate limit of 10 req/sec
          (Eugene handles this internally). Responses include <InlineCode>X-RateLimit-Remaining</InlineCode> and
          <InlineCode>Retry-After</InlineCode> headers when applicable.
        </p>
      </div>
    </div>
  );
}

function APISection() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Base URL: <InlineCode>http://localhost:8000</InlineCode>. SEC EDGAR endpoints work without authentication.
          Market data and screener endpoints use the API keys configured during setup.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">SEC Data</h3>
        <Endpoint
          method="GET"
          path="/v1/sec/{identifier}"
          desc="Primary endpoint. Query any SEC data by ticker, CIK, or accession number."
          params={[
            { name: 'identifier', type: 'path', desc: 'Ticker (AAPL), CIK (320193), or accession number.', required: true },
            { name: 'extract', type: 'query', desc: 'Comma-separated extract types. See Extracts tab for full list.', def: 'financials' },
            { name: 'period', type: 'query', desc: 'FY for annual, Q for quarterly.', def: 'FY' },
            { name: 'concept', type: 'query', desc: 'Canonical concept name or raw XBRL tag. See Concepts tab.' },
            { name: 'form', type: 'query', desc: 'Filter by form type: 10-K, 10-Q, 8-K, 4, 13F-HR.' },
            { name: 'section', type: 'query', desc: 'Filing section: mdna, risk_factors, business, legal.' },
            { name: 'limit', type: 'query', desc: 'Maximum results to return.', def: '10' },
            { name: 'from', type: 'query', desc: 'Start date filter (YYYY-MM-DD).' },
            { name: 'to', type: 'query', desc: 'End date filter (YYYY-MM-DD).' },
          ]}
          example={`curl "http://localhost:8000/v1/sec/AAPL?extract=financials,metrics&period=FY&limit=5"`}
        />
      </div>

      <div>
        <h3 className="text-sm font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">Convenience Routes</h3>
        <Endpoint method="GET" path="/v1/sec/{ticker}/prices" desc="Real-time stock quote with day/year ranges, volume, moving averages." />
        <Endpoint method="GET" path="/v1/sec/{ticker}/profile" desc="Company profile: name, CIK, SIC code, address, fiscal year end." />
        <Endpoint
          method="GET"
          path="/v1/sec/{ticker}/ohlcv"
          desc="OHLCV price bars."
          params={[
            { name: 'interval', type: 'query', desc: 'Bar interval.', def: 'daily' },
            { name: 'from', type: 'query', desc: 'Start date (YYYY-MM-DD).' },
            { name: 'to', type: 'query', desc: 'End date (YYYY-MM-DD).' },
          ]}
        />
        <Endpoint method="GET" path="/v1/sec/{ticker}/earnings" desc="Historical earnings per share vs estimates." />
        <Endpoint method="GET" path="/v1/sec/{ticker}/estimates" desc="Analyst consensus estimates." />
        <Endpoint method="GET" path="/v1/sec/{ticker}/news" desc="Recent company news." />
        <Endpoint
          method="GET"
          path="/v1/sec/{identifier}/export"
          desc="Export data as CSV or JSON file download."
          params={[
            { name: 'format', type: 'query', desc: 'Output format.', def: 'csv' },
            { name: 'extract', type: 'query', desc: 'Which extract to export.' },
          ]}
        />
      </div>

      <div>
        <h3 className="text-sm font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">Screener</h3>
        <Endpoint
          method="GET"
          path="/v1/screener"
          desc="Screen stocks by market cap, price, volume, sector, beta, country."
          params={[
            { name: 'sector', type: 'query', desc: 'Technology, Healthcare, Financial Services, Consumer Cyclical, Industrials, Energy, etc.' },
            { name: 'country', type: 'query', desc: 'Country code: US, GB, DE, JP, CN.' },
            { name: 'marketCapMin', type: 'query', desc: 'Minimum market capitalization.' },
            { name: 'marketCapMax', type: 'query', desc: 'Maximum market capitalization.' },
            { name: 'priceMin', type: 'query', desc: 'Minimum share price.' },
            { name: 'priceMax', type: 'query', desc: 'Maximum share price.' },
            { name: 'volumeMin', type: 'query', desc: 'Minimum daily volume.' },
            { name: 'betaMin', type: 'query', desc: 'Minimum beta.' },
            { name: 'betaMax', type: 'query', desc: 'Maximum beta.' },
            { name: 'limit', type: 'query', desc: 'Maximum results.', def: '50' },
          ]}
          example={`curl "http://localhost:8000/v1/screener?sector=Technology&marketCapMin=100000000000&limit=20"`}
        />
      </div>

      <div>
        <h3 className="text-sm font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">Economics</h3>
        <Endpoint
          method="GET"
          path="/v1/economics/{category}"
          desc="FRED economic data by category. Each series includes latest value, units, and history."
          params={[
            { name: 'category', type: 'path', desc: 'inflation, employment, gdp, housing, consumer, manufacturing, rates, money, treasury, all.', required: true },
            { name: 'series', type: 'query', desc: 'Specific FRED series ID (e.g. CPIAUCSL, UNRATE). Overrides category.' },
          ]}
        />
      </div>

      <div>
        <h3 className="text-sm font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">Crypto</h3>
        <Endpoint
          method="GET"
          path="/v1/crypto/{symbol}"
          desc="Cryptocurrency quotes and historical OHLCV data."
          params={[
            { name: 'symbol', type: 'path', desc: 'Pair symbol: BTCUSD, ETHUSD, SOLUSD, etc.', required: true },
            { name: 'interval', type: 'query', desc: 'Data type: quote, daily, 1hour, 5min.', def: 'quote' },
          ]}
        />
      </div>

      <div>
        <h3 className="text-sm font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">Streaming</h3>
        <Endpoint
          method="GET"
          path="/v1/stream/filings"
          desc="Server-sent events (SSE) stream of recent SEC filings."
          params={[
            { name: 'form', type: 'query', desc: 'Filter by form type (10-K, 10-Q, 8-K).' },
            { name: 'ticker', type: 'query', desc: 'Filter by ticker symbol.' },
          ]}
        />
      </div>

      <div>
        <h3 className="text-sm font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">Meta</h3>
        <Endpoint method="GET" path="/health" desc="Health check. Returns status and version number." />
        <Endpoint method="GET" path="/v1/capabilities" desc="Full list of extract types, parameters, and canonical concepts." />
        <Endpoint method="GET" path="/v1/concepts" desc="All 36 canonical financial concepts with descriptions and XBRL tag mappings." />
      </div>
    </div>
  );
}

function MCPSection() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Eugene exposes 5 MCP tools. Connect via <InlineCode>eugene serve</InlineCode> or
          add to your MCP client config.
        </p>
        <div className="mt-3">
          <CodeBlock>{`{
  "mcpServers": {
    "eugene": {
      "command": "eugene",
      "args": ["serve"],
      "env": {
        "FMP_API_KEY": "your-fmp-key",
        "FRED_API_KEY": "your-fred-key"
      }
    }
  }
}`}</CodeBlock>
        </div>
      </div>

      <MCPTool
        name="sec"
        desc="All SEC EDGAR data in one tool. Query by ticker, CIK, or accession number."
        params={[
          { name: 'identifier', desc: 'Ticker (AAPL), CIK (320193), or accession number.', required: true },
          { name: 'extract', desc: 'Comma-separated extract types. See Extracts tab.', def: 'financials' },
          { name: 'period', desc: 'FY for annual, Q for quarterly.', def: 'FY' },
          { name: 'concept', desc: 'Canonical concept name or raw XBRL tag.' },
          { name: 'form', desc: 'Filter: 10-K, 10-Q, 8-K, 4, 13F-HR.' },
          { name: 'section', desc: 'Filing section: mdna, risk_factors, business, legal.' },
          { name: 'date_from', desc: 'Start date (YYYY-MM-DD).' },
          { name: 'date_to', desc: 'End date (YYYY-MM-DD).' },
          { name: 'limit', desc: 'Maximum results.', def: '10' },
        ]}
        example={`sec(identifier="AAPL", extract="financials,metrics", period="FY", limit=5)`}
      />

      <MCPTool
        name="economics"
        desc="All FRED economic data — inflation, employment, GDP, housing, rates, and more."
        params={[
          { name: 'category', desc: 'inflation, employment, gdp, housing, consumer, manufacturing, rates, money, treasury, all.', def: 'all' },
          { name: 'series', desc: 'Specific FRED series ID (e.g. CPIAUCSL, UNRATE). Overrides category.' },
        ]}
        example={`economics(category="inflation")
economics(series="UNRATE")`}
      />

      <MCPTool
        name="screener"
        desc="Screen stocks by market cap, price, volume, sector, beta, country."
        params={[
          { name: 'sector', desc: 'Technology, Healthcare, Financial Services, etc.' },
          { name: 'country', desc: 'Country code: US, GB, DE, JP, CN.' },
          { name: 'market_cap_min', desc: 'Minimum market capitalization.' },
          { name: 'market_cap_max', desc: 'Maximum market capitalization.' },
          { name: 'price_min / price_max', desc: 'Share price range.' },
          { name: 'volume_min', desc: 'Minimum daily volume.' },
          { name: 'beta_min / beta_max', desc: 'Beta range.' },
          { name: 'limit', desc: 'Maximum results.', def: '50' },
        ]}
        example={`screener(sector="Technology", market_cap_min=1000000000, limit=20)`}
      />

      <MCPTool
        name="crypto"
        desc="Cryptocurrency quotes and historical OHLCV data."
        params={[
          { name: 'symbol', desc: 'Pair symbol: BTCUSD, ETHUSD, SOLUSD, etc.', required: true },
          { name: 'type', desc: 'Data type: quote, daily, 1hour, 5min.', def: 'quote' },
        ]}
        example={`crypto(symbol="BTCUSD", type="daily")`}
      />

      <MCPTool
        name="caps"
        desc="List all available tools, extract types, and capabilities. No parameters."
        params={[]}
        example="caps()"
      />
    </div>
  );
}

function MCPTool({ name, desc, params, example }: {
  name: string;
  desc: string;
  params: { name: string; desc: string; required?: boolean; def?: string }[];
  example: string;
}) {
  return (
    <div className="border-b border-slate-200 pb-6 last:border-0 dark:border-slate-800">
      <h3 className="text-lg font-semibold">{name}</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{desc}</p>
      {params.length > 0 && (
        <div className="mt-3 rounded-md border border-slate-100 px-3 dark:border-slate-800">
          {params.map((p) => <ParamRow key={p.name} name={p.name} desc={p.desc} required={p.required} def={p.def} />)}
        </div>
      )}
      <div className="mt-3"><CodeBlock>{example}</CodeBlock></div>
    </div>
  );
}

function ExtractsSection() {
  const groups = [
    {
      label: 'SEC EDGAR',
      extracts: [
        { name: 'profile', desc: 'Company name, CIK, SIC code, address, fiscal year end.' },
        { name: 'filings', desc: 'Filing list (10-K, 10-Q, 8-K, etc.) with accession numbers and EDGAR URLs.' },
        { name: 'insiders', desc: 'Form 4 insider transactions — buys, sells, option exercises, grants.' },
        { name: 'ownership', desc: '13F-HR institutional holdings filings with share counts and values.' },
        { name: 'events', desc: '8-K material events — earnings announcements, M&A, leadership changes.' },
        { name: 'sections', desc: 'Full text of MD&A, risk factors, business description from 10-K/10-Q.' },
        { name: 'exhibits', desc: 'Exhibit index with document URLs for each filing.' },
      ],
    },
    {
      label: 'SEC XBRL',
      extracts: [
        { name: 'financials', desc: 'Normalized income statement, balance sheet, and cash flow statement. Annual or quarterly.' },
        { name: 'concepts', desc: 'Raw XBRL concept time series. Pass any XBRL tag or canonical concept name.' },
        { name: 'segments', desc: 'Revenue breakdowns by business segment and geography.' },
        { name: 'float', desc: 'Shares outstanding, free float count, and float percentage.' },
      ],
    },
    {
      label: 'Market Data',
      extracts: [
        { name: 'metrics', desc: '50+ financial ratios organized by profitability, liquidity, leverage, valuation, growth, per-share.' },
        { name: 'ohlcv', desc: 'Historical OHLCV price bars — daily, 1-hour, or 5-minute intervals.' },
        { name: 'technicals', desc: 'Technical indicators: SMA, EMA, RSI, MACD, Bollinger Bands, ATR, VWAP.' },
        { name: 'corporate_actions', desc: 'Dividends, stock splits, and 8-K events merged into a single timeline.' },
        { name: 'transcripts', desc: 'Earnings call transcripts with management remarks, Q&A, guidance, and tone analysis.' },
        { name: 'peers', desc: 'Relative valuation — compare key metrics against sector peers with percentile rankings.' },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        17 extract types. Combine multiple with commas: <InlineCode>extract=financials,metrics,profile</InlineCode>
      </p>
      {groups.map((g) => (
        <div key={g.label}>
          <h3 className="mb-3 text-sm font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {g.label}
          </h3>
          <div className="rounded-md border border-slate-100 dark:border-slate-800">
            {g.extracts.map((e) => (
              <div key={e.name} className="flex gap-4 border-b border-slate-100 px-3 py-2.5 last:border-0 dark:border-slate-800/50">
                <code className="w-32 shrink-0 text-xs font-medium">{e.name}</code>
                <span className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">{e.desc}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConceptsSection() {
  const groups = [
    {
      label: 'Income Statement',
      concepts: ['revenue', 'cost_of_revenue', 'gross_profit', 'operating_income', 'net_income', 'eps_basic', 'eps_diluted', 'interest_expense'],
    },
    {
      label: 'Balance Sheet',
      concepts: ['total_assets', 'total_liabilities', 'stockholders_equity', 'cash', 'total_debt', 'short_term_debt', 'long_term_debt', 'shares_outstanding', 'current_assets', 'current_liabilities', 'inventory', 'accounts_receivable', 'accounts_payable'],
    },
    {
      label: 'Cash Flow',
      concepts: ['operating_cf', 'capex', 'depreciation_amortization', 'dividends_paid'],
    },
    {
      label: 'Derived (computed)',
      concepts: ['free_cf = operating_cf − capex', 'ebitda = operating_income + depreciation_amortization'],
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          36 canonical concepts mapped from raw XBRL tags. Use with the <InlineCode>concept</InlineCode> parameter
          on the SEC endpoint, or access them within the <InlineCode>financials</InlineCode> extract.
          You can also pass any raw XBRL tag name directly.
        </p>
      </div>

      {groups.map((g) => (
        <div key={g.label}>
          <h3 className="mb-2 text-sm font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {g.label}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {g.concepts.map((c) => (
              <code key={c} className="rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-700">
                {c}
              </code>
            ))}
          </div>
        </div>
      ))}

      <div>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Usage example
        </h3>
        <CodeBlock>{`# Get just revenue for Apple, last 10 years
curl "http://localhost:8000/v1/sec/AAPL?extract=concepts&concept=revenue&limit=10"

# Get a raw XBRL tag
curl "http://localhost:8000/v1/sec/AAPL?extract=concepts&concept=us-gaap:ResearchAndDevelopmentExpense"`}</CodeBlock>
      </div>
    </div>
  );
}

export function DocsPage() {
  const [tab, setTab] = useState(TABS[0]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Documentation</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        REST API, MCP tools, extract types, and canonical concepts.
      </p>

      <div className="mt-6">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      <div className="mt-6">
        {tab === 'Getting Started' && <GettingStartedSection />}
        {tab === 'API' && <APISection />}
        {tab === 'MCP' && <MCPSection />}
        {tab === 'Extracts' && <ExtractsSection />}
        {tab === 'Concepts' && <ConceptsSection />}
      </div>
    </div>
  );
}
