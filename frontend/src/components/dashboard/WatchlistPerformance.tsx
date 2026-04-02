import { Link } from 'react-router-dom';
import { Star, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useWatchlist } from '../../hooks/useWatchlist';
import { usePrices } from '../../hooks/usePrices';
import { formatPrice, cn } from '../../lib/utils';

function WatchlistItem({ ticker }: { ticker: string }) {
  const { data: prices, isLoading } = usePrices(ticker);

  if (isLoading) {
    return (
      <div className="flex items-center justify-between rounded-lg px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="h-4 w-12 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="h-4 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }

  if (!prices) {
    return (
      <div className="flex items-center justify-between rounded-lg px-3 py-2.5">
        <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300">{ticker}</span>
        <span className="text-xs text-slate-400">--</span>
      </div>
    );
  }

  const isUp = prices.change_percent >= 0;

  return (
    <Link
      to={`/company/${ticker}`}
      className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300">{ticker}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium tabular-nums text-slate-700 dark:text-slate-300">
          {formatPrice(prices.price)}
        </span>
        <span className={cn(
          'flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums',
          isUp
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        )}>
          {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {isUp ? '+' : ''}{prices.change_percent?.toFixed(2)}%
        </span>
      </div>
    </Link>
  );
}

export function WatchlistPerformance() {
  const { tickers } = useWatchlist();

  if (tickers.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-700">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
          <Star className="h-4 w-4 text-amber-400" /> Watchlist
        </h3>
        <div className="py-4 text-center">
          <Star className="mx-auto h-8 w-8 text-slate-200 dark:text-slate-700" />
          <p className="mt-2 text-sm text-slate-400">No tickers in watchlist</p>
          <p className="text-xs text-slate-300 dark:text-slate-600">
            Star companies to track them here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
          <Star className="h-4 w-4 text-amber-400" /> Watchlist
        </h3>
        <span className="text-[10px] text-slate-400">{tickers.length} ticker{tickers.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {tickers.map((t) => (
          <WatchlistItem key={t} ticker={t} />
        ))}
      </div>
    </div>
  );
}
