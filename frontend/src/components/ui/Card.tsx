interface CardProps {
  title: string;
  value: string;
  subtitle?: string;
  delta?: number;
  className?: string;
}

export function Card({ title, value, subtitle, delta, className = '' }: CardProps) {
  return (
    <div className={`${className}`}>
      <p className="text-xs text-slate-400 dark:text-slate-500">{title}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      {(subtitle || delta !== undefined) && (
        <p className="text-xs">
          {delta !== undefined && (
            <span className={delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
              {delta >= 0 ? '+' : ''}{delta.toFixed(2)}%
            </span>
          )}
          {subtitle && <span className="text-slate-400"> {subtitle}</span>}
        </p>
      )}
    </div>
  );
}
