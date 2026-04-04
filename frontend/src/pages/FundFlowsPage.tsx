import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownUp, Loader2, AlertTriangle, TrendingUp, TrendingDown, Search } from 'lucide-react';
import { useScreener } from '../hooks/useScreener';
import { cn } from '../lib/utils';
import type { ScreenerResult } from '../lib/types';

const SECTORS = [
  'All', 'Technology', 'Healthcare', 'Financial Services',
  'Consumer Cyclical', 'Industrials', 'Energy', 'Communication Services',
] as const;

function fmtCap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtVol(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toLocaleString();
}

export function FundFlowsPage() {
  const [sector, setSector] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const { data, isLoading, error } = useScreener({ volumeMin: 5_000_000, limit: 30 });

  const results: ScreenerResult[] = data?.results ?? [];

  const filtered = useMemo(() => {
    let list = [...results];
    if (sector !== 'All') list = list.filter(r => r.sector === sector);
    if (search) {
      const q = search.toUpperCase();
      list = list.filter(r => r.ticker.includes(q) || r.name.toLowerCase().includes(search.toLowerCase()));
    }
    list.sort((a, b) => sortDir === 'desc' ? b.volume - a.volume : a.volume - b.volume);
    return list;
  }, [results, sector, search, sortDir]);

  const maxVolume = useMemo(() => Math.max(...filtered.map(r => r.volume), 1), [filtered]);
  const totalVolume = useMemo(() => filtered.reduce((s, r) => s + r.volume, 0), [filtered]);

  // Sector volume aggregation
  const sectorVolume = useMemo(() => {
    const map = new Map<string, { volume: number; count: number; cap: number }>();
    filtered.forEach(r => {
      const sec = r.sector || 'Unknown';
      const cur = map.get(sec) ?? { volume: 0, count: 0, cap: 0 };
      cur.volume += r.volume;
      cur.count += 1;
      cur.cap += r.market_cap;
      map.set(sec, cur);
    });
    return [...map.entries()]
      .map(([sec, d]) => ({ sec, ...d }))
      .sort((a, b) => b.volume - a.volume);
  }, [filtered]);

  const maxSectorVol = Math.max(...sectorVolume.map(s => s.volume), 1);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ArrowDownUp className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Fund Flows</h1>
          <p className="text-sm text-slate-400">Volume leaders as institutional money flow proxy</p>
        </div>
      </div>

      {/* Coming soon banner */}
      <div className="flex items-center gap-3 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-4 py-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-indigo-400" />
        <p className="text-sm text-indigo-300">
          <span className="font-semibold">Fund flow data coming soon.</span>{' '}
          ETF creation/redemption flows, net inflows/outflows, and institutional sector rotation data are in development.
          Currently showing high-volume stocks (&ge;5M shares/day) as a money flow proxy.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-40 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {SECTORS.map(s => (
            <button
              key={s}
              onClick={() => setSector(s)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition',
                sector === s ? 'bg-indigo-600 text-white' : 'border border-slate-700 bg-slate-800 text-slate-400 hover:text-white',
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:text-white"
        >
          <ArrowDownUp className="h-3.5 w-3.5" />
          Volume {sortDir === 'desc' ? '↓' : '↑'}
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading volume leaders...</span>
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-4 text-sm text-red-300">
          Failed to load data. Please try again.
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Stocks Shown</div>
              <div className="mt-1 text-2xl font-bold text-white">{filtered.length}</div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Total Volume</div>
              <div className="mt-1 text-2xl font-bold text-indigo-400">{fmtVol(totalVolume)}</div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Top Leader</div>
              <div className="mt-1 text-xl font-bold text-white">
                {filtered[0]?.ticker ?? '—'}
              </div>
              <div className="text-[10px] text-slate-500">{filtered[0] ? fmtVol(filtered[0].volume) : ''}</div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Sectors</div>
              <div className="mt-1 text-2xl font-bold text-white">{sectorVolume.length}</div>
            </div>
          </div>

          {/* Sector volume breakdown */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">Volume by Sector</h3>
            <div className="space-y-2">
              {sectorVolume.map(sv => {
                const pct = maxSectorVol > 0 ? (sv.volume / maxSectorVol) * 100 : 0;
                const sharePct = totalVolume > 0 ? (sv.volume / totalVolume) * 100 : 0;
                return (
                  <div key={sv.sec} className="flex items-center gap-3">
                    <button
                      onClick={() => setSector(sector === sv.sec ? 'All' : sv.sec)}
                      className={cn(
                        'w-44 truncate text-left text-xs transition',
                        sector === sv.sec ? 'text-indigo-300 font-medium' : 'text-slate-400 hover:text-white',
                      )}
                    >
                      {sv.sec}
                    </button>
                    <div className="flex-1 h-4 bg-slate-700 rounded overflow-hidden">
                      <div
                        className={cn('h-full rounded', sector === sv.sec ? 'bg-indigo-500' : 'bg-indigo-500/40')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-20 text-right text-xs font-mono text-slate-300">{fmtVol(sv.volume)}</span>
                    <span className="w-12 text-right text-xs text-slate-500">{sharePct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Volume leaders table */}
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Sector</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Market Cap</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Price</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Beta</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Volume</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">% of Total</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Volume Bar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.map((r, i) => {
                  const barPct = maxVolume > 0 ? (r.volume / maxVolume) * 100 : 0;
                  const sharePct = totalVolume > 0 ? (r.volume / totalVolume) * 100 : 0;
                  const isTop3 = i < 3;
                  const highBeta = r.beta > 1.5;
                  return (
                    <tr key={r.ticker} className={cn('hover:bg-slate-750', isTop3 ? 'bg-indigo-500/5' : 'bg-slate-800')}>
                      <td className="px-3 py-2 text-xs text-slate-500 font-mono">{i + 1}</td>
                      <td className="px-3 py-2">
                        <Link
                          to={`/company/${r.ticker}`}
                          className={cn(
                            'font-mono text-xs font-bold hover:underline',
                            isTop3 ? 'text-indigo-300' : 'text-indigo-400',
                          )}
                        >
                          {r.ticker}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-white max-w-[160px] truncate font-medium" title={r.name}>
                        {r.name}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400 max-w-[120px] truncate">{r.sector}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-300">{fmtCap(r.market_cap)}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums font-mono text-white">
                        ${r.price.toFixed(2)}
                      </td>
                      <td className={cn('px-3 py-2 text-right text-xs tabular-nums', highBeta ? 'text-amber-400' : 'text-slate-400')}>
                        {r.beta != null ? r.beta.toFixed(2) : '—'}
                      </td>
                      <td className={cn(
                        'px-3 py-2 text-right text-xs tabular-nums font-semibold',
                        isTop3 ? 'text-indigo-300' : 'text-white',
                      )}>
                        {fmtVol(r.volume)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-slate-500">{sharePct.toFixed(1)}%</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end">
                          <div className="h-3 w-24 overflow-hidden rounded-full bg-slate-700">
                            <div
                              className={cn('h-3 rounded-full', isTop3 ? 'bg-indigo-500' : 'bg-indigo-500/50')}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data?.note && (
            <p className="text-xs text-slate-500">{data.note}</p>
          )}
        </>
      )}

      {!isLoading && !error && filtered.length === 0 && results.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 px-6 py-12 text-center">
          <p className="text-sm text-slate-400">No results match the current filters.</p>
        </div>
      )}
    </div>
  );
}
