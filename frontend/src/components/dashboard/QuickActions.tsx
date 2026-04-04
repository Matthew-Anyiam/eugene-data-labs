import { Link } from 'react-router-dom';
import {
  Search, Globe, BarChart3, TrendingUp, Network, FileText, Zap,
} from 'lucide-react';

const ACTIONS = [
  { to: '/screener', label: 'Screen Stocks', icon: BarChart3, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' },
  { to: '/world', label: 'World Intel', icon: Globe, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' },
  { to: '/economics', label: 'Economics', icon: TrendingUp, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' },
  { to: '/ontology', label: 'Ontology', icon: Network, color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400' },
  { to: '/predictions', label: 'Predictions', icon: Zap, color: 'bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400' },
  { to: '/docs', label: 'API Docs', icon: FileText, color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
];

interface QuickActionsProps {
  onSearch: () => void;
}

export function QuickActions({ onSearch }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
      {/* Search action */}
      <button
        onClick={onSearch}
        className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 p-3 text-center transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800/50"
      >
        <div className="rounded-lg bg-slate-900 p-2 text-white dark:bg-white dark:text-slate-900">
          <Search className="h-4 w-4" />
        </div>
        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Search</span>
      </button>

      {ACTIONS.map((action) => (
        <Link
          key={action.to}
          to={action.to}
          className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 p-3 text-center transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800/50"
        >
          <div className={`rounded-lg p-2 ${action.color}`}>
            <action.icon className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{action.label}</span>
        </Link>
      ))}
    </div>
  );
}
