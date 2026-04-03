import { useState, useMemo, Fragment } from 'react';
import {
  FolderSearch,
  Star,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  List,
  Filter,
} from 'lucide-react';
import { cn } from '../lib/utils';

/* ------------------------------------------------------------------ */
/*  Deterministic pseudo-random helpers                                */
/* ------------------------------------------------------------------ */
function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type FundType = 'Mutual Fund' | 'Hedge Fund' | 'Index Fund' | 'Money Market';
type Category = 'Equity' | 'Fixed Income' | 'Balanced' | 'Alternative' | 'Sector';

interface Holding {
  name: string;
  weight: number;
}

interface Fund {
  name: string;
  ticker: string;
  type: FundType;
  category: Category;
  aum: number;
  expenseRatio: number;
  ytd: number;
  y1: number;
  y3: number;
  y5: number;
  stars: number;
  holdings: Holding[];
  sectors: { name: string; pct: number }[];
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
}

type SortKey = 'aum' | 'ytd' | 'expenseRatio' | 'name';
type ExpenseFilter = 'all' | 'low' | 'medium';
type ViewMode = 'list' | 'grid';

/* ------------------------------------------------------------------ */
/*  Mock data generation                                               */
/* ------------------------------------------------------------------ */
const FUND_DEFS: { name: string; ticker: string; type: FundType; category: Category }[] = [
  { name: 'Vanguard Total Stock Market Index', ticker: 'VTSAX', type: 'Index Fund', category: 'Equity' },
  { name: 'Fidelity Contrafund', ticker: 'FCNTX', type: 'Mutual Fund', category: 'Equity' },
  { name: 'ARK Innovation ETF', ticker: 'ARKK', type: 'Mutual Fund', category: 'Sector' },
  { name: 'Bridgewater Pure Alpha', ticker: 'BWPAX', type: 'Hedge Fund', category: 'Alternative' },
  { name: 'Vanguard 500 Index Fund', ticker: 'VFIAX', type: 'Index Fund', category: 'Equity' },
  { name: 'PIMCO Total Return', ticker: 'PTTRX', type: 'Mutual Fund', category: 'Fixed Income' },
  { name: 'BlackRock Global Allocation', ticker: 'MDLOX', type: 'Mutual Fund', category: 'Balanced' },
  { name: 'Renaissance Medallion Fund', ticker: 'RENMD', type: 'Hedge Fund', category: 'Alternative' },
  { name: 'Schwab S&P 500 Index', ticker: 'SWPPX', type: 'Index Fund', category: 'Equity' },
  { name: 'JPMorgan Prime Money Market', ticker: 'JPMXX', type: 'Money Market', category: 'Fixed Income' },
  { name: 'T. Rowe Price Blue Chip Growth', ticker: 'TRBCX', type: 'Mutual Fund', category: 'Equity' },
  { name: 'Citadel Wellington Fund', ticker: 'CTWLF', type: 'Hedge Fund', category: 'Alternative' },
  { name: 'Vanguard Total Bond Market', ticker: 'VBTLX', type: 'Index Fund', category: 'Fixed Income' },
  { name: 'Fidelity Government Money Market', ticker: 'SPAXX', type: 'Money Market', category: 'Fixed Income' },
  { name: 'American Funds Growth Fund', ticker: 'AGTHX', type: 'Mutual Fund', category: 'Equity' },
  { name: 'Two Sigma Absolute Return', ticker: 'TSARF', type: 'Hedge Fund', category: 'Alternative' },
  { name: 'iShares Core S&P 500 ETF', ticker: 'IVV', type: 'Index Fund', category: 'Equity' },
  { name: 'Vanguard Health Care Fund', ticker: 'VGHCX', type: 'Mutual Fund', category: 'Sector' },
  { name: 'Goldman Sachs Financial Sq MM', ticker: 'FSMXX', type: 'Money Market', category: 'Fixed Income' },
  { name: 'Dodge & Cox Balanced Fund', ticker: 'DODBX', type: 'Mutual Fund', category: 'Balanced' },
  { name: 'Man AHL Alpha Fund', ticker: 'MAHLF', type: 'Hedge Fund', category: 'Alternative' },
  { name: 'Fidelity ZERO Total Market', ticker: 'FZROX', type: 'Index Fund', category: 'Equity' },
  { name: 'Capital Group New Perspective', ticker: 'ANWPX', type: 'Mutual Fund', category: 'Equity' },
  { name: 'Vanguard Federal Money Market', ticker: 'VMFXX', type: 'Money Market', category: 'Fixed Income' },
  { name: 'SPDR Dow Jones Industrial ETF', ticker: 'DIA', type: 'Index Fund', category: 'Equity' },
];

const HOLDING_NAMES = [
  'Apple Inc', 'Microsoft Corp', 'Amazon.com', 'Alphabet Inc', 'NVIDIA Corp',
  'Meta Platforms', 'Berkshire Hathaway', 'Tesla Inc', 'UnitedHealth Group', 'Johnson & Johnson',
  'JPMorgan Chase', 'Visa Inc', 'Procter & Gamble', 'Eli Lilly', 'Mastercard',
];

const SECTOR_NAMES = [
  'Technology', 'Healthcare', 'Financials', 'Consumer Discretionary',
  'Industrials', 'Energy', 'Utilities', 'Real Estate',
];

function generateFund(def: typeof FUND_DEFS[number]): Fund {
  const s = seed(def.ticker);

  const isMoneyMarket = def.type === 'Money Market';
  const isHedge = def.type === 'Hedge Fund';
  const isIndex = def.type === 'Index Fund';

  const aum = isMoneyMarket
    ? 10e9 + pseudo(s, 1) * 90e9
    : isHedge
      ? 5e9 + pseudo(s, 1) * 45e9
      : isIndex
        ? 50e9 + pseudo(s, 1) * 700e9
        : 5e9 + pseudo(s, 1) * 150e9;

  const expenseRatio = isMoneyMarket
    ? 0.05 + pseudo(s, 2) * 0.2
    : isIndex
      ? pseudo(s, 2) * 0.1
      : isHedge
        ? 1.0 + pseudo(s, 2) * 1.5
        : 0.2 + pseudo(s, 2) * 0.8;

  const ytd = isMoneyMarket
    ? 2 + pseudo(s, 3) * 3
    : -10 + pseudo(s, 3) * 40;

  const y1 = isMoneyMarket ? 3 + pseudo(s, 4) * 2 : -5 + pseudo(s, 4) * 35;
  const y3 = isMoneyMarket ? 2 + pseudo(s, 5) * 2 : 2 + pseudo(s, 5) * 18;
  const y5 = isMoneyMarket ? 1.5 + pseudo(s, 6) * 2 : 3 + pseudo(s, 6) * 15;

  const stars = Math.min(5, Math.max(1, Math.round(1 + pseudo(s, 7) * 4)));

  const holdings: Holding[] = [];
  let totalWeight = 0;
  for (let i = 0; i < 10; i++) {
    const w = +(2 + pseudo(s, 10 + i) * 8).toFixed(1);
    totalWeight += w;
    holdings.push({ name: HOLDING_NAMES[i % HOLDING_NAMES.length], weight: w });
  }
  holdings.forEach((h) => { h.weight = +((h.weight / totalWeight) * 100).toFixed(1); });

  const sectors: { name: string; pct: number }[] = [];
  let totalSec = 0;
  for (let i = 0; i < SECTOR_NAMES.length; i++) {
    const p = +(3 + pseudo(s, 20 + i) * 20).toFixed(1);
    totalSec += p;
    sectors.push({ name: SECTOR_NAMES[i], pct: p });
  }
  sectors.forEach((sec) => { sec.pct = +((sec.pct / totalSec) * 100).toFixed(1); });

  const sharpe = +(0.3 + pseudo(s, 30) * 2.2).toFixed(2);
  const sortino = +(0.4 + pseudo(s, 31) * 2.8).toFixed(2);
  const maxDrawdown = +(-5 - pseudo(s, 32) * 35).toFixed(1);

  return {
    ...def,
    aum,
    expenseRatio: +expenseRatio.toFixed(2),
    ytd: +ytd.toFixed(2),
    y1: +y1.toFixed(2),
    y3: +y3.toFixed(2),
    y5: +y5.toFixed(2),
    stars,
    holdings,
    sectors,
    sharpe,
    sortino,
    maxDrawdown,
  };
}

const ALL_FUNDS: Fund[] = FUND_DEFS.map(generateFund);

/* ------------------------------------------------------------------ */
/*  Formatting helpers                                                 */
/* ------------------------------------------------------------------ */
function fmtAum(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

/* ------------------------------------------------------------------ */
/*  Constants for filters                                              */
/* ------------------------------------------------------------------ */
const FUND_TYPE_TABS = ['All', 'Mutual Fund', 'Hedge Fund', 'Index Fund', 'Money Market'] as const;
const CATEGORIES: Category[] = ['Equity', 'Fixed Income', 'Balanced', 'Alternative', 'Sector'];
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'aum', label: 'AUM' },
  { value: 'ytd', label: 'YTD Return' },
  { value: 'expenseRatio', label: 'Expense Ratio' },
  { value: 'name', label: 'Name' },
];

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */
function StarRating({ count }: { count: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn('h-3.5 w-3.5', i < count ? 'fill-amber-400 text-amber-400' : 'text-slate-600')}
        />
      ))}
    </span>
  );
}

function TypeBadge({ type }: { type: FundType }) {
  const colors: Record<FundType, string> = {
    'Mutual Fund': 'bg-blue-900/50 text-blue-300',
    'Hedge Fund': 'bg-purple-900/50 text-purple-300',
    'Index Fund': 'bg-emerald-900/50 text-emerald-300',
    'Money Market': 'bg-slate-700 text-slate-300',
  };
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', colors[type])}>
      {type}
    </span>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function ExpandedDetails({ fund }: { fund: Fund }) {
  return (
    <tr>
      <td colSpan={11} className="border-b border-slate-700 bg-slate-800/60 px-6 py-4">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Top 10 holdings */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Top 10 Holdings
            </h4>
            <ul className="space-y-1 text-sm">
              {fund.holdings.map((h) => (
                <li key={h.name} className="flex justify-between text-slate-300">
                  <span className="truncate pr-2">{h.name}</span>
                  <span className="tabular-nums text-slate-400">{h.weight}%</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Sector allocation */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Sector Allocation
            </h4>
            <ul className="space-y-1.5 text-sm">
              {fund.sectors.map((s) => (
                <li key={s.name} className="text-slate-300">
                  <div className="mb-0.5 flex justify-between">
                    <span>{s.name}</span>
                    <span className="tabular-nums text-slate-400">{s.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-700">
                    <div
                      className="h-1.5 rounded-full bg-blue-500"
                      style={{ width: `${Math.min(s.pct, 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          {/* Risk metrics */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Risk Metrics
            </h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-400">Sharpe Ratio</dt>
                <dd className="font-medium text-white">{fund.sharpe}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Sortino Ratio</dt>
                <dd className="font-medium text-white">{fund.sortino}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Max Drawdown</dt>
                <dd className="font-medium text-red-400">{fund.maxDrawdown}%</dd>
              </div>
            </dl>
          </div>
        </div>
      </td>
    </tr>
  );
}

function GridCard({ fund, onClick, expanded }: { fund: Fund; onClick: () => void; expanded: boolean }) {
  return (
    <div
      className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 p-4 transition hover:border-slate-500"
      onClick={onClick}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-mono text-slate-400">{fund.ticker}</span>
        <TypeBadge type={fund.type} />
      </div>
      <h3 className="mb-2 truncate text-sm font-medium text-white" title={fund.name}>
        {fund.name}
      </h3>
      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
        <span>{fund.category}</span>
        <StarRating count={fund.stars} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-slate-500">AUM</p>
          <p className="font-medium text-white">{fmtAum(fund.aum)}</p>
        </div>
        <div>
          <p className="text-slate-500">Expense</p>
          <p className={cn('font-medium', fund.expenseRatio < 0.2 ? 'text-emerald-400' : fund.expenseRatio < 0.5 ? 'text-amber-400' : 'text-red-400')}>
            {fund.expenseRatio.toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-slate-500">YTD</p>
          <p className={cn('font-medium', fund.ytd >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {fmtPct(fund.ytd)}
          </p>
        </div>
        <div>
          <p className="text-slate-500">1Y</p>
          <p className={cn('font-medium', fund.y1 >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {fmtPct(fund.y1)}
          </p>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 border-t border-slate-700 pt-3">
          <div className="space-y-1 text-xs">
            <p className="text-slate-400">3Y: <span className="text-white">{fmtPct(fund.y3)}</span> | 5Y: <span className="text-white">{fmtPct(fund.y5)}</span></p>
            <p className="text-slate-400">Sharpe: <span className="text-white">{fund.sharpe}</span> | Sortino: <span className="text-white">{fund.sortino}</span></p>
            <p className="text-slate-400">Max DD: <span className="text-red-400">{fund.maxDrawdown}%</span></p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page component                                                */
/* ------------------------------------------------------------------ */
export function FundsPage() {
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [minAum, setMinAum] = useState('');
  const [maxAum, setMaxAum] = useState('');
  const [expenseFilter, setExpenseFilter] = useState<ExpenseFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('aum');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const filtered = useMemo(() => {
    let funds = ALL_FUNDS.slice();

    if (typeFilter !== 'All') {
      funds = funds.filter((f) => f.type === typeFilter);
    }
    if (categoryFilter !== 'All') {
      funds = funds.filter((f) => f.category === categoryFilter);
    }
    if (minAum) {
      const min = parseFloat(minAum) * 1e9;
      funds = funds.filter((f) => f.aum >= min);
    }
    if (maxAum) {
      const max = parseFloat(maxAum) * 1e9;
      funds = funds.filter((f) => f.aum <= max);
    }
    if (expenseFilter === 'low') {
      funds = funds.filter((f) => f.expenseRatio < 0.2);
    } else if (expenseFilter === 'medium') {
      funds = funds.filter((f) => f.expenseRatio < 0.5);
    }

    funds.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'aum') return b.aum - a.aum;
      if (sortBy === 'ytd') return b.ytd - a.ytd;
      return a.expenseRatio - b.expenseRatio;
    });

    return funds;
  }, [typeFilter, categoryFilter, minAum, maxAum, expenseFilter, sortBy]);

  const stats = useMemo(() => {
    const count = filtered.length;
    if (count === 0) return { count: 0, avgExpense: '0.00%', avgYtd: '0.00%', totalAum: '$0' };
    const avgExpense = filtered.reduce((s, f) => s + f.expenseRatio, 0) / count;
    const avgYtd = filtered.reduce((s, f) => s + f.ytd, 0) / count;
    const totalAum = filtered.reduce((s, f) => s + f.aum, 0);
    return {
      count,
      avgExpense: avgExpense.toFixed(2) + '%',
      avgYtd: fmtPct(avgYtd),
      totalAum: fmtAum(totalAum),
    };
  }, [filtered]);

  const toggleExpand = (ticker: string) => {
    setExpandedTicker((prev) => (prev === ticker ? null : ticker));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <FolderSearch className="h-5 w-5 text-slate-400" />
          <h1 className="text-2xl font-bold tracking-tight text-white">Fund Screener</h1>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Screen mutual funds, hedge funds, index funds, and money market funds by performance, expenses, and risk
        </p>
      </div>

      {/* Filter controls */}
      <div className="mb-6 space-y-3 rounded-lg border border-slate-700 bg-slate-800 p-4">
        {/* Fund type tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          {FUND_TYPE_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setTypeFilter(tab)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition',
                typeFilter === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
              )}
            >
              {tab === 'All' ? 'All Types' : tab + 's'}
            </button>
          ))}
        </div>

        {/* Second row: category, AUM range, expense, sort */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-400">
            Category
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="mt-1 block w-36 rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-400">
            Min AUM ($B)
            <input
              type="number"
              value={minAum}
              onChange={(e) => setMinAum(e.target.value)}
              placeholder="0"
              className="mt-1 block w-24 rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white placeholder-slate-500"
            />
          </label>

          <label className="text-xs text-slate-400">
            Max AUM ($B)
            <input
              type="number"
              value={maxAum}
              onChange={(e) => setMaxAum(e.target.value)}
              placeholder="Any"
              className="mt-1 block w-24 rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white placeholder-slate-500"
            />
          </label>

          <label className="text-xs text-slate-400">
            Expense Ratio
            <select
              value={expenseFilter}
              onChange={(e) => setExpenseFilter(e.target.value as ExpenseFilter)}
              className="mt-1 block w-32 rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white"
            >
              <option value="all">All</option>
              <option value="low">Low (&lt;0.2%)</option>
              <option value="medium">Medium (&lt;0.5%)</option>
            </select>
          </label>

          <label className="text-xs text-slate-400">
            Sort By
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="mt-1 block w-32 rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          {/* View toggle */}
          <div className="ml-auto flex gap-1">
            <button
              onClick={() => setViewMode('list')}
              className={cn('rounded p-1.5', viewMode === 'list' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white')}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn('rounded p-1.5', viewMode === 'grid' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white')}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Funds Matching" value={String(stats.count)} />
        <SummaryCard label="Avg Expense Ratio" value={stats.avgExpense} />
        <SummaryCard label="Avg YTD Return" value={stats.avgYtd} />
        <SummaryCard label="Total AUM" value={stats.totalAum} />
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800 px-6 py-12 text-center">
          <p className="text-sm text-slate-400">No funds match the current filters.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((fund) => (
            <GridCard
              key={fund.ticker}
              fund={fund}
              expanded={expandedTicker === fund.ticker}
              onClick={() => toggleExpand(fund.ticker)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800 text-xs uppercase tracking-wider text-slate-400">
                <th className="w-8 px-3 py-3" />
                <th className="px-3 py-3">Fund</th>
                <th className="px-3 py-3">Ticker</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3 text-right">AUM</th>
                <th className="px-3 py-3 text-right">Expense</th>
                <th className="px-3 py-3 text-right">YTD</th>
                <th className="px-3 py-3 text-right">1Y</th>
                <th className="px-3 py-3 text-right">3Y Ann.</th>
                <th className="px-3 py-3 text-right">5Y Ann.</th>
                <th className="px-3 py-3">Rating</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((fund) => {
                const isOpen = expandedTicker === fund.ticker;
                return (
                  <Fragment key={fund.ticker}>
                    <tr
                      className="cursor-pointer border-b border-slate-700/50 bg-slate-800/40 transition hover:bg-slate-700/40"
                      onClick={() => toggleExpand(fund.ticker)}
                    >
                      <td className="px-3 py-2.5 text-slate-500">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2.5 font-medium text-white" title={fund.name}>
                        {fund.name}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-300">{fund.ticker}</td>
                      <td className="px-3 py-2.5"><TypeBadge type={fund.type} /></td>
                      <td className="px-3 py-2.5 text-slate-300">{fund.category}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-white">{fmtAum(fund.aum)}</td>
                      <td className={cn('px-3 py-2.5 text-right tabular-nums', fund.expenseRatio < 0.2 ? 'text-emerald-400' : fund.expenseRatio < 0.5 ? 'text-amber-400' : 'text-red-400')}>
                        {fund.expenseRatio.toFixed(2)}%
                      </td>
                      <td className={cn('px-3 py-2.5 text-right tabular-nums', fund.ytd >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {fmtPct(fund.ytd)}
                      </td>
                      <td className={cn('px-3 py-2.5 text-right tabular-nums', fund.y1 >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {fmtPct(fund.y1)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{fmtPct(fund.y3)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{fmtPct(fund.y5)}</td>
                      <td className="px-3 py-2.5"><StarRating count={fund.stars} /></td>
                    </tr>
                    {isOpen && <ExpandedDetails fund={fund} />}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
