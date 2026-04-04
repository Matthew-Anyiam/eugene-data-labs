import { useState, useMemo } from 'react';
import { RefreshCw, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useScreener } from '../hooks/useScreener';

interface ScreenerResult {
  ticker: string;
  name: string;
  market_cap: number;
  price: number;
  sector: string;
  beta: number;
  volume: number;
}

const SECTORS = [
  'Technology',
  'Healthcare',
  'Financial Services',
  'Consumer Cyclical',
  'Industrials',
  'Energy',
  'Consumer Defensive',
  'Utilities',
  'Basic Materials',
  'Real Estate',
  'Communication Services',
];

const CYCLE_PHASES = ['Early Expansion', 'Mid Expansion', 'Late Expansion', 'Recession'] as const;
type CyclePhase = (typeof CYCLE_PHASES)[number];

const PHASE_SECTORS: Record<CyclePhase, string[]> = {
  'Early Expansion': ['Technology', 'Consumer Cyclical', 'Financial Services', 'Industrials'],
  'Mid Expansion': ['Technology', 'Healthcare', 'Industrials', 'Basic Materials'],
  'Late Expansion': ['Energy', 'Basic Materials', 'Healthcare', 'Consumer Defensive'],
  Recession: ['Utilities', 'Consumer Defensive', 'Healthcare', 'Real Estate'],
};

interface SectorStats {
  sector: string;
  count: number;
  avgBeta: number;
  totalMarketCap: number;
  avgPrice: number;
  totalVolume: number;
}

function computeSectorStats(results: ScreenerResult[]): SectorStats[] {
  const map = new Map<string, ScreenerResult[]>();
  for (const r of results) {
    const key = r.sector || 'Unknown';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return Array.from(map.entries()).map(([sector, stocks]) => ({
    sector,
    count: stocks.length,
    avgBeta: stocks.reduce((s, x) => s + (x.beta ?? 0), 0) / stocks.length,
    totalMarketCap: stocks.reduce((s, x) => s + (x.market_cap ?? 0), 0),
    avgPrice: stocks.reduce((s, x) => s + (x.price ?? 0), 0) / stocks.length,
    totalVolume: stocks.reduce((s, x) => s + (x.volume ?? 0), 0),
  }));
}

function fmtCap(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toFixed(0)}`;
}

export function SectorRotationPage() {
  const [currentPhase] = useState<CyclePhase>('Mid Expansion');
  const [sortKey, setSortKey] = useState<keyof SectorStats>('totalMarketCap');

  // Fetch all sectors in parallel
  const sectorQueries = SECTORS.map((sector) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useScreener({ sector, limit: 50 })
  );

  const isLoading = sectorQueries.some((q) => q.isLoading);
  const isError = sectorQueries.some((q) => q.isError);

  const allResults = useMemo<ScreenerResult[]>(() => {
    const out: ScreenerResult[] = [];
    for (const q of sectorQueries) {
      if (q.data?.results) out.push(...q.data.results);
    }
    return out;
  }, [sectorQueries]);

  const sectorStats = useMemo(() => computeSectorStats(allResults), [allResults]);

  const sorted = useMemo(
    () =>
      [...sectorStats].sort((a, b) => {
        const av = a[sortKey] as number;
        const bv = b[sortKey] as number;
        return bv - av;
      }),
    [sectorStats, sortKey],
  );

  const favoredSectors = PHASE_SECTORS[currentPhase];

  const maxMarketCap = Math.max(...sorted.map((s) => s.totalMarketCap), 1);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        <span className="ml-3 text-slate-400">Loading sector data…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-red-400">Failed to load sector data. Please try again.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <RefreshCw className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Sector Rotation</h1>
          <p className="text-sm text-slate-400">
            Economic cycle positioning, sector momentum, and rotation model
          </p>
        </div>
      </div>

      {/* Cycle phase */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Economic Cycle Position</h3>
        <div className="flex items-center gap-1">
          {CYCLE_PHASES.map((phase, i) => (
            <div key={phase} className="flex flex-1 items-center">
              <div
                className={cn(
                  'flex-1 rounded-lg p-3 text-center transition-all',
                  phase === currentPhase
                    ? 'bg-indigo-600 ring-2 ring-indigo-400'
                    : 'bg-slate-700/50',
                )}
              >
                <div
                  className={cn(
                    'text-xs font-semibold',
                    phase === currentPhase ? 'text-white' : 'text-slate-400',
                  )}
                >
                  {phase}
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  {PHASE_SECTORS[phase].slice(0, 2).join(', ')}
                </div>
              </div>
              {i < CYCLE_PHASES.length - 1 && (
                <ArrowRight className="mx-1 h-3 w-3 shrink-0 text-slate-600" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Favored sectors */}
      <div className="rounded-xl border border-emerald-700/50 bg-slate-800 p-4">
        <h3 className="mb-2 text-sm font-semibold text-emerald-400">
          Favored Sectors ({currentPhase})
        </h3>
        <div className="flex flex-wrap gap-2">
          {favoredSectors.map((s) => (
            <span
              key={s}
              className="rounded-lg border border-emerald-700/50 bg-emerald-900/30 px-3 py-1.5 text-xs font-medium text-emerald-400"
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Sectors Tracked', value: sectorStats.length.toString() },
          {
            label: 'Total Stocks',
            value: sectorStats.reduce((s, x) => s + x.count, 0).toLocaleString(),
          },
          {
            label: 'Total Market Cap',
            value: fmtCap(sectorStats.reduce((s, x) => s + x.totalMarketCap, 0)),
          },
          {
            label: 'Avg Beta (All)',
            value: sectorStats.length
              ? (
                  sectorStats.reduce((s, x) => s + x.avgBeta, 0) / sectorStats.length
                ).toFixed(2)
              : '—',
          },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
            <div className="mt-1 text-lg font-bold text-white">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Sort controls */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
        {(
          [
            ['totalMarketCap', 'Market Cap'],
            ['count', 'Stock Count'],
            ['avgBeta', 'Avg Beta'],
            ['totalVolume', 'Volume'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium',
              sortKey === key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Market-cap bar chart */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-4 text-sm font-semibold text-white">Sector Market Cap Distribution</h3>
        <div className="space-y-3">
          {sorted.map((s, i) => {
            const barPct = (s.totalMarketCap / maxMarketCap) * 100;
            const isFavored = favoredSectors.includes(s.sector);
            return (
              <div key={s.sector} className="flex items-center gap-2">
                <span className="w-5 text-[10px] text-slate-500">#{i + 1}</span>
                <span
                  className={cn(
                    'w-40 truncate text-xs font-medium',
                    isFavored ? 'text-emerald-400' : 'text-slate-300',
                  )}
                >
                  {s.sector}
                  {isFavored && <span className="ml-1 text-[8px]">★</span>}
                </span>
                <div className="flex flex-1 items-center">
                  <div
                    className={cn(
                      'h-5 rounded-r transition-all',
                      isFavored ? 'bg-emerald-500/50' : 'bg-indigo-500/40',
                    )}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <span className="w-20 text-right text-xs text-slate-300">
                  {fmtCap(s.totalMarketCap)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Sector</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Stocks</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Market Cap</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Avg Beta</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Avg Price</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Total Volume</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {sorted.map((s) => {
              const isFavored = favoredSectors.includes(s.sector);
              return (
                <tr
                  key={s.sector}
                  className={cn('bg-slate-800 hover:bg-slate-750', isFavored && 'bg-emerald-900/5')}
                >
                  <td
                    className={cn(
                      'px-3 py-2 text-xs font-medium',
                      isFavored ? 'text-emerald-400' : 'text-white',
                    )}
                  >
                    {s.sector} {isFavored && '★'}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">{s.count}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">
                    {fmtCap(s.totalMarketCap)}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right text-xs font-medium',
                      s.avgBeta > 1.2
                        ? 'text-amber-400'
                        : s.avgBeta < 0.8
                          ? 'text-emerald-400'
                          : 'text-slate-300',
                    )}
                  >
                    {s.avgBeta.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">
                    ${s.avgPrice.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">
                    {(s.totalVolume / 1e6).toFixed(1)}M
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Beta heatmap */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Beta Heatmap by Sector</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {sectorStats.map((s) => {
            const intensity = Math.min(1, Math.abs(s.avgBeta - 1) / 1);
            const isHigh = s.avgBeta >= 1;
            const bg = isHigh
              ? `rgba(251, 191, 36, ${intensity * 0.35})`
              : `rgba(52, 211, 153, ${intensity * 0.35})`;
            return (
              <div
                key={s.sector}
                className="rounded-lg border border-slate-700 p-3"
                style={{ backgroundColor: bg }}
              >
                <div className="truncate text-xs font-medium text-white">{s.sector}</div>
                <div
                  className={cn(
                    'mt-1 text-lg font-bold',
                    s.avgBeta > 1.2
                      ? 'text-amber-400'
                      : s.avgBeta < 0.8
                        ? 'text-emerald-400'
                        : 'text-slate-300',
                  )}
                >
                  β {s.avgBeta.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500">{s.count} stocks</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
