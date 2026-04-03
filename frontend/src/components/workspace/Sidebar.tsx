import { Link, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import {
  Search, Globe, BarChart3, TrendingUp, LineChart, Bitcoin, GitCompareArrows, Bot, Briefcase, Bell, Newspaper, FileBarChart, LayoutGrid, FlaskConical, UserCheck, CalendarDays, Rocket, CircleDollarSign, CandlestickChart, Layers, ArrowLeftRight, Gem,
  Network, LayoutDashboard, FileText, ChevronDown, ChevronRight,
  Moon, Sun, Star, Plus, CreditCard, Zap, X, Activity, Settings, Eye, Flame, PieChart, Calendar, Target, Shield, Banknote, Brain, FolderSearch, CalendarClock, EyeOff, Grid3X3, ArrowDownUp, ThumbsUp, FileSearch, Sparkles, BookOpen, Map, Calculator, SlidersHorizontal, BarChartHorizontal, Building2,
} from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useWatchlist } from '../../hooks/useWatchlist';
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
    label: 'Markets',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
      { to: '/world', label: 'World', icon: <Globe className="h-4 w-4" />, badge: 'LIVE' },
      { to: '/screener', label: 'Screener', icon: <BarChart3 className="h-4 w-4" /> },
      { to: '/heatmap', label: 'Heatmap', icon: <LayoutGrid className="h-4 w-4" /> },
      { to: '/economics', label: 'Economics', icon: <TrendingUp className="h-4 w-4" /> },
      { to: '/crypto', label: 'Crypto', icon: <Bitcoin className="h-4 w-4" /> },
      { to: '/news', label: 'News', icon: <Newspaper className="h-4 w-4" /> },
      { to: '/earnings', label: 'Earnings', icon: <CalendarDays className="h-4 w-4" /> },
      { to: '/insiders', label: 'Insiders', icon: <UserCheck className="h-4 w-4" /> },
      { to: '/ipo', label: 'IPOs', icon: <Rocket className="h-4 w-4" /> },
      { to: '/dividends', label: 'Dividends', icon: <CircleDollarSign className="h-4 w-4" /> },
      { to: '/etf', label: 'ETFs', icon: <Layers className="h-4 w-4" /> },
      { to: '/forex', label: 'Forex', icon: <ArrowLeftRight className="h-4 w-4" /> },
      { to: '/commodities', label: 'Commodities', icon: <Gem className="h-4 w-4" /> },
      { to: '/movers', label: 'Movers', icon: <Flame className="h-4 w-4" />, badge: 'HOT' },
      { to: '/sectors', label: 'Sectors', icon: <PieChart className="h-4 w-4" /> },
      { to: '/options', label: 'Options', icon: <Target className="h-4 w-4" /> },
      { to: '/bonds', label: 'Bonds', icon: <Banknote className="h-4 w-4" /> },
      { to: '/funds', label: 'Funds', icon: <FolderSearch className="h-4 w-4" /> },
      { to: '/dark-pool', label: 'Dark Pool', icon: <EyeOff className="h-4 w-4" /> },
      { to: '/short-interest', label: 'Short Interest', icon: <ArrowDownUp className="h-4 w-4" /> },
      { to: '/trending', label: 'Trending', icon: <Sparkles className="h-4 w-4" />, badge: 'HOT' },
      { to: '/estimates', label: 'Estimates', icon: <BarChartHorizontal className="h-4 w-4" /> },
      { to: '/institutional', label: 'Institutions', icon: <Building2 className="h-4 w-4" /> },
      { to: '/ownership', label: 'Ownership', icon: <UserCheck className="h-4 w-4" /> },
      { to: '/breadth', label: 'Market Breadth', icon: <Activity className="h-4 w-4" /> },
      { to: '/volatility', label: 'Volatility', icon: <Zap className="h-4 w-4" /> },
      { to: '/premarket', label: 'Pre/Post Market', icon: <Moon className="h-4 w-4" /> },
      { to: '/options-flow', label: 'Options Flow', icon: <Zap className="h-4 w-4" />, badge: 'NEW' },
      { to: '/seasonality', label: 'Seasonality', icon: <CalendarDays className="h-4 w-4" /> },
      { to: '/valuation', label: 'Valuation', icon: <CreditCard className="h-4 w-4" /> },
      { to: '/supply-chain', label: 'Supply Chain', icon: <Network className="h-4 w-4" /> },
      { to: '/debt-monitor', label: 'Debt Monitor', icon: <Banknote className="h-4 w-4" /> },
      { to: '/currency-converter', label: 'Currency', icon: <ArrowLeftRight className="h-4 w-4" /> },
      { to: '/margin-calculator', label: 'Margin Calc', icon: <Calculator className="h-4 w-4" /> },
      { to: '/earnings-surprises', label: 'Surprises', icon: <Zap className="h-4 w-4" /> },
      { to: '/insider-sentiment', label: 'Insider Signal', icon: <UserCheck className="h-4 w-4" /> },
      { to: '/market-profile', label: 'Market Profile', icon: <BarChart3 className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/compare', label: 'Compare', icon: <GitCompareArrows className="h-4 w-4" /> },
      { to: '/agents', label: 'AI Agents', icon: <Bot className="h-4 w-4" />, badge: 'NEW' },
      { to: '/backtest', label: 'Backtester', icon: <FlaskConical className="h-4 w-4" /> },
      { to: '/predictions', label: 'Predictions', icon: <LineChart className="h-4 w-4" /> },
      { to: '/portfolio', label: 'Portfolio', icon: <Briefcase className="h-4 w-4" /> },
      { to: '/alerts', label: 'Alerts', icon: <Bell className="h-4 w-4" /> },
      { to: '/technical', label: 'Technicals', icon: <CandlestickChart className="h-4 w-4" /> },
      { to: '/reports', label: 'Reports', icon: <FileBarChart className="h-4 w-4" /> },
      { to: '/watchlist', label: 'Watchlist', icon: <Eye className="h-4 w-4" /> },
      { to: '/calendar', label: 'Calendar', icon: <Calendar className="h-4 w-4" /> },
      { to: '/risk', label: 'Risk', icon: <Shield className="h-4 w-4" /> },
      { to: '/sentiment', label: 'Sentiment', icon: <Brain className="h-4 w-4" /> },
      { to: '/econ-calendar', label: 'Econ Calendar', icon: <CalendarClock className="h-4 w-4" /> },
      { to: '/correlation', label: 'Correlation', icon: <Grid3X3 className="h-4 w-4" /> },
      { to: '/analyst-ratings', label: 'Analysts', icon: <ThumbsUp className="h-4 w-4" /> },
      { to: '/trade-journal', label: 'Trade Journal', icon: <BookOpen className="h-4 w-4" /> },
      { to: '/macro', label: 'Macro', icon: <Map className="h-4 w-4" /> },
      { to: '/position-sizer', label: 'Position Sizer', icon: <Calculator className="h-4 w-4" /> },
      { to: '/screener-builder', label: 'Custom Screener', icon: <SlidersHorizontal className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Data',
    items: [
      { to: '/ontology', label: 'Ontology', icon: <Network className="h-4 w-4" /> },
      { to: '/filings', label: 'SEC Filings', icon: <FileSearch className="h-4 w-4" /> },
      { to: '/docs', label: 'API Docs', icon: <FileText className="h-4 w-4" /> },
    ],
  },
];

export function Sidebar({ collapsed, onToggle, onCommandPalette }: SidebarProps) {
  const location = useLocation();
  const { dark, toggle: toggleDark } = useDarkMode();
  const { tickers: watchlist, addTicker, removeTicker } = useWatchlist();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Markets: true,
    Tools: true,
    Data: true,
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
            to="/settings"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-300"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="text-xs">Settings</span>
          </Link>
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
