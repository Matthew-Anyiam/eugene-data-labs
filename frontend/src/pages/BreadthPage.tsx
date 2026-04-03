import { useState, useMemo } from 'react';
import { Activity, TrendingUp, TrendingDown, ArrowUp, ArrowDown, BarChart3 } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const EXCHANGES = ['NYSE', 'NASDAQ', 'All'] as const;
const PERIODS = ['1D', '1W', '1M', '3M'] as const;

interface BreadthData {
  advancing: number;
  declining: number;
  unchanged: number;
  newHighs: number;
  newLows: number;
  advVolume: number;
  decVolume: number;
  mcClellan: number;
  mcClellanSum: number;
  adLine: number;
  adLineChange: number;
  aboveMA200: number;
  aboveMA50: number;
  bullishPct: number;
  arms: number; // TRIN
  upDownVolRatio: number;
  daily: { date: string; adv: number; dec: number; nh: number; nl: number; mcOsc: number }[];
}

function genBreadth(exchange: string, period: string): BreadthData {
  const s = seed(exchange + period + '_breadth');
  const total = exchange === 'NYSE' ? 3200 : exchange === 'NASDAQ' ? 3500 : 6700;
  const advPct = 0.35 + pseudo(s, 0) * 0.3;
  const advancing = Math.floor(total * advPct);
  const decPct = 0.3 + pseudo(s, 1) * 0.3;
  const declining = Math.floor(total * decPct);
  const unchanged = total - advancing - declining;

  const newHighs = Math.floor(20 + pseudo(s, 2) * 200);
  const newLows = Math.floor(10 + pseudo(s, 3) * 80);
  const advVolume = 1.5 + pseudo(s, 4) * 4;
  const decVolume = 1 + pseudo(s, 5) * 3.5;

  const mcClellan = -50 + pseudo(s, 6) * 100;
  const mcClellanSum = -200 + pseudo(s, 7) * 600;
  const adLine = 5000 + pseudo(s, 8) * 10000;
  const adLineChange = (pseudo(s, 9) - 0.4) * 500;

  const aboveMA200 = 30 + pseudo(s, 10) * 50;
  const aboveMA50 = 25 + pseudo(s, 11) * 55;
  const bullishPct = 30 + pseudo(s, 12) * 50;
  const arms = 0.5 + pseudo(s, 13) * 1.5;
  const upDownVolRatio = advVolume / decVolume;

  const daily = Array.from({ length: 20 }, (_, i) => {
    const ds = seed(exchange + period + '_d' + i);
    const d = new Date(2025, 2, 20 - i);
    return {
      date: d.toISOString().slice(0, 10),
      adv: Math.floor(total * (0.3 + pseudo(ds, 0) * 0.4)),
      dec: Math.floor(total * (0.25 + pseudo(ds, 1) * 0.4)),
      nh: Math.floor(10 + pseudo(ds, 2) * 250),
      nl: Math.floor(5 + pseudo(ds, 3) * 100),
      mcOsc: -60 + pseudo(ds, 4) * 120,
    };
  });

  return {
    advancing, declining, unchanged, newHighs, newLows,
    advVolume: +advVolume.toFixed(2), decVolume: +decVolume.toFixed(2),
    mcClellan: +mcClellan.toFixed(1), mcClellanSum: +mcClellanSum.toFixed(0),
    adLine: +adLine.toFixed(0), adLineChange: +adLineChange.toFixed(0),
    aboveMA200: +aboveMA200.toFixed(1), aboveMA50: +aboveMA50.toFixed(1),
    bullishPct: +bullishPct.toFixed(1), arms: +arms.toFixed(2),
    upDownVolRatio: +upDownVolRatio.toFixed(2), daily,
  };
}

const SECTOR_BREADTH = [
  'Technology', 'Healthcare', 'Financials', 'Energy', 'Consumer Disc.',
  'Industrials', 'Comm. Services', 'Consumer Staples', 'Materials', 'Utilities', 'Real Estate',
];

export function BreadthPage() {
  const [exchange, setExchange] = useState<typeof EXCHANGES[number]>('All');
  const [period, setPeriod] = useState<typeof PERIODS[number]>('1D');

  const data = useMemo(() => genBreadth(exchange, period), [exchange, period]);

  const sectorData = useMemo(() => SECTOR_BREADTH.map((sector, i) => {
    const s = seed(sector + exchange + '_sb');
    return {
      sector,
      advPct: +(30 + pseudo(s, i) * 50).toFixed(1),
      aboveMA50: +(20 + pseudo(s, i + 11) * 60).toFixed(1),
      nh: Math.floor(pseudo(s, i + 22) * 40),
      nl: Math.floor(pseudo(s, i + 33) * 20),
    };
  }), [exchange]);

  const adRatio = data.advancing / (data.advancing + data.declining);
  const isPositive = data.advancing > data.declining;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-cyan-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Market Breadth</h1>
          <p className="text-sm text-slate-400">Advance/decline, new highs/lows, McClellan oscillator</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
          {EXCHANGES.map(e => (
            <button key={e} onClick={() => setExchange(e)}
              className={cn('rounded-md px-3 py-1 text-xs font-medium', exchange === e ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white')}>
              {e}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={cn('rounded-md px-3 py-1 text-xs font-medium', period === p ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white')}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {[
          { label: 'Advancing', value: data.advancing.toLocaleString(), color: 'text-emerald-400' },
          { label: 'Declining', value: data.declining.toLocaleString(), color: 'text-red-400' },
          { label: 'Unchanged', value: data.unchanged.toLocaleString(), color: 'text-slate-300' },
          { label: 'New Highs', value: data.newHighs.toString(), color: 'text-emerald-400' },
          { label: 'New Lows', value: data.newLows.toString(), color: 'text-red-400' },
          { label: 'TRIN (Arms)', value: data.arms.toString(), color: data.arms < 1 ? 'text-emerald-400' : 'text-red-400' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
            <div className={cn('mt-1 text-lg font-bold', c.color)}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Advance/Decline visual */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">Advance / Decline Ratio</h3>
          <div className="flex items-center gap-3">
            <div className="flex h-8 flex-1 overflow-hidden rounded-full">
              <div className="bg-emerald-500/70 transition-all" style={{ width: `${adRatio * 100}%` }} />
              <div className="bg-red-500/70 transition-all" style={{ width: `${(1 - adRatio) * 100}%` }} />
            </div>
            <span className={cn('text-sm font-bold', isPositive ? 'text-emerald-400' : 'text-red-400')}>
              {(adRatio * 100).toFixed(0)}%
            </span>
          </div>
          <div className="mt-2 flex justify-between text-xs">
            <span className="text-emerald-400">{data.advancing} advancing</span>
            <span className="text-red-400">{data.declining} declining</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">Up/Down Volume</h3>
          <div className="flex items-center gap-3">
            <div className="flex h-8 flex-1 overflow-hidden rounded-full">
              <div className="bg-emerald-500/70 transition-all" style={{ width: `${(data.advVolume / (data.advVolume + data.decVolume)) * 100}%` }} />
              <div className="bg-red-500/70 transition-all" style={{ width: `${(data.decVolume / (data.advVolume + data.decVolume)) * 100}%` }} />
            </div>
            <span className={cn('text-sm font-bold', data.upDownVolRatio > 1 ? 'text-emerald-400' : 'text-red-400')}>
              {data.upDownVolRatio.toFixed(2)}x
            </span>
          </div>
          <div className="mt-2 flex justify-between text-xs">
            <span className="text-emerald-400">{data.advVolume}B up vol</span>
            <span className="text-red-400">{data.decVolume}B down vol</span>
          </div>
        </div>
      </div>

      {/* Key indicators */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">McClellan Oscillator</div>
          <div className={cn('mt-2 text-2xl font-bold', data.mcClellan >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {data.mcClellan >= 0 ? '+' : ''}{data.mcClellan}
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-700">
            <div className={cn('h-2 rounded-full', data.mcClellan >= 0 ? 'bg-emerald-500' : 'bg-red-500')}
              style={{ width: `${Math.min(100, Math.abs(data.mcClellan))}%`, marginLeft: data.mcClellan < 0 ? `${100 - Math.min(100, Math.abs(data.mcClellan))}%` : '0' }} />
          </div>
          <div className="mt-1 text-[10px] text-slate-500">Summation: {data.mcClellanSum}</div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">A/D Line</div>
          <div className="mt-2 text-2xl font-bold text-white">{data.adLine.toLocaleString()}</div>
          <div className={cn('mt-1 flex items-center gap-1 text-xs font-medium', data.adLineChange >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {data.adLineChange >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {data.adLineChange >= 0 ? '+' : ''}{data.adLineChange}
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">% Above 200 DMA</div>
          <div className={cn('mt-2 text-2xl font-bold', data.aboveMA200 > 50 ? 'text-emerald-400' : 'text-red-400')}>
            {data.aboveMA200}%
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-700">
            <div className={cn('h-2 rounded-full', data.aboveMA200 > 50 ? 'bg-emerald-500' : 'bg-red-500')} style={{ width: `${data.aboveMA200}%` }} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">% Above 50 DMA</div>
          <div className={cn('mt-2 text-2xl font-bold', data.aboveMA50 > 50 ? 'text-emerald-400' : 'text-red-400')}>
            {data.aboveMA50}%
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-700">
            <div className={cn('h-2 rounded-full', data.aboveMA50 > 50 ? 'bg-emerald-500' : 'bg-red-500')} style={{ width: `${data.aboveMA50}%` }} />
          </div>
        </div>
      </div>

      {/* Bullish % */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-2 text-sm font-semibold text-white">Bullish Percent Index</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex h-6 overflow-hidden rounded-full bg-slate-700">
              <div className={cn('transition-all', data.bullishPct > 60 ? 'bg-emerald-500/70' : data.bullishPct > 40 ? 'bg-amber-500/70' : 'bg-red-500/70')}
                style={{ width: `${data.bullishPct}%` }} />
            </div>
          </div>
          <span className={cn('text-lg font-bold', data.bullishPct > 60 ? 'text-emerald-400' : data.bullishPct > 40 ? 'text-amber-400' : 'text-red-400')}>
            {data.bullishPct}%
          </span>
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-slate-500">
          <span>0% — Oversold</span>
          <span>50% — Neutral</span>
          <span>100% — Overbought</span>
        </div>
      </div>

      {/* Daily history */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Daily Breadth History</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Date</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Advancing</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Declining</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">A/D Ratio</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">New Highs</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">New Lows</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">McClellan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {data.daily.map(d => {
                const ratio = d.adv / (d.adv + d.dec);
                return (
                  <tr key={d.date} className="bg-slate-800 hover:bg-slate-750">
                    <td className="px-3 py-2 text-xs text-slate-400">{d.date}</td>
                    <td className="px-3 py-2 text-right text-xs text-emerald-400">{d.adv.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-xs text-red-400">{d.dec.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={cn('text-xs font-medium', ratio > 0.5 ? 'text-emerald-400' : 'text-red-400')}>
                        {(ratio * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-emerald-400">{d.nh}</td>
                    <td className="px-3 py-2 text-right text-xs text-red-400">{d.nl}</td>
                    <td className={cn('px-3 py-2 text-right text-xs font-medium', d.mcOsc >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {d.mcOsc >= 0 ? '+' : ''}{d.mcOsc.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sector breadth */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Sector Breadth</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sectorData.map(sec => (
            <div key={sec.sector} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white">{sec.sector}</span>
                <span className={cn('text-xs font-bold', sec.advPct > 50 ? 'text-emerald-400' : 'text-red-400')}>
                  {sec.advPct}% adv
                </span>
              </div>
              <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-slate-700">
                <div className="bg-emerald-500/60 transition-all" style={{ width: `${sec.advPct}%` }} />
                <div className="bg-red-500/60 transition-all" style={{ width: `${100 - sec.advPct}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-slate-500">
                <span>{sec.aboveMA50}% &gt;50 DMA</span>
                <span className="text-emerald-400/70">{sec.nh} NH</span>
                <span className="text-red-400/70">{sec.nl} NL</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
