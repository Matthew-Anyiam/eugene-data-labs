import { useState, useMemo } from 'react';
import { Zap, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useEarnings } from '../hooks/useEstimates';

const QUICK_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM'] as const;

function surprisePct(actual: number | null, estimated: number): number | null {
  if (actual == null || estimated === 0) return null;
  return ((actual - estimated) / Math.abs(estimated)) * 100;
}

function formatRevenue(val: number | null): string {
  if (val == null) return '—';
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  return `$${val.toFixed(2)}`;
}

export function EarningsSurprisesPage() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'beats' | 'misses'>('all');

  const { data: earnings, isLoading, error } = useEarnings(selectedTicker);

  const handleTickerSelect = (ticker: string) => {
    setSelectedTicker(ticker);
    setSearch('');
  };

  const enriched = useMemo(() => {
    if (!earnings) return [];
    return earnings
      .filter((e) => e.eps_actual != null)
      .map((e) => ({
        ...e,
        epsSurprisePct: surprisePct(e.eps_actual, e.eps_estimated),
        revSurprisePct: surprisePct(e.revenue_actual, e.revenue_estimated),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [earnings]);

  const filtered = useMemo(() => {
    if (filter === 'beats') return enriched.filter((e) => (e.epsSurprisePct ?? 0) > 0);
    if (filter === 'misses') return enriched.filter((e) => (e.epsSurprisePct ?? 0) < 0);
    return enriched;
  }, [enriched, filter]);

  const beats = enriched.filter((e) => (e.epsSurprisePct ?? 0) > 0);
  const misses = enriched.filter((e) => (e.epsSurprisePct ?? 0) < 0);

  const avgSurprise =
    enriched.length > 0
      ? enriched.reduce((s, e) => s + (e.epsSurprisePct ?? 0), 0) / enriched.length
      : null;

  const biggestBeat =
    beats.length > 0
      ? [...beats].sort((a, b) => (b.epsSurprisePct ?? 0) - (a.epsSurprisePct ?? 0))[0]
      : null;

  const biggestMiss =
    misses.length > 0
      ? [...misses].sort((a, b) => (a.epsSurprisePct ?? 0) - (b.epsSurprisePct ?? 0))[0]
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Zap className="h-6 w-6 text-fuchsia-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Earnings Surprises</h1>
          <p className="text-sm text-slate-400">
            EPS beats and misses, revenue surprises, and historical earnings performance
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
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500"
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
                    ? 'bg-fuchsia-600 border-fuchsia-500 text-white'
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
          <span>Loading earnings data for {selectedTicker}…</span>
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          Failed to load earnings data for {selectedTicker}. The data may not be available.
        </div>
      )}

      {/* No data */}
      {!isLoading && !error && enriched.length === 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center text-slate-400">
          No earnings history found for{' '}
          <span className="text-white font-medium">{selectedTicker}</span>.
        </div>
      )}

      {!isLoading && enriched.length > 0 && (
        <>
          {/* Filter tabs */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
              {(['all', 'beats', 'misses'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium capitalize',
                    filter === f ? 'bg-fuchsia-600 text-white' : 'text-slate-400 hover:text-white',
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Total Reports</div>
              <div className="mt-1 text-lg font-bold text-white">{enriched.length}</div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">EPS Beats</div>
              <div className="mt-1 text-lg font-bold text-emerald-400">
                {beats.length}
                {enriched.length > 0 && (
                  <span className="text-sm text-slate-500 ml-1">
                    ({((beats.length / enriched.length) * 100).toFixed(0)}%)
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">EPS Misses</div>
              <div className="mt-1 text-lg font-bold text-red-400">
                {misses.length}
                {enriched.length > 0 && (
                  <span className="text-sm text-slate-500 ml-1">
                    ({((misses.length / enriched.length) * 100).toFixed(0)}%)
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Avg EPS Surprise</div>
              <div
                className={cn(
                  'mt-1 text-lg font-bold',
                  avgSurprise == null
                    ? 'text-slate-400'
                    : avgSurprise >= 0
                    ? 'text-emerald-400'
                    : 'text-red-400',
                )}
              >
                {avgSurprise != null
                  ? `${avgSurprise >= 0 ? '+' : ''}${avgSurprise.toFixed(1)}%`
                  : '—'}
              </div>
            </div>
          </div>

          {/* Biggest beat / miss */}
          {(biggestBeat || biggestMiss) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {biggestBeat && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="text-xs text-emerald-400 uppercase tracking-wider mb-2">Biggest Beat</div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-emerald-400">
                      {biggestBeat.fiscal_period}
                    </span>
                    <span className="text-xs text-slate-400">{biggestBeat.date}</span>
                  </div>
                  <div className="mt-2 text-2xl font-bold text-emerald-400">
                    +{biggestBeat.epsSurprisePct!.toFixed(1)}%
                  </div>
                  <div className="text-xs text-slate-400">
                    EPS: ${biggestBeat.eps_actual?.toFixed(2)} vs est. $
                    {biggestBeat.eps_estimated.toFixed(2)}
                  </div>
                </div>
              )}
              {biggestMiss && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                  <div className="text-xs text-red-400 uppercase tracking-wider mb-2">Biggest Miss</div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-red-400">
                      {biggestMiss.fiscal_period}
                    </span>
                    <span className="text-xs text-slate-400">{biggestMiss.date}</span>
                  </div>
                  <div className="mt-2 text-2xl font-bold text-red-400">
                    {biggestMiss.epsSurprisePct!.toFixed(1)}%
                  </div>
                  <div className="text-xs text-slate-400">
                    EPS: ${biggestMiss.eps_actual?.toFixed(2)} vs est. $
                    {biggestMiss.eps_estimated.toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Full table */}
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Period</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">EPS Est.</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">EPS Actual</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">EPS Surprise</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Rev Est.</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Rev Actual</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Rev Surprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.map((e, i) => {
                  const epsColor =
                    e.epsSurprisePct == null
                      ? 'text-slate-400'
                      : e.epsSurprisePct >= 0
                      ? 'text-emerald-400'
                      : 'text-red-400';
                  const revColor =
                    e.revSurprisePct == null
                      ? 'text-slate-400'
                      : e.revSurprisePct >= 0
                      ? 'text-emerald-400'
                      : 'text-red-400';
                  return (
                    <tr
                      key={i}
                      className={cn(
                        'hover:bg-slate-700/30 transition-colors',
                        (e.epsSurprisePct ?? 0) < 0 ? 'bg-red-500/5' : 'bg-slate-800',
                      )}
                    >
                      <td className="px-3 py-2 text-xs text-slate-400">{e.date}</td>
                      <td className="px-3 py-2 text-xs text-slate-300 font-medium">
                        {e.fiscal_period}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-slate-400">
                        ${e.eps_estimated.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-white font-medium">
                        {e.eps_actual != null ? `$${e.eps_actual.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {e.epsSurprisePct != null ? (
                          <span
                            className={cn(
                              'inline-flex items-center gap-0.5 text-xs font-bold',
                              epsColor,
                            )}
                          >
                            {e.epsSurprisePct >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {e.epsSurprisePct >= 0 ? '+' : ''}
                            {e.epsSurprisePct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-slate-400">
                        {formatRevenue(e.revenue_estimated)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-white font-medium">
                        {formatRevenue(e.revenue_actual)}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right text-xs font-medium',
                          revColor,
                        )}
                      >
                        {e.revSurprisePct != null
                          ? `${e.revSurprisePct >= 0 ? '+' : ''}${e.revSurprisePct.toFixed(1)}%`
                          : '—'}
                      </td>
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
