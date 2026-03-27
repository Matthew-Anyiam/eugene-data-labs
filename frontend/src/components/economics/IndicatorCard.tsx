import type { FredSeries } from '../../lib/types';
import { MiniSparkline } from '../charts/MiniSparkline';

interface IndicatorCardProps {
  series: FredSeries;
  onClick?: () => void;
}

export function IndicatorCard({ series, onClick }: IndicatorCardProps) {
  const sparkData = (series.history || []).slice(-20).map((h) => ({ value: h.value }));

  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center justify-between border-b border-slate-200 px-1 py-3 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/50 sm:rounded-lg sm:border sm:px-4"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{series.title}</p>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="text-lg font-semibold tabular-nums">
            {typeof series.value === 'number' ? series.value.toLocaleString() : series.value}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {series.units}
          </span>
        </div>
      </div>
      {sparkData.length > 1 && (
        <div className="ml-3 shrink-0">
          <MiniSparkline data={sparkData} />
        </div>
      )}
    </div>
  );
}
