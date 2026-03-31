import { cn } from '../../lib/utils';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'inflation', label: 'Inflation' },
  { key: 'employment', label: 'Employment' },
  { key: 'gdp', label: 'GDP' },
  { key: 'housing', label: 'Housing' },
  { key: 'consumer', label: 'Consumer' },
  { key: 'manufacturing', label: 'Manufacturing' },
  { key: 'rates', label: 'Rates' },
  { key: 'money', label: 'Money' },
  { key: 'treasury', label: 'Treasury' },
];

interface CategorySelectorProps {
  active: string;
  onChange: (category: string) => void;
}

export function CategorySelector({ active, onChange }: CategorySelectorProps) {
  return (
    <div className="flex flex-wrap gap-x-1 gap-y-1.5 border-b border-slate-200 pb-3 dark:border-slate-800">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.key}
          onClick={() => onChange(cat.key)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm transition-colors',
            active === cat.key
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          )}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
