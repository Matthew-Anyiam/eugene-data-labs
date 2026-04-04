import { useState, useMemo } from 'react';
import { Banknote, TrendingUp, TrendingDown, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useEconomics } from '../hooks/useEconomics';
import type { FredSeries } from '../lib/types';

type BondTab = 'overview' | 'treasuries' | 'rates' | 'spreads';

const TABS: { label: string; value: BondTab }[] = [
  { label: 'Overview', value: 'overview' },
  { label: 'Treasuries', value: 'treasuries' },
  { label: 'Rates', value: 'rates' },
  { label: 'Spreads', value: 'spreads' },
];

const TREASURY_MATURITY_KEYS: Record<string, string[]> = {
  '1M': ['DGS1MO', '1-month', '1 month'],
  '3M': ['DGS3MO', '3-month', '3 month', '3-Month'],
  '6M': ['DGS6MO', '6-month', '6 month', '6-Month'],
  '1Y': ['DGS1', '1-year', '1 year', '1-Year'],
  '2Y': ['DGS2', '2-year', '2 year', '2-Year'],
  '3Y': ['DGS3', '3-year', '3 year', '3-Year'],
  '5Y': ['DGS5', '5-year', '5 year', '5-Year'],
  '7Y': ['DGS7', '7-year', '7 year', '7-Year'],
  '10Y': ['DGS10', '10-year', '10 year', '10-Year'],
  '20Y': ['DGS20', '20-year', '20 year', '20-Year'],
  '30Y': ['DGS30', '30-year', '30 year', '30-Year'],
};

const MATURITIES = ['1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y'];

function matchSeries(series: FredSeries[], keys: string[]): FredSeries | null {
  for (const s of series) {
    for (const key of keys) {
      if (s.id.toUpperCase() === key.toUpperCase() || s.title.toLowerCase().includes(key.toLowerCase())) {
        return s;
      }
    }
  }
  return null;
}

function parseNum(s: FredSeries | null | undefined): number | null {
  if (!s) return null;
  const v = s.value;
  if (v === null || v === undefined || v === '') return null;
  const num = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(num) ? null : num;
}

function ChangeIndicator({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-600">—</span>;
  if (value === 0) return <span className="text-slate-400">0</span>;
  const pos = value > 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5', pos ? 'text-red-400' : 'text-emerald-400')}>
      {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {pos ? '+' : ''}{value.toFixed(3)}
    </span>
  );
}

function SpreadValue({ bps, signal }: { bps: number | null; signal: 'normal' | 'warning' | 'inverted' }) {
  if (bps === null) return <span className="text-slate-600">N/A</span>;
  return (
    <span className={cn('font-semibold', signal === 'inverted' ? 'text-red-400' : signal === 'warning' ? 'text-amber-400' : 'text-emerald-400')}>
      {bps >= 0 ? '+' : ''}{bps.toFixed(0)} bps
    </span>
  );
}

export function BondsPage() {
  const [activeTab, setActiveTab] = useState<BondTab>('overview');

  const ratesQuery = useEconomics('rates');
  const treasuryQuery = useEconomics('treasury');

  const ratesSeries = ratesQuery.data?.series ?? [];
  const treasurySeries = treasuryQuery.data?.series ?? [];

  const isLoading = ratesQuery.isLoading || treasuryQuery.isLoading;
  const isError = ratesQuery.isError || treasuryQuery.isError;

  // Map treasury maturities
  const maturityMap = useMemo(() => {
    const result: Record<string, FredSeries | null> = {};
    for (const m of MATURITIES) {
      result[m] = matchSeries(treasurySeries, TREASURY_MATURITY_KEYS[m]);
    }
    return result;
  }, [treasurySeries]);

  const yieldMap = useMemo(() => {
    const result: Record<string, number | null> = {};
    for (const m of MATURITIES) {
      result[m] = parseNum(maturityMap[m]);
    }
    return result;
  }, [maturityMap]);

  const availableMaturities = MATURITIES.filter(m => yieldMap[m] !== null);

  // Key rate lookups
  const fedFunds = matchSeries(ratesSeries, ['FEDFUNDS', 'federal funds', 'fed funds']);
  const prime = matchSeries(ratesSeries, ['DPRIME', 'prime rate', 'prime loan']);
  const sofr = matchSeries(ratesSeries, ['SOFR', 'secured overnight']);
  const mortg30 = matchSeries(ratesSeries, ['MORTGAGE30US', '30-year fixed mortgage', '30 year fixed']);
  const mortg15 = matchSeries(ratesSeries, ['MORTGAGE15US', '15-year fixed mortgage', '15 year fixed']);
  const libor3m = matchSeries(ratesSeries, ['USD3MTD156N', 'LIBOR', '3-month LIBOR']);

  // Spread calculations
  const y10 = yieldMap['10Y'];
  const y2 = yieldMap['2Y'];
  const y3m = yieldMap['3M'];
  const y30 = yieldMap['30Y'];
  const y5 = yieldMap['5Y'];

  const spread2s10s = y10 !== null && y2 !== null ? (y10 - y2) * 100 : null;
  const spread3m10 = y10 !== null && y3m !== null ? (y10 - y3m) * 100 : null;
  const spread5s30s = y30 !== null && y5 !== null ? (y30 - y5) * 100 : null;

  const isInverted = spread2s10s !== null && spread2s10s < 0;

  const spreadSignal = (val: number | null): 'normal' | 'warning' | 'inverted' => {
    if (val === null) return 'normal';
    if (val < 0) return 'inverted';
    if (val < 25) return 'warning';
    return 'normal';
  };

  // Max yield for bar chart scale
  const allYields = availableMaturities.map(m => yieldMap[m] as number);
  const maxYield = allYields.length ? Math.max(...allYields) : 5;
  const minYield = allYields.length ? Math.min(...allYields) : 0;
  const yieldRange = maxYield - minYield || 1;

  // Summary cards
  const fedVal = parseNum(fedFunds);
  const tenYield = yieldMap['10Y'];
  const twoYield = yieldMap['2Y'];

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Banknote className="h-8 w-8 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold">Bonds &amp; Fixed Income</h1>
          <p className="text-slate-400 text-sm">Treasury yields, interest rates, and fixed income markets</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-16 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading bond market data…</span>
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-xl border border-red-700/50 bg-red-900/10 px-4 py-3 text-sm text-red-400">
          Failed to load bond data. Please try again.
        </div>
      )}

      {!isLoading && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">Fed Funds Rate</div>
              <div className="text-lg font-bold text-blue-400">{fedVal !== null ? `${fedVal.toFixed(2)}%` : '—'}</div>
              {fedFunds?.date && <div className="text-[10px] text-slate-500 mt-1">{fedFunds.date}</div>}
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">10Y Treasury</div>
              <div className="text-lg font-bold text-white">{tenYield !== null ? `${tenYield.toFixed(2)}%` : '—'}</div>
              {maturityMap['10Y']?.date && <div className="text-[10px] text-slate-500 mt-1">{maturityMap['10Y']!.date}</div>}
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">2Y Treasury</div>
              <div className="text-lg font-bold text-white">{twoYield !== null ? `${twoYield.toFixed(2)}%` : '—'}</div>
              {maturityMap['2Y']?.date && <div className="text-[10px] text-slate-500 mt-1">{maturityMap['2Y']!.date}</div>}
            </div>

            <div className={cn('bg-slate-800 border rounded-lg p-3', isInverted ? 'border-amber-700/50' : 'border-slate-700')}>
              <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                2s/10s Spread
                {isInverted && <AlertTriangle className="h-3 w-3 text-amber-400" />}
              </div>
              <div className={cn('text-lg font-bold', isInverted ? 'text-amber-400' : 'text-white')}>
                {spread2s10s !== null ? `${spread2s10s >= 0 ? '+' : ''}${spread2s10s.toFixed(0)} bps` : '—'}
              </div>
              {isInverted && <div className="text-[10px] text-amber-500 mt-1">Inverted</div>}
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">30Y Mortgage</div>
              <div className="text-lg font-bold text-white">
                {parseNum(mortg30) !== null ? `${parseNum(mortg30)!.toFixed(2)}%` : '—'}
              </div>
              {mortg30?.date && <div className="text-[10px] text-slate-500 mt-1">{mortg30.date}</div>}
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">Prime Rate</div>
              <div className="text-lg font-bold text-white">
                {parseNum(prime) !== null ? `${parseNum(prime)!.toFixed(2)}%` : '—'}
              </div>
              {prime?.date && <div className="text-[10px] text-slate-500 mt-1">{prime.date}</div>}
            </div>
          </div>

          {/* Inversion alert */}
          {isInverted && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-700/50 bg-amber-900/10 p-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <span className="text-sm text-amber-400">
                Yield curve inversion detected (2Y/10Y) — historically a leading recession indicator
              </span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1 w-fit">
            {TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  'px-4 py-1.5 rounded text-sm font-medium transition-colors',
                  activeTab === tab.value
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Overview tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Yield curve visual */}
              {availableMaturities.length > 0 && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                  <h2 className="text-sm font-semibold text-slate-300 mb-4">US Treasury Yield Curve</h2>
                  <div className="flex items-end gap-1" style={{ height: '180px' }}>
                    {availableMaturities.map((m, i) => {
                      const y = yieldMap[m] as number;
                      const heightPct = ((y - minYield) / yieldRange) * 75 + 10;
                      const prevM = i > 0 ? availableMaturities[i - 1] : null;
                      const prevY = prevM ? yieldMap[prevM] : null;
                      const inverted = prevY !== null && y < prevY;
                      return (
                        <div key={m} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[10px] text-slate-400">{y.toFixed(2)}%</span>
                          <div className="w-full flex items-end justify-center" style={{ height: '120px' }}>
                            <div
                              className={cn('w-full max-w-[36px] rounded-t transition-all', inverted ? 'bg-amber-500/80' : 'bg-blue-500/80')}
                              style={{ height: `${heightPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400">{m}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500/80" /> Normal</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500/80" /> Inverted segment</span>
                  </div>
                </div>
              )}

              {/* Spread overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { name: '10Y − 2Y', val: spread2s10s },
                  { name: '10Y − 3M', val: spread3m10 },
                  { name: '30Y − 5Y', val: spread5s30s },
                ].map(sp => (
                  <div key={sp.name} className={cn('rounded-xl border bg-slate-800 p-4', spreadSignal(sp.val) === 'inverted' ? 'border-red-700/50' : spreadSignal(sp.val) === 'warning' ? 'border-amber-700/50' : 'border-slate-700')}>
                    <div className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      {spreadSignal(sp.val) === 'inverted' && <AlertTriangle className="h-3 w-3 text-red-400" />}
                      {sp.name} Spread
                    </div>
                    <div className="mt-1">
                      <SpreadValue bps={sp.val} signal={spreadSignal(sp.val)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Treasuries tab */}
          {activeTab === 'treasuries' && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
              <div className="p-3 border-b border-slate-700">
                <h2 className="text-sm font-semibold text-slate-300">Treasury Yields</h2>
              </div>
              {availableMaturities.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 text-xs border-b border-slate-700">
                        <th className="text-left p-3">Maturity</th>
                        <th className="text-left p-3">Series</th>
                        <th className="text-right p-3">Yield</th>
                        <th className="text-right p-3">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableMaturities.map(m => {
                        const s = maturityMap[m]!;
                        const y = yieldMap[m] as number;
                        return (
                          <tr key={m} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                            <td className="p-3 font-bold text-white">{m}</td>
                            <td className="p-3 text-slate-400 text-xs">{s.title}</td>
                            <td className="p-3 text-right font-mono text-white">{y.toFixed(3)}%</td>
                            <td className="p-3 text-right text-slate-500 text-xs">{s.date || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-slate-500">No treasury yield data available.</div>
              )}
              {/* Show all treasury series */}
              {treasurySeries.length > 0 && (
                <div className="border-t border-slate-700">
                  <div className="p-3">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">All Treasury Series</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-slate-500 text-xs border-b border-slate-700/50">
                            <th className="text-left py-2 pr-4">ID</th>
                            <th className="text-left py-2 pr-4">Title</th>
                            <th className="text-right py-2">Value</th>
                            <th className="text-right py-2 pl-4">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {treasurySeries.map(s => (
                            <tr key={s.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                              <td className="py-2 pr-4 font-mono text-xs text-slate-400">{s.id}</td>
                              <td className="py-2 pr-4 text-xs text-slate-300">{s.title}</td>
                              <td className="py-2 text-right font-mono text-xs text-white">
                                {s.value !== null && s.value !== undefined ? `${s.value}%` : '—'}
                              </td>
                              <td className="py-2 pl-4 text-right text-xs text-slate-500">{s.date || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rates tab */}
          {activeTab === 'rates' && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
              <div className="p-3 border-b border-slate-700">
                <h2 className="text-sm font-semibold text-slate-300">Interest Rates</h2>
              </div>
              {ratesSeries.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 text-xs border-b border-slate-700">
                        <th className="text-left p-3">Rate</th>
                        <th className="text-right p-3">Value</th>
                        <th className="text-right p-3">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ratesSeries.map(s => {
                        const num = parseNum(s);
                        return (
                          <tr key={s.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                            <td className="p-3">
                              <div className="text-sm font-medium text-white">{s.title}</div>
                              <div className="text-xs text-slate-500">{s.id}</div>
                            </td>
                            <td className="p-3 text-right font-mono font-semibold text-white">
                              {num !== null ? `${num.toFixed(2)}%` : '—'}
                            </td>
                            <td className="p-3 text-right text-xs text-slate-500">{s.date || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-slate-500">No interest rate data available.</div>
              )}
            </div>
          )}

          {/* Spreads tab */}
          {activeTab === 'spreads' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { name: '10Y − 2Y (2s10s)', bps: spread2s10s, desc: 'Classic recession indicator. Inverted when short rates exceed long rates.' },
                  { name: '10Y − 3M', bps: spread3m10, desc: 'Fed-preferred spread. Strong predictor of recessions when inverted.' },
                  { name: '30Y − 5Y', bps: spread5s30s, desc: 'Long-end steepness. Reflects longer-term growth and inflation expectations.' },
                ].map(sp => {
                  const sig = spreadSignal(sp.bps);
                  return (
                    <div key={sp.name} className={cn('rounded-xl border bg-slate-800 p-5', sig === 'inverted' ? 'border-red-700/50' : sig === 'warning' ? 'border-amber-700/50' : 'border-slate-700')}>
                      <div className="flex items-center gap-1 text-xs text-slate-500 uppercase tracking-wider mb-2">
                        {sig === 'inverted' && <AlertTriangle className="h-3 w-3 text-red-400" />}
                        {sp.name}
                      </div>
                      <div className="text-3xl font-bold mb-1">
                        <SpreadValue bps={sp.bps} signal={sig} />
                      </div>
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">{sp.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* Key rates comparison */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Key Rate Comparison</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Fed Funds', series: fedFunds },
                    { label: 'Prime Rate', series: prime },
                    { label: 'SOFR', series: sofr },
                    { label: '3M LIBOR / USD', series: libor3m },
                    { label: '30Y Mortgage', series: mortg30 },
                    { label: '15Y Mortgage', series: mortg15 },
                  ].map(({ label, series: s }) => {
                    const num = parseNum(s);
                    return (
                      <div key={label} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                        <div className="text-xs text-slate-400 mb-1">{label}</div>
                        <div className="text-xl font-bold text-white">
                          {num !== null ? `${num.toFixed(2)}%` : '—'}
                        </div>
                        {s?.date && <div className="text-[10px] text-slate-500 mt-1">{s.date}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {!isError && ratesSeries.length === 0 && treasurySeries.length === 0 && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 py-12 text-center text-sm text-slate-500">
              No bond market data available.
            </div>
          )}
        </>
      )}
    </div>
  );
}
