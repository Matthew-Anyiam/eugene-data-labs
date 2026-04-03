import { useState, useMemo } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const SECTORS = [
  'Technology', 'Healthcare', 'Financials', 'Consumer Discretionary',
  'Industrials', 'Energy', 'Consumer Staples', 'Utilities',
  'Materials', 'Real Estate', 'Communication Services',
];

const CYCLE_PHASES = ['Early Expansion', 'Mid Expansion', 'Late Expansion', 'Recession'] as const;
type CyclePhase = (typeof CYCLE_PHASES)[number];

const PHASE_SECTORS: Record<CyclePhase, string[]> = {
  'Early Expansion': ['Technology', 'Consumer Discretionary', 'Financials', 'Industrials'],
  'Mid Expansion': ['Technology', 'Healthcare', 'Industrials', 'Materials'],
  'Late Expansion': ['Energy', 'Materials', 'Healthcare', 'Consumer Staples'],
  'Recession': ['Utilities', 'Consumer Staples', 'Healthcare', 'Real Estate'],
};

interface SectorData {
  sector: string;
  return1w: number;
  return1m: number;
  return3m: number;
  return6m: number;
  return1y: number;
  flow1m: number;
  momentum: number;
  rsi: number;
  relStrength: number;
  favoredPhase: CyclePhase;
}

function genSectorData(): SectorData[] {
  return SECTORS.map(sector => {
    const s = seed(sector + '_rot');
    const favoredPhases = Object.entries(PHASE_SECTORS).find(([_, sectors]) => sectors[0] === sector || sectors[1] === sector);
    return {
      sector,
      return1w: +((pseudo(s, 0) - 0.45) * 6).toFixed(2),
      return1m: +((pseudo(s, 1) - 0.4) * 12).toFixed(2),
      return3m: +((pseudo(s, 2) - 0.35) * 20).toFixed(2),
      return6m: +((pseudo(s, 3) - 0.3) * 30).toFixed(2),
      return1y: +((pseudo(s, 4) - 0.25) * 45).toFixed(2),
      flow1m: +((pseudo(s, 5) - 0.4) * 15).toFixed(2),
      momentum: +((pseudo(s, 6) * 2 - 1) * 100).toFixed(0),
      rsi: Math.floor(30 + pseudo(s, 7) * 40),
      relStrength: Math.floor(1 + pseudo(s, 8) * 98),
      favoredPhase: (favoredPhases ? favoredPhases[0] : CYCLE_PHASES[Math.floor(pseudo(s, 9) * 4)]) as CyclePhase,
    };
  }).sort((a, b) => b.return3m - a.return3m);
}

export function SectorRotationPage() {
  const [timeframe, setTimeframe] = useState<'1w' | '1m' | '3m' | '6m' | '1y'>('3m');
  const [currentPhase] = useState<CyclePhase>('Mid Expansion');

  const data = useMemo(() => genSectorData(), []);

  const getReturn = (d: SectorData) => {
    if (timeframe === '1w') return d.return1w;
    if (timeframe === '1m') return d.return1m;
    if (timeframe === '3m') return d.return3m;
    if (timeframe === '6m') return d.return6m;
    return d.return1y;
  };

  const sorted = [...data].sort((a, b) => getReturn(b) - getReturn(a));
  const favoredSectors = PHASE_SECTORS[currentPhase];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <RefreshCw className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Sector Rotation</h1>
          <p className="text-sm text-slate-400">Economic cycle positioning, sector momentum, and rotation model</p>
        </div>
      </div>

      {/* Cycle phase */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Economic Cycle Position</h3>
        <div className="flex items-center gap-1">
          {CYCLE_PHASES.map((phase, i) => (
            <div key={phase} className="flex flex-1 items-center">
              <div className={cn(
                'flex-1 rounded-lg p-3 text-center transition-all',
                phase === currentPhase ? 'bg-indigo-600 ring-2 ring-indigo-400' : 'bg-slate-700/50'
              )}>
                <div className={cn('text-xs font-semibold', phase === currentPhase ? 'text-white' : 'text-slate-400')}>
                  {phase}
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  {PHASE_SECTORS[phase].slice(0, 2).join(', ')}
                </div>
              </div>
              {i < CYCLE_PHASES.length - 1 && <ArrowRight className="mx-1 h-3 w-3 text-slate-600 shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Favored sectors */}
      <div className="rounded-xl border border-emerald-700/50 bg-slate-800 p-4">
        <h3 className="mb-2 text-sm font-semibold text-emerald-400">Favored Sectors ({currentPhase})</h3>
        <div className="flex flex-wrap gap-2">
          {favoredSectors.map(s => (
            <span key={s} className="rounded-lg bg-emerald-900/30 px-3 py-1.5 text-xs font-medium text-emerald-400 border border-emerald-700/50">
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Timeframe selector */}
      <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
        {(['1w', '1m', '3m', '6m', '1y'] as const).map(t => (
          <button key={t} onClick={() => setTimeframe(t)}
            className={cn('rounded-md px-3 py-1.5 text-xs font-medium uppercase', timeframe === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>
            {t}
          </button>
        ))}
      </div>

      {/* Performance bars */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-4 text-sm font-semibold text-white">Sector Performance ({timeframe.toUpperCase()})</h3>
        <div className="space-y-3">
          {sorted.map((d, i) => {
            const ret = getReturn(d);
            const maxAbs = Math.max(...sorted.map(x => Math.abs(getReturn(x))));
            const barPct = maxAbs > 0 ? Math.abs(ret) / maxAbs * 100 : 0;
            const isFavored = favoredSectors.includes(d.sector);
            return (
              <div key={d.sector} className="flex items-center gap-2">
                <span className="w-6 text-[10px] text-slate-500">#{i + 1}</span>
                <span className={cn('w-44 text-xs font-medium truncate', isFavored ? 'text-emerald-400' : 'text-slate-300')}>
                  {d.sector}
                  {isFavored && <span className="ml-1 text-[8px]">★</span>}
                </span>
                <div className="flex-1 flex items-center">
                  {ret >= 0 ? (
                    <div className="flex w-full">
                      <div className="w-1/2" />
                      <div className="w-1/2">
                        <div className="h-5 rounded-r bg-emerald-500/40" style={{ width: `${barPct}%` }} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex w-full">
                      <div className="flex w-1/2 justify-end">
                        <div className="h-5 rounded-l bg-red-500/40" style={{ width: `${barPct}%` }} />
                      </div>
                      <div className="w-1/2" />
                    </div>
                  )}
                </div>
                <span className={cn('w-14 text-right text-xs font-medium', ret >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {ret >= 0 ? '+' : ''}{ret}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Sector</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">1W</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">1M</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">3M</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">6M</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">1Y</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Flow (1M)</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">RSI</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">RS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {sorted.map(d => {
              const isFavored = favoredSectors.includes(d.sector);
              return (
                <tr key={d.sector} className={cn('bg-slate-800 hover:bg-slate-750', isFavored && 'bg-emerald-900/5')}>
                  <td className={cn('px-3 py-2 text-xs font-medium', isFavored ? 'text-emerald-400' : 'text-white')}>
                    {d.sector} {isFavored && '★'}
                  </td>
                  {[d.return1w, d.return1m, d.return3m, d.return6m, d.return1y].map((v, i) => (
                    <td key={i} className={cn('px-3 py-2 text-right text-xs font-medium', v >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {v >= 0 ? '+' : ''}{v}%
                    </td>
                  ))}
                  <td className={cn('px-3 py-2 text-right text-xs font-medium', d.flow1m >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {d.flow1m >= 0 ? '+' : ''}{d.flow1m}B
                  </td>
                  <td className={cn('px-3 py-2 text-right text-xs', d.rsi > 70 ? 'text-red-400' : d.rsi < 30 ? 'text-emerald-400' : 'text-slate-300')}>
                    {d.rsi}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold',
                      d.relStrength >= 70 ? 'bg-emerald-900/40 text-emerald-400' : d.relStrength <= 30 ? 'bg-red-900/40 text-red-400' : 'bg-slate-700 text-slate-300'
                    )}>{d.relStrength}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Momentum heatmap */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Momentum Heatmap</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {data.map(d => {
            const mom = Number(d.momentum);
            const intensity = Math.min(Math.abs(mom) / 100, 1);
            const bg = mom >= 0
              ? `rgba(52, 211, 153, ${intensity * 0.3})`
              : `rgba(248, 113, 113, ${intensity * 0.3})`;
            return (
              <div key={d.sector} className="rounded-lg border border-slate-700 p-3" style={{ backgroundColor: bg }}>
                <div className="text-xs font-medium text-white">{d.sector}</div>
                <div className={cn('mt-1 text-lg font-bold', mom >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {mom >= 0 ? '+' : ''}{mom}
                </div>
                <div className="text-[10px] text-slate-500">momentum score</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
