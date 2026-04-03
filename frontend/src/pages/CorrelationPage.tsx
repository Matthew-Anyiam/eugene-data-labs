import { useState, useMemo } from 'react';
import { Grid3X3, Plus, X, BarChart3 } from 'lucide-react';
import { cn } from '../lib/utils';

// ─── Deterministic pseudo-random helpers ────────────────────────────

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

// ─── Asset classification ───────────────────────────────────────────

type AssetClass = 'equity' | 'bond' | 'commodity' | 'crypto' | 'currency' | 'volatility';

const ASSET_CLASS: Record<string, AssetClass> = {
  SPY: 'equity', QQQ: 'equity', IWM: 'equity', DIA: 'equity', VTI: 'equity',
  AAPL: 'equity', MSFT: 'equity', GOOGL: 'equity', AMZN: 'equity', NVDA: 'equity', META: 'equity',
  XLK: 'equity', XLF: 'equity', XLE: 'equity', XLV: 'equity', XLI: 'equity', XLP: 'equity',
  TLT: 'bond', GLD: 'commodity', USO: 'commodity',
  'BTC-USD': 'crypto', DXY: 'currency', VIX: 'volatility',
};

function getClass(ticker: string): AssetClass {
  return ASSET_CLASS[ticker] ?? 'equity';
}

// ─── Correlation generation ─────────────────────────────────────────

function generateCorrelation(a: string, b: string, periodIdx: number): number {
  if (a === b) return 1;
  const key = [a, b].sort().join(':') + ':' + periodIdx;
  const s = seed(key);
  const raw = pseudo(s, periodIdx + 1);

  const clsA = getClass(a);
  const clsB = getClass(b);

  // Realistic correlation ranges by asset class pairing
  if (clsA === 'volatility' || clsB === 'volatility') {
    const other = clsA === 'volatility' ? clsB : clsA;
    if (other === 'equity') return -0.5 - raw * 0.3;
    if (other === 'bond') return -0.1 + raw * 0.3;
    return -0.2 + raw * 0.4;
  }
  if (clsA === 'equity' && clsB === 'equity') return 0.4 + raw * 0.5;
  if ((clsA === 'equity' && clsB === 'bond') || (clsA === 'bond' && clsB === 'equity'))
    return -0.1 - raw * 0.4;
  if ((clsA === 'equity' && clsB === 'commodity') || (clsA === 'commodity' && clsB === 'equity'))
    return 0.0 + raw * 0.3;
  if ((clsA === 'equity' && clsB === 'crypto') || (clsA === 'crypto' && clsB === 'equity'))
    return 0.2 + raw * 0.4;
  if ((clsA === 'equity' && clsB === 'currency') || (clsA === 'currency' && clsB === 'equity'))
    return -0.1 + raw * 0.3;
  if (clsA === 'bond' && clsB === 'commodity') return -0.1 + raw * 0.25;
  if (clsA === 'commodity' && clsB === 'bond') return -0.1 + raw * 0.25;
  return -0.2 + raw * 0.6;
}

// ─── Color helpers ──────────────────────────────────────────────────

function corrColor(v: number): string {
  if (v >= 0.7) return 'bg-green-700/80 text-green-100';
  if (v >= 0.4) return 'bg-green-600/50 text-green-200';
  if (v >= 0.1) return 'bg-green-500/25 text-green-300';
  if (v > -0.1) return 'bg-slate-600/50 text-slate-300';
  if (v > -0.4) return 'bg-red-500/25 text-red-300';
  if (v > -0.7) return 'bg-red-600/50 text-red-200';
  return 'bg-red-700/80 text-red-100';
}

// ─── Constants ──────────────────────────────────────────────────────

const DEFAULT_ASSETS = ['SPY', 'QQQ', 'IWM', 'TLT', 'GLD', 'USO', 'BTC-USD', 'DXY', 'VIX'];

const PRESETS: { label: string; tickers: string[] }[] = [
  { label: 'US Equities', tickers: ['SPY', 'QQQ', 'IWM', 'DIA', 'VTI'] },
  { label: 'Cross-Asset', tickers: ['SPY', 'TLT', 'GLD', 'USO', 'DXY'] },
  { label: 'Tech Giants', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META'] },
  { label: 'Sectors', tickers: ['XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLP'] },
];

const PERIODS = ['1M', '3M', '6M', '1Y', '3Y'] as const;
type Period = (typeof PERIODS)[number];

const PERIOD_IDX: Record<Period, number> = { '1M': 0, '3M': 1, '6M': 2, '1Y': 3, '3Y': 4 };

// ─── Component ──────────────────────────────────────────────────────

export function CorrelationPage() {
  const [assets, setAssets] = useState<string[]>(DEFAULT_ASSETS);
  const [period, setPeriod] = useState<Period>('1Y');
  const [tickerInput, setTickerInput] = useState('');
  const [hoveredCell, setHoveredCell] = useState<{ r: number; c: number } | null>(null);
  const [selectedPair, setSelectedPair] = useState<[string, string] | null>(null);

  const pIdx = PERIOD_IDX[period];

  // Build correlation matrix
  const matrix = useMemo(() => {
    return assets.map((a) => assets.map((b) => generateCorrelation(a, b, pIdx)));
  }, [assets, pIdx]);

  // Insights
  const insights = useMemo(() => {
    let maxCorr = -2, minCorr = 2, mostNeg = 2;
    let maxPair: [string, string] = [assets[0], assets[1] ?? assets[0]];
    let minPair: [string, string] = [assets[0], assets[1] ?? assets[0]];
    let negPair: [string, string] = [assets[0], assets[1] ?? assets[0]];
    let sum = 0, count = 0;

    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        const v = matrix[i][j];
        sum += v;
        count++;
        if (v > maxCorr) { maxCorr = v; maxPair = [assets[i], assets[j]]; }
        if (v < mostNeg) { mostNeg = v; negPair = [assets[i], assets[j]]; }
        if (Math.abs(v) < Math.abs(minCorr)) { minCorr = v; minPair = [assets[i], assets[j]]; }
      }
    }
    return {
      mostCorrelated: { pair: maxPair, value: maxCorr },
      leastCorrelated: { pair: minPair, value: minCorr },
      mostNegative: { pair: negPair, value: mostNeg },
      average: count > 0 ? sum / count : 0,
    };
  }, [assets, matrix]);

  // Rolling correlation for selected pair
  const rollingData = useMemo(() => {
    if (!selectedPair) return null;
    const [a, b] = selectedPair;
    return PERIODS.map((p, i) => ({
      label: p,
      value: generateCorrelation(a, b, i),
    }));
  }, [selectedPair]);

  const addTicker = () => {
    const t = tickerInput.trim().toUpperCase();
    if (t && !assets.includes(t)) {
      setAssets((prev) => [...prev, t]);
    }
    setTickerInput('');
  };

  const removeTicker = (ticker: string) => {
    setAssets((prev) => prev.filter((a) => a !== ticker));
    if (selectedPair && selectedPair.includes(ticker)) setSelectedPair(null);
  };

  const applyPreset = (tickers: string[]) => {
    setAssets(tickers);
    setSelectedPair(null);
  };

  const handleCellClick = (r: number, c: number) => {
    if (r !== c) setSelectedPair([assets[r], assets[c]]);
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
          Cross-asset correlation analysis. Click any cell to view rolling correlation detail.
        </p>
      </div>

      {/* Asset Selector */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {assets.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded bg-slate-700 px-2 py-1 text-xs font-medium text-slate-200"
            >
              {t}
              <button onClick={() => removeTicker(t)} className="text-slate-400 hover:text-red-400">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <form
            onSubmit={(e) => { e.preventDefault(); addTicker(); }}
            className="inline-flex items-center gap-1"
          >
            <input
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value)}
              placeholder="Add ticker..."
              className="w-24 rounded bg-slate-900 border border-slate-600 px-2 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="rounded bg-blue-600 p-1 text-white hover:bg-blue-500"
            >
              <Plus className="h-3 w-3" />
            </button>
          </form>
        </div>

        {/* Presets */}
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

      {/* Time Period Tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1 w-fit">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'rounded px-3 py-1 text-xs font-medium transition-colors',
              period === p
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Correlation Matrix */}
      {assets.length >= 2 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-1" />
                {assets.map((t) => (
                  <th
                    key={t}
                    className="p-1 text-xs font-medium text-slate-400 text-center"
                    style={{ minWidth: assets.length > 8 ? 48 : 56 }}
                  >
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.map((rowTicker, r) => (
                <tr key={rowTicker}>
                  <td className="p-1 text-xs font-medium text-slate-400 text-right pr-2 whitespace-nowrap">
                    {rowTicker}
                  </td>
                  {assets.map((colTicker, c) => {
                    const v = matrix[r][c];
                    const isDiag = r === c;
                    const isHovered = hoveredCell?.r === r && hoveredCell?.c === c;
                    return (
                      <td
                        key={colTicker}
                        className={cn(
                          'p-1 text-center text-xs font-mono cursor-pointer transition-all border border-slate-700/50',
                          isDiag ? 'bg-slate-900 text-slate-500' : corrColor(v),
                          isHovered && !isDiag && 'ring-1 ring-blue-400',
                          selectedPair &&
                            selectedPair.includes(rowTicker) &&
                            selectedPair.includes(colTicker) &&
                            !isDiag &&
                            'ring-2 ring-yellow-400'
                        )}
                        style={{ minWidth: assets.length > 8 ? 48 : 56 }}
                        onMouseEnter={() => setHoveredCell({ r, c })}
                        onMouseLeave={() => setHoveredCell(null)}
                        onClick={() => handleCellClick(r, c)}
                        title={`${rowTicker} / ${colTicker}: ${v.toFixed(3)}`}
                      >
                        {v.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-500">
            <span>Color scale:</span>
            <span className="inline-block w-3 h-3 rounded bg-red-700/80" /> Strong negative
            <span className="inline-block w-3 h-3 rounded bg-red-500/25" /> Weak negative
            <span className="inline-block w-3 h-3 rounded bg-slate-600/50" /> Neutral
            <span className="inline-block w-3 h-3 rounded bg-green-500/25" /> Weak positive
            <span className="inline-block w-3 h-3 rounded bg-green-700/80" /> Strong positive
          </div>
        </div>
      )}

      {/* Insights + Rolling Chart side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Correlation Insights */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white">Correlation Insights</h2>
          <InsightRow
            label="Most Correlated"
            pair={insights.mostCorrelated.pair}
            value={insights.mostCorrelated.value}
            color="text-green-400"
          />
          <InsightRow
            label="Best Diversifier"
            pair={insights.leastCorrelated.pair}
            value={insights.leastCorrelated.value}
            color="text-slate-300"
          />
          <InsightRow
            label="Best Hedge"
            pair={insights.mostNegative.pair}
            value={insights.mostNegative.value}
            color="text-red-400"
          />
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Average Correlation</span>
            <span className="font-mono text-slate-200">{insights.average.toFixed(3)}</span>
          </div>
        </div>

        {/* Rolling Correlation / Pair Detail */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Rolling Correlation</h2>
          </div>
          {selectedPair && rollingData ? (
            <>
              <p className="text-xs text-slate-400">
                {selectedPair[0]} vs {selectedPair[1]} across time periods
              </p>
              <div className="space-y-2">
                {rollingData.map((d) => {
                  const barWidth = Math.abs(d.value) * 100;
                  const isNeg = d.value < 0;
                  return (
                    <div key={d.label} className="flex items-center gap-2 text-xs">
                      <span className="w-8 text-slate-400 font-medium">{d.label}</span>
                      <div className="flex-1 h-4 bg-slate-900 rounded overflow-hidden relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-1/2" />
                          <div className="w-px h-full bg-slate-600" />
                          <div className="w-1/2" />
                        </div>
                        <div
                          className={cn(
                            'absolute top-0 h-full rounded-sm transition-all',
                            isNeg ? 'bg-red-500/60' : 'bg-green-500/60'
                          )}
                          style={{
                            width: `${barWidth / 2}%`,
                            left: isNeg ? `${50 - barWidth / 2}%` : '50%',
                          }}
                        />
                      </div>
                      <span
                        className={cn(
                          'w-12 text-right font-mono',
                          isNeg ? 'text-red-400' : 'text-green-400'
                        )}
                      >
                        {d.value.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500 py-6 text-center">
              Click a cell in the matrix to view rolling correlation between two assets.
            </p>
          )}
        </div>
      </div>

      {/* Pair selector hint */}
      {selectedPair && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <h2 className="text-sm font-semibold text-white mb-3">
            Pair Detail: {selectedPair[0]} / {selectedPair[1]}
          </h2>
          <div className="grid grid-cols-5 gap-2">
            {PERIODS.map((p, i) => {
              const v = generateCorrelation(selectedPair[0], selectedPair[1], i);
              return (
                <div
                  key={p}
                  className={cn(
                    'rounded p-3 text-center',
                    corrColor(v)
                  )}
                >
                  <div className="text-[10px] text-slate-400 mb-1">{p}</div>
                  <div className="text-sm font-mono font-semibold">{v.toFixed(3)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function InsightRow({
  label,
  pair,
  value,
  color,
}: {
  label: string;
  pair: [string, string];
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div>
        <span className="text-slate-400">{label}: </span>
        <span className="text-slate-200 font-medium">
          {pair[0]} / {pair[1]}
        </span>
      </div>
      <span className={cn('font-mono font-semibold', color)}>{value.toFixed(3)}</span>
    </div>
  );
}
