import { useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, List, ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react';
import { usePrices } from '../hooks/usePrices';
import { cn, formatPercent } from '../lib/utils';
import type { PriceData } from '../lib/types';

// ─── Sector definitions ──────────────────────────────────────────────

interface SectorDef {
  name: string;
  tickers: string[];
}

const SECTORS: SectorDef[] = [
  { name: 'Technology', tickers: ['AAPL', 'MSFT', 'NVDA'] },
  { name: 'Healthcare', tickers: ['UNH', 'JNJ', 'LLY'] },
  { name: 'Financial Services', tickers: ['JPM', 'BAC', 'GS'] },
  { name: 'Consumer Cyclical', tickers: ['AMZN', 'TSLA', 'HD'] },
  { name: 'Communication Services', tickers: ['GOOGL', 'META', 'NFLX'] },
  { name: 'Industrials', tickers: ['CAT', 'UNP', 'HON'] },
  { name: 'Consumer Defensive', tickers: ['PG', 'KO', 'WMT'] },
  { name: 'Energy', tickers: ['XOM', 'CVX', 'COP'] },
  { name: 'Utilities', tickers: ['NEE', 'DUK', 'SO'] },
  { name: 'Real Estate', tickers: ['PLD', 'AMT', 'SPG'] },
  { name: 'Basic Materials', tickers: ['LIN', 'APD', 'FCX'] },
];

type SortMode = 'perf-desc' | 'perf-asc' | 'alpha';
type ViewMode = 'grid' | 'list';

// ─── Per-ticker price reporter ───────────────────────────────────────

function TickerPriceCell({
  ticker,
  onData,
}: {
  ticker: string;
  onData: (ticker: string, data: PriceData | null, loading: boolean) => void;
}) {
  const { data, isLoading } = usePrices(ticker);
  const prev = useRef<string>('');

  useEffect(() => {
    const key = `${ticker}:${isLoading}:${data?.change_percent ?? 'null'}`;
    if (key !== prev.current) {
      prev.current = key;
      onData(ticker, data ?? null, isLoading);
    }
  }, [ticker, data, isLoading, onData]);

  return null;
}

// ─── Color helpers ───────────────────────────────────────────────────

function heatBg(pct: number | null): string {
  if (pct === null) return 'bg-slate-100 dark:bg-slate-800';
  if (pct > 2) return 'bg-emerald-600 dark:bg-emerald-700';
  if (pct > 0) return 'bg-emerald-400/60 dark:bg-emerald-600/40';
  if (pct > -2) return 'bg-red-400/60 dark:bg-red-600/40';
  return 'bg-red-600 dark:bg-red-700';
}

function heatText(pct: number | null): string {
  if (pct === null) return 'text-slate-500';
  if (pct > 2 || pct < -2) return 'text-white';
  return 'text-slate-900 dark:text-slate-100';
}

// ─── Main component ──────────────────────────────────────────────────

interface TickerState {
  data: PriceData | null;
  loading: boolean;
}

export function HeatmapPage() {
  const [view, setView] = useState<ViewMode>('grid');
  const [sort, setSort] = useState<SortMode>('perf-desc');
  const [tickerMap, setTickerMap] = useState<Record<string, TickerState>>({});

  const handleTickerData = useCallback(
    (ticker: string, data: PriceData | null, loading: boolean) => {
      setTickerMap((prev) => {
        const existing = prev[ticker];
        if (existing && existing.data === data && existing.loading === loading) return prev;
        return { ...prev, [ticker]: { data, loading } };
      });
    },
    [],
  );

  // Collect all tickers for hook rendering
  const allTickers = SECTORS.flatMap((s) => s.tickers);

  // Compute sector averages
  const sectorData = SECTORS.map((sector) => {
    const changes: number[] = [];
    let anyLoading = false;

    for (const t of sector.tickers) {
      const state = tickerMap[t];
      if (!state || state.loading) {
        anyLoading = true;
        continue;
      }
      if (state.data?.change_percent != null) {
        changes.push(state.data.change_percent);
      }
    }

    const avg = changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : null;
    return { ...sector, avg, loading: anyLoading };
  });

  // Sort sectors
  const sorted = [...sectorData].sort((a, b) => {
    if (sort === 'alpha') return a.name.localeCompare(b.name);
    const aVal = a.avg ?? (sort === 'perf-desc' ? -Infinity : Infinity);
    const bVal = b.avg ?? (sort === 'perf-desc' ? -Infinity : Infinity);
    return sort === 'perf-desc' ? bVal - aVal : aVal - bVal;
  });

  const anyLoading = sectorData.some((s) => s.loading);

  return (
    <div className="space-y-6">
      {/* Hidden ticker price reporters */}
      {allTickers.map((t) => (
        <TickerPriceCell key={t} ticker={t} onData={handleTickerData} />
      ))}

      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <LayoutGrid className="h-7 w-7 text-indigo-500" />
          Market Heatmap
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Sector performance overview based on representative large-cap stocks
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setView('grid')}
            className={cn(
              'flex items-center gap-1.5 rounded-l-lg px-3 py-1.5 text-xs font-medium transition-colors',
              view === 'grid'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800',
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Grid
          </button>
          <button
            onClick={() => setView('list')}
            className={cn(
              'flex items-center gap-1.5 rounded-r-lg px-3 py-1.5 text-xs font-medium transition-colors',
              view === 'list'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800',
            )}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
        </div>

        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700">
          {([
            { key: 'perf-desc', label: 'Best first', Icon: TrendingUp },
            { key: 'perf-asc', label: 'Worst first', Icon: TrendingDown },
            { key: 'alpha', label: 'A-Z', Icon: ArrowUpDown },
          ] as const).map(({ key, label, Icon }, i) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                i === 0 && 'rounded-l-lg',
                i === 2 && 'rounded-r-lg',
                sort === key
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800',
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap */}
      {anyLoading && Object.keys(tickerMap).length === 0 ? (
        <div
          className={cn(
            view === 'grid'
              ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'space-y-3',
          )}
        >
          {SECTORS.map((s) => (
            <div
              key={s.name}
              className="h-36 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700"
            />
          ))}
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map((sector) => (
            <SectorCard key={sector.name} sector={sector} tickerMap={tickerMap} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((sector) => (
            <SectorRow key={sector.name} sector={sector} tickerMap={tickerMap} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sector card (grid view) ─────────────────────────────────────────

interface SectorViewProps {
  sector: SectorDef & { avg: number | null; loading: boolean };
  tickerMap: Record<string, TickerState>;
}

function SectorCard({ sector, tickerMap }: SectorViewProps) {
  return (
    <div
      className={cn(
        'rounded-lg p-4 transition-shadow hover:shadow-md',
        heatBg(sector.avg),
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className={cn('text-sm font-semibold', heatText(sector.avg))}>
          {sector.name}
        </h3>
        <span className={cn('text-lg font-bold tabular-nums', heatText(sector.avg))}>
          {sector.avg !== null ? formatPercent(sector.avg) : '--'}
        </span>
      </div>
      <div className="space-y-1.5">
        {sector.tickers.map((t) => {
          const state = tickerMap[t];
          const pct = state?.data?.change_percent ?? null;
          return (
            <div key={t} className="flex items-center justify-between">
              <Link
                to={`/company/${t}`}
                className={cn(
                  'font-mono text-xs font-medium underline-offset-2 hover:underline',
                  heatText(sector.avg),
                )}
              >
                {t}
              </Link>
              {state?.loading ? (
                <div className="h-3 w-10 animate-pulse rounded bg-white/20" />
              ) : (
                <span
                  className={cn('text-xs font-medium tabular-nums', heatText(sector.avg))}
                >
                  {pct !== null ? formatPercent(pct) : '--'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sector row (list view) ──────────────────────────────────────────

function SectorRow({ sector, tickerMap }: SectorViewProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border px-4 py-3',
        'border-slate-200 dark:border-slate-700',
        heatBg(sector.avg),
      )}
    >
      <div className="w-48 shrink-0">
        <h3 className={cn('text-sm font-semibold', heatText(sector.avg))}>
          {sector.name}
        </h3>
      </div>
      <span className={cn('w-20 text-right text-lg font-bold tabular-nums', heatText(sector.avg))}>
        {sector.avg !== null ? formatPercent(sector.avg) : '--'}
      </span>
      <div className="flex flex-wrap gap-3">
        {sector.tickers.map((t) => {
          const state = tickerMap[t];
          const pct = state?.data?.change_percent ?? null;
          return (
            <Link
              key={t}
              to={`/company/${t}`}
              className={cn(
                'flex items-center gap-1.5 rounded-md bg-white/20 px-2 py-0.5 text-xs font-medium transition-colors hover:bg-white/30',
                heatText(sector.avg),
              )}
            >
              <span className="font-mono">{t}</span>
              {state?.loading ? (
                <div className="h-3 w-8 animate-pulse rounded bg-white/20" />
              ) : (
                <span className="tabular-nums">
                  {pct !== null ? formatPercent(pct) : '--'}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
