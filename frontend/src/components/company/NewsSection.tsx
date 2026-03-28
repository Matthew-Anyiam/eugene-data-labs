import type { NewsArticle } from '../../hooks/useNews';
import { ExternalLink } from 'lucide-react';

interface NewsSectionProps {
  articles: NewsArticle[];
}

export function NewsSection({ articles }: NewsSectionProps) {
  if (articles.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No recent news found.</p>;
  }

  return (
    <div className="space-y-3">
      {articles.map((a, i) => (
        <a
          key={`${a.url}-${i}`}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg border border-slate-200 p-4 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-900/50"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug">{a.title}</p>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                <span>{a.source}</span>
                <span>&middot;</span>
                <span>{a.date}</span>
              </div>
              {a.snippet && (
                <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {a.snippet}
                </p>
              )}
            </div>
            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          </div>
        </a>
      ))}
    </div>
  );
}
