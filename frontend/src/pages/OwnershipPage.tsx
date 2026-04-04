import { useState } from 'react';
import { UserCheck, Building2, Users, Briefcase, Search, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useOwnership } from '../hooks/useOwnership';
import { useFloat } from '../hooks/useFloat';

const QUICK_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM'];

function fmt(n: number, decimals = 1): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(decimals)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(decimals)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(decimals)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(decimals)}K`;
  return n.toFixed(decimals);
}

export function OwnershipPage() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [tickerInput, setTickerInput] = useState('');
  const [expandedInst, setExpandedInst] = useState<string | null>(null);

  const ownership = useOwnership(selectedTicker, 20);
  const floatData = useFloat(selectedTicker);

  const selectTicker = (t: string) => {
    setSelectedTicker(t.toUpperCase());
    setTickerInput('');
    setExpandedInst(null);
  };

  const institutions = ownership.data?.data?.institutions ?? [];
  const float = floatData.data?.data;

  // Aggregate stats across all institutions
  const totalValue = institutions.reduce(
    (sum, inst) => sum + inst.holdings.reduce((s, h) => s + h.value, 0),
    0,
  );
  const totalShares = institutions.reduce(
    (sum, inst) => sum + inst.holdings.reduce((s, h) => s + h.shares, 0),
    0,
  );

  const isLoading = ownership.isLoading || floatData.isLoading;
  const isError = ownership.isError || floatData.isError;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <UserCheck className="h-6 w-6 text-violet-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Ownership Structure</h1>
          <p className="text-sm text-slate-400">Institutional ownership, float data, and voting power from 13F filings</p>
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
            className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
          />
        </div>
        {QUICK_TICKERS.map(t => (
          <button
            key={t}
            onClick={() => selectTicker(t)}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
              selectedTicker === t
                ? 'bg-violet-600 text-white'
                : 'border border-slate-700 text-slate-400 hover:text-white',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading ownership data…</span>
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-xl border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          Failed to load ownership data for <span className="font-semibold">{selectedTicker}</span>. Please try again.
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Float summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                label: 'Outstanding Shares',
                value: float ? fmt(float.outstanding_shares) : '—',
                color: 'text-amber-400',
                bg: 'bg-amber-500',
                icon: <Users className="h-4 w-4" />,
                sub: 'Total issued shares',
              },
              {
                label: 'Float Shares',
                value: float ? fmt(float.float_shares) : '—',
                color: 'text-blue-400',
                bg: 'bg-blue-500',
                icon: <Building2 className="h-4 w-4" />,
                sub: 'Publicly tradable shares',
              },
              {
                label: 'Free Float',
                value: float ? `${float.free_float.toFixed(1)}%` : '—',
                color: 'text-emerald-400',
                bg: 'bg-emerald-500',
                icon: <Briefcase className="h-4 w-4" />,
                sub: 'Float as % of outstanding',
              },
            ].map(seg => (
              <div key={seg.label} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="flex items-center gap-2 text-slate-400">
                  {seg.icon}
                  <span className="text-xs uppercase tracking-wider">{seg.label}</span>
                </div>
                <div className={cn('mt-2 text-2xl font-bold', seg.color)}>{seg.value}</div>
                <div className="mt-1 text-xs text-slate-500">{seg.sub}</div>
                {float && seg.label === 'Free Float' && (
                  <div className="mt-3 h-2 rounded-full bg-slate-700">
                    <div
                      className={cn('h-2 rounded-full', seg.bg)}
                      style={{ width: `${Math.min(float.free_float, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Aggregate ownership stats */}
          {institutions.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Institutions (13F)', value: institutions.length.toString() },
                { label: 'Total Inst. Shares', value: fmt(totalShares) },
                { label: 'Total Inst. Value', value: `$${fmt(totalValue)}` },
                {
                  label: 'Inst. Ownership',
                  value: float && float.outstanding_shares > 0
                    ? `${((totalShares / float.outstanding_shares) * 100).toFixed(1)}%`
                    : '—',
                },
              ].map(c => (
                <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
                  <div className="mt-1 text-lg font-bold text-white">{c.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Institutional holders table */}
          {institutions.length > 0 ? (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-white">
                Institutional Holders — {selectedTicker}
              </h2>
              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-700 bg-slate-800/50">
                    <tr>
                      <th className="w-6 px-3 py-2" />
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Institution</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Filing Date</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Positions</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Total Value</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Total Shares</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {institutions.map(inst => {
                      const instValue = inst.holdings.reduce((s, h) => s + h.value, 0);
                      const instShares = inst.holdings.reduce((s, h) => s + h.shares, 0);
                      const isExpanded = expandedInst === inst.cik;
                      return (
                        <>
                          <tr
                            key={inst.cik}
                            className="bg-slate-800 hover:bg-slate-750 cursor-pointer"
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
                            <td className="px-3 py-2 text-right text-xs text-slate-300">${fmt(instValue * 1000)}</td>
                            <td className="px-3 py-2 text-right text-xs text-slate-300">{fmt(instShares)}</td>
                          </tr>
                          {isExpanded && inst.holdings.length > 0 && (
                            <tr key={`${inst.cik}-expanded`} className="bg-slate-900/60">
                              <td colSpan={6} className="px-6 pb-3 pt-1">
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
                                    {inst.holdings.slice(0, 15).map((h, i) => (
                                      <tr key={i} className="hover:bg-slate-800/40">
                                        <td className="py-1 pr-3 text-slate-300">{h.name}</td>
                                        <td className="py-1 pr-3 font-mono text-violet-400">{h.ticker || '—'}</td>
                                        <td className="py-1 pr-3 text-right text-slate-300">{fmt(h.shares)}</td>
                                        <td className="py-1 pr-3 text-right text-slate-300">{fmt(h.value)}</td>
                                        <td className="py-1 pr-3 text-right text-slate-400">{fmt(h.sole_voting)}</td>
                                        <td className="py-1 pr-3 text-right text-slate-400">{fmt(h.shared_voting)}</td>
                                        <td className="py-1 text-right text-slate-400">{fmt(h.no_voting)}</td>
                                      </tr>
                                    ))}
                                    {inst.holdings.length > 15 && (
                                      <tr>
                                        <td colSpan={7} className="py-1 text-center text-slate-500">
                                          +{inst.holdings.length - 15} more holdings
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
              No institutional holdings found for <span className="font-semibold text-white">{selectedTicker}</span>.
            </div>
          )}
        </>
      )}
    </div>
  );
}
