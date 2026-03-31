import type { FredSeries } from '../../lib/types';
import { MiniSparkline } from '../charts/MiniSparkline';
import { cn } from '../../lib/utils';

interface IndicatorCardProps {
  series: FredSeries;
  categoryLabel?: string;
  onClick?: () => void;
}

/** Known FRED series units/context for smart formatting */
const SERIES_META: Record<string, { units: string; format?: 'pct' | 'dollar' | 'index' | 'thousands' | 'billions' }> = {
  // Inflation
  CPIAUCSL: { units: 'Index', format: 'index' },
  CPILFESL: { units: 'Index', format: 'index' },
  PCEPI: { units: 'Index', format: 'index' },
  PCEPILFE: { units: 'Index', format: 'index' },
  // Employment
  UNRATE: { units: '%', format: 'pct' },
  PAYEMS: { units: 'Thousands', format: 'thousands' },
  ICSA: { units: 'Claims', format: 'thousands' },
  CCSA: { units: 'Claims', format: 'thousands' },
  // GDP
  GDP: { units: 'Billions $', format: 'billions' },
  GDPC1: { units: 'Billions $', format: 'billions' },
  A191RL1Q225SBEA: { units: '% Change', format: 'pct' },
  // Housing
  HOUST: { units: 'Thousands', format: 'thousands' },
  PERMIT: { units: 'Thousands', format: 'thousands' },
  MORTGAGE30US: { units: '%', format: 'pct' },
  CSUSHPISA: { units: 'Index', format: 'index' },
  // Consumer
  UMCSENT: { units: 'Index', format: 'index' },
  PCE: { units: 'Billions $', format: 'billions' },
  RSAFS: { units: 'Millions $' },
  // Manufacturing
  INDPRO: { units: 'Index', format: 'index' },
  TCU: { units: '%', format: 'pct' },
  // Rates
  FEDFUNDS: { units: '%', format: 'pct' },
  T10Y2Y: { units: '%', format: 'pct' },
  T10Y3M: { units: '%', format: 'pct' },
  // Money
  M2SL: { units: 'Billions $', format: 'billions' },
  WALCL: { units: 'Millions $' },
  // Treasury
  DGS1: { units: '%', format: 'pct' },
  DGS2: { units: '%', format: 'pct' },
  DGS5: { units: '%', format: 'pct' },
  DGS10: { units: '%', format: 'pct' },
  DGS30: { units: '%', format: 'pct' },
};

function formatValue(value: number | string, seriesId: string): string {
  if (typeof value === 'string') return value;
  const meta = SERIES_META[seriesId];
  if (!meta) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });

  switch (meta.format) {
    case 'pct':
      return `${value.toFixed(2)}%`;
    case 'billions':
      return `$${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}B`;
    case 'thousands':
      return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
    case 'index':
      return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
    default:
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
}

function getUnits(seriesId: string, fallback: string): string {
  return SERIES_META[seriesId]?.units || fallback || '';
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  inflation: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  employment: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  gdp: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  housing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  consumer: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  manufacturing: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  rates: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  money: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  treasury: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
};

export function IndicatorCard({ series, categoryLabel, onClick }: IndicatorCardProps) {
  const sparkData = (series.history || []).slice(-20).map((h) => ({ value: h.value }));
  const units = getUnits(series.id, series.units);
  const catColor = categoryLabel ? CATEGORY_COLORS[categoryLabel] : undefined;

  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex cursor-pointer flex-col rounded-lg border border-slate-200 p-4 transition-colors',
        'hover:border-slate-300 hover:bg-slate-50',
        'dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-900/50'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-tight">{series.title}</p>
        {sparkData.length > 1 && (
          <div className="shrink-0">
            <MiniSparkline data={sparkData} />
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
          {formatValue(series.value, series.id)}
        </span>
        {units && (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {units}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        {series.date && (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {formatDate(series.date)}
          </span>
        )}
        {categoryLabel && catColor && (
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium capitalize', catColor)}>
            {categoryLabel}
          </span>
        )}
      </div>
    </div>
  );
}
