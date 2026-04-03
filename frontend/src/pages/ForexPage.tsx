import { useState, useMemo } from 'react';
import { ArrowLeftRight, Activity, Calculator } from 'lucide-react';
import { cn, formatPercent } from '../lib/utils';

type Category = 'major' | 'minor' | 'exotic';

interface CurrencyPair {
  pair: string; bid: number; ask: number; spread: number;
  change: number; changePct: number; dayHigh: number; dayLow: number;
  category: Category;
}

const MOCK_PAIRS: CurrencyPair[] = [
  { pair: 'EUR/USD', bid: 1.0842, ask: 1.0844, spread: 0.2, change: 0.0023, changePct: 0.21, dayHigh: 1.0871, dayLow: 1.0810, category: 'major' },
  { pair: 'GBP/USD', bid: 1.2715, ask: 1.2718, spread: 0.3, change: -0.0031, changePct: -0.24, dayHigh: 1.2760, dayLow: 1.2690, category: 'major' },
  { pair: 'USD/JPY', bid: 151.42, ask: 151.45, spread: 0.3, change: 0.53, changePct: 0.35, dayHigh: 151.80, dayLow: 150.85, category: 'major' },
  { pair: 'USD/CHF', bid: 0.8821, ask: 0.8824, spread: 0.3, change: -0.0018, changePct: -0.20, dayHigh: 0.8850, dayLow: 0.8798, category: 'major' },
  { pair: 'AUD/USD', bid: 0.6543, ask: 0.6546, spread: 0.3, change: 0.0015, changePct: 0.23, dayHigh: 0.6570, dayLow: 0.6520, category: 'major' },
  { pair: 'USD/CAD', bid: 1.3612, ask: 1.3615, spread: 0.3, change: 0.0042, changePct: 0.31, dayHigh: 1.3640, dayLow: 1.3570, category: 'major' },
  { pair: 'NZD/USD', bid: 0.6105, ask: 0.6108, spread: 0.3, change: -0.0009, changePct: -0.15, dayHigh: 0.6130, dayLow: 0.6085, category: 'major' },
  { pair: 'EUR/GBP', bid: 0.8526, ask: 0.8529, spread: 0.3, change: 0.0038, changePct: 0.45, dayHigh: 0.8545, dayLow: 0.8490, category: 'minor' },
  { pair: 'EUR/JPY', bid: 164.15, ask: 164.20, spread: 0.5, change: 0.85, changePct: 0.52, dayHigh: 164.50, dayLow: 163.20, category: 'minor' },
  { pair: 'GBP/JPY', bid: 192.48, ask: 192.55, spread: 0.7, change: -0.32, changePct: -0.17, dayHigh: 193.10, dayLow: 191.90, category: 'minor' },
  { pair: 'AUD/JPY', bid: 99.05, ask: 99.10, spread: 0.5, change: 0.58, changePct: 0.59, dayHigh: 99.40, dayLow: 98.30, category: 'minor' },
  { pair: 'EUR/CHF', bid: 0.9564, ask: 0.9568, spread: 0.4, change: 0.0005, changePct: 0.05, dayHigh: 0.9585, dayLow: 0.9545, category: 'minor' },
  { pair: 'EUR/AUD', bid: 1.6570, ask: 1.6576, spread: 0.6, change: -0.0025, changePct: -0.15, dayHigh: 1.6620, dayLow: 1.6530, category: 'minor' },
  { pair: 'USD/TRY', bid: 32.45, ask: 32.55, spread: 10.0, change: 0.18, changePct: 0.56, dayHigh: 32.60, dayLow: 32.20, category: 'exotic' },
  { pair: 'USD/ZAR', bid: 18.32, ask: 18.38, spread: 6.0, change: -0.15, changePct: -0.81, dayHigh: 18.55, dayLow: 18.25, category: 'exotic' },
  { pair: 'USD/MXN', bid: 17.15, ask: 17.19, spread: 4.0, change: 0.08, changePct: 0.47, dayHigh: 17.25, dayLow: 17.02, category: 'exotic' },
  { pair: 'USD/BRL', bid: 4.97, ask: 5.01, spread: 4.0, change: -0.03, changePct: -0.60, dayHigh: 5.05, dayLow: 4.94, category: 'exotic' },
  { pair: 'USD/INR', bid: 83.12, ask: 83.18, spread: 6.0, change: 0.05, changePct: 0.06, dayHigh: 83.25, dayLow: 83.00, category: 'exotic' },
  { pair: 'USD/SGD', bid: 1.3445, ask: 1.3450, spread: 0.5, change: -0.0012, changePct: -0.09, dayHigh: 1.3470, dayLow: 1.3420, category: 'exotic' },
];

const CATEGORIES: { label: string; value: Category | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Major', value: 'major' },
  { label: 'Minor', value: 'minor' },
  { label: 'Exotic', value: 'exotic' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'] as const;

function computeStrengths(pairs: CurrencyPair[]) {
  const s: Record<string, number[]> = {};
  for (const c of CURRENCIES) s[c] = [];
  for (const p of pairs) {
    const [base, quote] = p.pair.split('/');
    if (s[base]) s[base].push(p.changePct);
    if (s[quote]) s[quote].push(-p.changePct);
  }
  return CURRENCIES.map((c) => {
    const vals = s[c];
    return { currency: c, strength: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0 };
  }).sort((a, b) => b.strength - a.strength);
}

export function ForexPage() {
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [convAmount, setConvAmount] = useState('1000');
  const [convFrom, setConvFrom] = useState('USD');
  const [convTo, setConvTo] = useState('EUR');

  const filtered = useMemo(
    () => filter === 'all' ? MOCK_PAIRS : MOCK_PAIRS.filter((p) => p.category === filter),
    [filter],
  );

  const strengths = useMemo(() => computeStrengths(MOCK_PAIRS), []);
  const maxAbs = useMemo(() => Math.max(...strengths.map((s) => Math.abs(s.strength)), 0.01), [strengths]);

  const summary = useMemo(() => {
    const strongest = strengths[0];
    const weakest = strengths[strengths.length - 1];
    const mostVolatile = [...MOCK_PAIRS].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0];
    const avgSpread = MOCK_PAIRS.reduce((s, p) => s + p.spread, 0) / MOCK_PAIRS.length;
    return { strongest, weakest, mostVolatile, avgSpread };
  }, [strengths]);

  const convResult = useMemo(() => {
    const amt = parseFloat(convAmount) || 0;
    if (convFrom === convTo) return amt;
    const direct = MOCK_PAIRS.find((p) => p.pair === `${convFrom}/${convTo}`);
    if (direct) return amt * direct.bid;
    const inverse = MOCK_PAIRS.find((p) => p.pair === `${convTo}/${convFrom}`);
    if (inverse) return amt / inverse.ask;
    // Cross via USD
    let amtInUsd = amt;
    if (convFrom !== 'USD') {
      const toUsd = MOCK_PAIRS.find((p) => p.pair === `${convFrom}/USD`);
      const fromUsd = MOCK_PAIRS.find((p) => p.pair === `USD/${convFrom}`);
      if (toUsd) amtInUsd = amt * toUsd.bid;
      else if (fromUsd) amtInUsd = amt / fromUsd.ask;
      else return null;
    }
    if (convTo === 'USD') return amtInUsd;
    const usdTo = MOCK_PAIRS.find((p) => p.pair === `USD/${convTo}`);
    const toUsd2 = MOCK_PAIRS.find((p) => p.pair === `${convTo}/USD`);
    if (usdTo) return amtInUsd * usdTo.bid;
    if (toUsd2) return amtInUsd / toUsd2.ask;
    return null;
  }, [convAmount, convFrom, convTo]);

  const allCurrencies = useMemo(() => {
    const set = new Set<string>();
    MOCK_PAIRS.forEach((p) => { const [b, q] = p.pair.split('/'); set.add(b); set.add(q); });
    return [...set].sort();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ArrowLeftRight className="h-7 w-7 text-blue-500" />
          Forex Markets
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Major, minor, and exotic currency pairs</p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-sm dark:border-slate-800 dark:bg-slate-800 sm:grid-cols-4">
        {[
          { label: 'Strongest Today', value: summary.strongest.currency, sub: formatPercent(summary.strongest.strength) },
          { label: 'Weakest Today', value: summary.weakest.currency, sub: formatPercent(summary.weakest.strength) },
          { label: 'Most Volatile', value: summary.mostVolatile.pair, sub: formatPercent(summary.mostVolatile.changePct) },
          { label: 'Avg Spread', value: `${summary.avgSpread.toFixed(1)} pips`, sub: undefined },
        ].map((item) => (
          <div key={item.label} className="bg-white px-4 py-3 dark:bg-slate-900">
            <p className="text-xs text-slate-400 dark:text-slate-500">{item.label}</p>
            <p className="mt-0.5 font-medium tabular-nums">{item.value}</p>
            {item.sub && <p className="text-[10px] text-slate-400">{item.sub}</p>}
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-0.5 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700 w-fit">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setFilter(c.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              filter === c.value
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Rate table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              {['Pair', 'Bid', 'Ask', 'Spread', 'Change', 'Change %', 'Day High', 'Day Low'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 dark:text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const isUp = p.changePct >= 0;
              const tightSpread = p.spread < 1;
              const wideSpread = p.spread > 5;
              return (
                <tr key={p.pair} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">{p.pair}</td>
                  <td className="px-4 py-2.5 tabular-nums">{p.bid.toFixed(p.bid > 100 ? 2 : 4)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{p.ask.toFixed(p.ask > 100 ? 2 : 4)}</td>
                  <td className={cn('px-4 py-2.5 tabular-nums', tightSpread && 'text-emerald-600 dark:text-emerald-400', wideSpread && 'text-amber-600 dark:text-amber-400')}>
                    {p.spread.toFixed(1)}
                  </td>
                  <td className={cn('px-4 py-2.5 tabular-nums', isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    {isUp ? '+' : ''}{p.change > 100 ? p.change.toFixed(2) : p.change.toFixed(4)}
                  </td>
                  <td className={cn('px-4 py-2.5 tabular-nums font-medium', isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    {formatPercent(p.changePct)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-500">{p.dayHigh.toFixed(p.dayHigh > 100 ? 2 : 4)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-500">{p.dayLow.toFixed(p.dayLow > 100 ? 2 : 4)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Currency strength meter */}
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Activity className="h-4 w-4" /> Currency Strength
          </h3>
          <div className="space-y-2">
            {strengths.map((s) => {
              const pct = (s.strength / maxAbs) * 50;
              const isPos = s.strength >= 0;
              return (
                <div key={s.currency} className="flex items-center gap-2">
                  <span className="w-8 text-xs font-bold text-slate-600 dark:text-slate-400">{s.currency}</span>
                  <div className="relative h-5 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                    <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-300 dark:bg-slate-600" />
                    <div
                      className={cn('absolute top-0.5 bottom-0.5 rounded', isPos ? 'bg-emerald-500/70' : 'bg-red-500/70')}
                      style={isPos ? { left: '50%', width: `${Math.abs(pct)}%` } : { right: '50%', width: `${Math.abs(pct)}%` }}
                    />
                  </div>
                  <span className={cn('w-14 text-right text-xs tabular-nums font-medium', isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    {formatPercent(s.strength)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick converter */}
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Calculator className="h-4 w-4" /> Quick Converter
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={convAmount}
                onChange={(e) => setConvAmount(e.target.value)}
                className="w-28 rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700"
              />
              <select
                value={convFrom}
                onChange={(e) => setConvFrom(e.target.value)}
                className="rounded-lg border border-slate-200 bg-transparent px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700"
              >
                {allCurrencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <ArrowLeftRight className="h-4 w-4 shrink-0 text-slate-400" />
              <select
                value={convTo}
                onChange={(e) => setConvTo(e.target.value)}
                className="rounded-lg border border-slate-200 bg-transparent px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700"
              >
                {allCurrencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800">
              {convResult !== null ? (
                <p className="text-lg font-bold tabular-nums">
                  {convResult.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  <span className="ml-1 text-sm font-normal text-slate-400">{convTo}</span>
                </p>
              ) : (
                <p className="text-sm text-slate-400">No conversion rate available</p>
              )}
              <p className="mt-0.5 text-[10px] text-slate-400">Indicative rate from mock data</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
