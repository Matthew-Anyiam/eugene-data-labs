import { useState, useMemo } from 'react';
import { BarChart3, Search, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'JNJ', 'WMT', 'XOM', 'HD', 'PG', 'UNH', 'MA', 'AMD', 'CRM', 'NFLX', 'LLY'];

interface RevisionData {
  ticker: string;
  currentEPS: number;
  eps30dAgo: number;
  eps60dAgo: number;
  eps90dAgo: number;
  revisionPct30d: number;
  revisionPct60d: number;
  revisionPct90d: number;
  numUp: number;
  numDown: number;
  revenueCurrent: number;
  revenueRevision30d: number;
  momentum: 'Strong Up' | 'Up' | 'Flat' | 'Down' | 'Strong Down';
  nextEarnings: string;
  analystCount: number;
}

function genRevisions(): RevisionData[] {
  return TICKERS.map(ticker => {
    const s = seed(ticker + '_rev');
    const currentEPS = +(1 + pseudo(s, 0) * 9).toFixed(2);
    const rev30 = +((pseudo(s, 1) - 0.4) * 15).toFixed(2);
    const rev60 = +((pseudo(s, 2) - 0.4) * 20).toFixed(2);
    const rev90 = +((pseudo(s, 3) - 0.35) * 25).toFixed(2);
    const numUp = Math.floor(pseudo(s, 4) * 20);
    const numDown = Math.floor(pseudo(s, 5) * 15);
    const revenueRev = +((pseudo(s, 6) - 0.4) * 10).toFixed(2);

    let momentum: RevisionData['momentum'];
    if (rev30 > 3) momentum = 'Strong Up';
    else if (rev30 > 0.5) momentum = 'Up';
    else if (rev30 > -0.5) momentum = 'Flat';
    else if (rev30 > -3) momentum = 'Down';
    else momentum = 'Strong Down';

    const daysUntil = Math.floor(10 + pseudo(s, 7) * 80);
    const nextDate = new Date(2026, 3, 3);
    nextDate.setDate(nextDate.getDate() + daysUntil);

    return {
      ticker,
      currentEPS,
      eps30dAgo: +(currentEPS / (1 + rev30 / 100)).toFixed(2),
      eps60dAgo: +(currentEPS / (1 + rev60 / 100)).toFixed(2),
      eps90dAgo: +(currentEPS / (1 + rev90 / 100)).toFixed(2),
      revisionPct30d: rev30,
      revisionPct60d: rev60,
      revisionPct90d: rev90,
      numUp,
      numDown,
      revenueCurrent: +(10 + pseudo(s, 8) * 90).toFixed(1),
      revenueRevision30d: revenueRev,
      momentum,
      nextEarnings: nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      analystCount: numUp + numDown + Math.floor(pseudo(s, 9) * 5),
    };
  }).sort((a, b) => b.revisionPct30d - a.revisionPct30d);
}

const MOMENTUM_STYLES: Record<RevisionData['momentum'], { bg: string; text: string }> = {
  'Strong Up': { bg: 'bg-emerald-900/40', text: 'text-emerald-400' },
  'Up': { bg: 'bg-emerald-900/20', text: 'text-emerald-400' },
  'Flat': { bg: 'bg-slate-700', text: 'text-slate-300' },
  'Down': { bg: 'bg-red-900/20', text: 'text-red-400' },
  'Strong Down': { bg: 'bg-red-900/40', text: 'text-red-400' },
};

export function EarningsRevisionsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Up' | 'Down'>('All');
  const [sortBy, setSortBy] = useState<'revision' | 'momentum' | 'analysts'>('revision');

  const data = useMemo(() => genRevisions(), []);

  const filtered = data
    .filter(d => !search || d.ticker.includes(search.toUpperCase()))
    .filter(d => {
      if (filter === 'Up') return d.revisionPct30d > 0;
      if (filter === 'Down') return d.revisionPct30d < 0;
      return true;
    });

  const upRevisions = data.filter(d => d.revisionPct30d > 0).length;
  const downRevisions = data.filter(d => d.revisionPct30d < 0).length;
  const avgRevision = data.reduce((s, d) => s + d.revisionPct30d, 0) / data.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Earnings Revisions</h1>
          <p className="text-sm text-slate-400">EPS estimate revisions, consensus drift, and revision momentum</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Upward Revisions</div>
          <div className="mt-1 flex items-center gap-2">
            <ArrowUp className="h-5 w-5 text-emerald-400" />
            <span className="text-2xl font-bold text-emerald-400">{upRevisions}</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Downward Revisions</div>
          <div className="mt-1 flex items-center gap-2">
            <ArrowDown className="h-5 w-5 text-red-400" />
            <span className="text-2xl font-bold text-red-400">{downRevisions}</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Avg 30d Revision</div>
          <div className={cn('mt-1 text-2xl font-bold', avgRevision >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {avgRevision >= 0 ? '+' : ''}{avgRevision.toFixed(2)}%
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Up/Down Ratio</div>
          <div className={cn('mt-1 text-2xl font-bold', upRevisions >= downRevisions ? 'text-emerald-400' : 'text-red-400')}>
            {downRevisions > 0 ? (upRevisions / downRevisions).toFixed(2) : 'N/A'}
          </div>
        </div>
      </div>

      {/* Revision waterfall */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">30-Day EPS Revisions</h3>
        <div className="flex items-end gap-1" style={{ height: '100px' }}>
          {data.map(d => {
            const maxAbs = Math.max(...data.map(x => Math.abs(x.revisionPct30d)));
            const height = maxAbs > 0 ? (Math.abs(d.revisionPct30d) / maxAbs) * 80 : 0;
            return (
              <div key={d.ticker} className="flex flex-1 flex-col items-center gap-0.5">
                <div className={cn('w-full rounded-t min-h-[2px]', d.revisionPct30d >= 0 ? 'bg-emerald-500/50' : 'bg-red-500/50')}
                  style={{ height: `${Math.max(2, height)}px` }} />
                <span className="text-[7px] text-slate-600 -rotate-45 origin-left">{d.ticker}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value.toUpperCase())}
            placeholder="Filter..." className="w-32 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none" />
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
          {(['All', 'Up', 'Down'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('rounded-md px-3 py-1 text-xs font-medium', filter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>
              {f} Revisions
            </button>
          ))}
        </div>
      </div>

      {/* Revision cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.slice(0, 8).map(d => {
          const style = MOMENTUM_STYLES[d.momentum];
          return (
            <div key={d.ticker} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">{d.ticker}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', style.bg, style.text)}>
                  {d.momentum}
                </span>
              </div>
              <div className="mt-2 text-xl font-bold text-white">${d.currentEPS}</div>
              <div className="text-[10px] text-slate-500">Current EPS Est.</div>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">30d</span>
                  <span className={cn('font-medium', d.revisionPct30d >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {d.revisionPct30d >= 0 ? '+' : ''}{d.revisionPct30d}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">60d</span>
                  <span className={cn('font-medium', d.revisionPct60d >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {d.revisionPct60d >= 0 ? '+' : ''}{d.revisionPct60d}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">90d</span>
                  <span className={cn('font-medium', d.revisionPct90d >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {d.revisionPct90d >= 0 ? '+' : ''}{d.revisionPct90d}%
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-slate-700 pt-2 text-[10px]">
                <span className="text-emerald-400">{d.numUp} up</span>
                <span className="text-red-400">{d.numDown} down</span>
                <span className="text-slate-500">Next: {d.nextEarnings}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">EPS Est.</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">30d Rev</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">60d Rev</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">90d Rev</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Up/Down</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Momentum</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Rev Est.</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Rev Rev</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Earnings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.map(d => {
              const style = MOMENTUM_STYLES[d.momentum];
              return (
                <tr key={d.ticker} className="bg-slate-800 hover:bg-slate-750">
                  <td className="px-3 py-2 text-xs font-bold text-indigo-400">{d.ticker}</td>
                  <td className="px-3 py-2 text-right text-xs text-white font-medium">${d.currentEPS}</td>
                  <td className={cn('px-3 py-2 text-right text-xs font-medium', d.revisionPct30d >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {d.revisionPct30d >= 0 ? '+' : ''}{d.revisionPct30d}%
                  </td>
                  <td className={cn('px-3 py-2 text-right text-xs font-medium', d.revisionPct60d >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {d.revisionPct60d >= 0 ? '+' : ''}{d.revisionPct60d}%
                  </td>
                  <td className={cn('px-3 py-2 text-right text-xs font-medium', d.revisionPct90d >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {d.revisionPct90d >= 0 ? '+' : ''}{d.revisionPct90d}%
                  </td>
                  <td className="px-3 py-2 text-center text-xs">
                    <span className="text-emerald-400">{d.numUp}</span>
                    <span className="text-slate-600"> / </span>
                    <span className="text-red-400">{d.numDown}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', style.bg, style.text)}>
                      {d.momentum}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">${d.revenueCurrent}B</td>
                  <td className={cn('px-3 py-2 text-right text-xs font-medium', d.revenueRevision30d >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {d.revenueRevision30d >= 0 ? '+' : ''}{d.revenueRevision30d}%
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">{d.nextEarnings}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
