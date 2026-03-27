import { cn } from '../../lib/utils';

const CATEGORIES = [
  'inflation', 'employment', 'gdp', 'housing', 'consumer',
  'manufacturing', 'rates', 'money', 'treasury',
];

interface CategorySelectorProps {
  active: string;
  onChange: (category: string) => void;
}

export function CategorySelector({ active, onChange }: CategorySelectorProps) {
  return (
    <div className="flex flex-wrap gap-x-1 gap-y-1 border-b border-slate-200 pb-3 dark:border-slate-800">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm capitalize transition-colors',
            active === cat
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          )}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
