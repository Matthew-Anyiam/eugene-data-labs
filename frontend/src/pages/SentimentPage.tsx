import { useState } from 'react';
import { Brain, TrendingUp, TrendingDown, Activity, MessageCircle, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';
import { useNewsSentiment, useWorldNews } from '../hooks/useNewsSentiment';

const QUICK_QUERIES = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'market', 'economy', 'inflation', 'AI'];
const TOPICS = ['', 'geopolitics', 'trade', 'energy', 'tech', 'finance', 'climate'];
const TIMESPANS = ['24h', '7d', '30d'];

function sentimentColor(score: number): string {
  if (score > 0.3) return 'text-emerald-400';
  if (score > 0) return 'text-green-400';
  if (score < -0.3) return 'text-red-400';
  if (score < 0) return 'text-orange-400';
  return 'text-slate-400';
}

function sentimentBg(score: number): string {
  if (score > 0.3) return 'bg-emerald-500';
  if (score > 0) return 'bg-green-500';
  if (score < -0.3) return 'bg-red-500';
  if (score < 0) return 'bg-orange-500';
  return 'bg-slate-500';
}

function trendIcon(trend: string) {
  if (trend === 'improving') return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  if (trend === 'declining') return <TrendingDown className="h-4 w-4 text-red-400" />;
  return <Activity className="h-4 w-4 text-slate-400" />;
}

function trendColor(trend: string): string {
  if (trend === 'improving') return 'text-emerald-400';
  if (trend === 'declining') return 'text-red-400';
  return 'text-slate-400';
}

function SentimentGauge({ score }: { score: number }) {
  // score is -1 to 1; convert to 0-100 for display
  const normalized = Math.round(((score + 1) / 2) * 100);
  const rotation = -90 + (normalized / 100) * 180;
  const label =
    score > 0.5 ? 'Very Positive' :
    score > 0.1 ? 'Positive' :
    score < -0.5 ? 'Very Negative' :
    score < -0.1 ? 'Negative' : 'Neutral';
  const color =
    score > 0.1 ? 'text-emerald-400' :
    score < -0.1 ? 'text-red-400' : 'text-slate-300';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-36 w-64">
        <svg viewBox="0 0 200 110" className="h-full w-full">
          <path d="M 20 100 A 80 80 0 0 1 56 36" fill="none" stroke="#ef4444" strokeWidth="12" strokeLinecap="round" />
          <path d="M 56 36 A 80 80 0 0 1 82 22" fill="none" stroke="#f97316" strokeWidth="12" strokeLinecap="round" />
          <path d="M 82 22 A 80 80 0 0 1 118 22" fill="none" stroke="#64748b" strokeWidth="12" strokeLinecap="round" />
          <path d="M 118 22 A 80 80 0 0 1 144 36" fill="none" stroke="#4ade80" strokeWidth="12" strokeLinecap="round" />
          <path d="M 144 36 A 80 80 0 0 1 180 100" fill="none" stroke="#10b981" strokeWidth="12" strokeLinecap="round" />
          <g transform={`rotate(${rotation}, 100, 100)`}>
            <line x1="100" y1="100" x2="100" y2="30" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="100" cy="100" r="5" fill="white" />
          </g>
        </svg>
      </div>
      <div className="text-center">
        <div className="text-4xl font-bold text-white">{score.toFixed(2)}</div>
        <div className={cn('mt-1 text-lg font-semibold', color)}>{label}</div>
      </div>
    </div>
  );
}

export function SentimentPage() {
  const [query, setQuery] = useState('market');
  const [queryInput, setQueryInput] = useState('');
  const [topic, setTopic] = useState('');
  const [timespan, setTimespan] = useState('30d');

  const sentimentQuery = useNewsSentiment(query, timespan);
  const newsQuery = useWorldNews(query, topic || undefined, timespan, 20);

  const sentiment = sentimentQuery.data;
  const articles = newsQuery.data?.articles ?? [];

  const submitQuery = (q: string) => {
    const trimmed = q.trim();
    if (trimmed) {
      setQuery(trimmed);
      setQueryInput('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="h-8 w-8 text-amber-400" />
            <h1 className="text-2xl font-bold text-white">News Sentiment</h1>
          </div>
          <p className="text-slate-400 text-sm">
            AI-powered sentiment analysis of news articles by ticker, topic, or keyword.
          </p>
        </div>

        {/* Query controls */}
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={queryInput}
              onChange={e => setQueryInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitQuery(queryInput); }}
              placeholder="Ticker or keyword…"
              className="w-40 rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            <button
              onClick={() => submitQuery(queryInput)}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Search
            </button>
            {QUICK_QUERIES.map(q => (
              <button
                key={q}
                onClick={() => { setQuery(q); setQueryInput(''); }}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                  query === q ? 'bg-indigo-600 text-white' : 'border border-slate-700 text-slate-400 hover:text-white',
                )}
              >
                {q}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Timespan */}
            <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
              {TIMESPANS.map(t => (
                <button
                  key={t}
                  onClick={() => setTimespan(t)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                    timespan === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Topic filter */}
            <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
              {TOPICS.map(t => (
                <button
                  key={t || 'all'}
                  onClick={() => setTopic(t)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors',
                    topic === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white',
                  )}
                >
                  {t || 'All Topics'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sentiment overview */}
        {sentimentQuery.isLoading && (
          <div className="mb-6 flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-10 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Analyzing sentiment for "{query}"…</span>
          </div>
        )}

        {sentimentQuery.isError && !sentimentQuery.isLoading && (
          <div className="mb-6 rounded-xl border border-red-700/50 bg-red-900/10 px-4 py-3 text-sm text-red-400">
            Failed to load sentiment data. Please try again.
          </div>
        )}

        {sentiment && !sentimentQuery.isLoading && (
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            {/* Gauge */}
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                <Activity className="h-5 w-5 text-amber-400" />
                Sentiment Score
              </h2>
              <SentimentGauge score={sentiment.sentiment_score} />
              <div className="mt-4 flex justify-center gap-2 text-sm">
                {trendIcon(sentiment.trend)}
                <span className={cn('font-medium capitalize', trendColor(sentiment.trend))}>
                  {sentiment.trend}
                </span>
                <span className="text-slate-500">trend</span>
              </div>
              <div className="mt-2 text-center text-xs text-slate-500">
                Based on {sentiment.articles_analyzed.toLocaleString()} articles
              </div>
            </div>

            {/* Breakdown */}
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">Sentiment Breakdown</h2>
              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-400">Positive</span>
                    <span className="font-semibold text-emerald-400">{sentiment.positive_percentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-700">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${sentiment.positive_percentage}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-400">Negative</span>
                    <span className="font-semibold text-red-400">{sentiment.negative_percentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-700">
                    <div className="h-full rounded-full bg-red-500" style={{ width: `${sentiment.negative_percentage}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-400">Neutral</span>
                    <span className="font-semibold text-slate-300">
                      {Math.max(0, 100 - sentiment.positive_percentage - sentiment.negative_percentage).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-700">
                    <div
                      className="h-full rounded-full bg-slate-500"
                      style={{ width: `${Math.max(0, 100 - sentiment.positive_percentage - sentiment.negative_percentage)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-emerald-400">{sentiment.positive_percentage.toFixed(0)}%</div>
                  <div className="text-xs text-slate-500">Positive</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-300">{sentiment.articles_analyzed.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">Articles</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-400">{sentiment.negative_percentage.toFixed(0)}%</div>
                  <div className="text-xs text-slate-500">Negative</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* News articles */}
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <MessageCircle className="h-5 w-5 text-blue-400" />
            Recent Articles
            {topic && <span className="text-sm font-normal text-slate-400">— {topic}</span>}
          </h2>

          {newsQuery.isLoading && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-10 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading articles…</span>
            </div>
          )}

          {newsQuery.isError && !newsQuery.isLoading && (
            <div className="rounded-xl border border-red-700/50 bg-red-900/10 px-4 py-3 text-sm text-red-400">
              Failed to load articles. Please try again.
            </div>
          )}

          {!newsQuery.isLoading && articles.length > 0 && (
            <div className="space-y-3">
              {articles.map((article, idx) => {
                const score = article.sentiment_score;
                return (
                  <div key={idx} className="rounded-xl border border-slate-700 bg-slate-800 p-4 hover:border-slate-600 transition-colors">
                    <div className="flex items-start gap-3">
                      {/* Sentiment indicator */}
                      <div className="mt-1 shrink-0">
                        <div className={cn('h-2.5 w-2.5 rounded-full', sentimentBg(score))} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-medium text-white leading-snug">
                            {article.url ? (
                              <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-300 transition-colors">
                                {article.title}
                              </a>
                            ) : article.title}
                          </h3>
                          <span className={cn('shrink-0 text-xs font-semibold', sentimentColor(score))}>
                            {score > 0 ? '+' : ''}{score.toFixed(2)}
                          </span>
                        </div>
                        {article.summary && (
                          <p className="mt-1 text-xs text-slate-400 line-clamp-2">{article.summary}</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                          <span>{article.source}</span>
                          {article.date && <span>{article.date}</span>}
                          {article.topic && (
                            <span className="rounded bg-slate-700 px-1.5 py-0.5 text-slate-400 capitalize">{article.topic}</span>
                          )}
                          {article.url && (
                            <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 hover:text-slate-300 transition-colors">
                              <ExternalLink className="h-3 w-3" /> Read more
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!newsQuery.isLoading && !newsQuery.isError && articles.length === 0 && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 py-10 text-center text-sm text-slate-500">
              No articles found for "{query}".
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
