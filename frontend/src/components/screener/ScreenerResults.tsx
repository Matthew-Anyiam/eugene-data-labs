import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { ScreenerResult } from '../../lib/types';
import { formatCurrency, cn } from '../../lib/utils';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface ScreenerResultsProps {
  results: ScreenerResult[];
}

type SortKey = 'ticker' | 'name' | 'sector' | 'price' | 'market_cap' | 'volume' | 'beta';
type SortDir = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'ticker', label: 'Ticker', align: 'left' },
  { key: 'name', label: 'Company', align: 'left' },
  { key: 'sector', label: 'Sector', align: 'left' },
  { key: 'price', label: 'Price', align: 'right' },
  { key: 'market_cap', label: 'Market Cap', align: 'right' },
  { key: 'volume', label: 'Volume', align: 'right' },
  { key: 'beta', label: 'Beta', align: 'right' },
];

function compareValues(a: any, b: any, dir: SortDir): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'string') {
    const cmp = a.localeCompare(b as string, undefined, { sensitivity: 'base' });
    return dir === 'asc' ? cmp : -cmp;
  }
  return dir === 'asc' ? (a as number) - (b as number) : (b as number) - (a as number);
}

export function ScreenerResults({ results }: ScreenerResultsProps) {
  const [sortKey, setSortKey] = useState<SortKey>('market_cap');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    return [...results].sort((a, b) => compareValues(a[sortKey], b[sortKey], sortDir));
  }, [results, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'ticker' || key === 'name' || key === 'sector' ? 'asc' : 'desc');
    }
  }

  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 px-6 py-16 text-center dark:border-slate-800">
        <p className="text-sm text-slate-400">No stocks match your filters</p>
        <p className="mt-1 text-xs text-slate-300 dark:text-slate-500">
          Try broadening your search criteria
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs text-slate-400">
        Showing {results.length} result{results.length !== 1 ? 's' : ''}
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={cn(
                    'cursor-pointer select-none whitespace-nowrap px-4 py-3 font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
                    col.align === 'right' ? 'text-right' : 'text-left'
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      sortDir === 'asc'
                        ? <ChevronUp className="h-3 w-3" />
                        : <ChevronDown className="h-3 w-3" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.ticker}
                className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-800/50 dark:hover:bg-slate-900/30"
              >
                <td className="px-4 py-3 font-medium">
                  <Link
                    to={`/company/${r.ticker}`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {r.ticker}
                  </Link>
                </td>
                <td className="px-4 py-3 max-w-[200px] truncate">{r.name}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{r.sector}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  ${r.price?.toFixed(2) ?? '\u2014'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatCurrency(r.market_cap)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.volume?.toLocaleString() ?? '\u2014'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.beta != null ? r.beta.toFixed(2) : '\u2014'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Skeleton shown during loading */
export function ScreenerResultsSkeleton() {
  return (
    <div>
      <div className="mb-3 h-4 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex gap-8">
            {[60, 120, 80, 60, 80, 70, 50].map((w, i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" style={{ width: w }} />
            ))}
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-8 border-b border-slate-100 px-4 py-3 dark:border-slate-800/50"
          >
            {[60, 120, 80, 60, 80, 70, 50].map((w, j) => (
              <div
                key={j}
                className="h-4 animate-pulse rounded bg-slate-100 dark:bg-slate-800"
                style={{ width: w, animationDelay: `${(i * 7 + j) * 50}ms` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
