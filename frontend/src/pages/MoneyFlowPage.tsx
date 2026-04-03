import { useState, useMemo } from 'react';
import { DollarSign, Search, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'JNJ', 'WMT', 'XOM', 'HD', 'PG', 'UNH', 'MA', 'AMD', 'CRM', 'NFLX', 'DIS'];

interface MoneyFlowData {
  ticker: string;
  cmf: number; // Chaikin Money Flow -1 to 1
  obv: number; // On-Balance Volume (millions)
  obvChange: number;
  adLine: number; // Accumulation/Distribution
  adChange: number;
  mfi: number; // Money Flow Index 0-100
  volumeAvg: number;
  priceChange: number;
  signal: 'Accumulation' | 'Distribution' | 'Neutral';
  smartMoney: number; // -100 to 100
  history: number[];
}

function genMoneyFlow(): MoneyFlowData[] {
  return TICKERS.map(ticker => {
    const s = seed(ticker + '_mf');
    const cmf = +((pseudo(s, 0) * 2 - 1) * 0.5).toFixed(3);
    const mfi = Math.floor(20 + pseudo(s, 1) * 60);
    const smartMoney = Math.floor((pseudo(s, 8) * 2 - 1) * 100);
    return {
      ticker,
      cmf,
      obv: +(10 + pseudo(s, 2) * 490).toFixed(1),
      obvChange: +((pseudo(s, 3) - 0.4) * 30).toFixed(2),
      adLine: +((pseudo(s, 4) - 0.5) * 200).toFixed(1),
      adChange: +((pseudo(s, 5) - 0.4) * 15).toFixed(2),
      mfi,
      volumeAvg: +(5 + pseudo(s, 6) * 95).toFixed(1),
      priceChange: +((pseudo(s, 7) - 0.4) * 10).toFixed(2),
      signal: cmf > 0.1 ? 'Accumulation' : cmf < -0.1 ? 'Distribution' : 'Neutral',
      smartMoney,
      history: Array.from({ length: 20 }, (_, i) => +((pseudo(s, 20 + i) * 2 - 1) * 0.5).toFixed(3)),
    };
  }).sort((a, b) => b.cmf - a.cmf);
}

function MiniCMFChart({ data }: { data: number[] }) {
  const h = 24;
  const w = 64;
  const max = Math.max(...data.map(Math.abs), 0.01);
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h / 2 - (v / max) * (h / 2)}`).join(' ');
  return (
    <svg width={w} height={h} className="inline-block">
      <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="#334155" strokeWidth="0.5" />
      <polyline points={points} fill="none" stroke="#818cf8" strokeWidth="1.5" />
    </svg>
  );
}

export function MoneyFlowPage() {
  const [search, setSearch] = useState('');
  const [signalFilter, setSignalFilter] = useState<'All' | 'Accumulation' | 'Distribution' | 'Neutral'>('All');

  const data = useMemo(() => genMoneyFlow(), []);

  const filtered = data
    .filter(d => !search || d.ticker.includes(search.toUpperCase()))
    .filter(d => signalFilter === 'All' || d.signal === signalFilter);

  const accum = data.filter(d => d.signal === 'Accumulation').length;
  const dist = data.filter(d => d.signal === 'Distribution').length;
  const avgCMF = data.reduce((s, d) => s + d.cmf, 0) / data.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DollarSign className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Money Flow</h1>
          <p className="text-sm text-slate-400">Chaikin Money Flow, OBV, and accumulation/distribution signals</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Accumulation</div>
          <div className="mt-1 text-2xl font-bold text-emerald-400">{accum}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Distribution</div>
          <div className="mt-1 text-2xl font-bold text-red-400">{dist}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Avg CMF</div>
          <div className={cn('mt-1 text-2xl font-bold', avgCMF >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {avgCMF >= 0 ? '+' : ''}{avgCMF.toFixed(3)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Market Breadth</div>
          <div className={cn('mt-1 text-2xl font-bold', accum > dist ? 'text-emerald-400' : 'text-red-400')}>
            {accum > dist ? 'Bullish' : accum < dist ? 'Bearish' : 'Neutral'}
          </div>
        </div>
      </div>

      {/* Signal distribution */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">CMF Distribution</h3>
        <div className="space-y-2">
          {filtered.map(d => (
            <div key={d.ticker} className="flex items-center gap-2">
              <span className="w-12 text-xs font-mono text-indigo-400">{d.ticker}</span>
              <div className="flex-1 flex items-center">
                {d.cmf >= 0 ? (
                  <div className="flex w-full">
                    <div className="w-1/2" />
                    <div className="w-1/2">
                      <div className="h-4 rounded-r bg-emerald-500/40" style={{ width: `${Math.abs(d.cmf) / 0.5 * 100}%` }} />
                    </div>
                  </div>
                ) : (
                  <div className="flex w-full">
                    <div className="flex w-1/2 justify-end">
                      <div className="h-4 rounded-l bg-red-500/40" style={{ width: `${Math.abs(d.cmf) / 0.5 * 100}%` }} />
                    </div>
                    <div className="w-1/2" />
                  </div>
                )}
              </div>
              <span className={cn('w-14 text-right text-xs font-medium', d.cmf >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {d.cmf >= 0 ? '+' : ''}{d.cmf}
              </span>
            </div>
          ))}
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
          {(['All', 'Accumulation', 'Distribution', 'Neutral'] as const).map(f => (
            <button key={f} onClick={() => setSignalFilter(f)}
              className={cn('rounded-md px-2.5 py-1 text-xs font-medium', signalFilter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Full table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">CMF</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Signal</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">MFI</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">OBV (M)</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">OBV Chg</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">A/D Line</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Smart $</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Price</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">CMF History</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.map(d => (
              <tr key={d.ticker} className="bg-slate-800 hover:bg-slate-750">
                <td className="px-3 py-2 text-xs font-bold text-indigo-400">{d.ticker}</td>
                <td className={cn('px-3 py-2 text-right text-xs font-medium', d.cmf >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {d.cmf >= 0 ? '+' : ''}{d.cmf}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium',
                    d.signal === 'Accumulation' ? 'bg-emerald-900/40 text-emerald-400' :
                    d.signal === 'Distribution' ? 'bg-red-900/40 text-red-400' :
                    'bg-slate-700 text-slate-300'
                  )}>{d.signal}</span>
                </td>
                <td className={cn('px-3 py-2 text-right text-xs', d.mfi > 80 ? 'text-red-400' : d.mfi < 20 ? 'text-emerald-400' : 'text-slate-300')}>
                  {d.mfi}
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-300">{d.obv}M</td>
                <td className={cn('px-3 py-2 text-right text-xs font-medium', d.obvChange >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {d.obvChange >= 0 ? '+' : ''}{d.obvChange}%
                </td>
                <td className={cn('px-3 py-2 text-right text-xs', d.adChange >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {d.adLine}
                </td>
                <td className={cn('px-3 py-2 text-right text-xs font-medium', d.smartMoney >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {d.smartMoney >= 0 ? '+' : ''}{d.smartMoney}
                </td>
                <td className={cn('px-3 py-2 text-right text-xs font-medium', d.priceChange >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {d.priceChange >= 0 ? '+' : ''}{d.priceChange}%
                </td>
                <td className="px-3 py-2 text-center"><MiniCMFChart data={d.history} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
