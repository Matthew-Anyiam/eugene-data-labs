import { useState } from 'react';
import { MessageCircle, TrendingUp, TrendingDown, Search, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNewsSentiment, useWorldNews } from '../../hooks/useNewsSentiment';

interface SentimentResult {
  sentiment_score: number;
  positive_percentage: number;
  negative_percentage: number;
  articles_analyzed: number;
  trend: string;
}

interface NewsArticle {
  title: string;
  summary: string;
  date: string;
  source: string;
  url: string;
  sentiment_score: number;
}

const TIMESPANS = ['24h', '7d', '30d'] as const;
type Timespan = (typeof TIMESPANS)[number];

const SUGGESTED_QUERIES = [
  'AAPL',
  'NVDA',
  'Tesla',
  'Federal Reserve',
  'inflation',
  'recession',
  'AI',
  'crypto',
];

// Radial/arc gauge rendered as SVG
function SentimentGauge({ score }: { score: number }) {
  // score is -1 to 1, map to 0–180 degrees
  const clamped = Math.max(-1, Math.min(1, score));
  const deg = ((clamped + 1) / 2) * 180; // 0 = leftmost (bearish), 180 = rightmost (bullish)
  const radius = 60;
  const cx = 80;
  const cy = 80;

  // Arc from 180° to 0° (top half of circle)
  function polarToCart(angleDeg: number) {
    const rad = ((angleDeg - 180) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  const start = polarToCart(0); // left
  const bearishEnd = polarToCart(60);
  const neutralEnd = polarToCart(120);
  const end = polarToCart(180); // right

  const needle = polarToCart(deg);

  function arcPath(from: number, to: number) {
    const s = polarToCart(from);
    const e = polarToCart(to);
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 0 1 ${e.x} ${e.y}`;
  }

  const label =
    clamped > 0.2 ? 'Bullish' : clamped < -0.2 ? 'Bearish' : 'Neutral';
  const labelColor =
    clamped > 0.2 ? '#34d399' : clamped < -0.2 ? '#f87171' : '#94a3b8';

  return (
    <svg width="160" height="95" className="mx-auto">
      {/* Background arcs */}
      <path d={arcPath(0, 60)} fill="none" stroke="#7f1d1d" strokeWidth="12" strokeLinecap="round" opacity="0.5" />
      <path d={arcPath(60, 120)} fill="none" stroke="#475569" strokeWidth="12" strokeLinecap="round" opacity="0.5" />
      <path d={arcPath(120, 180)} fill="none" stroke="#14532d" strokeWidth="12" strokeLinecap="round" opacity="0.5" />
      {/* Needle */}
      <line
        x1={cx}
        y1={cy}
        x2={needle.x}
        y2={needle.y}
        stroke={labelColor}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="4" fill={labelColor} />
      {/* Score */}
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize="13" fontWeight="bold" fill={labelColor}>
        {clamped >= 0 ? '+' : ''}{clamped.toFixed(2)}
      </text>
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize="9" fill="#64748b">
        {label}
      </text>
    </svg>
  );
}

function ArticleCard({ article }: { article: NewsArticle }) {
  const score = article.sentiment_score ?? 0;
  const isPos = score > 0.1;
  const isNeg = score < -0.1;
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="flex-1 text-xs font-medium leading-snug text-white">{article.title}</p>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase',
            isPos
              ? 'bg-emerald-900/40 text-emerald-400'
              : isNeg
                ? 'bg-red-900/40 text-red-400'
                : 'bg-slate-700 text-slate-400',
          )}
        >
          {isPos ? 'Positive' : isNeg ? 'Negative' : 'Neutral'}
        </span>
      </div>
      {article.summary && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400 line-clamp-2">
          {article.summary}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span>{article.source}</span>
          <span>·</span>
          <span>{article.date?.slice(0, 10)}</span>
        </div>
        {article.url && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 text-[10px] text-indigo-400 hover:text-indigo-300"
          >
            Read <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 rounded-full bg-slate-700">
          {isPos && (
            <div
              className="h-1 rounded-full bg-emerald-500/60"
              style={{ width: `${Math.min(100, score * 100)}%` }}
            />
          )}
          {isNeg && (
            <div
              className="ml-auto h-1 rounded-full bg-red-500/60"
              style={{ width: `${Math.min(100, Math.abs(score) * 100)}%` }}
            />
          )}
        </div>
        <span
          className={cn(
            'text-[10px] font-medium',
            isPos ? 'text-emerald-400' : isNeg ? 'text-red-400' : 'text-slate-500',
          )}
        >
          {score >= 0 ? '+' : ''}
          {score.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export function SocialSentimentPage() {
  const [query, setQuery] = useState('markets');
  const [inputValue, setInputValue] = useState('');
  const [timespan, setTimespan] = useState<Timespan>('24h');

  const {
    data: sentimentData,
    isLoading: sentLoading,
    isError: sentError,
  } = useNewsSentiment(query, timespan) as {
    data: SentimentResult | undefined;
    isLoading: boolean;
    isError: boolean;
  };

  const {
    data: newsData,
    isLoading: newsLoading,
    isError: newsError,
  } = useWorldNews(query, undefined, timespan, 20) as {
    data: { articles: NewsArticle[] } | undefined;
    isLoading: boolean;
    isError: boolean;
  };

  const articles: NewsArticle[] = newsData?.articles ?? [];

  const submitQuery = (q: string) => {
    if (!q.trim()) return;
    setQuery(q.trim());
    setInputValue('');
  };

  const isLoading = sentLoading || newsLoading;
  const isError = sentError || newsError;

  const trend = sentimentData?.trend ?? '';
  const trendUp = trend.toLowerCase().includes('up') || trend.toLowerCase().includes('improv');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageCircle className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Social &amp; News Sentiment</h1>
          <p className="text-sm text-slate-400">
            Real-time sentiment analysis across news articles and media
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitQuery(inputValue);
            }}
            placeholder="Ticker or topic…"
            className="w-44 rounded-lg border border-slate-600 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <button
          onClick={() => submitQuery(inputValue)}
          disabled={!inputValue.trim()}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          Search
        </button>
        {/* Timespan */}
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-0.5">
          {TIMESPANS.map((t) => (
            <button
              key={t}
              onClick={() => setTimespan(t)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium',
                timespan === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Suggested queries */}
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTED_QUERIES.map((q) => (
          <button
            key={q}
            onClick={() => submitQuery(q)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
              query === q
                ? 'border-indigo-600 bg-indigo-600/20 text-indigo-300'
                : 'border-slate-700 text-slate-400 hover:text-white',
            )}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Active query label */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span>Showing results for:</span>
        <span className="rounded-md bg-slate-700 px-2 py-0.5 text-xs font-semibold text-white">
          {query}
        </span>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          <span className="ml-3 text-slate-400">Fetching sentiment data…</span>
        </div>
      )}

      {isError && !isLoading && (
        <div className="flex items-center justify-center py-16">
          <span className="text-red-400">Failed to load sentiment data. Please try again.</span>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Gauge + sentiment stats */}
          {sentimentData && (
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Gauge */}
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <h3 className="mb-2 text-sm font-semibold text-white">Sentiment Gauge</h3>
                <SentimentGauge score={sentimentData.sentiment_score} />
                {trend && (
                  <div
                    className={cn(
                      'mt-1 flex items-center justify-center gap-1 text-xs font-medium',
                      trendUp ? 'text-emerald-400' : 'text-red-400',
                    )}
                  >
                    {trendUp ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    Trend: {trend}
                  </div>
                )}
              </div>

              {/* Stat breakdown */}
              <div className="grid grid-cols-2 gap-3 content-start">
                {[
                  {
                    label: 'Sentiment Score',
                    value:
                      sentimentData.sentiment_score >= 0
                        ? `+${sentimentData.sentiment_score.toFixed(2)}`
                        : sentimentData.sentiment_score.toFixed(2),
                    color:
                      sentimentData.sentiment_score >= 0 ? 'text-emerald-400' : 'text-red-400',
                  },
                  {
                    label: 'Articles Analysed',
                    value: sentimentData.articles_analyzed.toLocaleString(),
                    color: 'text-white',
                  },
                  {
                    label: 'Positive',
                    value: `${sentimentData.positive_percentage.toFixed(1)}%`,
                    color: 'text-emerald-400',
                  },
                  {
                    label: 'Negative',
                    value: `${sentimentData.negative_percentage.toFixed(1)}%`,
                    color: 'text-red-400',
                  },
                ].map((c) => (
                  <div
                    key={c.label}
                    className="rounded-xl border border-slate-700 bg-slate-800/50 p-3"
                  >
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">
                      {c.label}
                    </div>
                    <div className={cn('mt-1 text-xl font-bold', c.color)}>{c.value}</div>
                  </div>
                ))}

                {/* Pos / Neg bar */}
                <div className="col-span-2 rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
                    Positive vs Negative
                  </div>
                  <div className="flex h-4 overflow-hidden rounded-full bg-slate-700">
                    <div
                      className="bg-emerald-500/70"
                      style={{ width: `${sentimentData.positive_percentage}%` }}
                    />
                    <div
                      className="bg-red-500/70"
                      style={{ width: `${sentimentData.negative_percentage}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                    <span className="text-emerald-400/70">
                      {sentimentData.positive_percentage.toFixed(1)}% positive
                    </span>
                    <span className="text-red-400/70">
                      {sentimentData.negative_percentage.toFixed(1)}% negative
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Article feed */}
          {articles.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-white">
                Article Feed
                <span className="ml-2 text-xs font-normal text-slate-500">
                  ({articles.length} articles)
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {articles.map((article, i) => (
                  <ArticleCard key={`${article.url ?? article.title}-${i}`} article={article} />
                ))}
              </div>
            </div>
          )}

          {articles.length === 0 && sentimentData && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-8 text-center">
              <p className="text-sm text-slate-400">
                No articles found for &ldquo;{query}&rdquo; in the last {timespan}.
              </p>
            </div>
          )}

          {!sentimentData && !newsData && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-8 text-center">
              <p className="text-sm text-slate-400">
                No sentiment data available. Try a different query or timespan.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
