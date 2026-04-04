import { useRealtimePrices } from '../../hooks/useRealtimePrices';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Wifi, WifiOff } from 'lucide-react';

const DEFAULT_TICKERS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'JPM', 'BTC-USD', 'GC=F'];

export function LiveTicker({ tickers = DEFAULT_TICKERS }: { tickers?: string[] }) {
  const { prices, connected } = useRealtimePrices(tickers, true, 10);

  return (
    <div className="flex h-7 items-center gap-1 overflow-hidden border-b border-slate-800 bg-slate-950 px-2">
      {/* Connection indicator */}
      <div className="shrink-0 mr-1" title={connected ? 'Live' : 'Reconnecting...'}>
        {connected ? (
          <Wifi className="h-3 w-3 text-emerald-500" />
        ) : (
          <WifiOff className="h-3 w-3 text-red-500 animate-pulse" />
        )}
      </div>

      {/* Scrolling ticker */}
      <div className="flex items-center gap-4 overflow-x-auto scrollbar-none">
        {tickers.map(ticker => {
          const data = prices[ticker];
          const changePct = data?.change_percent ?? 0;
          const isUp = changePct >= 0;

          return (
            <Link
              key={ticker}
              to={ticker.includes('-') || ticker.includes('=') ? '#' : `/company/${ticker}`}
              className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium hover:opacity-80 transition-opacity"
            >
              <span className="text-slate-400">{ticker}</span>
              {data ? (
                <>
                  <span className="text-white tabular-nums">${data.price.toFixed(2)}</span>
                  <span className={cn(
                    'tabular-nums',
                    isUp ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {isUp ? '+' : ''}{changePct.toFixed(2)}%
                  </span>
                </>
              ) : (
                <span className="h-3 w-12 animate-pulse rounded bg-slate-800" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
