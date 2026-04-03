import { useState, useMemo } from 'react';
import { BarChart3, Search } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const TICKERS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META'];

interface PriceLevel {
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  isPOC: boolean;
  isVAH: boolean;
  isVAL: boolean;
}

interface ProfileData {
  ticker: string;
  currentPrice: number;
  vwap: number;
  poc: number;
  vah: number;
  val: number;
  totalVolume: number;
  buyPct: number;
  levels: PriceLevel[];
  sessions: { time: string; high: number; low: number; volume: number; vwap: number }[];
  distribution: 'Normal' | 'P-Shape' | 'b-Shape' | 'D-Shape' | 'Bimodal';
}

function genProfile(ticker: string): ProfileData {
  const s = seed(ticker + '_profile');
  const basePrice = 100 + pseudo(s, 0) * 400;
  const range = basePrice * 0.03;
  const low = basePrice - range;
  const numLevels = 30;
  const step = (range * 2) / numLevels;

  // Generate volume at each price level (bell curve centered at POC)
  const pocIdx = Math.floor(numLevels * (0.4 + pseudo(s, 1) * 0.2));
  const maxVol = 5000000 + pseudo(s, 2) * 20000000;

  const levels: PriceLevel[] = Array.from({ length: numLevels }, (_, i) => {
    const price = +(low + i * step).toFixed(2);
    const dist = Math.abs(i - pocIdx) / numLevels;
    const volume = Math.floor(maxVol * Math.exp(-dist * dist * 8) * (0.5 + pseudo(s, 10 + i) * 0.5));
    const buyPct = 0.3 + pseudo(s, 40 + i) * 0.4;
    return {
      price, volume,
      buyVolume: Math.floor(volume * buyPct),
      sellVolume: Math.floor(volume * (1 - buyPct)),
      isPOC: i === pocIdx,
      isVAH: false, isVAL: false,
    };
  });

  // Calculate value area (70% of volume)
  const totalVol = levels.reduce((s, l) => s + l.volume, 0);
  const vaTarget = totalVol * 0.7;
  let vaSum = levels[pocIdx].volume;
  let upper = pocIdx;
  let lower = pocIdx;
  while (vaSum < vaTarget) {
    const upVol = upper + 1 < numLevels ? levels[upper + 1].volume : 0;
    const downVol = lower - 1 >= 0 ? levels[lower - 1].volume : 0;
    if (upVol >= downVol && upper + 1 < numLevels) { upper++; vaSum += levels[upper].volume; }
    else if (lower - 1 >= 0) { lower--; vaSum += levels[lower].volume; }
    else break;
  }
  levels[upper].isVAH = true;
  levels[lower].isVAL = true;

  const poc = levels[pocIdx].price;
  const vah = levels[upper].price;
  const val = levels[lower].price;
  const currentPrice = +(poc + (pseudo(s, 3) - 0.5) * range).toFixed(2);
  const vwap = +(poc + (pseudo(s, 4) - 0.5) * range * 0.3).toFixed(2);
  const buyPct = levels.reduce((s, l) => s + l.buyVolume, 0) / totalVol * 100;

  const distR = pseudo(s, 5);
  const distribution = distR > 0.8 ? 'Bimodal' : distR > 0.6 ? 'P-Shape' : distR > 0.4 ? 'b-Shape' : distR > 0.2 ? 'D-Shape' : 'Normal';

  const sessions = Array.from({ length: 7 }, (_, i) => {
    const ds = seed(ticker + '_sess' + i);
    return {
      time: `${9 + i}:30`,
      high: +(poc + pseudo(ds, 0) * range).toFixed(2),
      low: +(poc - pseudo(ds, 1) * range).toFixed(2),
      volume: Math.floor(totalVol / 7 * (0.5 + pseudo(ds, 2))),
      vwap: +(vwap + (pseudo(ds, 3) - 0.5) * 2).toFixed(2),
    };
  });

  return { ticker, currentPrice, vwap, poc, vah, val, totalVolume: totalVol, buyPct: +buyPct.toFixed(1), levels, sessions, distribution };
}

export function MarketProfilePage() {
  const [selectedTicker, setSelectedTicker] = useState('SPY');
  const [tickerInput, setTickerInput] = useState('');

  const data = useMemo(() => genProfile(selectedTicker), [selectedTicker]);
  const selectTicker = (t: string) => { setSelectedTicker(t.toUpperCase()); setTickerInput(''); };
  const maxVolume = Math.max(...data.levels.map(l => l.volume));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-purple-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Market Profile</h1>
          <p className="text-sm text-slate-400">Volume profile, VWAP, value area, and price distribution</p>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input value={tickerInput} onChange={e => setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter' && tickerInput) selectTicker(tickerInput); }}
            placeholder="Ticker..." className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-purple-500 focus:outline-none" />
        </div>
        {TICKERS.map(t => (
          <button key={t} onClick={() => selectTicker(t)}
            className={cn('rounded-lg px-2.5 py-1 text-xs font-medium', selectedTicker === t ? 'bg-purple-600 text-white' : 'border border-slate-700 text-slate-400 hover:text-white')}>
            {t}
          </button>
        ))}
      </div>

      {/* Key levels */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Current Price', value: `$${data.currentPrice}`, color: 'text-white' },
          { label: 'VWAP', value: `$${data.vwap}`, color: data.currentPrice > data.vwap ? 'text-emerald-400' : 'text-red-400' },
          { label: 'POC', value: `$${data.poc}`, color: 'text-purple-400' },
          { label: 'VAH', value: `$${data.vah}`, color: 'text-amber-400' },
          { label: 'VAL', value: `$${data.val}`, color: 'text-amber-400' },
          { label: 'Distribution', value: data.distribution, color: 'text-slate-300' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
            <div className={cn('mt-1 text-lg font-bold', c.color)}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Volume Profile visualization */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Volume Profile</h3>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Buys</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Sells</span>
            <span className="flex items-center gap-1"><span className="h-2 w-6 bg-purple-500/30" /> POC</span>
            <span className="flex items-center gap-1"><span className="h-2 w-6 bg-amber-500/20" /> Value Area</span>
          </div>
        </div>
        <div className="space-y-0.5">
          {[...data.levels].reverse().map((level) => {
            const width = maxVolume > 0 ? (level.volume / maxVolume) * 100 : 0;
            const buyWidth = level.volume > 0 ? (level.buyVolume / level.volume) * width : 0;
            const sellWidth = width - buyWidth;
            const isInVA = level.price >= data.val && level.price <= data.vah;
            const isCurrentPrice = Math.abs(level.price - data.currentPrice) < (data.levels[1]?.price - data.levels[0]?.price || 1);

            return (
              <div key={level.price} className={cn('flex items-center gap-2', level.isPOC ? 'bg-purple-500/10' : isInVA ? 'bg-amber-500/5' : '')}>
                <span className={cn('w-16 text-right text-[10px] font-mono', level.isPOC ? 'text-purple-400 font-bold' : level.isVAH || level.isVAL ? 'text-amber-400' : isCurrentPrice ? 'text-white font-bold' : 'text-slate-500')}>
                  ${level.price.toFixed(2)}
                  {level.isPOC && ' POC'}
                  {level.isVAH && ' VAH'}
                  {level.isVAL && ' VAL'}
                </span>
                {isCurrentPrice && <span className="text-[8px] text-white">&#9654;</span>}
                <div className="flex flex-1 gap-0">
                  <div className="bg-emerald-500/50 rounded-l" style={{ width: `${buyWidth}%`, height: '12px' }} />
                  <div className="bg-red-500/50 rounded-r" style={{ width: `${sellWidth}%`, height: '12px' }} />
                </div>
                <span className="w-14 text-right text-[9px] text-slate-600">{(level.volume / 1e6).toFixed(1)}M</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Volume stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h3 className="mb-2 text-sm font-semibold text-white">Buy vs Sell Volume</h3>
          <div className="flex h-6 overflow-hidden rounded-full">
            <div className="bg-emerald-500/60" style={{ width: `${data.buyPct}%` }} />
            <div className="bg-red-500/60" style={{ width: `${100 - data.buyPct}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs">
            <span className="text-emerald-400">Buy {data.buyPct}%</span>
            <span className="text-red-400">Sell {(100 - data.buyPct).toFixed(1)}%</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h3 className="mb-2 text-sm font-semibold text-white">Position vs Key Levels</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Price vs VWAP</span>
              <span className={cn('font-medium', data.currentPrice > data.vwap ? 'text-emerald-400' : 'text-red-400')}>
                {data.currentPrice > data.vwap ? 'Above' : 'Below'} ({((data.currentPrice - data.vwap) / data.vwap * 100).toFixed(2)}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Price vs POC</span>
              <span className={cn('font-medium', data.currentPrice > data.poc ? 'text-emerald-400' : 'text-red-400')}>
                {data.currentPrice > data.poc ? 'Above' : 'Below'} ({((data.currentPrice - data.poc) / data.poc * 100).toFixed(2)}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">In Value Area</span>
              <span className={cn('font-medium', data.currentPrice >= data.val && data.currentPrice <= data.vah ? 'text-emerald-400' : 'text-amber-400')}>
                {data.currentPrice >= data.val && data.currentPrice <= data.vah ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Session data */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Session Breakdown</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Time</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">High</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Low</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Range</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Volume</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">VWAP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {data.sessions.map(s => (
                <tr key={s.time} className="bg-slate-800 hover:bg-slate-750">
                  <td className="px-3 py-2 text-xs text-slate-400">{s.time}</td>
                  <td className="px-3 py-2 text-right text-xs text-emerald-400">${s.high}</td>
                  <td className="px-3 py-2 text-right text-xs text-red-400">${s.low}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">${(s.high - s.low).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">{(s.volume / 1e6).toFixed(1)}M</td>
                  <td className="px-3 py-2 text-right text-xs text-purple-400">${s.vwap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
