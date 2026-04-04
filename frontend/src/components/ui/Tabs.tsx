import { cn } from '../../lib/utils';

interface TabsProps {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex gap-0 overflow-x-auto border-b border-slate-200 scrollbar-none dark:border-slate-800">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={cn(
            '-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors',
            active === tab
              ? 'border-slate-900 text-slate-900 dark:border-white dark:text-white'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
