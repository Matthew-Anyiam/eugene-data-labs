import { useState, useMemo } from 'react';
import {
  PieChart,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Zap,
  Heart,
  Landmark,
  ShoppingCart,
  Radio,
  Factory,
  ShoppingBag,
  Fuel,
  Lightbulb,
  Building,
  Mountain,
} from 'lucide-react';
import { cn, formatPercent } from '../lib/utils';

// ─── Deterministic mock data helpers ────────────────────────────────

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

// ─── Types ──────────────────────────────────────────────────────────

type TimePeriod = '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y';
type SortMode = 'name' | 'performance' | 'weight';
type RotationPhase = 'Accumulation' | 'Markup' | 'Distribution' | 'Markdown';

const TIME_PERIODS: TimePeriod[] = ['1D', '1W', '1M', '3M', 'YTD', '1Y'];

interface SectorDef {
  name: string;
  icon: React.ElementType;
  tickers: [string, string, string];
  stockCount: number;
  weight: number;
}

interface SectorPerf {
  '1D': number;
  '1W': number;
  '1M': number;
  '3M': number;
  YTD: number;
  '1Y': number;
}

// ─── Sector definitions ─────────────────────────────────────────────

const SECTORS: SectorDef[] = [
  { name: 'Technology', icon: Zap, tickers: ['AAPL', 'MSFT', 'NVDA'], stockCount: 76, weight: 29.5 },
  { name: 'Healthcare', icon: Heart, tickers: ['UNH', 'JNJ', 'LLY'], stockCount: 64, weight: 12.8 },
  { name: 'Financials', icon: Landmark, tickers: ['JPM', 'BAC', 'GS'], stockCount: 72, weight: 13.2 },
  { name: 'Consumer Discretionary', icon: ShoppingCart, tickers: ['AMZN', 'TSLA', 'HD'], stockCount: 53, weight: 10.4 },
  { name: 'Communication Services', icon: Radio, tickers: ['GOOGL', 'META', 'NFLX'], stockCount: 27, weight: 8.9 },
  { name: 'Industrials', icon: Factory, tickers: ['CAT', 'UNP', 'HON'], stockCount: 78, weight: 8.7 },
  { name: 'Consumer Staples', icon: ShoppingBag, tickers: ['PG', 'KO', 'WMT'], stockCount: 38, weight: 6.1 },
  { name: 'Energy', icon: Fuel, tickers: ['XOM', 'CVX', 'COP'], stockCount: 23, weight: 3.9 },
  { name: 'Utilities', icon: Lightbulb, tickers: ['NEE', 'DUK', 'SO'], stockCount: 31, weight: 2.5 },
  { name: 'Real Estate', icon: Building, tickers: ['PLD', 'AMT', 'SPG'], stockCount: 29, weight: 2.3 },
  { name: 'Materials', icon: Mountain, tickers: ['LIN', 'APD', 'FCX'], stockCount: 28, weight: 1.7 },
];

// ─── Generate mock performance data ─────────────────────────────────

function generatePerf(sectorName: string): SectorPerf {
  const s = seed(sectorName);
  const range = (idx: number, lo: number, hi: number) =>
    lo + pseudo(s, idx) * (hi - lo);
  return {
    '1D': +(range(0, -2.5, 2.5)).toFixed(2),
    '1W': +(range(1, -5, 5)).toFixed(2),
    '1M': +(range(2, -8, 10)).toFixed(2),
    '3M': +(range(3, -12, 15)).toFixed(2),
    YTD: +(range(4, -15, 25)).toFixed(2),
    '1Y': +(range(5, -20, 40)).toFixed(2),
  };
}

function getRotationPhase(sectorName: string): RotationPhase {
  const s = seed(sectorName);
  const v = pseudo(s, 99);
  const phases: RotationPhase[] = ['Accumulation', 'Markup', 'Distribution', 'Markdown'];
  return phases[Math.floor(v * 4)];
}

const PHASE_COLORS: Record<RotationPhase, string> = {
  Accumulation: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Markup: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Distribution: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Markdown: 'bg-red-500/20 text-red-400 border-red-500/30',
};

// ─── Component ──────────────────────────────────────────────────────

export function SectorsPage() {
  const [activePeriod, setActivePeriod] = useState<TimePeriod>('YTD');
  const [sortMode, setSortMode] = useState<SortMode>('performance');

  const sectorData = useMemo(
    () =>
      SECTORS.map((sec) => ({
        ...sec,
        perf: generatePerf(sec.name),
        phase: getRotationPhase(sec.name),
      })),
    [],
  );

  const sorted = useMemo(() => {
    const copy = [...sectorData];
    switch (sortMode) {
      case 'name':
        copy.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'performance':
        copy.sort((a, b) => b.perf[activePeriod] - a.perf[activePeriod]);
        break;
      case 'weight':
        copy.sort((a, b) => b.weight - a.weight);
        break;
    }
    return copy;
  }, [sectorData, sortMode, activePeriod]);

  // Summary stats
  const best = useMemo(
    () =>
      sectorData.reduce((a, b) =>
        a.perf[activePeriod] >= b.perf[activePeriod] ? a : b,
      ),
    [sectorData, activePeriod],
  );

  const worst = useMemo(
    () =>
      sectorData.reduce((a, b) =>
        a.perf[activePeriod] <= b.perf[activePeriod] ? a : b,
      ),
    [sectorData, activePeriod],
  );

  const breadth = useMemo(
    () => sectorData.filter((s) => s.perf[activePeriod] > 0).length,
    [sectorData, activePeriod],
  );

  // Max absolute YTD for bar scaling
  const maxAbsYtd = useMemo(
    () =>
      Math.max(...sectorData.map((s) => Math.abs(s.perf.YTD)), 1),
    [sectorData],
  );

  return (
    <div className="min-h-screen bg-slate-900 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <PieChart className="h-7 w-7 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Sector Analysis</h1>
          <p className="text-sm text-slate-400">
            GICS sector performance, rotation phases, and market cap weights
          </p>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          label="Best Sector"
          value={best.name}
          sub={formatPercent(best.perf[activePeriod])}
          positive={best.perf[activePeriod] >= 0}
        />
        <SummaryCard
          label="Worst Sector"
          value={worst.name}
          sub={formatPercent(worst.perf[activePeriod])}
          positive={worst.perf[activePeriod] >= 0}
        />
        <SummaryCard
          label="Market Breadth"
          value={`${breadth} / ${sectorData.length}`}
          sub={`${breadth} sectors positive (${activePeriod})`}
          positive={breadth > sectorData.length / 2}
        />
      </div>

      {/* Controls: time tabs + sort */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
          {TIME_PERIODS.map((tp) => (
            <button
              key={tp}
              onClick={() => setActivePeriod(tp)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                activePeriod === tp
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700',
              )}
            >
              {tp}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-slate-400" />
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="bg-slate-800 border border-slate-700 text-sm text-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="performance">Sort by Performance</option>
            <option value="name">Sort by Name</option>
            <option value="weight">Sort by Market Cap Weight</option>
          </select>
        </div>
      </div>

      {/* Sector cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map((sec) => {
          const Icon = sec.icon;
          const activeVal = sec.perf[activePeriod];
          return (
            <div
              key={sec.name}
              className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4 hover:border-slate-600 transition-colors"
            >
              {/* Card header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-700/60 rounded-lg">
                    <Icon className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">{sec.name}</h3>
                    <p className="text-xs text-slate-500">
                      {sec.stockCount} stocks &middot; {sec.weight}% weight
                    </p>
                  </div>
                </div>
                <div
                  className={cn(
                    'text-lg font-bold',
                    activeVal >= 0 ? 'text-emerald-400' : 'text-red-400',
                  )}
                >
                  {formatPercent(activeVal)}
                </div>
              </div>

              {/* Performance row */}
              <div className="grid grid-cols-6 gap-2 text-center">
                {TIME_PERIODS.map((tp) => {
                  const v = sec.perf[tp];
                  return (
                    <div
                      key={tp}
                      className={cn(
                        'rounded-md py-1.5 px-1',
                        tp === activePeriod
                          ? 'bg-slate-700 ring-1 ring-blue-500/50'
                          : 'bg-slate-700/40',
                      )}
                    >
                      <div className="text-[10px] text-slate-500 mb-0.5">{tp}</div>
                      <div
                        className={cn(
                          'text-xs font-medium',
                          v >= 0 ? 'text-emerald-400' : 'text-red-400',
                        )}
                      >
                        {v >= 0 ? '+' : ''}
                        {v.toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* YTD performance bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>YTD Performance</span>
                  <span>{formatPercent(sec.perf.YTD)}</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden relative">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-slate-600" />
                  {sec.perf.YTD >= 0 ? (
                    <div
                      className="absolute inset-y-0 left-1/2 bg-emerald-500 rounded-r-full"
                      style={{
                        width: `${(sec.perf.YTD / maxAbsYtd) * 50}%`,
                      }}
                    />
                  ) : (
                    <div
                      className="absolute inset-y-0 bg-red-500 rounded-l-full"
                      style={{
                        width: `${(Math.abs(sec.perf.YTD) / maxAbsYtd) * 50}%`,
                        right: '50%',
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Top holdings */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500">Top holdings:</span>
                {sec.tickers.map((t) => (
                  <span
                    key={t}
                    className="text-xs font-mono bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sector Rotation Matrix */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">
            Sector Rotation Matrix
          </h2>
        </div>
        <p className="text-xs text-slate-400">
          Phases based on relative momentum and money flow signals
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['Accumulation', 'Markup', 'Distribution', 'Markdown'] as RotationPhase[]).map(
            (phase) => {
              const matching = sectorData.filter((s) => s.phase === phase);
              return (
                <div
                  key={phase}
                  className={cn(
                    'rounded-lg border p-4 space-y-2',
                    PHASE_COLORS[phase],
                  )}
                >
                  <div className="flex items-center gap-2">
                    {phase === 'Markup' || phase === 'Accumulation' ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    <span className="text-sm font-semibold">{phase}</span>
                  </div>
                  <div className="space-y-1">
                    {matching.length === 0 ? (
                      <span className="text-xs opacity-50">None</span>
                    ) : (
                      matching.map((s) => (
                        <div
                          key={s.name}
                          className="text-xs flex items-center justify-between"
                        >
                          <span>{s.name}</span>
                          <span className="font-mono">
                            {formatPercent(s.perf[activePeriod])}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            },
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Summary Card ───────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub: string;
  positive: boolean;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-white font-semibold text-lg">{value}</p>
      <p
        className={cn(
          'text-sm mt-0.5',
          positive ? 'text-emerald-400' : 'text-red-400',
        )}
      >
        {sub}
      </p>
    </div>
  );
}
