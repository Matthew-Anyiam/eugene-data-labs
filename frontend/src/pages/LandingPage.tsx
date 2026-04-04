import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Zap,
  Search,
  ArrowRight,
  Brain,
  Activity,
  Layout,
  Database,
  Shield,
  BarChart3,
  FileText,
  Users,
  Bot,
  TrendingUp,
  Globe,
} from 'lucide-react';
import { eugeneApi } from '../lib/api';

/* ---------- types for live data ---------- */
interface ProfileData {
  company_name?: string;
  ticker?: string;
  market_cap?: number;
  sector?: string;
  industry?: string;
}

interface PriceData {
  price?: number;
  change?: number;
  change_percent?: number;
  previous_close?: number;
}

/* ---------- helper ---------- */
function formatLargeNumber(n: number | undefined): string {
  if (n == null) return '--';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

/* ---------- sub-components ---------- */

function HeroSearch({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const ticker = query.trim().toUpperCase();
    if (ticker) navigate(`/company/${ticker}`);
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="relative mx-auto max-w-xl">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter a ticker... AAPL, TSLA, MSFT"
          className="w-full rounded-xl border border-slate-700/50 bg-slate-900/80 py-3.5 pl-12 pr-28 text-sm text-white placeholder-slate-500 backdrop-blur-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          Search
        </button>
      </div>
    </form>
  );
}

function LiveProofCard() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [price, setPrice] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [prof, pr] = await Promise.all([
          eugeneApi<any>('/v1/sec/AAPL', { extract: 'profile' }),
          eugeneApi<any>('/v1/sec/AAPL/prices'),
        ]);
        if (cancelled) return;
        // The profile response may be nested
        const p = prof?.profile ?? prof;
        setProfile(p);
        // Price may be nested
        const px = pr?.price ? pr : pr?.prices?.[0] ?? pr;
        setPrice(px);
      } catch {
        // silently fail — landing page should still render
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex h-44 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-900/60">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
      </div>
    );
  }

  const changePercent = price?.change_percent ?? 0;
  const isPositive = changePercent >= 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900/80 to-slate-800/40 p-6 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-lg font-bold text-white">

          </div>
          <div>
            <div className="text-lg font-semibold text-white">{profile?.ticker ?? 'AAPL'}</div>
            <div className="text-xs text-slate-400">{profile?.company_name ?? 'Apple Inc.'}</div>
          </div>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400">
          LIVE
        </span>
      </div>

      <div className="mb-4 flex items-end gap-3">
        <span className="text-3xl font-bold text-white">
          {price?.price != null ? `$${price.price.toFixed(2)}` : '--'}
        </span>
        <span className={`text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}
          {price?.change != null ? price.change.toFixed(2) : '--'}{' '}
          ({isPositive ? '+' : ''}
          {changePercent.toFixed(2)}%)
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-slate-500">Market Cap</span>
          <div className="font-medium text-slate-300">{formatLargeNumber(profile?.market_cap)}</div>
        </div>
        <div>
          <span className="text-slate-500">Sector</span>
          <div className="font-medium text-slate-300">{profile?.sector ?? '--'}</div>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-700/50 pt-3">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <Database className="h-3 w-3" />
          Live from SEC EDGAR + Yahoo Finance
        </div>
      </div>
    </div>
  );
}

/* ---------- data ---------- */

const PILLARS = [
  {
    icon: Brain,
    title: 'Intelligence Engine',
    desc: 'Cross-signal convergence scoring. Entity graph. Pattern detection across SEC filings, market data, macro indicators, and global events.',
  },
  {
    icon: Activity,
    title: 'Real-Time Markets',
    desc: '78 live data pages. Insider tracking. Earnings analysis. Technical signals. Options flow. All powered by SEC EDGAR, FRED, and market feeds.',
  },
  {
    icon: Layout,
    title: 'Workspace',
    desc: 'Not just dashboards. A composable workspace where you research, analyze, compare, backtest, and build conviction.',
  },
];

const FEATURES = [
  { icon: FileText, title: 'SEC EDGAR Intelligence', desc: '16 extract types from every public filing' },
  { icon: BarChart3, title: 'Market Analytics', desc: 'Screeners, heatmaps, sector rotation, breadth' },
  { icon: TrendingUp, title: 'Earnings Intelligence', desc: 'Transcripts with NLP sentiment, surprise tracking' },
  { icon: Users, title: 'Insider Tracking', desc: 'Form 4 filings, cluster analysis, conviction scoring' },
  { icon: Globe, title: 'Macro & Economics', desc: 'FRED data, yield curves, economic calendar' },
  { icon: Bot, title: 'AI Agents', desc: 'Research briefs, bull/bear debates, scenario simulation' },
  { icon: Shield, title: 'Risk Analytics', desc: 'VaR, drawdown, correlation matrices, factor exposure' },
  { icon: Database, title: 'API & MCP', desc: 'REST API + Model Context Protocol for AI integration' },
];

const DATA_SOURCES = [
  'SEC EDGAR',
  'FRED',
  'Yahoo Finance',
  'GDELT',
  'Polymarket',
  'USGS',
  'OpenSky',
  'UN Comtrade',
];

/* ---------- main component ---------- */

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Animated grid background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div className="absolute -left-1/4 -top-1/4 h-[800px] w-[800px] rounded-full bg-indigo-500/5 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[600px] w-[600px] rounded-full bg-violet-500/5 blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* ===== HERO ===== */}
        <section className="px-4 pb-20 pt-16 sm:px-6 md:pb-28 md:pt-24">
          <div className="mx-auto max-w-4xl text-center">
            {/* Logo */}
            <div className="mb-8 flex items-center justify-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-semibold tracking-tight text-white">Eugene Intelligence</span>
            </div>

            <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
              The Financial Knowledge
              <br />
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Workspace
              </span>
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-base text-slate-400 sm:text-lg">
              Deep intelligence. Real-time data. Composable workspace.
              <br className="hidden sm:block" />
              Where financial professionals think.
            </p>

            {/* Primary CTA — search */}
            <HeroSearch className="mb-6" />

            {/* Secondary CTA */}
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-400 transition-colors hover:text-indigo-300"
            >
              Explore Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* ===== LIVE DATA PROOF ===== */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 text-center">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-indigo-400">
                Live Data
              </h2>
              <p className="text-xl font-semibold text-white sm:text-2xl">
                Real data. Not mockups.
              </p>
            </div>
            <div className="mx-auto max-w-md">
              <LiveProofCard />
            </div>
          </div>
        </section>

        {/* ===== PLATFORM PILLARS ===== */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-6 md:grid-cols-3">
              {PILLARS.map((p) => (
                <div
                  key={p.title}
                  className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition-colors hover:border-slate-700"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/10">
                    <p.icon className="h-5 w-5 text-indigo-400" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-white">{p.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== FEATURE GRID ===== */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 text-center">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-indigo-400">
                Capabilities
              </h2>
              <p className="text-xl font-semibold text-white sm:text-2xl">
                Everything you need, nothing you don&apos;t
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 transition-colors hover:border-slate-700"
                >
                  <f.icon className="mb-3 h-5 w-5 text-indigo-400" />
                  <h3 className="mb-1 text-sm font-semibold text-white">{f.title}</h3>
                  <p className="text-xs leading-relaxed text-slate-500">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== DATA SOURCES STRIP ===== */}
        <section className="border-y border-slate-800/50 px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <p className="mb-5 text-center text-xs font-medium uppercase tracking-wider text-slate-600">
              Powered by
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {DATA_SOURCES.map((src) => (
                <span
                  key={src}
                  className="rounded-full border border-slate-800 bg-slate-900/60 px-3.5 py-1.5 text-xs font-medium text-slate-400"
                >
                  {src}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ===== BOTTOM CTA ===== */}
        <section className="px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="mb-3 text-2xl font-bold text-white sm:text-3xl">Start exploring</h2>
            <p className="mb-8 text-sm text-slate-400">
              78 intelligence pages. 100+ API endpoints. 89 MCP tools.
            </p>

            <HeroSearch className="mb-8" />

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/dashboard"
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
              >
                Dashboard
              </Link>
              <Link
                to="/docs"
                className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
              >
                API Docs
              </Link>
              <Link
                to="/pricing"
                className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
              >
                Pricing
              </Link>
            </div>
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer className="border-t border-slate-800/50 px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-xs text-slate-600">
              Eugene Intelligence &copy; 2024. Built for financial professionals.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default LandingPage;
