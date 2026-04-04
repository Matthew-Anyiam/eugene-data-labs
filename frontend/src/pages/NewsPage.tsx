import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Newspaper, ExternalLink, Clock, Search,
} from 'lucide-react';
import { useNews, type NewsArticle } from '../hooks/useNews';
import { useWatchlist } from '../hooks/useWatchlist';
import { cn } from '../lib/utils';

const FEED_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM'];

const CATEGORIES = ['All', 'Watchlist', 'Tech', 'Finance', 'Healthcare', 'Energy'];

export function NewsPage() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const { tickers: watchlistTickers } = useWatchlist();

  // Determine which tickers to fetch news for
  const feedTickers = activeCategory === 'Watchlist'
    ? watchlistTickers.slice(0, 8)
    : FEED_TICKERS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Newspaper className="h-7 w-7 text-sky-500" />
          News Feed
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Latest financial news across your tracked companies
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Category tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors',
                activeCategory === cat
                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              )}
            >
              {cat}
              {cat === 'Watchlist' && (
                <span className="ml-1 text-[10px] text-slate-400">({watchlistTickers.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter news..."
            className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-slate-400 focus:border-sky-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
      </div>

      {/* News feed — one section per ticker */}
      <div className="space-y-4">
        {feedTickers.map((ticker) => (
          <TickerNewsFeed key={ticker} ticker={ticker} searchQuery={searchQuery} />
        ))}
      </div>

      {feedTickers.length === 0 && (
        <div className="rounded-lg border border-slate-200 p-12 text-center dark:border-slate-700">
          <Newspaper className="mx-auto h-12 w-12 text-slate-200 dark:text-slate-700" />
          <h3 className="mt-3 font-medium text-slate-600 dark:text-slate-400">
            {activeCategory === 'Watchlist' ? 'Add tickers to your watchlist to see news' : 'No news available'}
          </h3>
        </div>
      )}
    </div>
  );
}

function TickerNewsFeed({ ticker, searchQuery }: { ticker: string; searchQuery: string }) {
  const { data, isLoading, isError } = useNews(ticker);

  const articles = useMemo(() => {
    if (!data?.articles) return [];
    let filtered = data.articles;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.source.toLowerCase().includes(q) ||
          (a.snippet && a.snippet.toLowerCase().includes(q))
      );
    }
    return filtered.slice(0, 5);
  }, [data, searchQuery]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-5 w-12 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !articles.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700">
      {/* Ticker header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Link
            to={`/company/${ticker}`}
            className="font-mono text-sm font-bold text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
          >
            {ticker}
          </Link>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {articles.length} article{articles.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Articles */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
        {articles.map((article, i) => (
          <ArticleRow key={`${ticker}-${i}`} article={article} />
        ))}
      </div>
    </div>
  );
}

function ArticleRow({ article }: { article: NewsArticle }) {
  return (
    <div className="flex gap-3 px-4 py-3 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
      {/* Image thumbnail */}
      {article.image && (
        <div className="hidden shrink-0 sm:block">
          <img
            src={article.image}
            alt=""
            className="h-16 w-24 rounded-md object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}

      <div className="min-w-0 flex-1">
        {/* Title */}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start gap-1"
        >
          <h4 className="text-sm font-medium leading-snug text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
            {article.title}
          </h4>
          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-slate-300 group-hover:text-blue-400" />
        </a>

        {/* Snippet */}
        {article.snippet && (
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
            {article.snippet}
          </p>
        )}

        {/* Meta */}
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-400">
          <span className="font-medium text-slate-500 dark:text-slate-400">{article.source}</span>
          {article.date && (
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {formatDate(article.date)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
      const mins = Math.floor(diffMs / (1000 * 60));
      return `${mins}m ago`;
    }
    if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`;
    }
    if (diffHours < 168) {
      return `${Math.floor(diffHours / 24)}d ago`;
    }
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}
