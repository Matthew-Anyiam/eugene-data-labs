import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { cn, formatCurrency, formatPercent } from '../lib/utils';

type Category = 'equity' | 'bond' | 'commodity' | 'sector' | 'international' | 'crypto';
type SortKey = 'aum' | 'expenseRatio' | 'ytdReturn' | 'oneYearReturn' | 'dividendYield';

interface ETF {
  ticker: string;
  name: string;
  category: Category;
  aum: number;
  expenseRatio: number;
  ytdReturn: number;
  oneYearReturn: number;
  threeYearReturn: number;
  dividendYield: number;
  holdings: number;
  topHoldings: string[];
  description: string;
}

const MOCK_ETFS: ETF[] = [
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', category: 'equity', aum: 562e9, expenseRatio: 0.0945, ytdReturn: 8.42, oneYearReturn: 24.31, threeYearReturn: 10.15, dividendYield: 1.22, holdings: 503, topHoldings: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META'], description: 'Tracks the S&P 500 index, one of the most widely followed benchmarks for U.S. large-cap equities.' },
  { ticker: 'QQQ', name: 'Invesco QQQ Trust', category: 'equity', aum: 312e9, expenseRatio: 0.20, ytdReturn: 10.87, oneYearReturn: 31.56, threeYearReturn: 11.42, dividendYield: 0.55, holdings: 101, topHoldings: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'AVGO'], description: 'Tracks the Nasdaq-100 Index, focusing on the largest non-financial companies listed on Nasdaq.' },
  { ticker: 'IWM', name: 'iShares Russell 2000 ETF', category: 'equity', aum: 72e9, expenseRatio: 0.19, ytdReturn: 2.14, oneYearReturn: 12.87, threeYearReturn: 3.21, dividendYield: 1.31, holdings: 1972, topHoldings: ['SMCI', 'MSTR', 'SPR'], description: 'Tracks the Russell 2000 Index, measuring U.S. small-cap stock performance.' },
  { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', category: 'equity', aum: 428e9, expenseRatio: 0.03, ytdReturn: 7.95, oneYearReturn: 23.14, threeYearReturn: 9.87, dividendYield: 1.32, holdings: 3637, topHoldings: ['AAPL', 'MSFT', 'NVDA', 'AMZN'], description: 'Provides broad exposure to the entire U.S. equity market including small, mid, and large-cap stocks.' },
  { ticker: 'VOO', name: 'Vanguard S&P 500 ETF', category: 'equity', aum: 510e9, expenseRatio: 0.03, ytdReturn: 8.38, oneYearReturn: 24.25, threeYearReturn: 10.12, dividendYield: 1.24, holdings: 503, topHoldings: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META'], description: 'Tracks the S&P 500 index with one of the lowest expense ratios available.' },
  { ticker: 'ARKK', name: 'ARK Innovation ETF', category: 'equity', aum: 6.8e9, expenseRatio: 0.75, ytdReturn: -5.23, oneYearReturn: 8.45, threeYearReturn: -14.32, dividendYield: 0, holdings: 35, topHoldings: ['TSLA', 'COIN', 'ROKU', 'SQ'], description: 'Actively managed ETF focused on disruptive innovation across genomics, AI, fintech, and autonomous tech.' },
  { ticker: 'XLF', name: 'Financial Select Sector SPDR', category: 'sector', aum: 41e9, expenseRatio: 0.09, ytdReturn: 6.72, oneYearReturn: 19.84, threeYearReturn: 8.43, dividendYield: 1.55, holdings: 72, topHoldings: ['BRK.B', 'JPM', 'V', 'MA'], description: 'Tracks the financial sector of the S&P 500 including banks, insurance, and capital markets.' },
  { ticker: 'XLE', name: 'Energy Select Sector SPDR', category: 'sector', aum: 36e9, expenseRatio: 0.09, ytdReturn: -2.45, oneYearReturn: 5.67, threeYearReturn: 18.91, dividendYield: 3.42, holdings: 23, topHoldings: ['XOM', 'CVX', 'EOG', 'SLB'], description: 'Tracks the energy sector of the S&P 500 including oil, gas, and energy equipment companies.' },
  { ticker: 'XLK', name: 'Technology Select Sector SPDR', category: 'sector', aum: 71e9, expenseRatio: 0.09, ytdReturn: 11.34, oneYearReturn: 32.15, threeYearReturn: 12.76, dividendYield: 0.62, holdings: 68, topHoldings: ['AAPL', 'MSFT', 'NVDA', 'AVGO'], description: 'Tracks the technology sector of the S&P 500 including software, hardware, and semiconductors.' },
  { ticker: 'GLD', name: 'SPDR Gold Shares', category: 'commodity', aum: 68e9, expenseRatio: 0.40, ytdReturn: 12.65, oneYearReturn: 18.42, threeYearReturn: 9.87, dividendYield: 0, holdings: 1, topHoldings: ['Gold Bullion'], description: 'Tracks the price of gold bullion, providing exposure to the gold market without physical ownership.' },
  { ticker: 'SLV', name: 'iShares Silver Trust', category: 'commodity', aum: 12e9, expenseRatio: 0.50, ytdReturn: 5.31, oneYearReturn: 22.14, threeYearReturn: 4.56, dividendYield: 0, holdings: 1, topHoldings: ['Silver Bullion'], description: 'Tracks the price of silver bullion, offering direct exposure to the silver commodity market.' },
  { ticker: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF', category: 'bond', aum: 52e9, expenseRatio: 0.15, ytdReturn: -3.21, oneYearReturn: -7.45, threeYearReturn: -12.34, dividendYield: 4.12, holdings: 41, topHoldings: ['US Treasury 2044', 'US Treasury 2053', 'US Treasury 2043'], description: 'Tracks long-term U.S. Treasury bonds with maturities of 20+ years.' },
  { ticker: 'BND', name: 'Vanguard Total Bond Market ETF', category: 'bond', aum: 110e9, expenseRatio: 0.03, ytdReturn: 0.87, oneYearReturn: 2.34, threeYearReturn: -1.56, dividendYield: 3.45, holdings: 11043, topHoldings: ['US Treasury', 'MBS', 'Corporate Bonds'], description: 'Broad exposure to the U.S. investment-grade bond market including government and corporate bonds.' },
  { ticker: 'VWO', name: 'Vanguard FTSE Emerging Markets ETF', category: 'international', aum: 82e9, expenseRatio: 0.08, ytdReturn: 4.56, oneYearReturn: 11.23, threeYearReturn: -0.87, dividendYield: 2.98, holdings: 5690, topHoldings: ['TSM', 'TCEHY', 'BABA', 'RELIANCE'], description: 'Tracks the FTSE Emerging Markets Index, providing broad emerging market equity exposure.' },
  { ticker: 'EEM', name: 'iShares MSCI Emerging Markets ETF', category: 'international', aum: 18e9, expenseRatio: 0.68, ytdReturn: 4.12, oneYearReturn: 10.56, threeYearReturn: -1.43, dividendYield: 2.45, holdings: 1250, topHoldings: ['TSM', 'TCEHY', 'SAMSUNG'], description: 'Tracks the MSCI Emerging Markets Index with broad exposure to developing economies.' },
  { ticker: 'IBIT', name: 'iShares Bitcoin Trust ETF', category: 'crypto', aum: 54e9, expenseRatio: 0.25, ytdReturn: 15.67, oneYearReturn: 112.34, threeYearReturn: 0, dividendYield: 0, holdings: 1, topHoldings: ['Bitcoin'], description: 'Spot Bitcoin ETF providing direct exposure to Bitcoin through a regulated exchange-traded product.' },
  { ticker: 'VNQ', name: 'Vanguard Real Estate ETF', category: 'sector', aum: 34e9, expenseRatio: 0.12, ytdReturn: 1.23, oneYearReturn: 8.91, threeYearReturn: -2.14, dividendYield: 3.87, holdings: 160, topHoldings: ['PLD', 'AMT', 'EQIX', 'SPG'], description: 'Tracks the MSCI US Investable Market Real Estate 25/50 Index for REIT exposure.' },
  { ticker: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF', category: 'equity', aum: 36e9, expenseRatio: 0.16, ytdReturn: 5.67, oneYearReturn: 18.23, threeYearReturn: 8.54, dividendYield: 1.67, holdings: 30, topHoldings: ['UNH', 'GS', 'MSFT', 'HD', 'CAT'], description: 'Tracks the Dow Jones Industrial Average, a price-weighted index of 30 prominent U.S. companies.' },
  { ticker: 'SCHD', name: 'Schwab U.S. Dividend Equity ETF', category: 'equity', aum: 63e9, expenseRatio: 0.06, ytdReturn: 4.89, oneYearReturn: 14.56, threeYearReturn: 7.23, dividendYield: 3.45, holdings: 104, topHoldings: ['ABBV', 'HD', 'CSCO', 'BLK'], description: 'Tracks the Dow Jones U.S. Dividend 100 Index, focusing on quality dividend-paying stocks.' },
  { ticker: 'VIG', name: 'Vanguard Dividend Appreciation ETF', category: 'equity', aum: 87e9, expenseRatio: 0.06, ytdReturn: 6.12, oneYearReturn: 17.89, threeYearReturn: 8.76, dividendYield: 1.78, holdings: 338, topHoldings: ['AAPL', 'MSFT', 'JPM', 'UNH'], description: 'Tracks companies with a history of increasing dividends over time.' },
];

const CATEGORIES: { label: string; value: Category | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Equity', value: 'equity' },
  { label: 'Bond', value: 'bond' },
  { label: 'Commodity', value: 'commodity' },
  { label: 'Sector', value: 'sector' },
  { label: 'International', value: 'international' },
  { label: 'Crypto', value: 'crypto' },
];

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: 'AUM', value: 'aum' },
  { label: 'Expense Ratio', value: 'expenseRatio' },
  { label: 'YTD Return', value: 'ytdReturn' },
  { label: '1Y Return', value: 'oneYearReturn' },
  { label: 'Dividend Yield', value: 'dividendYield' },
];

const categoryColors: Record<Category, string> = {
  equity: 'bg-blue-500/20 text-blue-400',
  bond: 'bg-amber-500/20 text-amber-400',
  commodity: 'bg-yellow-500/20 text-yellow-400',
  sector: 'bg-purple-500/20 text-purple-400',
  international: 'bg-emerald-500/20 text-emerald-400',
  crypto: 'bg-orange-500/20 text-orange-400',
};

function ReturnCell({ value }: { value: number }) {
  return (
    <td className={cn('px-3 py-3 text-sm tabular-nums', value >= 0 ? 'text-green-400' : 'text-red-400')}>
      {formatPercent(value)}
    </td>
  );
}

export function ETFPage() {
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('aum');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = MOCK_ETFS;
    if (category !== 'all') list = list.filter((e) => e.category === category);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.ticker.toLowerCase().includes(q) || e.name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (sortKey === 'expenseRatio') return a[sortKey] - b[sortKey];
      return b[sortKey] - a[sortKey];
    });
  }, [category, sortKey, search]);

  const stats = useMemo(() => {
    const avgExpense = filtered.reduce((s, e) => s + e.expenseRatio, 0) / (filtered.length || 1);
    const bestYtd = filtered.reduce((best, e) => (e.ytdReturn > best.ytdReturn ? e : best), filtered[0]);
    const totalAum = filtered.reduce((s, e) => s + e.aum, 0);
    return { count: filtered.length, avgExpense, bestYtd, totalAum };
  }, [filtered]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-slate-400" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ETF Explorer</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Browse and compare popular exchange-traded funds</p>
      </div>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'ETFs Shown', value: String(stats.count) },
          { label: 'Avg Expense Ratio', value: `${(stats.avgExpense).toFixed(2)}%` },
          { label: 'Highest YTD', value: stats.bestYtd ? `${stats.bestYtd.ticker} ${formatPercent(stats.bestYtd.ytdReturn)}` : '—' },
          { label: 'Total AUM', value: formatCurrency(stats.totalAum) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className="mt-1 text-sm font-semibold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                category === c.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>Sort: {o.label}</option>
          ))}
        </select>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search ticker or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-52 rounded-md border border-slate-700 bg-slate-800 py-1.5 pl-8 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/80 text-xs text-slate-400">
              <th className="w-8 px-3 py-2" />
              <th className="px-3 py-2">Ticker</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2 text-right">AUM</th>
              <th className="px-3 py-2 text-right">Expense</th>
              <th className="px-3 py-2 text-right">YTD</th>
              <th className="px-3 py-2 text-right">1Y</th>
              <th className="px-3 py-2 text-right">3Y</th>
              <th className="px-3 py-2 text-right">Yield</th>
              <th className="px-3 py-2 text-right">Holdings</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((etf) => (
              <ETFRow
                key={etf.ticker}
                etf={etf}
                isExpanded={expanded === etf.ticker}
                onToggle={() => setExpanded(expanded === etf.ticker ? null : etf.ticker)}
              />
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-sm text-slate-500">No ETFs match your filters</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ETFRow({ etf, isExpanded, onToggle }: { etf: ETF; isExpanded: boolean; onToggle: () => void }) {
  const Icon = isExpanded ? ChevronDown : ChevronRight;
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-slate-700/50 transition-colors hover:bg-slate-800/60"
      >
        <td className="px-3 py-3"><Icon className="h-3.5 w-3.5 text-slate-500" /></td>
        <td className="px-3 py-3 font-mono font-bold text-white">{etf.ticker}</td>
        <td className="px-3 py-3 text-sm text-slate-300">{etf.name}</td>
        <td className="px-3 py-3">
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', categoryColors[etf.category])}>
            {etf.category}
          </span>
        </td>
        <td className="px-3 py-3 text-right text-sm tabular-nums text-slate-300">{formatCurrency(etf.aum)}</td>
        <td className="px-3 py-3 text-right text-sm tabular-nums text-slate-300">
          {etf.expenseRatio.toFixed(2)}%
          {etf.expenseRatio < 0.10 && (
            <span className="ml-1.5 rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] font-medium text-green-400">Low Cost</span>
          )}
        </td>
        <ReturnCell value={etf.ytdReturn} />
        <ReturnCell value={etf.oneYearReturn} />
        <ReturnCell value={etf.threeYearReturn} />
        <td className="px-3 py-3 text-right text-sm tabular-nums text-slate-300">
          {etf.dividendYield > 0 ? `${etf.dividendYield.toFixed(2)}%` : '—'}
        </td>
        <td className="px-3 py-3 text-right text-sm tabular-nums text-slate-300">{etf.holdings.toLocaleString()}</td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-slate-700/50 bg-slate-800/40">
          <td colSpan={11} className="px-6 py-4">
            <p className="mb-3 text-sm text-slate-400">{etf.description}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Top Holdings:</span>
              {etf.topHoldings.map((h) => (
                <Link
                  key={h}
                  to={`/company/${h}`}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded bg-slate-700 px-2 py-0.5 text-xs font-mono text-blue-400 transition-colors hover:bg-slate-600 hover:text-blue-300"
                >
                  {h}
                </Link>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
