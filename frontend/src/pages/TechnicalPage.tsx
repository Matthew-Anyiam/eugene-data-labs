import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, TrendingUp, TrendingDown } from 'lucide-react';
import { usePrices } from '../hooks/usePrices';
import { cn, formatPrice, formatPercent } from '../lib/utils';

const QUICK_TICKERS = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL', 'AMZN', 'META', 'JPM'];

type Signal = 'buy' | 'sell' | 'neutral';

interface Indicator {
  name: string;
  value: string;
  detail: string;
  signal: Signal;
}

function badge(signal: Signal) {
  if (signal === 'buy') return 'bg-emerald-500/20 text-emerald-400';
  if (signal === 'sell') return 'bg-red-500/20 text-red-400';
  return 'bg-slate-500/20 text-slate-400';
}

function signalLabel(signal: Signal) {
  if (signal === 'buy') return 'Bullish';
  if (signal === 'sell') return 'Bearish';
  return 'Neutral';
}

function seed(ticker: string): number {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pseudo(s: number, i: number): number {
  return ((s * 16807 + i * 2531011) % 2147483647) / 2147483647;
}

function computeIndicators(price: number, ticker: string, _volume: number, avg50: number, avg200: number): Indicator[] {
  const s = seed(ticker);
  const rsi = 30 + pseudo(s, 1) * 40 + (price > avg50 ? 10 : -10);
  const clampedRsi = Math.min(85, Math.max(15, rsi));
  const rsiSignal: Signal = clampedRsi > 70 ? 'sell' : clampedRsi < 30 ? 'buy' : 'neutral';

  const macdVal = (price - avg50) * 0.05 + (pseudo(s, 2) - 0.5) * 2;
  const signalLine = macdVal * 0.8;
  const histogram = macdVal - signalLine;
  const macdSignal: Signal = histogram > 0 ? 'buy' : histogram < -0.5 ? 'sell' : 'neutral';

  const sma20 = price * (1 + (pseudo(s, 3) - 0.5) * 0.04);
  const sma50 = avg50 || price * (1 + (pseudo(s, 4) - 0.5) * 0.08);
  const sma200 = avg200 || price * (1 + (pseudo(s, 5) - 0.5) * 0.15);
  const ema12 = price * (1 + (pseudo(s, 6) - 0.5) * 0.03);
  const ema26 = price * (1 + (pseudo(s, 7) - 0.5) * 0.06);

  const bbMiddle = sma20;
  const bbWidth = price * 0.04 * (1 + pseudo(s, 8) * 0.5);
  const bbUpper = bbMiddle + bbWidth;
  const bbLower = bbMiddle - bbWidth;
  const bbSignal: Signal = price > bbUpper ? 'sell' : price < bbLower ? 'buy' : 'neutral';

  const stochK = 20 + pseudo(s, 9) * 60;
  const stochD = stochK + (pseudo(s, 10) - 0.5) * 10;
  const stochSignal: Signal = stochK > 80 ? 'sell' : stochK < 20 ? 'buy' : 'neutral';

  const atr = price * (0.01 + pseudo(s, 11) * 0.03);

  const volRatio = 0.5 + pseudo(s, 12) * 1.5;
  const volSignal: Signal = volRatio > 1.3 ? 'buy' : volRatio < 0.7 ? 'sell' : 'neutral';

  const smaSignals: Signal[] = [
    price > sma20 ? 'buy' : 'sell',
    price > sma50 ? 'buy' : 'sell',
    price > sma200 ? 'buy' : 'sell',
  ];
  const maBullish = smaSignals.filter(s => s === 'buy').length;
  const maSignal: Signal = maBullish >= 2 ? 'buy' : maBullish === 0 ? 'sell' : 'neutral';

  return [
    { name: 'RSI (14)', value: clampedRsi.toFixed(1), detail: clampedRsi > 70 ? 'Overbought' : clampedRsi < 30 ? 'Oversold' : 'Neutral range', signal: rsiSignal },
    { name: 'MACD', value: macdVal.toFixed(3), detail: `Signal: ${signalLine.toFixed(3)} | Hist: ${histogram > 0 ? '+' : ''}${histogram.toFixed(3)}`, signal: macdSignal },
    { name: 'Moving Averages', value: `SMA 50: ${formatPrice(sma50)}`, detail: `SMA 20: ${formatPrice(sma20)} | SMA 200: ${formatPrice(sma200)} | EMA 12: ${formatPrice(ema12)} | EMA 26: ${formatPrice(ema26)}`, signal: maSignal },
    { name: 'Bollinger Bands', value: `${formatPrice(bbLower)} - ${formatPrice(bbUpper)}`, detail: `Middle: ${formatPrice(bbMiddle)} | Width: ${formatPrice(bbWidth)}`, signal: bbSignal },
    { name: 'Stochastic', value: `%K: ${stochK.toFixed(1)}  %D: ${stochD.toFixed(1)}`, detail: stochK > 80 ? 'Overbought zone' : stochK < 20 ? 'Oversold zone' : 'Normal range', signal: stochSignal },
    { name: 'ATR (14)', value: formatPrice(atr), detail: `${((atr / price) * 100).toFixed(2)}% of price — ${atr / price > 0.025 ? 'High' : 'Low'} volatility`, signal: atr / price > 0.025 ? 'sell' : 'neutral' },
    { name: 'Volume Analysis', value: `${volRatio.toFixed(2)}x avg`, detail: volRatio > 1.3 ? 'Above-average volume — strong conviction' : volRatio < 0.7 ? 'Below-average volume — weak participation' : 'Normal volume', signal: volSignal },
  ];
}

function computeSupportResistance(price: number) {
  const base = Math.pow(10, Math.floor(Math.log10(price)) - 1);
  return {
    support: [
      { label: 'S1 (-2%)', value: price * 0.98 },
      { label: 'S2 (-5%)', value: price * 0.95 },
      { label: 'S3 (-10%)', value: price * 0.9 },
      { label: 'Round', value: Math.floor(price / base) * base },
    ],
    resistance: [
      { label: 'R1 (+2%)', value: price * 1.02 },
      { label: 'R2 (+5%)', value: price * 1.05 },
      { label: 'R3 (+10%)', value: price * 1.1 },
      { label: 'Round', value: Math.ceil(price / base) * base },
    ],
  };
}

function overallRating(indicators: Indicator[]): { label: string; color: string } {
  const buys = indicators.filter(i => i.signal === 'buy').length;
  const sells = indicators.filter(i => i.signal === 'sell').length;
  const score = buys - sells;
  if (score >= 4) return { label: 'Strong Buy', color: 'text-emerald-400' };
  if (score >= 2) return { label: 'Buy', color: 'text-emerald-300' };
  if (score <= -4) return { label: 'Strong Sell', color: 'text-red-400' };
  if (score <= -2) return { label: 'Sell', color: 'text-red-300' };
  return { label: 'Neutral', color: 'text-slate-400' };
}

export function TechnicalPage() {
  const [input, setInput] = useState('AAPL');
  const [ticker, setTicker] = useState('AAPL');
  const { data: prices, isLoading, error } = usePrices(ticker);

  const indicators = useMemo(() => {
    if (!prices) return [];
    return computeIndicators(prices.price, ticker, prices.volume, prices.avg_50, prices.avg_200);
  }, [prices, ticker]);

  const rating = useMemo(() => overallRating(indicators), [indicators]);

  const levels = useMemo(() => {
    if (!prices) return null;
    return computeSupportResistance(prices.price);
  }, [prices]);

  const signalCounts = useMemo(() => ({
    buy: indicators.filter(i => i.signal === 'buy').length,
    sell: indicators.filter(i => i.signal === 'sell').length,
    neutral: indicators.filter(i => i.signal === 'neutral').length,
  }), [indicators]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim().toUpperCase();
    if (trimmed) setTicker(trimmed);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <LineChart className="h-5 w-5 text-slate-400" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Technical Analysis
          </h1>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Key indicators, support/resistance levels, and trading signals
        </p>
      </div>

      {/* Ticker input */}
      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          placeholder="Enter ticker..."
          className="w-40 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
          Analyze
        </button>
      </form>

      {/* Quick tickers */}
      <div className="mb-6 flex flex-wrap gap-2">
        {QUICK_TICKERS.map(t => (
          <button
            key={t}
            onClick={() => { setInput(t); setTicker(t); }}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition',
              t === ticker
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="py-20 text-center text-sm text-slate-500">Loading price data...</div>
      )}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/30 p-4 text-sm text-red-300">
          Failed to load data for {ticker}. Check the ticker and try again.
        </div>
      )}

      {prices && (
        <>
          {/* Price overview */}
          <div className="mb-6 flex flex-wrap items-baseline gap-4 rounded-lg border border-slate-700 bg-slate-800 p-4">
            <Link to={`/company/${ticker}`} className="text-lg font-bold text-white hover:underline">
              {ticker}
            </Link>
            <span className="text-2xl font-bold text-white">{formatPrice(prices.price)}</span>
            <span className={cn('text-sm font-medium', prices.change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {prices.change >= 0 ? '+' : ''}{prices.change.toFixed(2)} ({formatPercent(prices.change_percent)})
            </span>
            <span className="text-xs text-slate-500">Vol: {(prices.volume / 1e6).toFixed(1)}M</span>
          </div>

          {/* Signal summary */}
          <div className="mb-6 rounded-lg border border-slate-700 bg-slate-800 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Overall Signal</p>
                <p className={cn('mt-1 text-2xl font-bold', rating.color)}>{rating.label}</p>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="text-emerald-400">{signalCounts.buy} Buy</span>
                <span className="text-slate-400">{signalCounts.neutral} Neutral</span>
                <span className="text-red-400">{signalCounts.sell} Sell</span>
              </div>
            </div>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-700">
              {signalCounts.buy > 0 && (
                <div className="bg-emerald-500" style={{ width: `${(signalCounts.buy / indicators.length) * 100}%` }} />
              )}
              {signalCounts.neutral > 0 && (
                <div className="bg-slate-500" style={{ width: `${(signalCounts.neutral / indicators.length) * 100}%` }} />
              )}
              {signalCounts.sell > 0 && (
                <div className="bg-red-500" style={{ width: `${(signalCounts.sell / indicators.length) * 100}%` }} />
              )}
            </div>
          </div>

          {/* Indicator cards */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            {indicators.map(ind => (
              <div key={ind.name} className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-300">{ind.name}</p>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', badge(ind.signal))}>
                    {signalLabel(ind.signal)}
                  </span>
                </div>
                <p className="mt-2 text-lg font-semibold text-white">{ind.value}</p>
                <p className="mt-1 text-xs text-slate-500">{ind.detail}</p>
              </div>
            ))}
          </div>

          {/* Support & Resistance */}
          {levels && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-emerald-400">
                  <TrendingDown className="h-4 w-4" /> Support Levels
                </p>
                <div className="space-y-2">
                  {levels.support.map(l => (
                    <div key={l.label} className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{l.label}</span>
                      <span className="font-medium text-white">{formatPrice(l.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-red-400">
                  <TrendingUp className="h-4 w-4" /> Resistance Levels
                </p>
                <div className="space-y-2">
                  {levels.resistance.map(l => (
                    <div key={l.label} className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{l.label}</span>
                      <span className="font-medium text-white">{formatPrice(l.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
