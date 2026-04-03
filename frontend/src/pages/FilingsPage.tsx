import { useState, useMemo } from 'react';
import { FileSearch, ExternalLink, ChevronDown, ChevronRight, Clock, FileText } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

type FilingType = '10-K' | '10-Q' | '8-K' | 'DEF 14A' | 'S-1' | '13F' | 'SC 13D';
type FilterTab = 'All' | FilingType;
type DateRange = '30d' | '90d' | '1y' | 'all';

interface Filing {
  id: string;
  ticker: string;
  company: string;
  type: FilingType;
  date: string;
  periodOfReport: string;
  description: string;
  fileSize: string;
  sections: string[];
  summary: string;
  related: string[];
}

const QUICK_TICKERS = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL', 'AMZN', 'BRK.B', 'JPM'];

const FILING_TYPES: FilingType[] = ['10-K', '10-Q', '8-K', 'DEF 14A', 'S-1', '13F', 'SC 13D'];

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

const BADGE_COLORS: Record<FilingType, string> = {
  '10-K': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  '10-Q': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  '8-K': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'DEF 14A': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'S-1': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  '13F': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'SC 13D': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const COMPANIES: Record<string, string> = {
  AAPL: 'Apple Inc.', MSFT: 'Microsoft Corp.', TSLA: 'Tesla Inc.', NVDA: 'NVIDIA Corp.',
  GOOGL: 'Alphabet Inc.', AMZN: 'Amazon.com Inc.', 'BRK.B': 'Berkshire Hathaway Inc.', JPM: 'JPMorgan Chase & Co.',
  META: 'Meta Platforms Inc.', V: 'Visa Inc.', UNH: 'UnitedHealth Group', CRM: 'Salesforce Inc.',
};

const DESCRIPTIONS: Record<FilingType, string[]> = {
  '10-K': ['Annual Report', 'Annual Report (Amendment)', 'Annual Report (Transition)'],
  '10-Q': ['Quarterly Report (Q1)', 'Quarterly Report (Q2)', 'Quarterly Report (Q3)'],
  '8-K': ['Current Report - Leadership Change', 'Current Report - Financial Results', 'Current Report - Material Agreement', 'Current Report - Acquisition'],
  'DEF 14A': ['Definitive Proxy Statement', 'Proxy Statement (Annual Meeting)'],
  'S-1': ['Registration Statement', 'Registration Statement (Amendment)'],
  '13F': ['Institutional Holdings Report', 'Quarterly Holdings Report'],
  'SC 13D': ['Beneficial Ownership Report', 'Schedule 13D Amendment'],
};

const SECTION_MAP: Record<FilingType, string[]> = {
  '10-K': ['Business Overview', 'Risk Factors', 'MD&A', 'Financial Statements', 'Notes to Financials', 'Exhibits'],
  '10-Q': ['Financial Statements', 'MD&A', 'Quantitative Disclosures', 'Controls and Procedures'],
  '8-K': ['Item 1.01 - Material Agreement', 'Item 2.02 - Results of Operations', 'Item 5.02 - Director Changes', 'Exhibits'],
  'DEF 14A': ['Board of Directors', 'Executive Compensation', 'Shareholder Proposals', 'Voting Information'],
  'S-1': ['Prospectus Summary', 'Risk Factors', 'Use of Proceeds', 'Business Description', 'Financial Data'],
  '13F': ['Holdings Table', 'Summary of Changes', 'New Positions', 'Closed Positions'],
  'SC 13D': ['Identity of Filer', 'Source of Funds', 'Purpose of Transaction', 'Contracts and Arrangements'],
};

const SUMMARIES: Record<FilingType, string> = {
  '10-K': 'Comprehensive annual disclosure covering financial performance, business operations, risk factors, and forward-looking statements for the fiscal year.',
  '10-Q': 'Quarterly financial update with unaudited financial statements, management discussion of results, and disclosure of material changes.',
  '8-K': 'Disclosure of significant corporate events or material changes that shareholders should be aware of between regular filing periods.',
  'DEF 14A': 'Proxy materials for the upcoming annual shareholder meeting including director nominees, executive compensation details, and proposals.',
  'S-1': 'Initial or amended registration statement for securities offering including prospectus, risk factors, and use of proceeds.',
  '13F': 'Quarterly report of institutional investment holdings above $100M threshold as required by Section 13(f) of the Securities Exchange Act.',
  'SC 13D': 'Beneficial ownership disclosure filed when an entity acquires more than 5% of a class of equity securities.',
};

function generateFilings(ticker: string, count: number): Filing[] {
  const s = seed(ticker);
  const company = COMPANIES[ticker] || `${ticker} Corp.`;
  const filings: Filing[] = [];
  for (let i = 0; i < count; i++) {
    const p = pseudo(s, i);
    const typeIdx = Math.floor(pseudo(s, i * 3 + 1) * FILING_TYPES.length);
    const type = FILING_TYPES[typeIdx];
    const descs = DESCRIPTIONS[type];
    const desc = descs[Math.floor(pseudo(s, i * 7 + 2) * descs.length)];
    const daysBack = Math.floor(p * 365) + 1;
    const date = new Date(2026, 3, 3 - daysBack);
    const periodDate = new Date(date.getFullYear(), date.getMonth() - 1, 0);
    const sizeKB = Math.floor(pseudo(s, i * 11 + 5) * 9000) + 100;
    filings.push({
      id: `${ticker}-${i}`,
      ticker,
      company,
      type,
      date: date.toISOString().slice(0, 10),
      periodOfReport: periodDate.toISOString().slice(0, 10),
      description: desc,
      fileSize: sizeKB > 1000 ? `${(sizeKB / 1000).toFixed(1)} MB` : `${sizeKB} KB`,
      sections: SECTION_MAP[type],
      summary: SUMMARIES[type],
      related: [`${ticker}-${(i + 1) % count}`, `${ticker}-${(i + 3) % count}`],
    });
  }
  filings.sort((a, b) => b.date.localeCompare(a.date));
  return filings;
}

function generateRecentFilings(): Filing[] {
  const tickers = Object.keys(COMPANIES);
  const all: Filing[] = [];
  for (const ticker of tickers) {
    const batch = generateFilings(ticker, 5);
    all.push(...batch);
  }
  all.sort((a, b) => b.date.localeCompare(a.date));
  return all.slice(0, 20);
}

function filterByDate(filings: Filing[], range: DateRange): Filing[] {
  if (range === 'all') return filings;
  const now = new Date(2026, 3, 3);
  const days = range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const cutoff = new Date(now.getTime() - days * 86400000);
  return filings.filter(f => new Date(f.date) >= cutoff);
}

export function FilingsPage() {
  const [search, setSearch] = useState('');
  const [selectedTicker, setSelectedTicker] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('All');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allFilings = useMemo(() => {
    if (!selectedTicker) return generateRecentFilings();
    return generateFilings(selectedTicker, 30);
  }, [selectedTicker]);

  const filtered = useMemo(() => {
    let result = allFilings;
    if (filterTab !== 'All') result = result.filter(f => f.type === filterTab);
    result = filterByDate(result, dateRange);
    return result;
  }, [allFilings, filterTab, dateRange]);

  const stats = useMemo(() => {
    if (!selectedTicker || allFilings.length === 0) return null;
    const dates = allFilings.map(f => f.date).sort();
    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      intervals.push((new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000);
    }
    const avgInterval = intervals.length > 0 ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length) : 0;
    const mostRecent = allFilings[0].date;
    const nextExpected = new Date(new Date(mostRecent).getTime() + avgInterval * 86400000).toISOString().slice(0, 10);
    return { total: allFilings.length, avgDays: Math.abs(avgInterval), mostRecent, nextExpected };
  }, [allFilings, selectedTicker]);

  const timelineDots = useMemo(() => {
    const now = new Date(2026, 3, 3).getTime();
    const yearAgo = now - 365 * 86400000;
    return filtered
      .filter(f => new Date(f.date).getTime() >= yearAgo)
      .map(f => ({ id: f.id, pct: ((new Date(f.date).getTime() - yearAgo) / (now - yearAgo)) * 100, type: f.type }));
  }, [filtered]);

  function handleTickerSubmit() {
    const t = search.trim().toUpperCase();
    if (t) { setSelectedTicker(t); setFilterTab('All'); setExpandedId(null); }
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
              onClick={() => { setSelectedTicker(t); setSearch(t); setFilterTab('All'); setExpandedId(null); }}
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

      {/* Summary Stats */}
      {stats && (
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
      {timelineDots.length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
            <Clock className="h-4 w-4" />
            Filing Timeline (Last 12 Months)
          </div>
          <div className="relative h-6">
            <div className="absolute inset-x-0 top-1/2 h-px bg-slate-600" />
            {timelineDots.map(d => (
              <div
                key={d.id}
                className={cn('absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border',
                  BADGE_COLORS[d.type].split(' ')[0],
                  'border-slate-500'
                )}
                style={{ left: `${d.pct}%` }}
                title={`${d.type} - ${d.id}`}
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
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <FileText className="h-4 w-4" />
        {selectedTicker
          ? <span>{filtered.length} filings for <span className="font-semibold text-white">{selectedTicker}</span></span>
          : <span>Recent filings across all companies ({filtered.length})</span>}
      </div>

      {/* Filings Table */}
      <div className="overflow-hidden rounded-lg border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-700 bg-slate-800">
            <tr>
              <th className="px-4 py-3 text-xs font-medium text-slate-400">Date</th>
              {!selectedTicker && <th className="px-4 py-3 text-xs font-medium text-slate-400">Ticker</th>}
              <th className="px-4 py-3 text-xs font-medium text-slate-400">Type</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400">Description</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400">Period</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400">Size</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700 bg-slate-800/50">
            {filtered.map(f => (
              <FilingRow
                key={f.id}
                filing={f}
                showTicker={!selectedTicker}
                expanded={expandedId === f.id}
                onToggle={() => setExpandedId(expandedId === f.id ? null : f.id)}
                allFilings={allFilings}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={selectedTicker ? 6 : 7} className="px-4 py-12 text-center text-slate-500">
                  No filings found for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilingRow({
  filing,
  showTicker,
  expanded,
  onToggle,
  allFilings,
}: {
  filing: Filing;
  showTicker: boolean;
  expanded: boolean;
  onToggle: () => void;
  allFilings: Filing[];
}) {
  const relatedFilings = filing.related
    .map(rid => allFilings.find(f => f.id === rid))
    .filter((f): f is Filing => f !== undefined);

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer transition-colors hover:bg-slate-700/50"
      >
        <td className="whitespace-nowrap px-4 py-3 text-slate-300">{filing.date}</td>
        {showTicker && (
          <td className="whitespace-nowrap px-4 py-3 font-medium text-white">{filing.ticker}</td>
        )}
        <td className="whitespace-nowrap px-4 py-3">
          <span className={cn('inline-block rounded border px-2 py-0.5 text-xs font-medium', BADGE_COLORS[filing.type])}>
            {filing.type}
          </span>
        </td>
        <td className="px-4 py-3 text-slate-200">{filing.description}</td>
        <td className="whitespace-nowrap px-4 py-3 text-slate-400">{filing.periodOfReport}</td>
        <td className="whitespace-nowrap px-4 py-3 text-slate-400">{filing.fileSize}</td>
        <td className="px-4 py-3 text-right">
          <span className="inline-flex items-center gap-2 text-slate-400">
            <ExternalLink className="h-3.5 w-3.5 hover:text-blue-400" />
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={showTicker ? 7 : 6} className="border-t border-slate-600 bg-slate-800 px-6 py-4">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium text-white">Summary</h4>
                <p className="mt-1 text-sm text-slate-400">{filing.summary}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-white">Key Sections / Exhibits</h4>
                <ul className="mt-1 grid grid-cols-2 gap-1 text-sm text-slate-400">
                  {filing.sections.map(sec => (
                    <li key={sec} className="flex items-center gap-1">
                      <span className="text-slate-600">--</span> {sec}
                    </li>
                  ))}
                </ul>
              </div>
              {relatedFilings.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-white">Related Filings</h4>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {relatedFilings.map(rf => (
                      <span
                        key={rf.id}
                        className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-300"
                      >
                        <span className={cn('inline-block rounded px-1 text-[10px] font-medium', BADGE_COLORS[rf.type])}>
                          {rf.type}
                        </span>
                        {rf.date} - {rf.description}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
