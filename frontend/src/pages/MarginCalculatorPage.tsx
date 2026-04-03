import { useState, useMemo } from 'react';
import { Calculator, AlertTriangle, DollarSign } from 'lucide-react';
import { cn } from '../lib/utils';

const MARGIN_RATES = [
  { tier: 'Reg T (Standard)', initial: 50, maintenance: 25, description: 'Most US equities' },
  { tier: 'Portfolio Margin', initial: 15, maintenance: 15, description: 'Qualified accounts' },
  { tier: 'Day Trade', initial: 25, maintenance: 25, description: '4+ round trips/5 days' },
  { tier: 'Concentrated', initial: 70, maintenance: 40, description: 'Single stock >60% portfolio' },
  { tier: 'Penny Stock', initial: 100, maintenance: 100, description: 'Stocks under $5' },
  { tier: 'Options (Covered)', initial: 0, maintenance: 0, description: 'Covered calls/puts' },
  { tier: 'Options (Naked)', initial: 100, maintenance: 100, description: 'Uncovered options' },
];

interface ScenarioResult {
  label: string;
  priceChange: number;
  newValue: number;
  equity: number;
  marginPct: number;
  marginCall: boolean;
}

export function MarginCalculatorPage() {
  const [accountValue, setAccountValue] = useState(100000);
  const [stockPrice, setStockPrice] = useState(150);
  const [shares, setShares] = useState(1000);
  const [marginType, setMarginType] = useState(0);
  const [interestRate, setInterestRate] = useState(8.5);
  const [holdDays, setHoldDays] = useState(30);

  const positionValue = stockPrice * shares;
  const selectedMargin = MARGIN_RATES[marginType];
  const initialMarginReq = positionValue * (selectedMargin.initial / 100);
  const maintenanceMarginReq = positionValue * (selectedMargin.maintenance / 100);
  const borrowedAmount = Math.max(0, positionValue - accountValue);
  const buyingPower = accountValue / (selectedMargin.initial / 100);
  const leverageRatio = positionValue / accountValue;
  const marginUsed = (initialMarginReq / accountValue) * 100;
  const interestCost = (borrowedAmount * interestRate / 100) * (holdDays / 365);
  const marginCallPrice = selectedMargin.maintenance > 0
    ? (borrowedAmount * 100) / (shares * (100 - selectedMargin.maintenance))
    : 0;

  const scenarios: ScenarioResult[] = useMemo(() => {
    return [-30, -20, -10, -5, 0, 5, 10, 20, 30].map(pctChange => {
      const newPrice = stockPrice * (1 + pctChange / 100);
      const newValue = newPrice * shares;
      const equity = newValue - borrowedAmount;
      const marginPct = newValue > 0 ? (equity / newValue) * 100 : 0;
      return {
        label: `${pctChange >= 0 ? '+' : ''}${pctChange}%`,
        priceChange: pctChange,
        newValue, equity,
        marginPct: +marginPct.toFixed(1),
        marginCall: marginPct < selectedMargin.maintenance,
      };
    });
  }, [stockPrice, shares, borrowedAmount, selectedMargin.maintenance]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Calculator className="h-6 w-6 text-orange-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Margin Calculator</h1>
          <p className="text-sm text-slate-400">Margin requirements, buying power, and maintenance scenarios</p>
        </div>
      </div>

      {/* Input form */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Account</h3>
          <div>
            <label className="text-[10px] text-slate-500">Account Value ($)</label>
            <input type="number" value={accountValue} onChange={e => setAccountValue(+e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Margin Type</label>
            <select value={marginType} onChange={e => setMarginType(+e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white">
              {MARGIN_RATES.map((r, i) => <option key={i} value={i}>{r.tier}</option>)}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Position</h3>
          <div>
            <label className="text-[10px] text-slate-500">Stock Price ($)</label>
            <input type="number" value={stockPrice} onChange={e => setStockPrice(+e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Shares</label>
            <input type="number" value={shares} onChange={e => setShares(+e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Interest</h3>
          <div>
            <label className="text-[10px] text-slate-500">Annual Rate (%)</label>
            <input type="number" step="0.1" value={interestRate} onChange={e => setInterestRate(+e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Hold Period (days)</label>
            <input type="number" value={holdDays} onChange={e => setHoldDays(+e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none" />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Position Value', value: `$${positionValue.toLocaleString()}`, color: 'text-white' },
          { label: 'Buying Power', value: `$${buyingPower.toLocaleString()}`, color: 'text-emerald-400' },
          { label: 'Borrowed', value: `$${borrowedAmount.toLocaleString()}`, color: borrowedAmount > 0 ? 'text-amber-400' : 'text-slate-400' },
          { label: 'Leverage', value: `${leverageRatio.toFixed(2)}x`, color: leverageRatio > 2 ? 'text-red-400' : 'text-white' },
          { label: 'Margin Used', value: `${marginUsed.toFixed(1)}%`, color: marginUsed > 80 ? 'text-red-400' : marginUsed > 50 ? 'text-amber-400' : 'text-emerald-400' },
          { label: 'Interest Cost', value: `$${interestCost.toFixed(2)}`, color: 'text-amber-400' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
            <div className={cn('mt-1 text-lg font-bold', c.color)}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Margin call price */}
      {borrowedAmount > 0 && marginCallPrice > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-400" />
          <div>
            <div className="text-sm font-semibold text-red-400">Margin Call Price: ${marginCallPrice.toFixed(2)}</div>
            <div className="text-xs text-slate-400">
              A {((1 - marginCallPrice / stockPrice) * 100).toFixed(1)}% decline triggers a margin call at {selectedMargin.maintenance}% maintenance requirement
            </div>
          </div>
        </div>
      )}

      {/* Margin gauge */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Margin Utilization</h3>
        <div className="relative h-6 rounded-full bg-slate-700 overflow-hidden">
          <div className={cn('h-6 rounded-full transition-all',
            marginUsed > 80 ? 'bg-red-500/60' : marginUsed > 50 ? 'bg-amber-500/60' : 'bg-emerald-500/60')}
            style={{ width: `${Math.min(100, marginUsed)}%` }} />
          {selectedMargin.maintenance > 0 && (
            <div className="absolute top-0 h-6 w-0.5 bg-red-400"
              style={{ left: `${selectedMargin.maintenance}%` }} />
          )}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-slate-500">
          <span>0%</span>
          <span className="text-red-400">{selectedMargin.maintenance}% maintenance</span>
          <span>{selectedMargin.initial}% initial</span>
          <span>100%</span>
        </div>
      </div>

      {/* Scenario table */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Price Scenarios</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Price Change</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Stock Price</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Position Value</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Equity</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Margin %</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {scenarios.map(s => (
                <tr key={s.label} className={cn('hover:bg-slate-750', s.marginCall ? 'bg-red-500/5' : s.priceChange === 0 ? 'bg-orange-500/5' : 'bg-slate-800')}>
                  <td className={cn('px-3 py-2 text-xs font-bold', s.priceChange >= 0 ? 'text-emerald-400' : 'text-red-400')}>{s.label}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">${(stockPrice * (1 + s.priceChange / 100)).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">${s.newValue.toLocaleString()}</td>
                  <td className={cn('px-3 py-2 text-right text-xs font-medium', s.equity >= 0 ? 'text-white' : 'text-red-400')}>
                    ${s.equity.toLocaleString()}
                  </td>
                  <td className={cn('px-3 py-2 text-right text-xs font-medium', s.marginPct < selectedMargin.maintenance ? 'text-red-400' : 'text-emerald-400')}>
                    {s.marginPct}%
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold',
                      s.marginCall ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400')}>
                      {s.marginCall ? 'MARGIN CALL' : 'OK'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Margin rate reference */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Margin Requirements Reference</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Margin Type</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Initial %</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Maintenance %</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Applies To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {MARGIN_RATES.map((r, i) => (
                <tr key={i} className={cn('hover:bg-slate-750', marginType === i ? 'bg-orange-500/10' : 'bg-slate-800')}>
                  <td className={cn('px-3 py-2 text-xs font-medium', marginType === i ? 'text-orange-400' : 'text-white')}>{r.tier}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">{r.initial}%</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-300">{r.maintenance}%</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{r.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
