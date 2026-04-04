import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CircleDollarSign, Crown, CalendarDays } from 'lucide-react';
import { cn, formatPrice } from '../lib/utils';

type Frequency = 'quarterly' | 'monthly' | 'semi-annual' | 'annual';
type SortKey = 'yield' | 'streak' | 'exDate' | 'alpha';
type YieldRange = 'all' | '2' | '4' | '6';

interface Dividend {
  ticker: string;
  companyName: string;
  dividendPerShare: number;
  annualDividend: number;
  dividendYield: number;
  exDate: string;
  payDate: string;
  frequency: Frequency;
  payoutRatio: number;
  consecutiveYears: number;
  sector: string;
}

const MOCK_DIVIDENDS: Dividend[] = [
  { ticker: 'JNJ', companyName: 'Johnson & Johnson', dividendPerShare: 1.24, annualDividend: 4.96, dividendYield: 3.15, exDate: '2026-05-19', payDate: '2026-06-10', frequency: 'quarterly', payoutRatio: 44, consecutiveYears: 62, sector: 'Healthcare' },
  { ticker: 'PG', companyName: 'Procter & Gamble', dividendPerShare: 1.01, annualDividend: 4.03, dividendYield: 2.52, exDate: '2026-04-18', payDate: '2026-05-15', frequency: 'quarterly', payoutRatio: 62, consecutiveYears: 68, sector: 'Consumer Staples' },
  { ticker: 'KO', companyName: 'Coca-Cola', dividendPerShare: 0.49, annualDividend: 1.94, dividendYield: 3.08, exDate: '2026-06-12', payDate: '2026-07-01', frequency: 'quarterly', payoutRatio: 71, consecutiveYears: 62, sector: 'Consumer Staples' },
  { ticker: 'T', companyName: 'AT&T', dividendPerShare: 0.28, annualDividend: 1.11, dividendYield: 6.42, exDate: '2026-04-08', payDate: '2026-05-01', frequency: 'quarterly', payoutRatio: 54, consecutiveYears: 3, sector: 'Telecom' },
  { ticker: 'VZ', companyName: 'Verizon', dividendPerShare: 0.67, annualDividend: 2.66, dividendYield: 6.85, exDate: '2026-04-10', payDate: '2026-05-01', frequency: 'quarterly', payoutRatio: 57, consecutiveYears: 19, sector: 'Telecom' },
  { ticker: 'XOM', companyName: 'Exxon Mobil', dividendPerShare: 0.99, annualDividend: 3.96, dividendYield: 3.62, exDate: '2026-05-12', payDate: '2026-06-10', frequency: 'quarterly', payoutRatio: 39, consecutiveYears: 42, sector: 'Energy' },
  { ticker: 'ABBV', companyName: 'AbbVie', dividendPerShare: 1.64, annualDividend: 6.56, dividendYield: 3.78, exDate: '2026-04-14', payDate: '2026-05-15', frequency: 'quarterly', payoutRatio: 48, consecutiveYears: 52, sector: 'Healthcare' },
  { ticker: 'PEP', companyName: 'PepsiCo', dividendPerShare: 1.35, annualDividend: 5.42, dividendYield: 3.22, exDate: '2026-06-05', payDate: '2026-06-30', frequency: 'quarterly', payoutRatio: 68, consecutiveYears: 52, sector: 'Consumer Staples' },
  { ticker: 'MO', companyName: 'Altria Group', dividendPerShare: 1.02, annualDividend: 4.08, dividendYield: 8.14, exDate: '2026-06-14', payDate: '2026-07-10', frequency: 'quarterly', payoutRatio: 80, consecutiveYears: 54, sector: 'Consumer Staples' },
  { ticker: 'O', companyName: 'Realty Income', dividendPerShare: 0.26, annualDividend: 3.10, dividendYield: 5.52, exDate: '2026-04-30', payDate: '2026-05-15', frequency: 'monthly', payoutRatio: 75, consecutiveYears: 29, sector: 'Real Estate' },
  { ticker: 'MMM', companyName: '3M Company', dividendPerShare: 0.70, annualDividend: 2.80, dividendYield: 2.31, exDate: '2026-05-22', payDate: '2026-06-12', frequency: 'quarterly', payoutRatio: 41, consecutiveYears: 1, sector: 'Industrials' },
  { ticker: 'IBM', companyName: 'IBM', dividendPerShare: 1.67, annualDividend: 6.68, dividendYield: 3.14, exDate: '2026-05-08', payDate: '2026-06-10', frequency: 'quarterly', payoutRatio: 65, consecutiveYears: 28, sector: 'Technology' },
  { ticker: 'CVX', companyName: 'Chevron', dividendPerShare: 1.63, annualDividend: 6.52, dividendYield: 4.18, exDate: '2026-05-16', payDate: '2026-06-10', frequency: 'quarterly', payoutRatio: 52, consecutiveYears: 37, sector: 'Energy' },
  { ticker: 'STAG', companyName: 'STAG Industrial', dividendPerShare: 0.12, annualDividend: 1.47, dividendYield: 4.25, exDate: '2026-04-29', payDate: '2026-05-15', frequency: 'monthly', payoutRatio: 72, consecutiveYears: 13, sector: 'Real Estate' },
  { ticker: 'ED', companyName: 'Consolidated Edison', dividendPerShare: 0.83, annualDividend: 3.32, dividendYield: 3.48, exDate: '2026-05-14', payDate: '2026-06-01', frequency: 'quarterly', payoutRatio: 60, consecutiveYears: 50, sector: 'Utilities' },
  { ticker: 'CL', companyName: 'Colgate-Palmolive', dividendPerShare: 0.50, annualDividend: 2.00, dividendYield: 2.18, exDate: '2026-04-22', payDate: '2026-05-15', frequency: 'quarterly', payoutRatio: 55, consecutiveYears: 61, sector: 'Consumer Staples' },
  { ticker: 'BNS', companyName: 'Bank of Nova Scotia', dividendPerShare: 0.84, annualDividend: 3.36, dividendYield: 5.89, exDate: '2026-07-02', payDate: '2026-07-28', frequency: 'quarterly', payoutRatio: 64, consecutiveYears: 11, sector: 'Financials' },
  { ticker: 'MAIN', companyName: 'Main Street Capital', dividendPerShare: 0.24, annualDividend: 2.88, dividendYield: 5.95, exDate: '2026-04-28', payDate: '2026-05-15', frequency: 'monthly', payoutRatio: 82, consecutiveYears: 14, sector: 'Financials' },
  { ticker: 'EMR', companyName: 'Emerson Electric', dividendPerShare: 0.53, annualDividend: 2.10, dividendYield: 2.04, exDate: '2026-05-14', payDate: '2026-06-10', frequency: 'quarterly', payoutRatio: 38, consecutiveYears: 67, sector: 'Industrials' },
  { ticker: 'SYY', companyName: 'Sysco', dividendPerShare: 0.51, annualDividend: 2.04, dividendYield: 2.72, exDate: '2026-07-03', payDate: '2026-07-24', frequency: 'quarterly', payoutRatio: 50, consecutiveYears: 55, sector: 'Consumer Staples' },
];

const FREQ_OPTIONS: { label: string; value: Frequency | 'all' }[] = [
  { label: 'All', value: 'all' }, { label: 'Quarterly', value: 'quarterly' },
  { label: 'Monthly', value: 'monthly' }, { label: 'Semi-Annual', value: 'semi-annual' },
];

const YIELD_OPTIONS: { label: string; value: YieldRange }[] = [
  { label: 'All', value: 'all' }, { label: '>2%', value: '2' },
  { label: '>4%', value: '4' }, { label: '>6%', value: '6' },
];

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: 'Yield', value: 'yield' }, { label: 'Streak', value: 'streak' },
  { label: 'Ex-Date', value: 'exDate' }, { label: 'A-Z', value: 'alpha' },
];

const ALL_SECTORS = [...new Set(MOCK_DIVIDENDS.map((d) => d.sector))].sort();

export function DividendsPage() {
  const [sortBy, setSortBy] = useState<SortKey>('yield');
  const [freqFilter, setFreqFilter] = useState<Frequency | 'all'>('all');
  const [yieldRange, setYieldRange] = useState<YieldRange>('all');
  const [sectorFilter, setSectorFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    let items = MOCK_DIVIDENDS.slice();
    if (freqFilter !== 'all') items = items.filter((d) => d.frequency === freqFilter);
    if (yieldRange !== 'all') items = items.filter((d) => d.dividendYield > Number(yieldRange));
    if (sectorFilter !== 'all') items = items.filter((d) => d.sector === sectorFilter);
    items.sort((a, b) => {
      if (sortBy === 'yield') return b.dividendYield - a.dividendYield;
      if (sortBy === 'streak') return b.consecutiveYears - a.consecutiveYears;
      if (sortBy === 'exDate') return a.exDate.localeCompare(b.exDate);
      return a.ticker.localeCompare(b.ticker);
    });
    return items;
  }, [sortBy, freqFilter, yieldRange, sectorFilter]);

  const stats = useMemo(() => {
    const avgYield = MOCK_DIVIDENDS.reduce((s, d) => s + d.dividendYield, 0) / MOCK_DIVIDENDS.length;
    const highest = MOCK_DIVIDENDS.reduce((best, d) => (d.dividendYield > best.dividendYield ? d : best));
    const longestStreak = MOCK_DIVIDENDS.reduce((best, d) => (d.consecutiveYears > best.consecutiveYears ? d : best));
    const upcoming = MOCK_DIVIDENDS.filter((d) => d.exDate.startsWith('2026-04')).length;
    return { avgYield, highest, longestStreak, upcoming };
  }, []);

  const aristocrats = MOCK_DIVIDENDS.filter((d) => d.consecutiveYears >= 25).sort((a, b) => b.consecutiveYears - a.consecutiveYears);

  function yieldColor(y: number) {
    if (y > 5) return 'text-amber-500 dark:text-amber-400';
    if (y > 3) return 'text-emerald-600 dark:text-emerald-400';
    return 'text-slate-900 dark:text-white';
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="h-5 w-5 text-slate-400" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Dividend Tracker</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Yields, ex-dates, and payout data for dividend stocks</p>
      </div>

      {/* Stats cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Avg Yield', value: stats.avgYield.toFixed(2) + '%' },
          { label: 'Highest Yield', value: `${stats.highest.ticker} ${stats.highest.dividendYield.toFixed(2)}%` },
          { label: 'Longest Streak', value: `${stats.longestStreak.ticker} ${stats.longestStreak.consecutiveYears}yr` },
          { label: 'Ex-Dates This Month', value: String(stats.upcoming) },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-xs text-slate-500 dark:text-slate-400">{card.label}</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {SORT_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setSortBy(opt.value)} className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors',
              sortBy === opt.value ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
            )}>{opt.label}</button>
          ))}
        </div>
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {FREQ_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setFreqFilter(opt.value)} className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors',
              freqFilter === opt.value ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
            )}>{opt.label}</button>
          ))}
        </div>
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {YIELD_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setYieldRange(opt.value)} className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors',
              yieldRange === opt.value ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
            )}>{opt.label}</button>
          ))}
        </div>
        <select
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          <option value="all">All Sectors</option>
          {ALL_SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Dividend table */}
      <div className="mb-8 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Ticker</th>
              <th className="px-4 py-2.5 font-medium">Company</th>
              <th className="px-4 py-2.5 font-medium text-right">Div/Share</th>
              <th className="px-4 py-2.5 font-medium text-right">Annual</th>
              <th className="px-4 py-2.5 font-medium text-right">Yield</th>
              <th className="px-4 py-2.5 font-medium">Ex-Date</th>
              <th className="px-4 py-2.5 font-medium">Pay Date</th>
              <th className="px-4 py-2.5 font-medium">Freq</th>
              <th className="px-4 py-2.5 font-medium text-right">Payout</th>
              <th className="px-4 py-2.5 font-medium text-right">Streak</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {filtered.map((d) => (
              <tr key={d.ticker} className="bg-white dark:bg-slate-900/30">
                <td className="px-4 py-2.5 font-medium">
                  <Link to={`/company/${d.ticker}`} className="text-blue-600 hover:underline dark:text-blue-400">{d.ticker}</Link>
                </td>
                <td className="px-4 py-2.5 text-slate-900 dark:text-white">{d.companyName}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">{formatPrice(d.dividendPerShare)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-900 dark:text-white">{formatPrice(d.annualDividend)}</td>
                <td className={cn('px-4 py-2.5 text-right tabular-nums font-medium', yieldColor(d.dividendYield))}>{d.dividendYield.toFixed(2)}%</td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{d.exDate}</td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{d.payDate}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {d.frequency}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">{d.payoutRatio}%</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-900 dark:text-white">
                  <span className="inline-flex items-center gap-1">
                    {d.consecutiveYears >= 25 && <Crown className="h-3 w-3 text-amber-500" />}
                    {d.consecutiveYears}yr
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">No dividends match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Dividend Aristocrats & Kings */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
          <span className="inline-flex items-center gap-1.5"><Crown className="h-4 w-4 text-amber-500" /> Dividend Aristocrats & Kings</span>
        </h2>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Stocks with 25+ consecutive years of dividend increases. 50+ years earns King status.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {aristocrats.map((d) => (
            <Link key={d.ticker} to={`/company/${d.ticker}`} className="rounded-lg border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{d.ticker}</span>
                <span className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-bold',
                  d.consecutiveYears >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
                )}>{d.consecutiveYears >= 50 ? 'King' : 'Aristocrat'}</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{d.companyName}</p>
              <div className="mt-2 flex items-center gap-3 text-xs">
                <span className={cn('font-medium', yieldColor(d.dividendYield))}>{d.dividendYield.toFixed(2)}%</span>
                <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <CalendarDays className="h-3 w-3" />{d.consecutiveYears} years
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
