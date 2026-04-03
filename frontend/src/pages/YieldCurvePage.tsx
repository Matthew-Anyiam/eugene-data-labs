import { useState, useMemo } from 'react';
import { LineChart, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const MATURITIES = ['1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y'];
const MATURITY_YEARS = [1/12, 0.25, 0.5, 1, 2, 3, 5, 7, 10, 20, 30];

type DateRange = 'Current' | '1W Ago' | '1M Ago' | '3M Ago' | '1Y Ago';

function genCurve(offset: number): number[] {
  const s = seed(`curve_${offset}`);
  const base = 3.5 + (offset * 0.15);
  return MATURITY_YEARS.map((y, i) => {
    const normal = base + Math.log(1 + y) * 0.8;
    const noise = (pseudo(s, i) - 0.5) * 0.3;
    const inversion = offset > 2 ? -0.3 * Math.exp(-y / 3) : 0;
    return +(normal + noise + inversion).toFixed(3);
  });
}

interface SpreadData {
  name: string;
  value: number;
  historical: number;
  signal: 'normal' | 'warning' | 'inverted';
}

export function YieldCurvePage() {
  const [selectedDates, setSelectedDates] = useState<DateRange[]>(['Current', '1M Ago']);

  const curves = useMemo(() => {
    const dateOffsets: Record<DateRange, number> = {
      Current: 0, '1W Ago': 1, '1M Ago': 2, '3M Ago': 3, '1Y Ago': 4,
    };
    const result: Record<DateRange, number[]> = {} as any;
    for (const [key, offset] of Object.entries(dateOffsets)) {
      result[key as DateRange] = genCurve(offset);
    }
    return result;
  }, []);

  const currentCurve = curves['Current'];
  const yieldAt = (mat: string) => currentCurve[MATURITIES.indexOf(mat)];

  const spreads: SpreadData[] = [
    { name: '10Y-2Y Spread', value: +(yieldAt('10Y') - yieldAt('2Y')).toFixed(3), historical: 0.85, signal: yieldAt('10Y') - yieldAt('2Y') < 0 ? 'inverted' : yieldAt('10Y') - yieldAt('2Y') < 0.25 ? 'warning' : 'normal' },
    { name: '10Y-3M Spread', value: +(yieldAt('10Y') - yieldAt('3M')).toFixed(3), historical: 1.1, signal: yieldAt('10Y') - yieldAt('3M') < 0 ? 'inverted' : yieldAt('10Y') - yieldAt('3M') < 0.25 ? 'warning' : 'normal' },
    { name: '30Y-5Y Spread', value: +(yieldAt('30Y') - yieldAt('5Y')).toFixed(3), historical: 0.6, signal: yieldAt('30Y') - yieldAt('5Y') < 0 ? 'inverted' : 'normal' },
    { name: '5Y-2Y Spread', value: +(yieldAt('5Y') - yieldAt('2Y')).toFixed(3), historical: 0.35, signal: yieldAt('5Y') - yieldAt('2Y') < 0 ? 'inverted' : 'normal' },
  ];

  const inversions = spreads.filter(s => s.signal === 'inverted').length;

  const curveColors: Record<DateRange, string> = {
    Current: 'text-indigo-400',
    '1W Ago': 'text-emerald-400',
    '1M Ago': 'text-amber-400',
    '3M Ago': 'text-pink-400',
    '1Y Ago': 'text-cyan-400',
  };

  const curveBg: Record<DateRange, string> = {
    Current: 'bg-indigo-500',
    '1W Ago': 'bg-emerald-500',
    '1M Ago': 'bg-amber-500',
    '3M Ago': 'bg-pink-500',
    '1Y Ago': 'bg-cyan-500',
  };

  const toggleDate = (d: DateRange) => {
    if (d === 'Current') return;
    setSelectedDates(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <LineChart className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Yield Curve</h1>
          <p className="text-sm text-slate-400">Treasury yield curve, spreads, and inversion signals</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-4">
        {spreads.map(sp => (
          <div key={sp.name} className={cn('rounded-xl border bg-slate-800 p-4',
            sp.signal === 'inverted' ? 'border-red-700/50' : sp.signal === 'warning' ? 'border-amber-700/50' : 'border-slate-700'
          )}>
            <div className="flex items-center gap-1 text-xs text-slate-500 uppercase tracking-wider">
              {sp.signal === 'inverted' && <AlertTriangle className="h-3 w-3 text-red-400" />}
              {sp.name}
            </div>
            <div className={cn('mt-1 text-2xl font-bold',
              sp.signal === 'inverted' ? 'text-red-400' : sp.signal === 'warning' ? 'text-amber-400' : 'text-emerald-400'
            )}>
              {sp.value > 0 ? '+' : ''}{(sp.value * 100).toFixed(0)}bps
            </div>
            <div className="text-[10px] text-slate-500">Avg: {(sp.historical * 100).toFixed(0)}bps</div>
          </div>
        ))}
      </div>

      {inversions > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-red-700/50 bg-red-900/10 p-3">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <span className="text-sm text-red-400">{inversions} yield curve inversion{inversions > 1 ? 's' : ''} detected — historically associated with recession risk</span>
        </div>
      )}

      {/* Date selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Compare:</span>
        {(['Current', '1W Ago', '1M Ago', '3M Ago', '1Y Ago'] as DateRange[]).map(d => (
          <button key={d} onClick={() => toggleDate(d)} disabled={d === 'Current'}
            className={cn('flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium',
              selectedDates.includes(d) ? 'bg-slate-700 text-white' : 'border border-slate-700 text-slate-500 hover:text-slate-300',
              d === 'Current' && 'cursor-default'
            )}>
            <span className={cn('h-2 w-2 rounded-full', curveBg[d])} />
            {d}
          </button>
        ))}
      </div>

      {/* ASCII-style curve visualization */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-4 text-sm font-semibold text-white">Yield Curve</h3>
        <div className="relative" style={{ height: '200px' }}>
          {selectedDates.map(dateKey => {
            const curve = curves[dateKey];
            const allYields = Object.values(curves).flat();
            const minY = Math.min(...allYields) - 0.2;
            const maxY = Math.max(...allYields) + 0.2;
            const range = maxY - minY;

            return (
              <div key={dateKey} className="absolute inset-0">
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polyline
                    fill="none"
                    stroke={dateKey === 'Current' ? '#818cf8' : dateKey === '1W Ago' ? '#34d399' : dateKey === '1M Ago' ? '#fbbf24' : dateKey === '3M Ago' ? '#f472b6' : '#22d3ee'}
                    strokeWidth="0.5"
                    opacity={dateKey === 'Current' ? 1 : 0.5}
                    points={curve.map((y, i) => `${(i / (curve.length - 1)) * 100},${100 - ((y - minY) / range) * 100}`).join(' ')}
                  />
                </svg>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-slate-500">
          {MATURITIES.map(m => <span key={m}>{m}</span>)}
        </div>
      </div>

      {/* Yield table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Maturity</th>
              {selectedDates.map(d => (
                <th key={d} className={cn('px-3 py-2 text-right text-xs font-medium', curveColors[d])}>{d}</th>
              ))}
              {selectedDates.length > 1 && <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Change</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {MATURITIES.map((mat, i) => {
              const current = curves['Current'][i];
              const compare = selectedDates.length > 1 ? curves[selectedDates[selectedDates.length - 1]][i] : null;
              const change = compare !== null ? current - compare : null;
              return (
                <tr key={mat} className="bg-slate-800 hover:bg-slate-750">
                  <td className="px-3 py-2 text-xs font-medium text-white">{mat}</td>
                  {selectedDates.map(d => (
                    <td key={d} className="px-3 py-2 text-right text-xs text-slate-300">{curves[d][i].toFixed(3)}%</td>
                  ))}
                  {change !== null && (
                    <td className={cn('px-3 py-2 text-right text-xs font-medium', change >= 0 ? 'text-red-400' : 'text-emerald-400')}>
                      {change >= 0 ? '+' : ''}{(change * 100).toFixed(1)}bps
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
