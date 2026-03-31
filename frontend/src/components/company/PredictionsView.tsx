import { Link } from 'react-router-dom';
import { Activity, ExternalLink } from 'lucide-react';
import type { Prediction, PredictionsResponse } from '../../hooks/usePredictions';
import { cn } from '../../lib/utils';

function formatVolume(v?: number) {
  if (!v) return null;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function ProbabilityBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={cn('h-full rounded-full', color)}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <span className="w-9 text-right text-xs tabular-nums">{pct.toFixed(0)}%</span>
    </div>
  );
}

function CompactPredictionCard({ prediction }: { prediction: Prediction }) {
  const isPolymarket = prediction.source.toLowerCase().includes('polymarket');
  const volume = prediction.volume_24h ?? prediction.volume_total;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="mb-2 text-sm font-medium leading-snug text-slate-900 dark:text-white">
        {prediction.question}
      </p>

      <div className="mb-2 space-y-1.5">
        {isPolymarket && prediction.outcomes && prediction.outcomes.length > 0 ? (
          prediction.outcomes.slice(0, 3).map((o) => (
            <div key={o.outcome}>
              <p className="mb-0.5 text-[11px] text-slate-500 dark:text-slate-400">{o.outcome}</p>
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
          <div>
            <p className="mb-0.5 text-[11px] text-slate-500 dark:text-slate-400">Yes</p>
            <ProbabilityBar pct={prediction.yes_probability_pct} color="bg-emerald-500" />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 font-medium',
            isPolymarket
              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
              : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
          )}
        >
          {prediction.source}
        </span>
        {volume != null && (
          <span className="text-slate-400 dark:text-slate-500">
            Vol {formatVolume(volume)}
          </span>
        )}
        {prediction.url && (
          <a
            href={prediction.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

interface PredictionsViewProps {
  data?: PredictionsResponse;
  isLoading: boolean;
  error: Error | null;
  ticker: string;
}

export function PredictionsView({ data, isLoading, error, ticker }: PredictionsViewProps) {
  if (error) {
    return <p className="text-sm text-red-500">Failed to load predictions</p>;
  }

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-2 h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mb-1.5 h-1.5 w-full rounded bg-slate-100 dark:bg-slate-800" />
            <div className="flex gap-2">
              <div className="h-4 w-14 rounded-full bg-slate-100 dark:bg-slate-800" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data?.predictions || data.predictions.length === 0) {
    return (
      <div className="py-12 text-center">
        <Activity className="mx-auto mb-2 h-6 w-6 text-slate-300 dark:text-slate-600" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No predictions found for {ticker.toUpperCase()}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.predictions.map((p, i) => (
          <CompactPredictionCard key={`${p.source}-${i}`} prediction={p} />
        ))}
      </div>
      <div className="mt-4">
        <Link
          to="/predictions"
          className="text-sm text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
        >
          View all prediction markets &rarr;
        </Link>
      </div>
    </div>
  );
}
