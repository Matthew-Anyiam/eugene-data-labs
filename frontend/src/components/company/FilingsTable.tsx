import type { Filing } from '../../lib/types';
import { ExternalLink } from 'lucide-react';

interface FilingsTableProps {
  filings: Filing[];
}

export function FilingsTable({ filings }: FilingsTableProps) {
  if (filings.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No filings found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
            <th className="pb-2 pr-4 font-medium">Form</th>
            <th className="pb-2 pr-4 font-medium">Filed</th>
            <th className="pb-2 pr-4 font-medium">Description</th>
            <th className="pb-2 font-medium">Link</th>
          </tr>
        </thead>
        <tbody>
          {filings.map((f) => (
            <tr key={f.accession_number} className="border-b border-slate-100 dark:border-slate-800/50">
              <td className="py-2.5 pr-4">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium dark:bg-slate-800">{f.form}</span>
              </td>
              <td className="py-2.5 pr-4 tabular-nums text-slate-600 dark:text-slate-400">{f.filing_date}</td>
              <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-400">{f.description || '—'}</td>
              <td className="py-2.5">
                {f.primary_doc && (
                  <a
                    href={`https://www.sec.gov/Archives/edgar/data/${f.accession_number.replace(/-/g, '').slice(0, 10)}/${f.accession_number}/${f.primary_doc}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  >
                    SEC <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
