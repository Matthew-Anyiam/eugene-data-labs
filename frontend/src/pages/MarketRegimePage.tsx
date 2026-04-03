import { useState, useMemo } from 'react';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, Shield } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

type Regime = 'Bull' | 'Bear' | 'Recovery' | 'Distribution';
type VolRegime = 'Low Vol' | 'Normal' | 'High Vol' | 'Crisis';

interface RegimeIndicator {
  name: string;
  value: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  description: string;
}

interface RegimeData {
  currentRegime: Regime;
  regimeConfidence: number;
  volRegime: VolRegime;
  daysSinceChange: number;
  indicators: RegimeIndicator[];
  regimeHistory: { period: string; regime: Regime; duration: number }[];
}

function genRegimeData(): RegimeData {
  const s = seed('regime_2026');
  const regimes: Regime[] = ['Bull', 'Bear', 'Recovery', 'Distribution'];
  const volRegimes: VolRegime[] = ['Low Vol', 'Normal', 'High Vol', 'Crisis'];

  const indicators: RegimeIndicator[] = [
    { name: 'S&P 500 vs 200 DMA', value: +(pseudo(s, 0) * 10 - 2).toFixed(1), signal: pseudo(s, 0) > 0.3 ? 'bullish' : 'bearish', description: 'Price relative to 200-day moving average' },
    { name: 'Advance/Decline Line', value: +(pseudo(s, 1) * 2 - 1).toFixed(2), signal: pseudo(s, 1) > 0.4 ? 'bullish' : pseudo(s, 1) < 0.2 ? 'bearish' : 'neutral', description: 'Cumulative breadth indicator' },
    { name: 'VIX Level', value: +(12 + pseudo(s, 2) * 25).toFixed(1), signal: pseudo(s, 2) < 0.5 ? 'bullish' : pseudo(s, 2) > 0.8 ? 'bearish' : 'neutral', description: 'Market fear gauge' },
    { name: 'Yield Curve Slope', value: +((pseudo(s, 3) - 0.3) * 2).toFixed(2), signal: pseudo(s, 3) > 0.3 ? 'bullish' : 'bearish', description: '10Y-2Y Treasury spread' },
    { name: 'Credit Spreads', value: +(1 + pseudo(s, 4) * 4).toFixed(2), signal: pseudo(s, 4) < 0.5 ? 'bullish' : 'bearish', description: 'IG corporate vs Treasury' },
    { name: 'ISM Manufacturing', value: +(45 + pseudo(s, 5) * 15).toFixed(1), signal: pseudo(s, 5) > 0.3 ? 'bullish' : 'bearish', description: 'Manufacturing PMI' },
    { name: 'NFCI Index', value: +((pseudo(s, 6) - 0.5) * 2).toFixed(2), signal: pseudo(s, 6) < 0.6 ? 'bullish' : 'bearish', description: 'Financial conditions' },
    { name: 'Consumer Confidence', value: +(80 + pseudo(s, 7) * 40).toFixed(1), signal: pseudo(s, 7) > 0.3 ? 'bullish' : 'neutral', description: 'Conference Board index' },
  ];

  const bullish = indicators.filter(i => i.signal === 'bullish').length;
  const currentRegime = bullish >= 6 ? 'Bull' : bullish >= 4 ? 'Recovery' : bullish >= 2 ? 'Distribution' : 'Bear';

  const vixVal = indicators.find(i => i.name === 'VIX Level')!.value;
  const volRegime = vixVal < 15 ? 'Low Vol' : vixVal < 20 ? 'Normal' : vixVal < 30 ? 'High Vol' : 'Crisis';

  const regimeHistory = [
    { period: 'Jan-Mar 2026', regime: 'Bull' as Regime, duration: 90 },
    { period: 'Oct-Dec 2025', regime: 'Recovery' as Regime, duration: 92 },
    { period: 'Jul-Sep 2025', regime: 'Distribution' as Regime, duration: 45 },
    { period: 'Apr-Jun 2025', regime: 'Bull' as Regime, duration: 120 },
    { period: 'Jan-Mar 2025', regime: 'Bear' as Regime, duration: 60 },
    { period: 'Oct-Dec 2024', regime: 'Recovery' as Regime, duration: 75 },
  ];

  return {
    currentRegime,
    regimeConfidence: Math.floor(55 + pseudo(s, 10) * 40),
    volRegime,
    daysSinceChange: Math.floor(5 + pseudo(s, 11) * 85),
    indicators,
    regimeHistory,
  };
}

const REGIME_STYLES: Record<Regime, { bg: string; text: string; border: string }> = {
  Bull: { bg: 'bg-emerald-900/30', text: 'text-emerald-400', border: 'border-emerald-700/50' },
  Bear: { bg: 'bg-red-900/30', text: 'text-red-400', border: 'border-red-700/50' },
  Recovery: { bg: 'bg-amber-900/30', text: 'text-amber-400', border: 'border-amber-700/50' },
  Distribution: { bg: 'bg-purple-900/30', text: 'text-purple-400', border: 'border-purple-700/50' },
};

const VOL_STYLES: Record<VolRegime, { text: string }> = {
  'Low Vol': { text: 'text-emerald-400' },
  Normal: { text: 'text-slate-300' },
  'High Vol': { text: 'text-amber-400' },
  Crisis: { text: 'text-red-400' },
};

export function MarketRegimePage() {
  const data = useMemo(() => genRegimeData(), []);
  const regimeStyle = REGIME_STYLES[data.currentRegime];
  const bullishCount = data.indicators.filter(i => i.signal === 'bullish').length;
  const bearishCount = data.indicators.filter(i => i.signal === 'bearish').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Market Regime</h1>
          <p className="text-sm text-slate-400">Regime detection, volatility analysis, and trend indicators</p>
        </div>
      </div>

      {/* Current regime */}
      <div className={cn('rounded-xl border p-6', regimeStyle.border, regimeStyle.bg)}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">Current Market Regime</div>
            <div className={cn('mt-1 text-3xl font-bold', regimeStyle.text)}>{data.currentRegime}</div>
            <div className="mt-1 text-xs text-slate-400">{data.daysSinceChange} days in current regime</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Confidence</div>
            <div className={cn('text-2xl font-bold', regimeStyle.text)}>{data.regimeConfidence}%</div>
            <div className={cn('text-xs', VOL_STYLES[data.volRegime].text)}>Vol: {data.volRegime}</div>
          </div>
        </div>
      </div>

      {/* Signal summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-700/50 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Bullish Signals</div>
          <div className="mt-1 text-2xl font-bold text-emerald-400">{bullishCount} / {data.indicators.length}</div>
        </div>
        <div className="rounded-xl border border-red-700/50 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Bearish Signals</div>
          <div className="mt-1 text-2xl font-bold text-red-400">{bearishCount} / {data.indicators.length}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Neutral Signals</div>
          <div className="mt-1 text-2xl font-bold text-slate-300">
            {data.indicators.length - bullishCount - bearishCount} / {data.indicators.length}
          </div>
        </div>
      </div>

      {/* Indicator cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.indicators.map(ind => (
          <div key={ind.name} className={cn('rounded-xl border bg-slate-800 p-4',
            ind.signal === 'bullish' ? 'border-emerald-700/30' : ind.signal === 'bearish' ? 'border-red-700/30' : 'border-slate-700'
          )}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white">{ind.name}</span>
              {ind.signal === 'bullish' ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> :
               ind.signal === 'bearish' ? <TrendingDown className="h-3.5 w-3.5 text-red-400" /> :
               <Shield className="h-3.5 w-3.5 text-slate-400" />}
            </div>
            <div className={cn('mt-2 text-xl font-bold',
              ind.signal === 'bullish' ? 'text-emerald-400' : ind.signal === 'bearish' ? 'text-red-400' : 'text-slate-300'
            )}>
              {ind.value}
            </div>
            <div className="text-[10px] text-slate-500">{ind.description}</div>
            <div className="mt-2">
              <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold uppercase',
                ind.signal === 'bullish' ? 'bg-emerald-900/40 text-emerald-400' :
                ind.signal === 'bearish' ? 'bg-red-900/40 text-red-400' :
                'bg-slate-700 text-slate-400'
              )}>{ind.signal}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Regime history */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Regime History</h3>
        <div className="flex gap-1">
          {data.regimeHistory.map((h, i) => {
            const style = REGIME_STYLES[h.regime];
            const totalDays = data.regimeHistory.reduce((s, r) => s + r.duration, 0);
            return (
              <div key={i} className={cn('rounded-lg p-2', style.bg, style.border, 'border')}
                style={{ flex: h.duration / totalDays }}>
                <div className={cn('text-[10px] font-bold', style.text)}>{h.regime}</div>
                <div className="text-[9px] text-slate-500">{h.period}</div>
                <div className="text-[9px] text-slate-600">{h.duration}d</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Indicator table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Indicator</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Value</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Signal</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {data.indicators.map(ind => (
              <tr key={ind.name} className="bg-slate-800 hover:bg-slate-750">
                <td className="px-3 py-2 text-xs font-medium text-white">{ind.name}</td>
                <td className={cn('px-3 py-2 text-right text-xs font-medium',
                  ind.signal === 'bullish' ? 'text-emerald-400' : ind.signal === 'bearish' ? 'text-red-400' : 'text-slate-300'
                )}>{ind.value}</td>
                <td className="px-3 py-2 text-center">
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium',
                    ind.signal === 'bullish' ? 'bg-emerald-900/40 text-emerald-400' :
                    ind.signal === 'bearish' ? 'bg-red-900/40 text-red-400' :
                    'bg-slate-700 text-slate-300'
                  )}>{ind.signal}</span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-400">{ind.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
