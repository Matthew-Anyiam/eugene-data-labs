import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Flame,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  LayoutGrid,
  List,
  Filter,
} from 'lucide-react';
import { cn, formatPrice, formatPercent } from '../lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Stock {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  sector: string;
}

type Tab = 'gainers' | 'losers' | 'active';
type TimeRange = 'today' | '1w' | '1m';
type ViewMode = 'grid' | 'list';

const SECTORS = [
  'All Sectors',
  'Technology',
  'Healthcare',
  'Finance',
  'Energy',
  'Consumer',
  'Industrial',
] as const;

const TABS: { key: Tab; label: string; icon: typeof TrendingUp }[] = [
  { key: 'gainers', label: 'Top Gainers', icon: TrendingUp },
  { key: 'losers', label: 'Top Losers', icon: TrendingDown },
  { key: 'active', label: 'Most Active', icon: Activity },
];

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '1w', label: '1W' },
  { key: '1m', label: '1M' },
];

/* ------------------------------------------------------------------ */
/*  Deterministic mock-data generator                                  */
/* ------------------------------------------------------------------ */

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function dateSeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

const MOCK_COMPANIES: { ticker: string; name: string; sector: string }[] = [
  { ticker: 'NVDA', name: 'NVIDIA Corp', sector: 'Technology' },
  { ticker: 'AAPL', name: 'Apple Inc', sector: 'Technology' },
  { ticker: 'MSFT', name: 'Microsoft Corp', sector: 'Technology' },
  { ticker: 'GOOG', name: 'Alphabet Inc', sector: 'Technology' },
  { ticker: 'META', name: 'Meta Platforms', sector: 'Technology' },
  { ticker: 'TSLA', name: 'Tesla Inc', sector: 'Technology' },
  { ticker: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology' },
  { ticker: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
  { ticker: 'UNH', name: 'UnitedHealth Group', sector: 'Healthcare' },
  { ticker: 'PFE', name: 'Pfizer Inc', sector: 'Healthcare' },
  { ticker: 'ABBV', name: 'AbbVie Inc', sector: 'Healthcare' },
  { ticker: 'MRK', name: 'Merck & Co', sector: 'Healthcare' },
  { ticker: 'LLY', name: 'Eli Lilly & Co', sector: 'Healthcare' },
  { ticker: 'JPM', name: 'JPMorgan Chase', sector: 'Finance' },
  { ticker: 'BAC', name: 'Bank of America', sector: 'Finance' },
  { ticker: 'GS', name: 'Goldman Sachs', sector: 'Finance' },
  { ticker: 'MS', name: 'Morgan Stanley', sector: 'Finance' },
  { ticker: 'WFC', name: 'Wells Fargo', sector: 'Finance' },
  { ticker: 'V', name: 'Visa Inc', sector: 'Finance' },
  { ticker: 'XOM', name: 'Exxon Mobil', sector: 'Energy' },
  { ticker: 'CVX', name: 'Chevron Corp', sector: 'Energy' },
  { ticker: 'COP', name: 'ConocoPhillips', sector: 'Energy' },
  { ticker: 'SLB', name: 'Schlumberger', sector: 'Energy' },
  { ticker: 'EOG', name: 'EOG Resources', sector: 'Energy' },
  { ticker: 'AMZN', name: 'Amazon.com Inc', sector: 'Consumer' },
  { ticker: 'WMT', name: 'Walmart Inc', sector: 'Consumer' },
  { ticker: 'HD', name: 'Home Depot', sector: 'Consumer' },
  { ticker: 'NKE', name: 'Nike Inc', sector: 'Consumer' },
  { ticker: 'SBUX', name: 'Starbucks Corp', sector: 'Consumer' },
  { ticker: 'MCD', name: "McDonald's Corp", sector: 'Consumer' },
  { ticker: 'CAT', name: 'Caterpillar Inc', sector: 'Industrial' },
  { ticker: 'GE', name: 'GE Aerospace', sector: 'Industrial' },
  { ticker: 'HON', name: 'Honeywell Intl', sector: 'Industrial' },
  { ticker: 'UPS', name: 'United Parcel Service', sector: 'Industrial' },
  { ticker: 'RTX', name: 'RTX Corp', sector: 'Industrial' },
  { ticker: 'DE', name: 'Deere & Company', sector: 'Industrial' },
];

function generateMockData(range: TimeRange): {
  gainers: Stock[];
  losers: Stock[];
  active: Stock[];
} {
  const rangeMultiplier = range === '1m' ? 2.5 : range === '1w' ? 1.5 : 1;
  const rand = seededRandom(dateSeed() + (range === '1w' ? 1 : range === '1m' ? 2 : 0));

  const all: Stock[] = MOCK_COMPANIES.map((c) => {
    const basePrice = 50 + rand() * 450;
    const changePct = (rand() - 0.45) * 30 * rangeMultiplier;
    const change = basePrice * (changePct / 100);
    const vol = Math.round((10 + rand() * 490) * 1_000_000);
    return {
      ticker: c.ticker,
      name: c.name,
      price: Math.round((basePrice + change) * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePct * 100) / 100,
      volume: vol,
      sector: c.sector,
    };
  });

  const gainers = all
    .filter((s) => s.changePercent > 0)
    .sort((a, b) => b.changePercent - a.changePercent)
    .map((s) => ({
      ...s,
      changePercent: Math.min(s.changePercent, 25),
      change: Math.abs(s.change),
    }));

  const losers = all
    .filter((s) => s.changePercent < 0)
    .sort((a, b) => a.changePercent - b.changePercent)
    .map((s) => ({
      ...s,
      changePercent: Math.max(s.changePercent, -20),
      change: -Math.abs(s.change),
    }));

  const active = [...all].sort((a, b) => b.volume - a.volume);

  return { gainers, losers, active };
}

/* ------------------------------------------------------------------ */
/*  Formatting helpers                                                 */
/* ------------------------------------------------------------------ */

function fmtVolume(v: number): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + 'B';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return v.toString();
}

function sectorColor(sector: string): string {
  const map: Record<string, string> = {
    Technology: 'bg-blue-500/20 text-blue-400',
    Healthcare: 'bg-emerald-500/20 text-emerald-400',
    Finance: 'bg-amber-500/20 text-amber-400',
    Energy: 'bg-orange-500/20 text-orange-400',
    Consumer: 'bg-purple-500/20 text-purple-400',
    Industrial: 'bg-cyan-500/20 text-cyan-400',
  };
  return map[sector] ?? 'bg-slate-500/20 text-slate-400';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MoversPage() {
  const [tab, setTab] = useState<Tab>('gainers');
  const [range, setRange] = useState<TimeRange>('today');
  const [view, setView] = useState<ViewMode>('list');
  const [sectorFilter, setSectorFilter] = useState<string>('All Sectors');

  const data = useMemo(() => generateMockData(range), [range]);

  const items = useMemo(() => {
    const source = tab === 'gainers' ? data.gainers : tab === 'losers' ? data.losers : data.active;
    if (sectorFilter === 'All Sectors') return source;
    return source.filter((s) => s.sector === sectorFilter);
  }, [tab, data, sectorFilter]);

  const maxVolume = useMemo(
    () => Math.max(...items.map((s) => s.volume), 1),
    [items],
  );

  const advancers = data.gainers.length;
  const decliners = data.losers.length;
  const breadthPct = Math.round((advancers / (advancers + decliners)) * 100);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-400" />
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Market Movers
          </h1>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Today's top performing, worst performing, and most actively traded stocks
        </p>
      </div>

      {/* Controls row */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Tabs */}
        <div className="flex rounded-lg border border-slate-700 bg-slate-800 p-0.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  tab === t.key
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Time range */}
        <div className="flex rounded-lg border border-slate-700 bg-slate-800 p-0.5">
          {TIME_RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                range === r.key
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Sector filter */}
        <div className="relative flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-slate-600"
          >
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex rounded-lg border border-slate-700 bg-slate-800 p-0.5">
          <button
            onClick={() => setView('list')}
            className={cn(
              'rounded-md p-1.5 transition-colors',
              view === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white',
            )}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView('grid')}
            className={cn(
              'rounded-md p-1.5 transition-colors',
              view === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white',
            )}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="mb-6 flex items-center gap-4 rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3">
        <BarChart3 className="h-4 w-4 text-slate-400" />
        <span className="text-sm text-slate-400">Market Breadth</span>
        <div className="flex flex-1 items-center gap-2">
          <span className="text-sm font-medium text-emerald-400">{advancers} advancing</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
              style={{ width: `${breadthPct}%` }}
            />
          </div>
          <span className="text-sm font-medium text-red-400">{decliners} declining</span>
        </div>
        <span className="text-xs text-slate-500">{breadthPct}% A/D</span>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-6 py-12 text-center">
          <p className="text-sm text-slate-400">No stocks match the selected filters.</p>
        </div>
      )}

      {/* List view */}
      {items.length > 0 && view === 'list' && (
        <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800/50">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Ticker</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 text-right font-medium">Change</th>
                <th className="px-4 py-3 text-right font-medium">% Change</th>
                <th className="px-4 py-3 font-medium">Volume</th>
                <th className="px-4 py-3 font-medium">Sector</th>
              </tr>
            </thead>
            <tbody>
              {items.map((stock, i) => (
                <tr
                  key={stock.ticker}
                  className="border-b border-slate-700/50 transition-colors hover:bg-slate-700/30"
                >
                  <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/company/${stock.ticker}`}
                      className="font-semibold text-blue-400 hover:underline"
                    >
                      {stock.ticker}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{stock.name}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-200">
                    {formatPrice(stock.price)}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 text-right font-mono',
                      stock.change >= 0 ? 'text-emerald-400' : 'text-red-400',
                    )}
                  >
                    {stock.change >= 0 ? '+' : ''}
                    {stock.change.toFixed(2)}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 text-right font-mono font-medium',
                      stock.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400',
                    )}
                  >
                    {formatPercent(stock.changePercent)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-14 text-right font-mono text-slate-300">
                        {fmtVolume(stock.volume)}
                      </span>
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-700">
                        <div
                          className="h-full rounded-full bg-slate-500"
                          style={{
                            width: `${(stock.volume / maxVolume) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                        sectorColor(stock.sector),
                      )}
                    >
                      {stock.sector}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Grid view */}
      {items.length > 0 && view === 'grid' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((stock, i) => (
            <div
              key={stock.ticker}
              className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 transition-colors hover:border-slate-600"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-xs font-medium text-slate-400">
                    {i + 1}
                  </span>
                  <div>
                    <Link
                      to={`/company/${stock.ticker}`}
                      className="font-semibold text-blue-400 hover:underline"
                    >
                      {stock.ticker}
                    </Link>
                    <p className="text-xs text-slate-500">{stock.name}</p>
                  </div>
                </div>
                <span
                  className={cn(
                    'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                    sectorColor(stock.sector),
                  )}
                >
                  {stock.sector}
                </span>
              </div>

              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-lg font-semibold text-slate-200">
                  {formatPrice(stock.price)}
                </span>
                <div className="text-right">
                  <span
                    className={cn(
                      'block text-sm font-medium',
                      stock.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400',
                    )}
                  >
                    {formatPercent(stock.changePercent)}
                  </span>
                  <span
                    className={cn(
                      'block text-xs',
                      stock.change >= 0 ? 'text-emerald-400/70' : 'text-red-400/70',
                    )}
                  >
                    {stock.change >= 0 ? '+' : ''}
                    {stock.change.toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>Volume</span>
                  <span className="font-mono text-slate-400">{fmtVolume(stock.volume)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                  <div
                    className="h-full rounded-full bg-slate-500"
                    style={{ width: `${(stock.volume / maxVolume) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer count */}
      {items.length > 0 && (
        <p className="mt-4 text-center text-xs text-slate-500">
          Showing {items.length} {tab === 'gainers' ? 'gaining' : tab === 'losers' ? 'losing' : 'active'} stocks
          {sectorFilter !== 'All Sectors' && ` in ${sectorFilter}`}
        </p>
      )}
    </div>
  );
}
