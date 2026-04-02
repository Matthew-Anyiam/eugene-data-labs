import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Globe, BarChart3, Network, Search, ArrowLeft,
} from 'lucide-react';

const SUGGESTIONS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Command center' },
  { to: '/world', label: 'World Intel', icon: Globe, desc: 'Live events' },
  { to: '/screener', label: 'Screener', icon: BarChart3, desc: 'Filter stocks' },
  { to: '/ontology', label: 'Ontology', icon: Network, desc: 'Entity graph' },
];

export function NotFoundPage() {
  const { pathname } = useLocation();

  return (
    <div className="flex flex-col items-center justify-center px-4 py-24">
      <div className="text-center">
        <h1 className="text-7xl font-bold tabular-nums text-slate-200 dark:text-slate-800">404</h1>
        <p className="mt-4 text-lg font-medium text-slate-600 dark:text-slate-400">Page not found</p>
        <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">
            {pathname}
          </code>{' '}
          doesn't exist in the workspace.
        </p>
      </div>

      {/* Quick actions */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SUGGESTIONS.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 p-4 text-center transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800/50"
          >
            <s.icon className="h-5 w-5 text-slate-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{s.label}</span>
            <span className="text-[10px] text-slate-400">{s.desc}</span>
          </Link>
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          to="/dashboard"
          className="flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          className="flex items-center gap-1.5 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <Search className="h-3.5 w-3.5" />
          Search
        </button>
      </div>
    </div>
  );
}
