import { useState, useMemo } from 'react';
import { Calculator, TrendingUp, TrendingDown, AlertTriangle, DollarSign } from 'lucide-react';
import { cn } from '../lib/utils';

function seed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

type GainType = 'Short-Term' | 'Long-Term';

interface TaxLot {
  ticker: string;
  shares: number;
  costBasis: number;
  currentPrice: number;
  gainLoss: number;
  gainLossPct: number;
  gainType: GainType;
  purchaseDate: string;
  daysHeld: number;
  harvestable: boolean;
  washSaleRisk: boolean;
}

const TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'JNJ', 'AMD', 'CRM', 'NFLX', 'DIS', 'XOM'];

function genTaxLots(): TaxLot[] {
  const lots: TaxLot[] = [];
  TICKERS.forEach((ticker, tIdx) => {
    const numLots = 1 + Math.floor(pseudo(seed(ticker + '_lots'), 0) * 3);
    for (let l = 0; l < numLots; l++) {
      const s = seed(ticker + `_lot${l}`);
      const shares = Math.floor(10 + pseudo(s, 0) * 490);
      const costBasis = +(50 + pseudo(s, 1) * 400).toFixed(2);
      const currentPrice = +(costBasis * (0.7 + pseudo(s, 2) * 0.6)).toFixed(2);
      const gainLoss = +((currentPrice - costBasis) * shares).toFixed(2);
      const daysHeld = Math.floor(30 + pseudo(s, 3) * 700);

      const date = new Date(2026, 3, 3);
      date.setDate(date.getDate() - daysHeld);

      lots.push({
        ticker,
        shares,
        costBasis,
        currentPrice,
        gainLoss,
        gainLossPct: +((currentPrice / costBasis - 1) * 100).toFixed(2),
        gainType: daysHeld > 365 ? 'Long-Term' : 'Short-Term',
        purchaseDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
        daysHeld,
        harvestable: gainLoss < -500,
        washSaleRisk: pseudo(s, 4) > 0.7 && gainLoss < 0,
      });
    }
  });
  return lots.sort((a, b) => a.gainLoss - b.gainLoss);
}

export function TaxLotPage() {
  const [filter, setFilter] = useState<'All' | 'Gains' | 'Losses' | 'Harvestable' | 'Wash Sale'>('All');

  const lots = useMemo(() => genTaxLots(), []);

  const filtered = lots.filter(l => {
    if (filter === 'Gains') return l.gainLoss >= 0;
    if (filter === 'Losses') return l.gainLoss < 0;
    if (filter === 'Harvestable') return l.harvestable;
    if (filter === 'Wash Sale') return l.washSaleRisk;
    return true;
  });

  const totalGains = lots.filter(l => l.gainLoss >= 0).reduce((s, l) => s + l.gainLoss, 0);
  const totalLosses = lots.filter(l => l.gainLoss < 0).reduce((s, l) => s + l.gainLoss, 0);
  const netGain = totalGains + totalLosses;
  const harvestableValue = lots.filter(l => l.harvestable).reduce((s, l) => s + l.gainLoss, 0);
  const stGains = lots.filter(l => l.gainType === 'Short-Term' && l.gainLoss >= 0).reduce((s, l) => s + l.gainLoss, 0);
  const ltGains = lots.filter(l => l.gainType === 'Long-Term' && l.gainLoss >= 0).reduce((s, l) => s + l.gainLoss, 0);
  const washSaleCount = lots.filter(l => l.washSaleRisk).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Calculator className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Tax Lot Optimizer</h1>
          <p className="text-sm text-slate-400">Tax-loss harvesting, capital gains tracking, and wash sale alerts</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Net Capital Gain/Loss</div>
          <div className={cn('mt-1 text-2xl font-bold', netGain >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            ${netGain >= 0 ? '+' : ''}{(netGain / 1000).toFixed(1)}K
          </div>
        </div>
        <div className="rounded-xl border border-emerald-700/50 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Total Gains</div>
          <div className="mt-1 text-2xl font-bold text-emerald-400">+${(totalGains / 1000).toFixed(1)}K</div>
          <div className="text-[10px] text-slate-500">ST: ${(stGains / 1000).toFixed(1)}K | LT: ${(ltGains / 1000).toFixed(1)}K</div>
        </div>
        <div className="rounded-xl border border-red-700/50 bg-slate-800 p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Harvestable Losses</div>
          <div className="mt-1 text-2xl font-bold text-amber-400">${(Math.abs(harvestableValue) / 1000).toFixed(1)}K</div>
          <div className="text-[10px] text-slate-500">{lots.filter(l => l.harvestable).length} lots eligible</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="flex items-center gap-1 text-xs text-slate-500 uppercase tracking-wider">
            <AlertTriangle className="h-3 w-3 text-amber-400" /> Wash Sale Risk
          </div>
          <div className="mt-1 text-2xl font-bold text-amber-400">{washSaleCount}</div>
          <div className="text-[10px] text-slate-500">lots flagged</div>
        </div>
      </div>

      {washSaleCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-700/50 bg-amber-900/10 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-sm text-amber-400">{washSaleCount} lot{washSaleCount > 1 ? 's' : ''} flagged for potential wash sale — selling within 30 days of purchasing substantially identical securities</span>
        </div>
      )}

      {/* Gain/Loss by ticker */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Gain/Loss by Position</h3>
        <div className="space-y-2">
          {[...new Set(lots.map(l => l.ticker))].map(ticker => {
            const tickerLots = lots.filter(l => l.ticker === ticker);
            const total = tickerLots.reduce((s, l) => s + l.gainLoss, 0);
            const maxAbs = Math.max(...[...new Set(lots.map(l => l.ticker))].map(t => Math.abs(lots.filter(l => l.ticker === t).reduce((s, l) => s + l.gainLoss, 0))));
            const pct = maxAbs > 0 ? Math.abs(total) / maxAbs * 100 : 0;
            return (
              <div key={ticker} className="flex items-center gap-2">
                <span className="w-12 text-xs font-mono text-indigo-400">{ticker}</span>
                <div className="flex-1">
                  <div className="h-4 rounded-full bg-slate-700">
                    <div className={cn('h-4 rounded-full', total >= 0 ? 'bg-emerald-500/40' : 'bg-red-500/40')}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className={cn('w-20 text-right text-xs font-medium', total >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {total >= 0 ? '+' : ''}${(total / 1000).toFixed(1)}K
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
        {(['All', 'Gains', 'Losses', 'Harvestable', 'Wash Sale'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('rounded-md px-3 py-1.5 text-xs font-medium', filter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>
            {f}
          </button>
        ))}
      </div>

      {/* Tax lot table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Shares</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Cost Basis</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Current</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Gain/Loss</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">%</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Type</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Purchased</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Days</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.map((l, i) => (
              <tr key={`${l.ticker}-${i}`} className={cn('bg-slate-800 hover:bg-slate-750', l.washSaleRisk && 'bg-amber-900/5')}>
                <td className="px-3 py-2 text-xs font-bold text-indigo-400">{l.ticker}</td>
                <td className="px-3 py-2 text-right text-xs text-slate-300">{l.shares}</td>
                <td className="px-3 py-2 text-right text-xs text-slate-300">${l.costBasis}</td>
                <td className="px-3 py-2 text-right text-xs text-white font-medium">${l.currentPrice}</td>
                <td className={cn('px-3 py-2 text-right text-xs font-medium', l.gainLoss >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {l.gainLoss >= 0 ? '+' : ''}${(l.gainLoss / 1000).toFixed(1)}K
                </td>
                <td className={cn('px-3 py-2 text-right text-xs font-medium', l.gainLossPct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {l.gainLossPct >= 0 ? '+' : ''}{l.gainLossPct}%
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium',
                    l.gainType === 'Long-Term' ? 'bg-blue-900/40 text-blue-400' : 'bg-slate-700 text-slate-300'
                  )}>{l.gainType === 'Long-Term' ? 'LT' : 'ST'}</span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-400">{l.purchaseDate}</td>
                <td className="px-3 py-2 text-right text-xs text-slate-500">{l.daysHeld}</td>
                <td className="px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {l.harvestable && <span className="text-[8px] font-bold text-emerald-400">HARVEST</span>}
                    {l.washSaleRisk && <AlertTriangle className="h-3 w-3 text-amber-400" />}
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
