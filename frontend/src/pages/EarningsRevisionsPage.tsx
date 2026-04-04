import { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, TrendingDown, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { cn, formatPrice } from '../lib/utils';
import { useEstimates } from '../hooks/useEstimates';
import { usePrices } from '../hooks/usePrices';

const QUICK_TICKERS = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL', 'AMZN', 'META', 'JPM', 'NFLX', 'AMD'] as const;

function ratingScore(rating: string): number {
  const r = rating.toLowerCase();
  if (r.includes('strong buy')) return 5;
  if (r.includes('outperform') || r === 'buy' || r.includes('overweight')) return 4;
  if (r.includes('hold') || r.includes('neutral') || r.includes('market perform')) return 3;
  if (r.includes('underperform') || r.includes('underweight')) return 2;
  if (r.includes('sell')) return 1;
  return 3;
}

function revisionDirection(targets: number[]): 'up' | 'down' | 'flat' {
  if (targets.length < 2) return 'flat';
  const first = targets[targets.length - 1];
  const last = targets[0];
  if (last > first * 1.01) return 'up';
  if (last < first * 0.99) return 'down';
  return 'flat';
}

interface FirmGroup {
  firm: string;
  estimates: Array<{
    analyst_name: string;
    rating: string;
    price_target: number;
    published_date: string;
  }>;
  latestTarget: number;
  latestRating: string;
  latestDate: string;
  direction: 'up' | 'down' | 'flat';
  upside: number | null;
}

export function EarningsRevisionsPage() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Up' | 'Down'>('All');

  const { data: estimates, isLoading: loadingEst, error: errEst } = useEstimates(selectedTicker);
  const { data: priceData, isLoading: loadingPrice } = usePrices(selectedTicker);

  const isLoading = loadingEst || loadingPrice;
  const currentPrice = priceData?.price ?? null;

  const handleTickerSelect = (ticker: string) => {
    setSelectedTicker(ticker);
    setSearch('');
  };

  /* Group estimates by firm */
  const firmGroups = useMemo((): FirmGroup[] => {
    if (!estimates || estimates.length === 0) return [];

    const map = new Map<string, typeof estimates>();
    for (const e of estimates) {
      const key = e.analyst_company || 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }

    const groups: FirmGroup[] = [];
    for (const [firm, rows] of map.entries()) {
      const sorted = [...rows].sort((a, b) => b.published_date.localeCompare(a.published_date));
      const withTargets = sorted.filter((r) => r.price_target > 0);
      const targets = withTargets.map((r) => r.price_target);
      const latestRow = sorted[0];
      const latestTarget = withTargets[0]?.price_target ?? 0;

      const upside =
        latestTarget > 0 && currentPrice != null
          ? ((latestTarget - currentPrice) / currentPrice) * 100
          : null;

      groups.push({
        firm,
        estimates: sorted,
        latestTarget,
        latestRating: latestRow.rating,
        latestDate: latestRow.published_date,
        direction: revisionDirection(targets),
        upside,
      });
    }

    return groups.sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  }, [estimates, currentPrice]);

  const filtered = useMemo(() => {
    if (filter === 'Up') return firmGroups.filter((g) => g.direction === 'up');
    if (filter === 'Down') return firmGroups.filter((g) => g.direction === 'down');
    return firmGroups;
  }, [firmGroups, filter]);

  const upCount = firmGroups.filter((g) => g.direction === 'up').length;
  const downCount = firmGroups.filter((g) => g.direction === 'down').length;
  const flatCount = firmGroups.filter((g) => g.direction === 'flat').length;

  const avgTarget = useMemo(() => {
    const valid = firmGroups.filter((g) => g.latestTarget > 0).map((g) => g.latestTarget);
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }, [firmGroups]);

  /* All individual estimates sorted newest first for the full table */
  const allEstimatesSorted = useMemo(() => {
    if (!estimates) return [];
    return [...estimates].sort((a, b) => b.published_date.localeCompare(a.published_date));
  }, [estimates]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Earnings Revisions</h1>
          <p className="text-sm text-slate-400">
            Analyst price target revisions grouped by firm, with direction tracking
          </p>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Enter ticker symbol..."
              value={search}
              onChange={(e) => setSearch(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.trim()) handleTickerSelect(search.trim());
              }}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_TICKERS.map((t) => (
              <button
                key={t}
                onClick={() => handleTickerSelect(t)}
                className={cn(
                  'px-3 py-1.5 rounded text-sm font-medium border transition-colors',
                  selectedTicker === t
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-900 border-slate-600 text-slate-300 hover:border-slate-500',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading analyst data for {selectedTicker}…</span>
        </div>
      )}

      {/* Error */}
      {!isLoading && errEst && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          Failed to load analyst data for {selectedTicker}. The data may not be available.
        </div>
      )}

      {/* No data */}
      {!isLoading && !errEst && firmGroups.length === 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center text-slate-400">
          No analyst data found for{' '}
          <span className="text-white font-medium">{selectedTicker}</span>.
        </div>
      )}

      {!isLoading && firmGroups.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Upward Revisions</div>
              <div className="mt-1 flex items-center gap-2">
                <ArrowUp className="h-5 w-5 text-emerald-400" />
                <span className="text-2xl font-bold text-emerald-400">{upCount}</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Downward Revisions</div>
              <div className="mt-1 flex items-center gap-2">
                <ArrowDown className="h-5 w-5 text-red-400" />
                <span className="text-2xl font-bold text-red-400">{downCount}</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Flat / No Change</div>
              <div className="mt-1 text-2xl font-bold text-slate-400">{flatCount}</div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Avg Price Target</div>
              <div className="mt-1 text-2xl font-bold text-indigo-400">
                {avgTarget != null ? formatPrice(avgTarget) : '—'}
              </div>
              {currentPrice != null && avgTarget != null && (
                <div
                  className={cn(
                    'text-xs mt-0.5',
                    avgTarget >= currentPrice ? 'text-emerald-400' : 'text-red-400',
                  )}
                >
                  {avgTarget >= currentPrice ? '+' : ''}
                  {(((avgTarget - currentPrice) / currentPrice) * 100).toFixed(1)}% vs current
                </div>
              )}
            </div>
          </div>

          {/* Revision bar chart */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">
              Price Target vs Current Price by Firm
            </h3>
            {currentPrice != null ? (
              <div className="space-y-2">
                {firmGroups
                  .filter((g) => g.latestTarget > 0)
                  .slice(0, 12)
                  .map((g) => {
                    const upside = g.upside ?? 0;
                    const barWidth = Math.min(100, Math.abs(upside) * 2);
                    return (
                      <div key={g.firm} className="flex items-center gap-3">
                        <div className="w-32 text-xs text-slate-400 truncate text-right">{g.firm}</div>
                        <div className="flex-1 flex items-center gap-1.5">
                          <div className="w-full bg-slate-700 rounded-full h-2 relative">
                            <div
                              className={cn(
                                'h-2 rounded-full',
                                upside >= 0 ? 'bg-emerald-500/70' : 'bg-red-500/70',
                              )}
                              style={{ width: `${Math.max(2, barWidth)}%` }}
                            />
                          </div>
                        </div>
                        <div
                          className={cn(
                            'w-16 text-right text-xs font-medium',
                            upside >= 0 ? 'text-emerald-400' : 'text-red-400',
                          )}
                        >
                          {upside >= 0 ? '+' : ''}
                          {upside.toFixed(1)}%
                        </div>
                        <div className="w-16 text-right text-xs text-slate-300">
                          {formatPrice(g.latestTarget)}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-sm text-slate-500">Current price unavailable for comparison.</div>
            )}
          </div>

          {/* Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
              {(['All', 'Up', 'Down'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium',
                    filter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white',
                  )}
                >
                  {f} Revisions
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500">{filtered.length} firms</span>
          </div>

          {/* Firm cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((g) => {
              const dirStyle =
                g.direction === 'up'
                  ? { bg: 'bg-emerald-900/40', text: 'text-emerald-400', label: 'Raising' }
                  : g.direction === 'down'
                  ? { bg: 'bg-red-900/40', text: 'text-red-400', label: 'Cutting' }
                  : { bg: 'bg-slate-700', text: 'text-slate-300', label: 'Unchanged' };

              return (
                <div key={g.firm} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-white truncate">{g.firm}</span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        dirStyle.bg,
                        dirStyle.text,
                      )}
                    >
                      {dirStyle.label}
                    </span>
                  </div>
                  <div className="flex items-end gap-3 mb-2">
                    <div>
                      <div className="text-[10px] text-slate-500">Latest Target</div>
                      <div className="text-lg font-bold text-indigo-400">
                        {g.latestTarget > 0 ? formatPrice(g.latestTarget) : '—'}
                      </div>
                    </div>
                    {currentPrice != null && g.latestTarget > 0 && g.upside != null && (
                      <div
                        className={cn(
                          'text-sm font-semibold mb-0.5 flex items-center gap-0.5',
                          g.upside >= 0 ? 'text-emerald-400' : 'text-red-400',
                        )}
                      >
                        {g.upside >= 0 ? (
                          <TrendingUp className="h-3.5 w-3.5" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5" />
                        )}
                        {g.upside >= 0 ? '+' : ''}
                        {g.upside.toFixed(1)}%
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 mb-1">Rating: <span className="text-slate-300">{g.latestRating || '—'}</span></div>
                  <div className="text-[10px] text-slate-600">Updated {g.latestDate}</div>
                  {g.estimates.length > 1 && (
                    <div className="mt-2 pt-2 border-t border-slate-700">
                      <div className="text-[10px] text-slate-500 mb-1">History ({g.estimates.length} notes)</div>
                      <div className="space-y-0.5">
                        {g.estimates.slice(0, 3).map((e, i) => (
                          <div key={i} className="flex justify-between text-[10px]">
                            <span className="text-slate-600">{e.published_date}</span>
                            <span className="text-slate-400">
                              {e.price_target > 0 ? formatPrice(e.price_target) : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Full estimates table */}
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
              <h3 className="text-sm font-semibold text-white">All Analyst Notes</h3>
              <p className="text-xs text-slate-500 mt-0.5">{allEstimatesSorted.length} total records</p>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Analyst</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Firm</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Rating</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Target</th>
                  {currentPrice != null && (
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">vs Price</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {allEstimatesSorted.map((e, i) => {
                  const score = ratingScore(e.rating);
                  const ratingClass =
                    score >= 4
                      ? 'text-emerald-400'
                      : score === 3
                      ? 'text-yellow-400'
                      : 'text-red-400';
                  const ups =
                    e.price_target > 0 && currentPrice != null
                      ? ((e.price_target - currentPrice) / currentPrice) * 100
                      : null;
                  return (
                    <tr
                      key={i}
                      className="bg-slate-800 hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="px-3 py-2 text-xs text-slate-400">{e.published_date}</td>
                      <td className="px-3 py-2 text-xs text-slate-300">
                        {e.analyst_name || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-white font-medium">
                        {e.analyst_company || <span className="text-slate-600">—</span>}
                      </td>
                      <td className={cn('px-3 py-2 text-xs font-medium', ratingClass)}>
                        {e.rating || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-indigo-400 font-medium">
                        {e.price_target > 0 ? formatPrice(e.price_target) : <span className="text-slate-600">—</span>}
                      </td>
                      {currentPrice != null && (
                        <td
                          className={cn(
                            'px-3 py-2 text-right text-xs font-medium',
                            ups == null
                              ? 'text-slate-600'
                              : ups >= 0
                              ? 'text-emerald-400'
                              : 'text-red-400',
                          )}
                        >
                          {ups != null ? `${ups >= 0 ? '+' : ''}${ups.toFixed(1)}%` : '—'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
