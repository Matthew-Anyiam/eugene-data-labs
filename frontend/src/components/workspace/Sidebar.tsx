import { Link, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard, Globe, TrendingUp, Flame,
  BarChart3, LayoutGrid, Bitcoin,
  Activity, FileText,
  GitCompareArrows, Bot, LineChart, Bell, Eye,
  Briefcase, Network, Search, ChevronDown, ChevronRight, Moon, Sun, Plus,
  X, LogOut, User, Zap, Star, CreditCard,
} from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useWatchlist } from '../../hooks/useWatchlist';
import { useAuth } from '../../contexts/AuthContext';
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
      { to: '/trending', label: 'Trending', icon: <Flame className="h-4 w-4" /> },
      { to: '/predictions', label: 'Predictions', icon: <LineChart className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Markets',
    items: [
      { to: '/screener', label: 'Screener', icon: <BarChart3 className="h-4 w-4" /> },
      { to: '/heatmap', label: 'Heatmap', icon: <LayoutGrid className="h-4 w-4" /> },
      { to: '/movers', label: 'Movers', icon: <TrendingUp className="h-4 w-4" /> },
      { to: '/crypto', label: 'Crypto', icon: <Bitcoin className="h-4 w-4" /> },
      { to: '/economics', label: 'Economics', icon: <TrendingUp className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Research',
    items: [
      { to: '/filings', label: 'Filings', icon: <FileText className="h-4 w-4" /> },
      { to: '/technical', label: 'Technical', icon: <Activity className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { to: '/portfolio', label: 'Portfolio', icon: <Briefcase className="h-4 w-4" /> },
      { to: '/watchlist', label: 'Watchlist', icon: <Eye className="h-4 w-4" /> },
      { to: '/alerts', label: 'Alerts', icon: <Bell className="h-4 w-4" /> },
      { to: '/compare', label: 'Compare', icon: <GitCompareArrows className="h-4 w-4" /> },
      { to: '/agents', label: 'AI Agents', icon: <Bot className="h-4 w-4" />, badge: 'NEW' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { to: '/ontology', label: 'Ontology', icon: <Network className="h-4 w-4" /> },
      { to: '/docs', label: 'API Docs', icon: <FileText className="h-4 w-4" /> },
    ],
  },
];

export function Sidebar({ collapsed, onToggle, onCommandPalette }: SidebarProps) {
  const location = useLocation();
  const { dark, toggle: toggleDark } = useDarkMode();
  const { tickers: watchlist, addTicker, removeTicker } = useWatchlist();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Intelligence: true,
    Markets: true,
    Research: false,
    Workspace: true,
    Platform: false,
    Watchlist: true,
  });
  const [addingTicker, setAddingTicker] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  const toggleSection = (label: string) => {
    setExpandedSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  // Focus the add-ticker input when it opens
  useEffect(() => {
    if (addingTicker) {
      setTimeout(() => addInputRef.current?.focus(), 50);
    }
  }, [addingTicker]);

  const handleAddTicker = () => {
    const ticker = newTicker.trim().toUpperCase();
    if (ticker && /^[A-Z.]{1,10}$/.test(ticker)) {
      addTicker(ticker);
      setNewTicker('');
      setAddingTicker(false);
    }
  };

  const { user, logout } = useAuth();

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

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
          {/* Watchlist icons in collapsed mode */}
          <div className="my-1 h-px w-6 bg-slate-200 dark:bg-slate-800" />
          {watchlist.slice(0, 5).map((ticker) => (
            <Link
              key={ticker}
              to={`/company/${ticker}`}
              title={ticker}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md text-[10px] font-bold transition-colors',
                location.pathname === `/company/${ticker}`
                  ? 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800/50 dark:hover:text-slate-300'
              )}
            >
              {ticker.slice(0, 3)}
            </Link>
          ))}
        </div>
        {/* Collapsed user avatar */}
        <div className="border-t border-slate-200 py-2 dark:border-slate-800">
          <button
            onClick={logout}
            title={user?.name || 'User'}
            className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white transition-opacity hover:opacity-80"
          >
            {initials}
          </button>
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
        <div className="ml-auto flex items-center gap-1">
          <Activity className="h-3 w-3 animate-pulse text-emerald-500" />
        </div>
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
            <span className="ml-auto rounded-full bg-slate-200 px-1.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {watchlist.length}
            </span>
          </button>
          {expandedSections.Watchlist && (
            <div className="space-y-0.5">
              {watchlist.map((ticker) => (
                <div
                  key={ticker}
                  className={cn(
                    'group flex items-center rounded-md transition-colors',
                    location.pathname === `/company/${ticker}`
                      ? 'bg-slate-200 dark:bg-slate-800'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'
                  )}
                >
                  <Link
                    to={`/company/${ticker}`}
                    className={cn(
                      'flex flex-1 items-center gap-2.5 px-2 py-1.5 text-sm transition-colors',
                      location.pathname === `/company/${ticker}`
                        ? 'font-medium text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-400 dark:hover:text-white'
                    )}
                  >
                    <Star className="h-3.5 w-3.5 text-amber-400" />
                    <span className="font-mono text-xs">{ticker}</span>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTicker(ticker);
                    }}
                    className="mr-1 rounded p-0.5 text-slate-300 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100 dark:text-slate-600 dark:hover:text-red-400"
                    title={`Remove ${ticker}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {/* Add ticker inline */}
              {addingTicker ? (
                <div className="flex items-center gap-1 px-2 py-1">
                  <Star className="h-3.5 w-3.5 text-slate-300" />
                  <input
                    ref={addInputRef}
                    type="text"
                    value={newTicker}
                    onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddTicker();
                      if (e.key === 'Escape') { setAddingTicker(false); setNewTicker(''); }
                    }}
                    onBlur={() => {
                      if (!newTicker.trim()) {
                        setAddingTicker(false);
                      }
                    }}
                    placeholder="TICKER"
                    maxLength={10}
                    className="w-full bg-transparent font-mono text-xs text-slate-700 placeholder:text-slate-300 focus:outline-none dark:text-slate-300 dark:placeholder:text-slate-600"
                  />
                  <button
                    onClick={handleAddTicker}
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingTicker(true)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800/50 dark:hover:text-slate-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="text-xs">Add ticker</span>
                </button>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* User menu */}
      <UserMenu
        user={user}
        initials={initials}
        dark={dark}
        toggleDark={toggleDark}
        logout={logout}
      />
    </aside>
  );
}

/* ---------- User menu sub-component ---------- */
function UserMenu({
  user,
  initials,
  dark,
  toggleDark,
  logout,
}: {
  user: { name: string; email: string } | null;
  initials: string;
  dark: boolean;
  toggleDark: () => void;
  logout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  return (
    <div ref={menuRef} className="relative border-t border-slate-200 px-2 py-2 dark:border-slate-800">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/50"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
            {user?.name || 'User'}
          </p>
          <p className="truncate text-[10px] text-slate-400">
            {user?.email || ''}
          </p>
        </div>
        <ChevronDown
          className={cn(
            'h-3 w-3 shrink-0 text-slate-400 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute bottom-full left-2 right-2 mb-1 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50"
          >
            <User className="h-3.5 w-3.5" />
            Profile & Settings
          </Link>
          <Link
            to="/pricing"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50"
          >
            <CreditCard className="h-3.5 w-3.5" />
            Plans
          </Link>
          <button
            onClick={() => { toggleDark(); setOpen(false); }}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50"
          >
            {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {dark ? 'Light mode' : 'Dark mode'}
          </button>
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          <button
            onClick={() => { logout(); setOpen(false); }}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
