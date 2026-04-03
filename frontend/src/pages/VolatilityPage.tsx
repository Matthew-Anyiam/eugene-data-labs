import { useState, useMemo } from 'react';
import { Zap, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

const VIX_TERMS = [
  { label: 'VIX', desc: 'S&P 500 30-day IV', months: 1 },
  { label: 'VIX3M', desc: '3-month implied vol', months: 3 },
  { label: 'VIX6M', desc: '6-month implied vol', months: 6 },
  { label: 'VIX1Y', desc: '1-year implied vol', months: 12 },
];

const SKEW_STRIKES = [80, 85, 90, 95, 100, 105, 110, 115, 120];
const EXPIRATIONS = ['1W', '2W', '1M', '2M', '3M', '6M'];

interface VolData {
  vix: number;
  vixChange: number;
  vix3m: number;
  vix6m: number;
  vix1y: number;
  termStructure: { label: string; value: number; change: number }[];
  skew: { strike: number; iv: number }[];
  surface: { expiry: string; strikes: { strike: number; iv: number }[] }[];
  historicalVol: { date: string; hv20: number; hv60: number; iv: number }[];
  regime: 'Low' | 'Normal' | 'Elevated' | 'High' | 'Extreme';
  percentile: number;
  putCallRatio: number;
  skewidx: number;
}

function genVolData(): VolData {
  const s = seed('volpage_main');
  const vix = 14 + pseudo(s, 0) * 20;
  const vixChange = (pseudo(s, 1) - 0.5) * 4;
  const vix3m = vix + 1 + pseudo(s, 2) * 3;
  const vix6m = vix3m + 0.5 + pseudo(s, 3) * 2;
  const vix1y = vix6m + 0.5 + pseudo(s, 4) * 1.5;

  const termStructure = VIX_TERMS.map((t, i) => ({
    label: t.label,
    value: +[vix, vix3m, vix6m, vix1y][i].toFixed(2),
    change: +((pseudo(s, 10 + i) - 0.5) * 3).toFixed(2),
  }));

  const skew = SKEW_STRIKES.map((strike, i) => {
    const moneyness = (strike - 100) / 100;
    const baseIV = vix + (moneyness < 0 ? Math.abs(moneyness) * 40 : moneyness * 10);
    return { strike, iv: +(baseIV + (pseudo(s, 20 + i) - 0.5) * 3).toFixed(1) };
  });

  const surface = EXPIRATIONS.map((expiry, ei) => ({
    expiry,
    strikes: SKEW_STRIKES.map((strike, si) => {
      const moneyness = (strike - 100) / 100;
      const timeDecay = 1 + ei * 0.15;
      const baseIV = vix * timeDecay + (moneyness < 0 ? Math.abs(moneyness) * 35 : moneyness * 8);
      return { strike, iv: +(baseIV + (pseudo(s, 50 + ei * 10 + si) - 0.5) * 2).toFixed(1) };
    }),
  }));

  const historicalVol = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(2025, 2, 20 - i);
    const ds = seed('hv' + i);
    return {
      date: d.toISOString().slice(0, 10),
      hv20: +(12 + pseudo(ds, 0) * 18).toFixed(1),
      hv60: +(13 + pseudo(ds, 1) * 12).toFixed(1),
      iv: +(14 + pseudo(ds, 2) * 20).toFixed(1),
    };
  });

  const regime = vix < 15 ? 'Low' : vix < 20 ? 'Normal' : vix < 25 ? 'Elevated' : vix < 35 ? 'High' : 'Extreme';
  const percentile = +(pseudo(s, 100) * 100).toFixed(0);
  const putCallRatio = +(0.6 + pseudo(s, 101) * 0.8).toFixed(2);
  const skewidx = +(120 + pseudo(s, 102) * 30).toFixed(1);

  return {
    vix: +vix.toFixed(2), vixChange: +vixChange.toFixed(2),
    vix3m: +vix3m.toFixed(2), vix6m: +vix6m.toFixed(2), vix1y: +vix1y.toFixed(2),
    termStructure, skew, surface, historicalVol, regime, percentile, putCallRatio, skewidx,
  };
}

const REGIME_COLORS: Record<string, string> = {
  Low: 'text-emerald-400',
  Normal: 'text-blue-400',
  Elevated: 'text-amber-400',
  High: 'text-orange-400',
  Extreme: 'text-red-400',
};

const REGIME_BG: Record<string, string> = {
  Low: 'bg-emerald-500/20 border-emerald-500/30',
  Normal: 'bg-blue-500/20 border-blue-500/30',
  Elevated: 'bg-amber-500/20 border-amber-500/30',
  High: 'bg-orange-500/20 border-orange-500/30',
  Extreme: 'bg-red-500/20 border-red-500/30',
};

export function VolatilityPage() {
  const [surfaceExpiry, setSurfaceExpiry] = useState('1M');

  const data = useMemo(() => genVolData(), []);

  const selectedSurface = data.surface.find(s => s.expiry === surfaceExpiry) || data.surface[0];
  const maxIV = Math.max(...data.skew.map(s => s.iv));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Zap className="h-6 w-6 text-yellow-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Volatility Dashboard</h1>
          <p className="text-sm text-slate-400">VIX term structure, volatility surface, and skew analysis</p>
        </div>
      </div>

      {/* VIX headline + regime */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">VIX Index</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{data.vix}</span>
            <span className={cn('flex items-center gap-0.5 text-sm font-medium', data.vixChange >= 0 ? 'text-red-400' : 'text-emerald-400')}>
              {data.vixChange >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {data.vixChange >= 0 ? '+' : ''}{data.vixChange}
            </span>
          </div>
        </div>

        <div className={cn('rounded-xl border p-4', REGIME_BG[data.regime])}>
          <div className="text-xs text-slate-500 uppercase tracking-wider">Vol Regime</div>
          <div className={cn('mt-2 text-2xl font-bold', REGIME_COLORS[data.regime])}>
            {data.regime}
          </div>
          <div className="mt-1 text-xs text-slate-400">{data.percentile}th percentile (1Y)</div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Put/Call Ratio</div>
          <div className={cn('mt-2 text-2xl font-bold', data.putCallRatio > 1 ? 'text-red-400' : 'text-emerald-400')}>
            {data.putCallRatio}
          </div>
          <div className="mt-1 text-xs text-slate-400">{data.putCallRatio > 1 ? 'Bearish bias' : 'Bullish bias'}</div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">SKEW Index</div>
          <div className={cn('mt-2 text-2xl font-bold', data.skewidx > 140 ? 'text-red-400' : data.skewidx > 130 ? 'text-amber-400' : 'text-white')}>
            {data.skewidx}
          </div>
          <div className="mt-1 text-xs text-slate-400">{data.skewidx > 140 ? 'High tail risk' : data.skewidx > 130 ? 'Elevated' : 'Normal'}</div>
        </div>
      </div>

      {/* Term structure */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-4 text-sm font-semibold text-white">VIX Term Structure</h3>
        <div className="flex items-end gap-4">
          {data.termStructure.map((t, i) => {
            const height = ((t.value - 10) / 30) * 100;
            return (
              <div key={t.label} className="flex flex-1 flex-col items-center gap-2">
                <span className={cn('text-xs font-medium', t.change >= 0 ? 'text-red-400' : 'text-emerald-400')}>
                  {t.change >= 0 ? '+' : ''}{t.change}
                </span>
                <span className="text-sm font-bold text-white">{t.value}</span>
                <div className="w-full rounded-t-lg bg-yellow-500/30" style={{ height: `${Math.max(20, height)}px` }}>
                  <div className="h-full w-full rounded-t-lg bg-gradient-to-t from-yellow-600/60 to-yellow-400/60" />
                </div>
                <span className="text-[10px] text-slate-400">{VIX_TERMS[i].label}</span>
                <span className="text-[9px] text-slate-500">{VIX_TERMS[i].desc}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <AlertTriangle className="h-3 w-3" />
          {data.termStructure[0].value < data.termStructure[1].value
            ? 'Contango — normal term structure (front < back)'
            : 'Backwardation — inverted (front > back), signals stress'}
        </div>
      </div>

      {/* Volatility skew */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-4 text-sm font-semibold text-white">Volatility Skew (30-Day)</h3>
        <div className="flex items-end gap-2">
          {data.skew.map(s => {
            const height = (s.iv / maxIV) * 120;
            const isATM = s.strike === 100;
            return (
              <div key={s.strike} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-slate-400">{s.iv}%</span>
                <div className={cn('w-full rounded-t', isATM ? 'bg-yellow-500/50' : s.strike < 100 ? 'bg-red-500/40' : 'bg-emerald-500/40')}
                  style={{ height: `${Math.max(8, height)}px` }} />
                <span className={cn('text-[10px]', isATM ? 'font-bold text-yellow-400' : 'text-slate-500')}>
                  {s.strike}%
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-slate-500">
          <span>OTM Puts (downside protection)</span>
          <span>ATM</span>
          <span>OTM Calls</span>
        </div>
      </div>

      {/* Volatility surface */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Volatility Surface</h3>
          <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-900 p-0.5">
            {EXPIRATIONS.map(e => (
              <button key={e} onClick={() => setSurfaceExpiry(e)}
                className={cn('rounded-md px-2 py-0.5 text-[10px] font-medium', surfaceExpiry === e ? 'bg-yellow-600 text-white' : 'text-slate-400 hover:text-white')}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700">
              <tr>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-slate-400">Strike %</th>
                {selectedSurface.strikes.map(s => (
                  <th key={s.strike} className={cn('px-2 py-1.5 text-center text-xs font-medium', s.strike === 100 ? 'text-yellow-400' : 'text-slate-400')}>
                    {s.strike}%
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.surface.map(row => (
                <tr key={row.expiry} className={cn('border-b border-slate-700/50', row.expiry === surfaceExpiry ? 'bg-yellow-500/10' : '')}>
                  <td className="px-2 py-1.5 text-xs font-medium text-slate-300">{row.expiry}</td>
                  {row.strikes.map(s => {
                    const intensity = Math.min(1, (s.iv - 10) / 40);
                    return (
                      <td key={s.strike} className="px-2 py-1.5 text-center text-xs"
                        style={{ backgroundColor: `rgba(234, 179, 8, ${intensity * 0.3})`, color: intensity > 0.5 ? '#fbbf24' : '#94a3b8' }}>
                        {s.iv}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical vol */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Historical vs Implied Volatility</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Date</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">HV 20-Day</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">HV 60-Day</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">IV 30-Day</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">IV Premium</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {data.historicalVol.slice(0, 15).map(h => {
                const premium = +(h.iv - h.hv20).toFixed(1);
                return (
                  <tr key={h.date} className="bg-slate-800 hover:bg-slate-750">
                    <td className="px-3 py-2 text-xs text-slate-400">{h.date}</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-300">{h.hv20}%</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-300">{h.hv60}%</td>
                    <td className="px-3 py-2 text-right text-xs text-yellow-400">{h.iv}%</td>
                    <td className={cn('px-3 py-2 text-right text-xs font-medium', premium >= 0 ? 'text-amber-400' : 'text-cyan-400')}>
                      {premium >= 0 ? '+' : ''}{premium}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
