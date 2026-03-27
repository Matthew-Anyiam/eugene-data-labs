import { ExternalLink } from 'lucide-react';
import type { Provenance as ProvenanceType } from '../../lib/types';

interface ProvenanceProps {
  items: ProvenanceType[];
  className?: string;
}

export function ProvenanceBar({ items, className = '' }: ProvenanceProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 dark:text-slate-500 ${className}`}>
      <span>Source:</span>
      {items.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {p.url ? (
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 underline decoration-slate-300 underline-offset-2 hover:text-slate-600 dark:decoration-slate-700 dark:hover:text-slate-300"
            >
              {p.source} <ExternalLink className="h-2.5 w-2.5" />
            </a>
          ) : (
            p.source
          )}
        </span>
      ))}
    </div>
  );
}
