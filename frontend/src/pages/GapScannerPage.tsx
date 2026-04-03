import { useState, useMemo } from 'react';
import { ArrowUpDown, TrendingUp, TrendingDown, Filter } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

type GapType = 'Up' | 'Down';
type GapFilter = 'All' | 'Up' | 'Down' | 'Filled' | 'Unfilled';

interface GapEntry {
  ticker: string;
  company: string;
  gapType: GapType;
  gapPct: number;
  prevClose: number;
  openPrice: number;
  currentPrice: number;
  volume: number;
  avgVolume: number;
  volumeRatio: number;
  filled: boolean;
  fillPct: number;
  date: string;
  catalyst: string;
}

const TICKERS_DATA: { ticker: string; company: string }[] = [
  { ticker: 'NVDA', company: 'NVIDIA Corp' },
  { ticker: 'TSLA', company: 'Tesla Inc' },
  { ticker: 'AMD', company: 'Advanced Micro' },
  { ticker: 'AAPL', company: 'Apple Inc' },
  { ticker: 'AMZN', company: 'Amazon.com' },
  { ticker: 'META', company: 'Meta Platforms' },
  { ticker: 'GOOGL', company: 'Alphabet Inc' },
  { ticker: 'MSFT', company: 'Microsoft Corp' },
  { ticker: 'NFLX', company: 'Netflix Inc' },
  { ticker: 'CRM', company: 'Salesforce Inc' },
  { ticker: 'SHOP', company: 'Shopify Inc' },
  { ticker: 'SNOW', company: 'Snowflake Inc' },
  { ticker: 'PLTR', company: 'Palantir Tech' },
  { ticker: 'COIN', company: 'Coinbase Global' },
  { ticker: 'SOFI', company: 'SoFi Tech' },
  { ticker: 'RIVN', company: 'Rivian Auto' },
  { ticker: 'UBER', company: 'Uber Tech' },
  { ticker: 'SQ', company: 'Block Inc' },
  { ticker: 'PYPL', company: 'PayPal Holdings' },
  { ticker: 'ROKU', company: 'Roku Inc' },
];

const CATALYSTS = ['Earnings Beat', 'Earnings Miss', 'Upgrade', 'Downgrade', 'FDA Approval', 'Product Launch', 'Guidance Raise', 'Guidance Cut', 'Acquisition', 'Analyst Initiation', 'SEC Filing', 'Insider Activity'];

function genGaps(): GapEntry[] {
  return TICKERS_DATA.map((t, idx) => {
    const s = seed(t.ticker + '_gap');
    const isUp = pseudo(s, 0) > 0.45;
    const gapPct = +(1 + pseudo(s, 1) * 14).toFixed(2) * (isUp ? 1 : -1);
    const prevClose = +(50 + pseudo(s, 2) * 450).toFixed(2);
    const openPrice = +(prevClose * (1 + gapPct / 100)).toFixed(2);
    const fillPct = +(pseudo(s, 3) * 100).toFixed(0);
    const filled = Number(fillPct) >= 100;
    const currentMove = (pseudo(s, 4) - 0.4) * 5;
    const currentPrice = +(openPrice * (1 + currentMove / 100)).toFixed(2);
    const avgVolume = 5 + pseudo(s, 5) * 95;
    const volumeRatio = +(1.5 + pseudo(s, 6) * 4).toFixed(1);
    const daysAgo = Math.floor(pseudo(s, 7) * 14);
    const date = new Date(2026, 3, 3);
    date.setDate(date.getDate() - daysAgo);
    const catalystIdx = Math.floor(pseudo(s, 8) * CATALYSTS.length);

    return {
      ...t,
      gapType: isUp ? 'Up' : 'Down',
      gapPct,
      prevClose,
      openPrice,
      currentPrice,
      volume: +(avgVolume * volumeRatio).toFixed(1),
      avgVolume: +avgVolume.toFixed(1),
      volumeRatio,
      filled,
      fillPct: Math.min(100, Number(fillPct)),
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      catalyst: CATALYSTS[catalystIdx],
    };
  }).sort((a, b) => Math.abs(b.gapPct) - Math.abs(a.gapPct));
}

export function GapScannerPage() {
  const [filter, setFilter] = useState<GapFilter>('All');
  const [minGap, setMinGap] = useState(0);

  const gaps = useMemo(() => genGaps(), []);

  const filtered = gaps
    .filter(g => {
      if (filter === 'Up') return g.gapType === 'Up';
      if (filter === 'Down') return g.gapType === 'Down';
      if (filter === 'Filled') return g.filled;
      if (filter === 'Unfilled') return !g.filled;
      return true;
    })
    .filter(g => Math.abs(g.gapPct) >= minGap);

  const gapUps = gaps.filter(g => g.gapType === 'Up').length;
  const gapDowns = gaps.filter(g => g.gapType === 'Down').length;
  const avgGap = gaps.reduce((s, g) => s + Math.abs(g.gapPct), 0) / gaps.length;
  const fillRate = (gaps.filter(g => g.filled).length / gaps.length * 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ArrowUpDown className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Gap Scanner</h1>
          <p className="text-sm text-slate-400">Scan for gap ups/downs, fill rates, and volume analysis</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Gap Ups</div>
          <div className="mt-1 text-2xl font-bold text-emerald-400">{gapUps}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Gap Downs</div>
          <div className="mt-1 text-2xl font-bold text-red-400">{gapDowns}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Avg Gap Size</div>
          <div className="mt-1 text-2xl font-bold text-white">{avgGap.toFixed(1)}%</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Fill Rate</div>
          <div className="mt-1 text-2xl font-bold text-amber-400">{fillRate.toFixed(0)}%</div>
        </div>
      </div>

      {/* Gap distribution */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Gap Distribution</h3>
        <div className="flex items-end gap-1" style={{ height: '80px' }}>
          {Array.from({ length: 15 }, (_, i) => {
            const rangeStart = -15 + i * 2;
            const rangeEnd = rangeStart + 2;
            const count = gaps.filter(g => g.gapPct >= rangeStart && g.gapPct < rangeEnd).length;
            const maxCount = 5;
            const height = Math.max(4, (count / maxCount) * 70);
            const isNeg = rangeStart < 0;
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className={cn('w-full rounded-t', isNeg ? 'bg-red-500/40' : 'bg-emerald-500/40')} style={{ height: `${height}px` }} />
                <span className="text-[7px] text-slate-600">{rangeStart > 0 ? '+' : ''}{rangeStart}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
          {(['All', 'Up', 'Down', 'Filled', 'Unfilled'] as GapFilter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('rounded-md px-2.5 py-1 text-xs font-medium', filter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>
              {f}
            </button>
          ))}
        </div>
        <select value={minGap} onChange={e => setMinGap(Number(e.target.value))}
          className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none">
          <option value={0}>All gaps</option>
          <option value={2}>2%+</option>
          <option value={5}>5%+</option>
          <option value={10}>10%+</option>
        </select>
      </div>

      {/* Gap cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.slice(0, 9).map(g => (
          <div key={g.ticker} className={cn('rounded-xl border bg-slate-800 p-4',
            g.gapType === 'Up' ? 'border-emerald-700/50' : 'border-red-700/50'
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{g.ticker}</span>
                <span className="text-[10px] text-slate-500">{g.company}</span>
              </div>
              <span className={cn('flex items-center gap-0.5 text-sm font-bold',
                g.gapType === 'Up' ? 'text-emerald-400' : 'text-red-400'
              )}>
                {g.gapType === 'Up' ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {g.gapPct > 0 ? '+' : ''}{g.gapPct}%
              </span>
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>Prev: ${g.prevClose}</span>
              <span>Open: ${g.openPrice}</span>
              <span>Now: ${g.currentPrice}</span>
            </div>
            <div className="mt-2">
              <div className="mb-1 flex justify-between text-[10px]">
                <span className="text-slate-500">Gap Fill</span>
                <span className={g.filled ? 'text-amber-400' : 'text-slate-400'}>{g.fillPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-700">
                <div className={cn('h-2 rounded-full', g.filled ? 'bg-amber-500/60' : 'bg-indigo-500/60')}
                  style={{ width: `${g.fillPct}%` }} />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Vol: {g.volumeRatio}x avg</span>
              <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[9px] text-slate-400">{g.catalyst}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Full table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Date</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Type</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Gap %</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Prev Close</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Open</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Current</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Vol Ratio</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Fill %</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Catalyst</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.map(g => (
              <tr key={g.ticker} className="bg-slate-800 hover:bg-slate-750">
                <td className="px-3 py-2 text-xs font-bold text-indigo-400">{g.ticker}</td>
                <td className="px-3 py-2 text-xs text-slate-400">{g.date}</td>
                <td className="px-3 py-2 text-center">
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium',
                    g.gapType === 'Up' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'
                  )}>Gap {g.gapType}</span>
                </td>
                <td className={cn('px-3 py-2 text-right text-xs font-bold', g.gapPct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {g.gapPct > 0 ? '+' : ''}{g.gapPct}%
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-300">${g.prevClose}</td>
                <td className="px-3 py-2 text-right text-xs text-slate-300">${g.openPrice}</td>
                <td className="px-3 py-2 text-right text-xs text-white font-medium">${g.currentPrice}</td>
                <td className={cn('px-3 py-2 text-right text-xs font-medium', g.volumeRatio >= 3 ? 'text-amber-400' : 'text-slate-300')}>
                  {g.volumeRatio}x
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-300">{g.fillPct}%</td>
                <td className="px-3 py-2 text-xs text-slate-400 max-w-[120px] truncate">{g.catalyst}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
