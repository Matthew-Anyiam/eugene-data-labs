import { useState } from 'react';
import { ScreenerFilters } from '../components/screener/ScreenerFilters';
import { ScreenerResults } from '../components/screener/ScreenerResults';
import { useScreener, type ScreenerFilters as Filters } from '../hooks/useScreener';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export function ScreenerPage() {
  const [filters, setFilters] = useState<Filters>({ limit: 50 });
  const [submitted, setSubmitted] = useState(false);
  const { data, isLoading, error } = useScreener(filters, submitted);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Stock Screener</h1>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <ScreenerFilters
          filters={filters}
          onChange={setFilters}
          onSubmit={() => setSubmitted(true)}
        />

        <div>
          {!submitted && (
            <p className="py-16 text-center text-sm text-slate-400">
              Set filters and click "Screen Stocks"
            </p>
          )}
          {isLoading && <LoadingSpinner />}
          {error && <p className="text-sm text-red-500">{(error as Error).message}</p>}
          {data && Array.isArray(data) && <ScreenerResults results={data} />}
        </div>
      </div>
    </div>
  );
}
