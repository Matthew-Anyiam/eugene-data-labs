import { useState, useMemo } from 'react';
import { CalendarDays, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useEarnings } from '../hooks/useEstimates';

const QUICK_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'NFLX', 'AMD'] as const;

function formatRevenue(val: number | null): string {
  if (val == null) return '—';
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  return `$${val.toFixed(2)}`;
}

function surprisePct(actual: number | null, estimated: number): number | null {
  if (actual == null || estimated === 0) return null;
  return ((actual - estimated) / Math.abs(estimated)) * 100;
}

export function EarningsCalendarProPage() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [search, setSearch] = useState('');
  const [showOnlyActual, setShowOnlyActual] = useState(false);

  const { data: earnings, isLoading, error } = useEarnings(selectedTicker);

  const handleTickerSelect = (ticker: string) => {
    setSelectedTicker(ticker);
    setSearch('');
  };

  const sorted = useMemo(() => {
    if (!earnings) return [];
    let list = [...earnings].sort((a, b) => b.date.localeCompare(a.date));
    if (showOnlyActual) list = list.filter((e) => e.eps_actual != null);
    return list;
  }, [earnings, showOnlyActual]);

  const withActual = useMemo(
    () => sorted.filter((e) => e.eps_actual != null),
    [sorted],
  );

  const beatCount = withActual.filter((e) => (e.eps_actual ?? 0) >= e.eps_estimated).length;

  const avgEpsSurprise = useMemo(() => {
    const valid = withActual
      .map((e) => surprisePct(e.eps_actual, e.eps_estimated))
      .filter((v): v is number => v != null);
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }, [withActual]);

  const latestEps = sorted[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <CalendarDays className="h-6 w-6 text-orange-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Earnings Calendar Pro</h1>
          <p className="text-sm text-slate-400">
            Historical earnings results — EPS, revenue, and surprise by quarter
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
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
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
                    ? 'bg-orange-600 border-orange-500 text-white'
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
          <span>Loading earnings history for {selectedTicker}…</span>
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          Failed to load earnings data for {selectedTicker}. The data may not be available.
        </div>
      )}

      {/* No data */}
      {!isLoading && !error && sorted.length === 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center text-slate-400">
          No earnings history found for{' '}
          <span className="text-white font-medium">{selectedTicker}</span>.
        </div>
      )}

      {!isLoading && sorted.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Total Quarters</div>
              <div className="mt-1 text-lg font-bold text-white">{sorted.length}</div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">With Results</div>
              <div className="mt-1 text-lg font-bold text-orange-400">{withActual.length}</div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Beat Rate</div>
              <div
                className={cn(
                  'mt-1 text-lg font-bold',
                  withActual.length > 0 && beatCount / withActual.length >= 0.5
                    ? 'text-emerald-400'
                    : 'text-red-400',
                )}
              >
                {withActual.length > 0
                  ? `${((beatCount / withActual.length) * 100).toFixed(0)}%`
                  : '—'}
              </div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Avg EPS Surprise</div>
              <div
                className={cn(
                  'mt-1 text-lg font-bold',
                  avgEpsSurprise == null
                    ? 'text-slate-400'
                    : avgEpsSurprise >= 0
                    ? 'text-emerald-400'
                    : 'text-red-400',
                )}
              >
                {avgEpsSurprise != null
                  ? `${avgEpsSurprise >= 0 ? '+' : ''}${avgEpsSurprise.toFixed(1)}%`
                  : '—'}
              </div>
            </div>
          </div>

          {/* Latest result highlight */}
          {latestEps && latestEps.eps_actual != null && (
            <div className="rounded-xl border border-orange-400/30 bg-orange-400/5 p-4">
              <div className="text-xs text-orange-400 uppercase tracking-wider mb-2">
                Most Recent Result — {latestEps.fiscal_period}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-slate-500">Report Date</div>
                  <div className="text-sm font-semibold text-white">{latestEps.date}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">EPS Actual</div>
                  <div className="text-sm font-semibold text-white">
                    ${latestEps.eps_actual.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">EPS Estimated</div>
                  <div className="text-sm font-semibold text-slate-300">
                    ${latestEps.eps_estimated.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">EPS Surprise</div>
                  {(() => {
                    const pct = surprisePct(latestEps.eps_actual, latestEps.eps_estimated);
                    return (
                      <div
                        className={cn(
                          'text-sm font-semibold flex items-center gap-1',
                          pct == null ? 'text-slate-400' : pct >= 0 ? 'text-emerald-400' : 'text-red-400',
                        )}
                      >
                        {pct != null ? (
                          <>
                            {pct >= 0 ? (
                              <TrendingUp className="h-3.5 w-3.5" />
                            ) : (
                              <TrendingDown className="h-3.5 w-3.5" />
                            )}
                            {pct >= 0 ? '+' : ''}
                            {pct.toFixed(1)}%
                          </>
                        ) : (
                          '—'
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Filter toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowOnlyActual((v) => !v)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium border transition-colors',
                showOnlyActual
                  ? 'bg-orange-600 border-orange-500 text-white'
                  : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500',
              )}
            >
              Reported only
            </button>
            <span className="text-xs text-slate-500">
              Showing {sorted.length} quarters — {withActual.length} with reported results
            </span>
          </div>

          {/* Main table */}
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
                {sorted.map((e, i) => {
                  const epsPct = surprisePct(e.eps_actual, e.eps_estimated);
                  const revPct = surprisePct(e.revenue_actual, e.revenue_estimated);
                  const hasResult = e.eps_actual != null;
                  return (
                    <tr key={i} className="bg-slate-800 hover:bg-slate-700/30 transition-colors">
                      <td className="px-3 py-2 text-xs text-slate-400">{e.date}</td>
                      <td className="px-3 py-2 text-xs text-slate-300 font-medium">
                        {e.fiscal_period}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-slate-400">
                        ${e.eps_estimated.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-medium">
                        {hasResult ? (
                          <span className="text-white">${e.eps_actual!.toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-600">Pending</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {epsPct != null ? (
                          <span
                            className={cn(
                              'inline-flex items-center justify-end gap-0.5 text-xs font-bold',
                              epsPct >= 0 ? 'text-emerald-400' : 'text-red-400',
                            )}
                          >
                            {epsPct >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {epsPct >= 0 ? '+' : ''}
                            {epsPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-slate-400">
                        {formatRevenue(e.revenue_estimated)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-medium">
                        {e.revenue_actual != null ? (
                          <span className="text-white">{formatRevenue(e.revenue_actual)}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right text-xs font-medium',
                          revPct == null
                            ? 'text-slate-600'
                            : revPct >= 0
                            ? 'text-emerald-400'
                            : 'text-red-400',
                        )}
                      >
                        {revPct != null
                          ? `${revPct >= 0 ? '+' : ''}${revPct.toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-3 text-[10px] text-slate-500 space-y-1">
            <div>
              <strong className="text-slate-400">EPS Surprise:</strong> Percentage difference
              between reported EPS and consensus estimate. Green = beat, Red = miss.
            </div>
            <div>
              <strong className="text-slate-400">Rev Surprise:</strong> Percentage difference
              between reported revenue and consensus revenue estimate.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
