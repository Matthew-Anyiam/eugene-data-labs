import { useState } from 'react';
import type { FilingSection } from '../../hooks/useSections';
import { cn } from '../../lib/utils';

const SECTION_TYPES = [
  { key: 'mdna', label: 'MD&A' },
  { key: 'risk_factors', label: 'Risk Factors' },
  { key: 'business', label: 'Business' },
  { key: 'legal', label: 'Legal' },
];

interface SectionsViewProps {
  sections: FilingSection[];
  onSectionChange?: (section: string) => void;
}

export function SectionsView({ sections, onSectionChange }: SectionsViewProps) {
  const [activeSection, setActiveSection] = useState(SECTION_TYPES[0].key);

  function handleChange(key: string) {
    setActiveSection(key);
    onSectionChange?.(key);
  }

  const current = sections.find((s) => s.section === activeSection);

  return (
    <div>
      <div className="mb-4 flex gap-1">
        {SECTION_TYPES.map((s) => (
          <button
            key={s.key}
            onClick={() => handleChange(s.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              activeSection === s.key
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {current ? (
        <div>
          <div className="mb-3 flex items-baseline gap-3">
            <h3 className="text-sm font-semibold">{current.title || current.section}</h3>
            <span className="text-xs text-slate-400">
              {current.form} · Filed {current.filing_date}
            </span>
          </div>
          <div className="max-h-[600px] overflow-y-auto rounded-md border border-slate-200 p-4 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:text-slate-300">
            {current.text.split('\n').map((line, i) => (
              <p key={i} className={line.trim() === '' ? 'h-3' : 'mb-2'}>
                {line}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-slate-400">
          No {SECTION_TYPES.find((s) => s.key === activeSection)?.label || activeSection} section found.
        </p>
      )}
    </div>
  );
}
