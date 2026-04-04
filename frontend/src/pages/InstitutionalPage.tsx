import { useState, useMemo } from 'react';
import { Building2, Search, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useOwnership } from '../hooks/useOwnership';
import type { InstitutionHolding } from '../hooks/useOwnership';

const QUICK_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM'];

function fmt(n: number, decimals = 1): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(decimals)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(decimals)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(decimals)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(decimals)}K`;
  return n.toFixed(decimals);
}

type SortKey = 'value' | 'shares' | 'positions';
type SortDir = 'asc' | 'desc';

function SortButton({
  label,
  sortKey,
  active,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={cn(
        'text-xs font-medium',
        active ? 'text-orange-400' : 'text-slate-400 hover:text-slate-300',
      )}
    >
      {label} {active && (dir === 'desc' ? '↓' : '↑')}
    </button>
  );
}

function enrichInst(inst: InstitutionHolding) {
  const totalValue = inst.holdings.reduce((s, h) => s + h.value, 0);
  const totalShares = inst.holdings.reduce((s, h) => s + h.shares, 0);
  const totalSoleVoting = inst.holdings.reduce((s, h) => s + h.sole_voting, 0);
  const totalSharedVoting = inst.holdings.reduce((s, h) => s + h.shared_voting, 0);
  const totalNoVoting = inst.holdings.reduce((s, h) => s + h.no_voting, 0);
  return { ...inst, totalValue, totalShares, totalSoleVoting, totalSharedVoting, totalNoVoting };
}

export function InstitutionalPage() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [tickerInput, setTickerInput] = useState('');
  const [expandedInst, setExpandedInst] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const ownership = useOwnership(selectedTicker, 25);

  const selectTicker = (t: string) => {
    setSelectedTicker(t.toUpperCase());
    setTickerInput('');
    setExpandedInst(null);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const institutions = ownership.data?.data?.institutions ?? [];

  const enriched = useMemo(() => {
    const list = institutions.map(enrichInst);
    return list.sort((a, b) => {
      const av = sortKey === 'value' ? a.totalValue : sortKey === 'shares' ? a.totalShares : a.holdings.length;
      const bv = sortKey === 'value' ? b.totalValue : sortKey === 'shares' ? b.totalShares : b.holdings.length;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [institutions, sortKey, sortDir]);

  // Aggregate stats
  const totalValue = enriched.reduce((s, i) => s + i.totalValue, 0);
  const totalShares = enriched.reduce((s, i) => s + i.totalShares, 0);
  const totalPositions = enriched.reduce((s, i) => s + i.holdings.length, 0);
  const topHolder = enriched[0] ?? null;

  // Top 5 holdings by value across all institutions (deduplicated by ticker)
  const topHoldingsByValue = useMemo(() => {
    const map = new Map<string, { name: string; ticker: string; value: number; shares: number }>();
    for (const inst of enriched) {
      for (const h of inst.holdings) {
        const key = h.cusip || h.ticker || h.name;
        const existing = map.get(key);
        if (existing) {
          existing.value += h.value;
          existing.shares += h.shares;
        } else {
          map.set(key, { name: h.name, ticker: h.ticker, value: h.value, shares: h.shares });
        }
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [enriched]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-orange-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Institutional Holdings</h1>
          <p className="text-sm text-slate-400">13F filings, fund positions, and voting power analysis</p>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={tickerInput}
            onChange={e => setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter' && tickerInput) selectTicker(tickerInput); }}
            placeholder="Ticker..."
            className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
          />
        </div>
        {QUICK_TICKERS.map(t => (
          <button
            key={t}
            onClick={() => selectTicker(t)}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
              selectedTicker === t
                ? 'bg-orange-600 text-white'
                : 'border border-slate-700 text-slate-400 hover:text-white',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Loading */}
      {ownership.isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading institutional data…</span>
        </div>
      )}

      {/* Error */}
      {ownership.isError && !ownership.isLoading && (
        <div className="rounded-xl border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          Failed to load institutional holdings for <span className="font-semibold">{selectedTicker}</span>. Please try again.
        </div>
      )}

      {!ownership.isLoading && !ownership.isError && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Institutions', value: enriched.length.toString() },
              { label: 'Total Shares Held', value: fmt(totalShares) },
              { label: 'Total Value ($K)', value: `$${fmt(totalValue * 1000)}` },
              { label: 'Total Positions', value: totalPositions.toString() },
            ].map(c => (
              <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
                <div className="mt-1 text-lg font-bold text-white">{c.value}</div>
              </div>
            ))}
          </div>

          {/* Top holder callout + top holdings */}
          {topHolder && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">Largest Holder</div>
                <div className="text-base font-bold text-white">{topHolder.investor_name}</div>
                <div className="mt-1 text-sm text-orange-400">${fmt(topHolder.totalValue * 1000)} total value</div>
                <div className="mt-1 text-xs text-slate-400">
                  {topHolder.holdings.length} positions · {fmt(topHolder.totalShares)} shares · Filed {topHolder.form_date}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Sole Voting', value: fmt(topHolder.totalSoleVoting) },
                    { label: 'Shared Voting', value: fmt(topHolder.totalSharedVoting) },
                    { label: 'No Voting', value: fmt(topHolder.totalNoVoting) },
                  ].map(v => (
                    <div key={v.label} className="rounded-lg bg-slate-900/50 p-2">
                      <div className="text-[10px] text-slate-500">{v.label}</div>
                      <div className="text-xs font-semibold text-slate-200">{v.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {topHoldingsByValue.length > 0 && (
                <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                  <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">
                    Top Holdings by Aggregate Value
                  </div>
                  <div className="space-y-2">
                    {topHoldingsByValue.map((h, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-600">{i + 1}.</span>
                          <span className="text-xs text-slate-300 truncate max-w-[140px]">{h.name}</span>
                          {h.ticker && (
                            <span className="font-mono text-[10px] text-orange-400">{h.ticker}</span>
                          )}
                        </div>
                        <span className="text-xs text-slate-300">${fmt(h.value * 1000)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Holdings table */}
          {enriched.length > 0 ? (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-white">
                All Institutional Holders — {selectedTicker}
              </h2>
              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-700 bg-slate-800/50">
                    <tr>
                      <th className="w-6 px-3 py-2" />
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Institution</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Filing Date</th>
                      <th className="px-3 py-2 text-right">
                        <SortButton label="Positions" sortKey="positions" active={sortKey === 'positions'} dir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="px-3 py-2 text-right">
                        <SortButton label="Shares" sortKey="shares" active={sortKey === 'shares'} dir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="px-3 py-2 text-right">
                        <SortButton label="Value" sortKey="value" active={sortKey === 'value'} dir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Sole Voting</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Shared Voting</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {enriched.map(inst => {
                      const isExpanded = expandedInst === inst.cik;
                      return (
                        <>
                          <tr
                            key={inst.cik}
                            className="cursor-pointer bg-slate-800 hover:bg-slate-750"
                            onClick={() => setExpandedInst(isExpanded ? null : inst.cik)}
                          >
                            <td className="px-3 py-2 text-slate-500">
                              {isExpanded
                                ? <ChevronDown className="h-3.5 w-3.5" />
                                : <ChevronRight className="h-3.5 w-3.5" />}
                            </td>
                            <td className="px-3 py-2 text-xs font-medium text-white">{inst.investor_name}</td>
                            <td className="px-3 py-2 text-right text-xs text-slate-400">{inst.form_date}</td>
                            <td className="px-3 py-2 text-right text-xs text-slate-300">{inst.holdings.length}</td>
                            <td className="px-3 py-2 text-right text-xs text-slate-300">{fmt(inst.totalShares)}</td>
                            <td className="px-3 py-2 text-right text-xs text-orange-400 font-medium">
                              ${fmt(inst.totalValue * 1000)}
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-slate-400">{fmt(inst.totalSoleVoting)}</td>
                            <td className="px-3 py-2 text-right text-xs text-slate-400">{fmt(inst.totalSharedVoting)}</td>
                          </tr>
                          {isExpanded && inst.holdings.length > 0 && (
                            <tr key={`${inst.cik}-detail`} className="bg-slate-900/60">
                              <td colSpan={8} className="px-6 pb-3 pt-1">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-700/50">
                                      <th className="pb-1 text-left font-medium text-slate-500">Security</th>
                                      <th className="pb-1 text-left font-medium text-slate-500">Ticker</th>
                                      <th className="pb-1 text-right font-medium text-slate-500">Shares</th>
                                      <th className="pb-1 text-right font-medium text-slate-500">Value ($K)</th>
                                      <th className="pb-1 text-right font-medium text-slate-500">Sole Voting</th>
                                      <th className="pb-1 text-right font-medium text-slate-500">Shared Voting</th>
                                      <th className="pb-1 text-right font-medium text-slate-500">No Voting</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-700/30">
                                    {inst.holdings.slice(0, 20).map((h, i) => (
                                      <tr key={i} className="hover:bg-slate-800/40">
                                        <td className="py-1 pr-3 text-slate-300">{h.name}</td>
                                        <td className="py-1 pr-3 font-mono text-orange-400">{h.ticker || '—'}</td>
                                        <td className="py-1 pr-3 text-right text-slate-300">{fmt(h.shares)}</td>
                                        <td className="py-1 pr-3 text-right text-slate-300">{fmt(h.value)}</td>
                                        <td className="py-1 pr-3 text-right text-slate-400">{fmt(h.sole_voting)}</td>
                                        <td className="py-1 pr-3 text-right text-slate-400">{fmt(h.shared_voting)}</td>
                                        <td className="py-1 text-right text-slate-400">{fmt(h.no_voting)}</td>
                                      </tr>
                                    ))}
                                    {inst.holdings.length > 20 && (
                                      <tr>
                                        <td colSpan={7} className="py-1 text-center text-slate-500">
                                          +{inst.holdings.length - 20} more holdings
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-8 text-center text-sm text-slate-400">
              No institutional holders found for <span className="font-semibold text-white">{selectedTicker}</span>.
            </div>
          )}
        </>
      )}
    </div>
  );
}
