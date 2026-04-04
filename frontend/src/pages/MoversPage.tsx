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
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn, formatPrice, formatPercent } from '../lib/utils';
import { useScreener } from '../hooks/useScreener';
import type { ScreenerResult } from '../lib/types';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type Tab = 'gainers' | 'losers' | 'active';
type ViewMode = 'grid' | 'list';

const TABS: { key: Tab; label: string; icon: typeof TrendingUp }[] = [
  { key: 'gainers', label: 'Top Gainers', icon: TrendingUp },
  { key: 'losers', label: 'Top Losers', icon: TrendingDown },
  { key: 'active', label: 'Most Active', icon: Activity },
];

const SECTORS = [
  'All Sectors',
  'Technology',
  'Healthcare',
  'Financial Services',
  'Energy',
  'Consumer Cyclical',
  'Industrials',
] as const;

/* ------------------------------------------------------------------ */
/*  Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

function fmtVolume(v: number): string {
  if (!v) return '—';
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + 'B';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return v.toString();
}

function sectorColor(sector: string): string {
  const map: Record<string, string> = {
    Technology: 'bg-blue-500/20 text-blue-400',
    Healthcare: 'bg-emerald-500/20 text-emerald-400',
    'Financial Services': 'bg-amber-500/20 text-amber-400',
    Energy: 'bg-orange-500/20 text-orange-400',
    'Consumer Cyclical': 'bg-purple-500/20 text-purple-400',
    Industrials: 'bg-cyan-500/20 text-cyan-400',
  };
  return map[sector] ?? 'bg-slate-500/20 text-slate-400';
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export function MoversPage() {
  const [tab, setTab] = useState<Tab>('gainers');
  const [view, setView] = useState<ViewMode>('list');
  const [sectorFilter, setSectorFilter] = useState<string>('All Sectors');

  // Fetch high-volume active stocks (the primary dataset)
  const { data: activeData, isLoading: activeLoading, error: activeError } =
    useScreener({ volumeMin: 5_000_000, limit: 50 });

  // Also fetch a broader set for more gainers/losers coverage
  const { data: broadData, isLoading: broadLoading, error: broadError } =
    useScreener({ limit: 100 });

  const isLoading = activeLoading || broadLoading;
  const error = activeError || broadError;

  // Merge both datasets, de-duplicate by ticker
  const allStocks = useMemo<ScreenerResult[]>(() => {
    const map = new Map<string, ScreenerResult>();
    for (const r of broadData?.results ?? []) map.set(r.ticker, r);
    for (const r of activeData?.results ?? []) map.set(r.ticker, r);
    return Array.from(map.values());
  }, [activeData, broadData]);

  // Sort into buckets (use `price` change fields if available, else fall back to volume)
  const gainers = useMemo(
    () =>
      allStocks
        .filter(s => (s as any).changePercent > 0 || (s as any).change_percent > 0)
        .sort((a, b) => {
          const av = (a as any).changePercent ?? (a as any).change_percent ?? 0;
          const bv = (b as any).changePercent ?? (b as any).change_percent ?? 0;
          return bv - av;
        })
        .slice(0, 30),
    [allStocks],
  );

  const losers = useMemo(
    () =>
      allStocks
        .filter(s => (s as any).changePercent < 0 || (s as any).change_percent < 0)
        .sort((a, b) => {
          const av = (a as any).changePercent ?? (a as any).change_percent ?? 0;
          const bv = (b as any).changePercent ?? (b as any).change_percent ?? 0;
          return av - bv;
        })
        .slice(0, 30),
    [allStocks],
  );

  const mostActive = useMemo(
    () =>
      [...allStocks]
        .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
        .slice(0, 30),
    [allStocks],
  );

  const sourceList = tab === 'gainers' ? gainers : tab === 'losers' ? losers : mostActive;

  const items = useMemo(() => {
    if (sectorFilter === 'All Sectors') return sourceList;
    return sourceList.filter(s => s.sector === sectorFilter);
  }, [sourceList, sectorFilter]);

  const maxVolume = useMemo(
    () => Math.max(...items.map(s => s.volume ?? 0), 1),
    [items],
  );

  const advancers = gainers.length;
  const decliners = losers.length;
  const total = advancers + decliners || 1;
  const breadthPct = Math.round((advancers / total) * 100);

  const getChangePct = (s: ScreenerResult): number =>
    (s as any).changePercent ?? (s as any).change_percent ?? 0;
  const getChange = (s: ScreenerResult): number =>
    (s as any).change ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-400" />
          <h1 className="text-2xl font-bold tracking-tight text-white">Market Movers</h1>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Top performing, worst performing, and most actively traded stocks
        </p>
      </div>

      {/* Controls row */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Tabs */}
        <div className="flex rounded-lg border border-slate-700 bg-slate-800 p-0.5">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  tab === t.key ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Sector filter */}
        <div className="relative flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={sectorFilter}
            onChange={e => setSectorFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-slate-600"
          >
            {SECTORS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex rounded-lg border border-slate-700 bg-slate-800 p-0.5">
          <button
            onClick={() => setView('list')}
            className={cn('rounded-md p-1.5 transition-colors', view === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white')}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView('grid')}
            className={cn('rounded-md p-1.5 transition-colors', view === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white')}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {!isLoading && allStocks.length > 0 && (
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
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
          <span className="ml-2 text-sm text-slate-400">Loading market movers…</span>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load market data: {(error as Error).message}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && items.length === 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-6 py-12 text-center">
          <p className="text-sm text-slate-400">No stocks match the selected filters.</p>
        </div>
      )}

      {/* List view */}
      {!isLoading && items.length > 0 && view === 'list' && (
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
              {items.map((stock, i) => {
                const changePct = getChangePct(stock);
                const change = getChange(stock);
                return (
                  <tr
                    key={stock.ticker}
                    className="border-b border-slate-700/50 transition-colors hover:bg-slate-700/30"
                  >
                    <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link to={`/company/${stock.ticker}`} className="font-semibold text-blue-400 hover:underline">
                        {stock.ticker}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{stock.name}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-200">
                      {stock.price ? formatPrice(stock.price) : '—'}
                    </td>
                    <td className={cn('px-4 py-3 text-right font-mono', change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {change !== 0 ? (change >= 0 ? '+' : '') + change.toFixed(2) : '—'}
                    </td>
                    <td className={cn('px-4 py-3 text-right font-mono font-medium', changePct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {changePct !== 0 ? formatPercent(changePct) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-14 text-right font-mono text-slate-300">
                          {fmtVolume(stock.volume ?? 0)}
                        </span>
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-700">
                          <div
                            className="h-full rounded-full bg-slate-500"
                            style={{ width: `${((stock.volume ?? 0) / maxVolume) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', sectorColor(stock.sector ?? ''))}>
                        {stock.sector ?? '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Grid view */}
      {!isLoading && items.length > 0 && view === 'grid' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((stock, i) => {
            const changePct = getChangePct(stock);
            const change = getChange(stock);
            return (
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
                      <Link to={`/company/${stock.ticker}`} className="font-semibold text-blue-400 hover:underline">
                        {stock.ticker}
                      </Link>
                      <p className="text-xs text-slate-500">{stock.name}</p>
                    </div>
                  </div>
                  <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', sectorColor(stock.sector ?? ''))}>
                    {stock.sector ?? '—'}
                  </span>
                </div>

                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-lg font-semibold text-slate-200">
                    {stock.price ? formatPrice(stock.price) : '—'}
                  </span>
                  <div className="text-right">
                    <span className={cn('block text-sm font-medium', changePct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {changePct !== 0 ? formatPercent(changePct) : '—'}
                    </span>
                    <span className={cn('block text-xs', change >= 0 ? 'text-emerald-400/70' : 'text-red-400/70')}>
                      {change !== 0 ? (change >= 0 ? '+' : '') + change.toFixed(2) : ''}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>Volume</span>
                    <span className="font-mono text-slate-400">{fmtVolume(stock.volume ?? 0)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                    <div
                      className="h-full rounded-full bg-slate-500"
                      style={{ width: `${((stock.volume ?? 0) / maxVolume) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer count */}
      {!isLoading && items.length > 0 && (
        <p className="mt-4 text-center text-xs text-slate-500">
          Showing {items.length}{' '}
          {tab === 'gainers' ? 'gaining' : tab === 'losers' ? 'losing' : 'active'} stocks
          {sectorFilter !== 'All Sectors' && ` in ${sectorFilter}`}
        </p>
      )}
    </div>
  );
}
