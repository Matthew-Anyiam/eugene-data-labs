import type { InsiderFiling } from '../../lib/types';
import { formatPrice } from '../../lib/utils';

interface InsidersTableProps {
  filings: InsiderFiling[];
}

export function InsidersTable({ filings }: InsidersTableProps) {
  const rows = filings.flatMap((f) =>
    f.transactions.map((tx) => ({
      owner: f.owner?.name || '—',
      title: f.owner?.title || (f.owner?.is_director ? 'Director' : ''),
      type: tx.transaction_type,
      date: tx.date || f.filed_date,
      shares: tx.shares,
      price: tx.price_per_share,
      direction: tx.direction,
    }))
  );

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No insider transactions found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
            <th className="pb-2 pr-4 font-medium">Name</th>
            <th className="pb-2 pr-4 font-medium">Title</th>
            <th className="pb-2 pr-4 font-medium">Type</th>
            <th className="pb-2 pr-4 font-medium">Date</th>
            <th className="pb-2 pr-4 text-right font-medium">Shares</th>
            <th className="pb-2 text-right font-medium">Price</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.owner}-${r.date}-${i}`} className="border-b border-slate-100 dark:border-slate-800/50">
              <td className="whitespace-nowrap py-2.5 pr-4 font-medium">{r.owner}</td>
              <td className="min-w-0 py-2.5 pr-4 text-slate-500 dark:text-slate-400">{r.title || '—'}</td>
              <td className="whitespace-nowrap py-2.5 pr-4">
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  r.type === 'purchase'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : r.type === 'sale'
                    ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {r.type || '—'}
                </span>
              </td>
              <td className="whitespace-nowrap py-2.5 pr-4 tabular-nums text-slate-600 dark:text-slate-400">{r.date}</td>
              <td className="whitespace-nowrap py-2.5 pr-4 text-right tabular-nums">{r.shares?.toLocaleString() ?? '—'}</td>
              <td className="whitespace-nowrap py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                {r.price ? formatPrice(r.price) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
