import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Grid3X3, Plus, X, BarChart3, Loader2 } from 'lucide-react';
import { eugeneApi } from '../lib/api';
import { cn } from '../lib/utils';
import type { OHLCVData, OHLCVBar } from '../lib/types';

// ─── Math helpers ─────────────────────────────────────────────────────

function dailyReturns(bars: OHLCVBar[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    if (bars[i - 1].close > 0) {
      out.push((bars[i].close - bars[i - 1].close) / bars[i - 1].close);
    }
  }
  return out;
}

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const ax = a.slice(a.length - n);
  const bx = b.slice(b.length - n);
  const meanA = ax.reduce((s, v) => s + v, 0) / n;
  const meanB = bx.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const ea = ax[i] - meanA;
    const eb = bx[i] - meanB;
    num += ea * eb;
    da += ea * ea;
    db += eb * eb;
  }
  const denom = Math.sqrt(da * db);
  return denom === 0 ? 0 : Math.max(-1, Math.min(1, num / denom));
}

// ─── Color helpers ────────────────────────────────────────────────────

function corrBgClass(v: number): string {
  if (v >= 0.7) return 'bg-green-700/80 text-green-100';
  if (v >= 0.4) return 'bg-green-600/50 text-green-200';
  if (v >= 0.1) return 'bg-green-500/20 text-green-300';
  if (v > -0.1) return 'bg-slate-600/40 text-slate-300';
  if (v > -0.4) return 'bg-red-500/20 text-red-300';
  if (v > -0.7) return 'bg-red-600/50 text-red-200';
  return 'bg-red-700/80 text-red-100';
}

// ─── Constants ────────────────────────────────────────────────────────

const DEFAULT_TICKERS = ['SPY', 'QQQ', 'TLT', 'GLD', 'AAPL', 'NVDA', 'JPM', 'XOM'];

const PRESETS: { label: string; tickers: string[] }[] = [
  { label: 'US Equities', tickers: ['SPY', 'QQQ', 'IWM', 'DIA', 'VTI'] },
  { label: 'Cross-Asset', tickers: ['SPY', 'TLT', 'GLD', 'USO', 'DXY'] },
  { label: 'Tech Giants', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META'] },
  { label: 'Sectors', tickers: ['XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLP'] },
];

// ─── Per-ticker OHLCV fetch ───────────────────────────────────────────

function useTickerOHLCV(ticker: string) {
  return useQuery({
    queryKey: ['ohlcv', ticker],
    queryFn: () => eugeneApi<OHLCVData>(`/v1/sec/${ticker}/ohlcv`),
    enabled: !!ticker,
    staleTime: 60 * 1000,
  });
}

// TickerLoader removed — data fetching handled via queryResults

// ─── Main page ────────────────────────────────────────────────────────

export function CorrelationPage() {
  const [tickers, setTickers] = useState<string[]>(DEFAULT_TICKERS);
  const [tickerInput, setTickerInput] = useState('');
  const [hoveredCell, setHoveredCell] = useState<{ r: number; c: number } | null>(null);
  const [selectedPair, setSelectedPair] = useState<[string, string] | null>(null);

  // Fetch all tickers via individual queries (Rules of Hooks: fixed list, stable call count per render)
  const q0 = useTickerOHLCV(tickers[0] ?? '');
  const q1 = useTickerOHLCV(tickers[1] ?? '');
  const q2 = useTickerOHLCV(tickers[2] ?? '');
  const q3 = useTickerOHLCV(tickers[3] ?? '');
  const q4 = useTickerOHLCV(tickers[4] ?? '');
  const q5 = useTickerOHLCV(tickers[5] ?? '');
  const q6 = useTickerOHLCV(tickers[6] ?? '');
  const q7 = useTickerOHLCV(tickers[7] ?? '');
  const q8 = useTickerOHLCV(tickers[8] ?? '');
  const q9 = useTickerOHLCV(tickers[9] ?? '');

  const queryResults = [q0, q1, q2, q3, q4, q5, q6, q7, q8, q9].slice(0, 10);

  const returnsMap = useMemo(() => {
    const map: Record<string, number[]> = {};
    tickers.forEach((t, i) => {
      const bars = queryResults[i]?.data?.bars;
      if (bars && bars.length > 1) {
        map[t] = dailyReturns(bars);
      }
    });
    return map;
  }, [tickers, q0.data, q1.data, q2.data, q3.data, q4.data, q5.data, q6.data, q7.data, q8.data, q9.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadingTickers = tickers.filter((_t, i) => queryResults[i]?.isLoading);
  const readyTickers = tickers.filter((t) => !!returnsMap[t]);

  const matrix = useMemo(() => {
    return readyTickers.map((a) =>
      readyTickers.map((b) =>
        a === b ? 1 : pearsonCorrelation(returnsMap[a] ?? [], returnsMap[b] ?? []),
      ),
    );
  }, [readyTickers, returnsMap]);

  const insights = useMemo(() => {
    if (readyTickers.length < 2) return null;
    let maxCorr = -2, mostNeg = 2;
    let maxPair: [string, string] = [readyTickers[0], readyTickers[1]];
    let negPair: [string, string] = [readyTickers[0], readyTickers[1]];
    let minAbsCorr = 2;
    let minPair: [string, string] = [readyTickers[0], readyTickers[1]];
    let sum = 0, count = 0;

    for (let i = 0; i < readyTickers.length; i++) {
      for (let j = i + 1; j < readyTickers.length; j++) {
        const v = matrix[i][j];
        sum += v;
        count++;
        if (v > maxCorr) { maxCorr = v; maxPair = [readyTickers[i], readyTickers[j]]; }
        if (v < mostNeg) { mostNeg = v; negPair = [readyTickers[i], readyTickers[j]]; }
        if (Math.abs(v) < minAbsCorr) { minAbsCorr = Math.abs(v); minPair = [readyTickers[i], readyTickers[j]]; }
      }
    }
    return {
      mostCorrelated: { pair: maxPair, value: maxCorr },
      leastCorrelated: { pair: minPair, value: minAbsCorr },
      bestHedge: { pair: negPair, value: mostNeg },
      average: count > 0 ? sum / count : 0,
    };
  }, [readyTickers, matrix]);

  const addTicker = () => {
    const t = tickerInput.trim().toUpperCase();
    if (t && !tickers.includes(t) && tickers.length < 10) {
      setTickers((prev) => [...prev, t]);
    }
    setTickerInput('');
  };

  const removeTicker = (t: string) => {
    setTickers((prev) => prev.filter((x) => x !== t));
    if (selectedPair && selectedPair.includes(t)) setSelectedPair(null);
  };

  const applyPreset = (pts: string[]) => {
    setTickers(pts.slice(0, 10));
    setSelectedPair(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Grid3X3 className="h-6 w-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Correlation Matrix</h1>
        </div>
        <p className="text-slate-400 text-sm">
          Pairwise correlation computed from daily returns. Real OHLCV data, no seeds.
        </p>
      </div>

      {/* Asset selector */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {tickers.map((t) => (
            <span
              key={t}
              className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium',
                returnsMap[t]
                  ? 'bg-slate-700 text-slate-200'
                  : loadingTickers.includes(t)
                  ? 'bg-slate-700/50 text-slate-400'
                  : 'bg-red-900/30 text-red-400',
              )}
            >
              {loadingTickers.includes(t) && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
              {t}
              <button onClick={() => removeTicker(t)} className="text-slate-400 hover:text-red-400">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {tickers.length < 10 && (
            <form
              onSubmit={(e) => { e.preventDefault(); addTicker(); }}
              className="inline-flex items-center gap-1"
            >
              <input
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
                placeholder="Add ticker…"
                className="w-24 rounded bg-slate-900 border border-slate-600 px-2 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="rounded bg-blue-600 p-1 text-white hover:bg-blue-500"
              >
                <Plus className="h-3 w-3" />
              </button>
            </form>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">Presets:</span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.tickers)}
              className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading indicator */}
      {loadingTickers.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading {loadingTickers.join(', ')}…
        </div>
      )}

      {/* Matrix */}
      {readyTickers.length >= 2 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-1" />
                {readyTickers.map((t) => (
                  <th
                    key={t}
                    className="p-1 text-xs font-medium text-slate-400 text-center"
                    style={{ minWidth: readyTickers.length > 7 ? 44 : 56 }}
                  >
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {readyTickers.map((rowTicker, r) => (
                <tr key={rowTicker}>
                  <td className="p-1 text-xs font-medium text-slate-400 text-right pr-2 whitespace-nowrap">
                    {rowTicker}
                  </td>
                  {readyTickers.map((colTicker, c) => {
                    const v = matrix[r][c];
                    const isDiag = r === c;
                    const isHovered = hoveredCell?.r === r && hoveredCell?.c === c;
                    const isPairSelected =
                      selectedPair &&
                      selectedPair.includes(rowTicker) &&
                      selectedPair.includes(colTicker) &&
                      !isDiag;
                    return (
                      <td
                        key={colTicker}
                        className={cn(
                          'p-1 text-center text-xs font-mono cursor-pointer transition-all border border-slate-700/30',
                          isDiag ? 'bg-slate-900 text-slate-500' : corrBgClass(v),
                          isHovered && !isDiag && 'ring-1 ring-blue-400',
                          isPairSelected && 'ring-2 ring-yellow-400',
                        )}
                        style={{ minWidth: readyTickers.length > 7 ? 44 : 56 }}
                        onMouseEnter={() => setHoveredCell({ r, c })}
                        onMouseLeave={() => setHoveredCell(null)}
                        onClick={() => !isDiag && setSelectedPair([rowTicker, colTicker])}
                        title={`${rowTicker} / ${colTicker}: ${v.toFixed(4)}`}
                      >
                        {isDiag ? '1.00' : v.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
            <span>Color scale:</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-700/80" /> Strong negative</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-500/25" /> Weak negative</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-slate-600/40" /> Neutral</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-500/20" /> Weak positive</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-700/80" /> Strong positive</span>
          </div>
        </div>
      )}

      {readyTickers.length < 2 && loadingTickers.length === 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 text-center text-sm text-slate-500">
          Need at least 2 tickers with loaded data to show the matrix.
        </div>
      )}

      {/* Insights + pair detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Insights */}
        {insights && (
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-white">Correlation Insights</h2>
            <InsightRow
              label="Most Correlated"
              pair={insights.mostCorrelated.pair}
              value={insights.mostCorrelated.value}
              colorClass="text-green-400"
            />
            <InsightRow
              label="Best Diversifier"
              pair={insights.leastCorrelated.pair}
              value={insights.leastCorrelated.value}
              colorClass="text-slate-300"
            />
            <InsightRow
              label="Best Hedge"
              pair={insights.bestHedge.pair}
              value={insights.bestHedge.value}
              colorClass="text-red-400"
            />
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Average Correlation</span>
              <span className="font-mono text-slate-200">{insights.average.toFixed(3)}</span>
            </div>
          </div>
        )}

        {/* Rolling pair detail */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Pair Detail</h2>
          </div>
          {selectedPair ? (
            <>
              <p className="text-xs text-slate-400">
                {selectedPair[0]} vs {selectedPair[1]} — full sample correlation
              </p>
              {(() => {
                const a = returnsMap[selectedPair[0]] ?? [];
                const b = returnsMap[selectedPair[1]] ?? [];
                const corr = pearsonCorrelation(a, b);
                const n = Math.min(a.length, b.length);
                return (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Correlation</span>
                      <span className={cn('font-mono font-semibold', corr >= 0 ? 'text-green-400' : 'text-red-400')}>
                        {corr.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Shared observations</span>
                      <span className="font-mono text-slate-200">{n}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Interpretation</span>
                      <span className="text-slate-300 text-xs">
                        {Math.abs(corr) >= 0.7 ? 'Strong' : Math.abs(corr) >= 0.4 ? 'Moderate' : Math.abs(corr) >= 0.1 ? 'Weak' : 'Negligible'}
                        {corr >= 0 ? ' positive' : ' negative'}
                      </span>
                    </div>
                    {/* Visual bar */}
                    <div className="mt-2 h-5 w-full rounded bg-slate-900 relative overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-px h-full bg-slate-600" />
                      </div>
                      <div
                        className={cn('absolute top-0 h-full rounded-sm', corr >= 0 ? 'bg-green-500/60 left-1/2' : 'bg-red-500/60')}
                        style={{
                          width: `${Math.abs(corr) * 50}%`,
                          ...(corr < 0 ? { left: `${50 - Math.abs(corr) * 50}%` } : {}),
                        }}
                      />
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <p className="text-xs text-slate-500 py-6 text-center">
              Click a cell in the matrix to view pair correlation detail.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-component ────────────────────────────────────────────────────

function InsightRow({
  label,
  pair,
  value,
  colorClass,
}: {
  label: string;
  pair: [string, string];
  value: number;
  colorClass: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div>
        <span className="text-slate-400">{label}: </span>
        <span className="text-slate-200 font-medium">
          {pair[0]} / {pair[1]}
        </span>
      </div>
      <span className={cn('font-mono font-semibold', colorClass)}>{value.toFixed(3)}</span>
    </div>
  );
}
