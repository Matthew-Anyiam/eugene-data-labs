import { useState, useMemo } from 'react';
import { Map, TrendingUp, TrendingDown, Globe, BarChart3, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const REGIMES = [
  { name: 'Goldilocks', color: 'text-emerald-400', bg: 'bg-emerald-900/30 border-emerald-700', desc: 'Low inflation, strong growth — risk assets favored' },
  { name: 'Reflation', color: 'text-amber-400', bg: 'bg-amber-900/30 border-amber-700', desc: 'Rising inflation with rising growth — commodities outperform' },
  { name: 'Stagflation', color: 'text-red-400', bg: 'bg-red-900/30 border-red-700', desc: 'High inflation, slowing growth — defensive positioning' },
  { name: 'Deflation', color: 'text-blue-400', bg: 'bg-blue-900/30 border-blue-700', desc: 'Falling prices, weak growth — bonds and cash preferred' },
];

const INDICATORS = [
  { name: 'GDP Growth', unit: '%', base: 2.5, range: 3 },
  { name: 'CPI Inflation', unit: '%', base: 3.2, range: 2 },
  { name: 'Core PCE', unit: '%', base: 2.8, range: 1.5 },
  { name: 'Unemployment', unit: '%', base: 3.7, range: 2 },
  { name: 'Fed Funds Rate', unit: '%', base: 5.25, range: 1 },
  { name: '10Y Treasury', unit: '%', base: 4.3, range: 1.5 },
  { name: 'ISM Mfg PMI', unit: '', base: 49, range: 8 },
  { name: 'Consumer Conf.', unit: '', base: 102, range: 20 },
  { name: 'Retail Sales', unit: '%', base: 0.5, range: 2 },
  { name: 'Housing Starts', unit: 'K', base: 1400, range: 300 },
  { name: 'Indust. Production', unit: '%', base: 0.2, range: 1.5 },
  { name: 'Trade Balance', unit: '$B', base: -65, range: 20 },
];

const COUNTRIES = [
  { name: 'United States', flag: '🇺🇸', code: 'US' },
  { name: 'European Union', flag: '🇪🇺', code: 'EU' },
  { name: 'China', flag: '🇨🇳', code: 'CN' },
  { name: 'Japan', flag: '🇯🇵', code: 'JP' },
  { name: 'United Kingdom', flag: '🇬🇧', code: 'UK' },
];

const GLOBAL_METRICS = ['GDP Growth', 'CPI', 'Central Bank Rate', 'PMI'];

const CYCLE_PHASES = ['Early Expansion', 'Mid Expansion', 'Late Expansion', 'Recession'] as const;

const ASSET_CLASSES = ['Equities', 'Bonds', 'Commodities', 'Gold', 'USD', 'Real Estate'];

export function MacroPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<'current' | '3m' | '6m' | '1y'>('current');

  const s = seed(selectedPeriod);

  const regimeIdx = Math.floor(pseudo(s, 0) * REGIMES.length);
  const regime = REGIMES[regimeIdx];
  const confidence = 55 + Math.floor(pseudo(s, 1) * 35);

  const indicators = useMemo(() => INDICATORS.map((ind, i) => {
    const current = ind.base + (pseudo(s, i * 3 + 10) - 0.5) * ind.range;
    const prev = current + (pseudo(s, i * 3 + 11) - 0.5) * (ind.range * 0.3);
    const avg = ind.base;
    return { ...ind, current, prev, change: current - prev, aboveAvg: current > avg };
  }), [s]);

  const globalData = useMemo(() => COUNTRIES.map((_country, ci) => {
    return GLOBAL_METRICS.map((metric, mi) => {
      const idx = ci * 10 + mi * 3 + 50;
      const bases: Record<string, number[]> = {
        'GDP Growth': [2.5, 0.8, 5.2, 1.1, 0.5],
        'CPI': [3.2, 2.4, 0.5, 3.3, 4.0],
        'Central Bank Rate': [5.25, 4.5, 3.45, -0.1, 5.25],
        'PMI': [49, 47, 51, 50, 48],
      };
      const base = bases[metric]?.[ci] ?? 2;
      const val = base + (pseudo(s, idx) - 0.5) * 2;
      return { metric, value: val };
    });
  }), [s]);

  const cyclePhase = CYCLE_PHASES[Math.floor(pseudo(s, 200) * 4)];
  const cycleAngle = CYCLE_PHASES.indexOf(cyclePhase) * 90 + pseudo(s, 201) * 45;

  const yieldShape = pseudo(s, 300) > 0.6 ? 'Inverted' : pseudo(s, 300) > 0.3 ? 'Flat' : 'Normal';

  const assetSignals = useMemo(() => ASSET_CLASSES.map((asset, i) => {
    const v = pseudo(s, 400 + i);
    const signal = v > 0.6 ? 'Bullish' : v < 0.35 ? 'Bearish' : 'Neutral';
    const reasons: Record<string, Record<string, string>> = {
      Goldilocks: { Equities: 'Strong earnings growth', Bonds: 'Stable rates', Commodities: 'Steady demand', Gold: 'Low fear premium', USD: 'Moderate strength', 'Real Estate': 'Low rates support' },
      Reflation: { Equities: 'Cyclicals benefit', Bonds: 'Rising yields pressure', Commodities: 'Demand-driven rally', Gold: 'Inflation hedge', USD: 'Mixed signals', 'Real Estate': 'Inflation pass-through' },
      Stagflation: { Equities: 'Margin compression', Bonds: 'Rate uncertainty', Commodities: 'Supply constraints', Gold: 'Safe haven bid', USD: 'Flight to safety', 'Real Estate': 'Affordability pressure' },
      Deflation: { Equities: 'Earnings decline', Bonds: 'Rate cuts expected', Commodities: 'Demand destruction', Gold: 'Mixed — deflation vs safety', USD: 'Reserve currency bid', 'Real Estate': 'Price declines' },
    };
    return { asset, signal, reason: reasons[regime.name]?.[asset] ?? 'Monitor closely' };
  }), [s, regime.name]);

  const prevRegime = REGIMES[Math.floor(pseudo(s, 500) * REGIMES.length)];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Map className="h-6 w-6 text-violet-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Macro Dashboard</h1>
            <p className="text-sm text-slate-400">Global macro indicators, regime analysis, cross-asset signals</p>
          </div>
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
          {(['current', '3m', '6m', '1y'] as const).map(p => (
            <button key={p} onClick={() => setSelectedPeriod(p)}
              className={cn('rounded-md px-3 py-1 text-xs font-medium transition-colors', selectedPeriod === p ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white')}>
              {p === 'current' ? 'Current' : p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Regime indicator */}
      <div className={cn('rounded-xl border p-6', regime.bg)}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400">Current Market Regime</div>
            <div className={cn('mt-1 text-3xl font-bold', regime.color)}>{regime.name}</div>
            <p className="mt-1 text-sm text-slate-400">{regime.desc}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Confidence</div>
            <div className={cn('text-2xl font-bold', regime.color)}>{confidence}%</div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              Previous: <span className={prevRegime.color}>{prevRegime.name}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-slate-700">
          <div className={cn('h-2 rounded-full', regime.color.replace('text-', 'bg-'))} style={{ width: `${confidence}%` }} />
        </div>
      </div>

      {/* Key indicators grid */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Key Macro Indicators</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {indicators.map(ind => (
            <div key={ind.name} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">{ind.name}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-lg font-bold text-white">
                  {ind.name === 'Trade Balance' ? `$${ind.current.toFixed(0)}B` : ind.current < 10 ? ind.current.toFixed(2) : ind.current.toFixed(0)}{ind.unit && ind.current >= 10 ? '' : ind.unit === '%' ? '%' : ind.unit ? ` ${ind.unit}` : ''}
                </span>
                <span className={cn('flex items-center gap-0.5 text-xs', ind.change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {ind.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(ind.change).toFixed(2)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px]">
                <span className="text-slate-500">Prev: {ind.prev < 10 ? ind.prev.toFixed(2) : ind.prev.toFixed(0)}</span>
                <span className={ind.aboveAvg ? 'text-amber-400' : 'text-blue-400'}>
                  {ind.aboveAvg ? 'Above Avg' : 'Below Avg'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Global snapshot */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Globe className="h-4 w-4 text-slate-400" /> Global Snapshot
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Country</th>
                {GLOBAL_METRICS.map(m => (
                  <th key={m} className="px-3 py-2 text-right text-xs font-medium text-slate-400">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {COUNTRIES.map((country, ci) => (
                <tr key={country.code} className="bg-slate-800 hover:bg-slate-750">
                  <td className="px-3 py-2 text-xs font-medium text-white">{country.flag} {country.name}</td>
                  {globalData[ci].map((d, mi) => {
                    const isGood = (d.metric === 'GDP Growth' && d.value > 1.5) ||
                      (d.metric === 'CPI' && d.value < 3 && d.value > 0) ||
                      (d.metric === 'PMI' && d.value > 50);
                    return (
                      <td key={mi} className={cn('px-3 py-2 text-right text-xs font-medium', isGood ? 'text-emerald-400' : d.metric === 'Central Bank Rate' ? 'text-slate-300' : 'text-red-400')}>
                        {d.value.toFixed(2)}{d.metric !== 'PMI' ? '%' : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Yield curve shape */}
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <BarChart3 className="h-4 w-4 text-slate-400" /> Yield Curve
          </h3>
          <div className="flex items-center gap-4">
            <div className={cn('rounded-lg px-4 py-2 text-lg font-bold',
              yieldShape === 'Normal' ? 'bg-emerald-900/30 text-emerald-400' :
              yieldShape === 'Flat' ? 'bg-amber-900/30 text-amber-400' : 'bg-red-900/30 text-red-400')}>
              {yieldShape}
            </div>
            <div className="text-xs text-slate-400">
              {yieldShape === 'Normal' ? 'Longer maturities yield more — healthy growth expectations' :
               yieldShape === 'Flat' ? 'Minimal term premium — uncertainty about direction' :
               'Short rates above long rates — recession signal'}
            </div>
          </div>
          <div className="mt-4 flex items-end gap-1">
            {['1M', '3M', '6M', '1Y', '2Y', '5Y', '10Y', '30Y'].map((m, i) => {
              const height = yieldShape === 'Normal' ? 20 + i * 8 : yieldShape === 'Inverted' ? 80 - i * 7 : 40 + (i % 2 === 0 ? 5 : -5);
              return (
                <div key={m} className="flex flex-1 flex-col items-center gap-1">
                  <div className={cn('w-full rounded-t', yieldShape === 'Normal' ? 'bg-emerald-500/60' : yieldShape === 'Inverted' ? 'bg-red-500/60' : 'bg-amber-500/60')}
                    style={{ height: `${height}px` }} />
                  <span className="text-[9px] text-slate-500">{m}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Business cycle */}
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">Business Cycle</h3>
          <div className="flex items-center justify-center">
            <div className="relative h-48 w-48">
              <svg viewBox="0 0 200 200" className="h-full w-full">
                {CYCLE_PHASES.map((phase, i) => {
                  const angle = (i * 90 - 90) * (Math.PI / 180);
                  const x = 100 + 70 * Math.cos(angle);
                  const y = 100 + 70 * Math.sin(angle);
                  const isActive = phase === cyclePhase;
                  return (
                    <g key={phase}>
                      <circle cx={x} cy={y} r={isActive ? 24 : 18}
                        className={cn(isActive ? 'fill-emerald-500/30 stroke-emerald-400' : 'fill-slate-700/50 stroke-slate-600')}
                        strokeWidth={isActive ? 2 : 1} />
                      <text x={x} y={y} textAnchor="middle" dominantBaseline="middle"
                        className={cn('text-[8px] font-medium', isActive ? 'fill-emerald-400' : 'fill-slate-400')}>
                        {phase.split(' ').map((w, wi) => (
                          <tspan key={wi} x={x} dy={wi === 0 ? -4 : 10}>{w}</tspan>
                        ))}
                      </text>
                    </g>
                  );
                })}
                <line x1="100" y1="100" x2={100 + 50 * Math.cos((cycleAngle - 90) * Math.PI / 180)}
                  y2={100 + 50 * Math.sin((cycleAngle - 90) * Math.PI / 180)}
                  className="stroke-emerald-400" strokeWidth={2} strokeLinecap="round" />
                <circle cx="100" cy="100" r="4" className="fill-emerald-400" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-center text-xs text-slate-400">
            Current phase: <span className="font-medium text-emerald-400">{cyclePhase}</span>
          </div>
        </div>
      </div>

      {/* Cross-asset signals */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <ArrowRight className="h-4 w-4 text-slate-400" /> Cross-Asset Signals ({regime.name} Regime)
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {assetSignals.map(a => (
            <div key={a.asset} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <div className="text-xs font-medium text-slate-400">{a.asset}</div>
              <div className={cn('mt-1 text-sm font-bold',
                a.signal === 'Bullish' ? 'text-emerald-400' : a.signal === 'Bearish' ? 'text-red-400' : 'text-slate-300')}>
                {a.signal}
              </div>
              <div className="mt-1 text-[10px] text-slate-500">{a.reason}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
