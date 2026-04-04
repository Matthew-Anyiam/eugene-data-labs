import { useState, useMemo } from 'react';
import {
  CircleDollarSign,
  TrendingUp,
  Calendar,
  Filter,
  Search,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useCorporateActions } from '../hooks/useCorporateActions';
import type { CorporateAction } from '../hooks/useCorporateActions';

const DEFAULT_TICKERS = [
  'AAPL', 'MSFT', 'JPM', 'JNJ', 'PG', 'KO', 'PEP', 'XOM',
  'CVX', 'HD', 'MCD', 'VZ', 'T', 'ABBV', 'MRK', 'BAC',
  'WMT', 'COST', 'ABT', 'LMT',
];

type SortKey = 'date' | 'value';

/* ── Per-ticker dividend panel ─────────────────────── */
function TickerDividendPanel({ ticker }: { ticker: string }) {
  const { data: result, isLoading, error } = useCorporateActions(ticker, 40);

  const actions = result?.data?.actions ?? [];
  const dividends = useMemo(
    () => actions.filter((a: CorporateAction) => a.type === 'dividend').sort((a, b) => b.date.localeCompare(a.date)),
    [actions],
  );

  const latestDiv = dividends[0] ?? null;
  const totalAnnual = useMemo(() => {
    if (!dividends.length) return 0;
    const thisYear = new Date().getFullYear().toString();
    const yearDivs = dividends.filter(d => d.date.startsWith(thisYear));
    return yearDivs.reduce((s, d) => s + (d.value ?? 0), 0);
  }, [dividends]);

  const maxVal = useMemo(() => Math.max(...dividends.map(d => d.value ?? 0), 0.01), [dividends]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-green-400" />
        <span className="ml-2 text-sm text-slate-400">Loading dividends for {ticker}…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Failed to load dividends: {(error as Error).message}
      </div>
    );
  }

  if (!dividends.length) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 text-center text-sm text-slate-500">
        No dividend records found for <span className="font-mono text-white">{ticker}</span>.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Latest Dividend', value: latestDiv ? `$${latestDiv.value?.toFixed(4)}` : '—', color: 'text-green-400' },
          { label: 'Annual (This Year)', value: totalAnnual > 0 ? `$${totalAnnual.toFixed(4)}` : '—', color: 'text-emerald-400' },
          { label: 'Total Records', value: dividends.length.toString(), color: 'text-white' },
          { label: 'Last Ex-Date', value: latestDiv?.date ?? '—', color: 'text-slate-300' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
            <div className={cn('mt-1 text-sm font-bold', c.color)}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Bar chart history */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Dividend History</h3>
        <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ minHeight: '90px' }}>
          {dividends.slice(0, 20).reverse().map((d, i) => {
            const height = Math.max(6, (d.value / maxVal) * 70);
            return (
              <div key={i} className="flex min-w-[28px] flex-1 flex-col items-center gap-0.5">
                <span className="text-[8px] text-green-400">${d.value?.toFixed(2)}</span>
                <div className="w-full rounded-t bg-green-500/40" style={{ height: `${height}px` }} />
                <span className="text-[8px] text-slate-600 rotate-0 whitespace-nowrap">
                  {d.date?.slice(0, 7)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Date</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Amount</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Description</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {dividends.map((d: CorporateAction, i: number) => (
              <tr key={i} className="bg-slate-800 hover:bg-slate-750">
                <td className="px-3 py-2 text-xs font-mono text-slate-300">{d.date}</td>
                <td className="px-3 py-2 text-right text-xs font-bold text-green-400">${d.value?.toFixed(4)}</td>
                <td className="px-3 py-2 text-xs text-slate-400">{d.description || '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{d.source || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────── */
export function DividendTrackerPage() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [tickerInput, setTickerInput] = useState('');

  const selectTicker = (t: string) => {
    setSelectedTicker(t.toUpperCase());
    setTickerInput('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CircleDollarSign className="h-6 w-6 text-green-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Dividend Tracker</h1>
          <p className="text-sm text-slate-400">Dividend history, yields, payout dates from live SEC filings</p>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={tickerInput}
            onChange={e => setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter' && tickerInput) selectTicker(tickerInput); }}
            placeholder="Ticker…"
            className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-green-500 focus:outline-none"
          />
        </div>
        {DEFAULT_TICKERS.map(t => (
          <button
            key={t}
            onClick={() => selectTicker(t)}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
              selectedTicker === t
                ? 'bg-green-600 text-white'
                : 'border border-slate-700 text-slate-400 hover:text-white',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Current ticker header */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-white">
          <Link to={`/company/${selectedTicker}`} className="text-green-400 hover:underline">
            {selectedTicker}
          </Link>
          {' '}— Dividend History
        </h2>
      </div>

      <TickerDividendPanel ticker={selectedTicker} />
    </div>
  );
}
