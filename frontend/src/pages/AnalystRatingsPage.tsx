import { useState, useMemo } from 'react';
import { ThumbsUp, TrendingUp, TrendingDown, ArrowRight, Target, Loader2 } from 'lucide-react';
import { cn, formatPrice } from '../lib/utils';
import { useEstimates } from '../hooks/useEstimates';
import { usePrices } from '../hooks/usePrices';

const QUICK_TICKERS = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL', 'AMZN', 'META', 'JPM'] as const;

/* ---------- styling helpers ---------- */

function ratingColor(rating: string): string {
  const r = rating.toLowerCase();
  if (r.includes('strong buy') || r.includes('outperform') || r === 'buy') {
    return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
  }
  if (r.includes('hold') || r.includes('neutral') || r.includes('market perform')) {
    return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
  }
  if (r.includes('sell') || r.includes('underperform') || r.includes('underweight')) {
    return 'text-red-400 bg-red-400/10 border-red-400/30';
  }
  return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
}

function ratingScore(rating: string): number {
  const r = rating.toLowerCase();
  if (r.includes('strong buy')) return 5;
  if (r.includes('outperform') || r === 'buy' || r.includes('overweight')) return 4;
  if (r.includes('hold') || r.includes('neutral') || r.includes('market perform')) return 3;
  if (r.includes('underperform') || r.includes('underweight')) return 2;
  if (r.includes('sell')) return 1;
  return 3;
}

function consensusLabel(score: number): string {
  if (score >= 4.5) return 'Strong Buy';
  if (score >= 3.5) return 'Buy';
  if (score >= 2.5) return 'Hold';
  if (score >= 1.5) return 'Sell';
  return 'Strong Sell';
}

function consensusColor(label: string): string {
  if (label === 'Strong Buy') return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
  if (label === 'Buy') return 'text-green-400 bg-green-400/10 border-green-400/30';
  if (label === 'Hold') return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
  if (label === 'Sell') return 'text-orange-400 bg-orange-400/10 border-orange-400/30';
  return 'text-red-400 bg-red-400/10 border-red-400/30';
}

/* ---------- component ---------- */

export function AnalystRatingsPage() {
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [search, setSearch] = useState('');

  const { data: estimates, isLoading: loadingEst, error: errEst } = useEstimates(selectedTicker);
  const { data: priceData, isLoading: loadingPrice } = usePrices(selectedTicker);

  const isLoading = loadingEst || loadingPrice;

  /* ---- derived analytics ---- */
  const stats = useMemo(() => {
    if (!estimates || estimates.length === 0) return null;

    const withTargets = estimates.filter((e) => e.price_target > 0);
    const scores = estimates.map((e) => ratingScore(e.rating));
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    const targets = withTargets.map((e) => e.price_target);
    const avgTarget = targets.length > 0 ? targets.reduce((a, b) => a + b, 0) / targets.length : null;
    const lowTarget = targets.length > 0 ? Math.min(...targets) : null;
    const highTarget = targets.length > 0 ? Math.max(...targets) : null;

    const buys = estimates.filter((e) => ratingScore(e.rating) >= 4).length;
    const holds = estimates.filter((e) => ratingScore(e.rating) === 3).length;
    const sells = estimates.filter((e) => ratingScore(e.rating) <= 2).length;

    const label = consensusLabel(avgScore);
    return { avgScore, label, avgTarget, lowTarget, highTarget, buys, holds, sells, total: estimates.length };
  }, [estimates]);

  const currentPrice = priceData?.price ?? null;

  const upside =
    stats?.avgTarget != null && currentPrice != null
      ? ((stats.avgTarget - currentPrice) / currentPrice) * 100
      : null;

  const handleTickerSelect = (ticker: string) => {
    setSelectedTicker(ticker);
    setSearch('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <ThumbsUp className="h-7 w-7 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Analyst Ratings</h1>
        </div>
        <p className="text-slate-400">
          Wall Street consensus ratings, price targets, and recent analyst actions.
        </p>
      </div>

      {/* Ticker selector */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Enter ticker symbol..."
              value={search}
              onChange={(e) => setSearch(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.trim()) handleTickerSelect(search.trim());
              }}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_TICKERS.map((t) => (
              <button
                key={t}
                onClick={() => handleTickerSelect(t)}
                className={cn(
                  'px-3 py-1.5 rounded text-sm font-medium border transition-colors',
                  selectedTicker === t
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-900 border-slate-600 text-slate-300 hover:border-slate-500',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading analyst data for {selectedTicker}…</span>
        </div>
      )}

      {/* Error */}
      {!isLoading && errEst && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          Failed to load analyst ratings for {selectedTicker}. The data may not be available.
        </div>
      )}

      {/* No data */}
      {!isLoading && !errEst && estimates && estimates.length === 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center text-slate-400">
          No analyst ratings found for <span className="text-white font-medium">{selectedTicker}</span>.
        </div>
      )}

      {/* Consensus overview */}
      {!isLoading && stats && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            {selectedTicker} — Consensus Overview
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Consensus badge + distribution */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span
                  className={cn(
                    'px-4 py-2 rounded-lg border text-lg font-bold',
                    consensusColor(stats.label),
                  )}
                >
                  {stats.label}
                </span>
                <span className="text-slate-400 text-sm">{stats.total} analysts</span>
              </div>
              <div className="text-sm text-slate-400 mb-1">Rating Distribution</div>
              <div className="flex h-6 rounded overflow-hidden">
                {stats.buys > 0 && (
                  <div
                    className="flex items-center justify-center text-xs font-medium text-white bg-emerald-500"
                    style={{ width: `${(stats.buys / stats.total) * 100}%` }}
                    title={`Buy/Outperform: ${stats.buys}`}
                  >
                    {stats.buys}
                  </div>
                )}
                {stats.holds > 0 && (
                  <div
                    className="flex items-center justify-center text-xs font-medium text-white bg-yellow-500"
                    style={{ width: `${(stats.holds / stats.total) * 100}%` }}
                    title={`Hold/Neutral: ${stats.holds}`}
                  >
                    {stats.holds}
                  </div>
                )}
                {stats.sells > 0 && (
                  <div
                    className="flex items-center justify-center text-xs font-medium text-white bg-red-500"
                    style={{ width: `${(stats.sells / stats.total) * 100}%` }}
                    title={`Sell/Underperform: ${stats.sells}`}
                  >
                    {stats.sells}
                  </div>
                )}
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span className="text-emerald-400">Buy ({((stats.buys / stats.total) * 100).toFixed(0)}%)</span>
                <span className="text-yellow-400">Hold ({((stats.holds / stats.total) * 100).toFixed(0)}%)</span>
                <span className="text-red-400">Sell ({((stats.sells / stats.total) * 100).toFixed(0)}%)</span>
              </div>
            </div>

            {/* Price target vs current */}
            <div className="space-y-3">
              <div className="text-sm text-slate-400">Price Target vs Current</div>
              {currentPrice != null && stats.avgTarget != null ? (
                <>
                  <div className="flex items-end gap-6">
                    <div>
                      <div className="text-xs text-slate-500">Current</div>
                      <div className="text-xl font-bold text-white">{formatPrice(currentPrice)}</div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-500 mb-1" />
                    <div>
                      <div className="text-xs text-slate-500">Avg Target</div>
                      <div className="text-xl font-bold text-blue-400">{formatPrice(stats.avgTarget)}</div>
                    </div>
                    {upside != null && (
                      <div
                        className={cn(
                          'text-lg font-semibold mb-0.5',
                          upside >= 0 ? 'text-emerald-400' : 'text-red-400',
                        )}
                      >
                        {upside >= 0 ? '+' : ''}{upside.toFixed(1)}%
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm mt-2">
                    {upside != null && upside >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-400" />
                    )}
                    <span className="text-slate-400">
                      {upside != null && upside >= 0 ? 'Upside' : 'Downside'} potential
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-slate-500 text-sm">Price data unavailable</div>
              )}
            </div>

            {/* Price target range */}
            {stats.lowTarget != null && stats.avgTarget != null && stats.highTarget != null && (
              <div className="space-y-3">
                <div className="text-sm text-slate-400 flex items-center gap-1">
                  <Target className="h-4 w-4" /> Price Target Range
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Low: {formatPrice(stats.lowTarget)}</span>
                  <span>Avg: {formatPrice(stats.avgTarget)}</span>
                  <span>High: {formatPrice(stats.highTarget)}</span>
                </div>
                <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden">
                  {currentPrice != null && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
                      style={{
                        left: `${Math.min(98, Math.max(2, ((currentPrice - stats.lowTarget) / (stats.highTarget - stats.lowTarget)) * 100))}%`,
                      }}
                    />
                  )}
                  <div
                    className="absolute top-0 bottom-0 w-2 h-3 rounded bg-blue-500"
                    style={{
                      left: `${Math.min(98, Math.max(2, ((stats.avgTarget - stats.lowTarget) / (stats.highTarget - stats.lowTarget)) * 100))}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white">● Current Price</span>
                  <span className="text-blue-400">■ Avg Target</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analyst ratings table */}
      {!isLoading && estimates && estimates.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">
              Analyst Ratings — {selectedTicker}
            </h2>
            <p className="text-xs text-slate-500 mt-1">{estimates.length} ratings on record</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Analyst</th>
                  <th className="text-left px-4 py-3 font-medium">Firm</th>
                  <th className="text-left px-4 py-3 font-medium">Rating</th>
                  <th className="text-right px-4 py-3 font-medium">Price Target</th>
                  {currentPrice != null && (
                    <th className="text-right px-4 py-3 font-medium">Upside</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {[...estimates]
                  .sort((a, b) => b.published_date.localeCompare(a.published_date))
                  .map((r, i) => {
                    const ups =
                      r.price_target > 0 && currentPrice != null
                        ? ((r.price_target - currentPrice) / currentPrice) * 100
                        : null;
                    return (
                      <tr
                        key={i}
                        className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-slate-400 text-xs">{r.published_date}</td>
                        <td className="px-4 py-3 text-slate-300">
                          {r.analyst_name || <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-white font-medium">
                          {r.analyst_company || <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {r.rating ? (
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded text-xs font-medium border',
                                ratingColor(r.rating),
                              )}
                            >
                              {r.rating}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          {r.price_target > 0 ? formatPrice(r.price_target) : <span className="text-slate-600">—</span>}
                        </td>
                        {currentPrice != null && (
                          <td
                            className={cn(
                              'px-4 py-3 text-right text-xs font-medium',
                              ups == null
                                ? 'text-slate-600'
                                : ups >= 0
                                ? 'text-emerald-400'
                                : 'text-red-400',
                            )}
                          >
                            {ups != null ? `${ups >= 0 ? '+' : ''}${ups.toFixed(1)}%` : '—'}
                          </td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary cards */}
      {!isLoading && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-xs text-slate-500 mb-1">Total Analysts</div>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-xs text-slate-500 mb-1">Buy / Outperform</div>
            <div className="text-2xl font-bold text-emerald-400">
              {stats.buys}
              <span className="text-sm text-slate-500 ml-1">
                ({((stats.buys / stats.total) * 100).toFixed(0)}%)
              </span>
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-xs text-slate-500 mb-1">Hold / Neutral</div>
            <div className="text-2xl font-bold text-yellow-400">
              {stats.holds}
              <span className="text-sm text-slate-500 ml-1">
                ({((stats.holds / stats.total) * 100).toFixed(0)}%)
              </span>
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-xs text-slate-500 mb-1">Avg Price Target</div>
            <div className="text-2xl font-bold text-blue-400">
              {stats.avgTarget != null ? formatPrice(stats.avgTarget) : '—'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
