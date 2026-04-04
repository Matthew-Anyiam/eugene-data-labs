import { Star } from 'lucide-react';
import type { PriceData, ProfileData, EugeneResponse } from '../../lib/types';
import { formatPrice, formatPercent, formatCurrency } from '../../lib/utils';
import { useWatchlist } from '../../hooks/useWatchlist';

interface CompanyHeaderProps {
  profile?: EugeneResponse<ProfileData>;
  prices?: PriceData;
}

export function CompanyHeader({ profile, prices }: CompanyHeaderProps) {
  const name = profile?.resolved?.company || profile?.data?.name || profile?.identifier || '';
  const ticker = profile?.resolved?.ticker || '';
  const { hasTicker, addTicker, removeTicker } = useWatchlist();
  const isWatched = ticker ? hasTicker(ticker) : false;

  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
        {ticker && (
          <span className="text-sm font-medium text-slate-400 dark:text-slate-500">{ticker}</span>
        )}
        {ticker && (
          <button
            onClick={() => isWatched ? removeTicker(ticker) : addTicker(ticker)}
            className="group rounded-md p-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            <Star
              className={`h-4 w-4 transition-colors ${
                isWatched
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-slate-300 group-hover:text-amber-400 dark:text-slate-600'
              }`}
            />
          </button>
        )}
      </div>
      {profile?.data?.sic_description && (
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{profile.data.sic_description}</p>
      )}

      {prices && (
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-3xl font-bold tabular-nums">{formatPrice(prices.price)}</span>
          <span className={`text-sm font-medium ${prices.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {prices.change >= 0 ? '+' : ''}{formatPrice(Math.abs(prices.change))} ({formatPercent(prices.change_percent)})
          </span>
          {prices.market_cap > 0 && (
            <span className="text-sm text-slate-400">{formatCurrency(prices.market_cap)} mkt cap</span>
          )}
        </div>
      )}
    </div>
  );
}
