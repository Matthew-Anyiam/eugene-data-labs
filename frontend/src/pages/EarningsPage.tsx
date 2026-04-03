import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, List, LayoutGrid, Star } from 'lucide-react';
import { cn, formatCurrency, formatPercent } from '../lib/utils';
import { useWatchlist } from '../hooks/useWatchlist';

type Timing = 'BMO' | 'AMC';
type Status = 'upcoming' | 'reported';
type FilterTab = 'this-week' | 'next-week' | 'recent' | 'all';
type ViewMode = 'calendar' | 'list';

interface EarningsEntry {
  ticker: string;
  companyName: string;
  reportDate: string;
  timing: Timing;
  epsEstimate: number;
  epsActual: number | null;
  revenueEstimate: number;
  revenueActual: number | null;
  surprise: number | null;
  status: Status;
}

function d(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

const MOCK_EARNINGS: EarningsEntry[] = [
  { ticker: 'AAPL', companyName: 'Apple Inc.', reportDate: d(-3), timing: 'AMC', epsEstimate: 1.58, epsActual: 1.65, revenueEstimate: 94.3e9, revenueActual: 95.4e9, surprise: 4.43, status: 'reported' },
  { ticker: 'MSFT', companyName: 'Microsoft Corp.', reportDate: d(-3), timing: 'AMC', epsEstimate: 2.82, epsActual: 2.94, revenueEstimate: 61.5e9, revenueActual: 62.0e9, surprise: 4.26, status: 'reported' },
  { ticker: 'GOOGL', companyName: 'Alphabet Inc.', reportDate: d(-2), timing: 'AMC', epsEstimate: 1.89, epsActual: 1.95, revenueEstimate: 86.3e9, revenueActual: 88.1e9, surprise: 3.17, status: 'reported' },
  { ticker: 'META', companyName: 'Meta Platforms', reportDate: d(-2), timing: 'AMC', epsEstimate: 5.25, epsActual: 5.08, revenueEstimate: 40.1e9, revenueActual: 39.6e9, surprise: -3.24, status: 'reported' },
  { ticker: 'AMZN', companyName: 'Amazon.com Inc.', reportDate: d(-1), timing: 'AMC', epsEstimate: 1.14, epsActual: 1.29, revenueEstimate: 155e9, revenueActual: 158.9e9, surprise: 13.16, status: 'reported' },
  { ticker: 'TSLA', companyName: 'Tesla Inc.', reportDate: d(-1), timing: 'AMC', epsEstimate: 0.73, epsActual: 0.66, revenueEstimate: 25.6e9, revenueActual: 24.9e9, surprise: -9.59, status: 'reported' },
  { ticker: 'NVDA', companyName: 'NVIDIA Corp.', reportDate: d(0), timing: 'AMC', epsEstimate: 0.82, epsActual: null, revenueEstimate: 37.1e9, revenueActual: null, surprise: null, status: 'upcoming' },
  { ticker: 'AMD', companyName: 'Advanced Micro Devices', reportDate: d(0), timing: 'BMO', epsEstimate: 0.77, epsActual: null, revenueEstimate: 7.5e9, revenueActual: null, surprise: null, status: 'upcoming' },
  { ticker: 'NFLX', companyName: 'Netflix Inc.', reportDate: d(1), timing: 'AMC', epsEstimate: 4.52, epsActual: null, revenueEstimate: 9.8e9, revenueActual: null, surprise: null, status: 'upcoming' },
  { ticker: 'JPM', companyName: 'JPMorgan Chase', reportDate: d(1), timing: 'BMO', epsEstimate: 4.11, epsActual: null, revenueEstimate: 41.8e9, revenueActual: null, surprise: null, status: 'upcoming' },
  { ticker: 'V', companyName: 'Visa Inc.', reportDate: d(2), timing: 'AMC', epsEstimate: 2.68, epsActual: null, revenueEstimate: 9.4e9, revenueActual: null, surprise: null, status: 'upcoming' },
  { ticker: 'MA', companyName: 'Mastercard Inc.', reportDate: d(2), timing: 'BMO', epsEstimate: 3.25, epsActual: null, revenueEstimate: 7.2e9, revenueActual: null, surprise: null, status: 'upcoming' },
  { ticker: 'UNH', companyName: 'UnitedHealth Group', reportDate: d(3), timing: 'BMO', epsEstimate: 6.72, epsActual: null, revenueEstimate: 99.8e9, revenueActual: null, surprise: null, status: 'upcoming' },
  { ticker: 'JNJ', companyName: 'Johnson & Johnson', reportDate: d(3), timing: 'BMO', epsEstimate: 2.57, epsActual: null, revenueEstimate: 21.5e9, revenueActual: null, surprise: null, status: 'upcoming' },
  { ticker: 'PG', companyName: 'Procter & Gamble', reportDate: d(4), timing: 'BMO', epsEstimate: 1.37, epsActual: null, revenueEstimate: 20.8e9, revenueActual: null, surprise: null, status: 'upcoming' },
  { ticker: 'DIS', companyName: 'Walt Disney Co.', reportDate: d(7), timing: 'AMC', epsEstimate: 1.21, epsActual: null, revenueEstimate: 23.1e9, revenueActual: null, surprise: null, status: 'upcoming' },
  { ticker: 'COST', companyName: 'Costco Wholesale', reportDate: d(8), timing: 'AMC', epsEstimate: 3.78, epsActual: null, revenueEstimate: 60.2e9, revenueActual: null, surprise: null, status: 'upcoming' },
  { ticker: 'CRM', companyName: 'Salesforce Inc.', reportDate: d(8), timing: 'AMC', epsEstimate: 2.44, epsActual: null, revenueEstimate: 9.3e9, revenueActual: null, surprise: null, status: 'upcoming' },
  { ticker: 'INTC', companyName: 'Intel Corp.', reportDate: d(9), timing: 'AMC', epsEstimate: 0.13, epsActual: null, revenueEstimate: 12.7e9, revenueActual: null, surprise: null, status: 'upcoming' },
  { ticker: 'WMT', companyName: 'Walmart Inc.', reportDate: d(-7), timing: 'BMO', epsEstimate: 1.65, epsActual: 1.80, revenueEstimate: 165e9, revenueActual: 167.3e9, surprise: 9.09, status: 'reported' },
  { ticker: 'HD', companyName: 'Home Depot Inc.', reportDate: d(-10), timing: 'BMO', epsEstimate: 3.69, epsActual: 3.63, revenueEstimate: 39.1e9, revenueActual: 38.4e9, surprise: -1.63, status: 'reported' },
  { ticker: 'BAC', companyName: 'Bank of America', reportDate: d(-14), timing: 'BMO', epsEstimate: 0.82, epsActual: 0.90, revenueEstimate: 25.4e9, revenueActual: 26.1e9, surprise: 9.76, status: 'reported' },
  { ticker: 'XOM', companyName: 'Exxon Mobil', reportDate: d(-18), timing: 'BMO', epsEstimate: 2.01, epsActual: 1.89, revenueEstimate: 87.3e9, revenueActual: 85.1e9, surprise: -5.97, status: 'reported' },
  { ticker: 'KO', companyName: 'Coca-Cola Co.', reportDate: d(-21), timing: 'BMO', epsEstimate: 0.72, epsActual: 0.77, revenueEstimate: 11.4e9, revenueActual: 11.6e9, surprise: 6.94, status: 'reported' },
  { ticker: 'PEP', companyName: 'PepsiCo Inc.', reportDate: d(-25), timing: 'BMO', epsEstimate: 1.74, epsActual: 1.70, revenueEstimate: 22.5e9, revenueActual: 22.0e9, surprise: -2.30, status: 'reported' },
];

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'this-week', label: 'This Week' },
  { key: 'next-week', label: 'Next Week' },
  { key: 'recent', label: 'Recent' },
  { key: 'all', label: 'All' },
];

function startOfWeek(date: Date, offsetWeeks = 0): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offsetWeeks * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateShort(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeekday(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

export function EarningsPage() {
  const [view, setView] = useState<ViewMode>('list');
  const [tab, setTab] = useState<FilterTab>('this-week');
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const { tickers: watchlistTickers } = useWatchlist();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = useMemo(() => {
    let entries = MOCK_EARNINGS;
    if (watchlistOnly) {
      entries = entries.filter((e) => watchlistTickers.includes(e.ticker));
    }
    const thisMonday = startOfWeek(today);
    const nextMonday = startOfWeek(today, 1);
    const nextFriday = new Date(nextMonday);
    nextFriday.setDate(nextFriday.getDate() + 4);

    switch (tab) {
      case 'this-week': {
        const friday = new Date(thisMonday);
        friday.setDate(friday.getDate() + 4);
        return entries.filter((e) => {
          const rd = new Date(e.reportDate + 'T12:00:00');
          return rd >= thisMonday && rd <= friday;
        });
      }
      case 'next-week':
        return entries.filter((e) => {
          const rd = new Date(e.reportDate + 'T12:00:00');
          return rd >= nextMonday && rd <= nextFriday;
        });
      case 'recent': {
        const past30 = new Date(today);
        past30.setDate(past30.getDate() - 30);
        return entries.filter((e) => {
          const rd = new Date(e.reportDate + 'T12:00:00');
          return rd >= past30 && rd <= today;
        });
      }
      default:
        return entries;
    }
  }, [tab, watchlistOnly, watchlistTickers]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => a.reportDate.localeCompare(b.reportDate)),
    [filtered],
  );

  // Build week grid for calendar view
  const weekDays = useMemo(() => {
    const monday = startOfWeek(today, tab === 'next-week' ? 1 : 0);
    return Array.from({ length: 5 }, (_, i) => {
      const dt = new Date(monday);
      dt.setDate(dt.getDate() + i);
      return dt.toISOString().slice(0, 10);
    });
  }, [tab]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            <CalendarDays className="h-6 w-6 text-blue-500" />
            Earnings Calendar
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Upcoming and recent earnings reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWatchlistOnly(!watchlistOnly)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors',
              watchlistOnly
                ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800',
            )}
          >
            <Star className={cn('h-3.5 w-3.5', watchlistOnly && 'fill-current')} />
            Watchlist
          </button>
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setView('calendar')}
              className={cn(
                'rounded-l-lg px-2.5 py-1.5 transition-colors',
                view === 'calendar'
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'rounded-r-lg px-2.5 py-1.5 transition-colors',
                view === 'list'
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
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

      {sorted.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-800/30">
          <CalendarDays className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No earnings found for this period.</p>
        </div>
      )}

      {/* Calendar week view */}
      {sorted.length > 0 && view === 'calendar' && (tab === 'this-week' || tab === 'next-week') && (
        <div className="grid grid-cols-5 gap-3">
          {weekDays.map((day) => {
            const dayEntries = sorted.filter((e) => e.reportDate === day);
            const isToday = day === today.toISOString().slice(0, 10);
            return (
              <div
                key={day}
                className={cn(
                  'min-h-[160px] rounded-lg border p-3',
                  isToday
                    ? 'border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-950/20'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50',
                )}
              >
                <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {formatWeekday(day)} {formatDateShort(day)}
                </div>
                <div className="space-y-2">
                  {dayEntries.map((e) => (
                    <Link
                      key={e.ticker}
                      to={`/company/${e.ticker}`}
                      className="block rounded-md border border-slate-100 bg-slate-50 p-2 transition-colors hover:border-blue-300 dark:border-slate-600 dark:bg-slate-700/50 dark:hover:border-blue-600"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{e.ticker}</span>
                        <span className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-bold',
                          e.timing === 'BMO'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400',
                        )}>
                          {e.timing}
                        </span>
                      </div>
                      {e.status === 'reported' && e.surprise !== null && (
                        <div className={cn(
                          'mt-1 text-xs font-medium',
                          e.surprise >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                        )}>
                          EPS {e.surprise >= 0 ? 'Beat' : 'Miss'} {formatPercent(e.surprise)}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar fallback for non-week tabs */}
      {sorted.length > 0 && view === 'calendar' && tab !== 'this-week' && tab !== 'next-week' && (
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Calendar view is available for weekly tabs. Showing list view instead.
        </p>
      )}

      {/* List view */}
      {sorted.length > 0 && (view === 'list' || (view === 'calendar' && tab !== 'this-week' && tab !== 'next-week')) && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60">
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Date</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Ticker</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Company</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Timing</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500 dark:text-slate-400">EPS Est</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500 dark:text-slate-400">EPS Actual</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500 dark:text-slate-400">Rev Est</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500 dark:text-slate-400">Rev Actual</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500 dark:text-slate-400">Surprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {sorted.map((e) => (
                <tr key={`${e.ticker}-${e.reportDate}`} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                    {formatDateShort(e.reportDate)}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/company/${e.ticker}`} className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
                      {e.ticker}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{e.companyName}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'rounded px-1.5 py-0.5 text-xs font-bold',
                      e.timing === 'BMO'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                        : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400',
                    )}>
                      {e.timing}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                    ${e.epsEstimate.toFixed(2)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {e.epsActual !== null ? (
                      <span className={cn(
                        'font-medium',
                        e.epsActual >= e.epsEstimate ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                      )}>
                        ${e.epsActual.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-slate-400">&mdash;</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                    {formatCurrency(e.revenueEstimate)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {e.revenueActual !== null ? (
                      <span className={cn(
                        'font-medium',
                        e.revenueActual >= e.revenueEstimate ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                      )}>
                        {formatCurrency(e.revenueActual)}
                      </span>
                    ) : (
                      <span className="text-slate-400">&mdash;</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {e.surprise !== null ? (
                      <span className={cn(
                        'font-medium',
                        e.surprise >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                      )}>
                        {formatPercent(e.surprise)}
                      </span>
                    ) : (
                      <span className="text-slate-400">&mdash;</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
