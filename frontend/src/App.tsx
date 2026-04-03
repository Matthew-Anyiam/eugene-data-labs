import { useEffect, useState, useCallback, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Bell } from 'lucide-react';
import { Sidebar } from './components/workspace/Sidebar';
import { CommandPalette } from './components/workspace/CommandPalette';
import { ActivityPanel } from './components/workspace/ActivityPanel';
import { FeedbackWidget } from './components/ui/FeedbackWidget';
import { ToastContainer } from './components/workspace/ToastContainer';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAlerts } from './hooks/useAlerts';

const CompanyPage = lazy(() => import('./pages/CompanyPage').then(m => ({ default: m.CompanyPage })));
const ScreenerPage = lazy(() => import('./pages/ScreenerPage').then(m => ({ default: m.ScreenerPage })));
const EconomicsPage = lazy(() => import('./pages/EconomicsPage').then(m => ({ default: m.EconomicsPage })));
const PredictionsPage = lazy(() => import('./pages/PredictionsPage').then(m => ({ default: m.PredictionsPage })));
const OntologyPage = lazy(() => import('./pages/OntologyPage').then(m => ({ default: m.OntologyPage })));
const WorldPage = lazy(() => import('./pages/WorldPage').then(m => ({ default: m.WorldPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const DocsPage = lazy(() => import('./pages/DocsPage').then(m => ({ default: m.DocsPage })));
const PricingPage = lazy(() => import('./pages/PricingPage').then(m => ({ default: m.PricingPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const EntityPage = lazy(() => import('./pages/EntityPage').then(m => ({ default: m.EntityPage })));
const CryptoPage = lazy(() => import('./pages/CryptoPage').then(m => ({ default: m.CryptoPage })));
const ComparePage = lazy(() => import('./pages/ComparePage').then(m => ({ default: m.ComparePage })));
const AgentsPage = lazy(() => import('./pages/AgentsPage').then(m => ({ default: m.AgentsPage })));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage').then(m => ({ default: m.PortfolioPage })));
const AlertsPage = lazy(() => import('./pages/AlertsPage').then(m => ({ default: m.AlertsPage })));
const NewsPage = lazy(() => import('./pages/NewsPage').then(m => ({ default: m.NewsPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const HeatmapPage = lazy(() => import('./pages/HeatmapPage').then(m => ({ default: m.HeatmapPage })));
const BacktestPage = lazy(() => import('./pages/BacktestPage').then(m => ({ default: m.BacktestPage })));
const InsidersPage = lazy(() => import('./pages/InsidersPage').then(m => ({ default: m.InsidersPage })));
const EarningsPage = lazy(() => import('./pages/EarningsPage').then(m => ({ default: m.EarningsPage })));
const IPOPage = lazy(() => import('./pages/IPOPage').then(m => ({ default: m.IPOPage })));
const DividendsPage = lazy(() => import('./pages/DividendsPage').then(m => ({ default: m.DividendsPage })));
const TechnicalPage = lazy(() => import('./pages/TechnicalPage').then(m => ({ default: m.TechnicalPage })));
const ETFPage = lazy(() => import('./pages/ETFPage').then(m => ({ default: m.ETFPage })));
const ForexPage = lazy(() => import('./pages/ForexPage').then(m => ({ default: m.ForexPage })));
const CommoditiesPage = lazy(() => import('./pages/CommoditiesPage').then(m => ({ default: m.CommoditiesPage })));
const WatchlistPage = lazy(() => import('./pages/WatchlistPage').then(m => ({ default: m.WatchlistPage })));
const MoversPage = lazy(() => import('./pages/MoversPage').then(m => ({ default: m.MoversPage })));
const SectorsPage = lazy(() => import('./pages/SectorsPage').then(m => ({ default: m.SectorsPage })));
const CalendarPage = lazy(() => import('./pages/CalendarPage').then(m => ({ default: m.CalendarPage })));
const OptionsPage = lazy(() => import('./pages/OptionsPage').then(m => ({ default: m.OptionsPage })));
const RiskPage = lazy(() => import('./pages/RiskPage').then(m => ({ default: m.RiskPage })));
const BondsPage = lazy(() => import('./pages/BondsPage').then(m => ({ default: m.BondsPage })));
const SentimentPage = lazy(() => import('./pages/SentimentPage').then(m => ({ default: m.SentimentPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));

const PAGE_TITLES: Record<string, string> = {
  '/': 'Eugene Intelligence',
  '/screener': 'Screener — Eugene',
  '/economics': 'Economics — Eugene',
  '/predictions': 'Predictions — Eugene',
  '/ontology': 'Ontology — Eugene',
  '/world': 'World — Eugene',
  '/dashboard': 'Dashboard — Eugene',
  '/docs': 'Docs — Eugene',
  '/pricing': 'Pricing — Eugene',
  '/settings': 'Settings — Eugene',
  '/crypto': 'Crypto — Eugene',
  '/compare': 'Compare — Eugene',
  '/agents': 'AI Agents — Eugene',
  '/portfolio': 'Portfolio — Eugene',
  '/alerts': 'Alerts — Eugene',
  '/news': 'News — Eugene',
  '/reports': 'Reports — Eugene',
  '/heatmap': 'Market Heatmap — Eugene',
  '/backtest': 'Backtester — Eugene',
  '/insiders': 'Insider Trading — Eugene',
  '/earnings': 'Earnings Calendar — Eugene',
  '/ipo': 'IPO Calendar — Eugene',
  '/dividends': 'Dividends — Eugene',
  '/technical': 'Technical Analysis — Eugene',
  '/etf': 'ETF Explorer — Eugene',
  '/forex': 'Forex — Eugene',
  '/commodities': 'Commodities — Eugene',
  '/watchlist': 'Watchlist — Eugene',
  '/movers': 'Market Movers — Eugene',
  '/sectors': 'Sector Analysis — Eugene',
  '/calendar': 'Market Calendar — Eugene',
  '/options': 'Options Chain — Eugene',
  '/risk': 'Risk Analytics — Eugene',
  '/bonds': 'Bonds — Eugene',
  '/sentiment': 'Sentiment — Eugene',
};

function TitleUpdater() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname.startsWith('/company/')) {
      const ticker = pathname.split('/')[2]?.toUpperCase();
      document.title = ticker ? `${ticker} — Eugene` : 'Company — Eugene';
    } else if (pathname.startsWith('/entity/')) {
      document.title = 'Entity — Eugene';
    } else {
      document.title = PAGE_TITLES[pathname] ?? 'Eugene Intelligence';
    }
  }, [pathname]);

  return null;
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 dark:border-slate-600 dark:border-t-white" />
    </div>
  );
}

function WorkspaceLayout() {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('eugene_sidebar') === 'collapsed';
    } catch {
      return false;
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(() => {
    try {
      return localStorage.getItem('eugene_activity') === 'open';
    } catch {
      return false;
    }
  });

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('eugene_sidebar', next ? 'collapsed' : 'expanded');
      return next;
    });
  }, []);

  const openCommand = useCallback(() => setCommandOpen(true), []);
  const closeCommand = useCallback(() => setCommandOpen(false), []);

  const toggleActivity = useCallback(() => {
    setActivityOpen((prev) => {
      const next = !prev;
      localStorage.setItem('eugene_activity', next ? 'open' : 'closed');
      return next;
    });
  }, []);

  // Power-user keyboard shortcuts (g+d, g+w, etc.)
  useKeyboardShortcuts();

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault();
        setActivityOpen((prev) => {
          const next = !prev;
          localStorage.setItem('eugene_activity', next ? 'open' : 'closed');
          return next;
        });
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-slate-950">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
          onCommandPalette={openCommand}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <Sidebar
              collapsed={false}
              onToggle={() => setMobileMenuOpen(false)}
              onCommandPalette={() => { openCommand(); setMobileMenuOpen(false); }}
            />
          </div>
        </>
      )}

      <main className="flex-1 overflow-y-auto">
        <PageHeader
          onToggleActivity={toggleActivity}
          activityOpen={activityOpen}
          onMobileMenu={() => setMobileMenuOpen(true)}
        />

        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<DashboardRedirect />} />
              <Route path="/company/:ticker" element={<CompanyPage />} />
              <Route path="/entity/:entityId" element={<EntityPage />} />
              <Route path="/screener" element={<ScreenerPage />} />
              <Route path="/economics" element={<EconomicsPage />} />
              <Route path="/predictions" element={<PredictionsPage />} />
              <Route path="/ontology" element={<OntologyPage />} />
              <Route path="/world" element={<WorldPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/docs" element={<DocsPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/crypto" element={<CryptoPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/news" element={<NewsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/heatmap" element={<HeatmapPage />} />
              <Route path="/backtest" element={<BacktestPage />} />
              <Route path="/insiders" element={<InsidersPage />} />
              <Route path="/earnings" element={<EarningsPage />} />
              <Route path="/ipo" element={<IPOPage />} />
              <Route path="/dividends" element={<DividendsPage />} />
              <Route path="/technical" element={<TechnicalPage />} />
              <Route path="/etf" element={<ETFPage />} />
              <Route path="/forex" element={<ForexPage />} />
              <Route path="/commodities" element={<CommoditiesPage />} />
              <Route path="/watchlist" element={<WatchlistPage />} />
              <Route path="/movers" element={<MoversPage />} />
              <Route path="/sectors" element={<SectorsPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/options" element={<OptionsPage />} />
              <Route path="/risk" element={<RiskPage />} />
              <Route path="/bonds" element={<BondsPage />} />
              <Route path="/sentiment" element={<SentimentPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </div>
      </main>

      {/* Activity panel — hidden on mobile */}
      <div className="hidden lg:block">
        <ActivityPanel open={activityOpen} onClose={toggleActivity} />
      </div>

      <CommandPalette open={commandOpen} onClose={closeCommand} />
      <ToastContainer />
      <FeedbackWidget />
    </div>
  );
}

function DashboardRedirect() {
  const DashboardPageLazy = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <DashboardPageLazy />
    </Suspense>
  );
}

function PageHeader({
  onToggleActivity,
  activityOpen,
  onMobileMenu,
}: {
  onToggleActivity: () => void;
  activityOpen: boolean;
  onMobileMenu: () => void;
}) {
  const { pathname } = useLocation();

  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) parts.push('dashboard');

  const labels: Record<string, string> = {
    company: 'Company',
    entity: 'Entity',
    screener: 'Screener',
    economics: 'Economics',
    predictions: 'Predictions',
    ontology: 'Ontology',
    world: 'World Intelligence',
    dashboard: 'Dashboard',
    docs: 'Documentation',
    pricing: 'Pricing',
    settings: 'Settings',
    crypto: 'Crypto Markets',
    compare: 'Compare Companies',
    agents: 'AI Agents',
    portfolio: 'Portfolio',
    alerts: 'Alerts',
    news: 'News Feed',
    reports: 'Reports',
    heatmap: 'Market Heatmap',
    backtest: 'Strategy Backtester',
    insiders: 'Insider Trading',
    earnings: 'Earnings Calendar',
    ipo: 'IPO Calendar',
    dividends: 'Dividends',
    technical: 'Technical Analysis',
    etf: 'ETF Explorer',
    forex: 'Forex Markets',
    commodities: 'Commodities',
    watchlist: 'Watchlist Manager',
    movers: 'Market Movers',
    sectors: 'Sector Analysis',
    calendar: 'Market Calendar',
    options: 'Options Chain',
    risk: 'Risk Analytics',
    bonds: 'Bonds & Fixed Income',
    sentiment: 'Market Sentiment',
  };

  return (
    <div className="flex h-10 items-center justify-between border-b border-slate-100 px-4 sm:px-6 dark:border-slate-800/50">
      <div className="flex items-center gap-2">
        {/* Mobile hamburger */}
        <button
          onClick={onMobileMenu}
          className="rounded p-1 text-slate-400 hover:text-slate-600 md:hidden dark:hover:text-slate-300"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          {parts.map((part, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-slate-300 dark:text-slate-600">/</span>}
              <span className={i === parts.length - 1 ? 'text-slate-600 dark:text-slate-300' : ''}>
                {labels[part] || part.toUpperCase()}
              </span>
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <button
          onClick={onToggleActivity}
          className={`hidden rounded-md px-2 py-1 text-[11px] font-medium transition-colors lg:block ${
            activityOpen
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300'
          }`}
          title="Toggle activity panel (Cmd+.)"
        >
          Activity
        </button>
        <kbd className="hidden text-[10px] text-slate-300 dark:text-slate-600 lg:inline">
          {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}.
        </kbd>
      </div>
    </div>
  );
}

function NotificationBell() {
  const { unreadCount } = useAlerts();
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate('/alerts')}
      className="relative rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
      title={unreadCount > 0 ? `${unreadCount} unread alert${unreadCount !== 1 ? 's' : ''}` : 'Alerts'}
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <TitleUpdater />
      <WorkspaceLayout />
    </BrowserRouter>
  );
}
