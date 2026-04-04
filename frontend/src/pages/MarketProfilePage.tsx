import { useState, useMemo } from 'react';
import { BarChart3, Search, Loader2 } from 'lucide-react';
import { useOHLCV } from '../hooks/useOHLCV';
import { useTechnicals } from '../hooks/useTechnicals';
import type { OHLCVBar } from '../lib/types';
import { cn } from '../lib/utils';

const DEFAULT_TICKERS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META'];
const NUM_BUCKETS = 30;

interface VolumeBucket {
  priceMin: number;
  priceMax: number;
  priceMid: number;
  volume: number;
  isPOC: boolean;
  isVAH: boolean;
  isVAL: boolean;
}

function buildVolumeProfile(bars: OHLCVBar[]): VolumeBucket[] {
  if (bars.length === 0) return [];

  const allHigh = Math.max(...bars.map((b) => b.high));
  const allLow = Math.min(...bars.map((b) => b.low));
  const range = allHigh - allLow;
  if (range === 0) return [];

  const step = range / NUM_BUCKETS;
  const buckets: number[] = new Array(NUM_BUCKETS).fill(0);

  for (const bar of bars) {
    // Distribute bar's volume evenly across the price range it covers
    const barRange = bar.high - bar.low || step;
    for (let i = 0; i < NUM_BUCKETS; i++) {
      const bMin = allLow + i * step;
      const bMax = bMin + step;
      const overlap = Math.max(0, Math.min(bar.high, bMax) - Math.max(bar.low, bMin));
      buckets[i] += (overlap / barRange) * bar.volume;
    }
  }

  // Find POC (max volume bucket)
  const maxVol = Math.max(...buckets);
  const pocIdx = buckets.indexOf(maxVol);

  // Value area = 70% of total volume, expanding from POC
  const totalVol = buckets.reduce((s, v) => s + v, 0);
  const vaTarget = totalVol * 0.7;
  let vaSum = buckets[pocIdx];
  let upper = pocIdx;
  let lower = pocIdx;
  while (vaSum < vaTarget) {
    const upVol = upper + 1 < NUM_BUCKETS ? buckets[upper + 1] : 0;
    const downVol = lower - 1 >= 0 ? buckets[lower - 1] : 0;
    if (upVol >= downVol && upper + 1 < NUM_BUCKETS) {
      upper++;
      vaSum += buckets[upper];
    } else if (lower - 1 >= 0) {
      lower--;
      vaSum += buckets[lower];
    } else break;
  }

  return buckets.map((vol, i) => ({
    priceMin: allLow + i * step,
    priceMax: allLow + (i + 1) * step,
    priceMid: allLow + (i + 0.5) * step,
    volume: vol,
    isPOC: i === pocIdx,
    isVAH: i === upper,
    isVAL: i === lower,
  }));
}

export function MarketProfilePage() {
  const [ticker, setTicker] = useState('SPY');
  const [input, setInput] = useState('');

  const ohlcvQ = useOHLCV(ticker);
  const techQ = useTechnicals(ticker);

  const bars = ohlcvQ.data?.bars ?? [];
  const indicators = techQ.data?.data?.indicators;
  const vwap = indicators?.vwap;

  const volumeProfile = useMemo(() => buildVolumeProfile(bars), [bars]);
  const maxVolume = useMemo(
    () => (volumeProfile.length > 0 ? Math.max(...volumeProfile.map((b) => b.volume)) : 0),
    [volumeProfile]
  );

  const poc = volumeProfile.find((b) => b.isPOC);
  const vah = volumeProfile.find((b) => b.isVAH);
  const val = volumeProfile.find((b) => b.isVAL);

  const currentPrice = bars.length > 0 ? bars[bars.length - 1].close : null;
  const totalVolume = bars.reduce((s, b) => s + b.volume, 0);

  const isLoading = ohlcvQ.isLoading || techQ.isLoading;
  const isError = ohlcvQ.isError || techQ.isError;
  const errorMsg =
    (ohlcvQ.error as Error)?.message ??
    (techQ.error as Error)?.message ??
    'Unknown error';

  const handleSearch = () => {
    const t = input.trim().toUpperCase();
    if (t) { setTicker(t); setInput(''); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-purple-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Market Profile</h1>
          <p className="text-sm text-slate-400">
            Volume profile, VWAP, value area, and price distribution from OHLCV
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
            className="w-28 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-purple-500 focus:outline-none"
          />
        </div>
        <button
          onClick={handleSearch}
          className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-500"
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
                  ? 'bg-purple-600 text-white'
                  : 'border border-slate-700 text-slate-400 hover:text-white'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-12 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Building volume profile for {ticker}…</span>
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-700/50 bg-red-900/20 p-4 text-sm text-red-400">
          Failed to load data: {errorMsg}
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Key levels */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              {
                label: 'Current Price',
                value: currentPrice ? `$${currentPrice.toFixed(2)}` : '—',
                color: 'text-white',
              },
              {
                label: 'VWAP',
                value: vwap ? `$${vwap.toFixed(2)}` : '—',
                color:
                  currentPrice && vwap
                    ? currentPrice > vwap
                      ? 'text-emerald-400'
                      : 'text-red-400'
                    : 'text-slate-400',
              },
              {
                label: 'POC',
                value: poc ? `$${poc.priceMid.toFixed(2)}` : '—',
                color: 'text-purple-400',
              },
              {
                label: 'VAH',
                value: vah ? `$${vah.priceMid.toFixed(2)}` : '—',
                color: 'text-amber-400',
              },
              {
                label: 'VAL',
                value: val ? `$${val.priceMid.toFixed(2)}` : '—',
                color: 'text-amber-400',
              },
              {
                label: 'Total Volume',
                value:
                  totalVolume >= 1e9
                    ? `${(totalVolume / 1e9).toFixed(1)}B`
                    : `${(totalVolume / 1e6).toFixed(0)}M`,
                color: 'text-slate-300',
              },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">{c.label}</div>
                <div className={cn('mt-1 text-lg font-bold', c.color)}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Volume profile chart */}
          {volumeProfile.length > 0 ? (
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Volume Profile</h3>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-3 rounded-sm bg-purple-500/70" /> POC
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-3 rounded-sm bg-amber-500/40" /> Value Area
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-3 rounded-sm bg-blue-500/40" /> Other
                  </span>
                  {vwap && (
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-0.5 w-3 bg-emerald-400" /> VWAP
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-0.5">
                {[...volumeProfile].reverse().map((bucket) => {
                  const barWidth = maxVolume > 0 ? (bucket.volume / maxVolume) * 100 : 0;
                  const inVA =
                    poc && vah && val
                      ? bucket.priceMid >= val.priceMid && bucket.priceMid <= vah.priceMid
                      : false;
                  const isCurrentPriceBucket =
                    currentPrice !== null &&
                    currentPrice >= bucket.priceMin &&
                    currentPrice < bucket.priceMax;
                  const isVwapBucket =
                    vwap !== undefined &&
                    vwap >= bucket.priceMin &&
                    vwap < bucket.priceMax;

                  return (
                    <div
                      key={bucket.priceMin.toFixed(2)}
                      className={cn(
                        'flex items-center gap-2',
                        bucket.isPOC ? 'bg-purple-500/10 rounded' : ''
                      )}
                    >
                      <span
                        className={cn(
                          'w-20 text-right font-mono text-[10px]',
                          bucket.isPOC
                            ? 'font-bold text-purple-400'
                            : bucket.isVAH || bucket.isVAL
                            ? 'text-amber-400'
                            : isCurrentPriceBucket
                            ? 'font-bold text-white'
                            : 'text-slate-600'
                        )}
                      >
                        ${bucket.priceMid.toFixed(2)}
                        {bucket.isPOC ? ' POC' : ''}
                        {bucket.isVAH ? ' VAH' : ''}
                        {bucket.isVAL ? ' VAL' : ''}
                      </span>
                      {isCurrentPriceBucket && (
                        <span className="text-[8px] text-white">&#9654;</span>
                      )}
                      {isVwapBucket && !isCurrentPriceBucket && (
                        <span className="text-[8px] text-emerald-400">V</span>
                      )}
                      <div className="flex flex-1">
                        <div
                          className={cn(
                            'rounded',
                            bucket.isPOC
                              ? 'bg-purple-500/70'
                              : inVA
                              ? 'bg-amber-500/35'
                              : 'bg-blue-500/40'
                          )}
                          style={{ width: `${Math.max(1, barWidth)}%`, height: '10px' }}
                        />
                      </div>
                      <span className="w-14 text-right text-[9px] text-slate-600">
                        {bucket.volume >= 1e6
                          ? `${(bucket.volume / 1e6).toFixed(1)}M`
                          : `${(bucket.volume / 1e3).toFixed(0)}K`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-10 text-center text-sm text-slate-500">
              No OHLCV data available for {ticker}.
            </div>
          )}

          {/* Position vs key levels */}
          {volumeProfile.length > 0 && currentPrice !== null && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <h3 className="mb-3 text-sm font-semibold text-white">Position vs Key Levels</h3>
                <div className="space-y-2 text-xs">
                  {vwap !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Price vs VWAP</span>
                      <span
                        className={cn(
                          'font-medium',
                          currentPrice > vwap ? 'text-emerald-400' : 'text-red-400'
                        )}
                      >
                        {currentPrice > vwap ? 'Above' : 'Below'} (
                        {(((currentPrice - vwap) / vwap) * 100).toFixed(2)}%)
                      </span>
                    </div>
                  )}
                  {poc && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Price vs POC</span>
                      <span
                        className={cn(
                          'font-medium',
                          currentPrice > poc.priceMid ? 'text-emerald-400' : 'text-red-400'
                        )}
                      >
                        {currentPrice > poc.priceMid ? 'Above' : 'Below'} (
                        {(((currentPrice - poc.priceMid) / poc.priceMid) * 100).toFixed(2)}%)
                      </span>
                    </div>
                  )}
                  {vah && val && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">In Value Area</span>
                      <span
                        className={cn(
                          'font-medium',
                          currentPrice >= val.priceMid && currentPrice <= vah.priceMid
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        )}
                      >
                        {currentPrice >= val.priceMid && currentPrice <= vah.priceMid
                          ? 'Yes'
                          : 'No'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Technicals summary */}
              {indicators && (
                <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-white">Technical Indicators</h3>
                  <div className="space-y-2 text-xs">
                    {[
                      { label: 'RSI (14)', value: indicators.rsi?.toFixed(1) ?? '—', color: indicators.rsi ? (indicators.rsi > 70 ? 'text-red-400' : indicators.rsi < 30 ? 'text-emerald-400' : 'text-white') : 'text-slate-500' },
                      { label: 'SMA 20', value: indicators.sma?.sma_20 ? `$${indicators.sma.sma_20.toFixed(2)}` : '—', color: 'text-slate-300' },
                      { label: 'SMA 50', value: indicators.sma?.sma_50 ? `$${indicators.sma.sma_50.toFixed(2)}` : '—', color: 'text-slate-300' },
                      { label: 'EMA 12', value: indicators.ema?.ema_12 ? `$${indicators.ema.ema_12.toFixed(2)}` : '—', color: 'text-slate-300' },
                      { label: 'MACD', value: indicators.macd?.macd_line !== undefined ? indicators.macd.macd_line.toFixed(2) : '—', color: indicators.macd?.macd_line !== undefined ? (indicators.macd.macd_line > 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-500' },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between">
                        <span className="text-slate-400">{row.label}</span>
                        <span className={cn('font-medium', row.color)}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
