import { useState, useMemo } from 'react';
import { UserCheck, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
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
  { ticker: 'INTC', name: 'Intel' }, { ticker: 'QCOM', name: 'Qualcomm' },
  { ticker: 'ADBE', name: 'Adobe' }, { ticker: 'PYPL', name: 'PayPal' },
  { ticker: 'SQ', name: 'Block' }, { ticker: 'UBER', name: 'Uber' },
];

interface InsiderSignal {
  ticker: string;
  name: string;
  buys30d: number;
  sells30d: number;
  buyValue: number;
  sellValue: number;
  netSignal: number; // -100 to +100
  sentiment: 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell';
  topInsider: string;
  topAction: 'Buy' | 'Sell';
  topAmount: number;
  lastDate: string;
  priceAtFiling: number;
  currentPrice: number;
  priceSince: number;
}

function genSignals(): InsiderSignal[] {
  return STOCKS.map((stock) => {
    const s = seed(stock.ticker + '_inssent');
    const buys = Math.floor(pseudo(s, 0) * 12);
    const sells = Math.floor(pseudo(s, 1) * 8);
    const buyVal = buys * (100000 + pseudo(s, 2) * 5000000);
    const sellVal = sells * (50000 + pseudo(s, 3) * 3000000);
    const net = buys + sells > 0 ? ((buyVal - sellVal) / (buyVal + sellVal || 1)) * 100 : 0;
    const sentiment = net > 50 ? 'Strong Buy' : net > 15 ? 'Buy' : net > -15 ? 'Neutral' : net > -50 ? 'Sell' : 'Strong Sell';
    const names = ['CEO', 'CFO', 'COO', 'CTO', 'VP Sales', 'Board Director', 'EVP', 'General Counsel'];
    const topInsider = names[Math.floor(pseudo(s, 4) * names.length)];
    const topAction = pseudo(s, 5) > 0.4 ? 'Buy' : 'Sell';
    const topAmount = 50000 + pseudo(s, 6) * 5000000;
    const month = 1 + Math.floor(pseudo(s, 7) * 3);
    const day = 1 + Math.floor(pseudo(s, 8) * 28);
    const priceAtFiling = 50 + pseudo(s, 9) * 400;
    const priceSince = (pseudo(s, 10) - 0.4) * 20;
    const currentPrice = priceAtFiling * (1 + priceSince / 100);

    return {
      ticker: stock.ticker, name: stock.name,
      buys30d: buys, sells30d: sells,
      buyValue: +buyVal.toFixed(0), sellValue: +sellVal.toFixed(0),
      netSignal: +net.toFixed(0), sentiment,
      topInsider, topAction: topAction as 'Buy' | 'Sell',
      topAmount: +topAmount.toFixed(0),
      lastDate: `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      priceAtFiling: +priceAtFiling.toFixed(2),
      currentPrice: +currentPrice.toFixed(2),
      priceSince: +priceSince.toFixed(1),
    };
  });
}

const SIGNAL_COLORS: Record<string, string> = {
  'Strong Buy': 'bg-emerald-500/20 text-emerald-400',
  'Buy': 'bg-green-500/20 text-green-400',
  'Neutral': 'bg-slate-500/20 text-slate-400',
  'Sell': 'bg-orange-500/20 text-orange-400',
  'Strong Sell': 'bg-red-500/20 text-red-400',
};

export function InsiderSentimentPage() {
  const [filter, setFilter] = useState<'all' | 'bullish' | 'bearish'>('all');
  const [sortBy, setSortBy] = useState<'netSignal' | 'buyValue' | 'priceSince'>('netSignal');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const allSignals = useMemo(() => genSignals(), []);

  const filtered = useMemo(() => {
    let list = [...allSignals];
    if (filter === 'bullish') list = list.filter(s => s.netSignal > 0);
    if (filter === 'bearish') list = list.filter(s => s.netSignal < 0);
    list.sort((a, b) => sortDir === 'desc' ? b[sortBy] - a[sortBy] : a[sortBy] - b[sortBy]);
    return list;
  }, [allSignals, filter, sortBy, sortDir]);

  const totalBuyValue = allSignals.reduce((s, x) => s + x.buyValue, 0);
  const totalSellValue = allSignals.reduce((s, x) => s + x.sellValue, 0);
  const bullishStocks = allSignals.filter(s => s.netSignal > 15).length;
  const bearishStocks = allSignals.filter(s => s.netSignal < -15).length;
  const avgSignal = allSignals.reduce((s, x) => s + x.netSignal, 0) / allSignals.length;

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserCheck className="h-6 w-6 text-green-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Insider Sentiment</h1>
          <p className="text-sm text-slate-400">Aggregate insider buy/sell signals across major stocks</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
        {(['all', 'bullish', 'bearish'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('rounded-md px-4 py-1.5 text-xs font-medium capitalize', filter === f ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white')}>
            {f}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Total Buy Value', value: `$${(totalBuyValue / 1e6).toFixed(1)}M`, color: 'text-emerald-400' },
          { label: 'Total Sell Value', value: `$${(totalSellValue / 1e6).toFixed(1)}M`, color: 'text-red-400' },
          { label: 'Bullish Stocks', value: bullishStocks.toString(), color: 'text-emerald-400' },
          { label: 'Bearish Stocks', value: bearishStocks.toString(), color: 'text-red-400' },
          { label: 'Avg Signal', value: `${avgSignal >= 0 ? '+' : ''}${avgSignal.toFixed(0)}`, color: avgSignal >= 0 ? 'text-emerald-400' : 'text-red-400' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
            <div className={cn('mt-1 text-lg font-bold', c.color)}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Buy/Sell bar */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-2 text-sm font-semibold text-white">Aggregate Buy vs Sell Volume</h3>
        <div className="flex h-6 overflow-hidden rounded-full">
          <div className="bg-emerald-500/60" style={{ width: `${(totalBuyValue / (totalBuyValue + totalSellValue)) * 100}%` }} />
          <div className="bg-red-500/60" style={{ width: `${(totalSellValue / (totalBuyValue + totalSellValue)) * 100}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs">
          <span className="text-emerald-400">Buys: ${(totalBuyValue / 1e6).toFixed(1)}M</span>
          <span className="text-red-400">Sells: ${(totalSellValue / 1e6).toFixed(1)}M</span>
        </div>
      </div>

      {/* Signal gauge for top 5 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...allSignals].sort((a, b) => Math.abs(b.netSignal) - Math.abs(a.netSignal)).slice(0, 6).map(s => (
          <div key={s.ticker} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <Link to={`/company/${s.ticker}`} className="font-mono text-sm font-bold text-green-400 hover:underline">{s.ticker}</Link>
              <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', SIGNAL_COLORS[s.sentiment])}>
                {s.sentiment}
              </span>
            </div>
            <div className="relative h-3 rounded-full bg-slate-700 overflow-hidden">
              <div className="absolute inset-y-0 left-1/2 w-0.5 bg-slate-500 z-10" />
              {s.netSignal >= 0 ? (
                <div className="absolute inset-y-0 left-1/2 bg-emerald-500/60 rounded-r" style={{ width: `${(s.netSignal / 100) * 50}%` }} />
              ) : (
                <div className="absolute inset-y-0 bg-red-500/60 rounded-l" style={{ width: `${(Math.abs(s.netSignal) / 100) * 50}%`, right: '50%' }} />
              )}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-slate-500">
              <span>{s.buys30d} buys</span>
              <span className={cn('font-bold', s.netSignal >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                Signal: {s.netSignal >= 0 ? '+' : ''}{s.netSignal}
              </span>
              <span>{s.sells30d} sells</span>
            </div>
          </div>
        ))}
      </div>

      {/* Full table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Company</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Buys</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Sells</th>
              <th className="px-3 py-2 text-right">
                <button onClick={() => toggleSort('buyValue')} className={cn('text-xs font-medium', sortBy === 'buyValue' ? 'text-green-400' : 'text-slate-400')}>
                  Buy Value {sortBy === 'buyValue' && (sortDir === 'desc' ? '↓' : '↑')}
                </button>
              </th>
              <th className="px-3 py-2 text-right">
                <button onClick={() => toggleSort('netSignal')} className={cn('text-xs font-medium', sortBy === 'netSignal' ? 'text-green-400' : 'text-slate-400')}>
                  Signal {sortBy === 'netSignal' && (sortDir === 'desc' ? '↓' : '↑')}
                </button>
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Sentiment</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Top Insider</th>
              <th className="px-3 py-2 text-right">
                <button onClick={() => toggleSort('priceSince')} className={cn('text-xs font-medium', sortBy === 'priceSince' ? 'text-green-400' : 'text-slate-400')}>
                  Since Filing {sortBy === 'priceSince' && (sortDir === 'desc' ? '↓' : '↑')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.map(s => (
              <tr key={s.ticker} className="bg-slate-800 hover:bg-slate-750">
                <td className="px-3 py-2">
                  <Link to={`/company/${s.ticker}`} className="font-mono text-xs font-bold text-green-400 hover:underline">{s.ticker}</Link>
                </td>
                <td className="px-3 py-2 text-xs text-slate-300">{s.name}</td>
                <td className="px-3 py-2 text-right text-xs text-emerald-400">{s.buys30d}</td>
                <td className="px-3 py-2 text-right text-xs text-red-400">{s.sells30d}</td>
                <td className="px-3 py-2 text-right text-xs text-slate-300">${(s.buyValue / 1e6).toFixed(1)}M</td>
                <td className={cn('px-3 py-2 text-right text-xs font-bold', s.netSignal >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {s.netSignal >= 0 ? '+' : ''}{s.netSignal}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', SIGNAL_COLORS[s.sentiment])}>{s.sentiment}</span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-400">
                  {s.topInsider} <span className={cn('font-medium', s.topAction === 'Buy' ? 'text-emerald-400' : 'text-red-400')}>({s.topAction})</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={cn('flex items-center justify-end gap-0.5 text-xs font-medium', s.priceSince >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {s.priceSince >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {s.priceSince >= 0 ? '+' : ''}{s.priceSince}%
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
