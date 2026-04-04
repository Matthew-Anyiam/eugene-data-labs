import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Rocket, LayoutGrid, List } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';

type Status = 'upcoming' | 'priced' | 'withdrawn';
type Exchange = 'NYSE' | 'NASDAQ';
type FilterTab = 'all' | 'upcoming' | 'priced' | 'withdrawn';
type ViewMode = 'grid' | 'list';

interface IPOEntry {
  ticker: string;
  companyName: string;
  sector: string;
  expectedDate: string;
  priceRange: string;
  sharesOffered: number;
  valuation: number;
  exchange: Exchange;
  status: Status;
  pricedAt: number | null;
  firstDayClose: number | null;
  returnPct: number | null;
}

function d(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

const MOCK_IPOS: IPOEntry[] = [
  { ticker: 'STRP', companyName: 'Stripe Inc.', sector: 'Fintech', expectedDate: d(5), priceRange: '$55-$62', sharesOffered: 60e6, valuation: 74e9, exchange: 'NYSE', status: 'upcoming', pricedAt: null, firstDayClose: null, returnPct: null },
  { ticker: 'DBRX', companyName: 'Databricks Inc.', sector: 'Enterprise Software', expectedDate: d(8), priceRange: '$42-$48', sharesOffered: 45e6, valuation: 52e9, exchange: 'NASDAQ', status: 'upcoming', pricedAt: null, firstDayClose: null, returnPct: null },
  { ticker: 'CNVA', companyName: 'Canva Pty Ltd.', sector: 'SaaS', expectedDate: d(12), priceRange: '$28-$33', sharesOffered: 55e6, valuation: 38e9, exchange: 'NASDAQ', status: 'upcoming', pricedAt: null, firstDayClose: null, returnPct: null },
  { ticker: 'KLRN', companyName: 'Klarna Group', sector: 'Fintech', expectedDate: d(15), priceRange: '$18-$21', sharesOffered: 80e6, valuation: 14.5e9, exchange: 'NYSE', status: 'upcoming', pricedAt: null, firstDayClose: null, returnPct: null },
  { ticker: 'MDLN', companyName: 'Medline Industries', sector: 'Healthcare', expectedDate: d(20), priceRange: '$22-$26', sharesOffered: 70e6, valuation: 42e9, exchange: 'NYSE', status: 'upcoming', pricedAt: null, firstDayClose: null, returnPct: null },
  { ticker: 'SHNO', companyName: 'Shein Group', sector: 'E-Commerce', expectedDate: d(25), priceRange: '$44-$50', sharesOffered: 100e6, valuation: 60e9, exchange: 'NYSE', status: 'upcoming', pricedAt: null, firstDayClose: null, returnPct: null },
  { ticker: 'CBDX', companyName: 'CoreBridge DX', sector: 'Biotech', expectedDate: d(3), priceRange: '$14-$17', sharesOffered: 25e6, valuation: 3.2e9, exchange: 'NASDAQ', status: 'upcoming', pricedAt: null, firstDayClose: null, returnPct: null },
  { ticker: 'VNDR', companyName: 'Vendora AI', sector: 'AI / ML', expectedDate: d(10), priceRange: '$30-$35', sharesOffered: 35e6, valuation: 8.5e9, exchange: 'NASDAQ', status: 'upcoming', pricedAt: null, firstDayClose: null, returnPct: null },
  { ticker: 'SRVR', companyName: 'ServerCore Inc.', sector: 'Cloud Infra', expectedDate: d(-3), priceRange: '$38-$42', sharesOffered: 40e6, valuation: 18e9, exchange: 'NASDAQ', status: 'priced', pricedAt: 41.0, firstDayClose: 52.3, returnPct: 27.56 },
  { ticker: 'NXGN', companyName: 'NexGen Robotics', sector: 'Industrials', expectedDate: d(-7), priceRange: '$20-$24', sharesOffered: 50e6, valuation: 6.8e9, exchange: 'NYSE', status: 'priced', pricedAt: 23.0, firstDayClose: 28.75, returnPct: 25.0 },
  { ticker: 'PXLR', companyName: 'Pixelar Studios', sector: 'Entertainment', expectedDate: d(-10), priceRange: '$16-$19', sharesOffered: 30e6, valuation: 4.1e9, exchange: 'NASDAQ', status: 'priced', pricedAt: 18.5, firstDayClose: 21.1, returnPct: 14.05 },
  { ticker: 'ARCS', companyName: 'ArcStone Materials', sector: 'Materials', expectedDate: d(-14), priceRange: '$12-$15', sharesOffered: 35e6, valuation: 2.9e9, exchange: 'NYSE', status: 'priced', pricedAt: 14.0, firstDayClose: 12.6, returnPct: -10.0 },
  { ticker: 'QNTM', companyName: 'Quantum Ledger', sector: 'Fintech', expectedDate: d(-5), priceRange: '$24-$28', sharesOffered: 42e6, valuation: 9.2e9, exchange: 'NASDAQ', status: 'priced', pricedAt: 26.0, firstDayClose: 33.8, returnPct: 30.0 },
  { ticker: 'HLXB', companyName: 'HelixBio Therapeutics', sector: 'Biotech', expectedDate: d(-18), priceRange: '$10-$13', sharesOffered: 28e6, valuation: 1.8e9, exchange: 'NASDAQ', status: 'priced', pricedAt: 11.5, firstDayClose: 13.2, returnPct: 14.78 },
  { ticker: 'GRNV', companyName: 'GreenVolt Energy', sector: 'Clean Energy', expectedDate: d(-12), priceRange: '$19-$22', sharesOffered: 48e6, valuation: 5.6e9, exchange: 'NYSE', status: 'priced', pricedAt: 21.0, firstDayClose: 19.4, returnPct: -7.62 },
  { ticker: 'OLVR', companyName: 'Olivera Health', sector: 'Healthcare', expectedDate: d(-20), priceRange: '$26-$30', sharesOffered: 38e6, valuation: 7.4e9, exchange: 'NYSE', status: 'withdrawn', pricedAt: null, firstDayClose: null, returnPct: null },
  { ticker: 'ZYNC', companyName: 'ZyncPay Inc.', sector: 'Fintech', expectedDate: d(-9), priceRange: '$15-$18', sharesOffered: 22e6, valuation: 2.1e9, exchange: 'NASDAQ', status: 'withdrawn', pricedAt: null, firstDayClose: null, returnPct: null },
  { ticker: 'FLDX', companyName: 'FluidX Dynamics', sector: 'Industrials', expectedDate: d(18), priceRange: '$32-$37', sharesOffered: 30e6, valuation: 6.0e9, exchange: 'NYSE', status: 'upcoming', pricedAt: null, firstDayClose: null, returnPct: null },
];

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'priced', label: 'Priced' },
  { key: 'withdrawn', label: 'Withdrawn' },
];

const STATUS_DOT: Record<Status, string> = {
  upcoming: 'bg-blue-500',
  priced: 'bg-emerald-500',
  withdrawn: 'bg-red-500',
};

function formatDateShort(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function IPOPage() {
  const [tab, setTab] = useState<FilterTab>('all');
  const [view, setView] = useState<ViewMode>('grid');

  const filtered = useMemo(() => {
    const entries = tab === 'all' ? MOCK_IPOS : MOCK_IPOS.filter((e) => e.status === tab);
    return [...entries].sort((a, b) => b.expectedDate.localeCompare(a.expectedDate));
  }, [tab]);

  const upcoming = MOCK_IPOS.filter((e) => e.status === 'upcoming');
  const priced = MOCK_IPOS.filter((e) => e.status === 'priced');
  const now = new Date();
  const thisMonth = MOCK_IPOS.filter((e) => {
    const dt = new Date(e.expectedDate + 'T12:00:00');
    return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
  });
  const avgValuation = MOCK_IPOS.reduce((s, e) => s + e.valuation, 0) / MOCK_IPOS.length;
  const bestReturn = priced.reduce((best, e) => (e.returnPct !== null && e.returnPct > best ? e.returnPct : best), -Infinity);

  const stats = [
    { label: 'Upcoming IPOs', value: String(upcoming.length) },
    { label: 'Avg Valuation', value: formatCurrency(avgValuation) },
    { label: 'Best First-Day Return', value: bestReturn > -Infinity ? `+${bestReturn.toFixed(1)}%` : '--' },
    { label: 'This Month', value: String(thisMonth.length) },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            <Rocket className="h-6 w-6 text-violet-500" />
            IPO Calendar
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Upcoming and recent initial public offerings</p>
        </div>
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700">
          <button onClick={() => setView('grid')} className={cn('rounded-l-lg px-2.5 py-1.5 transition-colors', view === 'grid' ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300')}>
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button onClick={() => setView('list')} className={cn('rounded-r-lg px-2.5 py-1.5 transition-colors', view === 'list' ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300')}>
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{s.label}</p>
            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/50">
        {FILTER_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === t.key
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-800/30">
          <Rocket className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No IPOs found for this filter.</p>
        </div>
      )}

      {/* Grid view */}
      {filtered.length > 0 && view === 'grid' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ipo) => {
            const card = (
              <div className="rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-slate-600">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[ipo.status])} />
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{ipo.ticker}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">{ipo.exchange}</span>
                    <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">{ipo.sector}</span>
                  </div>
                </div>
                <p className="mb-2 text-sm text-slate-700 dark:text-slate-300">{ipo.companyName}</p>
                <div className="mb-3 text-xs text-slate-500 dark:text-slate-400">{formatDateShort(ipo.expectedDate)}</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500">{ipo.pricedAt ? 'Priced At' : 'Range'}</span>
                    <p className="font-medium text-slate-900 dark:text-white">{ipo.pricedAt ? `$${ipo.pricedAt.toFixed(2)}` : ipo.priceRange}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500">Valuation</span>
                    <p className="font-medium text-slate-900 dark:text-white">{formatCurrency(ipo.valuation)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500">Shares</span>
                    <p className="font-medium text-slate-900 dark:text-white">{(ipo.sharesOffered / 1e6).toFixed(0)}M</p>
                  </div>
                  {ipo.returnPct !== null && (
                    <div>
                      <span className="text-slate-400 dark:text-slate-500">1st Day</span>
                      <p className={cn('font-medium', ipo.returnPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                        {ipo.returnPct >= 0 ? '+' : ''}{ipo.returnPct.toFixed(1)}%
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
            return ipo.status === 'priced' ? (
              <Link key={ipo.ticker} to={`/company/${ipo.ticker}`}>{card}</Link>
            ) : (
              <div key={ipo.ticker}>{card}</div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {filtered.length > 0 && view === 'list' && (
        <div className="space-y-2">
          {filtered.map((ipo) => {
            const row = (
              <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-slate-600">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[ipo.status])} />
                <div className="min-w-[60px]">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{ipo.ticker}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-700 dark:text-slate-300">{ipo.companyName}</p>
                </div>
                <span className="hidden rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-400 sm:inline">{ipo.sector}</span>
                <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:inline">{formatDateShort(ipo.expectedDate)}</span>
                <span className="w-20 text-right text-xs font-medium text-slate-900 dark:text-white">{ipo.pricedAt ? `$${ipo.pricedAt.toFixed(2)}` : ipo.priceRange}</span>
                <span className="w-16 text-right text-xs text-slate-500 dark:text-slate-400">{formatCurrency(ipo.valuation)}</span>
                {ipo.returnPct !== null ? (
                  <span className={cn('w-14 text-right text-xs font-medium', ipo.returnPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    {ipo.returnPct >= 0 ? '+' : ''}{ipo.returnPct.toFixed(1)}%
                  </span>
                ) : (
                  <span className="w-14 text-right text-xs text-slate-400">&mdash;</span>
                )}
              </div>
            );
            return ipo.status === 'priced' ? (
              <Link key={ipo.ticker} to={`/company/${ipo.ticker}`}>{row}</Link>
            ) : (
              <div key={ipo.ticker}>{row}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
