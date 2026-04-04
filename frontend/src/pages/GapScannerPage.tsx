import { useState, useMemo } from 'react';
import { ArrowUpDown, TrendingUp, TrendingDown, Loader2, Search } from 'lucide-react';
import { useOHLCV } from '../hooks/useOHLCV';
import type { OHLCVBar } from '../lib/types';
import { cn } from '../lib/utils';

const DEFAULT_TICKERS = ['SPY', 'QQQ', 'NVDA', 'TSLA', 'AAPL', 'AMZN', 'META', 'AMD'];
const GAP_THRESHOLD = 0.02; // 2%

type GapFilter = 'All' | 'Up' | 'Down' | 'Filled' | 'Unfilled';

interface GapEvent {
  bar: OHLCVBar;
  prevClose: number;
  gapPct: number;
  direction: 'Up' | 'Down';
  filled: boolean;
}

function detectGaps(bars: OHLCVBar[]): GapEvent[] {
  const gaps: GapEvent[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1];
    const cur = bars[i];
    const gapPct = (cur.open - prev.close) / prev.close;
    if (Math.abs(gapPct) >= GAP_THRESHOLD) {
      // Gap is "filled" if the current bar's range crosses back to prev close
      const filled =
        gapPct > 0
          ? cur.low <= prev.close  // gap up filled when price dips back to prev close
          : cur.high >= prev.close; // gap down filled when price rises back to prev close
      gaps.push({
        bar: cur,
        prevClose: prev.close,
        gapPct: gapPct * 100,
        direction: gapPct > 0 ? 'Up' : 'Down',
        filled,
      });
    }
  }
  return gaps.reverse(); // most recent first
}

export function GapScannerPage() {
  const [ticker, setTicker] = useState('SPY');
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<GapFilter>('All');
  const [minGap, setMinGap] = useState(2);

  const { data, isLoading, isError, error } = useOHLCV(ticker);

  const gaps = useMemo(() => {
    const bars = data?.bars ?? [];
    return detectGaps(bars);
  }, [data]);

  const filtered = useMemo(() => {
    return gaps
      .filter((g) => {
        if (filter === 'Up') return g.direction === 'Up';
        if (filter === 'Down') return g.direction === 'Down';
        if (filter === 'Filled') return g.filled;
        if (filter === 'Unfilled') return !g.filled;
        return true;
      })
      .filter((g) => Math.abs(g.gapPct) >= minGap);
  }, [gaps, filter, minGap]);

  const gapUps = gaps.filter((g) => g.direction === 'Up').length;
  const gapDowns = gaps.filter((g) => g.direction === 'Down').length;
  const avgGapSize =
    gaps.length > 0
      ? gaps.reduce((s, g) => s + Math.abs(g.gapPct), 0) / gaps.length
      : 0;
  const fillRate =
    gaps.length > 0 ? (gaps.filter((g) => g.filled).length / gaps.length) * 100 : 0;

  const handleSearch = () => {
    const t = input.trim().toUpperCase();
    if (t) { setTicker(t); setInput(''); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ArrowUpDown className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Gap Scanner</h1>
          <p className="text-sm text-slate-400">
            Detect gap ups / downs (&ge;2%) from OHLCV data and track fill status
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
            className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <button
          onClick={handleSearch}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
        >
          Scan
        </button>
        <div className="flex flex-wrap gap-1">
          {DEFAULT_TICKERS.map((t) => (
            <button
              key={t}
              onClick={() => setTicker(t)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-medium',
                ticker === t
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-700 text-slate-400 hover:text-white'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-12 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Scanning gaps for {ticker}…</span>
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-700/50 bg-red-900/20 p-4 text-sm text-red-400">
          Failed to load OHLCV data: {(error as Error)?.message ?? 'Unknown error'}
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Summary */}
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">Gap Ups</div>
              <div className="mt-1 text-2xl font-bold text-emerald-400">{gapUps}</div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">Gap Downs</div>
              <div className="mt-1 text-2xl font-bold text-red-400">{gapDowns}</div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">Avg Gap Size</div>
              <div className="mt-1 text-2xl font-bold text-white">{avgGapSize.toFixed(1)}%</div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">Fill Rate</div>
              <div className="mt-1 text-2xl font-bold text-amber-400">{fillRate.toFixed(0)}%</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
              {(['All', 'Up', 'Down', 'Filled', 'Unfilled'] as GapFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium',
                    filter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <select
              value={minGap}
              onChange={(e) => setMinGap(Number(e.target.value))}
              className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value={2}>2%+</option>
              <option value={3}>3%+</option>
              <option value={5}>5%+</option>
              <option value={10}>10%+</option>
            </select>
            <span className="text-xs text-slate-500">
              {data?.count ?? 0} bars loaded · {gaps.length} gaps detected
            </span>
          </div>

          {gaps.length === 0 ? (
            <div className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-10 text-center text-sm text-slate-500">
              No gaps &ge;{minGap}% detected in the loaded OHLCV history for {ticker}.
            </div>
          ) : (
            <>
              {/* Gap cards */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.slice(0, 9).map((g, i) => {
                  const fillPct = g.filled
                    ? 100
                    : Math.min(
                        99,
                        Math.abs(
                          ((g.direction === 'Up' ? g.bar.low : g.bar.high) - g.prevClose) /
                            (g.bar.open - g.prevClose)
                        ) * 100
                      );
                  return (
                    <div
                      key={`${g.bar.date}-${i}`}
                      className={cn(
                        'rounded-xl border bg-slate-800 p-4',
                        g.direction === 'Up' ? 'border-emerald-700/50' : 'border-red-700/50'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-white">{ticker}</span>
                          <span className="text-[10px] text-slate-500">{g.bar.date}</span>
                        </div>
                        <span
                          className={cn(
                            'flex items-center gap-0.5 text-sm font-bold',
                            g.direction === 'Up' ? 'text-emerald-400' : 'text-red-400'
                          )}
                        >
                          {g.direction === 'Up' ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5" />
                          )}
                          {g.gapPct > 0 ? '+' : ''}
                          {g.gapPct.toFixed(2)}%
                        </span>
                      </div>
                      <div className="mt-2 flex justify-between text-xs text-slate-500">
                        <span>Prev: ${g.prevClose.toFixed(2)}</span>
                        <span>Open: ${g.bar.open.toFixed(2)}</span>
                        <span>Close: ${g.bar.close.toFixed(2)}</span>
                      </div>
                      <div className="mt-2">
                        <div className="mb-1 flex justify-between text-[10px]">
                          <span className="text-slate-500">Gap Fill</span>
                          <span className={g.filled ? 'text-amber-400' : 'text-slate-400'}>
                            {g.filled ? 'Filled' : `~${fillPct.toFixed(0)}%`}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-700">
                          <div
                            className={cn(
                              'h-2 rounded-full',
                              g.filled ? 'bg-amber-500/60' : 'bg-indigo-500/60'
                            )}
                            style={{ width: `${Math.max(2, fillPct)}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                        <span>Vol: {(g.bar.volume / 1e6).toFixed(1)}M</span>
                        <span>H: ${g.bar.high.toFixed(2)} / L: ${g.bar.low.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Full table */}
              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-700 bg-slate-800/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Date</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Type</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Gap %</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Prev Close</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Open</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">High</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Low</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Close</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Volume</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Filled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {filtered.map((g, i) => (
                      <tr key={`${g.bar.date}-${i}`} className="bg-slate-800 hover:bg-slate-700/40">
                        <td className="px-3 py-2 text-xs text-slate-400">{g.bar.date}</td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-medium',
                              g.direction === 'Up'
                                ? 'bg-emerald-900/40 text-emerald-400'
                                : 'bg-red-900/40 text-red-400'
                            )}
                          >
                            Gap {g.direction}
                          </span>
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2 text-right text-xs font-bold',
                            g.direction === 'Up' ? 'text-emerald-400' : 'text-red-400'
                          )}
                        >
                          {g.gapPct > 0 ? '+' : ''}
                          {g.gapPct.toFixed(2)}%
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-slate-300">
                          ${g.prevClose.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-slate-300">
                          ${g.bar.open.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-emerald-400">
                          ${g.bar.high.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-red-400">
                          ${g.bar.low.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-medium text-white">
                          ${g.bar.close.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-slate-400">
                          {(g.bar.volume / 1e6).toFixed(1)}M
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px] font-bold',
                              g.filled
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-slate-700 text-slate-500'
                            )}
                          >
                            {g.filled ? 'Yes' : 'No'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
