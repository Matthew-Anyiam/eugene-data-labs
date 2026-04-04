import { useConvergenceScore, type ConvergenceSignal } from '../../hooks/useConvergenceScore';
import { cn } from '../../lib/utils';
import { Activity, TrendingUp, TrendingDown, Minus, Loader2, ShieldCheck } from 'lucide-react';

export function ConvergencePanel({ ticker }: { ticker: string }) {
  const { data, isLoading, error } = useConvergenceScore(ticker);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Computing convergence score...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50">
        Unable to compute convergence score
      </div>
    );
  }

  const scoreColor =
    data.direction === 'bullish'
      ? 'text-emerald-600 dark:text-emerald-400'
      : data.direction === 'bearish'
        ? 'text-red-600 dark:text-red-400'
        : 'text-slate-500 dark:text-slate-400';

  const scoreBg =
    data.direction === 'bullish'
      ? 'from-emerald-500/10 dark:from-emerald-500/20 to-transparent'
      : data.direction === 'bearish'
        ? 'from-red-500/10 dark:from-red-500/20 to-transparent'
        : 'from-slate-500/5 dark:from-slate-500/20 to-transparent';

  const DirectionIcon =
    data.direction === 'bullish' ? TrendingUp : data.direction === 'bearish' ? TrendingDown : Minus;

  // Score gauge position (0-100 range from -100 to +100)
  const gaugePos = ((data.score + 100) / 200) * 100;

  return (
    <div className="space-y-4">
      {/* Main score card */}
      <div className={cn('rounded-xl border border-slate-200 bg-gradient-to-br p-6 dark:border-slate-700', scoreBg)}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Convergence Score</h3>
          </div>
          <div className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {(data.confidence * 100).toFixed(0)}% confidence
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Score number */}
          <div className="text-center">
            <div className={cn('text-4xl font-bold tabular-nums', scoreColor)}>
              {data.score > 0 ? '+' : ''}
              {data.score}
            </div>
            <div className={cn('mt-1 flex items-center justify-center gap-1 text-sm font-medium', scoreColor)}>
              <DirectionIcon className="h-4 w-4" />
              <span className="capitalize">{data.direction}</span>
            </div>
          </div>

          {/* Gauge bar */}
          <div className="flex-1">
            <div className="relative h-3 overflow-hidden rounded-full bg-gradient-to-r from-red-600 via-slate-400 to-emerald-600 dark:via-slate-600">
              <div
                className="absolute top-0 h-full w-1.5 rounded-full bg-white shadow-lg shadow-white/50 transition-all duration-500"
                style={{ left: `calc(${gaugePos}% - 3px)` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
              <span>Bearish</span>
              <span>Neutral</span>
              <span>Bullish</span>
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{data.summary}</p>
      </div>

      {/* Individual signals */}
      <div className="grid gap-2 sm:grid-cols-2">
        {data.signals.map((signal, i) => (
          <SignalCard key={i} signal={signal} />
        ))}
      </div>
    </div>
  );
}

function SignalCard({ signal }: { signal: ConvergenceSignal }) {
  const color =
    signal.signal === 'bullish'
      ? 'text-emerald-600 dark:text-emerald-400'
      : signal.signal === 'bearish'
        ? 'text-red-600 dark:text-red-400'
        : 'text-slate-500 dark:text-slate-400';

  const bg =
    signal.signal === 'bullish'
      ? 'bg-emerald-50 dark:bg-emerald-500/10'
      : signal.signal === 'bearish'
        ? 'bg-red-50 dark:bg-red-500/10'
        : 'bg-slate-50 dark:bg-slate-500/10';

  const Icon = signal.signal === 'bullish' ? TrendingUp : signal.signal === 'bearish' ? TrendingDown : Minus;

  return (
    <div className={cn('rounded-lg border border-slate-200 p-3 dark:border-slate-700', bg)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{signal.source}</span>
        <div className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', color)}>
          <Icon className="h-3 w-3" />
          {signal.signal}
        </div>
      </div>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">{signal.detail}</p>
      {/* Strength bar */}
      <div className="mt-2 h-1 rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            signal.signal === 'bullish'
              ? 'bg-emerald-500'
              : signal.signal === 'bearish'
                ? 'bg-red-500'
                : 'bg-slate-400 dark:bg-slate-500',
          )}
          style={{ width: `${signal.strength * 100}%` }}
        />
      </div>
    </div>
  );
}
