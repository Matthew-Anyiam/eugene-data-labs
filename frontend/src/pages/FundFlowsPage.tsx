import { useState, useMemo } from 'react';
import { ArrowDownUp, TrendingUp, TrendingDown, Search, Filter } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const CATEGORIES = ['All', 'Equity', 'Fixed Income', 'Commodity', 'Sector', 'International'] as const;
type Category = (typeof CATEGORIES)[number];

const TIMEFRAMES = ['1W', '1M', '3M', 'YTD'] as const;

interface FundFlow {
  name: string;
  ticker: string;
  category: string;
  aum: number;
  flow1w: number;
  flow1m: number;
  flow3m: number;
  flowYtd: number;
  price: number;
  return1m: number;
}

const FUNDS: { name: string; ticker: string; category: string }[] = [
  { name: 'SPDR S&P 500 ETF', ticker: 'SPY', category: 'Equity' },
  { name: 'Invesco QQQ Trust', ticker: 'QQQ', category: 'Equity' },
  { name: 'iShares Russell 2000', ticker: 'IWM', category: 'Equity' },
  { name: 'Vanguard Total Stock', ticker: 'VTI', category: 'Equity' },
  { name: 'iShares Core S&P 500', ticker: 'IVV', category: 'Equity' },
  { name: 'Vanguard Total Bond', ticker: 'BND', category: 'Fixed Income' },
  { name: 'iShares 20+ Year Treasury', ticker: 'TLT', category: 'Fixed Income' },
  { name: 'iShares iBoxx IG Corp', ticker: 'LQD', category: 'Fixed Income' },
  { name: 'Vanguard Short-Term Bond', ticker: 'BSV', category: 'Fixed Income' },
  { name: 'SPDR Gold Shares', ticker: 'GLD', category: 'Commodity' },
  { name: 'iShares Silver Trust', ticker: 'SLV', category: 'Commodity' },
  { name: 'United States Oil Fund', ticker: 'USO', category: 'Commodity' },
  { name: 'Technology Select SPDR', ticker: 'XLK', category: 'Sector' },
  { name: 'Financial Select SPDR', ticker: 'XLF', category: 'Sector' },
  { name: 'Health Care Select SPDR', ticker: 'XLV', category: 'Sector' },
  { name: 'Energy Select SPDR', ticker: 'XLE', category: 'Sector' },
  { name: 'Real Estate Select SPDR', ticker: 'XLRE', category: 'Sector' },
  { name: 'Vanguard FTSE Emerging', ticker: 'VWO', category: 'International' },
  { name: 'iShares MSCI EAFE', ticker: 'EFA', category: 'International' },
  { name: 'iShares MSCI Japan', ticker: 'EWJ', category: 'International' },
];

function genFlows(): FundFlow[] {
  return FUNDS.map((f) => {
    const s = seed(f.ticker + '_flow');
    const aum = 10 + pseudo(s, 0) * 490;
    return {
      ...f,
      aum: +aum.toFixed(1),
      flow1w: +((pseudo(s, 1) - 0.45) * 8).toFixed(2),
      flow1m: +((pseudo(s, 2) - 0.4) * 20).toFixed(2),
      flow3m: +((pseudo(s, 3) - 0.35) * 40).toFixed(2),
      flowYtd: +((pseudo(s, 4) - 0.3) * 60).toFixed(2),
      price: +(50 + pseudo(s, 5) * 400).toFixed(2),
      return1m: +((pseudo(s, 6) - 0.4) * 15).toFixed(2),
    };
  });
}

const SECTOR_FLOWS = [
  'Technology', 'Healthcare', 'Financials', 'Energy', 'Consumer Discretionary',
  'Industrials', 'Real Estate', 'Utilities', 'Materials', 'Communication',
];

function genSectorFlows() {
  return SECTOR_FLOWS.map((name, i) => {
    const s = seed(name + '_sf');
    return {
      name,
      flow1w: +((pseudo(s, 0) - 0.45) * 5).toFixed(2),
      flow1m: +((pseudo(s, 1) - 0.4) * 15).toFixed(2),
      pctOfTotal: +(5 + pseudo(s, 2) * 20).toFixed(1),
    };
  });
}

export function FundFlowsPage() {
  const [category, setCategory] = useState<Category>('All');
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>('1M');
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<'flow' | 'aum' | 'return'>('flow');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const flows = useMemo(() => genFlows(), []);
  const sectorFlows = useMemo(() => genSectorFlows(), []);

  const getFlow = (f: FundFlow) => {
    if (timeframe === '1W') return f.flow1w;
    if (timeframe === '1M') return f.flow1m;
    if (timeframe === '3M') return f.flow3m;
    return f.flowYtd;
  };

  const filtered = flows
    .filter(f => category === 'All' || f.category === category)
    .filter(f => !search || f.ticker.includes(search.toUpperCase()) || f.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let va: number, vb: number;
      if (sortCol === 'flow') { va = getFlow(a); vb = getFlow(b); }
      else if (sortCol === 'aum') { va = a.aum; vb = b.aum; }
      else { va = a.return1m; vb = b.return1m; }
      return sortDir === 'desc' ? vb - va : va - vb;
    });

  const totalInflow = filtered.filter(f => getFlow(f) > 0).reduce((s, f) => s + getFlow(f), 0);
  const totalOutflow = filtered.filter(f => getFlow(f) < 0).reduce((s, f) => s + getFlow(f), 0);
  const netFlow = totalInflow + totalOutflow;

  const toggleSort = (col: 'flow' | 'aum' | 'return') => {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ArrowDownUp className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Fund Flows</h1>
          <p className="text-sm text-slate-400">Track money flowing in and out of ETFs and funds</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Net Flow ({timeframe})</div>
          <div className={cn('mt-1 text-2xl font-bold', netFlow >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {netFlow >= 0 ? '+' : ''}${netFlow.toFixed(1)}B
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Total Inflows</div>
          <div className="mt-1 text-2xl font-bold text-emerald-400">+${totalInflow.toFixed(1)}B</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Total Outflows</div>
          <div className="mt-1 text-2xl font-bold text-red-400">${totalOutflow.toFixed(1)}B</div>
        </div>
      </div>

      {/* Sector flow bars */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Sector Flows (1M)</h3>
        <div className="space-y-2">
          {sectorFlows.sort((a, b) => b.flow1m - a.flow1m).map(sf => {
            const maxAbs = Math.max(...sectorFlows.map(s => Math.abs(s.flow1m)));
            const pct = maxAbs > 0 ? Math.abs(sf.flow1m) / maxAbs * 100 : 0;
            return (
              <div key={sf.name} className="flex items-center gap-3">
                <span className="w-36 text-xs text-slate-400 truncate">{sf.name}</span>
                <div className="flex-1 flex items-center">
                  {sf.flow1m >= 0 ? (
                    <div className="flex w-full">
                      <div className="w-1/2" />
                      <div className="w-1/2">
                        <div className="h-4 rounded-r bg-emerald-500/40" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex w-full">
                      <div className="flex w-1/2 justify-end">
                        <div className="h-4 rounded-l bg-red-500/40" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-1/2" />
                    </div>
                  )}
                </div>
                <span className={cn('w-16 text-right text-xs font-medium', sf.flow1m >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {sf.flow1m >= 0 ? '+' : ''}{sf.flow1m}B
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search funds..." className="w-44 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none" />
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={cn('rounded-md px-2.5 py-1 text-xs font-medium', category === c ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>
              {c}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
          {TIMEFRAMES.map(t => (
            <button key={t} onClick={() => setTimeframe(t)}
              className={cn('rounded-md px-2.5 py-1 text-xs font-medium', timeframe === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Fund table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Fund</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
              <th className="cursor-pointer px-3 py-2 text-right text-xs font-medium text-slate-400" onClick={() => toggleSort('aum')}>
                AUM {sortCol === 'aum' && (sortDir === 'desc' ? '↓' : '↑')}
              </th>
              <th className="cursor-pointer px-3 py-2 text-right text-xs font-medium text-slate-400" onClick={() => toggleSort('flow')}>
                Flow ({timeframe}) {sortCol === 'flow' && (sortDir === 'desc' ? '↓' : '↑')}
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Price</th>
              <th className="cursor-pointer px-3 py-2 text-right text-xs font-medium text-slate-400" onClick={() => toggleSort('return')}>
                1M Return {sortCol === 'return' && (sortDir === 'desc' ? '↓' : '↑')}
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Flow Bar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.map(f => {
              const flow = getFlow(f);
              const maxFlow = Math.max(...filtered.map(x => Math.abs(getFlow(x))));
              const barPct = maxFlow > 0 ? Math.abs(flow) / maxFlow * 100 : 0;
              return (
                <tr key={f.ticker} className="bg-slate-800 hover:bg-slate-750">
                  <td className="px-3 py-2 text-xs text-white font-medium max-w-[180px] truncate">{f.name}</td>
                  <td className="px-3 py-2 text-xs text-indigo-400 font-mono">{f.ticker}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">${f.aum}B</td>
                  <td className={cn('px-3 py-2 text-right text-xs font-medium', flow >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {flow >= 0 ? '+' : ''}{flow}B
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">${f.price}</td>
                  <td className={cn('px-3 py-2 text-right text-xs font-medium', f.return1m >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {f.return1m >= 0 ? '+' : ''}{f.return1m}%
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end">
                      <div className="h-3 w-20 rounded-full bg-slate-700">
                        <div className={cn('h-3 rounded-full', flow >= 0 ? 'bg-emerald-500/60' : 'bg-red-500/60')}
                          style={{ width: `${barPct}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
