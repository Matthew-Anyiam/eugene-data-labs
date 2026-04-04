import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { UserCheck, Search, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn, formatCurrency, formatPrice } from '../lib/utils';

type TxType = 'buy' | 'sell';
type FilterType = 'all' | 'buy' | 'sell';
type TimeRange = '7d' | '30d' | '90d' | 'all';

interface MockTrade {
  ticker: string;
  insiderName: string;
  title: string;
  transactionType: TxType;
  shares: number;
  pricePerShare: number;
  totalValue: number;
  date: string;
  filingUrl: string;
}

const MOCK_INSIDER_TRADES: MockTrade[] = [
  { ticker: 'NVDA', insiderName: 'Jensen Huang', title: 'CEO', transactionType: 'sell', shares: 120000, pricePerShare: 142.5, totalValue: 17100000, date: '2026-03-31', filingUrl: '#' },
  { ticker: 'NVDA', insiderName: 'Colette Kress', title: 'CFO', transactionType: 'buy', shares: 5000, pricePerShare: 138.2, totalValue: 691000, date: '2026-03-30', filingUrl: '#' },
  { ticker: 'NVDA', insiderName: 'Mark Stevens', title: 'Director', transactionType: 'buy', shares: 8000, pricePerShare: 139.0, totalValue: 1112000, date: '2026-03-29', filingUrl: '#' },
  { ticker: 'AAPL', insiderName: 'Tim Cook', title: 'CEO', transactionType: 'sell', shares: 75000, pricePerShare: 228.4, totalValue: 17130000, date: '2026-03-28', filingUrl: '#' },
  { ticker: 'AAPL', insiderName: 'Luca Maestri', title: 'CFO', transactionType: 'sell', shares: 30000, pricePerShare: 227.1, totalValue: 6813000, date: '2026-03-27', filingUrl: '#' },
  { ticker: 'TSLA', insiderName: 'Zachary Kirkhorn', title: 'CFO', transactionType: 'buy', shares: 10000, pricePerShare: 175.3, totalValue: 1753000, date: '2026-03-26', filingUrl: '#' },
  { ticker: 'MSFT', insiderName: 'Satya Nadella', title: 'CEO', transactionType: 'sell', shares: 50000, pricePerShare: 432.8, totalValue: 21640000, date: '2026-03-25', filingUrl: '#' },
  { ticker: 'MSFT', insiderName: 'Amy Hood', title: 'CFO', transactionType: 'buy', shares: 3000, pricePerShare: 430.1, totalValue: 1290300, date: '2026-03-24', filingUrl: '#' },
  { ticker: 'AMZN', insiderName: 'Andy Jassy', title: 'CEO', transactionType: 'sell', shares: 40000, pricePerShare: 198.6, totalValue: 7944000, date: '2026-03-23', filingUrl: '#' },
  { ticker: 'AMZN', insiderName: 'Brian Olsavsky', title: 'SVP Finance', transactionType: 'buy', shares: 6000, pricePerShare: 196.2, totalValue: 1177200, date: '2026-03-22', filingUrl: '#' },
  { ticker: 'META', insiderName: 'Susan Li', title: 'CFO', transactionType: 'buy', shares: 4500, pricePerShare: 612.0, totalValue: 2754000, date: '2026-03-20', filingUrl: '#' },
  { ticker: 'GOOG', insiderName: 'Ruth Porat', title: 'CFO', transactionType: 'sell', shares: 20000, pricePerShare: 178.5, totalValue: 3570000, date: '2026-03-18', filingUrl: '#' },
  { ticker: 'JPM', insiderName: 'Jamie Dimon', title: 'CEO', transactionType: 'sell', shares: 33000, pricePerShare: 245.8, totalValue: 8111400, date: '2026-03-15', filingUrl: '#' },
  { ticker: 'JPM', insiderName: 'Mary Erdoes', title: 'Director', transactionType: 'buy', shares: 7500, pricePerShare: 243.2, totalValue: 1824000, date: '2026-03-14', filingUrl: '#' },
  { ticker: 'V', insiderName: 'Ryan McInerney', title: 'CEO', transactionType: 'buy', shares: 2000, pricePerShare: 318.4, totalValue: 636800, date: '2026-03-12', filingUrl: '#' },
  { ticker: 'UNH', insiderName: 'Andrew Witty', title: 'CEO', transactionType: 'sell', shares: 15000, pricePerShare: 542.3, totalValue: 8134500, date: '2026-03-10', filingUrl: '#' },
  { ticker: 'CRM', insiderName: 'Marc Benioff', title: 'CEO', transactionType: 'sell', shares: 25000, pricePerShare: 298.7, totalValue: 7467500, date: '2026-03-05', filingUrl: '#' },
  { ticker: 'CRM', insiderName: 'Parker Harris', title: 'Director', transactionType: 'buy', shares: 9000, pricePerShare: 295.1, totalValue: 2655900, date: '2026-03-04', filingUrl: '#' },
  { ticker: 'AVGO', insiderName: 'Hock Tan', title: 'CEO', transactionType: 'sell', shares: 18000, pricePerShare: 186.4, totalValue: 3355200, date: '2026-02-28', filingUrl: '#' },
  { ticker: 'LLY', insiderName: 'David Ricks', title: 'CEO', transactionType: 'buy', shares: 4000, pricePerShare: 812.5, totalValue: 3250000, date: '2026-02-25', filingUrl: '#' },
];

const NOTABLE_SIGNALS = [
  { title: '3 NVDA insiders active this week', description: 'CFO and Director bought while CEO sold — mixed signal on NVDA.', type: 'mixed' as const },
  { title: 'MSFT CEO large disposal', description: 'Satya Nadella sold $21.6M in shares, largest single transaction this month.', type: 'bearish' as const },
  { title: 'Cluster buy at CRM', description: 'Director Parker Harris bought 9,000 shares days before earnings.', type: 'bullish' as const },
];

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export function InsidersPage() {
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  const filtered = useMemo(() => {
    let trades = MOCK_INSIDER_TRADES;
    if (filterType !== 'all') trades = trades.filter((t) => t.transactionType === filterType);
    if (search) {
      const q = search.toUpperCase();
      trades = trades.filter((t) => t.ticker.includes(q) || t.insiderName.toUpperCase().includes(q));
    }
    if (timeRange !== 'all') {
      const maxDays = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      trades = trades.filter((t) => daysAgo(t.date) <= maxDays);
    }
    return trades;
  }, [filterType, search, timeRange]);

  const stats = useMemo(() => {
    const buys = filtered.filter((t) => t.transactionType === 'buy');
    const sells = filtered.filter((t) => t.transactionType === 'sell');
    const netShares = buys.reduce((s, t) => s + t.shares, 0) - sells.reduce((s, t) => s + t.shares, 0);
    const largestBuy = buys.length ? Math.max(...buys.map((t) => t.totalValue)) : 0;
    const largestSell = sells.length ? Math.max(...sells.map((t) => t.totalValue)) : 0;
    return { total: filtered.length, netShares, largestBuy, largestSell };
  }, [filtered]);

  const timeButtons: { label: string; value: TimeRange }[] = [
    { label: '7D', value: '7d' }, { label: '30D', value: '30d' },
    { label: '90D', value: '90d' }, { label: 'All', value: 'all' },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-slate-400" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Insider Trading
          </h1>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          SEC Form 4 filings — insider buy and sell activity
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {(['all', 'buy', 'sell'] as FilterType[]).map((ft) => (
            <button
              key={ft}
              onClick={() => setFilterType(ft)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                filterType === ft
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
              )}
            >
              {ft === 'all' ? 'All' : ft === 'buy' ? 'Buys Only' : 'Sells Only'}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search ticker or name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {timeButtons.map((tb) => (
            <button
              key={tb.value}
              onClick={() => setTimeRange(tb.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                timeRange === tb.value
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
              )}
            >
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Transactions', value: String(stats.total) },
          { label: 'Net shares', value: stats.netShares >= 0 ? `+${stats.netShares.toLocaleString()}` : stats.netShares.toLocaleString() },
          { label: 'Largest buy', value: formatCurrency(stats.largestBuy) },
          { label: 'Largest sell', value: formatCurrency(stats.largestSell) },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-xs text-slate-500 dark:text-slate-400">{card.label}</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Trades table */}
      <div className="mb-8 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Ticker</th>
              <th className="px-4 py-2.5 font-medium">Insider</th>
              <th className="px-4 py-2.5 font-medium">Title</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium text-right">Shares</th>
              <th className="px-4 py-2.5 font-medium text-right">Price</th>
              <th className="px-4 py-2.5 font-medium text-right">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {filtered.map((t, i) => (
              <tr
                key={`${t.ticker}-${t.insiderName}-${i}`}
                className={cn(
                  'bg-white dark:bg-slate-900/30',
                  t.transactionType === 'buy' ? 'border-l-2 border-l-emerald-500' : 'border-l-2 border-l-red-500',
                )}
              >
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{t.date}</td>
                <td className="px-4 py-2.5 font-medium">
                  <Link to={`/company/${t.ticker}`} className="text-blue-600 hover:underline dark:text-blue-400">
                    {t.ticker}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-900 dark:text-white">{t.insiderName}</td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{t.title}</td>
                <td className="px-4 py-2.5">
                  <span className={cn(
                    'inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                    t.transactionType === 'buy'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
                  )}>
                    {t.transactionType}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-900 dark:text-white">
                  {t.shares.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">
                  {formatPrice(t.pricePerShare)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-900 dark:text-white">
                  {formatCurrency(t.totalValue)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No trades match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Notable signals */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Notable Signals</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {NOTABLE_SIGNALS.map((sig) => (
            <div
              key={sig.title}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50"
            >
              <div className="mb-1 flex items-center gap-1.5">
                {sig.type === 'bullish' && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
                {sig.type === 'bearish' && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                {sig.type === 'mixed' && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                <p className="text-xs font-semibold text-slate-900 dark:text-white">{sig.title}</p>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                {sig.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
