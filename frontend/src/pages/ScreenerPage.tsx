import { useState, useCallback } from 'react';
import { Filter } from 'lucide-react';
import { ScreenerFilters } from '../components/screener/ScreenerFilters';
import { ScreenerResults, ScreenerResultsSkeleton } from '../components/screener/ScreenerResults';
import { SectorHeatmap } from '../components/screener/SectorHeatmap';
import { useScreener, type ScreenerFilters as Filters } from '../hooks/useScreener';

const DEFAULT_FILTERS: Filters = { limit: 50 };

export function ScreenerPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<Filters>(DEFAULT_FILTERS);
  const { data, isLoading, error } = useScreener(applied);

  const note = data?.note;
  const results = data?.results ?? [];

  const handleSubmit = useCallback(() => {
    setApplied({ ...filters });
  }, [filters]);

  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setApplied(DEFAULT_FILTERS);
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-slate-400" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Stock Screener
          </h1>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Filter stocks by sector, market cap, price, volume, and beta
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Filters sidebar */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <ScreenerFilters
            filters={filters}
            onChange={setFilters}
            onSubmit={handleSubmit}
            onReset={handleReset}
          />
        </div>

        {/* Results area */}
        <div>
          {isLoading && <ScreenerResultsSkeleton />}

          {!isLoading && error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/50 dark:bg-red-950/30">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">
                {(error as Error).message}
              </p>
            </div>
          )}

          {!isLoading && !error && data && note ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-8 text-center dark:border-amber-900/50 dark:bg-amber-950/30">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {note}
              </p>
              <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                You can still look up any company by searching for its ticker above.
              </p>
            </div>
          ) : (
            !isLoading && !error && data && (
              <div className="space-y-6">
                {results.length > 5 && <SectorHeatmap results={results} />}
                <ScreenerResults results={results} />
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
