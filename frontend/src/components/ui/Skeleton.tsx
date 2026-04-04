import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse rounded bg-slate-200 dark:bg-slate-800', className)} style={style} />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2.5', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

export function SkeletonCompanyHeader() {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="h-4 w-64" />
      <div className="flex items-baseline gap-3">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28" />
      </div>
    </div>
  );
}

export function SkeletonStatsGrid({ cols = 4 }: { cols?: number }) {
  return (
    <div className={cn('grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 dark:border-slate-800 dark:bg-slate-800', `grid-cols-${cols}`)}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="bg-white px-4 py-3 dark:bg-slate-900">
          <Skeleton className="mb-1.5 h-3 w-16" />
          <Skeleton className="h-5 w-24" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="mb-2 h-3.5 w-full" />
      <Skeleton className="h-3.5 w-2/3" />
    </div>
  );
}

export function SkeletonBarChart({ bars = 8 }: { bars?: number }) {
  const heights = [40, 65, 55, 80, 45, 70, 50, 60];
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-20" />
      <div className="flex h-48 items-end gap-2 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        {Array.from({ length: bars }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${heights[i % heights.length]}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header area */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <Skeleton className="mb-1.5 h-3 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <Skeleton className="mb-3 h-4 w-32" />
        <Skeleton className="h-56 w-full rounded" />
      </div>

      {/* Table area */}
      <div className="space-y-3">
        <div className="flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
