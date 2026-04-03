import { useState, useMemo } from 'react';
import { Moon, Sun, TrendingUp, TrendingDown, Clock, ArrowUp, ArrowDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const TICKERS = [
  { ticker: 'AAPL', name: 'Apple' }, { ticker: 'MSFT', name: 'Microsoft' },
  { ticker: 'GOOGL', name: 'Alphabet' }, { ticker: 'AMZN', name: 'Amazon' },
  { ticker: 'NVDA', name: 'NVIDIA' }, { ticker: 'META', name: 'Meta' },
  { ticker: 'TSLA', name: 'Tesla' }, { ticker: 'JPM', name: 'JPMorgan' },
  { ticker: 'V', name: 'Visa' }, { ticker: 'UNH', name: 'UnitedHealth' },
  { ticker: 'NFLX', name: 'Netflix' }, { ticker: 'AMD', name: 'AMD' },
  { ticker: 'CRM', name: 'Salesforce' }, { ticker: 'DIS', name: 'Disney' },
  { ticker: 'GS', name: 'Goldman Sachs' }, { ticker: 'BA', name: 'Boeing' },
  { ticker: 'COIN', name: 'Coinbase' }, { ticker: 'PLTR', name: 'Palantir' },
  { ticker: 'RIVN', name: 'Rivian' }, { ticker: 'SOFI', name: 'SoFi' },
  { ticker: 'NIO', name: 'NIO' }, { ticker: 'BABA', name: 'Alibaba' },
  { ticker: 'SNAP', name: 'Snap' }, { ticker: 'UBER', name: 'Uber' },
  { ticker: 'SQ', name: 'Block' }, { ticker: 'ROKU', name: 'Roku' },
  { ticker: 'SHOP', name: 'Shopify' }, { ticker: 'ABNB', name: 'Airbnb' },
  { ticker: 'HOOD', name: 'Robinhood' }, { ticker: 'DKNG', name: 'DraftKings' },
];

interface PremarketStock {
  ticker: string;
  name: string;
  prevClose: number;
  prePrice: number;
  preChange: number;
  prePct: number;
  preVolume: number;
  postPrice: number;
  postChange: number;
  postPct: number;
  postVolume: number;
  gap: number;
  catalyst: string;
}

const CATALYSTS = [
  'Earnings beat', 'Earnings miss', 'Guidance raised', 'Guidance lowered',
  'Analyst upgrade', 'Analyst downgrade', 'FDA approval', 'M&A news',
  'Sector rotation', 'Insider buying', 'Short squeeze', 'New product',
  'Macro data', 'Geopolitical', 'Dividend increase', '',
];

function genPremarket(): PremarketStock[] {
  return TICKERS.map((t, ti) => {
    const s = seed(t.ticker + '_pre');
    const prevClose = 50 + pseudo(s, 0) * 400;
    const preChange = (pseudo(s, 1) - 0.45) * prevClose * 0.08;
    const prePrice = prevClose + preChange;
    const prePct = (preChange / prevClose) * 100;
    const postChange = (pseudo(s, 2) - 0.45) * prevClose * 0.06;
    const postPrice = prevClose + postChange;
    const postPct = (postChange / prevClose) * 100;
    const preVolume = Math.floor(100000 + pseudo(s, 3) * 5000000);
    const postVolume = Math.floor(50000 + pseudo(s, 4) * 3000000);
    const gap = +((prePrice - prevClose) / prevClose * 100).toFixed(2);
    const catalyst = CATALYSTS[Math.floor(pseudo(s, 5) * CATALYSTS.length)];

    return {
      ticker: t.ticker, name: t.name, prevClose: +prevClose.toFixed(2),
      prePrice: +prePrice.toFixed(2), preChange: +preChange.toFixed(2),
      prePct: +prePct.toFixed(2), preVolume,
      postPrice: +postPrice.toFixed(2), postChange: +postChange.toFixed(2),
      postPct: +postPct.toFixed(2), postVolume, gap, catalyst,
    };
  });
}

type Session = 'premarket' | 'afterhours';
type SortKey = 'prePct' | 'postPct' | 'preVolume' | 'postVolume' | 'gap';

export function PremarketPage() {
  const [session, setSession] = useState<Session>('premarket');
  const [sortBy, setSortBy] = useState<SortKey>('prePct');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filter, setFilter] = useState<'all' | 'gainers' | 'losers'>('all');

  const allStocks = useMemo(() => genPremarket(), []);

  const filtered = useMemo(() => {
    let list = [...allStocks];
    if (filter === 'gainers') list = list.filter(s => session === 'premarket' ? s.prePct > 0 : s.postPct > 0);
    if (filter === 'losers') list = list.filter(s => session === 'premarket' ? s.prePct < 0 : s.postPct < 0);
    list.sort((a, b) => {
      const av = Math.abs(a[sortBy]);
      const bv = Math.abs(b[sortBy]);
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return list;
  }, [allStocks, filter, session, sortBy, sortDir]);

  const gainers = allStocks.filter(s => session === 'premarket' ? s.prePct > 0 : s.postPct > 0);
  const losers = allStocks.filter(s => session === 'premarket' ? s.prePct < 0 : s.postPct < 0);
  const avgGap = allStocks.reduce((s, x) => s + Math.abs(x.gap), 0) / allStocks.length;
  const totalVol = allStocks.reduce((s, x) => s + (session === 'premarket' ? x.preVolume : x.postVolume), 0);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Moon className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Pre/Post Market</h1>
          <p className="text-sm text-slate-400">Extended hours movers, gap analysis, and catalysts</p>
        </div>
      </div>

      {/* Session toggle + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
          <button onClick={() => setSession('premarket')}
            className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium', session === 'premarket' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>
            <Sun className="h-3.5 w-3.5" /> Pre-Market
          </button>
          <button onClick={() => setSession('afterhours')}
            className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium', session === 'afterhours' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>
            <Moon className="h-3.5 w-3.5" /> After-Hours
          </button>
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
          {(['all', 'gainers', 'losers'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('rounded-md px-3 py-1 text-xs font-medium capitalize', filter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Clock className="h-3.5 w-3.5" />
          {session === 'premarket' ? '4:00 AM - 9:30 AM ET' : '4:00 PM - 8:00 PM ET'}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Gainers', value: gainers.length.toString(), color: 'text-emerald-400' },
          { label: 'Losers', value: losers.length.toString(), color: 'text-red-400' },
          { label: 'Avg Gap', value: `${avgGap.toFixed(2)}%`, color: 'text-amber-400' },
          { label: 'Total Volume', value: `${(totalVol / 1e6).toFixed(1)}M`, color: 'text-white' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
            <div className={cn('mt-1 text-lg font-bold', c.color)}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Top movers cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-400">
            <ArrowUp className="h-4 w-4" /> Top Gainers
          </h3>
          <div className="space-y-2">
            {[...allStocks].sort((a, b) => (session === 'premarket' ? b.prePct - a.prePct : b.postPct - a.postPct)).slice(0, 5).map(s => {
              const pct = session === 'premarket' ? s.prePct : s.postPct;
              const price = session === 'premarket' ? s.prePrice : s.postPrice;
              return (
                <div key={s.ticker} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link to={`/company/${s.ticker}`} className="font-mono text-xs font-bold text-indigo-400 hover:underline">{s.ticker}</Link>
                    <span className="text-[10px] text-slate-500">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-300">${price}</span>
                    <span className="text-xs font-medium text-emerald-400">+{pct.toFixed(2)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-400">
            <ArrowDown className="h-4 w-4" /> Top Losers
          </h3>
          <div className="space-y-2">
            {[...allStocks].sort((a, b) => (session === 'premarket' ? a.prePct - b.prePct : a.postPct - b.postPct)).slice(0, 5).map(s => {
              const pct = session === 'premarket' ? s.prePct : s.postPct;
              const price = session === 'premarket' ? s.prePrice : s.postPrice;
              return (
                <div key={s.ticker} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link to={`/company/${s.ticker}`} className="font-mono text-xs font-bold text-indigo-400 hover:underline">{s.ticker}</Link>
                    <span className="text-[10px] text-slate-500">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-300">${price}</span>
                    <span className="text-xs font-medium text-red-400">{pct.toFixed(2)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Full table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Company</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Prev Close</th>
              <th className="px-3 py-2 text-right">
                <button onClick={() => toggleSort(session === 'premarket' ? 'prePct' : 'postPct')}
                  className={cn('text-xs font-medium', (sortBy === 'prePct' || sortBy === 'postPct') ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-300')}>
                  {session === 'premarket' ? 'Pre %' : 'AH %'} {(sortBy === 'prePct' || sortBy === 'postPct') && (sortDir === 'desc' ? '↓' : '↑')}
                </button>
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">{session === 'premarket' ? 'Pre Price' : 'AH Price'}</th>
              <th className="px-3 py-2 text-right">
                <button onClick={() => toggleSort(session === 'premarket' ? 'preVolume' : 'postVolume')}
                  className={cn('text-xs font-medium', (sortBy === 'preVolume' || sortBy === 'postVolume') ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-300')}>
                  Volume {(sortBy === 'preVolume' || sortBy === 'postVolume') && (sortDir === 'desc' ? '↓' : '↑')}
                </button>
              </th>
              <th className="px-3 py-2 text-right">
                <button onClick={() => toggleSort('gap')}
                  className={cn('text-xs font-medium', sortBy === 'gap' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-300')}>
                  Gap {sortBy === 'gap' && (sortDir === 'desc' ? '↓' : '↑')}
                </button>
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Catalyst</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.map(s => {
              const pct = session === 'premarket' ? s.prePct : s.postPct;
              const price = session === 'premarket' ? s.prePrice : s.postPrice;
              const vol = session === 'premarket' ? s.preVolume : s.postVolume;
              return (
                <tr key={s.ticker} className="bg-slate-800 hover:bg-slate-750">
                  <td className="px-3 py-2">
                    <Link to={`/company/${s.ticker}`} className="font-mono text-xs font-bold text-indigo-400 hover:underline">{s.ticker}</Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-300">{s.name}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-400">${s.prevClose}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={cn('flex items-center justify-end gap-0.5 text-xs font-medium', pct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">${price}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-400">{(vol / 1e3).toFixed(0)}K</td>
                  <td className={cn('px-3 py-2 text-right text-xs font-medium', s.gap >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {s.gap >= 0 ? '+' : ''}{s.gap}%
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{s.catalyst || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Gap distribution */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Gap Distribution</h3>
        <div className="flex items-end gap-1">
          {['-5+', '-4', '-3', '-2', '-1', '0', '+1', '+2', '+3', '+4', '+5+'].map((label, i) => {
            const low = i - 5;
            const count = allStocks.filter(s => {
              if (i === 0) return s.gap <= -5;
              if (i === 10) return s.gap >= 5;
              return s.gap >= low && s.gap < low + 1;
            }).length;
            const height = count > 0 ? Math.max(16, count * 20) : 4;
            return (
              <div key={label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-slate-400">{count}</span>
                <div className={cn('w-full rounded-t', i < 5 ? 'bg-red-500/50' : i === 5 ? 'bg-slate-600' : 'bg-emerald-500/50')}
                  style={{ height: `${height}px` }} />
                <span className="text-[9px] text-slate-500">{label}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
