import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { EyeOff, Loader2, AlertTriangle, BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { useOHLCV } from '../hooks/useOHLCV';
import { cn, formatPrice } from '../lib/utils';
import type { OHLCVBar } from '../lib/types';

const QUICK_TICKERS = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL', 'AMZN', 'SPY', 'QQQ'];

function fmtVol(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Price/volume divergence: high volume day but small price move (block accumulation signal) */
function detectPVDivergence(bars: OHLCVBar[]): OHLCVBar[] {
  if (bars.length === 0) return [];
  const avgVol = bars.reduce((s, b) => s + b.volume, 0) / bars.length;
  const avgRange = bars.reduce((s, b) => s + Math.abs(b.close - b.open) / (b.open || 1), 0) / bars.length;
  return bars.filter(b => {
    const volRatio = b.volume / avgVol;
    const priceMove = Math.abs(b.close - b.open) / (b.open || 1);
    return volRatio >= 1.5 && priceMove < avgRange * 0.5;
  });
}

export function DarkPoolPage() {
  const [ticker, setTicker] = useState('AAPL');
  const [input, setInput] = useState('AAPL');

  const { data: ohlcvData, isLoading, error } = useOHLCV(ticker);

  const bars = ohlcvData?.bars ?? [];
  const recent = bars.slice(-30);

  const avgVolume = useMemo(() => {
    if (bars.length === 0) return 0;
    return bars.reduce((s, b) => s + b.volume, 0) / bars.length;
  }, [bars]);

  const maxVolume = useMemo(() => Math.max(...recent.map(b => b.volume), 1), [recent]);

  const pvDivergence = useMemo(() => detectPVDivergence(bars), [bars]);

  // Rolling 5-day volume sums to show trend
  const volumeTrend = useMemo(() => {
    const out: { label: string; vol: number }[] = [];
    for (let i = 4; i >= 0; i--) {
      const window = bars.slice(-(i + 1) * 5, bars.length - i * 5);
      const vol = window.reduce((s, b) => s + b.volume, 0);
      out.push({ label: `W-${i}`, vol });
    }
    return out;
  }, [bars]);

  const maxTrendVol = Math.max(...volumeTrend.map(w => w.vol), 1);

  function handleSearch() {
    const t = input.trim().toUpperCase();
    if (t) setTicker(t);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <EyeOff className="h-6 w-6 text-purple-400" />
          <h1 className="text-2xl font-bold text-white">Dark Pool Activity</h1>
        </div>
        <p className="text-slate-400 text-sm">
          Volume trend analysis and price/volume divergence signals.
        </p>
      </div>

      {/* Coming soon banner */}
      <div className="flex items-center gap-3 rounded-lg border border-purple-500/40 bg-purple-500/10 px-4 py-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-purple-400" />
        <p className="text-sm text-purple-300">
          <span className="font-semibold">Dark pool data coming soon.</span>{' '}
          Off-exchange prints, FINRA ADF volume, and institutional block detection are in development.
          Currently showing: volume analysis and price/volume divergence.
        </p>
      </div>

      {/* Ticker input */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex">
          <input
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Ticker..."
            className="w-32 rounded-l-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
          />
          <button
            onClick={handleSearch}
            className="rounded-r-lg border border-l-0 border-slate-700 bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500"
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
                  ? 'bg-purple-600 text-white'
                  : 'border border-slate-700 bg-slate-800 text-slate-400 hover:text-white',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <Link to={`/company/${ticker}`} className="ml-auto text-xs text-purple-400 hover:text-purple-300">
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
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <p className="text-xs text-slate-400 mb-1">Avg Daily Volume</p>
              <p className="text-lg font-bold text-white">{fmtVol(avgVolume)}</p>
              <p className="text-xs text-slate-500 mt-0.5">{ticker}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <p className="text-xs text-slate-400 mb-1">Latest Volume</p>
              <p className={cn(
                'text-lg font-bold',
                bars.length > 0 && bars[bars.length - 1].volume > avgVolume ? 'text-purple-400' : 'text-white',
              )}>
                {bars.length > 0 ? fmtVol(bars[bars.length - 1].volume) : '—'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {bars.length > 0 && avgVolume > 0
                  ? `${(bars[bars.length - 1].volume / avgVolume).toFixed(1)}x avg`
                  : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <p className="text-xs text-slate-400 mb-1">P/V Divergence Days</p>
              <p className={cn('text-lg font-bold', pvDivergence.length > 0 ? 'text-amber-400' : 'text-white')}>
                {pvDivergence.length}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">High vol, small move</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <p className="text-xs text-slate-400 mb-1">Data Points</p>
              <p className="text-lg font-bold text-white">{bars.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">trading days</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Daily volume chart */}
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-purple-400" />
                <h2 className="text-sm font-semibold text-white">Daily Volume — Last 30 Days ({ticker})</h2>
              </div>
              <div className="flex items-end gap-0.5 overflow-x-auto pb-1" style={{ height: 100 }}>
                {recent.map((bar, i) => {
                  const pct = maxVolume > 0 ? (bar.volume / maxVolume) * 100 : 0;
                  const isAboveAvg = bar.volume > avgVolume;
                  const isPVDiv = pvDivergence.some(d => d.date === bar.date);
                  const isUp = bar.close >= bar.open;
                  return (
                    <div
                      key={bar.date + i}
                      className="flex-1 flex items-end"
                      style={{ minWidth: 6, height: '100%' }}
                      title={`${bar.date}: ${fmtVol(bar.volume)}`}
                    >
                      <div
                        className={cn(
                          'w-full rounded-t',
                          isPVDiv ? 'bg-amber-500' :
                          isAboveAvg ? 'bg-purple-500' :
                          isUp ? 'bg-emerald-600/50' : 'bg-red-600/50',
                        )}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              {/* Avg line indicator */}
              <div className="mt-1 text-[10px] text-slate-500 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-purple-500 inline-block" /> Above avg
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-amber-500 inline-block" /> P/V divergence
                </span>
              </div>
            </div>

            {/* 5-week rolling volume trend */}
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <h2 className="text-sm font-semibold text-white mb-3">5-Week Volume Trend — {ticker}</h2>
              <div className="space-y-2">
                {volumeTrend.map((w, i) => {
                  const pct = maxTrendVol > 0 ? (w.vol / maxTrendVol) * 100 : 0;
                  const isLatest = i === volumeTrend.length - 1;
                  return (
                    <div key={w.label} className="flex items-center gap-2 text-xs">
                      <span className="w-8 text-right text-slate-500">{w.label}</span>
                      <div className="flex-1 h-4 bg-slate-700 rounded overflow-hidden">
                        <div
                          className={cn('h-full rounded', isLatest ? 'bg-purple-500' : 'bg-slate-500/60')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={cn('w-20 text-right font-mono', isLatest ? 'text-purple-300' : 'text-slate-400')}>
                        {fmtVol(w.vol)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Price/Volume Divergence table */}
          <div className="rounded-lg border border-slate-700 bg-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-white">
                  Price/Volume Divergence — Potential Accumulation/Distribution
                </h2>
              </div>
              <span className="text-xs text-slate-500">{pvDivergence.length} events</span>
            </div>
            {pvDivergence.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                No P/V divergence detected in available data.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-900">
                    <tr className="text-slate-400">
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-right font-medium">Volume</th>
                      <th className="px-3 py-2 text-right font-medium">Vol / Avg</th>
                      <th className="px-3 py-2 text-right font-medium">Open</th>
                      <th className="px-3 py-2 text-right font-medium">Close</th>
                      <th className="px-3 py-2 text-right font-medium">Price Move</th>
                      <th className="px-3 py-2 text-center font-medium">Signal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {[...pvDivergence].reverse().slice(0, 20).map((bar, i) => {
                      const mult = avgVolume > 0 ? bar.volume / avgVolume : 0;
                      const priceMove = bar.open > 0 ? ((bar.close - bar.open) / bar.open) * 100 : 0;
                      const isUp = priceMove >= 0;
                      return (
                        <tr key={bar.date + i} className="bg-amber-500/5 hover:bg-amber-500/10">
                          <td className="px-3 py-2 font-mono text-slate-300">{bar.date}</td>
                          <td className="px-3 py-2 text-right font-mono text-amber-300">{fmtVol(bar.volume)}</td>
                          <td className="px-3 py-2 text-right font-mono text-amber-400 font-bold">{mult.toFixed(1)}x</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-300">{formatPrice(bar.open)}</td>
                          <td className={cn('px-3 py-2 text-right font-mono', isUp ? 'text-emerald-400' : 'text-red-400')}>
                            {formatPrice(bar.close)}
                          </td>
                          <td className={cn('px-3 py-2 text-right', isUp ? 'text-emerald-400' : 'text-red-400')}>
                            {priceMove >= 0 ? '+' : ''}{priceMove.toFixed(2)}%
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={cn(
                              'inline-flex items-center gap-0.5 text-[10px] font-semibold',
                              isUp ? 'text-emerald-400' : 'text-red-400',
                            )}>
                              {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {isUp ? 'Accum.' : 'Distrib.'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {!isLoading && !error && bars.length === 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-10 text-center">
          <p className="text-slate-400 text-sm">No volume data available for {ticker}.</p>
        </div>
      )}
    </div>
  );
}
