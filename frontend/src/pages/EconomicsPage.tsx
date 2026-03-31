import { useState } from 'react';
import { Globe } from 'lucide-react';
import { CategorySelector } from '../components/economics/CategorySelector';
import { IndicatorCard } from '../components/economics/IndicatorCard';
import { EconomicsLineChart } from '../components/charts/EconomicsLineChart';
import { useEconomics } from '../hooks/useEconomics';
import { cn } from '../lib/utils';
import type { FredSeries, FredCategory } from '../lib/types';

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mt-3 h-6 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mt-2 h-3 w-1/3 rounded bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-900/50 dark:bg-red-950/20">
      <p className="text-sm font-medium text-red-700 dark:text-red-400">
        Failed to load economic data
      </p>
      <p className="mt-1 text-xs text-red-500 dark:text-red-500/70">
        {message}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-slate-200 px-6 py-16 text-center dark:border-slate-800">
      <p className="text-sm text-slate-400">No data available for this category</p>
    </div>
  );
}

export function EconomicsPage() {
  const [category, setCategory] = useState('all');
  const [expandedSeries, setExpandedSeries] = useState<FredSeries | null>(null);
  const { data, isLoading, error } = useEconomics(category);

  const series: FredSeries[] = Array.isArray(data)
    ? data
    : (data as FredCategory | undefined)?.series ?? [];

  // In "all" mode, the frequency field stores the category name (set in useEconomics)
  const isAllView = category === 'all';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5">
          <Globe className="h-6 w-6 text-slate-400" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Economic Indicators
          </h1>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          FRED macroeconomic data — inflation, employment, GDP, rates
        </p>
      </div>

      {/* Category tabs */}
      <CategorySelector
        active={category}
        onChange={(c) => {
          setCategory(c);
          setExpandedSeries(null);
        }}
      />

      <div className="mt-6">
        {/* Loading */}
        {isLoading && <LoadingSkeleton />}

        {/* Error */}
        {error && <ErrorState message={(error as Error).message} />}

        {/* Expanded chart */}
        {expandedSeries && (
          <div className="mb-6 rounded-lg border border-slate-200 p-5 dark:border-slate-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {expandedSeries.title}
              </h3>
              <button
                onClick={() => setExpandedSeries(null)}
                className="text-xs text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Close
              </button>
            </div>
            <EconomicsLineChart series={expandedSeries} />
          </div>
        )}

        {/* Card grid */}
        {!isLoading && series.length > 0 && (
          <div className={cn(
            'grid gap-3',
            'sm:grid-cols-2 lg:grid-cols-3'
          )}>
            {series.map((s) => (
              <IndicatorCard
                key={s.id}
                series={s}
                categoryLabel={isAllView ? s.frequency : undefined}
                onClick={() => setExpandedSeries(s)}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && series.length === 0 && !error && <EmptyState />}
      </div>
    </div>
  );
}
