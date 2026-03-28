import { useState } from 'react';
import { SearchInput } from '../ui/SearchInput';
import { Link } from 'react-router-dom';

/* ── Beta Banner ─────────────────────────────────────────────── */
export function BetaBanner() {
  return (
    <div className="border-b border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40">
      <div className="mx-auto max-w-5xl px-4 py-2.5 text-center text-sm sm:px-6">
        <span className="mr-2 inline-block rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
          BETA
        </span>
        Free for everyone until July 2026. No API key required.
      </div>
    </div>
  );
}

/* ── Waitlist Form ───────────────────────────────────────────── */
export function WaitlistForm({ dark = false }: { dark?: boolean }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email.');
      return;
    }
    try {
      const res = await fetch('/v1/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const existing = JSON.parse(localStorage.getItem('eugene_waitlist') || '[]');
        existing.push({ email, ts: new Date().toISOString() });
        localStorage.setItem('eugene_waitlist', JSON.stringify(existing));
        setSubmitted(true);
      }
    } catch {
      const existing = JSON.parse(localStorage.getItem('eugene_waitlist') || '[]');
      existing.push({ email, ts: new Date().toISOString() });
      localStorage.setItem('eugene_waitlist', JSON.stringify(existing));
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <p className={`text-sm font-medium ${dark ? 'text-emerald-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
        You're on the list. We'll notify you when paid tiers launch.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-slate-400 dark:focus:ring-slate-400"
      />
      <button
        type="submit"
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
      >
        Join waitlist
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  );
}

/* ── Hero ────────────────────────────────────────────────────── */
export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-20 sm:px-6 sm:pt-28">
      {/* Subtle gradient background */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-slate-50 via-white to-white dark:from-slate-900/50 dark:via-slate-950 dark:to-slate-950" />
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
          Financial data infrastructure
          <br />
          <span className="text-slate-400 dark:text-slate-500">for AI agents and analysts</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
          One API call gets you normalized SEC financials, insider trades, institutional holdings,
          economic indicators, and market data — all with full provenance tracking.
        </p>

        <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            to="/docs"
            className="w-full rounded-md bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 sm:w-auto"
          >
            Get started free
          </Link>
          <Link
            to="/company/AAPL"
            className="w-full rounded-md border border-slate-300 px-6 py-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 sm:w-auto"
          >
            See it live — AAPL
          </Link>
        </div>

        <div className="mx-auto mt-6 max-w-sm">
          <SearchInput large />
        </div>

        <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
          pip install eugene-intelligence &middot; No API key needed during beta
        </p>
      </div>
    </section>
  );
}

/* ── Data Sources ────────────────────────────────────────────── */
export function DataSources() {
  const sources = ['SEC EDGAR', 'XBRL', 'FRED', 'Form 4', 'Form 13F', '10-K / 10-Q'];
  return (
    <section className="border-y border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Built on authoritative data sources
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {sources.map((s) => (
            <span key={s} className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Stats Bar ───────────────────────────────────────────────── */
export function StatsBar() {
  const stats = [
    { value: '19', label: 'Data extracts' },
    { value: '50+', label: 'Financial ratios' },
    { value: '10K+', label: 'Public companies' },
    { value: '3', label: 'Protocols (REST, MCP, CLI)' },
  ];
  return (
    <section className="px-4 py-16 sm:px-6">
      <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{s.value}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Interactive Code Tabs ───────────────────────────────────── */
export function CodeShowcase() {
  const [tab, setTab] = useState<'cli' | 'api' | 'mcp'>('cli');

  const snippets = {
    cli: `$ eugene sec AAPL -e financials,metrics,insiders

┌ Apple Inc. (AAPL) ─────────────────────────────────┐
│ Revenue         $394.3B    Net Income    $97.0B     │
│ Gross Margin     46.2%     ROE           160.6%     │
│ Debt/Equity       1.87     Current Ratio   0.99     │
├────────────────────────────────────────────────────┤
│ Latest Insider: Deirdre O'Brien sold 50K shares    │
│ Source: SEC EDGAR Form 4 (2025-11-15)              │
└────────────────────────────────────────────────────┘`,
    api: `GET /v1/sec/AAPL?extract=financials&period=FY&limit=3

{
  "status": "success",
  "resolved": { "ticker": "AAPL", "company": "Apple Inc." },
  "data": {
    "periods": [{
      "period": "FY2024",
      "income_statement": {
        "revenue": 394328000000,
        "net_income": 97000000000,
        "eps_diluted": 6.42
      }
    }]
  },
  "provenance": [{ "source": "SEC EDGAR XBRL", "url": "..." }]
}`,
    mcp: `// Claude Desktop / Cursor / Windsurf
// Add to claude_desktop_config.json:

{
  "mcpServers": {
    "eugene": {
      "command": "eugene",
      "args": ["mcp"]
    }
  }
}

// Then ask Claude:
// "What are Apple's latest insider trades?"
// "Compare MSFT and GOOGL gross margins"
// "Show me the latest CPI data from FRED"`,
  };

  return (
    <section className="border-t border-slate-200 px-4 py-20 dark:border-slate-800 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Three ways to access your data
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            CLI for exploration. REST API for production. MCP for AI agents.
          </p>
        </div>

        <div className="mt-10">
          <div className="flex justify-center gap-1">
            {(['cli', 'api', 'mcp'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-t-md px-5 py-2 text-sm font-medium transition-colors ${
                  tab === t
                    ? 'bg-slate-900 text-white dark:bg-slate-700'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="overflow-hidden rounded-b-lg rounded-tr-lg border border-slate-200 bg-slate-950 dark:border-slate-700">
            <pre className="overflow-x-auto p-6 text-sm leading-relaxed text-slate-300">
              <code>{snippets[tab]}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Feature Showcase (Tabbed) ───────────────────────────────── */
export function FeatureShowcase() {
  const [active, setActive] = useState(0);

  const features = [
    {
      title: 'Financial Statements',
      subtitle: 'Normalized from raw XBRL',
      desc: 'Income statement, balance sheet, and cash flow — standardized across 10,000+ companies. Annual or quarterly, with 36 canonical XBRL concepts mapped consistently.',
      example: 'GET /v1/sec/MSFT?extract=financials&period=FY',
    },
    {
      title: 'Insider & Institutional',
      subtitle: 'Parsed directly from EDGAR',
      desc: 'Form 4 insider transactions with transaction type, shares, and price. 13F institutional holdings showing who owns what. All linked to source filings.',
      example: 'GET /v1/sec/TSLA?extract=insiders',
    },
    {
      title: 'Market Data & Technicals',
      subtitle: 'Prices, OHLCV, and indicators',
      desc: 'Real-time quotes, historical OHLCV, technical indicators (SMA, RSI, MACD), and a stock screener with sector, market cap, and beta filters.',
      example: 'GET /v1/sec/NVDA?extract=technicals',
    },
    {
      title: 'Economic Indicators',
      subtitle: '9 FRED categories',
      desc: 'CPI, unemployment, GDP, housing starts, interest rates, money supply, and more. Full time series history from the Federal Reserve.',
      example: 'GET /v1/economics/inflation',
    },
    {
      title: 'Filing Text Extraction',
      subtitle: 'MD&A, Risk Factors, Business',
      desc: 'Extract prose sections from 10-K and 10-Q filings. Read the actual management discussion, risk disclosures, and business descriptions.',
      example: 'GET /v1/sec/AMZN?extract=sections&section=mdna',
    },
    {
      title: 'Full Provenance',
      subtitle: 'Every number traced to source',
      desc: 'Every API response includes source URLs pointing to the exact SEC filing or data source. Verify any number against the original document.',
      example: 'All responses include provenance[]',
    },
  ];

  return (
    <section className="border-t border-slate-200 bg-slate-50/50 px-4 py-20 dark:border-slate-800 dark:bg-slate-900/30 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Capabilities
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Everything you need from SEC filings to market data
          </h2>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-5">
          {/* Feature list */}
          <div className="space-y-1 lg:col-span-2">
            {features.map((f, i) => (
              <button
                key={f.title}
                onClick={() => setActive(i)}
                className={`w-full rounded-lg px-4 py-3 text-left transition-colors ${
                  active === i
                    ? 'bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700'
                    : 'hover:bg-white/60 dark:hover:bg-slate-800/50'
                }`}
              >
                <p className={`text-sm font-semibold ${active === i ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                  {f.title}
                </p>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{f.subtitle}</p>
              </button>
            ))}
          </div>

          {/* Feature detail */}
          <div className="lg:col-span-3">
            <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
              <h3 className="text-lg font-semibold">{features[active].title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {features[active].desc}
              </p>
              <div className="mt-4 rounded-md bg-slate-950 px-4 py-3">
                <code className="text-xs text-emerald-400">{features[active].example}</code>
              </div>
              <Link
                to="/docs"
                className="mt-4 inline-block text-sm font-medium text-slate-900 hover:underline dark:text-white"
              >
                View documentation →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Use Cases ───────────────────────────────────────────────── */
export function UseCases() {
  const cases = [
    {
      title: 'AI Agents',
      desc: 'Give your LLM agent real-time access to SEC filings, financial metrics, and economic data through MCP. Works with Claude, GPT, and any MCP-compatible client.',
      icon: '→',
    },
    {
      title: 'Quantitative Research',
      desc: 'Pull normalized financials across thousands of companies. Screen by sector, market cap, and ratios. Export to CSV or Parquet for your models.',
      icon: '→',
    },
    {
      title: 'Investment Analysis',
      desc: 'Company profiles, insider trades, institutional holdings, and filing text in one place. Every data point links back to the SEC source.',
      icon: '→',
    },
  ];

  return (
    <section className="border-t border-slate-200 px-4 py-20 dark:border-slate-800 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Built for builders and analysts</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Whether you're building an AI agent, running a quant screen, or doing fundamental research.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {cases.map((c) => (
            <div
              key={c.title}
              className="rounded-lg border border-slate-200 p-6 transition-colors hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
            >
              <h3 className="font-semibold">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Bottom CTA ──────────────────────────────────────────────── */
export function BottomCTA() {
  return (
    <section className="border-t border-slate-200 bg-slate-900 px-4 py-20 dark:border-slate-800 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Start building with financial data
        </h2>
        <p className="mt-3 text-slate-400">
          Free during beta. No API key required. Install in 30 seconds.
        </p>
        <div className="mx-auto mt-6 max-w-sm rounded-md border border-slate-700 bg-slate-800 px-4 py-3">
          <code className="text-sm text-emerald-400">pip install eugene-intelligence</code>
        </div>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/docs"
            className="w-full rounded-md bg-white px-6 py-3 text-sm font-medium text-slate-900 hover:bg-slate-100 sm:w-auto"
          >
            Read the docs
          </Link>
          <Link
            to="/pricing"
            className="w-full rounded-md border border-slate-600 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800 sm:w-auto"
          >
            View pricing
          </Link>
        </div>
        <div className="mt-8 max-w-sm mx-auto">
          <p className="mb-2 text-sm text-slate-400">Get notified when paid tiers launch:</p>
          <WaitlistForm dark />
        </div>
      </div>
    </section>
  );
}
