import { useState, useMemo } from 'react';
import { Zap, TrendingUp, TrendingDown, AlertTriangle, Filter } from 'lucide-react';
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

const TICKERS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'AMZN', 'GOOGL', 'AMD', 'SPY', 'QQQ', 'IWM', 'COIN', 'PLTR', 'NFLX', 'BA', 'JPM', 'GS', 'XOM', 'BABA', 'NIO'];

interface FlowEntry {
  id: number;
  time: string;
  ticker: string;
  type: 'Call' | 'Put';
  strike: number;
  expiry: string;
  premium: number;
  size: number;
  openInterest: number;
  volume: number;
  side: 'Ask' | 'Bid' | 'Mid';
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  unusual: boolean;
  sweep: boolean;
  delta: number;
  iv: number;
}

function genFlows(): FlowEntry[] {
  return Array.from({ length: 60 }, (_, i) => {
    const s = seed('flow_' + i);
    const ticker = TICKERS[Math.floor(pseudo(s, 0) * TICKERS.length)];
    const isCall = pseudo(s, 1) > 0.45;
    const basePrice = 50 + pseudo(s, 2) * 400;
    const strike = Math.round((basePrice * (0.85 + pseudo(s, 3) * 0.3)) / 5) * 5;
    const daysOut = Math.floor(7 + pseudo(s, 4) * 180);
    const expDate = new Date(2025, 3, 1 + daysOut);
    const premium = Math.floor(10000 + pseudo(s, 5) * 2000000);
    const size = Math.floor(10 + pseudo(s, 6) * 5000);
    const oi = Math.floor(100 + pseudo(s, 7) * 50000);
    const vol = Math.floor(size + pseudo(s, 8) * 10000);
    const sideR = pseudo(s, 9);
    const side = sideR > 0.6 ? 'Ask' : sideR > 0.3 ? 'Bid' : 'Mid';
    const sentiment = isCall ? (side === 'Ask' ? 'Bullish' : side === 'Bid' ? 'Bearish' : 'Neutral')
      : (side === 'Ask' ? 'Bearish' : side === 'Bid' ? 'Bullish' : 'Neutral');
    const unusual = premium > 500000 || size > 2000;
    const sweep = pseudo(s, 10) > 0.7;
    const delta = isCall ? +(0.1 + pseudo(s, 11) * 0.8).toFixed(2) : -(0.1 + pseudo(s, 12) * 0.8).toFixed(2);
    const iv = +(20 + pseudo(s, 13) * 60).toFixed(1);
    const hour = 9 + Math.floor(pseudo(s, 14) * 7);
    const min = Math.floor(pseudo(s, 15) * 60);

    return {
      id: i, time: `${hour}:${String(min).padStart(2, '0')}`,
      ticker, type: isCall ? 'Call' : 'Put', strike, expiry: expDate.toISOString().slice(0, 10),
      premium, size, openInterest: oi, volume: vol, side: side as FlowEntry['side'],
      sentiment: sentiment as FlowEntry['sentiment'], unusual, sweep,
      delta: +delta, iv,
    };
  }).sort((a, b) => b.premium - a.premium);
}

type FilterType = 'all' | 'calls' | 'puts' | 'unusual' | 'sweeps';

export function OptionsFlowPage() {
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [minPremium, setMinPremium] = useState(0);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const allFlows = useMemo(() => genFlows(), []);

  const filtered = useMemo(() => {
    let list = [...allFlows];
    if (filterType === 'calls') list = list.filter(f => f.type === 'Call');
    if (filterType === 'puts') list = list.filter(f => f.type === 'Put');
    if (filterType === 'unusual') list = list.filter(f => f.unusual);
    if (filterType === 'sweeps') list = list.filter(f => f.sweep);
    if (minPremium > 0) list = list.filter(f => f.premium >= minPremium * 1000);
    if (selectedTicker) list = list.filter(f => f.ticker === selectedTicker);
    return list;
  }, [allFlows, filterType, minPremium, selectedTicker]);

  const totalPremium = filtered.reduce((s, f) => s + f.premium, 0);
  const callPremium = filtered.filter(f => f.type === 'Call').reduce((s, f) => s + f.premium, 0);
  const putPremium = filtered.filter(f => f.type === 'Put').reduce((s, f) => s + f.premium, 0);
  const bullishCount = filtered.filter(f => f.sentiment === 'Bullish').length;
  const bearishCount = filtered.filter(f => f.sentiment === 'Bearish').length;
  const unusualCount = filtered.filter(f => f.unusual).length;

  // Top tickers by premium
  const tickerAgg = useMemo(() => {
    const map = new Map<string, { premium: number; calls: number; puts: number }>();
    allFlows.forEach(f => {
      const cur = map.get(f.ticker) || { premium: 0, calls: 0, puts: 0 };
      cur.premium += f.premium;
      if (f.type === 'Call') cur.calls++; else cur.puts++;
      map.set(f.ticker, cur);
    });
    return [...map.entries()].sort((a, b) => b[1].premium - a[1].premium).slice(0, 10);
  }, [allFlows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Zap className="h-6 w-6 text-amber-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Options Flow</h1>
          <p className="text-sm text-slate-400">Unusual options activity, block trades, and smart money signals</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
          {(['all', 'calls', 'puts', 'unusual', 'sweeps'] as const).map(f => (
            <button key={f} onClick={() => setFilterType(f)}
              className={cn('rounded-md px-3 py-1 text-xs font-medium capitalize', filterType === f ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white')}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-slate-500" />
          <select value={minPremium} onChange={e => setMinPremium(+e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white">
            <option value={0}>All Premiums</option>
            <option value={50}>$50K+</option>
            <option value={100}>$100K+</option>
            <option value={250}>$250K+</option>
            <option value={500}>$500K+</option>
            <option value={1000}>$1M+</option>
          </select>
        </div>
        {selectedTicker && (
          <button onClick={() => setSelectedTicker(null)}
            className="flex items-center gap-1 rounded-lg border border-amber-600 bg-amber-600/20 px-2 py-1 text-xs text-amber-400">
            {selectedTicker} ✕
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Total Premium', value: `$${(totalPremium / 1e6).toFixed(1)}M`, color: 'text-white' },
          { label: 'Call Premium', value: `$${(callPremium / 1e6).toFixed(1)}M`, color: 'text-emerald-400' },
          { label: 'Put Premium', value: `$${(putPremium / 1e6).toFixed(1)}M`, color: 'text-red-400' },
          { label: 'Bullish Flows', value: bullishCount.toString(), color: 'text-emerald-400' },
          { label: 'Bearish Flows', value: bearishCount.toString(), color: 'text-red-400' },
          { label: 'Unusual', value: unusualCount.toString(), color: 'text-amber-400' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
            <div className={cn('mt-1 text-lg font-bold', c.color)}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Call/Put ratio bar */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-2 text-sm font-semibold text-white">Call vs Put Premium</h3>
        <div className="flex h-6 overflow-hidden rounded-full">
          <div className="bg-emerald-500/60 transition-all" style={{ width: `${totalPremium > 0 ? (callPremium / totalPremium) * 100 : 50}%` }} />
          <div className="bg-red-500/60 transition-all" style={{ width: `${totalPremium > 0 ? (putPremium / totalPremium) * 100 : 50}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs">
          <span className="text-emerald-400">Calls {totalPremium > 0 ? ((callPremium / totalPremium) * 100).toFixed(0) : 50}%</span>
          <span className="text-red-400">Puts {totalPremium > 0 ? ((putPremium / totalPremium) * 100).toFixed(0) : 50}%</span>
        </div>
      </div>

      {/* Top tickers by premium */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">Top Tickers by Premium</h3>
          <div className="space-y-2">
            {tickerAgg.map(([ticker, data]) => {
              const pct = totalPremium > 0 ? (data.premium / allFlows.reduce((s, f) => s + f.premium, 0)) * 100 : 0;
              return (
                <button key={ticker} onClick={() => setSelectedTicker(ticker === selectedTicker ? null : ticker)}
                  className={cn('flex w-full items-center gap-3 rounded-lg p-2 text-left', selectedTicker === ticker ? 'bg-amber-600/20 border border-amber-600/40' : 'hover:bg-slate-750')}>
                  <span className="font-mono text-xs font-bold text-amber-400 w-12">{ticker}</span>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-slate-700">
                      <div className="h-2 rounded-full bg-amber-500/50" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-slate-300">${(data.premium / 1e6).toFixed(1)}M</span>
                  <span className="text-[10px] text-slate-500">{data.calls}C/{data.puts}P</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">Sentiment Breakdown</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-emerald-400">Bullish</span>
                <span className="text-emerald-400">{bullishCount}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-700">
                <div className="h-3 rounded-full bg-emerald-500/60" style={{ width: `${filtered.length > 0 ? (bullishCount / filtered.length) * 100 : 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-red-400">Bearish</span>
                <span className="text-red-400">{bearishCount}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-700">
                <div className="h-3 rounded-full bg-red-500/60" style={{ width: `${filtered.length > 0 ? (bearishCount / filtered.length) * 100 : 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Neutral</span>
                <span className="text-slate-400">{filtered.length - bullishCount - bearishCount}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-700">
                <div className="h-3 rounded-full bg-slate-500/60" style={{ width: `${filtered.length > 0 ? ((filtered.length - bullishCount - bearishCount) / filtered.length) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <AlertTriangle className="h-3 w-3" />
            {bullishCount > bearishCount ? 'Net bullish flow detected' : 'Net bearish flow detected'}
          </div>
        </div>
      </div>

      {/* Flow table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-slate-400">Time</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-slate-400">Type</th>
              <th className="px-2 py-2 text-right text-xs font-medium text-slate-400">Strike</th>
              <th className="px-2 py-2 text-right text-xs font-medium text-slate-400">Expiry</th>
              <th className="px-2 py-2 text-right text-xs font-medium text-slate-400">Premium</th>
              <th className="px-2 py-2 text-right text-xs font-medium text-slate-400">Size</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-slate-400">Side</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-slate-400">Signal</th>
              <th className="px-2 py-2 text-right text-xs font-medium text-slate-400">IV</th>
              <th className="px-2 py-2 text-right text-xs font-medium text-slate-400">Delta</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-slate-400">Tags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.slice(0, 40).map(f => (
              <tr key={f.id} className={cn('hover:bg-slate-750', f.unusual ? 'bg-amber-500/5' : 'bg-slate-800')}>
                <td className="px-2 py-1.5 text-xs text-slate-500">{f.time}</td>
                <td className="px-2 py-1.5">
                  <Link to={`/company/${f.ticker}`} className="font-mono text-xs font-bold text-amber-400 hover:underline">{f.ticker}</Link>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', f.type === 'Call' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400')}>
                    {f.type}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right text-xs text-slate-300">${f.strike}</td>
                <td className="px-2 py-1.5 text-right text-xs text-slate-400">{f.expiry}</td>
                <td className="px-2 py-1.5 text-right text-xs font-medium text-white">${f.premium >= 1e6 ? `${(f.premium / 1e6).toFixed(1)}M` : `${(f.premium / 1e3).toFixed(0)}K`}</td>
                <td className="px-2 py-1.5 text-right text-xs text-slate-300">{f.size.toLocaleString()}</td>
                <td className="px-2 py-1.5 text-center">
                  <span className={cn('text-[10px] font-medium', f.side === 'Ask' ? 'text-emerald-400' : f.side === 'Bid' ? 'text-red-400' : 'text-slate-400')}>
                    {f.side}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <span className={cn('flex items-center justify-center gap-0.5 text-[10px] font-bold',
                    f.sentiment === 'Bullish' ? 'text-emerald-400' : f.sentiment === 'Bearish' ? 'text-red-400' : 'text-slate-400')}>
                    {f.sentiment === 'Bullish' ? <TrendingUp className="h-3 w-3" /> : f.sentiment === 'Bearish' ? <TrendingDown className="h-3 w-3" /> : null}
                    {f.sentiment}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right text-xs text-slate-400">{f.iv}%</td>
                <td className="px-2 py-1.5 text-right text-xs text-slate-400">{f.delta}</td>
                <td className="px-2 py-1.5 text-center">
                  <div className="flex justify-center gap-1">
                    {f.unusual && <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-bold text-amber-400">UOA</span>}
                    {f.sweep && <span className="rounded bg-purple-500/20 px-1 py-0.5 text-[9px] font-bold text-purple-400">SWEEP</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
