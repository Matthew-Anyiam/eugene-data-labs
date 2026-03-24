import type { MetricsData } from '../../lib/types';
import { metricLabel } from '../../lib/utils';

interface MetricsGridProps {
  metrics: MetricsData;
}

const CATEGORY_ORDER = ['profitability', 'liquidity', 'leverage', 'efficiency', 'valuation', 'growth', 'per_share'];

function formatMetricValue(key: string, value: number): string {
  if (key.includes('ratio') || key.includes('turnover')) return value.toFixed(2);
  if (key.includes('margin') || key.includes('return') || key.includes('growth') || key.includes('yield')) return `${value.toFixed(1)}%`;
  if (key.includes('eps') || key.includes('per_share') || key.includes('book_value') || key.includes('dividend')) return `$${value.toFixed(2)}`;
  if (key === 'pe_ratio' || key === 'price_to_book' || key === 'ev_to_ebitda' || key === 'price_to_sales') return `${value.toFixed(1)}x`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  const period = metrics.periods?.[0];
  if (!period?.metrics) return null;

  return (
    <div className="space-y-8">
      {CATEGORY_ORDER.map((category) => {
        const data = period.metrics[category as keyof typeof period.metrics];
        if (!data || Object.keys(data).length === 0) return null;

        return (
          <div key={category}>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
              {metricLabel(category)}
            </h3>
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 dark:border-slate-800 dark:bg-slate-800 sm:grid-cols-4 lg:grid-cols-5">
              {Object.entries(data).map(([key, value]) => (
                <div key={key} className="bg-white px-4 py-3 dark:bg-slate-900">
                  <p className="text-xs text-slate-400 dark:text-slate-500">{metricLabel(key)}</p>
                  <p className="mt-0.5 font-semibold tabular-nums">{formatMetricValue(key, value as number)}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
