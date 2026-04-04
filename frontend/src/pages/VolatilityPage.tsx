import { useState, useMemo } from 'react';
import { Zap, Loader2, Search, AlertTriangle } from 'lucide-react';
import { useOHLCV } from '../hooks/useOHLCV';
import { useTechnicals } from '../hooks/useTechnicals';
import type { OHLCVBar } from '../lib/types';
import { cn } from '../lib/utils';

const DEFAULT_TICKERS = ['SPY', 'QQQ', 'NVDA', 'TSLA', 'AAPL', 'AMZN', 'META', 'AMD'];

function computeHistoricalVol(bars: OHLCVBar[], window: number): number | null {
  if (bars.length < window + 1) return null;
  const recent = bars.slice(-(window + 1));
  const logReturns: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    if (recent[i - 1].close > 0 && recent[i].close > 0) {
      logReturns.push(Math.log(recent[i].close / recent[i - 1].close));
    }
  }
  if (logReturns.length < 2) return null;
  const mean = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
  const variance =
    logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (logReturns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function computeDailyReturns(bars: OHLCVBar[]): { date: string; ret: number }[] {
  const result: { date: string; ret: number }[] = [];
  for (let i = 1; i < bars.length; i++) {
    if (bars[i - 1].close > 0) {
      result.push({
        date: bars[i].date,
        ret: ((bars[i].close - bars[i - 1].close) / bars[i - 1].close) * 100,
      });
    }
  }
  return result;
}

function volRegime(hv: number): { label: string; color: string; bg: string } {
  if (hv < 15) return { label: 'Low', color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/30' };
  if (hv < 25) return { label: 'Normal', color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/30' };
  if (hv < 35) return { label: 'Elevated', color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30' };
  if (hv < 50) return { label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/20 border-orange-500/30' };
  return { label: 'Extreme', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' };
}

export function VolatilityPage() {
  const [ticker, setTicker] = useState('SPY');
  const [input, setInput] = useState('');

  const ohlcvQ = useOHLCV(ticker);
  const techQ = useTechnicals(ticker);

  const bars = ohlcvQ.data?.bars ?? [];
  const indicators = techQ.data?.data?.indicators;

  const hv20 = useMemo(() => computeHistoricalVol(bars, 20), [bars]);
  const hv60 = useMemo(() => computeHistoricalVol(bars, 60), [bars]);
  const dailyReturns = useMemo(() => computeDailyReturns(bars), [bars]);

  // ATR from technicals
  const atr = indicators?.atr ?? null;

  // Bollinger Band width as implied vol proxy: (upper - lower) / middle * 100
  const bb = indicators?.bollinger_bands;
  const bbWidth =
    bb && bb.middle > 0 ? ((bb.upper - bb.lower) / bb.middle) * 100 : null;

  const currentPrice = bars.length > 0 ? bars[bars.length - 1].close : null;
  const atrPct = atr !== null && currentPrice ? (atr / currentPrice) * 100 : null;

  const regime = hv20 !== null ? volRegime(hv20) : null;

  // IV premium: BB-width proxy minus HV20
  const ivPremium = bbWidth !== null && hv20 !== null ? bbWidth - hv20 : null;

  const isLoading = ohlcvQ.isLoading || techQ.isLoading;
  const isError = ohlcvQ.isError || techQ.isError;
  const errorMsg =
    (ohlcvQ.error as Error)?.message ??
    (techQ.error as Error)?.message ??
    'Unknown error';

  const handleSearch = () => {
    const t = input.trim().toUpperCase();
    if (t) { setTicker(t); setInput(''); }
  };

  // Prepare return distribution for histogram
  const maxAbsRet = dailyReturns.length > 0
    ? Math.max(...dailyReturns.map((r) => Math.abs(r.ret)))
    : 5;
  const histBuckets = 20;
  const histStep = (maxAbsRet * 2) / histBuckets;
  const histogram = Array.from({ length: histBuckets }, (_, i) => {
    const low = -maxAbsRet + i * histStep;
    const high = low + histStep;
    const count = dailyReturns.filter((r) => r.ret >= low && r.ret < high).length;
    return { low, high, mid: (low + high) / 2, count };
  });
  const maxHistCount = Math.max(...histogram.map((h) => h.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Zap className="h-6 w-6 text-yellow-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Volatility Dashboard</h1>
          <p className="text-sm text-slate-400">
            Historical volatility, ATR, Bollinger Band width, and return distribution
          </p>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="Ticker..."
            className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-yellow-500 focus:outline-none"
          />
        </div>
        <button
          onClick={handleSearch}
          className="rounded-lg bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-500"
        >
          Load
        </button>
        <div className="flex flex-wrap gap-1">
          {DEFAULT_TICKERS.map((t) => (
            <button
              key={t}
              onClick={() => setTicker(t)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-medium',
                ticker === t
                  ? 'bg-yellow-600 text-white'
                  : 'border border-slate-700 text-slate-400 hover:text-white'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-12 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Computing volatility for {ticker}…</span>
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-700/50 bg-red-900/20 p-4 text-sm text-red-400">
          Failed to load data: {errorMsg}
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Headline metrics */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">HV 20-Day (Ann.)</div>
              <div className="mt-1 text-2xl font-bold text-white">
                {hv20 !== null ? `${hv20.toFixed(1)}%` : '—'}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500">
                Std of daily log returns × √252
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">HV 60-Day (Ann.)</div>
              <div className="mt-1 text-2xl font-bold text-white">
                {hv60 !== null ? `${hv60.toFixed(1)}%` : '—'}
              </div>
              {hv20 !== null && hv60 !== null && (
                <div
                  className={cn(
                    'mt-0.5 text-[10px] font-medium',
                    hv20 > hv60 ? 'text-red-400' : 'text-emerald-400'
                  )}
                >
                  {hv20 > hv60
                    ? `Short-term elevated (+${(hv20 - hv60).toFixed(1)}%)`
                    : `Compressed vs 60d (-${(hv60 - hv20).toFixed(1)}%)`}
                </div>
              )}
            </div>

            {regime && hv20 !== null ? (
              <div className={cn('rounded-xl border p-4', regime.bg)}>
                <div className="text-xs uppercase tracking-wider text-slate-500">Vol Regime</div>
                <div className={cn('mt-1 text-2xl font-bold', regime.color)}>{regime.label}</div>
                <div className="mt-0.5 text-[10px] text-slate-500">Based on HV20</div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500">Vol Regime</div>
                <div className="mt-1 text-2xl font-bold text-slate-600">—</div>
              </div>
            )}

            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">ATR</div>
              <div className="mt-1 text-2xl font-bold text-amber-400">
                {atr !== null ? `$${atr.toFixed(2)}` : '—'}
              </div>
              {atrPct !== null && (
                <div className="mt-0.5 text-[10px] text-slate-500">
                  {atrPct.toFixed(2)}% of price
                </div>
              )}
            </div>
          </div>

          {/* Bollinger Band width vs HV comparison */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <h3 className="mb-3 text-sm font-semibold text-white">
                Implied Vol Proxy (Bollinger Width)
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">BB Upper</span>
                  <span className="font-medium text-white">
                    {bb ? `$${bb.upper.toFixed(2)}` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">BB Middle</span>
                  <span className="font-medium text-white">
                    {bb ? `$${bb.middle.toFixed(2)}` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">BB Lower</span>
                  <span className="font-medium text-white">
                    {bb ? `$${bb.lower.toFixed(2)}` : '—'}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-700 pt-2">
                  <span className="text-slate-400">BB Width (IV proxy)</span>
                  <span className="font-bold text-yellow-400">
                    {bbWidth !== null ? `${bbWidth.toFixed(2)}%` : '—'}
                  </span>
                </div>
                {ivPremium !== null && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">IV Premium vs HV20</span>
                    <span
                      className={cn(
                        'font-bold',
                        ivPremium > 0 ? 'text-amber-400' : 'text-cyan-400'
                      )}
                    >
                      {ivPremium > 0 ? '+' : ''}
                      {ivPremium.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <h3 className="mb-3 text-sm font-semibold text-white">Vol Comparison</h3>
              {hv20 !== null || hv60 !== null || bbWidth !== null ? (
                <div className="space-y-2">
                  {[
                    { label: 'HV 20d', value: hv20, color: 'bg-blue-500/50' },
                    { label: 'HV 60d', value: hv60, color: 'bg-indigo-500/50' },
                    { label: 'BB Width (IV proxy)', value: bbWidth, color: 'bg-yellow-500/50' },
                  ].map((row) => {
                    const maxVal = Math.max(hv20 ?? 0, hv60 ?? 0, bbWidth ?? 0);
                    const width = row.value !== null && maxVal > 0 ? (row.value / maxVal) * 100 : 0;
                    return (
                      <div key={row.label}>
                        <div className="mb-1 flex justify-between text-[10px]">
                          <span className="text-slate-400">{row.label}</span>
                          <span className="text-white">
                            {row.value !== null ? `${row.value.toFixed(1)}%` : '—'}
                          </span>
                        </div>
                        <div className="h-3 rounded-full bg-slate-700">
                          <div
                            className={cn('h-3 rounded-full', row.color)}
                            style={{ width: `${Math.max(2, width)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Insufficient data for {ticker}.</p>
              )}
            </div>
          </div>

          {/* High volatility warning */}
          {hv20 !== null && hv20 > 35 && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-400" />
              <p className="text-sm text-amber-300">
                {ticker} is in an elevated volatility regime (HV20 = {hv20.toFixed(1)}%). Options
                premiums are likely inflated. Consider this when sizing positions.
              </p>
            </div>
          )}

          {/* Daily return distribution histogram */}
          {dailyReturns.length > 0 && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <h3 className="mb-3 text-sm font-semibold text-white">
                Daily Return Distribution ({dailyReturns.length} sessions)
              </h3>
              <div className="flex items-end gap-0.5" style={{ height: '80px' }}>
                {histogram.map((h, i) => {
                  const barH = (h.count / maxHistCount) * 70;
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
                      <div
                        className={cn(
                          'w-full rounded-t',
                          h.mid < 0 ? 'bg-red-500/50' : h.mid > 0 ? 'bg-emerald-500/50' : 'bg-slate-500/50'
                        )}
                        style={{ height: `${Math.max(2, barH)}px` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 flex justify-between text-[9px] text-slate-600">
                <span>{(-maxAbsRet).toFixed(1)}%</span>
                <span>0%</span>
                <span>+{maxAbsRet.toFixed(1)}%</span>
              </div>
            </div>
          )}

          {/* Historical vol table */}
          {dailyReturns.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-white">
                Rolling Historical Volatility
              </h2>
              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-700 bg-slate-800/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Date</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Daily Return</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">HV 20-Day</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">HV 60-Day</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">BB Width (IV proxy)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {[...dailyReturns].reverse().slice(0, 20).map((r, idx, _arr) => {
                      const barIdx = bars.length - 1 - idx;
                      const hv20row =
                        barIdx >= 20 ? computeHistoricalVol(bars.slice(0, barIdx + 1), 20) : null;
                      const hv60row =
                        barIdx >= 60 ? computeHistoricalVol(bars.slice(0, barIdx + 1), 60) : null;
                      return (
                        <tr key={r.date} className="bg-slate-800 hover:bg-slate-700/40">
                          <td className="px-3 py-2 text-xs text-slate-400">{r.date}</td>
                          <td
                            className={cn(
                              'px-3 py-2 text-right text-xs font-medium',
                              r.ret >= 0 ? 'text-emerald-400' : 'text-red-400'
                            )}
                          >
                            {r.ret >= 0 ? '+' : ''}
                            {r.ret.toFixed(2)}%
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-slate-300">
                            {hv20row !== null ? `${hv20row.toFixed(1)}%` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-slate-300">
                            {hv60row !== null ? `${hv60row.toFixed(1)}%` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-yellow-400">
                            {bbWidth !== null && idx === 0 ? `${bbWidth.toFixed(2)}%` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {bars.length === 0 && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-10 text-center text-sm text-slate-500">
              No OHLCV data available for {ticker}.
            </div>
          )}
        </>
      )}
    </div>
  );
}
