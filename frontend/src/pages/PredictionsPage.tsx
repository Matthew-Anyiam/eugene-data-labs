import { useState } from 'react';
import { Activity, ExternalLink } from 'lucide-react';
import { usePredictions } from '../hooks/usePredictions';
import type { Prediction } from '../hooks/usePredictions';
import { cn } from '../lib/utils';

const TOPICS = ['All', 'Fed Rates', 'S&P 500', 'Inflation', 'GDP', 'Recession', 'Bitcoin', 'Oil'] as const;

function formatVolume(v?: number) {
  if (!v) return null;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function ProbabilityBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={cn('h-full rounded-full', color)}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs font-medium tabular-nums">{pct.toFixed(0)}%</span>
    </div>
  );
}

function PredictionCard({ prediction }: { prediction: Prediction }) {
  const isPolymarket = prediction.source.toLowerCase().includes('polymarket');
  const volume = prediction.volume_24h ?? prediction.volume_total;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="mb-3 text-sm font-semibold leading-snug text-slate-900 dark:text-white">
        {prediction.question}
      </p>

      <div className="mb-3 space-y-2">
        {isPolymarket && prediction.outcomes && prediction.outcomes.length > 0 ? (
          prediction.outcomes.map((o) => (
            <div key={o.outcome}>
              <p className="mb-0.5 text-xs text-slate-500 dark:text-slate-400">{o.outcome}</p>
              {o.probability_pct != null && (
                <ProbabilityBar
                  pct={o.probability_pct}
                  color={
                    o.outcome.toLowerCase() === 'yes'
                      ? 'bg-emerald-500'
                      : o.outcome.toLowerCase() === 'no'
                        ? 'bg-red-500'
                        : 'bg-blue-500'
                  }
                />
              )}
            </div>
          ))
        ) : prediction.yes_probability_pct != null ? (
          <>
            <div>
              <p className="mb-0.5 text-xs text-slate-500 dark:text-slate-400">Yes</p>
              <ProbabilityBar pct={prediction.yes_probability_pct} color="bg-emerald-500" />
            </div>
            {prediction.no_probability_pct != null && (
              <div>
                <p className="mb-0.5 text-xs text-slate-500 dark:text-slate-400">No</p>
                <ProbabilityBar pct={prediction.no_probability_pct} color="bg-red-500" />
              </div>
            )}
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 font-medium',
            isPolymarket
              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
              : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
          )}
        >
          {prediction.source}
        </span>
        {volume != null && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Vol {formatVolume(volume)}
          </span>
        )}
        {prediction.expiration && (
          <span className="text-slate-400 dark:text-slate-500">
            Exp {prediction.expiration}
          </span>
        )}
        {prediction.url && (
          <a
            href={prediction.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            View <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mb-2 h-2 w-full rounded bg-slate-100 dark:bg-slate-800" />
      <div className="mb-3 h-2 w-2/3 rounded bg-slate-100 dark:bg-slate-800" />
      <div className="flex gap-2">
        <div className="h-5 w-16 rounded-full bg-slate-100 dark:bg-slate-800" />
        <div className="h-5 w-14 rounded-full bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  );
}

export function PredictionsPage() {
  const [topic, setTopic] = useState<string | undefined>();
  const { data, isLoading, error } = usePredictions(topic);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-violet-600 dark:text-violet-400" />
          <h1 className="text-2xl font-bold tracking-tight">Prediction Markets</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Live odds from Polymarket &amp; Kalshi
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {TOPICS.map((t) => {
          const active = t === 'All' ? !topic : topic === t;
          return (
            <button
              key={t}
              onClick={() => setTopic(t === 'All' ? undefined : t)}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-violet-600 text-white dark:bg-violet-500'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
              )}
            >
              {t}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="text-sm text-red-500">Failed to load predictions: {(error as Error).message}</p>
      )}

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!isLoading && data?.predictions && data.predictions.length > 0 && (
        <>
          {data.sources && (
            <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
              {data.count} markets &middot; Polymarket: {data.sources.polymarket} &middot; Kalshi: {data.sources.kalshi}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.predictions.map((p, i) => (
              <PredictionCard key={`${p.source}-${i}`} prediction={p} />
            ))}
          </div>
        </>
      )}

      {!isLoading && data?.predictions && data.predictions.length === 0 && (
        <div className="py-16 text-center">
          <Activity className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No prediction markets found{topic ? ` for "${topic}"` : ''}
          </p>
        </div>
      )}
    </div>
  );
}
