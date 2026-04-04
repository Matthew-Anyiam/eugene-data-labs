import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { useTechnicals } from '../hooks/useTechnicals';
import { usePrices } from '../hooks/usePrices';
import { cn, formatPrice, formatPercent } from '../lib/utils';

const QUICK_TICKERS = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL', 'AMZN', 'META', 'JPM'];

type Signal = 'buy' | 'sell' | 'neutral';

function signalBadge(signal: Signal) {
  if (signal === 'buy') return 'bg-emerald-500/20 text-emerald-400';
  if (signal === 'sell') return 'bg-red-500/20 text-red-400';
  return 'bg-slate-500/20 text-slate-400';
}

function signalLabel(signal: Signal) {
  if (signal === 'buy') return 'Bullish';
  if (signal === 'sell') return 'Bearish';
  return 'Neutral';
}

function rsiSignal(rsi: number): Signal {
  if (rsi < 30) return 'buy';
  if (rsi > 70) return 'sell';
  return 'neutral';
}

function rsiColor(rsi: number) {
  if (rsi < 30) return 'text-emerald-400';
  if (rsi > 70) return 'text-red-400';
  return 'text-white';
}

function macdSignal(histogram: number): Signal {
  if (histogram > 0) return 'buy';
  if (histogram < 0) return 'sell';
  return 'neutral';
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

export function TechnicalPage() {
  const [input, setInput] = useState('AAPL');
  const [ticker, setTicker] = useState('AAPL');

  const { data: techResult, isLoading: techLoading, error: techError } = useTechnicals(ticker);
  const { data: priceResult, isLoading: priceLoading, error: priceError } = usePrices(ticker);

  const tech = techResult?.data;
  const prices = priceResult;

  const isLoading = techLoading || priceLoading;
  const hasError = techError || priceError;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim().toUpperCase();
    if (trimmed) setTicker(trimmed);
  };

  // Derive signals from real indicator values
  const indicators = tech ? (() => {
    const ind = tech.indicators;
    const price = prices?.price ?? 0;

    const rsi = ind.rsi_14 ?? 50;
    const rsiSig = rsiSignal(rsi);

    const macdHist = ind.macd?.histogram ?? 0;
    const macdSig = macdSignal(macdHist);

    const sma20 = ind.sma_20 ?? 0;
    const sma50 = ind.sma_50 ?? 0;
    const sma200 = ind.sma_200 ?? 0;
    const ema12 = ind.ema_12 ?? 0;
    const ema26 = ind.ema_26 ?? 0;

    const smaBullish = [price > sma20, price > sma50, price > sma200].filter(Boolean).length;
    const maSig: Signal = smaBullish >= 2 ? 'buy' : smaBullish === 0 ? 'sell' : 'neutral';

    const bb = ind.bollinger_bands;
    const bbSig: Signal = bb ? (price > bb.upper ? 'sell' : price < bb.lower ? 'buy' : 'neutral') : 'neutral';

    const atr = ind.atr_14 ?? 0;
    const atrPct = price > 0 ? atr / price : 0;

    const result: { name: string; value: string; detail: string; signal: Signal; valueClass: string }[] = [
      {
        name: 'RSI (14)',
        value: rsi.toFixed(1),
        detail: rsi > 70 ? 'Overbought — momentum may be fading' : rsi < 30 ? 'Oversold — potential reversal zone' : 'Neutral range',
        signal: rsiSig,
        valueClass: rsiColor(rsi),
      },
    ];

    if (ind.macd) {
      result.push({
        name: 'MACD',
        value: ind.macd.macd_line.toFixed(3),
        detail: `Signal: ${ind.macd.signal.toFixed(3)} | Histogram: ${macdHist >= 0 ? '+' : ''}${macdHist.toFixed(3)}`,
        signal: macdSig,
        valueClass: macdHist > 0 ? 'text-emerald-400' : 'text-red-400',
      });
    }

    result.push({
      name: 'Moving Averages',
      value: `SMA 50: ${formatPrice(sma50)}`,
      detail: `SMA 20: ${formatPrice(sma20)} | SMA 200: ${formatPrice(sma200)} | EMA 12: ${formatPrice(ema12)} | EMA 26: ${formatPrice(ema26)}`,
      signal: maSig,
      valueClass: 'text-white',
    });

    if (bb) {
      result.push({
        name: 'Bollinger Bands',
        value: `${formatPrice(bb.lower)} – ${formatPrice(bb.upper)}`,
        detail: `Middle (SMA 20): ${formatPrice(bb.middle)} | Price ${price > bb.upper ? 'above upper band' : price < bb.lower ? 'below lower band' : 'inside bands'}`,
        signal: bbSig,
        valueClass: 'text-white',
      });
    }

    result.push(
      {
        name: 'ATR (14)',
        value: formatPrice(atr),
        detail: `${(atrPct * 100).toFixed(2)}% of price — ${atrPct > 0.025 ? 'High' : 'Low'} volatility`,
        signal: (atrPct > 0.025 ? 'sell' : 'neutral') as Signal,
        valueClass: 'text-white',
      },
      {
        name: 'VWAP',
        value: formatPrice(ind.vwap_20),
        detail: price > 0 ? (price > (ind.vwap_20 ?? 0) ? 'Price trading above VWAP — bullish intraday' : 'Price trading below VWAP — bearish intraday') : '—',
        signal: (price > 0 ? (price > (ind.vwap_20 ?? 0) ? 'buy' : 'sell') : 'neutral') as Signal,
        valueClass: 'text-white',
      },
      {
        name: 'EMA Crossover',
        value: `EMA 12: ${formatPrice(ema12)}`,
        detail: `EMA 26: ${formatPrice(ema26)} | ${ema12 > ema26 ? 'Golden cross — bullish' : 'Death cross — bearish'}`,
        signal: (ema12 > ema26 ? 'buy' : 'sell') as Signal,
        valueClass: ema12 > ema26 ? 'text-emerald-400' : 'text-red-400',
      },
    );

    return result;
  })() : [];

  const buys = indicators.filter(i => i.signal === 'buy').length;
  const sells = indicators.filter(i => i.signal === 'sell').length;
  const neutrals = indicators.filter(i => i.signal === 'neutral').length;

  const overallScore = buys - sells;
  const overall = overallScore >= 4
    ? { label: 'Strong Buy', color: 'text-emerald-400' }
    : overallScore >= 2
    ? { label: 'Buy', color: 'text-emerald-300' }
    : overallScore <= -4
    ? { label: 'Strong Sell', color: 'text-red-400' }
    : overallScore <= -2
    ? { label: 'Sell', color: 'text-red-300' }
    : { label: 'Neutral', color: 'text-slate-400' };

  const levels = prices ? computeSupportResistance(prices.price) : null;

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
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
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

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading technical data for {ticker}...
        </div>
      )}

      {/* Error state */}
      {hasError && !isLoading && (
        <div className="rounded-lg border border-red-800 bg-red-900/30 p-4 text-sm text-red-300">
          Failed to load data for {ticker}. Check the ticker and try again.
        </div>
      )}

      {/* Content */}
      {!isLoading && !hasError && tech && (
        <>
          {/* Price overview */}
          {prices && (
            <div className="mb-6 flex flex-wrap items-baseline gap-4 rounded-lg border border-slate-700 bg-slate-800 p-4">
              <Link to={`/company/${ticker}`} className="text-lg font-bold text-white hover:underline">
                {ticker}
              </Link>
              <span className="text-2xl font-bold text-white">{formatPrice(prices.price)}</span>
              <span className={cn('text-sm font-medium', prices.change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {prices.change >= 0 ? '+' : ''}{prices.change.toFixed(2)} ({formatPercent(prices.change_percent)})
              </span>
              <span className="text-xs text-slate-500">Vol: {(prices.volume / 1e6).toFixed(1)}M</span>
              <span className="ml-auto text-xs text-slate-500">
                52W: {formatPrice(prices.year_low)} – {formatPrice(prices.year_high)}
              </span>
            </div>
          )}

          {/* Signal summary */}
          {indicators.length > 0 && (
            <div className="mb-6 rounded-lg border border-slate-700 bg-slate-800 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Overall Signal</p>
                  <p className={cn('mt-1 text-2xl font-bold', overall.color)}>{overall.label}</p>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-emerald-400">{buys} Buy</span>
                  <span className="text-slate-400">{neutrals} Neutral</span>
                  <span className="text-red-400">{sells} Sell</span>
                </div>
              </div>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-700">
                {buys > 0 && (
                  <div className="bg-emerald-500" style={{ width: `${(buys / indicators.length) * 100}%` }} />
                )}
                {neutrals > 0 && (
                  <div className="bg-slate-500" style={{ width: `${(neutrals / indicators.length) * 100}%` }} />
                )}
                {sells > 0 && (
                  <div className="bg-red-500" style={{ width: `${(sells / indicators.length) * 100}%` }} />
                )}
              </div>
            </div>
          )}

          {/* Indicator cards */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            {indicators.map(ind => (
              <div key={ind.name} className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-300">{ind.name}</p>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', signalBadge(ind.signal))}>
                    {signalLabel(ind.signal)}
                  </span>
                </div>
                <p className={cn('mt-2 text-lg font-semibold', ind.valueClass)}>{ind.value}</p>
                <p className="mt-1 text-xs text-slate-500">{ind.detail}</p>
              </div>
            ))}
          </div>

          {/* SMA / EMA detail table */}
          <div className="mb-6 rounded-lg border border-slate-700 bg-slate-800 p-4">
            <p className="mb-3 text-sm font-semibold text-white">Moving Averages Detail</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { label: 'SMA 20', value: tech.indicators.sma_20 ?? 0 },
                { label: 'SMA 50', value: tech.indicators.sma_50 ?? 0 },
                { label: 'SMA 200', value: tech.indicators.sma_200 ?? 0 },
                { label: 'EMA 12', value: tech.indicators.ema_12 ?? 0 },
                { label: 'EMA 26', value: tech.indicators.ema_26 ?? 0 },
              ].map(ma => {
                const price = prices?.price ?? 0;
                const above = price > 0 && price > ma.value;
                return (
                  <div key={ma.label} className="rounded-md bg-slate-700/50 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">{ma.label}</p>
                    <p className="mt-1 text-sm font-bold text-white">{formatPrice(ma.value)}</p>
                    {price > 0 && (
                      <p className={cn('mt-0.5 text-[10px] font-medium', above ? 'text-emerald-400' : 'text-red-400')}>
                        {above ? '▲ Above' : '▼ Below'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bollinger Bands + MACD detail */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            {tech.indicators.bollinger_bands && (
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <p className="mb-3 text-sm font-semibold text-white">Bollinger Bands</p>
              <div className="space-y-2">
                {[
                  { label: 'Upper Band', value: tech.indicators.bollinger_bands.upper, color: 'text-red-400' },
                  { label: 'Middle (SMA 20)', value: tech.indicators.bollinger_bands.middle, color: 'text-slate-300' },
                  { label: 'Lower Band', value: tech.indicators.bollinger_bands.lower, color: 'text-emerald-400' },
                ].map(b => (
                  <div key={b.label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">{b.label}</span>
                    <span className={cn('font-medium', b.color)}>{formatPrice(b.value)}</span>
                  </div>
                ))}
                {prices && (
                  <div className="mt-2 flex items-center justify-between text-sm border-t border-slate-700 pt-2">
                    <span className="text-slate-400">Current Price</span>
                    <span className="font-medium text-white">{formatPrice(prices.price)}</span>
                  </div>
                )}
              </div>
            </div>
            )}

            {tech.indicators.macd && (
            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <p className="mb-3 text-sm font-semibold text-white">MACD</p>
              <div className="space-y-2">
                {[
                  { label: 'MACD Line', value: tech.indicators.macd.macd_line.toFixed(4) },
                  { label: 'Signal Line', value: tech.indicators.macd.signal.toFixed(4) },
                ].map(m => (
                  <div key={m.label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">{m.label}</span>
                    <span className="font-medium text-white">{m.value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm border-t border-slate-700 pt-2">
                  <span className="text-slate-400">Histogram</span>
                  <span className={cn('font-bold', tech.indicators.macd.histogram > 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {tech.indicators.macd.histogram > 0 ? '+' : ''}{tech.indicators.macd.histogram.toFixed(4)}
                    <span className="ml-1 text-[10px] font-normal">
                      {tech.indicators.macd.histogram > 0 ? '(Bullish)' : '(Bearish)'}
                    </span>
                  </span>
                </div>
              </div>
            </div>
            )}
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
