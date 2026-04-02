import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  Search, Globe, BarChart3, TrendingUp, LineChart,
  Network, LayoutDashboard, FileText, ChevronDown, ChevronRight,
  Moon, Sun, Star, Plus, CreditCard, Zap,
} from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { cn } from '../../lib/utils';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onCommandPalette: () => void;
}

interface NavSection {
  label: string;
  items: { to: string; label: string; icon: React.ReactNode; badge?: string }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Intelligence',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
      { to: '/world', label: 'World', icon: <Globe className="h-4 w-4" />, badge: 'LIVE' },
      { to: '/screener', label: 'Screener', icon: <BarChart3 className="h-4 w-4" /> },
      { to: '/economics', label: 'Economics', icon: <TrendingUp className="h-4 w-4" /> },
      { to: '/predictions', label: 'Predictions', icon: <LineChart className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Data',
    items: [
      { to: '/ontology', label: 'Ontology', icon: <Network className="h-4 w-4" /> },
      { to: '/docs', label: 'API Docs', icon: <FileText className="h-4 w-4" /> },
    ],
  },
];

// Saved tickers (will be persisted in localStorage later)
const DEFAULT_WATCHLIST = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL'];

export function Sidebar({ collapsed, onToggle, onCommandPalette }: SidebarProps) {
  const location = useLocation();
  const { dark, toggle: toggleDark } = useDarkMode();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Intelligence: true,
    Data: true,
    Watchlist: true,
  });
  const [watchlist] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('eugene_watchlist');
      return stored ? JSON.parse(stored) : DEFAULT_WATCHLIST;
    } catch {
      return DEFAULT_WATCHLIST;
    }
  });

  const toggleSection = (label: string) => {
    setExpandedSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  if (collapsed) {
    return (
      <aside className="flex h-full w-12 flex-col border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
        <button
          onClick={onToggle}
          className="flex h-12 items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          title="Expand sidebar"
        >
          <Zap className="h-4 w-4 text-emerald-500" />
        </button>
        <div className="flex flex-1 flex-col items-center gap-1 py-2">
          {NAV_SECTIONS.flatMap((s) => s.items).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              title={item.label}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                location.pathname === item.to
                  ? 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800/50 dark:hover:text-slate-300'
              )}
            >
              {item.icon}
            </Link>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
      {/* Brand */}
      <div className="flex h-12 items-center gap-2 border-b border-slate-200 px-3 dark:border-slate-800">
        <button onClick={onToggle} className="flex items-center gap-2 text-left">
          <Zap className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">Eugene</span>
        </button>
        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          BETA
        </span>
      </div>

      {/* Search trigger */}
      <div className="px-3 py-2">
        <button
          onClick={onCommandPalette}
          className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left text-sm text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">Search...</span>
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800">
            {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}K
          </kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-1">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-1">
            <button
              onClick={() => toggleSection(section.label)}
              className="flex w-full items-center gap-1 px-1.5 py-1 text-[11px] font-medium uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400"
            >
              {expandedSections[section.label] ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {section.label}
            </button>
            {expandedSections[section.label] && (
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                      location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to))
                        ? 'bg-slate-200 font-medium text-slate-900 dark:bg-slate-800 dark:text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white'
                    )}
                  >
                    {item.icon}
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Watchlist */}
        <div className="mb-1">
          <button
            onClick={() => toggleSection('Watchlist')}
            className="flex w-full items-center gap-1 px-1.5 py-1 text-[11px] font-medium uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400"
          >
            {expandedSections.Watchlist ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Watchlist
          </button>
          {expandedSections.Watchlist && (
            <div className="space-y-0.5">
              {watchlist.map((ticker) => (
                <Link
                  key={ticker}
                  to={`/company/${ticker}`}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                    location.pathname === `/company/${ticker}`
                      ? 'bg-slate-200 font-medium text-slate-900 dark:bg-slate-800 dark:text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white'
                  )}
                >
                  <Star className="h-3.5 w-3.5 text-amber-400" />
                  <span className="font-mono text-xs">{ticker}</span>
                </Link>
              ))}
              <button
                onClick={onCommandPalette}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800/50 dark:hover:text-slate-300"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="text-xs">Add ticker</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Footer controls */}
      <div className="border-t border-slate-200 px-2 py-2 dark:border-slate-800">
        <div className="flex items-center gap-1">
          <button
            onClick={toggleDark}
            className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-300"
          >
            {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            <span className="text-xs">{dark ? 'Light' : 'Dark'}</span>
          </button>
          <Link
            to="/pricing"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-300"
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span className="text-xs">Plans</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
