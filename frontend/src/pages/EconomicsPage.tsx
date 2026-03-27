import { useState } from 'react';
import { CategorySelector } from '../components/economics/CategorySelector';
import { IndicatorCard } from '../components/economics/IndicatorCard';
import { EconomicsLineChart } from '../components/charts/EconomicsLineChart';
import { useEconomics } from '../hooks/useEconomics';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import type { FredSeries, FredCategory } from '../lib/types';

export function EconomicsPage() {
  const [category, setCategory] = useState('inflation');
  const [expandedSeries, setExpandedSeries] = useState<FredSeries | null>(null);
  const { data, isLoading, error } = useEconomics(category);

  const series: FredSeries[] = Array.isArray(data)
    ? data
    : (data as FredCategory | undefined)?.series ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Economic Indicators</h1>

      <CategorySelector active={category} onChange={(c) => { setCategory(c); setExpandedSeries(null); }} />

      <div className="mt-6">
        {isLoading && <LoadingSpinner />}
        {error && <p className="text-sm text-red-500">Failed to load data: {(error as Error).message}</p>}

        {expandedSeries && (
          <div className="mb-6 rounded-lg border border-slate-200 p-5 dark:border-slate-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{expandedSeries.title}</h3>
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

        {series.length > 0 && (
          <div className="grid gap-0 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
            {series.map((s) => (
              <IndicatorCard key={s.id} series={s} onClick={() => setExpandedSeries(s)} />
            ))}
          </div>
        )}

        {!isLoading && series.length === 0 && !error && (
          <p className="mt-8 text-sm text-slate-400">No data available for this category</p>
        )}
      </div>
    </div>
  );
}
