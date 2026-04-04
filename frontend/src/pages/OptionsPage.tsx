import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Target, Calculator, Loader2, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { usePrices } from '../hooks/usePrices';
import { useTechnicals } from '../hooks/useTechnicals';
import { cn, formatPrice } from '../lib/utils';

const QUICK_TICKERS = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL', 'AMZN', 'SPY', 'QQQ'];

type OptionType = 'call' | 'put';

function computePayoff(
  type: OptionType,
  strike: number,
  premium: number,
  currentPrice: number,
) {
  const breakeven = type === 'call' ? strike + premium : strike - premium;
  const intrinsicValue =
    type === 'call'
      ? Math.max(0, currentPrice - strike)
      : Math.max(0, strike - currentPrice);
  const pnl = intrinsicValue - premium;
  const maxLoss = -premium;
  const maxProfit = type === 'call' ? Infinity : strike - premium;
  return { breakeven, intrinsicValue, pnl, maxLoss, maxProfit };
}

function PayoffBar({ pnl, premium }: { pnl: number; premium: number }) {
  const maxAbs = Math.max(Math.abs(pnl), premium, 1);
  const pct = Math.min(100, (Math.abs(pnl) / maxAbs) * 100);
  return (
    <div className="mt-2 flex h-4 w-full overflow-hidden rounded-full bg-slate-700">
      {pnl >= 0 ? (
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      ) : (
        <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${pct}%` }} />
      )}
    </div>
  );
}

export function OptionsPage() {
  const [ticker, setTicker] = useState('AAPL');
  const [input, setInput] = useState('AAPL');

  // Payoff calculator state
  const [optType, setOptType] = useState<OptionType>('call');
  const [strikeInput, setStrikeInput] = useState('');
  const [premiumInput, setPremiumInput] = useState('');

  const { data: priceData, isLoading: priceLoading } = usePrices(ticker);
  const { data: techData, isLoading: techLoading } = useTechnicals(ticker);

  const price = priceData?.price ?? null;
  const tech = techData?.data?.indicators ?? null;

  const strike = parseFloat(strikeInput);
  const premium = parseFloat(premiumInput);
  const calcValid = !isNaN(strike) && strike > 0 && !isNaN(premium) && premium > 0 && price !== null;
  const payoff = calcValid ? computePayoff(optType, strike, premium, price!) : null;

  function handleSearch() {
    const t = input.trim().toUpperCase();
    if (t) setTicker(t);
  }

  const isLoading = priceLoading || techLoading;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-400" />
          <h1 className="text-2xl font-bold tracking-tight text-white">Options</h1>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Underlying volatility analysis and payoff calculator
        </p>
      </div>

      {/* Coming soon banner */}
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-sm text-amber-300">
          <span className="font-semibold">Full options chain coming soon.</span>{' '}
          Live bid/ask, greeks, open interest, and expiration chains are in development.
        </p>
      </div>

      {/* Ticker search */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex">
          <input
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Ticker..."
            className="w-28 rounded-l-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleSearch}
            className="rounded-r-lg border border-l-0 border-slate-700 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Go
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TICKERS.map(t => (
            <button
              key={t}
              onClick={() => { setTicker(t); setInput(t); }}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition',
                t === ticker
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <Link to={`/company/${ticker}`} className="ml-auto text-xs text-blue-400 hover:text-blue-300">
          View {ticker} profile &rarr;
        </Link>
      </div>

      {/* Price banner */}
      {isLoading ? (
        <div className="mb-6 flex items-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading {ticker}...</span>
        </div>
      ) : priceData ? (
        <div className="mb-6 flex items-baseline gap-3">
          <span className="text-xl font-bold text-white">{ticker}</span>
          <span className="text-lg text-white">{formatPrice(priceData.price)}</span>
          <span className={cn('text-sm font-medium', priceData.change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {priceData.change >= 0 ? '+' : ''}{priceData.change.toFixed(2)} ({priceData.change_percent.toFixed(2)}%)
          </span>
          <span className="text-xs text-slate-500">
            H: {formatPrice(priceData.day_high)} &nbsp;L: {formatPrice(priceData.day_low)}
          </span>
        </div>
      ) : (
        <div className="mb-6 text-sm text-slate-500">No price data available for {ticker}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Volatility panel */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">Volatility Signals — {ticker}</h2>

          {techLoading && (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading indicators...</span>
            </div>
          )}

          {!techLoading && !tech && (
            <p className="text-sm text-slate-500">No technicals data available.</p>
          )}

          {tech && (
            <div className="space-y-4">
              {/* ATR */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">Average True Range (ATR)</span>
                  <span className="font-mono text-sm font-semibold text-white">
                    {formatPrice(tech.atr)}
                  </span>
                </div>
                {price && (
                  <p className="text-xs text-slate-500">
                    {((tech.atr / price) * 100).toFixed(2)}% of current price —
                    implied daily move range of approx. {formatPrice(tech.atr / Math.sqrt(21))} per day
                  </p>
                )}
              </div>

              {/* RSI */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">RSI (14)</span>
                  <span className={cn(
                    'font-mono text-sm font-semibold',
                    tech.rsi > 70 ? 'text-red-400' : tech.rsi < 30 ? 'text-emerald-400' : 'text-white',
                  )}>
                    {tech.rsi.toFixed(1)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                  <div
                    className={cn(
                      'h-2 rounded-full',
                      tech.rsi > 70 ? 'bg-red-500' : tech.rsi < 30 ? 'bg-emerald-500' : 'bg-blue-500',
                    )}
                    style={{ width: `${Math.min(100, tech.rsi)}%` }}
                  />
                </div>
                <div className="mt-0.5 flex justify-between text-[10px] text-slate-600">
                  <span>Oversold 30</span><span>Neutral</span><span>Overbought 70</span>
                </div>
              </div>

              {/* Bollinger Bands */}
              <div>
                <p className="mb-2 text-xs font-medium text-slate-400">Bollinger Bands (20, 2σ)</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Upper Band</span>
                    <span className="font-mono text-red-300">{formatPrice(tech.bollinger_bands.upper)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Middle (SMA 20)</span>
                    <span className="font-mono text-white">{formatPrice(tech.bollinger_bands.middle)}</span>
                  </div>
                  {price && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Current Price</span>
                      <span className={cn(
                        'font-mono font-semibold',
                        price > tech.bollinger_bands.upper ? 'text-red-400' :
                        price < tech.bollinger_bands.lower ? 'text-emerald-400' : 'text-blue-300',
                      )}>
                        {formatPrice(price)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Lower Band</span>
                    <span className="font-mono text-emerald-300">{formatPrice(tech.bollinger_bands.lower)}</span>
                  </div>
                </div>
                {price && (
                  <div className="mt-2">
                    {/* Position within band */}
                    {(() => {
                      const range = tech.bollinger_bands.upper - tech.bollinger_bands.lower;
                      const pct = range > 0
                        ? Math.min(100, Math.max(0, ((price - tech.bollinger_bands.lower) / range) * 100))
                        : 50;
                      return (
                        <>
                          <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-700">
                            <div
                              className="absolute top-0 h-3 w-1 rounded-full bg-white"
                              style={{ left: `calc(${pct}% - 2px)` }}
                            />
                          </div>
                          <p className="mt-1 text-[10px] text-slate-500">
                            Price is at {pct.toFixed(0)}% of band width
                            {pct > 80 ? ' — near upper band (potential resistance)' :
                             pct < 20 ? ' — near lower band (potential support)' : ''}
                          </p>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Band width as vol proxy */}
              {price && (() => {
                const bw = ((tech.bollinger_bands.upper - tech.bollinger_bands.lower) / tech.bollinger_bands.middle) * 100;
                return (
                  <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Band Width (volatility proxy)</span>
                      <span className={cn('font-mono font-semibold', bw > 10 ? 'text-amber-400' : 'text-slate-300')}>
                        {bw.toFixed(2)}%
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {bw > 10 ? 'Elevated volatility — wider option premiums expected' : 'Low volatility environment'}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Payoff Calculator */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Calculator className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Option Payoff Calculator</h2>
          </div>

          {/* Type toggle */}
          <div className="mb-4 flex rounded-lg border border-slate-700 bg-slate-900 p-1">
            <button
              onClick={() => setOptType('call')}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition',
                optType === 'call' ? 'bg-emerald-600/70 text-white' : 'text-slate-400 hover:text-white',
              )}
            >
              <TrendingUp className="h-3 w-3" /> Call
            </button>
            <button
              onClick={() => setOptType('put')}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition',
                optType === 'put' ? 'bg-red-600/70 text-white' : 'text-slate-400 hover:text-white',
              )}
            >
              <TrendingDown className="h-3 w-3" /> Put
            </button>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Strike Price ($)</span>
              <input
                type="number"
                value={strikeInput}
                onChange={e => setStrikeInput(e.target.value)}
                placeholder={price ? price.toFixed(2) : 'e.g. 150.00'}
                className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Premium Paid ($ per share)</span>
              <input
                type="number"
                value={premiumInput}
                onChange={e => setPremiumInput(e.target.value)}
                placeholder="e.g. 5.00"
                className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </label>

            {price && (
              <p className="text-xs text-slate-500">
                Current underlying price: <span className="text-white font-mono">{formatPrice(price)}</span>
              </p>
            )}

            {!price && !priceLoading && (
              <p className="text-xs text-amber-400">Enter a valid ticker above to use real underlying price.</p>
            )}
          </div>

          {/* Results */}
          {calcValid && payoff && (
            <div className="mt-5 space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {optType === 'call' ? 'Long Call' : 'Long Put'} — {ticker} @ {formatPrice(strike)} strike
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded bg-slate-800 px-2 py-1.5">
                  <p className="text-slate-500">Breakeven</p>
                  <p className="font-mono font-semibold text-white">{formatPrice(payoff.breakeven)}</p>
                </div>
                <div className="rounded bg-slate-800 px-2 py-1.5">
                  <p className="text-slate-500">Current P&L / share</p>
                  <p className={cn('font-mono font-semibold', payoff.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {payoff.pnl >= 0 ? '+' : ''}{formatPrice(payoff.pnl)}
                  </p>
                </div>
                <div className="rounded bg-slate-800 px-2 py-1.5">
                  <p className="text-slate-500">Max Loss</p>
                  <p className="font-mono font-semibold text-red-400">{formatPrice(payoff.maxLoss)}</p>
                </div>
                <div className="rounded bg-slate-800 px-2 py-1.5">
                  <p className="text-slate-500">Max Profit</p>
                  <p className="font-mono font-semibold text-emerald-400">
                    {payoff.maxProfit === Infinity ? 'Unlimited' : formatPrice(payoff.maxProfit)}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-[10px] text-slate-500">P&L visual (vs max loss)</p>
                <PayoffBar pnl={payoff.pnl} premium={premium} />
                <p className="mt-1 text-[10px] text-slate-500">
                  {payoff.pnl >= 0 ? 'In the money' : 'Out of the money'} at current price.
                  {' '}Price must move {formatPrice(Math.abs(price! - payoff.breakeven))} to break even.
                </p>
              </div>

              <div className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-400">
                <strong className="text-slate-300">Note:</strong> Per-contract cost = premium &times; 100 ={' '}
                <span className="font-mono text-white">${(premium * 100).toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
