import { useState, useEffect } from 'react';
import { SearchInput } from '../ui/SearchInput';
import { Link, useNavigate } from 'react-router-dom';
import { fetchSEC } from '../../lib/api';
import {
  Search,
  Brain,
  Swords,
  Drama,
  ArrowRight,
  Globe,
  Shield,
  Ship,
  TrendingUp,
  Database,
  Zap,
} from 'lucide-react';

/* -- Beta Banner --------------------------------------------------------- */
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

/* -- Waitlist Form ------------------------------------------------------- */
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

/* -- Hero ---------------------------------------------------------------- */
export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-20 sm:px-6 sm:pt-28">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-slate-50 via-white to-white dark:from-slate-900/50 dark:via-slate-950 dark:to-slate-950" />
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
          Data and context
          <br />
          <span className="text-slate-400 dark:text-slate-500">infrastructure.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
          Financials, insider trades, world events, sanctions, supply chains, credit markets —
          all in one place. Use it yourself or plug it into your tools.
        </p>

        <div className="mx-auto mt-8 max-w-lg">
          <SearchInput large />
        </div>

        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Try <Link to="/company/AAPL" className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900 dark:text-slate-300 dark:decoration-slate-600 dark:hover:text-white">AAPL</Link>,{' '}
          <Link to="/company/NVDA" className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900 dark:text-slate-300 dark:decoration-slate-600 dark:hover:text-white">NVDA</Link>,{' '}
          or <Link to="/company/TSLA" className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900 dark:text-slate-300 dark:decoration-slate-600 dark:hover:text-white">TSLA</Link>
          {' '}&middot; No signup required
        </p>
      </div>
    </section>
  );
}

/* -- Live Demo Section --------------------------------------------------- */

interface CompanyProfile {
  company_name?: string;
  ticker?: string;
  sector?: string;
  industry?: string;
  market_cap?: number;
  description?: string;
}

interface CompanyMetrics {
  market_cap?: number;
  price?: number;
  pe_ratio?: number;
  dividend_yield?: number;
  revenue_ttm?: number;
  net_income_ttm?: number;
  gross_margin?: number;
  roe?: number;
  beta?: number;
}

const FALLBACK_PROFILE: CompanyProfile = {
  company_name: 'Apple Inc.',
  ticker: 'AAPL',
  sector: 'Technology',
  industry: 'Consumer Electronics',
};

const FALLBACK_METRICS: CompanyMetrics = {
  market_cap: 3540000000000,
  price: 232.47,
  pe_ratio: 37.8,
  revenue_ttm: 394328000000,
  gross_margin: 0.462,
  roe: 1.606,
  beta: 1.24,
};

function formatLargeNumber(n: number | undefined): string {
  if (n === undefined || n === null) return '--';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

function formatPercent(n: number | undefined): string {
  if (n === undefined || n === null) return '--';
  const pct = Math.abs(n) < 1 ? n * 100 : n;
  return `${pct.toFixed(1)}%`;
}

export function LiveDemo() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [metrics, setMetrics] = useState<CompanyMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tryTicker, setTryTicker] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [profileRes, metricsRes] = await Promise.all([
          fetchSEC<any>('AAPL', new URLSearchParams({ extract: 'profile' })),
          fetchSEC<any>('AAPL', new URLSearchParams({ extract: 'metrics' })),
        ]);
        if (cancelled) return;
        setProfile(profileRes?.data || profileRes);
        setMetrics(metricsRes?.data || metricsRes);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const p = error || !profile ? FALLBACK_PROFILE : profile;
  const m = error || !metrics ? FALLBACK_METRICS : metrics;

  const metricItems = [
    { label: 'Price', value: m.price ? `$${m.price.toFixed(2)}` : '--' },
    { label: 'Market Cap', value: formatLargeNumber(m.market_cap) },
    { label: 'P/E Ratio', value: m.pe_ratio ? m.pe_ratio.toFixed(1) : '--' },
    { label: 'Revenue (TTM)', value: formatLargeNumber(m.revenue_ttm) },
    { label: 'Gross Margin', value: formatPercent(m.gross_margin) },
    { label: 'ROE', value: formatPercent(m.roe) },
  ];

  const handleTryIt = (e: React.FormEvent) => {
    e.preventDefault();
    const ticker = tryTicker.trim().toUpperCase();
    if (ticker) navigate(`/company/${ticker}`);
  };

  return (
    <section className="border-t border-slate-200 px-4 py-20 dark:border-slate-800 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Live data
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            This is real data, loading right now
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Not a mockup. This is Apple's actual data pulled from our API when you opened this page.
          </p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    {loading ? (
                      <div className="h-6 w-40 rounded bg-slate-200 dark:bg-slate-700" />
                    ) : (
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {p.company_name || 'Apple Inc.'}
                        <span className="ml-2 text-sm font-normal text-slate-400">
                          {p.ticker || 'AAPL'}
                        </span>
                      </h3>
                    )}
                    {!loading && (
                      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                        {p.sector}{p.industry ? ` / ${p.industry}` : ''}
                      </p>
                    )}
                  </div>
                  {error && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      Static fallback
                    </span>
                  )}
                  {!error && !loading && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Live
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-px bg-slate-100 dark:bg-slate-700 sm:grid-cols-3">
                {metricItems.map((item) => (
                  <div key={item.label} className="bg-white px-4 py-3.5 dark:bg-slate-800">
                    {loading ? (
                      <>
                        <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-700" />
                        <div className="mt-2 h-5 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                          {item.value}
                        </p>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 px-6 py-3 dark:border-slate-700">
                <Link
                  to="/company/AAPL"
                  className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  View full AAPL profile <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center lg:col-span-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-900/50">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Try any ticker
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Type any ticker. See what the company looks like, what insiders are doing, and what's happening around it.
              </p>
              <form onSubmit={handleTryIt} className="mt-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={tryTicker}
                      onChange={(e) => setTryTicker(e.target.value)}
                      placeholder="MSFT, GOOGL, TSLA..."
                      className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-slate-400 dark:focus:ring-slate-400"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  >
                    Go
                  </button>
                </div>
              </form>
              <div className="mt-4 flex flex-wrap gap-2">
                {['NVDA', 'MSFT', 'GOOGL', 'TSLA', 'META'].map((t) => (
                  <Link
                    key={t}
                    to={`/company/${t}`}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600"
                  >
                    {t}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -- AI Capabilities ----------------------------------------------------- */
export function AICapabilities() {
  const capabilities = [
    {
      icon: Brain,
      title: 'Research Brief',
      tagline: 'Reads 7 sources, writes you a summary',
      desc: 'Financials, insider trades, holdings, market data, filings, world events, news — it reads all of it and gives you a brief you can actually use. Takes about 30 seconds.',
    },
    {
      icon: Swords,
      title: 'Bull vs Bear',
      tagline: 'The case for and against',
      desc: 'One side argues buy, the other argues sell. Both use real numbers. A third voice synthesizes. You read it and decide. Better than reading 50 pages of filings yourself.',
    },
    {
      icon: Drama,
      title: 'Investor Panel',
      tagline: '5 perspectives on one stock',
      desc: 'A value investor, growth hunter, momentum trader, contrarian, and macro strategist each give their take. When they agree, pay attention. When they don\'t, that\'s interesting too.',
    },
  ];

  return (
    <section className="border-t border-slate-200 bg-slate-50/50 px-4 py-20 dark:border-slate-800 dark:bg-slate-900/30 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Research tools
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Let the machine do the reading
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            There's too much data to read yourself. These tools pull it together and tell you what matters.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {capabilities.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.title}
                className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                  <Icon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{c.title}</h3>
                <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {c.tagline}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {c.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* -- How It Works -------------------------------------------------------- */
export function HowItWorks() {
  const steps = [
    {
      number: '1',
      title: 'Search a company',
      desc: 'Type a ticker. You get financials, insider trades, institutional holdings, filings, news, and whatever\'s happening in the world around that company.',
    },
    {
      number: '2',
      title: 'Browse world data',
      desc: 'Or skip the ticker and go straight to world events — sanctions lists, conflict zones, port congestion, shipping routes, credit markets, economic indicators.',
    },
    {
      number: '3',
      title: 'Get a brief',
      desc: 'Hit one button and get a written research brief, a bull-vs-bear debate, or a multi-perspective analysis. Email it, export it, or feed it to your own tools.',
    },
  ];

  return (
    <section className="border-t border-slate-200 px-4 py-20 dark:border-slate-800 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            How it works
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            It's not complicated.
          </p>
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {steps.map((s) => (
              <div key={s.number} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-lg font-bold text-white dark:bg-white dark:text-slate-900">
                  {s.number}
                </div>
                <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {s.desc}
                </p>
              </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            to="/company/AAPL"
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Try it now — it's free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* -- Data Sources -------------------------------------------------------- */
export function DataSources() {
  const sources = [
    'SEC EDGAR',
    'FRED',
    'GDELT',
    'USGS',
    'NOAA',
    'OFAC',
    'UCDP',
    'OpenSky',
    'UN Comtrade',
    'AIS',
  ];
  return (
    <section className="border-y border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Data sources
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

/* -- Stats Bar ----------------------------------------------------------- */
export function StatsBar() {
  const stats = [
    { value: '10K+', label: 'Companies' },
    { value: '19', label: 'Data types' },
    { value: '7', label: 'World categories' },
    { value: '3', label: 'Ways to connect' },
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

/* -- Interactive Code Tabs ----------------------------------------------- */
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
    api: `GET /v1/world/convergence/dashboard?window=24h

{
  "entities_tracked": 847,
  "active_signals": 2341,
  "signal_types": 12,
  "alerts": [{
    "entity_id": "TSMC",
    "risk_score": 0.87,
    "signals": ["supply_chain", "conflict", "sanctions"],
    "pattern": "supply_chain_disruption"
  }],
  "risk_distribution": { "critical": 3, "high": 12, ... }
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
// "What geopolitical risks affect TSMC's supply chain?"
// "Screen Gazprom against OFAC sanctions"
// "Show me the convergence dashboard for the last 7 days"`,
  };

  return (
    <section className="border-t border-slate-200 px-4 py-20 dark:border-slate-800 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Use it however you want
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Terminal, API, or plug it straight into Claude, ChatGPT, or Cursor.
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

/* -- Feature Showcase (Tabbed) ------------------------------------------- */
export function FeatureShowcase() {
  const [active, setActive] = useState(0);

  const features = [
    {
      icon: Database,
      title: 'Company Data',
      subtitle: 'Financials, insiders, who owns what',
      desc: 'Revenue, profits, balance sheets, insider trades, institutional holdings, and 50+ ratios for 10,000+ public companies. Every number links back to its SEC filing.',
      example: 'GET /v1/sec/MSFT?extract=financials&period=FY',
    },
    {
      icon: Globe,
      title: 'World Events',
      subtitle: 'News, conflicts, disasters',
      desc: 'What\'s happening in the world that affects markets — geopolitical events, armed conflicts, natural disasters, and breaking news, updated every 15 minutes.',
      example: 'GET /v1/world/news?topic=geopolitics',
    },
    {
      icon: Ship,
      title: 'Supply Chains',
      subtitle: 'Ports, shipping, trade flows',
      desc: 'Track goods moving around the world — 15 major ports, 8 critical shipping chokepoints, international trade data, and vessel tracking. See where disruptions are building.',
      example: 'GET /v1/world/supply-chain/routes',
    },
    {
      icon: Shield,
      title: 'Sanctions & Regulation',
      subtitle: 'Who\'s on the list, what\'s changing',
      desc: 'Check any company or person against US, EU, and UN sanctions lists. Track new regulations and see which companies are exposed to compliance risk.',
      example: 'GET /v1/world/sanctions/screen?name=Gazprom',
    },
    {
      icon: TrendingUp,
      title: 'Private Credit',
      subtitle: 'The $1.7T market, tracked',
      desc: 'The private credit market is opaque — we make it visible. 12 major BDCs, credit spreads across 6 risk tiers, and stress indicators that show when trouble is brewing.',
      example: 'GET /v1/world/private-credit',
    },
    {
      icon: Zap,
      title: 'Connected Alerts',
      subtitle: 'When signals line up, you know first',
      desc: 'The real edge is seeing when separate events point to the same thing — earnings risk meets supply chain trouble meets sanctions exposure. We detect these patterns automatically.',
      example: 'GET /v1/world/convergence/alerts?window=24h',
    },
  ];

  return (
    <section className="border-t border-slate-200 bg-slate-50/50 px-4 py-20 dark:border-slate-800 dark:bg-slate-900/30 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
            What's in it
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Six types of data, one place to find them
          </h2>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-5">
          <div className="space-y-1 lg:col-span-2">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.title}
                  onClick={() => setActive(i)}
                  className={`w-full rounded-lg px-4 py-3 text-left transition-colors ${
                    active === i
                      ? 'bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700'
                      : 'hover:bg-white/60 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`h-4 w-4 ${active === i ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`} />
                    <p className={`text-sm font-semibold ${active === i ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                      {f.title}
                    </p>
                  </div>
                  <p className="mt-0.5 pl-6.5 text-xs text-slate-400 dark:text-slate-500">{f.subtitle}</p>
                </button>
              );
            })}
          </div>

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

/* -- Use Cases ----------------------------------------------------------- */
export function UseCases() {
  const cases = [
    {
      title: 'You build AI tools',
      desc: 'Your agent needs to know about companies, markets, and the world. Connect it to Eugene and it has real data to work with instead of making things up.',
    },
    {
      title: 'You work in finance',
      desc: 'Stop switching between 12 tabs. Company data, insider activity, sanctions checks, world events, credit markets — it\'s all here. Generate a brief, email it to your team, move on.',
    },
    {
      title: 'You write code',
      desc: 'REST API, MCP server, command line, CSV export. Clean data, good docs, no weird auth flows. pip install and go.',
    },
  ];

  return (
    <section className="border-t border-slate-200 px-4 py-20 dark:border-slate-800 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Who this is for</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Different people use it differently. That's the point.
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

/* -- Bottom CTA ---------------------------------------------------------- */
export function BottomCTA() {
  return (
    <section className="border-t border-slate-200 bg-slate-900 px-4 py-20 dark:border-slate-800 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Get started — it's free
        </h2>
        <p className="mt-3 text-slate-400">
          No signup, no credit card, no API key. Just install and go.
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
