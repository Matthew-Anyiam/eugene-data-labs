import { useState, useMemo } from 'react';
import { CircleDollarSign, TrendingUp, TrendingDown, Calendar, Filter } from 'lucide-react';
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

const DIVIDEND_STOCKS = [
  { ticker: 'AAPL', name: 'Apple', sector: 'Technology' },
  { ticker: 'MSFT', name: 'Microsoft', sector: 'Technology' },
  { ticker: 'JPM', name: 'JPMorgan', sector: 'Financials' },
  { ticker: 'JNJ', name: 'J&J', sector: 'Healthcare' },
  { ticker: 'PG', name: 'P&G', sector: 'Consumer Staples' },
  { ticker: 'KO', name: 'Coca-Cola', sector: 'Consumer Staples' },
  { ticker: 'PEP', name: 'PepsiCo', sector: 'Consumer Staples' },
  { ticker: 'XOM', name: 'Exxon', sector: 'Energy' },
  { ticker: 'CVX', name: 'Chevron', sector: 'Energy' },
  { ticker: 'HD', name: 'Home Depot', sector: 'Consumer' },
  { ticker: 'MCD', name: "McDonald's", sector: 'Consumer' },
  { ticker: 'VZ', name: 'Verizon', sector: 'Telecom' },
  { ticker: 'T', name: 'AT&T', sector: 'Telecom' },
  { ticker: 'ABBV', name: 'AbbVie', sector: 'Healthcare' },
  { ticker: 'MRK', name: 'Merck', sector: 'Healthcare' },
  { ticker: 'BAC', name: 'BofA', sector: 'Financials' },
  { ticker: 'WMT', name: 'Walmart', sector: 'Consumer' },
  { ticker: 'COST', name: 'Costco', sector: 'Consumer' },
  { ticker: 'ABT', name: 'Abbott', sector: 'Healthcare' },
  { ticker: 'LMT', name: 'Lockheed', sector: 'Industrial' },
];

interface DividendStock {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  annualDiv: number;
  yield: number;
  payoutRatio: number;
  exDate: string;
  payDate: string;
  frequency: 'Quarterly' | 'Monthly' | 'Semi-Annual';
  consecutiveYears: number;
  growth5Y: number;
  growth1Y: number;
  isAristocrat: boolean;
  isKing: boolean;
  history: { year: number; amount: number }[];
}

function genDividendData(): DividendStock[] {
  return DIVIDEND_STOCKS.map((stock) => {
    const s = seed(stock.ticker + '_div');
    const price = 30 + pseudo(s, 0) * 400;
    const yieldPct = 0.5 + pseudo(s, 1) * 5;
    const annualDiv = +(price * yieldPct / 100).toFixed(2);
    const payoutRatio = 20 + pseudo(s, 2) * 60;
    const exMonth = 1 + Math.floor(pseudo(s, 3) * 3);
    const exDay = 1 + Math.floor(pseudo(s, 4) * 28);
    const payMonth = exMonth + 1;
    const payDay = 1 + Math.floor(pseudo(s, 5) * 28);
    const consecutiveYears = Math.floor(5 + pseudo(s, 6) * 50);
    const growth5Y = 2 + pseudo(s, 7) * 15;
    const growth1Y = 1 + pseudo(s, 8) * 12;
    const isAristocrat = consecutiveYears >= 25;
    const isKing = consecutiveYears >= 50;
    const freq = pseudo(s, 9) > 0.9 ? 'Monthly' : pseudo(s, 9) > 0.1 ? 'Quarterly' : 'Semi-Annual';

    const history = Array.from({ length: 10 }, (_, i) => {
      const year = 2025 - i;
      const baseAmount = annualDiv * Math.pow(1 / (1 + growth5Y / 100), i);
      return { year, amount: +baseAmount.toFixed(2) };
    }).reverse();

    return {
      ...stock, price: +price.toFixed(2), annualDiv, yield: +yieldPct.toFixed(2),
      payoutRatio: +payoutRatio.toFixed(1),
      exDate: `2025-${String(exMonth).padStart(2, '0')}-${String(exDay).padStart(2, '0')}`,
      payDate: `2025-${String(payMonth).padStart(2, '0')}-${String(payDay).padStart(2, '0')}`,
      frequency: freq as DividendStock['frequency'],
      consecutiveYears, growth5Y: +growth5Y.toFixed(1), growth1Y: +growth1Y.toFixed(1),
      isAristocrat, isKing, history,
    };
  });
}

type SortKey = 'yield' | 'growth5Y' | 'consecutiveYears' | 'payoutRatio';

export function DividendTrackerPage() {
  const [filter, setFilter] = useState<'all' | 'aristocrats' | 'kings' | 'high-yield'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('yield');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  const allStocks = useMemo(() => genDividendData(), []);
  const sectors = useMemo(() => [...new Set(allStocks.map(s => s.sector))], [allStocks]);

  const filtered = useMemo(() => {
    let list = [...allStocks];
    if (filter === 'aristocrats') list = list.filter(s => s.isAristocrat);
    if (filter === 'kings') list = list.filter(s => s.isKing);
    if (filter === 'high-yield') list = list.filter(s => s.yield >= 3);
    if (sectorFilter !== 'all') list = list.filter(s => s.sector === sectorFilter);
    list.sort((a, b) => sortDir === 'desc' ? b[sortBy] - a[sortBy] : a[sortBy] - b[sortBy]);
    return list;
  }, [allStocks, filter, sectorFilter, sortBy, sortDir]);

  const avgYield = allStocks.reduce((s, x) => s + x.yield, 0) / allStocks.length;
  const aristocrats = allStocks.filter(s => s.isAristocrat).length;
  const kings = allStocks.filter(s => s.isKing).length;
  const avgGrowth = allStocks.reduce((s, x) => s + x.growth5Y, 0) / allStocks.length;
  const upcomingEx = [...allStocks].sort((a, b) => a.exDate.localeCompare(b.exDate)).slice(0, 5);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CircleDollarSign className="h-6 w-6 text-green-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Dividend Tracker</h1>
          <p className="text-sm text-slate-400">Dividend history, yields, payout ratios, and growth streaks</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
          {(['all', 'aristocrats', 'kings', 'high-yield'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('rounded-md px-3 py-1 text-xs font-medium capitalize', filter === f ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white')}>
              {f === 'high-yield' ? 'High Yield (3%+)' : f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-slate-500" />
          <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white">
            <option value="all">All Sectors</option>
            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Avg Yield', value: `${avgYield.toFixed(2)}%`, color: 'text-green-400' },
          { label: 'Aristocrats (25Y+)', value: aristocrats.toString(), color: 'text-amber-400' },
          { label: 'Kings (50Y+)', value: kings.toString(), color: 'text-yellow-400' },
          { label: 'Avg 5Y Growth', value: `${avgGrowth.toFixed(1)}%`, color: 'text-emerald-400' },
          { label: 'Stocks Tracked', value: allStocks.length.toString(), color: 'text-white' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
            <div className={cn('mt-1 text-lg font-bold', c.color)}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Upcoming ex-dates */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Calendar className="h-4 w-4 text-green-400" /> Upcoming Ex-Dividend Dates
        </h3>
        <div className="grid gap-2 sm:grid-cols-5">
          {upcomingEx.map(s => (
            <div key={s.ticker} className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-center">
              <Link to={`/company/${s.ticker}`} className="font-mono text-xs font-bold text-green-400 hover:underline">{s.ticker}</Link>
              <div className="mt-1 text-sm font-bold text-white">${s.annualDiv / 4 > 0 ? (s.annualDiv / 4).toFixed(2) : s.annualDiv.toFixed(2)}</div>
              <div className="mt-0.5 text-[10px] text-slate-500">Ex: {s.exDate}</div>
              <div className="text-[10px] text-slate-600">Yield: {s.yield}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Company</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Price</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Annual Div</th>
              <th className="px-3 py-2 text-right">
                <button onClick={() => toggleSort('yield')} className={cn('text-xs font-medium', sortBy === 'yield' ? 'text-green-400' : 'text-slate-400')}>
                  Yield {sortBy === 'yield' && (sortDir === 'desc' ? '↓' : '↑')}
                </button>
              </th>
              <th className="px-3 py-2 text-right">
                <button onClick={() => toggleSort('payoutRatio')} className={cn('text-xs font-medium', sortBy === 'payoutRatio' ? 'text-green-400' : 'text-slate-400')}>
                  Payout {sortBy === 'payoutRatio' && (sortDir === 'desc' ? '↓' : '↑')}
                </button>
              </th>
              <th className="px-3 py-2 text-right">
                <button onClick={() => toggleSort('consecutiveYears')} className={cn('text-xs font-medium', sortBy === 'consecutiveYears' ? 'text-green-400' : 'text-slate-400')}>
                  Streak {sortBy === 'consecutiveYears' && (sortDir === 'desc' ? '↓' : '↑')}
                </button>
              </th>
              <th className="px-3 py-2 text-right">
                <button onClick={() => toggleSort('growth5Y')} className={cn('text-xs font-medium', sortBy === 'growth5Y' ? 'text-green-400' : 'text-slate-400')}>
                  5Y Growth {sortBy === 'growth5Y' && (sortDir === 'desc' ? '↓' : '↑')}
                </button>
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Freq</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.map(s => (
              <>
                <tr key={s.ticker} className="bg-slate-800 hover:bg-slate-750 cursor-pointer"
                  onClick={() => setExpandedTicker(expandedTicker === s.ticker ? null : s.ticker)}>
                  <td className="px-3 py-2">
                    <Link to={`/company/${s.ticker}`} onClick={e => e.stopPropagation()} className="font-mono text-xs font-bold text-green-400 hover:underline">{s.ticker}</Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-300">{s.name}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">${s.price}</td>
                  <td className="px-3 py-2 text-right text-xs text-white font-medium">${s.annualDiv}</td>
                  <td className="px-3 py-2 text-right text-xs font-bold text-green-400">{s.yield}%</td>
                  <td className={cn('px-3 py-2 text-right text-xs font-medium', s.payoutRatio > 80 ? 'text-red-400' : s.payoutRatio > 60 ? 'text-amber-400' : 'text-emerald-400')}>
                    {s.payoutRatio}%
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-white">{s.consecutiveYears}Y</td>
                  <td className="px-3 py-2 text-right">
                    <span className="flex items-center justify-end gap-0.5 text-xs font-medium text-emerald-400">
                      <TrendingUp className="h-3 w-3" /> +{s.growth5Y}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">{s.frequency}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex justify-center gap-1">
                      {s.isKing && <span className="rounded bg-yellow-500/20 px-1 py-0.5 text-[9px] font-bold text-yellow-400">KING</span>}
                      {s.isAristocrat && !s.isKing && <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-bold text-amber-400">ARISTOCRAT</span>}
                    </div>
                  </td>
                </tr>
                {expandedTicker === s.ticker && (
                  <tr key={s.ticker + '_exp'} className="bg-slate-800/50">
                    <td colSpan={10} className="px-3 py-3">
                      <div className="text-xs text-slate-400 mb-2">10-Year Dividend History</div>
                      <div className="flex items-end gap-2" style={{ height: '80px' }}>
                        {s.history.map(h => {
                          const maxAmt = Math.max(...s.history.map(x => x.amount));
                          const height = maxAmt > 0 ? (h.amount / maxAmt) * 70 : 0;
                          return (
                            <div key={h.year} className="flex flex-1 flex-col items-center gap-0.5">
                              <span className="text-[9px] text-green-400">${h.amount}</span>
                              <div className="w-full rounded-t bg-green-500/40" style={{ height: `${Math.max(4, height)}px` }} />
                              <span className="text-[8px] text-slate-600">{h.year}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-2 flex gap-4 text-[10px] text-slate-500">
                        <span>Ex-Date: {s.exDate}</span>
                        <span>Pay Date: {s.payDate}</span>
                        <span>1Y Growth: +{s.growth1Y}%</span>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Yield distribution */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Yield Distribution</h3>
        <div className="flex items-end gap-2">
          {['0-1%', '1-2%', '2-3%', '3-4%', '4-5%', '5%+'].map((label, i) => {
            const ranges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 100]];
            const [low, high] = ranges[i];
            const count = allStocks.filter(s => s.yield >= low && s.yield < high).length;
            const maxCount = 10;
            const height = Math.max(8, (count / maxCount) * 80);
            return (
              <div key={label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-slate-400">{count}</span>
                <div className="w-full rounded-t bg-green-500/40" style={{ height: `${height}px` }} />
                <span className="text-[9px] text-slate-500">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
