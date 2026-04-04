import { useState, useMemo } from 'react';
import { FileSearch, ExternalLink, ChevronDown, ChevronRight, Clock, FileText, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useFilings } from '../hooks/useFilings';
import type { Filing } from '../lib/types';

type FilterTab = 'All' | '10-K' | '10-Q' | '8-K' | 'DEF 14A' | 'S-1' | '13F' | 'SC 13D';
type DateRange = '30d' | '90d' | '1y' | 'all';

const QUICK_TICKERS = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL', 'AMZN', 'BRK.B', 'JPM'];

const FILTER_TABS: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'All' },
  { label: '10-K (Annual)', value: '10-K' },
  { label: '10-Q (Quarterly)', value: '10-Q' },
  { label: '8-K (Current)', value: '8-K' },
  { label: 'DEF 14A (Proxy)', value: 'DEF 14A' },
  { label: 'S-1 (Registration)', value: 'S-1' },
  { label: '13F (Institutional)', value: '13F' },
  { label: 'SC 13D (Activist)', value: 'SC 13D' },
];

const DATE_RANGES: { label: string; value: DateRange }[] = [
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Last year', value: '1y' },
  { label: 'All time', value: 'all' },
];

const BADGE_COLORS: Record<string, string> = {
  '10-K': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  '10-Q': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  '8-K': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'DEF 14A': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'S-1': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  '13F': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'SC 13D': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const DEFAULT_BADGE = 'bg-slate-500/20 text-slate-400 border-slate-500/30';

function getBadgeColor(form: string): string {
  return BADGE_COLORS[form] ?? DEFAULT_BADGE;
}

function filterByDate(filings: Filing[], range: DateRange): Filing[] {
  if (range === 'all') return filings;
  const now = new Date();
  const days = range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const cutoff = new Date(now.getTime() - days * 86400000);
  return filings.filter(f => new Date(f.filed_date) >= cutoff);
}

export function FilingsPage() {
  const [search, setSearch] = useState('');
  const [selectedTicker, setSelectedTicker] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('All');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [expandedAccession, setExpandedAccession] = useState<string | null>(null);

  const { data: response, isLoading, isError, error } = useFilings(selectedTicker);

  const allFilings: Filing[] = response?.data?.filings ?? [];

  const filtered = useMemo(() => {
    let result = allFilings;
    if (filterTab !== 'All') result = result.filter(f => f.form === filterTab);
    result = filterByDate(result, dateRange);
    return result;
  }, [allFilings, filterTab, dateRange]);

  const stats = useMemo(() => {
    if (!selectedTicker || allFilings.length === 0) return null;
    const dates = [...allFilings].map(f => f.filed_date).sort();
    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      intervals.push((new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000);
    }
    const avgInterval = intervals.length > 0 ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length) : 0;
    const mostRecent = [...allFilings].sort((a, b) => b.filed_date.localeCompare(a.filed_date))[0].filed_date;
    const nextExpected = new Date(new Date(mostRecent).getTime() + Math.abs(avgInterval) * 86400000)
      .toISOString()
      .slice(0, 10);
    return {
      total: response?.data?.total_available ?? allFilings.length,
      avgDays: Math.abs(avgInterval),
      mostRecent,
      nextExpected,
    };
  }, [allFilings, selectedTicker, response]);

  const timelineDots = useMemo(() => {
    const now = new Date().getTime();
    const yearAgo = now - 365 * 86400000;
    return filtered
      .filter(f => new Date(f.filed_date).getTime() >= yearAgo)
      .map(f => ({
        accession: f.accession,
        pct: ((new Date(f.filed_date).getTime() - yearAgo) / (now - yearAgo)) * 100,
        form: f.form,
        filed_date: f.filed_date,
      }));
  }, [filtered]);

  function handleTickerSubmit() {
    const t = search.trim().toUpperCase();
    if (t) {
      setSelectedTicker(t);
      setFilterTab('All');
      setExpandedAccession(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <FileSearch className="h-7 w-7 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">SEC Filings</h1>
        </div>
        <p className="text-slate-400">Browse and analyze SEC EDGAR filings across public companies.</p>
      </div>

      {/* Search + Quick Tickers */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter ticker symbol (e.g. AAPL)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTickerSubmit()}
            className="flex-1 rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleTickerSubmit}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Search
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_TICKERS.map(t => (
            <button
              key={t}
              onClick={() => {
                setSelectedTicker(t);
                setSearch(t);
                setFilterTab('All');
                setExpandedAccession(null);
              }}
              className={cn(
                'rounded-md border px-3 py-1 text-xs font-medium transition-colors',
                selectedTicker === t
                  ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                  : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && selectedTicker && (
        <div className="flex items-center justify-center gap-3 rounded-lg border border-slate-700 bg-slate-800 py-12">
          <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
          <span className="text-sm text-slate-400">Loading filings for {selectedTicker}...</span>
        </div>
      )}

      {/* Error State */}
      {isError && selectedTicker && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Failed to load filings for {selectedTicker}.{' '}
          {error instanceof Error ? error.message : 'Please try again.'}
        </div>
      )}

      {/* Summary Stats */}
      {!isLoading && stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total Filings', value: stats.total.toString() },
            { label: 'Avg. Frequency', value: `${stats.avgDays}d` },
            { label: 'Most Recent', value: stats.mostRecent },
            { label: 'Next Expected', value: stats.nextExpected },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-slate-700 bg-slate-800 p-3">
              <div className="text-xs text-slate-400">{s.label}</div>
              <div className="mt-1 text-lg font-semibold text-white">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filing Timeline */}
      {!isLoading && timelineDots.length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
            <Clock className="h-4 w-4" />
            Filing Timeline (Last 12 Months)
          </div>
          <div className="relative h-6">
            <div className="absolute inset-x-0 top-1/2 h-px bg-slate-600" />
            {timelineDots.map(d => (
              <div
                key={d.accession}
                className={cn(
                  'absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border',
                  getBadgeColor(d.form).split(' ')[0],
                  'border-slate-500'
                )}
                style={{ left: `${d.pct}%` }}
                title={`${d.form} - ${d.filed_date}`}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-slate-500">
            <span>1 year ago</span>
            <span>Today</span>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilterTab(tab.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              filterTab === tab.value
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Period:</span>
        {DATE_RANGES.map(dr => (
          <button
            key={dr.value}
            onClick={() => setDateRange(dr.value)}
            className={cn(
              'rounded px-2.5 py-1 text-xs transition-colors',
              dateRange === dr.value
                ? 'bg-slate-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            {dr.label}
          </button>
        ))}
      </div>

      {/* Section Header */}
      {!isLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <FileText className="h-4 w-4" />
          {selectedTicker ? (
            <span>
              {filtered.length} filings for{' '}
              <span className="font-semibold text-white">{selectedTicker}</span>
            </span>
          ) : (
            <span>Enter a ticker above to browse SEC filings</span>
          )}
        </div>
      )}

      {/* Filings Table */}
      {!isLoading && selectedTicker && !isError && (
        <div className="overflow-hidden rounded-lg border border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-700 bg-slate-800">
              <tr>
                <th className="px-4 py-3 text-xs font-medium text-slate-400">Date Filed</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400">Type</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400">Description</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400">Accession</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700 bg-slate-800/50">
              {filtered.map(f => (
                <FilingRow
                  key={f.accession}
                  filing={f}
                  expanded={expandedAccession === f.accession}
                  onToggle={() =>
                    setExpandedAccession(expandedAccession === f.accession ? null : f.accession)
                  }
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    No filings found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty prompt when no ticker selected */}
      {!selectedTicker && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 py-16 text-center text-slate-500">
          <FileSearch className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm">Select a ticker or enter one above to view SEC filings.</p>
        </div>
      )}
    </div>
  );
}

function FilingRow({
  filing,
  expanded,
  onToggle,
}: {
  filing: Filing;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer transition-colors hover:bg-slate-700/50">
        <td className="whitespace-nowrap px-4 py-3 text-slate-300">{filing.filed_date}</td>
        <td className="whitespace-nowrap px-4 py-3">
          <span
            className={cn(
              'inline-block rounded border px-2 py-0.5 text-xs font-medium',
              getBadgeColor(filing.form)
            )}
          >
            {filing.form}
          </span>
        </td>
        <td className="px-4 py-3 text-slate-200">{filing.description || '—'}</td>
        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-400">
          {filing.accession}
        </td>
        <td className="px-4 py-3 text-right">
          <span className="inline-flex items-center gap-2 text-slate-400">
            {filing.url && (
              <a
                href={filing.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="hover:text-blue-400"
                title="View on SEC EDGAR"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="border-t border-slate-600 bg-slate-800 px-6 py-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-white">Filing Details</h4>
                  <p className="mt-1 text-sm text-slate-400">
                    {filing.description || 'No description available.'}
                  </p>
                </div>
                {filing.url && (
                  <a
                    href={filing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-4 inline-flex shrink-0 items-center gap-1.5 rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/20"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View on SEC EDGAR
                  </a>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                <div className="rounded border border-slate-700 bg-slate-900 px-3 py-2">
                  <div className="text-slate-500">Form Type</div>
                  <div className="mt-0.5 font-medium text-white">{filing.form}</div>
                </div>
                <div className="rounded border border-slate-700 bg-slate-900 px-3 py-2">
                  <div className="text-slate-500">Filed Date</div>
                  <div className="mt-0.5 font-medium text-white">{filing.filed_date}</div>
                </div>
                <div className="rounded border border-slate-700 bg-slate-900 px-3 py-2">
                  <div className="text-slate-500">Accession Number</div>
                  <div className="mt-0.5 font-mono font-medium text-white">{filing.accession}</div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
