import { useState, useMemo } from 'react';
import { Calculator, Plus, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';
import { cn } from '../lib/utils';
import type { PriceData } from '../lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lot {
  id: string;
  ticker: string;
  shares: number;
  costBasis: number;   // per share
  purchaseDate: string;
}

type GainType = 'Short-Term' | 'Long-Term';

interface EnrichedLot extends Lot {
  currentPrice: number | null;
  gainLoss: number | null;
  gainLossPct: number | null;
  gainType: GainType;
  daysHeld: number;
  harvestable: boolean;
}

type FilterMode = 'All' | 'Gains' | 'Losses' | 'Harvestable';

// ─── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'eugene_tax_lots_v2';

function loadLots(): Lot[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLots(lots: Lot[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lots));
  } catch { /* ignore */ }
}

// ─── Hook: fetch current price per ticker ─────────────────────────────────────

function useTickerPrice(ticker: string) {
  return useQuery<PriceData>({
    queryKey: ['prices', ticker],
    queryFn: () => eugeneApi<PriceData>(`/v1/sec/${ticker}/prices`),
    enabled: !!ticker,
    staleTime: 60 * 1000,
  });
}

// ─── Sub-component: one price fetcher ────────────────────────────────────────

function TickerPriceFetcher({
  ticker,
  onPrice,
}: {
  ticker: string;
  onPrice: (ticker: string, price: number | null) => void;
}) {
  const { data } = useTickerPrice(ticker);
  // Call onPrice whenever data changes — parent deduplicates
  useMemo(() => {
    onPrice(ticker, data?.price ?? null);
  }, [data, ticker]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TaxLotPage() {
  const [lots, setLots] = useState<Lot[]>(loadLots);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [filter, setFilter] = useState<FilterMode>('All');

  // Form state for adding a new lot
  const [newTicker, setNewTicker] = useState('');
  const [newShares, setNewShares] = useState('');
  const [newCostBasis, setNewCostBasis] = useState('');
  const [newDate, setNewDate] = useState('');
  const [formError, setFormError] = useState('');

  const uniqueTickers = useMemo(() => [...new Set(lots.map((l) => l.ticker))], [lots]);

  function handlePrice(ticker: string, price: number | null) {
    setPrices((prev) => {
      if (prev[ticker] === price) return prev;
      return { ...prev, [ticker]: price };
    });
  }

  function addLot() {
    const ticker = newTicker.trim().toUpperCase();
    const shares = parseFloat(newShares);
    const costBasis = parseFloat(newCostBasis);
    const date = newDate;

    if (!ticker) { setFormError('Ticker required'); return; }
    if (isNaN(shares) || shares <= 0) { setFormError('Shares must be > 0'); return; }
    if (isNaN(costBasis) || costBasis <= 0) { setFormError('Cost basis must be > 0'); return; }
    if (!date) { setFormError('Purchase date required'); return; }

    setFormError('');
    const lot: Lot = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ticker,
      shares,
      costBasis,
      purchaseDate: date,
    };
    const updated = [...lots, lot];
    setLots(updated);
    saveLots(updated);
    setNewTicker('');
    setNewShares('');
    setNewCostBasis('');
    setNewDate('');
  }

  function removeLot(id: string) {
    const updated = lots.filter((l) => l.id !== id);
    setLots(updated);
    saveLots(updated);
  }

  // Enrich lots with live prices
  const enriched: EnrichedLot[] = useMemo(() => {
    const today = new Date();
    return lots.map((lot) => {
      const currentPrice = prices[lot.ticker] ?? null;
      const purchase = new Date(lot.purchaseDate);
      const daysHeld = Math.floor((today.getTime() - purchase.getTime()) / 86400000);
      const gainType: GainType = daysHeld > 365 ? 'Long-Term' : 'Short-Term';

      let gainLoss: number | null = null;
      let gainLossPct: number | null = null;
      if (currentPrice !== null) {
        gainLoss = (currentPrice - lot.costBasis) * lot.shares;
        gainLossPct = ((currentPrice - lot.costBasis) / lot.costBasis) * 100;
      }

      return {
        ...lot,
        currentPrice,
        gainLoss,
        gainLossPct,
        gainType,
        daysHeld,
        harvestable: gainLoss !== null && gainLoss < -500,
      };
    });
  }, [lots, prices]);

  const filtered = enriched.filter((l) => {
    if (filter === 'Gains') return l.gainLoss !== null && l.gainLoss >= 0;
    if (filter === 'Losses') return l.gainLoss !== null && l.gainLoss < 0;
    if (filter === 'Harvestable') return l.harvestable;
    return true;
  });

  // Summary stats (over all enriched, not filtered)
  const withPrice = enriched.filter((l) => l.gainLoss !== null);
  const totalGains = withPrice.filter((l) => l.gainLoss! >= 0).reduce((s, l) => s + l.gainLoss!, 0);
  const totalLosses = withPrice.filter((l) => l.gainLoss! < 0).reduce((s, l) => s + l.gainLoss!, 0);
  const netGain = totalGains + totalLosses;
  const harvestableValue = withPrice.filter((l) => l.harvestable).reduce((s, l) => s + l.gainLoss!, 0);
  const stGains = withPrice.filter((l) => l.gainType === 'Short-Term' && l.gainLoss! >= 0).reduce((s, l) => s + l.gainLoss!, 0);
  const ltGains = withPrice.filter((l) => l.gainType === 'Long-Term' && l.gainLoss! >= 0).reduce((s, l) => s + l.gainLoss!, 0);

  const pendingPrices = uniqueTickers.some((t) => prices[t] === undefined);

  return (
    <div className="space-y-6">
      {/* Hidden price fetchers — one per unique ticker */}
      {uniqueTickers.map((t) => (
        <TickerPriceFetcher key={t} ticker={t} onPrice={handlePrice} />
      ))}

      {/* Header */}
      <div className="flex items-center gap-3">
        <Calculator className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Tax Lot Tracker</h1>
          <p className="text-sm text-slate-400">
            Track lots, compute gains/losses, identify harvestable losses
          </p>
        </div>
        {pendingPrices && lots.length > 0 && (
          <Loader2 className="ml-auto h-4 w-4 animate-spin text-slate-500" />
        )}
      </div>

      {/* Add lot form */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
        <h3 className="mb-4 text-sm font-semibold text-white">Add Tax Lot</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Ticker</label>
            <input
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value.toUpperCase().replace(/[^A-Z.]/g, ''))}
              placeholder="AAPL"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm font-mono text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Shares</label>
            <input
              type="number"
              value={newShares}
              onChange={(e) => setNewShares(e.target.value)}
              placeholder="100"
              min="0"
              step="any"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Cost Basis / share ($)</label>
            <input
              type="number"
              value={newCostBasis}
              onChange={(e) => setNewCostBasis(e.target.value)}
              placeholder="150.00"
              min="0"
              step="0.01"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Purchase Date</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
        {formError && (
          <p className="mt-2 text-xs text-red-400">{formError}</p>
        )}
        <button
          onClick={addLot}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" /> Add Lot
        </button>
      </div>

      {lots.length === 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 py-12 text-center text-sm text-slate-500">
          No lots yet. Add a tax lot above to get started.
        </div>
      )}

      {lots.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">Net Gain / Loss</div>
              <div
                className={cn(
                  'mt-1 text-2xl font-bold',
                  netGain >= 0 ? 'text-emerald-400' : 'text-red-400',
                )}
              >
                {netGain >= 0 ? '+' : ''}${(Math.abs(netGain) / 1000).toFixed(1)}K
              </div>
              {pendingPrices && <div className="text-[10px] text-slate-500 mt-0.5">loading prices…</div>}
            </div>
            <div className="rounded-xl border border-emerald-700/50 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">Total Gains</div>
              <div className="mt-1 text-2xl font-bold text-emerald-400">
                +${(totalGains / 1000).toFixed(1)}K
              </div>
              <div className="text-[10px] text-slate-500">
                ST: ${(stGains / 1000).toFixed(1)}K · LT: ${(ltGains / 1000).toFixed(1)}K
              </div>
            </div>
            <div className="rounded-xl border border-red-700/50 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">Total Losses</div>
              <div className="mt-1 text-2xl font-bold text-red-400">
                ${(totalLosses / 1000).toFixed(1)}K
              </div>
              <div className="text-[10px] text-slate-500">{withPrice.filter((l) => l.gainLoss! < 0).length} losing lots</div>
            </div>
            <div className="rounded-xl border border-amber-700/50 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">Harvestable</div>
              <div className="mt-1 text-2xl font-bold text-amber-400">
                ${(Math.abs(harvestableValue) / 1000).toFixed(1)}K
              </div>
              <div className="text-[10px] text-slate-500">
                {enriched.filter((l) => l.harvestable).length} lots eligible
              </div>
            </div>
          </div>

          {/* Gain/loss per position bar chart */}
          {uniqueTickers.length > 0 && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <h3 className="mb-3 text-sm font-semibold text-white">Gain / Loss by Position</h3>
              <div className="space-y-2">
                {uniqueTickers.map((ticker) => {
                  const tickerLots = enriched.filter((l) => l.ticker === ticker);
                  const total = tickerLots.reduce((s, l) => s + (l.gainLoss ?? 0), 0);
                  const allTotals = uniqueTickers.map((t) =>
                    Math.abs(enriched.filter((l) => l.ticker === t).reduce((s, l) => s + (l.gainLoss ?? 0), 0)),
                  );
                  const maxAbs = Math.max(...allTotals, 1);
                  const pct = (Math.abs(total) / maxAbs) * 100;
                  return (
                    <div key={ticker} className="flex items-center gap-3">
                      <span className="w-14 font-mono text-xs text-indigo-400">{ticker}</span>
                      <div className="flex-1">
                        <div className="h-4 overflow-hidden rounded-full bg-slate-700">
                          <div
                            className={cn(
                              'h-4 rounded-full transition-all',
                              total >= 0 ? 'bg-emerald-500/50' : 'bg-red-500/50',
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span
                        className={cn(
                          'w-20 text-right text-xs font-medium',
                          total >= 0 ? 'text-emerald-400' : 'text-red-400',
                        )}
                      >
                        {total >= 0 ? '+' : ''}${(total / 1000).toFixed(1)}K
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
            {(['All', 'Gains', 'Losses', 'Harvestable'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  filter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white',
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Lot table */}
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Shares</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Cost / share</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Current</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Gain / Loss</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">%</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Type</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Purchased</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Days</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Flag</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.map((l) => (
                  <tr
                    key={l.id}
                    className={cn(
                      'bg-slate-800 hover:bg-slate-700/50',
                      l.harvestable && 'bg-amber-900/5',
                    )}
                  >
                    <td className="px-3 py-2 font-mono text-xs font-bold text-indigo-400">
                      {l.ticker}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-300">
                      {l.shares}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-300">
                      ${l.costBasis.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-white">
                      {l.currentPrice !== null ? (
                        `$${l.currentPrice.toFixed(2)}`
                      ) : (
                        <Loader2 className="ml-auto h-3 w-3 animate-spin text-slate-500" />
                      )}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-mono text-xs font-medium',
                        l.gainLoss === null
                          ? 'text-slate-500'
                          : l.gainLoss >= 0
                            ? 'text-emerald-400'
                            : 'text-red-400',
                      )}
                    >
                      {l.gainLoss !== null
                        ? `${l.gainLoss >= 0 ? '+' : ''}$${Math.abs(l.gainLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : '—'}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-mono text-xs font-medium',
                        l.gainLossPct === null
                          ? 'text-slate-500'
                          : l.gainLossPct >= 0
                            ? 'text-emerald-400'
                            : 'text-red-400',
                      )}
                    >
                      {l.gainLossPct !== null
                        ? `${l.gainLossPct >= 0 ? '+' : ''}${l.gainLossPct.toFixed(2)}%`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-medium',
                          l.gainType === 'Long-Term'
                            ? 'bg-blue-900/40 text-blue-400'
                            : 'bg-slate-700 text-slate-300',
                        )}
                      >
                        {l.gainType === 'Long-Term' ? 'LT' : 'ST'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400">{l.purchaseDate}</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-500">{l.daysHeld}</td>
                    <td className="px-3 py-2 text-center">
                      {l.harvestable && (
                        <span className="text-[9px] font-bold text-emerald-400">HARVEST</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeLot(l.id)}
                        className="text-slate-600 hover:text-red-400"
                        title="Remove lot"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-500">
                No lots match this filter.
              </div>
            )}
          </div>

          <p className="text-[10px] text-slate-600">
            Harvestable = unrealised loss &gt; $500. Short-term = held ≤ 365 days. Not financial advice.
          </p>
        </>
      )}
    </div>
  );
}
