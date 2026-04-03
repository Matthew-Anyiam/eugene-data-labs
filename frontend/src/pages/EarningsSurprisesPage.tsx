import { useState, useMemo } from 'react';
import { Zap, TrendingUp, TrendingDown, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const STOCKS = [
  { ticker: 'AAPL', name: 'Apple' }, { ticker: 'MSFT', name: 'Microsoft' },
  { ticker: 'GOOGL', name: 'Alphabet' }, { ticker: 'AMZN', name: 'Amazon' },
  { ticker: 'NVDA', name: 'NVIDIA' }, { ticker: 'META', name: 'Meta' },
  { ticker: 'TSLA', name: 'Tesla' }, { ticker: 'JPM', name: 'JPMorgan' },
  { ticker: 'V', name: 'Visa' }, { ticker: 'UNH', name: 'UnitedHealth' },
  { ticker: 'NFLX', name: 'Netflix' }, { ticker: 'AMD', name: 'AMD' },
  { ticker: 'CRM', name: 'Salesforce' }, { ticker: 'DIS', name: 'Disney' },
  { ticker: 'BA', name: 'Boeing' }, { ticker: 'GS', name: 'Goldman Sachs' },
  { ticker: 'COST', name: 'Costco' }, { ticker: 'HD', name: 'Home Depot' },
  { ticker: 'WMT', name: 'Walmart' }, { ticker: 'PG', name: 'P&G' },
  { ticker: 'KO', name: 'Coca-Cola' }, { ticker: 'PEP', name: 'PepsiCo' },
  { ticker: 'INTC', name: 'Intel' }, { ticker: 'QCOM', name: 'Qualcomm' },
  { ticker: 'ADBE', name: 'Adobe' }, { ticker: 'PYPL', name: 'PayPal' },
  { ticker: 'ABNB', name: 'Airbnb' }, { ticker: 'UBER', name: 'Uber' },
  { ticker: 'SQ', name: 'Block' }, { ticker: 'SHOP', name: 'Shopify' },
];

interface Surprise {
  ticker: string;
  name: string;
  reportDate: string;
  quarter: string;
  epsEstimate: number;
  epsActual: number;
  epsSurprise: number;
  epsSurprisePct: number;
  revEstimate: number;
  revActual: number;
  revSurprise: number;
  revSurprisePct: number;
  priceReaction: number;
  sector: string;
}

const SECTORS = ['Technology', 'Healthcare', 'Financials', 'Consumer', 'Industrial', 'Energy'];

function genSurprises(): Surprise[] {
  return STOCKS.map((stock, si) => {
    const s = seed(stock.ticker + '_surp');
    const epsEst = 0.5 + pseudo(s, 0) * 5;
    const epsSurpPct = (pseudo(s, 1) - 0.4) * 30;
    const epsActual = epsEst * (1 + epsSurpPct / 100);
    const revEst = 5 + pseudo(s, 2) * 80;
    const revSurpPct = (pseudo(s, 3) - 0.45) * 10;
    const revActual = revEst * (1 + revSurpPct / 100);
    const priceReaction = (pseudo(s, 4) - 0.45) * 15;
    const qtr = Math.floor(pseudo(s, 5) * 4);
    const month = qtr * 3 + 1 + Math.floor(pseudo(s, 6) * 2);
    const day = 1 + Math.floor(pseudo(s, 7) * 28);

    return {
      ticker: stock.ticker, name: stock.name,
      reportDate: `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      quarter: `Q${qtr + 1} 2025`,
      epsEstimate: +epsEst.toFixed(2), epsActual: +epsActual.toFixed(2),
      epsSurprise: +(epsActual - epsEst).toFixed(2), epsSurprisePct: +epsSurpPct.toFixed(1),
      revEstimate: +revEst.toFixed(1), revActual: +revActual.toFixed(1),
      revSurprise: +(revActual - revEst).toFixed(1), revSurprisePct: +revSurpPct.toFixed(1),
      priceReaction: +priceReaction.toFixed(1),
      sector: SECTORS[Math.floor(pseudo(s, 8) * SECTORS.length)],
    };
  });
}

type SortKey = 'epsSurprisePct' | 'revSurprisePct' | 'priceReaction';

export function EarningsSurprisesPage() {
  const [filter, setFilter] = useState<'all' | 'beats' | 'misses'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('epsSurprisePct');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sectorFilter, setSectorFilter] = useState<string>('all');

  const allSurprises = useMemo(() => genSurprises(), []);

  const filtered = useMemo(() => {
    let list = [...allSurprises];
    if (filter === 'beats') list = list.filter(s => s.epsSurprisePct > 0);
    if (filter === 'misses') list = list.filter(s => s.epsSurprisePct < 0);
    if (sectorFilter !== 'all') list = list.filter(s => s.sector === sectorFilter);
    list.sort((a, b) => sortDir === 'desc' ? Math.abs(b[sortBy]) - Math.abs(a[sortBy]) : Math.abs(a[sortBy]) - Math.abs(b[sortBy]));
    return list;
  }, [allSurprises, filter, sectorFilter, sortBy, sortDir]);

  const beats = allSurprises.filter(s => s.epsSurprisePct > 0);
  const misses = allSurprises.filter(s => s.epsSurprisePct < 0);
  const avgSurprise = allSurprises.reduce((s, x) => s + x.epsSurprisePct, 0) / allSurprises.length;
  const avgReaction = allSurprises.reduce((s, x) => s + x.priceReaction, 0) / allSurprises.length;
  const biggestBeat = [...allSurprises].sort((a, b) => b.epsSurprisePct - a.epsSurprisePct)[0];
  const biggestMiss = [...allSurprises].sort((a, b) => a.epsSurprisePct - b.epsSurprisePct)[0];

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Zap className="h-6 w-6 text-fuchsia-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Earnings Surprises</h1>
          <p className="text-sm text-slate-400">Biggest EPS beats and misses, revenue surprises, price reactions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
          {(['all', 'beats', 'misses'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('rounded-md px-3 py-1 text-xs font-medium capitalize', filter === f ? 'bg-fuchsia-600 text-white' : 'text-slate-400 hover:text-white')}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-slate-500" />
          <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white">
            <option value="all">All Sectors</option>
            {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Total Reports', value: allSurprises.length.toString(), color: 'text-white' },
          { label: 'Beats', value: `${beats.length} (${((beats.length / allSurprises.length) * 100).toFixed(0)}%)`, color: 'text-emerald-400' },
          { label: 'Misses', value: `${misses.length} (${((misses.length / allSurprises.length) * 100).toFixed(0)}%)`, color: 'text-red-400' },
          { label: 'Avg Surprise', value: `${avgSurprise >= 0 ? '+' : ''}${avgSurprise.toFixed(1)}%`, color: avgSurprise >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Avg Reaction', value: `${avgReaction >= 0 ? '+' : ''}${avgReaction.toFixed(1)}%`, color: avgReaction >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Beat Rate', value: `${((beats.length / allSurprises.length) * 100).toFixed(0)}%`, color: 'text-fuchsia-400' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
            <div className={cn('mt-1 text-lg font-bold', c.color)}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Biggest beat/miss */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="text-xs text-emerald-400 uppercase tracking-wider mb-2">Biggest Beat</div>
          <div className="flex items-center gap-3">
            <Link to={`/company/${biggestBeat.ticker}`} className="font-mono text-lg font-bold text-emerald-400 hover:underline">{biggestBeat.ticker}</Link>
            <span className="text-sm text-slate-300">{biggestBeat.name}</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">+{biggestBeat.epsSurprisePct}%</div>
          <div className="text-xs text-slate-400">EPS: ${biggestBeat.epsActual} vs est. ${biggestBeat.epsEstimate}</div>
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="text-xs text-red-400 uppercase tracking-wider mb-2">Biggest Miss</div>
          <div className="flex items-center gap-3">
            <Link to={`/company/${biggestMiss.ticker}`} className="font-mono text-lg font-bold text-red-400 hover:underline">{biggestMiss.ticker}</Link>
            <span className="text-sm text-slate-300">{biggestMiss.name}</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-red-400">{biggestMiss.epsSurprisePct}%</div>
          <div className="text-xs text-slate-400">EPS: ${biggestMiss.epsActual} vs est. ${biggestMiss.epsEstimate}</div>
        </div>
      </div>

      {/* Surprise distribution */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">EPS Surprise Distribution</h3>
        <div className="flex items-end gap-1">
          {['-15+', '-10', '-5', '0', '+5', '+10', '+15+'].map((label, i) => {
            const ranges = [[-100, -10], [-10, -5], [-5, 0], [0, 5], [5, 10], [10, 15], [15, 100]];
            const [low, high] = ranges[i];
            const count = allSurprises.filter(s => s.epsSurprisePct >= low && s.epsSurprisePct < high).length;
            const maxCount = 15;
            const height = Math.max(8, (count / maxCount) * 100);
            return (
              <div key={label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-slate-400">{count}</span>
                <div className={cn('w-full rounded-t', i < 3 ? 'bg-red-500/50' : i === 3 ? 'bg-slate-600' : 'bg-emerald-500/50')}
                  style={{ height: `${height}px` }} />
                <span className="text-[9px] text-slate-500">{label}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Company</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Quarter</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">EPS Est</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">EPS Act</th>
              <th className="px-3 py-2 text-right">
                <button onClick={() => toggleSort('epsSurprisePct')}
                  className={cn('text-xs font-medium', sortBy === 'epsSurprisePct' ? 'text-fuchsia-400' : 'text-slate-400 hover:text-slate-300')}>
                  EPS Surprise {sortBy === 'epsSurprisePct' && (sortDir === 'desc' ? '↓' : '↑')}
                </button>
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Rev Est</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Rev Act</th>
              <th className="px-3 py-2 text-right">
                <button onClick={() => toggleSort('revSurprisePct')}
                  className={cn('text-xs font-medium', sortBy === 'revSurprisePct' ? 'text-fuchsia-400' : 'text-slate-400 hover:text-slate-300')}>
                  Rev Surprise {sortBy === 'revSurprisePct' && (sortDir === 'desc' ? '↓' : '↑')}
                </button>
              </th>
              <th className="px-3 py-2 text-right">
                <button onClick={() => toggleSort('priceReaction')}
                  className={cn('text-xs font-medium', sortBy === 'priceReaction' ? 'text-fuchsia-400' : 'text-slate-400 hover:text-slate-300')}>
                  Price {sortBy === 'priceReaction' && (sortDir === 'desc' ? '↓' : '↑')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.map(s => (
              <tr key={s.ticker} className={cn('hover:bg-slate-750', s.epsSurprisePct > 0 ? 'bg-slate-800' : 'bg-red-500/5')}>
                <td className="px-3 py-2">
                  <Link to={`/company/${s.ticker}`} className="font-mono text-xs font-bold text-fuchsia-400 hover:underline">{s.ticker}</Link>
                </td>
                <td className="px-3 py-2 text-xs text-slate-300">{s.name}</td>
                <td className="px-3 py-2 text-xs text-slate-400">{s.quarter}</td>
                <td className="px-3 py-2 text-right text-xs text-slate-400">${s.epsEstimate}</td>
                <td className="px-3 py-2 text-right text-xs text-white font-medium">${s.epsActual}</td>
                <td className="px-3 py-2 text-right">
                  <span className={cn('flex items-center justify-end gap-0.5 text-xs font-bold',
                    s.epsSurprisePct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {s.epsSurprisePct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {s.epsSurprisePct >= 0 ? '+' : ''}{s.epsSurprisePct}%
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-400">${s.revEstimate}B</td>
                <td className="px-3 py-2 text-right text-xs text-white font-medium">${s.revActual}B</td>
                <td className={cn('px-3 py-2 text-right text-xs font-medium',
                  s.revSurprisePct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {s.revSurprisePct >= 0 ? '+' : ''}{s.revSurprisePct}%
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={cn('text-xs font-bold', s.priceReaction >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {s.priceReaction >= 0 ? '+' : ''}{s.priceReaction}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
