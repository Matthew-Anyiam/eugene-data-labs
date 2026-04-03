import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Plus, X, Trash2, Download, ArrowUpDown, TrendingUp, TrendingDown, Edit3, Check } from 'lucide-react';
import { useWatchlist } from '../hooks/useWatchlist';
import { usePrices } from '../hooks/usePrices';
import { cn, formatPrice, formatPercent } from '../lib/utils';
import type { PriceData } from '../lib/types';

// ---------------------------------------------------------------------------
// Multi-watchlist localStorage management
// ---------------------------------------------------------------------------

const LISTS_KEY = 'eugene_watchlist_lists';

interface WatchlistList {
  id: string;
  name: string;
  tickers: string[];
}

function loadLists(): WatchlistList[] {
  try {
    const stored = localStorage.getItem(LISTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveLists(lists: WatchlistList[]) {
  try {
    localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
  } catch {
    // localStorage might be full or unavailable
  }
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

type SortField = 'ticker' | 'price' | 'change_percent' | 'volume';
type SortDir = 'asc' | 'desc';

function sortTickers(
  tickers: string[],
  priceMap: Map<string, PriceData>,
  field: SortField,
  dir: SortDir,
): string[] {
  const sorted = [...tickers].sort((a, b) => {
    const pa = priceMap.get(a);
    const pb = priceMap.get(b);
    if (field === 'ticker') return a.localeCompare(b);
    const va = pa ? pa[field] : 0;
    const vb = pb ? pb[field] : 0;
    return (va as number) - (vb as number);
  });
  return dir === 'desc' ? sorted.reverse() : sorted;
}

// ---------------------------------------------------------------------------
// TickerRow -- calls usePrices per ticker (hooks-compliant)
// ---------------------------------------------------------------------------

function TickerRow({
  ticker,
  onRemove,
  onData,
}: {
  ticker: string;
  onRemove: () => void;
  onData: (ticker: string, data: PriceData) => void;
}) {
  const { data: prices, isLoading } = usePrices(ticker);

  useEffect(() => {
    if (prices) onData(ticker, prices);
  }, [prices, ticker, onData]);

  const changeColor = prices
    ? prices.change >= 0
      ? 'text-emerald-400'
      : 'text-red-400'
    : 'text-slate-500';

  return (
    <tr className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
      <td className="px-4 py-3 font-medium">
        <Link
          to={`/company/${ticker}`}
          className="text-blue-400 hover:text-blue-300 hover:underline"
        >
          {ticker}
        </Link>
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {isLoading ? <Shimmer /> : formatPrice(prices?.price)}
      </td>
      <td className={cn('px-4 py-3 text-right tabular-nums', changeColor)}>
        {isLoading ? (
          <Shimmer />
        ) : (
          <>
            {prices && prices.change >= 0 ? '+' : ''}
            {prices?.change?.toFixed(2) ?? '---'}
          </>
        )}
      </td>
      <td className={cn('px-4 py-3 text-right tabular-nums', changeColor)}>
        {isLoading ? <Shimmer /> : formatPercent(prices?.change_percent)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-300">
        {isLoading ? <Shimmer /> : formatPrice(prices?.avg_50)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-300">
        {isLoading ? <Shimmer /> : formatPrice(prices?.avg_200)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-300">
        {isLoading ? <Shimmer /> : formatVolume(prices?.volume)}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={onRemove}
          className="rounded p-1 text-slate-500 hover:bg-red-900/30 hover:text-red-400 transition-colors"
          title={`Remove ${ticker}`}
        >
          <X className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

function Shimmer() {
  return (
    <span className="inline-block h-4 w-16 animate-pulse rounded bg-slate-700" />
  );
}

function formatVolume(v: number | undefined | null): string {
  if (v === undefined || v === null) return '---';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString();
}

// ---------------------------------------------------------------------------
// WatchlistPage
// ---------------------------------------------------------------------------

export function WatchlistPage() {
  // Global (default) watchlist via the shared hook
  const { tickers: defaultTickers, addTicker, removeTicker } = useWatchlist();

  // Multi-watchlist state
  const [customLists, setCustomLists] = useState<WatchlistList[]>(loadLists);
  const [activeTab, setActiveTab] = useState<string>('default');
  const [newListName, setNewListName] = useState('');
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Add ticker form
  const [input, setInput] = useState('');

  // Sort state
  const [sortField, setSortField] = useState<SortField>('ticker');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Aggregated price data reported by TickerRow children
  const [priceMap, setPriceMap] = useState<Map<string, PriceData>>(new Map());

  const handlePriceData = useCallback((ticker: string, data: PriceData) => {
    setPriceMap((prev) => {
      const next = new Map(prev);
      next.set(ticker, data);
      return next;
    });
  }, []);

  // Determine active tickers
  const activeTickers = useMemo(() => {
    if (activeTab === 'default') return defaultTickers;
    const list = customLists.find((l) => l.id === activeTab);
    return list ? list.tickers : [];
  }, [activeTab, defaultTickers, customLists]);

  // Sorted tickers
  const sortedTickers = useMemo(
    () => sortTickers(activeTickers, priceMap, sortField, sortDir),
    [activeTickers, priceMap, sortField, sortDir],
  );

  // Summary stats
  const summary = useMemo(() => {
    const loaded = activeTickers
      .map((t) => priceMap.get(t))
      .filter((p): p is PriceData => !!p);
    if (loaded.length === 0) return null;
    const avgChange =
      loaded.reduce((s, p) => s + p.change_percent, 0) / loaded.length;
    const best = loaded.reduce((a, b) =>
      b.change_percent > a.change_percent ? b : a,
    );
    const worst = loaded.reduce((a, b) =>
      b.change_percent < a.change_percent ? b : a,
    );
    return { total: activeTickers.length, avgChange, best, worst };
  }, [activeTickers, priceMap]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleAdd = useCallback(() => {
    const t = input.trim().toUpperCase();
    if (!t) return;
    if (activeTab === 'default') {
      addTicker(t);
    } else {
      setCustomLists((prev) => {
        const next = prev.map((l) => {
          if (l.id !== activeTab) return l;
          if (l.tickers.includes(t)) return l;
          return { ...l, tickers: [...l.tickers, t] };
        });
        saveLists(next);
        return next;
      });
    }
    setInput('');
  }, [input, activeTab, addTicker]);

  const handleRemove = useCallback(
    (ticker: string) => {
      if (activeTab === 'default') {
        removeTicker(ticker);
      } else {
        setCustomLists((prev) => {
          const next = prev.map((l) => {
            if (l.id !== activeTab) return l;
            return { ...l, tickers: l.tickers.filter((t) => t !== ticker) };
          });
          saveLists(next);
          return next;
        });
      }
    },
    [activeTab, removeTicker],
  );

  const handleCreateList = useCallback(() => {
    const name = newListName.trim();
    if (!name) return;
    const id = `list_${Date.now()}`;
    setCustomLists((prev) => {
      const next = [...prev, { id, name, tickers: [] }];
      saveLists(next);
      return next;
    });
    setNewListName('');
    setActiveTab(id);
  }, [newListName]);

  const handleDeleteList = useCallback(
    (id: string) => {
      setCustomLists((prev) => {
        const next = prev.filter((l) => l.id !== id);
        saveLists(next);
        return next;
      });
      if (activeTab === id) setActiveTab('default');
    },
    [activeTab],
  );

  const handleRenameList = useCallback(
    (id: string) => {
      const name = editingName.trim();
      if (!name) {
        setEditingListId(null);
        return;
      }
      setCustomLists((prev) => {
        const next = prev.map((l) => (l.id === id ? { ...l, name } : l));
        saveLists(next);
        return next;
      });
      setEditingListId(null);
    },
    [editingName],
  );

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir('asc');
      }
    },
    [sortField],
  );

  const handleExport = useCallback(() => {
    const header = 'Ticker,Price,Change,Change%,MA50,MA200,Volume';
    const rows = activeTickers.map((t) => {
      const p = priceMap.get(t);
      if (!p) return `${t},,,,,,,`;
      return `${t},${p.price},${p.change},${p.change_percent},${p.avg_50},${p.avg_200},${p.volume}`;
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watchlist_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeTickers, priceMap, activeTab]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => toggleSort(field)}
      className={cn(
        'flex items-center gap-1 text-xs font-medium uppercase tracking-wider',
        sortField === field ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200',
      )}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-slate-400" />
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Watchlist Manager
          </h1>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Track, compare, and export your watchlists
        </p>
      </div>

      {/* Tabs: Default + custom lists + create */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveTab('default')}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            activeTab === 'default'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700',
          )}
        >
          Default
        </button>
        {customLists.map((list) => (
          <div key={list.id} className="group flex items-center gap-1">
            {editingListId === list.id ? (
              <div className="flex items-center gap-1">
                <input
                  className="w-24 rounded bg-slate-700 px-2 py-1 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameList(list.id);
                    if (e.key === 'Escape') setEditingListId(null);
                  }}
                  autoFocus
                />
                <button
                  onClick={() => handleRenameList(list.id)}
                  className="rounded p-1 text-emerald-400 hover:bg-slate-700"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setActiveTab(list.id)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    activeTab === list.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700',
                  )}
                >
                  {list.name}
                </button>
                <button
                  onClick={() => {
                    setEditingListId(list.id);
                    setEditingName(list.name);
                  }}
                  className="rounded p-1 text-slate-500 opacity-0 group-hover:opacity-100 hover:text-slate-300 transition-all"
                  title="Rename list"
                >
                  <Edit3 className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleDeleteList(list.id)}
                  className="rounded p-1 text-slate-500 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                  title="Delete list"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        ))}
        {/* New list inline form */}
        <div className="flex items-center gap-1">
          <input
            className="w-28 rounded-lg bg-slate-800 px-2 py-1.5 text-sm text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-blue-500 border border-slate-700"
            placeholder="New list..."
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateList();
            }}
          />
          <button
            onClick={handleCreateList}
            disabled={!newListName.trim()}
            className="rounded-lg bg-slate-700 p-1.5 text-slate-300 hover:bg-slate-600 disabled:opacity-40 transition-colors"
            title="Create list"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3">
            <p className="text-xs text-slate-400">Total tickers</p>
            <p className="mt-1 text-xl font-semibold text-white">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3">
            <p className="text-xs text-slate-400">Avg change %</p>
            <p
              className={cn(
                'mt-1 text-xl font-semibold tabular-nums',
                summary.avgChange >= 0 ? 'text-emerald-400' : 'text-red-400',
              )}
            >
              {formatPercent(summary.avgChange)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <TrendingUp className="h-3 w-3 text-emerald-400" />
              Best performer
            </div>
            <p className="mt-1 text-lg font-semibold text-emerald-400">
              {summary.best.ticker}{' '}
              <span className="text-sm">{formatPercent(summary.best.change_percent)}</span>
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <TrendingDown className="h-3 w-3 text-red-400" />
              Worst performer
            </div>
            <p className="mt-1 text-lg font-semibold text-red-400">
              {summary.worst.ticker}{' '}
              <span className="text-sm">{formatPercent(summary.worst.change_percent)}</span>
            </p>
          </div>
        </div>
      )}

      {/* Add ticker + controls row */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd();
          }}
          className="flex items-center gap-2"
        >
          <input
            className="w-40 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Add ticker..."
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </form>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={activeTickers.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Empty state */}
      {activeTickers.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/40 px-6 py-16 text-center">
          <Eye className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-3 text-lg font-medium text-slate-300">
            No tickers in this watchlist
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Add a ticker above to start tracking
          </p>
        </div>
      ) : (
        /* Table */
        <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800/40">
          <table className="w-full text-sm text-white">
            <thead>
              <tr className="border-b border-slate-700 text-left">
                <th className="px-4 py-3">
                  <SortButton field="ticker" label="Ticker" />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton field="price" label="Price" />
                </th>
                <th className="px-4 py-3 text-right">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Change
                  </span>
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton field="change_percent" label="Change %" />
                </th>
                <th className="px-4 py-3 text-right">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    MA 50
                  </span>
                </th>
                <th className="px-4 py-3 text-right">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    MA 200
                  </span>
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton field="volume" label="Volume" />
                </th>
                <th className="px-4 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTickers.map((ticker) => (
                <TickerRow
                  key={ticker}
                  ticker={ticker}
                  onRemove={() => handleRemove(ticker)}
                  onData={handlePriceData}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
