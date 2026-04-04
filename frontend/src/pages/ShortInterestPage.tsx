import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownUp, Loader2, AlertTriangle, BarChart3 } from 'lucide-react';
import { useFloat } from '../hooks/useFloat';
import { usePrices } from '../hooks/usePrices';
import { cn, formatPrice } from '../lib/utils';

const QUICK_TICKERS = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL', 'AMZN', 'SPY', 'QQQ'];

function fmtShares(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function FloatBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-700">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

export function ShortInterestPage() {
  const [ticker, setTicker] = useState('AAPL');
  const [input, setInput] = useState('AAPL');

  const { data: floatResp, isLoading: floatLoading, error: floatError } = useFloat(ticker);
  const { data: priceData, isLoading: priceLoading } = usePrices(ticker);

  const isLoading = floatLoading || priceLoading;
  const floatData = floatResp?.data ?? null;
  const price = priceData?.price ?? null;

  const outstandingShares = floatData?.outstanding_shares ?? null;
  const floatShares = floatData?.float_shares ?? null;
  const freeFloatPct = floatData?.free_float ?? null;

  // Derived: restricted shares = outstanding - float
  const restrictedShares = outstandingShares && floatShares
    ? Math.max(0, outstandingShares - floatShares)
    : null;
  const restrictedPct = outstandingShares && restrictedShares
    ? (restrictedShares / outstandingShares) * 100
    : null;

  // Market cap from price + shares (if available)
  const marketCapCalc = price && outstandingShares ? price * outstandingShares : null;

  function handleSearch() {
    const t = input.trim().toUpperCase();
    if (t) setTicker(t);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ArrowDownUp className="h-6 w-6 text-red-400" />
          Short Interest
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Float structure and share analysis for {ticker}.
        </p>
      </div>

      {/* Coming soon banner */}
      <div className="flex items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
        <p className="text-sm text-red-300">
          <span className="font-semibold">Short interest data coming soon.</span>{' '}
          Shares short, days to cover, cost to borrow, and short squeeze metrics are in development.
          Currently showing: float and share structure data.
        </p>
      </div>

      {/* Search + Quick Tickers */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Enter ticker symbol..."
            className="flex-1 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded font-medium"
          >
            Search
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_TICKERS.map(t => (
            <button
              key={t}
              onClick={() => { setTicker(t); setInput(t); }}
              className={cn(
                'px-3 py-1 rounded text-xs font-mono border transition-colors',
                ticker === t
                  ? 'bg-red-600 border-red-500 text-white'
                  : 'bg-slate-900 border-slate-600 text-slate-300 hover:border-slate-500',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading data for {ticker}...</span>
        </div>
      )}

      {floatError && !floatLoading && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Failed to load float data for {ticker}.
        </div>
      )}

      {!isLoading && (
        <>
          {/* Price banner */}
          {priceData && (
            <div className="flex items-baseline gap-3">
              <span className="text-xl font-bold text-white">{ticker}</span>
              <span className="text-lg text-white">{formatPrice(priceData.price)}</span>
              <span className={cn('text-sm font-medium', priceData.change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {priceData.change >= 0 ? '+' : ''}{priceData.change.toFixed(2)} ({priceData.change_percent.toFixed(2)}%)
              </span>
            </div>
          )}

          {floatData ? (
            <>
              {/* Share structure cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                  <p className="text-xs text-slate-400 mb-1">Outstanding Shares</p>
                  <p className="text-lg font-bold text-white font-mono">{fmtShares(outstandingShares!)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Total issued shares</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                  <p className="text-xs text-slate-400 mb-1">Float Shares</p>
                  <p className="text-lg font-bold text-white font-mono">{fmtShares(floatShares!)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Publicly tradeable</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                  <p className="text-xs text-slate-400 mb-1">Free Float</p>
                  <p className={cn(
                    'text-lg font-bold font-mono',
                    freeFloatPct! < 20 ? 'text-red-400' : freeFloatPct! < 50 ? 'text-amber-400' : 'text-emerald-400',
                  )}>
                    {freeFloatPct != null ? `${freeFloatPct.toFixed(1)}%` : '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Of outstanding</p>
                </div>
                {restrictedShares != null && (
                  <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                    <p className="text-xs text-slate-400 mb-1">Restricted / Insider Held</p>
                    <p className="text-lg font-bold text-white font-mono">{fmtShares(restrictedShares)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {restrictedPct != null ? `${restrictedPct.toFixed(1)}% of total` : ''}
                    </p>
                  </div>
                )}
                {marketCapCalc != null && (
                  <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                    <p className="text-xs text-slate-400 mb-1">Market Cap (calc.)</p>
                    <p className="text-lg font-bold text-white font-mono">
                      {marketCapCalc >= 1e12
                        ? `$${(marketCapCalc / 1e12).toFixed(2)}T`
                        : marketCapCalc >= 1e9
                          ? `$${(marketCapCalc / 1e9).toFixed(2)}B`
                          : `$${(marketCapCalc / 1e6).toFixed(0)}M`}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Price × shares outstanding</p>
                  </div>
                )}
                {price && floatShares != null && (
                  <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                    <p className="text-xs text-slate-400 mb-1">Float Market Value</p>
                    <p className="text-lg font-bold text-white font-mono">
                      {(() => {
                        const fv = price * floatShares;
                        return fv >= 1e12 ? `$${(fv / 1e12).toFixed(2)}T`
                          : fv >= 1e9 ? `$${(fv / 1e9).toFixed(2)}B`
                          : `$${(fv / 1e6).toFixed(0)}M`;
                      })()}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Price × float shares</p>
                  </div>
                )}
              </div>

              {/* Float structure visual */}
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-4 w-4 text-slate-400" />
                  <h2 className="text-sm font-semibold text-white">Float Structure — {ticker}</h2>
                </div>
                <div className="space-y-4">
                  {freeFloatPct != null && (
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Free Float</span>
                        <span className={cn(
                          'font-mono',
                          freeFloatPct < 20 ? 'text-red-400' : freeFloatPct < 50 ? 'text-amber-400' : 'text-emerald-400',
                        )}>
                          {freeFloatPct.toFixed(1)}%
                        </span>
                      </div>
                      <FloatBar
                        pct={freeFloatPct}
                        color={freeFloatPct < 20 ? 'bg-red-500' : freeFloatPct < 50 ? 'bg-amber-500' : 'bg-emerald-500'}
                      />
                    </div>
                  )}
                  {restrictedPct != null && (
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Restricted / Insider</span>
                        <span className="font-mono text-slate-300">{restrictedPct.toFixed(1)}%</span>
                      </div>
                      <FloatBar pct={restrictedPct} color="bg-slate-500" />
                    </div>
                  )}

                  {/* Combined bar */}
                  {freeFloatPct != null && restrictedPct != null && (
                    <div className="mt-2">
                      <p className="text-xs text-slate-400 mb-1">Ownership split</p>
                      <div className="flex h-5 overflow-hidden rounded-full">
                        <div
                          className="bg-emerald-500/70 flex items-center justify-center text-[9px] text-white font-semibold"
                          style={{ width: `${freeFloatPct}%` }}
                        >
                          {freeFloatPct > 10 ? 'Float' : ''}
                        </div>
                        <div
                          className="bg-slate-500/70 flex items-center justify-center text-[9px] text-white font-semibold"
                          style={{ width: `${restrictedPct}%` }}
                        >
                          {restrictedPct > 10 ? 'Restricted' : ''}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-400">
                  <strong className="text-slate-300">Float Analysis:</strong>{' '}
                  {freeFloatPct != null && freeFloatPct < 20
                    ? 'Low float stock — small share count means higher potential for volatile price swings.'
                    : freeFloatPct != null && freeFloatPct < 50
                      ? 'Medium float — moderate liquidity. Insider/institutional concentration is notable.'
                      : 'High float — broad public ownership provides good liquidity and stability.'}
                </div>
              </div>

              {/* What's coming next */}
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">What's coming in Short Interest</h3>
                <ul className="space-y-1.5 text-xs text-slate-500">
                  {[
                    'Shares short and short % of float',
                    'Days to cover (short interest / avg daily volume)',
                    'Cost to borrow (annualized fee rate)',
                    'Short interest trend over 6 bi-weekly reporting periods',
                    'Short squeeze score and signal factors',
                    'Market-wide most-shorted rankings',
                  ].map(item => (
                    <li key={item} className="flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-slate-600 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            !floatError && (
              <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-10 text-center">
                <p className="text-slate-400 text-sm">No float data available for {ticker}.</p>
                <Link to={`/company/${ticker}`} className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300">
                  View {ticker} company profile &rarr;
                </Link>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
