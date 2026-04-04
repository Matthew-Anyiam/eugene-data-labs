import { useCallback } from 'react';
import type { Filing } from '../../lib/types';
import { ExternalLink, Download } from 'lucide-react';
import { downloadCSV } from '../../lib/export';

interface FilingsTableProps {
  filings: Filing[];
}

export function FilingsTable({ filings }: FilingsTableProps) {
  const exportCSV = useCallback(() => {
    downloadCSV(
      filings.map((f) => ({
        form: f.form,
        filed_date: f.filed_date,
        description: f.description,
        accession: f.accession,
        url: f.url,
      })),
      `eugene-filings-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: 'form', label: 'Form' },
        { key: 'filed_date', label: 'Filed Date' },
        { key: 'description', label: 'Description' },
        { key: 'accession', label: 'Accession' },
        { key: 'url', label: 'URL' },
      ],
    );
  }, [filings]);

  if (filings.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No filings found.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{filings.length} filing{filings.length !== 1 ? 's' : ''}</p>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          <Download className="h-3 w-3" />
          CSV
        </button>
      </div>
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
              <tr key={f.accession} className="border-b border-slate-100 dark:border-slate-800/50">
                <td className="whitespace-nowrap py-2.5 pr-4">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium dark:bg-slate-800">{f.form}</span>
                </td>
                <td className="whitespace-nowrap py-2.5 pr-4 tabular-nums text-slate-600 dark:text-slate-400">{f.filed_date}</td>
                <td className="min-w-0 py-2.5 pr-4 text-slate-600 dark:text-slate-400">{f.description || '—'}</td>
                <td className="whitespace-nowrap py-2.5">
                  {f.url && (
                    <a
                      href={f.url}
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
    </div>
  );
}
