import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Globe, Loader2, ExternalLink,
} from 'lucide-react';
import { eugeneApi } from '../../lib/api';
import { cn } from '../../lib/utils';

interface FeedItem {
  type: 'disaster' | 'conflict' | 'sanction' | 'news';
  title: string;
  severity?: string;
  country?: string;
  time?: string;
  link?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  moderate: 'bg-amber-500',
  low: 'bg-green-500',
};

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  disaster: { label: 'DISASTER', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  conflict: { label: 'CONFLICT', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  sanction: { label: 'SANCTION', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  news: { label: 'NEWS', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
};

export function WorldFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchFeed = async () => {
      const feed: FeedItem[] = [];

      try {
        // Fetch disasters
        const disasters = await eugeneApi<any>('/v1/world/disasters?limit=5');
        if (disasters?.disasters) {
          for (const d of disasters.disasters.slice(0, 3)) {
            feed.push({
              type: 'disaster',
              title: d.name || d.title || 'Unknown event',
              severity: d.severity_tier || (d.magnitude >= 6 ? 'high' : 'moderate'),
              country: d.country || d.place,
              time: d.time,
              link: d.url,
            });
          }
        }
      } catch { /* ignore */ }

      try {
        // Fetch conflicts
        const conflicts = await eugeneApi<any>('/v1/world/conflicts?limit=3');
        if (conflicts?.events) {
          for (const c of conflicts.events.slice(0, 2)) {
            feed.push({
              type: 'conflict',
              title: c.where_description || c.side_a || 'Unknown conflict',
              country: c.country,
              time: c.date_start,
            });
          }
        }
      } catch { /* ignore */ }

      try {
        // Fetch news
        const news = await eugeneApi<any>('/v1/world/news?limit=3');
        if (news?.articles) {
          for (const n of news.articles.slice(0, 2)) {
            feed.push({
              type: 'news',
              title: n.title || 'News article',
              country: n.source_country,
              time: n.date,
              link: n.url,
            });
          }
        }
      } catch { /* ignore */ }

      if (!cancelled) {
        // Sort by recency (approximate — time formats vary)
        setItems(feed.slice(0, 8));
        setLoading(false);
      }
    };

    fetchFeed();
    const interval = setInterval(fetchFeed, 15 * 60 * 1000); // Refresh every 15 min
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
          <Globe className="h-4 w-4 text-blue-500" />
          World Feed
        </h3>
        <Link to="/world" className="text-[11px] font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-400">
          View all &rarr;
        </Link>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-400">
            No world events loaded
          </div>
        ) : (
          items.map((item, i) => {
            const badge = TYPE_BADGES[item.type] || TYPE_BADGES.news;
            return (
              <div key={i} className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                {/* Severity dot */}
                <div className="mt-1.5 flex shrink-0 flex-col items-center">
                  <div
                    className={cn(
                      'h-2 w-2 rounded-full',
                      item.severity ? SEVERITY_COLORS[item.severity] || 'bg-slate-400' : 'bg-slate-300'
                    )}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold', badge.color)}>
                      {badge.label}
                    </span>
                    {item.country && (
                      <span className="text-[10px] text-slate-400">{item.country}</span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-700 dark:text-slate-300">
                    {item.title}
                  </p>
                </div>

                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 shrink-0 text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
