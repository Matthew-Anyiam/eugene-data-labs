import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChartHorizontal, TrendingUp, TrendingDown, Loader2, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useEstimates, useEarnings } from '../hooks/useEstimates';

const QUICK_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM'];

export function EstimatesPage() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [tickerInput, setTickerInput] = useState('');
  const [view, setView] = useState<'eps' | 'revenue'>('eps');

  const estimatesQuery = useEstimates(selectedTicker);
  const earningsQuery = useEarnings(selectedTicker);

  const selectTicker = (t: string) => {
    const upper = t.trim().toUpperCase();
    if (upper) {
      setSelectedTicker(upper);
      setTickerInput('');
    }
  };

  const estimates = estimatesQuery.data ?? [];
  const earnings = earningsQuery.data ?? [];

  // Compute bar chart scale from earnings data
  const maxEps = earnings.length
    ? Math.max(...earnings.map(e => Math.max(e.eps_estimated, e.eps_actual ?? 0))) * 1.1
    : 1;
  const maxRev = earnings.length
    ? Math.max(...earnings.map(e => Math.max(e.revenue_estimated, e.revenue_actual ?? 0))) * 1.1
    : 1;

  const isLoading = estimatesQuery.isLoading || earningsQuery.isLoading;
  const isError = estimatesQuery.isError || earningsQuery.isError;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChartHorizontal className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Earnings Estimates</h1>
          <p className="text-sm text-slate-400">Analyst price targets, EPS estimates vs actuals, and earnings surprises</p>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <input
            value={tickerInput}
            onChange={e => setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter' && tickerInput) selectTicker(tickerInput); }}
            placeholder="Ticker..."
            className="w-24 rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        {QUICK_TICKERS.map(t => (
          <button
            key={t}
            onClick={() => selectTicker(t)}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
              selectedTicker === t
                ? 'bg-indigo-600 text-white'
                : 'border border-slate-700 text-slate-400 hover:text-white',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-bold text-white">{selectedTicker} Estimates</h2>
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
          {(['eps', 'revenue'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium',
                view === v ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white',
              )}
            >
              {v === 'eps' ? 'EPS' : 'Revenue'}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-12 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading {selectedTicker} data…</span>
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-xl border border-red-700/50 bg-red-900/10 px-4 py-3 text-sm text-red-400">
          Failed to load estimates for {selectedTicker}. Please try again.
        </div>
      )}

      {/* EPS / Revenue chart from earnings data */}
      {!isLoading && earnings.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(earnings.length, 8)}, 1fr)` }}>
            {earnings.slice(0, 8).map(e => {
              const isReported = e.eps_actual !== null;
              const surprise = isReported ? ((e.eps_actual! - e.eps_estimated) / Math.abs(e.eps_estimated)) * 100 : null;
              const surprisePositive = (surprise ?? 0) >= 0;
              const barMax = view === 'eps' ? maxEps : maxRev;
              const estVal = view === 'eps' ? e.eps_estimated : e.revenue_estimated;
              const actVal = view === 'eps' ? e.eps_actual : e.revenue_actual;

              return (
                <div key={e.fiscal_period} className="text-center">
                  <div className="mb-2 text-[10px] text-slate-500 truncate">{e.fiscal_period}</div>
                  <div className="relative mx-auto h-32 w-8">
                    <div
                      className="absolute bottom-0 w-full rounded-t bg-indigo-500/40"
                      style={{ height: `${Math.max((estVal / barMax) * 100, 2)}%` }}
                    />
                    {actVal !== null && (
                      <div
                        className={cn('absolute bottom-0 w-full rounded-t', surprisePositive ? 'bg-emerald-500/70' : 'bg-red-500/70')}
                        style={{ height: `${Math.max((actVal / barMax) * 100, 2)}%` }}
                      />
                    )}
                  </div>
                  <div className="mt-2">
                    <div className="text-xs font-bold text-white">
                      {view === 'eps' ? `$${e.eps_estimated.toFixed(2)}` : `$${(e.revenue_estimated / 1e9).toFixed(1)}B`}
                    </div>
                    {isReported && actVal !== null && (
                      <div className={cn('text-[10px] font-medium', surprisePositive ? 'text-emerald-400' : 'text-red-400')}>
                        {view === 'eps' ? `Act: $${e.eps_actual!.toFixed(2)}` : `Act: $${(actVal / 1e9).toFixed(1)}B`}
                      </div>
                    )}
                    {surprise !== null && view === 'eps' && (
                      <div className={cn('flex items-center justify-center gap-0.5 text-[9px]', surprisePositive ? 'text-emerald-400' : 'text-red-400')}>
                        {surprisePositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                        {surprisePositive ? '+' : ''}{surprise.toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-indigo-500/40" /> Estimate</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-emerald-500/70" /> Beat</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-red-500/70" /> Miss</span>
          </div>
        </div>
      )}

      {/* Earnings estimates table */}
      {!isLoading && earnings.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-white">EPS &amp; Revenue by Period</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Period</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Date</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">EPS Est.</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">EPS Actual</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Surprise</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Rev Est. ($B)</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Rev Actual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {earnings.map((e, idx) => {
                  const isReported = e.eps_actual !== null;
                  const surprise = isReported
                    ? ((e.eps_actual! - e.eps_estimated) / Math.abs(e.eps_estimated)) * 100
                    : null;
                  const surprisePositive = (surprise ?? 0) >= 0;
                  return (
                    <tr key={`${e.fiscal_period}-${idx}`} className={cn('bg-slate-800', !isReported && 'bg-slate-800/60')}>
                      <td className="px-3 py-2 text-xs font-medium text-white">
                        {e.fiscal_period}
                        {isReported && (
                          <span className="ml-1 rounded bg-emerald-900/40 px-1 py-0.5 text-[9px] text-emerald-400">REPORTED</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400">{e.date}</td>
                      <td className="px-3 py-2 text-right text-xs text-slate-300">${e.eps_estimated.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-xs font-medium">
                        {e.eps_actual !== null
                          ? <span className={cn(surprisePositive ? 'text-emerald-400' : 'text-red-400')}>${e.eps_actual.toFixed(2)}</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        {surprise !== null
                          ? <span className={cn('font-medium', surprisePositive ? 'text-emerald-400' : 'text-red-400')}>
                              {surprisePositive ? '+' : ''}{surprise.toFixed(1)}%
                            </span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-slate-300">
                        ${(e.revenue_estimated / 1e9).toFixed(2)}B
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        {e.revenue_actual !== null
                          ? <span className="text-slate-300">${(e.revenue_actual / 1e9).toFixed(2)}B</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analyst price targets */}
      {!isLoading && estimates.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-white">Analyst Price Targets</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Analyst</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Firm</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Rating</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Price Target</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Published</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {estimates.map((est, idx) => {
                  const ratingColor =
                    est.rating?.toLowerCase().includes('buy') || est.rating?.toLowerCase().includes('outperform')
                      ? 'text-emerald-400'
                      : est.rating?.toLowerCase().includes('sell') || est.rating?.toLowerCase().includes('underperform')
                        ? 'text-red-400'
                        : 'text-slate-300';
                  return (
                    <tr key={idx} className="bg-slate-800 hover:bg-slate-750">
                      <td className="px-3 py-2 text-xs font-medium text-white">{est.analyst_name || '—'}</td>
                      <td className="px-3 py-2 text-xs text-slate-300">{est.analyst_company || '—'}</td>
                      <td className={cn('px-3 py-2 text-xs font-medium', ratingColor)}>{est.rating || '—'}</td>
                      <td className="px-3 py-2 text-right text-xs font-bold text-white">
                        {est.price_target ? `$${est.price_target.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-slate-400">{est.published_date || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && estimates.length === 0 && earnings.length === 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 py-12 text-center text-sm text-slate-500">
          <ChevronRight className="mx-auto mb-2 h-8 w-8 text-slate-600" />
          No estimates data available for{' '}
          <Link to={`/company/${selectedTicker}`} className="text-indigo-400 hover:underline">
            {selectedTicker}
          </Link>
          .
        </div>
      )}
    </div>
  );
}
