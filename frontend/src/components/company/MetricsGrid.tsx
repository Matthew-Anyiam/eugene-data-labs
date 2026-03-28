import type { MetricsData } from '../../lib/types';
import { metricLabel } from '../../lib/utils';

interface MetricsGridProps {
  metrics: MetricsData;
}

const CATEGORY_ORDER = ['profitability', 'liquidity', 'leverage', 'efficiency', 'valuation', 'growth', 'per_share'];

function formatMetricValue(key: string, value: number | null): string {
  if (value === null || value === undefined) return '—';
  // Backend returns margins/returns as decimals (0.4691 = 46.91%)
  const isPercent = key.includes('margin') || key.includes('growth') || key.includes('yield')
    || key === 'roe' || key === 'roa' || key === 'roic';
  if (isPercent) return `${(value * 100).toFixed(1)}%`;
  if (key.includes('ratio') || key.includes('turnover') || key.includes('multiplier')) return value.toFixed(2);
  if (key.includes('eps') || key.includes('per_share') || key.includes('book_value') || key.includes('dividend')) return `$${value.toFixed(2)}`;
  if (key === 'pe_ratio' || key === 'price_to_book' || key === 'ev_to_ebitda' || key === 'price_to_sales') return `${value.toFixed(1)}x`;
  if (key.includes('days_')) return `${value.toFixed(1)} days`;
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  const period = metrics.periods?.[0];
  // Backend returns "ratios" not "metrics"
  const ratios = (period as any)?.ratios ?? period?.metrics;
  if (!ratios) return null;

  return (
    <div className="space-y-8">
      {CATEGORY_ORDER.map((category) => {
        const data = ratios[category as keyof typeof ratios];
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
