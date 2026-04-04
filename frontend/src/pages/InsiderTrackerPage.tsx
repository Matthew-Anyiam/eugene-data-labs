import { useState, useMemo } from 'react';
import { UserCheck, Search, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useInsiders } from '../hooks/useInsiders';

const TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM'];

type DirectionFilter = 'All' | 'Buy' | 'Sell';

interface FlatTx {
  date: string;
  ticker: string;
  company: string;
  ownerName: string;
  ownerTitle: string;
  direction: string;
  transactionCode: string;
  shares: number | null;
  price: number | null;
  totalValue: number | null;
  derivative: boolean;
}

function formatValue(v: number | null): string {
  if (v == null) return '—';
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function InsiderTrackerPage() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('All');
  const [search, setSearch] = useState('');
  const [minValue, setMinValue] = useState(0);

  const { data: result, isLoading, error } = useInsiders(selectedTicker);
  const insidersData = result?.data;

  const flatTxns = useMemo<FlatTx[]>(() => {
    if (!insidersData?.insider_filings) return [];
    const rows: FlatTx[] = [];
    for (const filing of insidersData.insider_filings) {
      const ticker = filing.issuer?.ticker ?? selectedTicker;
      const company = filing.issuer?.name ?? selectedTicker;
      for (const tx of filing.transactions) {
        const totalValue =
          tx.shares != null && tx.price_per_share != null
            ? tx.shares * tx.price_per_share
            : null;
        rows.push({
          date: tx.date,
          ticker,
          company,
          ownerName: filing.owner.name,
          ownerTitle: filing.owner.title || (filing.owner.is_director ? 'Director' : filing.owner.is_officer ? 'Officer' : ''),
          direction: tx.direction,
          transactionCode: tx.transaction_code,
          shares: tx.shares,
          price: tx.price_per_share,
          totalValue,
          derivative: tx.derivative,
        });
      }
    }
    return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [insidersData, selectedTicker]);

  const filtered = useMemo(() => {
    return flatTxns
      .filter(t => {
        if (directionFilter === 'All') return true;
        return t.direction.toLowerCase() === directionFilter.toLowerCase();
      })
      .filter(t => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          t.ticker.toLowerCase().includes(q) ||
          t.ownerName.toLowerCase().includes(q)
        );
      })
      .filter(t => {
        if (minValue === 0) return true;
        return t.totalValue != null && t.totalValue >= minValue;
      });
  }, [flatTxns, directionFilter, search, minValue]);

  // Summary values from API
  const summary = insidersData?.summary;
  const sentiment = insidersData?.sentiment;

  // Buy/sell activity bars: group by direction for current data
  const buyTxns = flatTxns.filter(t => t.direction.toLowerCase() === 'buy');
  const sellTxns = flatTxns.filter(t => t.direction.toLowerCase() === 'sell');
  const totalBuyValue = buyTxns.reduce((s, t) => s + (t.totalValue ?? 0), 0);
  const totalSellValue = sellTxns.reduce((s, t) => s + (t.totalValue ?? 0), 0);

  // Per-owner activity for bars (top 8)
  const ownerActivity = useMemo(() => {
    const map: Record<string, { buys: number; sells: number }> = {};
    for (const t of flatTxns) {
      const key = t.ownerName;
      if (!map[key]) map[key] = { buys: 0, sells: 0 };
      if (t.direction.toLowerCase() === 'buy') map[key].buys += t.totalValue ?? 0;
      else if (t.direction.toLowerCase() === 'sell') map[key].sells += t.totalValue ?? 0;
    }
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.buys + b.sells - (a.buys + a.sells))
      .slice(0, 8);
  }, [flatTxns]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserCheck className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Insider Tracker</h1>
          <p className="text-sm text-slate-400">Track insider buying/selling patterns and cluster activity</p>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="flex flex-wrap gap-1.5">
        {TICKERS.map(t => (
          <button
            key={t}
            onClick={() => setSelectedTicker(t)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition-colors',
              selectedTicker === t
                ? 'bg-indigo-600 text-white'
                : 'border border-slate-600 bg-slate-800 text-slate-400 hover:border-indigo-500 hover:text-white',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Loading / error */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading insider filings for {selectedTicker}…</span>
        </div>
      )}

      {error && !isLoading && (
        <div className="flex items-center gap-2 rounded-xl border border-red-800 bg-red-900/20 p-4 text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm">Failed to load insider data for {selectedTicker}.</span>
        </div>
      )}

      {!isLoading && !error && insidersData && (
        <>
          {/* Summary cards */}
          <div className="grid gap-3 sm:grid-cols-5">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Total Buy Value</div>
              <div className="mt-1 text-xl font-bold text-emerald-400">
                {sentiment?.buy_value != null ? formatValue(sentiment.buy_value) : formatValue(totalBuyValue)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Total Sell Value</div>
              <div className="mt-1 text-xl font-bold text-red-400">
                {sentiment?.sell_value != null ? formatValue(sentiment.sell_value) : formatValue(totalSellValue)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Net Direction</div>
              <div className={cn(
                'mt-1 text-xl font-bold',
                summary?.net_direction?.toLowerCase() === 'buying' ? 'text-emerald-400' : 'text-red-400',
              )}>
                {summary?.net_direction ?? '—'}
              </div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Filings</div>
              <div className="mt-1 text-xl font-bold text-white">
                {insidersData.count ?? insidersData.insider_filings.length}
              </div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Sentiment Score</div>
              <div className={cn(
                'mt-1 text-xl font-bold',
                (sentiment?.score ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400',
              )}>
                {sentiment?.score != null
                  ? `${sentiment.score >= 0 ? '+' : ''}${sentiment.score.toFixed(0)}`
                  : '—'}
              </div>
            </div>
          </div>

          {/* Buy/Sell activity bars */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">Activity by Insider</h3>
            {ownerActivity.length > 0 ? (
              <div className="space-y-2">
                {ownerActivity.map(({ name, buys, sells }) => {
                  const max = Math.max(buys, sells, 1);
                  return (
                    <div key={name} className="flex items-center gap-2">
                      <span className="w-32 truncate text-xs text-slate-300" title={name}>{name}</span>
                      <div className="flex flex-1 gap-1">
                        <div className="flex flex-1 justify-end">
                          <div
                            className="h-4 rounded-l bg-emerald-500/40"
                            style={{ width: `${(buys / max) * 100}%` }}
                          />
                        </div>
                        <div className="flex-1">
                          <div
                            className="h-4 rounded-r bg-red-500/40"
                            style={{ width: `${(sells / max) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex w-36 gap-2 text-[10px]">
                        <span className="text-emerald-400">{formatValue(buys)}</span>
                        <span className="text-red-400">{formatValue(sells)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No transaction value data available.</p>
            )}
            <div className="mt-2 flex gap-4 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-emerald-500/40" /> Buys
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-red-500/40" /> Sells
              </span>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search insider…"
                className="w-44 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
              {(['All', 'Buy', 'Sell'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setDirectionFilter(f)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium',
                    directionFilter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white',
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <select
              value={minValue}
              onChange={e => setMinValue(Number(e.target.value))}
              className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value={0}>All values</option>
              <option value={100000}>$100K+</option>
              <option value={500000}>$500K+</option>
              <option value={1000000}>$1M+</option>
              <option value={5000000}>$5M+</option>
            </select>
          </div>

          {/* Transaction table */}
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticker</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Insider</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Title</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Direction</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Code</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Shares</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Price</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Value</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-400">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-xs text-slate-500">
                      No transactions match the current filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((t, i) => {
                    const isBuy = t.direction.toLowerCase() === 'buy';
                    const isSell = t.direction.toLowerCase() === 'sell';
                    return (
                      <tr key={i} className="bg-slate-800 hover:bg-slate-750">
                        <td className="px-3 py-2 text-xs text-slate-400">{t.date}</td>
                        <td className="px-3 py-2 text-xs font-bold text-indigo-400">{t.ticker}</td>
                        <td className="px-3 py-2 text-xs text-white">{t.ownerName}</td>
                        <td className="px-3 py-2 text-xs text-slate-400 max-w-[120px] truncate" title={t.ownerTitle}>
                          {t.ownerTitle || '—'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-medium',
                              isBuy
                                ? 'bg-emerald-900/40 text-emerald-400'
                                : isSell
                                ? 'bg-red-900/40 text-red-400'
                                : 'bg-slate-700 text-slate-300',
                            )}
                          >
                            {t.direction || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-slate-400 font-mono">{t.transactionCode}</td>
                        <td className="px-3 py-2 text-right text-xs text-slate-300">
                          {t.shares != null ? t.shares.toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-slate-300">
                          {t.price != null ? `$${t.price.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-medium text-white">
                          {formatValue(t.totalValue)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {t.derivative && (
                            <span className="text-[9px] font-bold text-amber-400">DERIV</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
