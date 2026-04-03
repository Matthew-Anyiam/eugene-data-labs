import { useState, useMemo } from 'react';
import { UserCheck, Search, TrendingUp, TrendingDown, Filter } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

type TransactionType = 'Buy' | 'Sell' | 'Option Exercise';
type InsiderRole = 'CEO' | 'CFO' | 'Director' | 'VP' | '10% Owner' | 'COO';

interface InsiderTransaction {
  ticker: string;
  company: string;
  insiderName: string;
  role: InsiderRole;
  type: TransactionType;
  shares: number;
  pricePerShare: number;
  totalValue: number;
  date: string;
  daysAgo: number;
  priceChangeAfter: number;
  isCluster: boolean;
}

const NAMES = ['John Smith', 'Sarah Chen', 'Michael Johnson', 'Lisa Park', 'David Brown', 'Emily Williams', 'Robert Lee', 'Jennifer Davis', 'James Wilson', 'Maria Garcia', 'Thomas Anderson', 'Rachel Kim'];
const ROLES: InsiderRole[] = ['CEO', 'CFO', 'Director', 'VP', '10% Owner', 'COO'];
const TYPES: TransactionType[] = ['Buy', 'Sell', 'Option Exercise'];
const TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'JNJ', 'WMT', 'XOM', 'HD', 'PG', 'UNH', 'MA'];
const COMPANIES: Record<string, string> = {
  AAPL: 'Apple Inc', MSFT: 'Microsoft Corp', GOOGL: 'Alphabet Inc', AMZN: 'Amazon.com Inc',
  NVDA: 'NVIDIA Corp', META: 'Meta Platforms', TSLA: 'Tesla Inc', JPM: 'JPMorgan Chase',
  V: 'Visa Inc', JNJ: 'Johnson & Johnson', WMT: 'Walmart Inc', XOM: 'Exxon Mobil',
  HD: 'Home Depot', PG: 'Procter & Gamble', UNH: 'UnitedHealth Group', MA: 'Mastercard Inc',
};

function genTransactions(): InsiderTransaction[] {
  const txns: InsiderTransaction[] = [];
  for (let idx = 0; idx < 40; idx++) {
    const s = seed(`insider_${idx}`);
    const tickerIdx = Math.floor(pseudo(s, 0) * TICKERS.length);
    const ticker = TICKERS[tickerIdx];
    const nameIdx = Math.floor(pseudo(s, 1) * NAMES.length);
    const roleIdx = Math.floor(pseudo(s, 2) * ROLES.length);
    const typeIdx = Math.floor(pseudo(s, 3) * TYPES.length);
    const daysAgo = Math.floor(pseudo(s, 4) * 90);
    const shares = Math.floor(1000 + pseudo(s, 5) * 99000);
    const price = +(50 + pseudo(s, 6) * 450).toFixed(2);

    const date = new Date(2026, 3, 3);
    date.setDate(date.getDate() - daysAgo);

    txns.push({
      ticker,
      company: COMPANIES[ticker] || ticker,
      insiderName: NAMES[nameIdx],
      role: ROLES[roleIdx],
      type: TYPES[typeIdx],
      shares,
      pricePerShare: price,
      totalValue: +(shares * price),
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      daysAgo,
      priceChangeAfter: +((pseudo(s, 7) - 0.4) * 20).toFixed(2),
      isCluster: pseudo(s, 8) > 0.7,
    });
  }
  return txns.sort((a, b) => a.daysAgo - b.daysAgo);
}

export function InsiderTrackerPage() {
  const [typeFilter, setTypeFilter] = useState<'All' | TransactionType>('All');
  const [search, setSearch] = useState('');
  const [minValue, setMinValue] = useState(0);

  const transactions = useMemo(() => genTransactions(), []);

  const filtered = transactions
    .filter(t => typeFilter === 'All' || t.type === typeFilter)
    .filter(t => !search || t.ticker.includes(search.toUpperCase()) || t.insiderName.toLowerCase().includes(search.toLowerCase()))
    .filter(t => t.totalValue >= minValue);

  const totalBuyValue = transactions.filter(t => t.type === 'Buy').reduce((s, t) => s + t.totalValue, 0);
  const totalSellValue = transactions.filter(t => t.type === 'Sell').reduce((s, t) => s + t.totalValue, 0);
  const buyCount = transactions.filter(t => t.type === 'Buy').length;
  const sellCount = transactions.filter(t => t.type === 'Sell').length;
  const clusterCount = transactions.filter(t => t.isCluster).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserCheck className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Insider Tracker</h1>
          <p className="text-sm text-slate-400">Track insider buying/selling patterns and cluster activity</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Total Buy Value</div>
          <div className="mt-1 text-xl font-bold text-emerald-400">${(totalBuyValue / 1e6).toFixed(1)}M</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Total Sell Value</div>
          <div className="mt-1 text-xl font-bold text-red-400">${(totalSellValue / 1e6).toFixed(1)}M</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Buy/Sell Ratio</div>
          <div className={cn('mt-1 text-xl font-bold', buyCount >= sellCount ? 'text-emerald-400' : 'text-red-400')}>
            {sellCount > 0 ? (buyCount / sellCount).toFixed(2) : 'N/A'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Transactions (90d)</div>
          <div className="mt-1 text-xl font-bold text-white">{transactions.length}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Cluster Buys</div>
          <div className="mt-1 text-xl font-bold text-amber-400">{clusterCount}</div>
        </div>
      </div>

      {/* Buy/Sell activity bars */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Activity by Ticker</h3>
        <div className="space-y-2">
          {[...new Set(transactions.map(t => t.ticker))].slice(0, 8).map(ticker => {
            const buys = transactions.filter(t => t.ticker === ticker && t.type === 'Buy').reduce((s, t) => s + t.totalValue, 0);
            const sells = transactions.filter(t => t.ticker === ticker && t.type === 'Sell').reduce((s, t) => s + t.totalValue, 0);
            const max = Math.max(buys, sells, 1);
            return (
              <div key={ticker} className="flex items-center gap-2">
                <span className="w-12 text-xs font-mono text-indigo-400">{ticker}</span>
                <div className="flex-1 flex gap-1">
                  <div className="flex-1 flex justify-end">
                    <div className="h-4 rounded-l bg-emerald-500/40" style={{ width: `${(buys / max) * 100}%` }} />
                  </div>
                  <div className="flex-1">
                    <div className="h-4 rounded-r bg-red-500/40" style={{ width: `${(sells / max) * 100}%` }} />
                  </div>
                </div>
                <div className="flex gap-2 text-[10px] w-36">
                  <span className="text-emerald-400">${(buys / 1e6).toFixed(1)}M</span>
                  <span className="text-red-400">${(sells / 1e6).toFixed(1)}M</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex gap-4 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500/40" /> Buys</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500/40" /> Sells</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search..." className="w-40 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none" />
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
          {(['All', 'Buy', 'Sell', 'Option Exercise'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn('rounded-md px-2.5 py-1 text-xs font-medium', typeFilter === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>
              {t}
            </button>
          ))}
        </div>
        <select value={minValue} onChange={e => setMinValue(Number(e.target.value))}
          className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none">
          <option value={0}>All values</option>
          <option value={100000}>$100K+</option>
          <option value={500000}>$500K+</option>
          <option value={1000000}>$1M+</option>
          <option value={5000000}>$5M+</option>
        </select>
      </div>

      {/* Transaction table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Date</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Insider</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Role</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Type</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Shares</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Price</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Value</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Price After</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Signal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.map((t, i) => (
              <tr key={i} className={cn('bg-slate-800 hover:bg-slate-750', t.isCluster && 'bg-amber-900/10')}>
                <td className="px-3 py-2 text-xs text-slate-400">{t.date}</td>
                <td className="px-3 py-2 text-xs font-bold text-indigo-400">{t.ticker}</td>
                <td className="px-3 py-2 text-xs text-white">{t.insiderName}</td>
                <td className="px-3 py-2 text-xs text-slate-400">{t.role}</td>
                <td className="px-3 py-2 text-center">
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium',
                    t.type === 'Buy' ? 'bg-emerald-900/40 text-emerald-400' :
                    t.type === 'Sell' ? 'bg-red-900/40 text-red-400' :
                    'bg-slate-700 text-slate-300'
                  )}>{t.type}</span>
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-300">{t.shares.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-xs text-slate-300">${t.pricePerShare}</td>
                <td className="px-3 py-2 text-right text-xs text-white font-medium">
                  ${t.totalValue >= 1e6 ? `${(t.totalValue / 1e6).toFixed(1)}M` : `${(t.totalValue / 1e3).toFixed(0)}K`}
                </td>
                <td className={cn('px-3 py-2 text-right text-xs font-medium', t.priceChangeAfter >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {t.priceChangeAfter >= 0 ? '+' : ''}{t.priceChangeAfter}%
                </td>
                <td className="px-3 py-2 text-center">
                  {t.isCluster && <span className="text-[9px] font-bold text-amber-400">CLUSTER</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
