import { useState } from 'react';
import { Moon, Clock, Loader2, Search, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { usePrices } from '../hooks/usePrices';
import { useOHLCV } from '../hooks/useOHLCV';
import { cn } from '../lib/utils';

const DEFAULT_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOGL', 'AMD'];

export function PremarketPage() {
  const [ticker, setTicker] = useState('AAPL');
  const [input, setInput] = useState('');

  const pricesQ = usePrices(ticker);
  const ohlcvQ = useOHLCV(ticker);

  const price = pricesQ.data;
  const bars = ohlcvQ.data?.bars ?? [];

  // Previous close = last completed bar's close
  const prevBar = bars.length >= 2 ? bars[bars.length - 2] : null;
  const latestBar = bars.length >= 1 ? bars[bars.length - 1] : null;
  const prevClose = prevBar?.close ?? null;

  const priceChangeFromPrev =
    price && prevClose !== null ? price.price - prevClose : null;
  const priceChangePct =
    priceChangeFromPrev !== null && prevClose
      ? (priceChangeFromPrev / prevClose) * 100
      : null;

  const isLoading = pricesQ.isLoading || ohlcvQ.isLoading;
  const isError = pricesQ.isError || ohlcvQ.isError;
  const errorMsg =
    (pricesQ.error as Error)?.message ??
    (ohlcvQ.error as Error)?.message ??
    'Unknown error';

  const handleSearch = () => {
    const t = input.trim().toUpperCase();
    if (t) { setTicker(t); setInput(''); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Moon className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Pre/Post Market</h1>
          <p className="text-sm text-slate-400">Current price, day range, volume, and prior close</p>
        </div>
      </div>

      {/* Extended hours banner */}
      <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <Clock className="h-5 w-5 flex-shrink-0 text-amber-400" />
        <div>
          <span className="text-sm font-semibold text-amber-300">Extended Hours Data Coming Soon</span>
          <p className="text-xs text-amber-400/80 mt-0.5">
            Pre-market (4:00–9:30 AM ET) and after-hours (4:00–8:00 PM ET) real-time quotes will be
            available in an upcoming release.
          </p>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="Ticker..."
            className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <button
          onClick={handleSearch}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
        >
          Load
        </button>
        <div className="flex flex-wrap gap-1">
          {DEFAULT_TICKERS.map((t) => (
            <button
              key={t}
              onClick={() => setTicker(t)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-medium',
                ticker === t
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-700 text-slate-400 hover:text-white'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-12 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading data for {ticker}…</span>
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-700/50 bg-red-900/20 p-4 text-sm text-red-400">
          Failed to load data: {errorMsg}
        </div>
      )}

      {!isLoading && !isError && price && (
        <>
          {/* Main price card */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500">{ticker} — Regular Session</div>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-4xl font-bold text-white">${price.price.toFixed(2)}</span>
                  {priceChangeFromPrev !== null && priceChangePct !== null && (
                    <span
                      className={cn(
                        'flex items-center gap-1 text-lg font-semibold',
                        priceChangeFromPrev >= 0 ? 'text-emerald-400' : 'text-red-400'
                      )}
                    >
                      {priceChangeFromPrev >= 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      {priceChangeFromPrev >= 0 ? '+' : ''}
                      {priceChangeFromPrev.toFixed(2)} ({priceChangePct.toFixed(2)}%)
                    </span>
                  )}
                </div>
                {prevClose !== null && (
                  <div className="mt-1 text-xs text-slate-500">
                    vs prior close ${prevClose.toFixed(2)}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Session change</div>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    price.change >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  {price.change >= 0 ? '+' : ''}
                  {price.change.toFixed(2)} ({price.change_percent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">Last Close</div>
              <div className="mt-1 text-lg font-bold text-white">
                {prevClose !== null ? `$${prevClose.toFixed(2)}` : '—'}
              </div>
              {latestBar && (
                <div className="mt-0.5 text-[10px] text-slate-600">{latestBar.date}</div>
              )}
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">Day Range</div>
              <div className="mt-1 text-sm font-bold text-white">
                ${price.day_low.toFixed(2)}
                <span className="text-slate-500"> – </span>
                ${price.day_high.toFixed(2)}
              </div>
              {price.day_low < price.day_high && (
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-700">
                  <div
                    className="h-1.5 rounded-full bg-indigo-500/60"
                    style={{
                      width: `${((price.price - price.day_low) / (price.day_high - price.day_low)) * 100}%`,
                    }}
                  />
                </div>
              )}
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">Volume</div>
              <div className="mt-1 text-lg font-bold text-white">
                {price.volume >= 1e6
                  ? `${(price.volume / 1e6).toFixed(1)}M`
                  : `${(price.volume / 1e3).toFixed(0)}K`}
              </div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">52-Week Range</div>
              <div className="mt-1 text-sm font-bold text-white">
                ${price.year_low.toFixed(2)}
                <span className="text-slate-500"> – </span>
                ${price.year_high.toFixed(2)}
              </div>
              {price.year_low < price.year_high && (
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-700">
                  <div
                    className="h-1.5 rounded-full bg-amber-500/60"
                    style={{
                      width: `${((price.price - price.year_low) / (price.year_high - price.year_low)) * 100}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Moving averages + market cap */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">50-Day Avg</div>
              <div className="mt-1 text-lg font-bold text-white">
                ${price.avg_50.toFixed(2)}
              </div>
              <div
                className={cn(
                  'mt-0.5 text-xs font-medium',
                  price.price > price.avg_50 ? 'text-emerald-400' : 'text-red-400'
                )}
              >
                {price.price > price.avg_50 ? 'Above' : 'Below'} (
                {(((price.price - price.avg_50) / price.avg_50) * 100).toFixed(1)}%)
              </div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">200-Day Avg</div>
              <div className="mt-1 text-lg font-bold text-white">
                ${price.avg_200.toFixed(2)}
              </div>
              <div
                className={cn(
                  'mt-0.5 text-xs font-medium',
                  price.price > price.avg_200 ? 'text-emerald-400' : 'text-red-400'
                )}
              >
                {price.price > price.avg_200 ? 'Above' : 'Below'} (
                {(((price.price - price.avg_200) / price.avg_200) * 100).toFixed(1)}%)
              </div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">Market Cap</div>
              <div className="mt-1 text-lg font-bold text-white">
                {price.market_cap >= 1e12
                  ? `$${(price.market_cap / 1e12).toFixed(2)}T`
                  : price.market_cap >= 1e9
                  ? `$${(price.market_cap / 1e9).toFixed(1)}B`
                  : `$${(price.market_cap / 1e6).toFixed(0)}M`}
              </div>
            </div>
          </div>

          {/* Recent OHLCV bars */}
          {bars.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-white">Recent Sessions</h2>
              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-700 bg-slate-800/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Date</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Open</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">High</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Low</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Close</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Volume</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {[...bars].reverse().slice(0, 10).map((bar, i, arr) => {
                      const prev = arr[i + 1];
                      const chg = prev ? bar.close - prev.close : 0;
                      const chgPct = prev ? (chg / prev.close) * 100 : 0;
                      return (
                        <tr key={bar.date} className="bg-slate-800 hover:bg-slate-700/40">
                          <td className="px-3 py-2 text-xs text-slate-400">{bar.date}</td>
                          <td className="px-3 py-2 text-right text-xs text-slate-300">
                            ${bar.open.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-emerald-400">
                            ${bar.high.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-red-400">
                            ${bar.low.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-medium text-white">
                            ${bar.close.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-slate-400">
                            {(bar.volume / 1e6).toFixed(1)}M
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2 text-right text-xs font-medium',
                              prev
                                ? chg >= 0
                                  ? 'text-emerald-400'
                                  : 'text-red-400'
                                : 'text-slate-500'
                            )}
                          >
                            {prev
                              ? `${chg >= 0 ? '+' : ''}${chgPct.toFixed(2)}%`
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!isLoading && !isError && !price && (
        <div className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-800 p-6 text-sm text-slate-400">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
          <span>No price data available for <span className="font-mono text-white">{ticker}</span>.</span>
        </div>
      )}
    </div>
  );
}
