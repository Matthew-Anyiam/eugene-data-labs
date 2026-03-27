import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse rounded bg-slate-200 dark:bg-slate-800', className)} />
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
