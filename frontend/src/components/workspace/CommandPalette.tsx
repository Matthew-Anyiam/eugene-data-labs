import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Building2, Globe, BarChart3, TrendingUp, LineChart,
  Network, LayoutDashboard, FileText, CreditCard, ArrowRight,
  Star, Moon, Sun, Settings,
} from 'lucide-react';
import { useWatchlist } from '../../hooks/useWatchlist';
import { useDarkMode } from '../../hooks/useDarkMode';
import { cn } from '../../lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

const POPULAR_TICKERS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B',
  'JPM', 'V', 'JNJ', 'WMT', 'UNH', 'MA', 'PG', 'HD', 'XOM', 'BAC',
  'KO', 'PFE', 'LLY', 'NFLX', 'AMD', 'CRM', 'DIS', 'GS', 'MS',
];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { addTicker, hasTicker } = useWatchlist();
  const { dark, toggle: toggleDark } = useDarkMode();

  const go = useCallback((path: string) => {
    navigate(path);
    onClose();
    setQuery('');
  }, [navigate, onClose]);

  // Build command list
  const pages: CommandItem[] = [
    { id: 'dashboard', label: 'Dashboard', description: 'Convergence overview', icon: <LayoutDashboard className="h-4 w-4" />, action: () => go('/dashboard'), category: 'Pages' },
    { id: 'world', label: 'World Intelligence', description: 'News, disasters, conflict, sanctions', icon: <Globe className="h-4 w-4" />, action: () => go('/world'), category: 'Pages' },
    { id: 'screener', label: 'Stock Screener', description: 'Filter companies', icon: <BarChart3 className="h-4 w-4" />, action: () => go('/screener'), category: 'Pages' },
    { id: 'economics', label: 'Economics', description: 'FRED indicators', icon: <TrendingUp className="h-4 w-4" />, action: () => go('/economics'), category: 'Pages' },
    { id: 'predictions', label: 'Predictions', description: 'Forward estimates', icon: <LineChart className="h-4 w-4" />, action: () => go('/predictions'), category: 'Pages' },
    { id: 'ontology', label: 'Ontology', description: 'Entity graph', icon: <Network className="h-4 w-4" />, action: () => go('/ontology'), category: 'Pages' },
    { id: 'docs', label: 'API Documentation', description: 'REST, MCP, CLI', icon: <FileText className="h-4 w-4" />, action: () => go('/docs'), category: 'Pages' },
    { id: 'pricing', label: 'Pricing', description: 'Plans and limits', icon: <CreditCard className="h-4 w-4" />, action: () => go('/pricing'), category: 'Pages' },
    { id: 'settings', label: 'Settings', description: 'Workspace config', icon: <Settings className="h-4 w-4" />, action: () => go('/settings'), category: 'Pages' },
  ];

  // Quick actions
  const actions: CommandItem[] = [
    {
      id: 'toggle-dark',
      label: dark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      description: 'Toggle theme',
      icon: dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
      action: () => { toggleDark(); onClose(); },
      category: 'Actions',
    },
  ];

  const q = query.trim().toUpperCase();

  // Filter tickers
  const tickerMatches: CommandItem[] = q.length > 0
    ? POPULAR_TICKERS
        .filter((t) => t.startsWith(q) || t.includes(q))
        .slice(0, 5)
        .map((t) => ({
          id: `company-${t}`,
          label: t,
          description: hasTicker(t) ? 'In watchlist' : 'View company',
          icon: hasTicker(t) ? <Star className="h-4 w-4 text-amber-400" /> : <Building2 className="h-4 w-4" />,
          action: () => go(`/company/${t}`),
          category: 'Companies',
        }))
    : [];

  // If query looks like a ticker and isn't in popular list, add direct nav + watchlist add
  const isTickerLike = /^[A-Z]{1,5}$/.test(q);
  if (isTickerLike && q.length >= 1 && !tickerMatches.find((t) => t.label === q)) {
    tickerMatches.unshift({
      id: `company-direct-${q}`,
      label: q,
      description: 'Look up company',
      icon: <ArrowRight className="h-4 w-4" />,
      action: () => go(`/company/${q}`),
      category: 'Companies',
    });
  }

  // Add "add to watchlist" action for ticker queries
  if (isTickerLike && q.length >= 1 && !hasTicker(q)) {
    tickerMatches.push({
      id: `watchlist-add-${q}`,
      label: `Add ${q} to watchlist`,
      description: 'Star this ticker',
      icon: <Star className="h-4 w-4" />,
      action: () => {
        addTicker(q);
        onClose();
        setQuery('');
      },
      category: 'Actions',
    });
  }

  // Filter pages
  const pageMatches = query.length > 0
    ? pages.filter(
        (p) =>
          p.label.toLowerCase().includes(query.toLowerCase()) ||
          (p.description && p.description.toLowerCase().includes(query.toLowerCase()))
      )
    : pages;

  // Filter actions
  const actionMatches = query.length > 0
    ? actions.filter(
        (a) =>
          a.label.toLowerCase().includes(query.toLowerCase()) ||
          (a.description && a.description.toLowerCase().includes(query.toLowerCase()))
      )
    : actions;

  const allItems = [...tickerMatches, ...pageMatches, ...actionMatches];

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && allItems[selectedIndex]) {
      e.preventDefault();
      allItems[selectedIndex].action();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [allItems, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const item = listRef.current.children[selectedIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!open) return null;

  // Group items by category
  const grouped: Record<string, CommandItem[]> = {};
  allItems.forEach((item) => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  let flatIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {/* Input */}
        <div className="flex items-center border-b border-slate-200 px-4 dark:border-slate-700">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search companies, pages, commands..."
            className="flex-1 bg-transparent px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
          />
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {allItems.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="px-4 py-1 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {category}
              </div>
              {items.map((item) => {
                const idx = flatIndex++;
                return (
                  <button
                    key={item.id}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors',
                      idx === selectedIndex
                        ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                        : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50'
                    )}
                  >
                    <span className="shrink-0 text-slate-400">{item.icon}</span>
                    <span className="flex-1 font-medium">{item.label}</span>
                    {item.description && (
                      <span className="text-xs text-slate-400">{item.description}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 border-t border-slate-200 px-4 py-2 text-[11px] text-slate-400 dark:border-slate-700">
          <span><kbd className="font-mono">&uarr;&darr;</kbd> navigate</span>
          <span><kbd className="font-mono">Enter</kbd> select</span>
          <span><kbd className="font-mono">Esc</kbd> close</span>
        </div>
      </div>
    </>
  );
}
