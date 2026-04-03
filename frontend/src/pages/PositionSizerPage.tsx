import { useState, useMemo } from 'react';
import { Calculator, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react';
import { cn, formatPrice } from '../lib/utils';

const RISK_PROFILES = [
  { name: 'Conservative', maxRisk: 0.5, color: 'text-blue-400' },
  { name: 'Moderate', maxRisk: 1.0, color: 'text-emerald-400' },
  { name: 'Aggressive', maxRisk: 2.0, color: 'text-amber-400' },
  { name: 'Very Aggressive', maxRisk: 3.0, color: 'text-red-400' },
];

export function PositionSizerPage() {
  const [accountSize, setAccountSize] = useState('100000');
  const [riskPercent, setRiskPercent] = useState('1.0');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(1);
  const [positionType, setPositionType] = useState<'long' | 'short'>('long');

  const account = parseFloat(accountSize) || 0;
  const risk = parseFloat(riskPercent) || 0;
  const entry = parseFloat(entryPrice) || 0;
  const stop = parseFloat(stopLoss) || 0;
  const target = parseFloat(takeProfit) || 0;

  const calc = useMemo(() => {
    if (!account || !risk || !entry || !stop) return null;

    const riskAmount = account * (risk / 100);
    const riskPerShare = Math.abs(entry - stop);
    if (riskPerShare === 0) return null;

    const shares = Math.floor(riskAmount / riskPerShare);
    const positionValue = shares * entry;
    const positionPct = (positionValue / account) * 100;
    const maxLoss = shares * riskPerShare;

    const rr = target && entry ? Math.abs(target - entry) / riskPerShare : 0;
    const potentialProfit = target ? shares * Math.abs(target - entry) : 0;
    const breakeven = entry;

    // Kelly criterion (simplified)
    const winRate = 0.55; // assumed
    const kellyPct = rr > 0 ? ((winRate * rr - (1 - winRate)) / rr) * 100 : 0;
    const kellyShares = rr > 0 ? Math.floor((account * Math.max(kellyPct, 0) / 100) / riskPerShare) : 0;

    return {
      shares, positionValue, positionPct, maxLoss, riskPerShare, riskAmount,
      rr, potentialProfit, breakeven, kellyPct: Math.max(kellyPct, 0), kellyShares,
    };
  }, [account, risk, entry, stop, target]);

  // Scenario table
  const scenarios = useMemo(() => {
    if (!entry || !stop) return [];
    return [0.5, 1.0, 1.5, 2.0, 2.5, 3.0].map(riskPct => {
      const riskAmt = account * (riskPct / 100);
      const rps = Math.abs(entry - stop);
      if (rps === 0) return { riskPct, shares: 0, value: 0, maxLoss: 0 };
      const sh = Math.floor(riskAmt / rps);
      return { riskPct, shares: sh, value: sh * entry, maxLoss: sh * rps };
    });
  }, [account, entry, stop]);

  const input = (label: string, value: string, onChange: (v: string) => void, placeholder: string, prefix?: string) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">{prefix}</span>}
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type="number" step="any"
          className={cn('w-full rounded-lg border border-slate-600 bg-slate-900 py-2 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none', prefix ? 'pl-7' : 'pl-3')} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Calculator className="h-6 w-6 text-cyan-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Position Sizer</h1>
          <p className="text-sm text-slate-400">Calculate optimal position size based on risk management rules</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Input panel */}
        <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-800 p-4 lg:col-span-1">
          <h3 className="text-sm font-semibold text-white">Parameters</h3>

          {/* Risk profile */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Risk Profile</label>
            <div className="grid grid-cols-2 gap-1">
              {RISK_PROFILES.map((p, i) => (
                <button key={p.name} onClick={() => { setSelectedProfile(i); setRiskPercent(p.maxRisk.toString()); }}
                  className={cn('rounded-lg px-2 py-1.5 text-xs font-medium transition-colors', selectedProfile === i ? 'bg-slate-700 text-white' : 'border border-slate-700 text-slate-400 hover:text-white')}>
                  <span className={p.color}>{p.name}</span>
                  <span className="ml-1 text-slate-500">({p.maxRisk}%)</span>
                </button>
              ))}
            </div>
          </div>

          {/* Position type */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Position Type</label>
            <div className="flex gap-1">
              {(['long', 'short'] as const).map(t => (
                <button key={t} onClick={() => setPositionType(t)}
                  className={cn('flex-1 rounded-lg px-3 py-1.5 text-xs font-medium', positionType === t ? (t === 'long' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white') : 'border border-slate-600 text-slate-400')}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {input('Account Size', accountSize, setAccountSize, '100000', '$')}
          {input('Risk per Trade (%)', riskPercent, setRiskPercent, '1.0')}
          {input('Entry Price', entryPrice, setEntryPrice, '0.00', '$')}
          {input('Stop Loss', stopLoss, setStopLoss, '0.00', '$')}
          {input('Take Profit (optional)', takeProfit, setTakeProfit, '0.00', '$')}

          {entry > 0 && stop > 0 && (
            <div className="rounded-lg bg-slate-900/50 p-2 text-xs text-slate-400">
              <AlertTriangle className="mb-1 inline h-3 w-3 text-amber-400" /> Stop distance: {formatPrice(Math.abs(entry - stop))} ({((Math.abs(entry - stop) / entry) * 100).toFixed(2)}%)
            </div>
          )}
        </div>

        {/* Results panel */}
        <div className="space-y-4 lg:col-span-2">
          {calc ? (
            <>
              {/* Main result cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { label: 'Position Size', value: `${calc.shares} shares`, sub: formatPrice(calc.positionValue), icon: <TrendingUp className="h-4 w-4 text-emerald-400" /> },
                  { label: 'Position % of Account', value: `${calc.positionPct.toFixed(1)}%`, sub: `of ${formatPrice(account)}`, color: calc.positionPct > 25 ? 'text-amber-400' : 'text-white' },
                  { label: 'Max Risk ($)', value: formatPrice(calc.maxLoss), sub: `${risk}% of account`, color: 'text-red-400', icon: <AlertTriangle className="h-4 w-4 text-red-400" /> },
                  { label: 'Risk Per Share', value: formatPrice(calc.riskPerShare), sub: `${((calc.riskPerShare / entry) * 100).toFixed(2)}% per share` },
                  { label: 'Reward:Risk', value: calc.rr > 0 ? `${calc.rr.toFixed(2)}:1` : '—', sub: calc.rr > 0 ? (calc.rr >= 2 ? 'Favorable' : calc.rr >= 1 ? 'Acceptable' : 'Unfavorable') : 'Set take profit', color: calc.rr >= 2 ? 'text-emerald-400' : calc.rr >= 1 ? 'text-amber-400' : 'text-red-400' },
                  { label: 'Potential Profit', value: calc.potentialProfit > 0 ? formatPrice(calc.potentialProfit) : '—', sub: calc.potentialProfit > 0 ? `${((calc.potentialProfit / account) * 100).toFixed(2)}% return` : 'Set take profit', color: 'text-emerald-400', icon: <DollarSign className="h-4 w-4 text-emerald-400" /> },
                ].map(c => (
                  <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</span>
                      {c.icon}
                    </div>
                    <div className={cn('mt-1 text-lg font-bold', c.color || 'text-white')}>{c.value}</div>
                    <div className="text-[10px] text-slate-500">{c.sub}</div>
                  </div>
                ))}
              </div>

              {/* Kelly criterion */}
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <h3 className="mb-2 text-sm font-semibold text-white">Kelly Criterion (55% assumed win rate)</h3>
                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-xs text-slate-400">Optimal Allocation</div>
                    <div className={cn('text-lg font-bold', calc.kellyPct > 0 ? 'text-emerald-400' : 'text-slate-500')}>
                      {calc.kellyPct.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Kelly Shares</div>
                    <div className="text-lg font-bold text-white">{calc.kellyShares}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Half Kelly (safer)</div>
                    <div className="text-lg font-bold text-blue-400">{Math.floor(calc.kellyShares / 2)}</div>
                  </div>
                  <div className="flex-1">
                    <div className="h-3 rounded-full bg-slate-700">
                      <div className="h-3 rounded-full bg-emerald-500/60" style={{ width: `${Math.min(calc.kellyPct, 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual risk gauge */}
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <h3 className="mb-3 text-sm font-semibold text-white">Trade Visualization</h3>
                <div className="relative h-16">
                  {/* Price bar */}
                  <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-700" />
                  {/* Stop loss zone */}
                  {(() => {
                    const range = Math.max(Math.abs(target - entry), Math.abs(entry - stop), 1) * 2;
                    const minPrice = Math.min(stop, entry, target || entry) - range * 0.1;
                    const scale = (p: number) => ((p - minPrice) / (range * 1.2)) * 100;
                    return (
                      <>
                        <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded bg-red-500/30" style={{ left: `${Math.min(scale(stop), scale(entry))}%`, width: `${Math.abs(scale(entry) - scale(stop))}%` }} />
                        {target > 0 && <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded bg-emerald-500/30" style={{ left: `${Math.min(scale(entry), scale(target))}%`, width: `${Math.abs(scale(target) - scale(entry))}%` }} />}
                        <div className="absolute top-0 flex flex-col items-center" style={{ left: `${scale(stop)}%` }}>
                          <span className="text-[9px] font-medium text-red-400">Stop</span>
                          <div className="h-8 w-0.5 bg-red-400" />
                          <span className="text-[9px] text-red-400">{formatPrice(stop)}</span>
                        </div>
                        <div className="absolute top-0 flex flex-col items-center" style={{ left: `${scale(entry)}%` }}>
                          <span className="text-[9px] font-medium text-white">Entry</span>
                          <div className="h-8 w-0.5 bg-white" />
                          <span className="text-[9px] text-white">{formatPrice(entry)}</span>
                        </div>
                        {target > 0 && (
                          <div className="absolute top-0 flex flex-col items-center" style={{ left: `${scale(target)}%` }}>
                            <span className="text-[9px] font-medium text-emerald-400">Target</span>
                            <div className="h-8 w-0.5 bg-emerald-400" />
                            <span className="text-[9px] text-emerald-400">{formatPrice(target)}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Scenario table */}
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <h3 className="mb-3 text-sm font-semibold text-white">Risk Scenarios</h3>
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Risk %</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Shares</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Position Value</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Max Loss</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">% of Account</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {scenarios.map(s => (
                      <tr key={s.riskPct} className={cn('transition-colors', s.riskPct === risk ? 'bg-emerald-900/20' : 'hover:bg-slate-750')}>
                        <td className={cn('px-3 py-2 text-xs font-medium', s.riskPct === risk ? 'text-emerald-400' : 'text-slate-300')}>{s.riskPct}%{s.riskPct === risk ? ' ←' : ''}</td>
                        <td className="px-3 py-2 text-right text-xs text-slate-300">{s.shares.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-xs text-slate-300">{formatPrice(s.value)}</td>
                        <td className="px-3 py-2 text-right text-xs text-red-400">{formatPrice(s.maxLoss)}</td>
                        <td className="px-3 py-2 text-right text-xs text-slate-400">{account > 0 ? ((s.value / account) * 100).toFixed(1) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border border-slate-700 bg-slate-800">
              <div className="text-center">
                <Calculator className="mx-auto h-12 w-12 text-slate-600" />
                <p className="mt-3 text-sm text-slate-400">Enter entry price and stop loss to calculate position size</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
