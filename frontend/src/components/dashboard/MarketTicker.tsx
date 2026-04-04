import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { eugeneApi } from '../../lib/api';
import { useWatchlist } from '../../hooks/useWatchlist';
import { cn } from '../../lib/utils';

interface TickerQuote {
  ticker: string;
  price: number;
  change: number;
  change_percent: number;
}

export function MarketTicker() {
  const { tickers } = useWatchlist();
  const [quotes, setQuotes] = useState<TickerQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tickers.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchQuotes = async () => {
      const results: TickerQuote[] = [];
      // Fetch in parallel, max 8 tickers
      const batch = tickers.slice(0, 8);
      const promises = batch.map(async (ticker) => {
        try {
          const data = await eugeneApi<any>(`/v1/sec/${ticker}/prices`);
          return {
            ticker,
            price: data?.price ?? 0,
            change: data?.change ?? 0,
            change_percent: data?.change_percent ?? 0,
          };
        } catch {
          return { ticker, price: 0, change: 0, change_percent: 0 };
        }
      });

      const settled = await Promise.allSettled(promises);
      for (const result of settled) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      }

      if (!cancelled) {
        setQuotes(results.filter((q) => q.price > 0));
        setLoading(false);
      }
    };

    fetchQuotes();
    // Refresh every 5 minutes
    const interval = setInterval(fetchQuotes, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [tickers]);

  if (loading) {
    return (
      <div className="flex h-10 items-center gap-6 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 px-4 dark:border-slate-800 dark:bg-slate-900">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 w-10 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-14 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-4 text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900">
        Add tickers to your watchlist to see market data
      </div>
    );
  }

  return (
    <div className="flex h-10 items-center gap-4 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-4 dark:border-slate-800 dark:bg-slate-900">
      {quotes.map((q) => (
        <Link
          key={q.ticker}
          to={`/company/${q.ticker}`}
          className="flex shrink-0 items-center gap-2 text-xs hover:opacity-80"
        >
          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{q.ticker}</span>
          <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
            ${q.price.toFixed(2)}
          </span>
          <span
            className={cn(
              'flex items-center gap-0.5 font-mono tabular-nums font-medium',
              q.change >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            )}
          >
            {q.change >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {q.change >= 0 ? '+' : ''}{q.change_percent.toFixed(2)}%
          </span>
        </Link>
      ))}
    </div>
  );
}
