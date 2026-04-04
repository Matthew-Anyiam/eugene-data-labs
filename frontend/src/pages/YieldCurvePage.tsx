import { useState, useMemo } from 'react';
import { LineChart, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useEconomics } from '../hooks/useEconomics';
import type { FredSeries } from '../lib/types';

const MATURITIES = ['1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y'];

// Map maturity labels to likely FRED series IDs or title keywords
const MATURITY_KEYS: Record<string, string[]> = {
  '1M': ['DGS1MO', '1-month', '1 month', '1mo'],
  '3M': ['DGS3MO', '3-month', '3 month', '3mo', '3-Month'],
  '6M': ['DGS6MO', '6-month', '6 month', '6mo', '6-Month'],
  '1Y': ['DGS1', '1-year', '1 year', '1yr', '1-Year'],
  '2Y': ['DGS2', '2-year', '2 year', '2yr', '2-Year'],
  '3Y': ['DGS3', '3-year', '3 year', '3yr', '3-Year'],
  '5Y': ['DGS5', '5-year', '5 year', '5yr', '5-Year'],
  '7Y': ['DGS7', '7-year', '7 year', '7yr', '7-Year'],
  '10Y': ['DGS10', '10-year', '10 year', '10yr', '10-Year'],
  '20Y': ['DGS20', '20-year', '20 year', '20yr', '20-Year'],
  '30Y': ['DGS30', '30-year', '30 year', '30yr', '30-Year'],
};

function matchSeries(series: FredSeries[], maturity: string): FredSeries | null {
  const keys = MATURITY_KEYS[maturity] ?? [];
  for (const s of series) {
    for (const key of keys) {
      if (s.id.toUpperCase() === key.toUpperCase() ||
          s.title.toLowerCase().includes(key.toLowerCase())) {
        return s;
      }
    }
  }
  return null;
}

function parseYield(s: FredSeries | null): number | null {
  if (!s) return null;
  const v = s.value;
  if (v === null || v === undefined || v === '') return null;
  const num = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(num) ? null : num;
}

interface SpreadCard {
  name: string;
  longMat: string;
  shortMat: string;
  value: number | null;
  signal: 'normal' | 'warning' | 'inverted';
}

export function YieldCurvePage() {
  const { data, isLoading, isError } = useEconomics('treasury');

  const series = data?.series ?? [];

  // Map each maturity to its series
  const maturityData = useMemo(() => {
    const result: Record<string, FredSeries | null> = {};
    for (const m of MATURITIES) {
      result[m] = matchSeries(series, m);
    }
    return result;
  }, [series]);

  // Extract yield values
  const yields = useMemo(() => {
    const result: Record<string, number | null> = {};
    for (const m of MATURITIES) {
      result[m] = parseYield(maturityData[m]);
    }
    return result;
  }, [maturityData]);

  // Determine available yields
  const availableMaturities = MATURITIES.filter(m => yields[m] !== null);
  const allYields = availableMaturities.map(m => yields[m] as number);
  const maxYield = allYields.length ? Math.max(...allYields) : 5;
  const minYield = allYields.length ? Math.min(...allYields) : 0;
  const range = maxYield - minYield || 1;

  // Spreads
  const spreads: SpreadCard[] = useMemo(() => {
    const calc = (longM: string, shortM: string): number | null => {
      const l = yields[longM];
      const s = yields[shortM];
      if (l === null || s === null) return null;
      return l - s;
    };

    const pairs: [string, string, string][] = [
      ['10Y-2Y', '10Y', '2Y'],
      ['10Y-3M', '10Y', '3M'],
      ['30Y-5Y', '30Y', '5Y'],
      ['5Y-2Y', '5Y', '2Y'],
    ];

    return pairs.map(([name, longMat, shortMat]) => {
      const val = calc(longMat, shortMat);
      let signal: 'normal' | 'warning' | 'inverted' = 'normal';
      if (val !== null) {
        if (val < 0) signal = 'inverted';
        else if (val < 0.25) signal = 'warning';
      }
      return { name, longMat, shortMat, value: val, signal };
    });
  }, [yields]);

  const inversions = spreads.filter(s => s.signal === 'inverted').length;

  // Determine overall curve shape
  const curveShape = useMemo(() => {
    const y2 = yields['2Y'];
    const y10 = yields['10Y'];
    const y3m = yields['3M'];
    if (y2 !== null && y10 !== null) {
      if (y10 - y2 < 0) return 'Inverted';
      if (y10 - y2 < 0.25) return 'Flat';
    }
    if (y3m !== null && y10 !== null && y10 - y3m < 0) return 'Inverted';
    return 'Normal';
  }, [yields]);

  // Fallback: if we have no treasury matches, show all series from treasury category
  const [showAllSeries, setShowAllSeries] = useState(false);
  const hasYieldData = availableMaturities.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <LineChart className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Yield Curve</h1>
          <p className="text-sm text-slate-400">US Treasury yield curve, spreads, and inversion signals</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-12 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading treasury yield data…</span>
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-xl border border-red-700/50 bg-red-900/10 px-4 py-3 text-sm text-red-400">
          Failed to load treasury data. Please try again.
        </div>
      )}

      {!isLoading && !isError && data && (
        <>
          {/* Spread summary cards */}
          {spreads.some(s => s.value !== null) && (
            <div className="grid gap-3 sm:grid-cols-4">
              {spreads.map(sp => (
                <div
                  key={sp.name}
                  className={cn(
                    'rounded-xl border bg-slate-800 p-4',
                    sp.signal === 'inverted' ? 'border-red-700/50' :
                    sp.signal === 'warning' ? 'border-amber-700/50' : 'border-slate-700',
                  )}
                >
                  <div className="flex items-center gap-1 text-xs text-slate-500 uppercase tracking-wider">
                    {sp.signal === 'inverted' && <AlertTriangle className="h-3 w-3 text-red-400" />}
                    {sp.name}
                  </div>
                  {sp.value !== null ? (
                    <>
                      <div className={cn(
                        'mt-1 text-2xl font-bold',
                        sp.signal === 'inverted' ? 'text-red-400' :
                        sp.signal === 'warning' ? 'text-amber-400' : 'text-emerald-400',
                      )}>
                        {sp.value >= 0 ? '+' : ''}{(sp.value * 100).toFixed(0)}bps
                      </div>
                      <div className={cn('text-xs mt-1 capitalize', sp.signal === 'inverted' ? 'text-red-400' : sp.signal === 'warning' ? 'text-amber-400' : 'text-slate-500')}>
                        {sp.signal}
                      </div>
                    </>
                  ) : (
                    <div className="mt-1 text-xl font-bold text-slate-600">N/A</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Inversion alert */}
          {inversions > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-red-700/50 bg-red-900/10 p-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <span className="text-sm text-red-400">
                {inversions} yield curve inversion{inversions > 1 ? 's' : ''} detected — historically associated with recession risk
              </span>
            </div>
          )}

          {/* Curve shape badge */}
          {hasYieldData && (
            <div className="flex items-center gap-4">
              <div className={cn(
                'rounded-lg px-4 py-2 text-lg font-bold',
                curveShape === 'Normal' ? 'bg-emerald-900/30 text-emerald-400' :
                curveShape === 'Flat' ? 'bg-amber-900/30 text-amber-400' :
                'bg-red-900/30 text-red-400',
              )}>
                {curveShape}
              </div>
              <div className="text-xs text-slate-400">
                {curveShape === 'Normal' ? 'Longer maturities yield more — healthy growth expectations' :
                 curveShape === 'Flat' ? 'Minimal term premium — uncertainty about direction' :
                 'Short rates above long rates — recession signal'}
              </div>
            </div>
          )}

          {/* Visual bar chart */}
          {hasYieldData && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <h3 className="mb-4 text-sm font-semibold text-white">US Treasury Yield Curve</h3>
              <div className="flex items-end gap-1" style={{ height: '180px' }}>
                {availableMaturities.map((m, i) => {
                  const y = yields[m] as number;
                  const heightPct = ((y - minYield) / range) * 80 + 10; // 10-90% range
                  const prevM = i > 0 ? availableMaturities[i - 1] : null;
                  const prevY = prevM ? yields[prevM] : null;
                  const inverted = prevY !== null && y < prevY;
                  return (
                    <div key={m} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] font-medium text-slate-300">{y.toFixed(2)}%</span>
                      <div className="w-full flex items-end justify-center" style={{ height: '120px' }}>
                        <div
                          className={cn('w-full max-w-[40px] rounded-t transition-all', inverted ? 'bg-amber-500/80' : 'bg-indigo-500/80')}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500">{m}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded bg-indigo-500/80" /> Normal
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded bg-amber-500/80" /> Inverted segment
                </span>
              </div>
            </div>
          )}

          {/* Yield table */}
          {hasYieldData && (
            <div className="overflow-x-auto rounded-xl border border-slate-700">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-700 bg-slate-800/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Maturity</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Series</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-indigo-400">Yield</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {availableMaturities.map(m => {
                    const s = maturityData[m]!;
                    const y = yields[m] as number;
                    return (
                      <tr key={m} className="bg-slate-800 hover:bg-slate-750">
                        <td className="px-3 py-2 text-xs font-bold text-white">{m}</td>
                        <td className="px-3 py-2 text-xs text-slate-400">{s.title}</td>
                        <td className="px-3 py-2 text-right text-xs font-mono font-semibold text-slate-300">{y.toFixed(3)}%</td>
                        <td className="px-3 py-2 text-right text-xs text-slate-500">{s.date || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Fallback: show all treasury series if no standard maturity matches */}
          {!hasYieldData && series.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-3">
                <p className="text-sm text-slate-400">No standard maturity matches found. Showing all treasury series.</p>
                <button
                  onClick={() => setShowAllSeries(!showAllSeries)}
                  className="text-xs text-indigo-400 hover:underline"
                >
                  {showAllSeries ? 'Hide' : 'Show'} all ({series.length})
                </button>
              </div>
              {showAllSeries && (
                <div className="overflow-x-auto rounded-xl border border-slate-700">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-700 bg-slate-800/50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">ID</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Title</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Value</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {series.map(s => (
                        <tr key={s.id} className="bg-slate-800">
                          <td className="px-3 py-2 text-xs font-mono text-slate-400">{s.id}</td>
                          <td className="px-3 py-2 text-xs text-white">{s.title}</td>
                          <td className="px-3 py-2 text-right text-xs text-slate-300">
                            {s.value !== null && s.value !== undefined ? `${s.value}%` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-slate-500">{s.date || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {series.length === 0 && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 py-12 text-center text-sm text-slate-500">
              No treasury yield data available.
            </div>
          )}
        </>
      )}
    </div>
  );
}
