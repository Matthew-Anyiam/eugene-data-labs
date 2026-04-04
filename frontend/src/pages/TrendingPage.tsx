import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Loader2, TrendingUp, Newspaper, Star } from 'lucide-react';
import { cn } from '../lib/utils';
import { useWorldNews } from '../hooks/useNewsSentiment';
import { useWatchlist } from '../hooks/useWatchlist';
import type { NewsArticle } from '../hooks/useNewsSentiment';

// ─── Ticker extraction ────────────────────────────────────────────────────────

// Words that look like tickers but aren't
const TICKER_BLOCKLIST = new Set([
  'A', 'I', 'AM', 'AN', 'AS', 'AT', 'BE', 'BY', 'DO', 'GO', 'IF', 'IN',
  'IS', 'IT', 'MY', 'NO', 'OF', 'ON', 'OR', 'SO', 'TO', 'UP', 'US', 'WE',
  'AI', 'AR', 'IT', 'UK', 'EU', 'UN', 'IPO', 'CEO', 'CFO', 'COO', 'CTO',
  'ETF', 'GDP', 'CPI', 'FED', 'SEC', 'IRS', 'FDA', 'NYSE', 'NASDAQ',
  'WHAT', 'WHEN', 'WITH', 'FROM', 'INTO', 'OVER', 'THAN', 'THAT', 'THEN',
  'THEY', 'THIS', 'WERE', 'YOUR', 'HAVE', 'BEEN', 'WILL', 'SAYS', 'SAID',
  'ALSO', 'JUST', 'MOST', 'SOME', 'SUCH', 'WELL', 'BEEN', 'THAN', 'MORE',
  'WILL', 'RISE', 'FALL', 'HIGH', 'WEEK', 'YEAR', 'SELL', 'HOLD', 'RATE',
  'DEAL', 'FIRM', 'FUND', 'BOND', 'CASH', 'DEBT', 'BANK', 'CALL', 'PUTS',
  'BULL', 'BEAR', 'RISK', 'LOSS', 'GAIN', 'PLAN', 'UNIT', 'PART',
]);

function extractTickers(text: string): string[] {
  // Match 2-5 capital letters optionally preceded by $ or standalone
  const matches = text.match(/\$([A-Z]{1,5})|(?<![A-Za-z])([A-Z]{2,5})(?![A-Za-z])/g) || [];
  return matches
    .map((m) => m.replace('$', ''))
    .filter((t) => t.length >= 2 && t.length <= 5 && !TICKER_BLOCKLIST.has(t));
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TickerMention {
  ticker: string;
  count: number;
  articles: NewsArticle[];
  sentiment: number; // avg sentiment_score
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TrendingPage() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useWorldNews(
    'stocks market earnings',
    'finance',
    '24h',
    50,
  );
  const { tickers: watchlistTickers } = useWatchlist();

  const articles: NewsArticle[] = data?.articles ?? [];

  // Tally ticker mentions across all article titles + summaries
  const tickerMentions = useMemo<TickerMention[]>(() => {
    const map = new Map<string, { count: number; articles: NewsArticle[]; sentimentSum: number }>();

    articles.forEach((article) => {
      const text = `${article.title} ${article.summary ?? ''}`;
      const tickers = [...new Set(extractTickers(text))];
      tickers.forEach((ticker) => {
        const existing = map.get(ticker);
        if (existing) {
          existing.count++;
          if (!existing.articles.includes(article)) existing.articles.push(article);
          existing.sentimentSum += article.sentiment_score ?? 0;
        } else {
          map.set(ticker, {
            count: 1,
            articles: [article],
            sentimentSum: article.sentiment_score ?? 0,
          });
        }
      });
    });

    return Array.from(map.entries())
      .map(([ticker, data]) => ({
        ticker,
        count: data.count,
        articles: data.articles,
        sentiment: data.count > 0 ? data.sentimentSum / data.count : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
  }, [articles]);

  // Articles for selected ticker (or all recent articles)
  const displayedArticles = useMemo(() => {
    if (selectedTicker) {
      return (
        tickerMentions.find((t) => t.ticker === selectedTicker)?.articles ?? []
      );
    }
    return articles.slice(0, 20);
  }, [selectedTicker, tickerMentions, articles]);

  // Watchlist tickers that also appear in trending
  const watchlistInTrending = useMemo(
    () => watchlistTickers.filter((t) => tickerMentions.some((m) => m.ticker === t)),
    [watchlistTickers, tickerMentions],
  );

  const maxCount = tickerMentions[0]?.count ?? 1;

  function sentimentColor(score: number) {
    if (score > 0.2) return 'text-emerald-400';
    if (score < -0.2) return 'text-red-400';
    return 'text-slate-400';
  }

  function sentimentLabel(score: number) {
    if (score > 0.4) return 'Bullish';
    if (score > 0.1) return 'Mildly bullish';
    if (score < -0.4) return 'Bearish';
    if (score < -0.1) return 'Mildly bearish';
    return 'Neutral';
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Sparkles className="h-6 w-6 text-yellow-400" />
            Trending Stocks
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Ticker mentions extracted from recent financial news · last 24h
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <TrendingUp className="h-3.5 w-3.5" />
          )}
          Refresh
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error instanceof Error ? error.message : 'Failed to load news.'}
        </div>
      )}

      {!isLoading && !error && articles.length === 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 py-12 text-center text-sm text-slate-500">
          No recent articles found.
        </div>
      )}

      {!isLoading && articles.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: trending tickers */}
          <div className="lg:col-span-1 space-y-4">
            {/* Watchlist tickers in news */}
            {watchlistInTrending.length > 0 && (
              <div className="rounded-xl border border-amber-700/40 bg-amber-900/10 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-400">
                  <Star className="h-3.5 w-3.5" /> Watchlist in News
                </div>
                <div className="flex flex-wrap gap-2">
                  {watchlistInTrending.map((t) => {
                    const mention = tickerMentions.find((m) => m.ticker === t);
                    return (
                      <button
                        key={t}
                        onClick={() => setSelectedTicker(selectedTicker === t ? null : t)}
                        className={cn(
                          'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                          selectedTicker === t
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-800 text-amber-300 hover:bg-amber-900/30',
                        )}
                      >
                        {t}
                        {mention && (
                          <span className="ml-1 text-[10px] opacity-70">
                            {mention.count}×
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Trending ticker list */}
            <div className="rounded-xl border border-slate-700 bg-slate-800">
              <div className="border-b border-slate-700 px-4 py-2">
                <h2 className="text-sm font-semibold text-white">
                  Top Mentions ({tickerMentions.length})
                </h2>
                <p className="text-[10px] text-slate-500">from {articles.length} articles</p>
              </div>
              <div className="divide-y divide-slate-700/50">
                {tickerMentions.length === 0 && (
                  <p className="px-4 py-6 text-center text-xs text-slate-500">
                    No ticker symbols detected in news titles.
                  </p>
                )}
                {tickerMentions.map((m, rank) => (
                  <button
                    key={m.ticker}
                    onClick={() => setSelectedTicker(selectedTicker === m.ticker ? null : m.ticker)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      selectedTicker === m.ticker
                        ? 'bg-slate-700'
                        : 'hover:bg-slate-700/50',
                    )}
                  >
                    {/* Rank */}
                    <span className="w-5 text-right font-mono text-xs text-slate-500">
                      {rank + 1}
                    </span>

                    {/* Ticker */}
                    <span className="w-16 font-mono text-sm font-bold text-white">
                      {m.ticker}
                    </span>

                    {/* Bar */}
                    <div className="flex-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                        <div
                          className="h-full rounded-full bg-yellow-500/70 transition-all"
                          style={{ width: `${(m.count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Count */}
                    <span className="w-8 text-right text-xs text-slate-400">
                      {m.count}×
                    </span>

                    {/* Sentiment */}
                    <span className={cn('w-16 text-right text-[10px]', sentimentColor(m.sentiment))}>
                      {sentimentLabel(m.sentiment)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: articles */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-white">
                {selectedTicker
                  ? `Articles mentioning ${selectedTicker}`
                  : 'Recent Articles'}
              </h2>
              {selectedTicker && (
                <button
                  onClick={() => setSelectedTicker(null)}
                  className="ml-auto text-xs text-slate-500 hover:text-slate-300"
                >
                  Clear filter
                </button>
              )}
            </div>

            {displayedArticles.length === 0 && (
              <div className="rounded-xl border border-slate-700 bg-slate-800/30 py-8 text-center text-xs text-slate-500">
                No articles found for {selectedTicker}.
              </div>
            )}

            <div className="space-y-3">
              {displayedArticles.map((article, i) => {
                // Extract tickers from this article to show as tags
                const articleTickers = [
                  ...new Set(extractTickers(`${article.title} ${article.summary ?? ''}`)),
                ].slice(0, 6);
                const score = article.sentiment_score ?? 0;

                return (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-700 bg-slate-800 p-4 transition-colors hover:border-slate-600"
                  >
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-white hover:text-yellow-300 hover:underline"
                      >
                        {article.title}
                      </a>
                      <span
                        className={cn(
                          'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                          score > 0.1
                            ? 'bg-emerald-900/40 text-emerald-400'
                            : score < -0.1
                              ? 'bg-red-900/40 text-red-400'
                              : 'bg-slate-700 text-slate-400',
                        )}
                      >
                        {score > 0 ? '+' : ''}
                        {score.toFixed(2)}
                      </span>
                    </div>

                    {article.summary && (
                      <p className="mb-2 line-clamp-2 text-xs text-slate-400">
                        {article.summary}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-slate-500">
                        {article.source} · {article.date?.slice(0, 10)}
                      </span>

                      {articleTickers.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {articleTickers.map((t) => (
                            <button
                              key={t}
                              onClick={() => setSelectedTicker(t)}
                              className="rounded bg-slate-700 px-1.5 py-0.5 font-mono text-[10px] text-yellow-400 hover:bg-yellow-900/30"
                            >
                              ${t}
                            </button>
                          ))}
                        </div>
                      )}

                      <Link
                        to={`/company/${articleTickers[0] ?? ''}`}
                        className={cn(
                          'ml-auto text-[10px] text-slate-500 hover:text-slate-300',
                          !articleTickers[0] && 'pointer-events-none opacity-0',
                        )}
                      >
                        View company →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
