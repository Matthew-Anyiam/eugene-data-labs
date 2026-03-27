import type { InsiderTransaction } from '../../hooks/useInsiders';
import { formatPrice } from '../../lib/utils';

interface InsidersTableProps {
  transactions: InsiderTransaction[];
}

export function InsidersTable({ transactions }: InsidersTableProps) {
  if (transactions.length === 0) {
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
            <th className="pb-2 pr-4 text-right font-medium">Price</th>
            <th className="pb-2 text-right font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t, i) => (
            <tr key={`${t.owner}-${t.date}-${i}`} className="border-b border-slate-100 dark:border-slate-800/50">
              <td className="py-2.5 pr-4 font-medium">{t.owner}</td>
              <td className="py-2.5 pr-4 text-slate-500 dark:text-slate-400">{t.title || '—'}</td>
              <td className="py-2.5 pr-4">
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  t.transaction_type?.toLowerCase().includes('purchase') || t.transaction_type?.toLowerCase().includes('buy')
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : t.transaction_type?.toLowerCase().includes('sale') || t.transaction_type?.toLowerCase().includes('sell')
                    ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {t.transaction_type || '—'}
                </span>
              </td>
              <td className="py-2.5 pr-4 tabular-nums text-slate-600 dark:text-slate-400">{t.date}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums">{t.shares?.toLocaleString() ?? '—'}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-slate-600 dark:text-slate-400">{t.price_per_share ? formatPrice(t.price_per_share) : '—'}</td>
              <td className="py-2.5 text-right tabular-nums font-medium">{t.value ? `$${t.value.toLocaleString()}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
