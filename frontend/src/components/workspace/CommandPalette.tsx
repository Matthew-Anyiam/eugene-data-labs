import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Building2, Globe, BarChart3, TrendingUp, LineChart, Bitcoin, GitCompareArrows, Bot, Briefcase, Bell, Newspaper, FileBarChart,
  Network, LayoutDashboard, FileText, CreditCard, ArrowRight,
  Star, Moon, Sun, Settings, Loader2, Clock, Database,
} from 'lucide-react';
import { useWatchlist } from '../../hooks/useWatchlist';
import { useDarkMode } from '../../hooks/useDarkMode';
import { eugeneApi } from '../../lib/api';
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

const ENTITY_ICONS: Record<string, string> = {
  company: '\uD83C\uDFE2',
  person: '\uD83D\uDC64',
  institution: '\uD83C\uDFDB\uFE0F',
  filing: '\uD83D\uDCC4',
  economic_indicator: '\uD83D\uDCCA',
};

// Recent navigation history
const HISTORY_KEY = 'eugene_nav_history';
const MAX_HISTORY = 8;

function getHistory(): { path: string; label: string; timestamp: number }[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}

export function recordNavigation(path: string, label: string) {
  try {
    const history = getHistory().filter((h) => h.path !== path);
    history.unshift({ path, label, timestamp: Date.now() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch { /* ignore */ }
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [apiResults, setApiResults] = useState<CommandItem[]>([]);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { addTicker, hasTicker } = useWatchlist();
  const { dark, toggle: toggleDark } = useDarkMode();

  const go = useCallback((path: string, label?: string) => {
    if (label) recordNavigation(path, label);
    navigate(path);
    onClose();
    setQuery('');
    setApiResults([]);
  }, [navigate, onClose]);

  // Debounced API search
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setApiResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await eugeneApi<{ matches?: any[] }>(`/v1/ontology/resolve?q=${encodeURIComponent(q)}&limit=5`);
        if (data?.matches && data.matches.length > 0) {
          const items: CommandItem[] = data.matches.map((m: any) => {
            const entityType = m.entity_type || 'company';
            const icon = ENTITY_ICONS[entityType] || '\uD83D\uDCC1';
            const isCompany = entityType === 'company';
            const ticker = m.source_id || m.attributes?.ticker;
            const path = isCompany && ticker ? `/company/${ticker}` : `/entity/${m.id}`;
            const label = m.canonical_name || m.name || m.source_id || 'Unknown';

            return {
              id: `api-${m.id}`,
              label,
              description: entityType.replace(/_/g, ' '),
              icon: <span className="text-sm">{icon}</span>,
              action: () => go(path, label),
              category: 'Entities',
            };
          });
          setApiResults(items);
        } else {
          setApiResults([]);
        }
      } catch {
        setApiResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open, go]);

  // Build command list
  const pages: CommandItem[] = [
    { id: 'dashboard', label: 'Dashboard', description: 'Convergence overview', icon: <LayoutDashboard className="h-4 w-4" />, action: () => go('/dashboard', 'Dashboard'), category: 'Pages' },
    { id: 'world', label: 'World Intelligence', description: 'News, disasters, conflict, sanctions', icon: <Globe className="h-4 w-4" />, action: () => go('/world', 'World'), category: 'Pages' },
    { id: 'screener', label: 'Stock Screener', description: 'Filter companies', icon: <BarChart3 className="h-4 w-4" />, action: () => go('/screener', 'Screener'), category: 'Pages' },
    { id: 'economics', label: 'Economics', description: 'FRED indicators', icon: <TrendingUp className="h-4 w-4" />, action: () => go('/economics', 'Economics'), category: 'Pages' },
    { id: 'predictions', label: 'Predictions', description: 'Forward estimates', icon: <LineChart className="h-4 w-4" />, action: () => go('/predictions', 'Predictions'), category: 'Pages' },
    { id: 'ontology', label: 'Ontology', description: 'Entity graph', icon: <Network className="h-4 w-4" />, action: () => go('/ontology', 'Ontology'), category: 'Pages' },
    { id: 'crypto', label: 'Crypto Markets', description: 'Bitcoin, Ethereum, Solana', icon: <Bitcoin className="h-4 w-4" />, action: () => go('/crypto', 'Crypto'), category: 'Pages' },
    { id: 'compare', label: 'Compare Companies', description: 'Side-by-side analysis', icon: <GitCompareArrows className="h-4 w-4" />, action: () => go('/compare', 'Compare'), category: 'Pages' },
    { id: 'agents', label: 'AI Agents', description: 'Research, debate, simulation', icon: <Bot className="h-4 w-4" />, action: () => go('/agents', 'AI Agents'), category: 'Pages' },
    { id: 'portfolio', label: 'Portfolio', description: 'Track positions & P&L', icon: <Briefcase className="h-4 w-4" />, action: () => go('/portfolio', 'Portfolio'), category: 'Pages' },
    { id: 'alerts', label: 'Alerts', description: 'Price alerts & notifications', icon: <Bell className="h-4 w-4" />, action: () => go('/alerts', 'Alerts'), category: 'Pages' },
    { id: 'news', label: 'News Feed', description: 'Financial news & headlines', icon: <Newspaper className="h-4 w-4" />, action: () => go('/news', 'News'), category: 'Pages' },
    { id: 'reports', label: 'Reports', description: 'Generate & download reports', icon: <FileBarChart className="h-4 w-4" />, action: () => go('/reports', 'Reports'), category: 'Pages' },
    { id: 'docs', label: 'API Documentation', description: 'REST, MCP, CLI', icon: <FileText className="h-4 w-4" />, action: () => go('/docs', 'Docs'), category: 'Pages' },
    { id: 'pricing', label: 'Pricing', description: 'Plans and limits', icon: <CreditCard className="h-4 w-4" />, action: () => go('/pricing', 'Pricing'), category: 'Pages' },
    { id: 'settings', label: 'Settings', description: 'Workspace config', icon: <Settings className="h-4 w-4" />, action: () => go('/settings', 'Settings'), category: 'Pages' },
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
          action: () => go(`/company/${t}`, t),
          category: 'Companies',
        }))
    : [];

  // Direct ticker navigation
  const isTickerLike = /^[A-Z]{1,5}$/.test(q);
  if (isTickerLike && q.length >= 1 && !tickerMatches.find((t) => t.label === q)) {
    tickerMatches.unshift({
      id: `company-direct-${q}`,
      label: q,
      description: 'Look up company',
      icon: <ArrowRight className="h-4 w-4" />,
      action: () => go(`/company/${q}`, q),
      category: 'Companies',
    });
  }

  // Watchlist add action
  if (isTickerLike && q.length >= 1 && !hasTicker(q)) {
    tickerMatches.push({
      id: `watchlist-add-${q}`,
      label: `Add ${q} to watchlist`,
      description: 'Star this ticker',
      icon: <Star className="h-4 w-4" />,
      action: () => { addTicker(q); onClose(); setQuery(''); },
      category: 'Actions',
    });
  }

  // Filter pages
  const pageMatches = query.length > 0
    ? pages.filter((p) =>
        p.label.toLowerCase().includes(query.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(query.toLowerCase()))
      )
    : pages;

  // Filter actions
  const actionMatches = query.length > 0
    ? actions.filter((a) =>
        a.label.toLowerCase().includes(query.toLowerCase()) ||
        (a.description && a.description.toLowerCase().includes(query.toLowerCase()))
      )
    : actions;

  // Recent history (shown when no query)
  const historyItems: CommandItem[] = query.length === 0
    ? getHistory().slice(0, 4).map((h) => ({
        id: `history-${h.path}`,
        label: h.label,
        description: h.path,
        icon: <Clock className="h-4 w-4" />,
        action: () => go(h.path, h.label),
        category: 'Recent',
      }))
    : [];

  const allItems = [...historyItems, ...tickerMatches, ...apiResults, ...pageMatches, ...actionMatches];

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setApiResults([]);
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
          {searching ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-500" />
          ) : (
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search companies, entities, pages..."
            className="flex-1 bg-transparent px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
          />
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {allItems.length === 0 && !searching && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              {query.length > 0 ? (
                <>No results for &ldquo;{query}&rdquo;</>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Database className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                  <span>Type to search companies, entities, and pages</span>
                </div>
              )}
            </div>
          )}
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="px-4 py-1 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {category}
                {category === 'Entities' && searching && (
                  <Loader2 className="ml-1.5 inline h-3 w-3 animate-spin" />
                )}
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
                    <span className="flex-1 truncate font-medium">{item.label}</span>
                    {item.description && (
                      <span className="shrink-0 text-xs text-slate-400">{item.description}</span>
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
          {searching && <span className="ml-auto text-violet-400">Searching...</span>}
        </div>
      </div>
    </>
  );
}
