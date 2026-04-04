import { useState, useMemo } from 'react';
import { Zap, Loader2, AlertTriangle, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOHLCV } from '../hooks/useOHLCV';
import { cn } from '../lib/utils';
import type { OHLCVBar } from '../lib/types';

const QUICK_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'AMZN', 'SPY', 'QQQ'];

function fmtVol(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function computeAvgVolume(bars: OHLCVBar[]): number {
  if (bars.length === 0) return 0;
  return bars.reduce((s, b) => s + b.volume, 0) / bars.length;
}

function detectUnusualDays(bars: OHLCVBar[], multiplier = 2): OHLCVBar[] {
  const avg = computeAvgVolume(bars);
  if (avg === 0) return [];
  return bars.filter(b => b.volume >= avg * multiplier);
}

export function OptionsFlowPage() {
  const [ticker, setTicker] = useState('AAPL');
  const [input, setInput] = useState('AAPL');
  const [threshold, setThreshold] = useState(2);

  const { data: ohlcvData, isLoading, error } = useOHLCV(ticker);

  const bars = ohlcvData?.bars ?? [];
  const avgVolume = useMemo(() => computeAvgVolume(bars), [bars]);
  const unusualDays = useMemo(() => detectUnusualDays(bars, threshold), [bars, threshold]);
  const maxVolume = useMemo(() => Math.max(...bars.map(b => b.volume), 1), [bars]);

  // Volume trend: last 5 bars vs prior 5
  const recent5 = bars.slice(-5);
  const prior5 = bars.slice(-10, -5);
  const recentAvg = recent5.length ? recent5.reduce((s, b) => s + b.volume, 0) / recent5.length : 0;
  const priorAvg = prior5.length ? prior5.reduce((s, b) => s + b.volume, 0) / prior5.length : 0;
  const volumeTrend = priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : 0;

  function handleSearch() {
    const t = input.trim().toUpperCase();
    if (t) setTicker(t);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Zap className="h-6 w-6 text-amber-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Options Flow</h1>
          <p className="text-sm text-slate-400">Unusual volume detection and activity analysis</p>
        </div>
      </div>

      {/* Coming soon banner */}
      <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-sm text-amber-300">
          <span className="font-semibold">Options flow data coming soon.</span>{' '}
          Live dark pool prints, sweep detection, and block trade flow are in development.
          Showing volume analysis as a proxy signal.
        </p>
      </div>

      {/* Ticker search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex">
          <input
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Ticker..."
            className="w-28 rounded-l-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
          <button
            onClick={handleSearch}
            className="rounded-r-lg border border-l-0 border-slate-700 bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
          >
            Go
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TICKERS.map(t => (
            <button
              key={t}
              onClick={() => { setTicker(t); setInput(t); }}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition',
                t === ticker
                  ? 'bg-amber-600 text-white'
                  : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <Link to={`/company/${ticker}`} className="ml-auto text-xs text-amber-400 hover:text-amber-300">
          View {ticker} profile &rarr;
        </Link>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading volume data for {ticker}...</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Failed to load data for {ticker}.
        </div>
      )}

      {!isLoading && bars.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Avg Daily Volume</p>
              <p className="mt-1 text-lg font-bold text-white">{fmtVol(avgVolume)}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Unusual Days ({threshold}x+)</p>
              <p className={cn('mt-1 text-lg font-bold', unusualDays.length > 0 ? 'text-amber-400' : 'text-white')}>
                {unusualDays.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Volume Trend (5D)</p>
              <p className={cn('mt-1 text-lg font-bold', volumeTrend >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {volumeTrend >= 0 ? '+' : ''}{volumeTrend.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Bars Loaded</p>
              <p className="mt-1 text-lg font-bold text-white">{bars.length}</p>
            </div>
          </div>

          {/* Threshold control */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Unusual threshold:</span>
            {[1.5, 2, 3, 5].map(v => (
              <button
                key={v}
                onClick={() => setThreshold(v)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium border transition',
                  threshold === v
                    ? 'border-amber-500 bg-amber-600/20 text-amber-300'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white',
                )}
              >
                {v}x avg
              </button>
            ))}
          </div>

          {/* Volume bar chart */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Daily Volume — {ticker}</h3>
            </div>
            <div className="flex items-end gap-0.5 overflow-x-auto pb-1" style={{ height: 120 }}>
              {bars.slice(-60).map((bar, i) => {
                const pct = maxVolume > 0 ? (bar.volume / maxVolume) * 100 : 0;
                const isUnusual = bar.volume >= avgVolume * threshold;
                const isUp = bar.close >= bar.open;
                return (
                  <div
                    key={bar.date + i}
                    className="group relative flex-1"
                    style={{ minWidth: 4, height: '100%', display: 'flex', alignItems: 'flex-end' }}
                    title={`${bar.date}: ${fmtVol(bar.volume)} (${(bar.volume / avgVolume).toFixed(1)}x avg)`}
                  >
                    <div
                      className={cn(
                        'w-full rounded-t transition-opacity',
                        isUnusual
                          ? 'bg-amber-500'
                          : isUp ? 'bg-emerald-600/60' : 'bg-red-600/60',
                      )}
                      style={{ height: `${pct}%` }}
                    />
                    {isUnusual && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 hidden group-hover:block rounded bg-slate-900 px-1 py-0.5 text-[9px] text-amber-400 whitespace-nowrap border border-slate-700 z-10">
                        {(bar.volume / avgVolume).toFixed(1)}x
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex items-center gap-4 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500 inline-block" /> Unusual ({threshold}x+)</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-600/60 inline-block" /> Up day</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-600/60 inline-block" /> Down day</span>
            </div>
          </div>

          {/* Unusual days table */}
          {unusualDays.length > 0 && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">
                  Unusual Volume Days — {unusualDays.length} event{unusualDays.length !== 1 ? 's' : ''}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-900">
                    <tr className="text-slate-400">
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-right font-medium">Volume</th>
                      <th className="px-3 py-2 text-right font-medium">vs Avg</th>
                      <th className="px-3 py-2 text-right font-medium">Open</th>
                      <th className="px-3 py-2 text-right font-medium">Close</th>
                      <th className="px-3 py-2 text-right font-medium">Range</th>
                      <th className="px-3 py-2 text-center font-medium">Direction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {[...unusualDays].reverse().map((bar, i) => {
                      const mult = avgVolume > 0 ? bar.volume / avgVolume : 0;
                      const isUp = bar.close >= bar.open;
                      const rangePct = bar.open > 0 ? ((bar.high - bar.low) / bar.open) * 100 : 0;
                      return (
                        <tr key={bar.date + i} className="bg-amber-500/5 hover:bg-amber-500/10">
                          <td className="px-3 py-2 font-mono text-slate-300">{bar.date}</td>
                          <td className="px-3 py-2 text-right font-mono text-amber-300 font-semibold">
                            {fmtVol(bar.volume)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-amber-400 font-bold">
                            {mult.toFixed(1)}x
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-300">
                            ${bar.open.toFixed(2)}
                          </td>
                          <td className={cn('px-3 py-2 text-right font-mono font-semibold', isUp ? 'text-emerald-400' : 'text-red-400')}>
                            ${bar.close.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-400">{rangePct.toFixed(2)}%</td>
                          <td className="px-3 py-2 text-center">
                            {isUp ? (
                              <span className="inline-flex items-center gap-0.5 text-emerald-400">
                                <TrendingUp className="h-3 w-3" /> Up
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-red-400">
                                <TrendingDown className="h-3 w-3" /> Down
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {unusualDays.length === 0 && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-8 text-center">
              <p className="text-slate-400 text-sm">
                No unusual volume days detected at {threshold}x threshold in available data.
              </p>
            </div>
          )}
        </>
      )}

      {!isLoading && !error && bars.length === 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-10 text-center">
          <p className="text-slate-400 text-sm">No OHLCV data available for {ticker}.</p>
        </div>
      )}
    </div>
  );
}
