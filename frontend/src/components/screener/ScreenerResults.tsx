import { useNavigate } from 'react-router-dom';
import type { ScreenerResult } from '../../lib/types';
import { formatCurrency, formatPercent } from '../../lib/utils';

interface ScreenerResultsProps {
  results: ScreenerResult[];
}

export function ScreenerResults({ results }: ScreenerResultsProps) {
  const navigate = useNavigate();

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
            <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Ticker</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Company</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Sector</th>
            <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">Price</th>
            <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">Change</th>
            <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">Mkt Cap</th>
            <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">Volume</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr
              key={r.symbol}
              className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800/50 dark:hover:bg-slate-900/30"
              onClick={() => navigate(`/company/${r.symbol}`)}
            >
              <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400">{r.symbol}</td>
              <td className="px-4 py-3">{r.companyName}</td>
              <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{r.sector}</td>
              <td className="px-4 py-3 text-right tabular-nums">${r.price?.toFixed(2) ?? '—'}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                <span className={r.changesPercentage >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                  {formatPercent(r.changesPercentage)}
                </span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.marketCap)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.volume?.toLocaleString() ?? '—'}</td>
            </tr>
          ))}
          {results.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-400">No results found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
