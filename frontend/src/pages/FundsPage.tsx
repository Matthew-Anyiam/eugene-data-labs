import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FolderSearch, Loader2, AlertTriangle, TrendingUp, TrendingDown, Search } from 'lucide-react';
import { useScreener } from '../hooks/useScreener';
import { cn } from '../lib/utils';
import type { ScreenerResult } from '../lib/types';

const SECTORS = [
  'All', 'Technology', 'Healthcare', 'Financial Services',
  'Consumer Cyclical', 'Industrials', 'Energy', 'Real Estate',
  'Communication Services', 'Consumer Defensive', 'Utilities', 'Basic Materials',
] as const;

type SortKey = 'market_cap' | 'price' | 'volume' | 'beta' | 'name';

function fmtCap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtVol(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toLocaleString();
}

function capTier(cap: number): { label: string; color: string } {
  if (cap >= 200e9) return { label: 'Mega', color: 'bg-blue-500/20 text-blue-300' };
  if (cap >= 10e9) return { label: 'Large', color: 'bg-emerald-500/20 text-emerald-300' };
  if (cap >= 2e9) return { label: 'Mid', color: 'bg-amber-500/20 text-amber-300' };
  return { label: 'Small', color: 'bg-slate-600/50 text-slate-300' };
}

export function FundsPage() {
  const [sector, setSector] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('market_cap');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [minCapB, setMinCapB] = useState('');

  const { data, isLoading, error } = useScreener({ limit: 50 });

  const results: ScreenerResult[] = data?.results ?? [];

  const filtered = useMemo(() => {
    let list = [...results];
    if (sector !== 'All') list = list.filter(r => r.sector === sector);
    if (search) {
      const q = search.toUpperCase();
      list = list.filter(r => r.ticker.includes(q) || r.name.toLowerCase().includes(search.toLowerCase()));
    }
    if (minCapB) {
      const min = parseFloat(minCapB) * 1e9;
      list = list.filter(r => r.market_cap >= min);
    }
    list.sort((a, b) => {
      let va: number | string, vb: number | string;
      if (sortKey === 'name') { va = a.name; vb = b.name; }
      else if (sortKey === 'market_cap') { va = a.market_cap; vb = b.market_cap; }
      else if (sortKey === 'price') { va = a.price; vb = b.price; }
      else if (sortKey === 'volume') { va = a.volume; vb = b.volume; }
      else { va = a.beta; vb = b.beta; }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortDir === 'desc' ? (vb as number) - (va as number) : (va as number) - (vb as number);
    });
    return list;
  }, [results, sector, search, sortKey, sortDir, minCapB]);

  const stats = useMemo(() => {
    if (filtered.length === 0) return null;
    const totalCap = filtered.reduce((s, r) => s + r.market_cap, 0);
    const avgBeta = filtered.reduce((s, r) => s + (r.beta ?? 0), 0) / filtered.length;
    const sectors = new Set(filtered.map(r => r.sector)).size;
    return { totalCap, avgBeta, sectors };
  }, [filtered]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function SortArrow({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-slate-600"> ↕</span>;
    return <span className="text-blue-400">{sortDir === 'desc' ? ' ↓' : ' ↑'}</span>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <FolderSearch className="h-5 w-5 text-slate-400" />
          <h1 className="text-2xl font-bold tracking-tight text-white">Fund Screener</h1>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Discover large-cap stocks by sector, market cap, and volume
        </p>
      </div>

      {/* Coming soon banner */}
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-blue-400" />
        <p className="text-sm text-blue-300">
          <span className="font-semibold">Mutual fund &amp; ETF screener coming soon.</span>{' '}
          Fund-specific data (AUM, expense ratios, NAV, holdings) is in development.
          Showing discoverable public equities from the stock screener as a proxy.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-3 rounded-lg border border-slate-700 bg-slate-800 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Search className="h-4 w-4 text-slate-500 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search ticker or name..."
            className="rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none w-44"
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            Min Cap ($B):
            <input
              type="number"
              value={minCapB}
              onChange={e => setMinCapB(e.target.value)}
              placeholder="0"
              className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SECTORS.map(s => (
            <button
              key={s}
              onClick={() => setSector(s)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition',
                sector === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      {stats && !isLoading && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
            <p className="text-xs text-slate-400">Matching</p>
            <p className="mt-1 text-lg font-semibold text-white">{filtered.length}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
            <p className="text-xs text-slate-400">Total Market Cap</p>
            <p className="mt-1 text-lg font-semibold text-white">{fmtCap(stats.totalCap)}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
            <p className="text-xs text-slate-400">Avg Beta</p>
            <p className="mt-1 text-lg font-semibold text-white">{stats.avgBeta.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
            <p className="text-xs text-slate-400">Sectors</p>
            <p className="mt-1 text-lg font-semibold text-white">{stats.sectors}</p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading screener data...</span>
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-4 text-sm text-red-300">
          Failed to load screener data. Please try again.
        </div>
      )}

      {!isLoading && filtered.length === 0 && !error && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 px-6 py-12 text-center">
          <p className="text-sm text-slate-400">No results match the current filters.</p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-700 bg-slate-800 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-3">
                  <button onClick={() => toggleSort('name')} className="hover:text-white flex items-center gap-0.5">
                    Company <SortArrow col="name" />
                  </button>
                </th>
                <th className="px-3 py-3">Sector</th>
                <th className="px-3 py-3">Cap Tier</th>
                <th className="px-3 py-3 text-right">
                  <button onClick={() => toggleSort('market_cap')} className="hover:text-white flex items-center gap-0.5 ml-auto">
                    Mkt Cap <SortArrow col="market_cap" />
                  </button>
                </th>
                <th className="px-3 py-3 text-right">
                  <button onClick={() => toggleSort('price')} className="hover:text-white flex items-center gap-0.5 ml-auto">
                    Price <SortArrow col="price" />
                  </button>
                </th>
                <th className="px-3 py-3 text-right">
                  <button onClick={() => toggleSort('volume')} className="hover:text-white flex items-center gap-0.5 ml-auto">
                    Volume <SortArrow col="volume" />
                  </button>
                </th>
                <th className="px-3 py-3 text-right">
                  <button onClick={() => toggleSort('beta')} className="hover:text-white flex items-center gap-0.5 ml-auto">
                    Beta <SortArrow col="beta" />
                  </button>
                </th>
                <th className="px-3 py-3">Exchange</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(stock => {
                const tier = capTier(stock.market_cap);
                const highBeta = stock.beta > 1.5;
                return (
                  <tr
                    key={stock.ticker}
                    className="border-b border-slate-700/50 bg-slate-800/40 hover:bg-slate-700/40 transition"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/company/${stock.ticker}`}
                          className="font-mono text-xs font-bold text-blue-400 hover:text-blue-300"
                        >
                          {stock.ticker}
                        </Link>
                        <span className="max-w-[160px] truncate text-xs text-slate-300" title={stock.name}>
                          {stock.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-400 max-w-[120px] truncate">{stock.sector}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', tier.color)}>
                        {tier.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-white">
                      {fmtCap(stock.market_cap)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums font-mono text-slate-200">
                      ${stock.price.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-300">
                      {fmtVol(stock.volume)}
                    </td>
                    <td className={cn(
                      'px-3 py-2.5 text-right text-xs tabular-nums',
                      highBeta ? 'text-amber-400' : 'text-slate-300',
                    )}>
                      {stock.beta != null ? stock.beta.toFixed(2) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{stock.exchange}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data?.note && (
        <p className="mt-3 text-xs text-slate-500">{data.note}</p>
      )}
    </div>
  );
}
