import { useState, useMemo } from 'react';
import { Gem, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';
import { cn, formatPrice, formatPercent } from '../lib/utils';

type Category = 'metals' | 'energy' | 'agriculture' | 'livestock';
type SortKey = 'name' | 'best' | 'worst';

interface Commodity {
  name: string;
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  unit: string;
  category: Category;
  dayHigh: number;
  dayLow: number;
  weekHigh: number;
  weekLow: number;
}

const MOCK_COMMODITIES: Commodity[] = [
  { name: 'Gold', symbol: 'GC', price: 2342.50, change: 18.30, changePct: 0.79, unit: '/oz', category: 'metals', dayHigh: 2355.00, dayLow: 2318.40, weekHigh: 2380.00, weekLow: 2290.10 },
  { name: 'Silver', symbol: 'SI', price: 27.84, change: -0.32, changePct: -1.14, unit: '/oz', category: 'metals', dayHigh: 28.20, dayLow: 27.55, weekHigh: 29.10, weekLow: 26.80 },
  { name: 'Platinum', symbol: 'PL', price: 982.40, change: 5.60, changePct: 0.57, unit: '/oz', category: 'metals', dayHigh: 990.00, dayLow: 974.20, weekHigh: 1005.00, weekLow: 960.00 },
  { name: 'Palladium', symbol: 'PA', price: 1028.00, change: -12.50, changePct: -1.20, unit: '/oz', category: 'metals', dayHigh: 1045.00, dayLow: 1020.00, weekHigh: 1080.00, weekLow: 1010.00 },
  { name: 'Copper', symbol: 'HG', price: 4.52, change: 0.08, changePct: 1.80, unit: '/lb', category: 'metals', dayHigh: 4.56, dayLow: 4.42, weekHigh: 4.60, weekLow: 4.30 },
  { name: 'WTI Crude', symbol: 'CL', price: 78.42, change: -1.15, changePct: -1.45, unit: '/bbl', category: 'energy', dayHigh: 79.80, dayLow: 77.90, weekHigh: 81.20, weekLow: 76.50 },
  { name: 'Brent Crude', symbol: 'BZ', price: 82.68, change: -0.92, changePct: -1.10, unit: '/bbl', category: 'energy', dayHigh: 83.80, dayLow: 82.10, weekHigh: 85.00, weekLow: 80.40 },
  { name: 'Natural Gas', symbol: 'NG', price: 2.18, change: 0.12, changePct: 5.83, unit: '/MMBtu', category: 'energy', dayHigh: 2.22, dayLow: 2.04, weekHigh: 2.30, weekLow: 1.95 },
  { name: 'Heating Oil', symbol: 'HO', price: 2.54, change: -0.03, changePct: -1.17, unit: '/gal', category: 'energy', dayHigh: 2.58, dayLow: 2.51, weekHigh: 2.65, weekLow: 2.48 },
  { name: 'Gasoline', symbol: 'RB', price: 2.62, change: 0.04, changePct: 1.55, unit: '/gal', category: 'energy', dayHigh: 2.65, dayLow: 2.57, weekHigh: 2.72, weekLow: 2.50 },
  { name: 'Corn', symbol: 'ZC', price: 4.42, change: -0.06, changePct: -1.34, unit: '/bu', category: 'agriculture', dayHigh: 4.50, dayLow: 4.38, weekHigh: 4.58, weekLow: 4.30 },
  { name: 'Wheat', symbol: 'ZW', price: 5.86, change: 0.14, changePct: 2.45, unit: '/bu', category: 'agriculture', dayHigh: 5.92, dayLow: 5.70, weekHigh: 6.05, weekLow: 5.60 },
  { name: 'Soybeans', symbol: 'ZS', price: 11.72, change: -0.18, changePct: -1.51, unit: '/bu', category: 'agriculture', dayHigh: 11.95, dayLow: 11.60, weekHigh: 12.10, weekLow: 11.40 },
  { name: 'Coffee', symbol: 'KC', price: 1.94, change: 0.06, changePct: 3.19, unit: '/lb', category: 'agriculture', dayHigh: 1.97, dayLow: 1.87, weekHigh: 2.02, weekLow: 1.82 },
  { name: 'Sugar', symbol: 'SB', price: 0.21, change: 0.01, changePct: 4.00, unit: '/lb', category: 'agriculture', dayHigh: 0.22, dayLow: 0.20, weekHigh: 0.23, weekLow: 0.19 },
  { name: 'Cotton', symbol: 'CT', price: 0.82, change: -0.01, changePct: -1.21, unit: '/lb', category: 'agriculture', dayHigh: 0.84, dayLow: 0.81, weekHigh: 0.86, weekLow: 0.79 },
  { name: 'Cocoa', symbol: 'CC', price: 8420.00, change: 210.00, changePct: 2.56, unit: '/mt', category: 'agriculture', dayHigh: 8500.00, dayLow: 8180.00, weekHigh: 8650.00, weekLow: 7900.00 },
  { name: 'Live Cattle', symbol: 'LE', price: 1.87, change: 0.02, changePct: 1.08, unit: '/lb', category: 'livestock', dayHigh: 1.89, dayLow: 1.84, weekHigh: 1.91, weekLow: 1.82 },
  { name: 'Lean Hogs', symbol: 'HE', price: 0.92, change: -0.03, changePct: -3.16, unit: '/lb', category: 'livestock', dayHigh: 0.95, dayLow: 0.91, weekHigh: 0.98, weekLow: 0.88 },
  { name: 'Feeder Cattle', symbol: 'GF', price: 2.45, change: 0.03, changePct: 1.24, unit: '/lb', category: 'livestock', dayHigh: 2.48, dayLow: 2.41, weekHigh: 2.52, weekLow: 2.38 },
];

const CATEGORIES: { label: string; value: Category | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Metals', value: 'metals' },
  { label: 'Energy', value: 'energy' },
  { label: 'Agriculture', value: 'agriculture' },
  { label: 'Livestock', value: 'livestock' },
];

const CATEGORY_COLORS: Record<Category, string> = {
  metals: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  energy: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  agriculture: 'bg-green-500/10 text-green-600 dark:text-green-400',
  livestock: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

export function CommoditiesPage() {
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');

  const filtered = useMemo(() => {
    let items = category === 'all' ? MOCK_COMMODITIES : MOCK_COMMODITIES.filter((c) => c.category === category);
    if (sortKey === 'best') items = [...items].sort((a, b) => b.changePct - a.changePct);
    else if (sortKey === 'worst') items = [...items].sort((a, b) => a.changePct - b.changePct);
    else items = [...items].sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }, [category, sortKey]);

  const best = useMemo(() => MOCK_COMMODITIES.reduce((a, b) => (a.changePct > b.changePct ? a : b)), []);
  const worst = useMemo(() => MOCK_COMMODITIES.reduce((a, b) => (a.changePct < b.changePct ? a : b)), []);
  const gold = MOCK_COMMODITIES.find((c) => c.symbol === 'GC')!;
  const wti = MOCK_COMMODITIES.find((c) => c.symbol === 'CL')!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Gem className="h-7 w-7 text-amber-500" />
          Commodities
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Prices across metals, energy, agriculture, and livestock
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Best performer', name: best.name, value: formatPercent(best.changePct), up: true },
          { label: 'Worst performer', name: worst.name, value: formatPercent(worst.changePct), up: false },
          { label: 'Gold', name: gold.symbol, value: formatPrice(gold.price), up: gold.change >= 0 },
          { label: 'WTI Crude', name: wti.symbol, value: formatPrice(wti.price), up: wti.change >= 0 },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-xs text-slate-400 dark:text-slate-500">{card.label}</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{card.value}</p>
            <p className={cn('text-xs font-medium', card.up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
              {card.name}
            </p>
          </div>
        ))}
      </div>

      {/* Filters + sort */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-0.5 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                category === c.value
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
          {(['name', 'best', 'worst'] as SortKey[]).map((s) => (
            <button
              key={s}
              onClick={() => setSortKey(s)}
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                sortKey === s
                  ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              )}
            >
              {s === 'best' ? 'Best first' : s === 'worst' ? 'Worst first' : 'Name'}
            </button>
          ))}
        </div>
      </div>

      {/* Commodity cards grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((c) => (
          <CommodityCard key={c.symbol} commodity={c} />
        ))}
      </div>
    </div>
  );
}

function CommodityCard({ commodity: c }: { commodity: Commodity }) {
  const isUp = c.change >= 0;
  const range = c.dayHigh - c.dayLow;
  const pctPos = range > 0 ? ((c.price - c.dayLow) / range) * 100 : 50;

  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200">{c.name}</p>
          <p className="text-xs text-slate-400">{c.symbol}</p>
        </div>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', CATEGORY_COLORS[c.category])}>
          {c.category}
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-xl font-bold tabular-nums">{formatPrice(c.price)}</span>
        <span className="text-xs text-slate-400">{c.unit}</span>
      </div>

      <div className={cn('mt-1 flex items-center gap-1 text-sm font-medium', isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
        {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
        {isUp ? '+' : ''}{c.change.toFixed(2)} ({formatPercent(c.changePct)})
      </div>

      {/* Day range bar */}
      <div className="mt-3">
        <div className="flex justify-between text-[10px] text-slate-400 tabular-nums">
          <span>{formatPrice(c.dayLow)}</span>
          <span>{formatPrice(c.dayHigh)}</span>
        </div>
        <div className="relative mt-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-600 dark:border-slate-900 dark:bg-slate-300"
            style={{ left: `${Math.min(Math.max(pctPos, 0), 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
