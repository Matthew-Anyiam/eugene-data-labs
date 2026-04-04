import { useEffect, useState, useCallback, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Link, Outlet } from 'react-router-dom';
import { Menu, Bell } from 'lucide-react';
import { Sidebar } from './components/workspace/Sidebar';
import { CommandPalette } from './components/workspace/CommandPalette';
import { ActivityPanel } from './components/workspace/ActivityPanel';
import { ShortcutsHelp } from './components/workspace/ShortcutsHelp';
import { Onboarding } from './components/workspace/Onboarding';
import { FeedbackWidget } from './components/ui/FeedbackWidget';
import { LiveTicker } from './components/workspace/LiveTicker';
import { LoadingBar } from './components/ui/LoadingBar';
import { ToastContainer } from './components/workspace/ToastContainer';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { PageErrorBoundary } from './components/ui/PageErrorBoundary';
import { SkeletonPage } from './components/ui/Skeleton';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAlerts } from './hooks/useAlerts';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

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
const FundsPage = lazy(() => import('./pages/FundsPage').then(m => ({ default: m.FundsPage })));
const EconCalendarPage = lazy(() => import('./pages/EconCalendarPage').then(m => ({ default: m.EconCalendarPage })));
const DarkPoolPage = lazy(() => import('./pages/DarkPoolPage').then(m => ({ default: m.DarkPoolPage })));
const CorrelationPage = lazy(() => import('./pages/CorrelationPage').then(m => ({ default: m.CorrelationPage })));
const ShortInterestPage = lazy(() => import('./pages/ShortInterestPage').then(m => ({ default: m.ShortInterestPage })));
const AnalystRatingsPage = lazy(() => import('./pages/AnalystRatingsPage').then(m => ({ default: m.AnalystRatingsPage })));
const FilingsPage = lazy(() => import('./pages/FilingsPage').then(m => ({ default: m.FilingsPage })));
const TrendingPage = lazy(() => import('./pages/TrendingPage').then(m => ({ default: m.TrendingPage })));
const TradeJournalPage = lazy(() => import('./pages/TradeJournalPage').then(m => ({ default: m.TradeJournalPage })));
const MacroPage = lazy(() => import('./pages/MacroPage').then(m => ({ default: m.MacroPage })));
const PositionSizerPage = lazy(() => import('./pages/PositionSizerPage').then(m => ({ default: m.PositionSizerPage })));
const ScreenerBuilderPage = lazy(() => import('./pages/ScreenerBuilderPage').then(m => ({ default: m.ScreenerBuilderPage })));
const EstimatesPage = lazy(() => import('./pages/EstimatesPage').then(m => ({ default: m.EstimatesPage })));
const InstitutionalPage = lazy(() => import('./pages/InstitutionalPage').then(m => ({ default: m.InstitutionalPage })));
const OwnershipPage = lazy(() => import('./pages/OwnershipPage').then(m => ({ default: m.OwnershipPage })));
const BreadthPage = lazy(() => import('./pages/BreadthPage').then(m => ({ default: m.BreadthPage })));
const VolatilityPage = lazy(() => import('./pages/VolatilityPage').then(m => ({ default: m.VolatilityPage })));
const PremarketPage = lazy(() => import('./pages/PremarketPage').then(m => ({ default: m.PremarketPage })));
const OptionsFlowPage = lazy(() => import('./pages/OptionsFlowPage').then(m => ({ default: m.OptionsFlowPage })));
const SeasonalityPage = lazy(() => import('./pages/SeasonalityPage').then(m => ({ default: m.SeasonalityPage })));
const ValuationPage = lazy(() => import('./pages/ValuationPage').then(m => ({ default: m.ValuationPage })));
const SupplyChainPage = lazy(() => import('./pages/SupplyChainPage').then(m => ({ default: m.SupplyChainPage })));
const DebtMonitorPage = lazy(() => import('./pages/DebtMonitorPage').then(m => ({ default: m.DebtMonitorPage })));
const CurrencyConverterPage = lazy(() => import('./pages/CurrencyConverterPage').then(m => ({ default: m.CurrencyConverterPage })));
const MarginCalculatorPage = lazy(() => import('./pages/MarginCalculatorPage').then(m => ({ default: m.MarginCalculatorPage })));
const EarningsSurprisesPage = lazy(() => import('./pages/EarningsSurprisesPage').then(m => ({ default: m.EarningsSurprisesPage })));
const InsiderSentimentPage = lazy(() => import('./pages/InsiderSentimentPage').then(m => ({ default: m.InsiderSentimentPage })));
const MarketProfilePage = lazy(() => import('./pages/MarketProfilePage').then(m => ({ default: m.MarketProfilePage })));
const PeerAnalysisPage = lazy(() => import('./pages/PeerAnalysisPage').then(m => ({ default: m.PeerAnalysisPage })));
const DividendTrackerPage = lazy(() => import('./pages/DividendTrackerPage').then(m => ({ default: m.DividendTrackerPage })));
const RevenueSegmentsPage = lazy(() => import('./pages/RevenueSegmentsPage').then(m => ({ default: m.RevenueSegmentsPage })));
const EarningsCalendarProPage = lazy(() => import('./pages/EarningsCalendarProPage').then(m => ({ default: m.EarningsCalendarProPage })));
const FundFlowsPage = lazy(() => import('./pages/FundFlowsPage').then(m => ({ default: m.FundFlowsPage })));
const SocialSentimentPage = lazy(() => import('./pages/SocialSentimentPage').then(m => ({ default: m.SocialSentimentPage })));
const FactorExposurePage = lazy(() => import('./pages/FactorExposurePage').then(m => ({ default: m.FactorExposurePage })));
const EarningsTranscriptPage = lazy(() => import('./pages/EarningsTranscriptPage').then(m => ({ default: m.EarningsTranscriptPage })));
const IPOAnalysisPage = lazy(() => import('./pages/IPOAnalysisPage').then(m => ({ default: m.IPOAnalysisPage })));
const RelativeStrengthPage = lazy(() => import('./pages/RelativeStrengthPage').then(m => ({ default: m.RelativeStrengthPage })));
const InsiderTrackerPage = lazy(() => import('./pages/InsiderTrackerPage').then(m => ({ default: m.InsiderTrackerPage })));
const SectorRotationPage = lazy(() => import('./pages/SectorRotationPage').then(m => ({ default: m.SectorRotationPage })));
const YieldCurvePage = lazy(() => import('./pages/YieldCurvePage').then(m => ({ default: m.YieldCurvePage })));
const GapScannerPage = lazy(() => import('./pages/GapScannerPage').then(m => ({ default: m.GapScannerPage })));
const MoneyFlowPage = lazy(() => import('./pages/MoneyFlowPage').then(m => ({ default: m.MoneyFlowPage })));
const EarningsRevisionsPage = lazy(() => import('./pages/EarningsRevisionsPage').then(m => ({ default: m.EarningsRevisionsPage })));
const MarketRegimePage = lazy(() => import('./pages/MarketRegimePage').then(m => ({ default: m.MarketRegimePage })));
const TaxLotPage = lazy(() => import('./pages/TaxLotPage').then(m => ({ default: m.TaxLotPage })));
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('./pages/SignupPage').then(m => ({ default: m.SignupPage })));
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
  '/funds': 'Fund Screener — Eugene',
  '/econ-calendar': 'Economic Calendar — Eugene',
  '/dark-pool': 'Dark Pool — Eugene',
  '/correlation': 'Correlation Matrix — Eugene',
  '/short-interest': 'Short Interest — Eugene',
  '/analyst-ratings': 'Analyst Ratings — Eugene',
  '/filings': 'SEC Filings — Eugene',
  '/trending': 'Trending Stocks — Eugene',
  '/trade-journal': 'Trade Journal — Eugene',
  '/macro': 'Macro Dashboard — Eugene',
  '/position-sizer': 'Position Sizer — Eugene',
  '/screener-builder': 'Screener Builder — Eugene',
  '/estimates': 'Earnings Estimates — Eugene',
  '/institutional': 'Institutional Holdings — Eugene',
  '/ownership': 'Ownership Structure — Eugene',
  '/breadth': 'Market Breadth — Eugene',
  '/volatility': 'Volatility — Eugene',
  '/premarket': 'Pre/Post Market — Eugene',
  '/options-flow': 'Options Flow — Eugene',
  '/seasonality': 'Seasonality — Eugene',
  '/valuation': 'Valuation — Eugene',
  '/supply-chain': 'Supply Chain — Eugene',
  '/debt-monitor': 'Debt Monitor — Eugene',
  '/currency-converter': 'Currency Converter — Eugene',
  '/margin-calculator': 'Margin Calculator — Eugene',
  '/earnings-surprises': 'Earnings Surprises — Eugene',
  '/insider-sentiment': 'Insider Sentiment — Eugene',
  '/market-profile': 'Market Profile — Eugene',
  '/peer-analysis': 'Peer Analysis — Eugene',
  '/dividend-tracker': 'Dividend Tracker — Eugene',
  '/revenue-segments': 'Revenue Segments — Eugene',
  '/earnings-pro': 'Earnings Calendar Pro — Eugene',
  '/fund-flows': 'Fund Flows — Eugene',
  '/social-sentiment': 'Social Sentiment — Eugene',
  '/factor-exposure': 'Factor Exposure — Eugene',
  '/earnings-transcript': 'Earnings Transcripts — Eugene',
  '/ipo-analysis': 'IPO Analysis — Eugene',
  '/relative-strength': 'Relative Strength — Eugene',
  '/insider-tracker': 'Insider Tracker — Eugene',
  '/sector-rotation': 'Sector Rotation — Eugene',
  '/yield-curve': 'Yield Curve — Eugene',
  '/gap-scanner': 'Gap Scanner — Eugene',
  '/money-flow': 'Money Flow — Eugene',
  '/earnings-revisions': 'Earnings Revisions — Eugene',
  '/market-regime': 'Market Regime — Eugene',
  '/tax-lots': 'Tax Lot Optimizer — Eugene',
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

const RECENT_TICKERS_KEY = 'eugene_recent_tickers';
const MAX_RECENT_TICKERS = 5;

function getRecentTickers(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_TICKERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* noop */ }
  return [];
}

function addRecentTicker(ticker: string): void {
  try {
    const current = getRecentTickers().filter((t) => t !== ticker);
    current.unshift(ticker);
    localStorage.setItem(RECENT_TICKERS_KEY, JSON.stringify(current.slice(0, MAX_RECENT_TICKERS)));
  } catch { /* noop */ }
}

function RecentTickerTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname.startsWith('/company/')) {
      const ticker = pathname.split('/')[2]?.toUpperCase();
      if (ticker) addRecentTicker(ticker);
    }
  }, [pathname]);

  return null;
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
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
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

  // Listen for shortcuts help event from useKeyboardShortcuts
  useEffect(() => {
    function handleShowShortcuts() {
      setShortcutsOpen(true);
    }
    window.addEventListener('eugene:show-shortcuts', handleShowShortcuts);
    return () => window.removeEventListener('eugene:show-shortcuts', handleShowShortcuts);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-slate-950">
      <LoadingBar />
      <RecentTickerTracker />
      <Onboarding onComplete={() => {}} />

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

      {/* Touch-friendly swipe gesture area on left edge (mobile only) */}
      {!mobileMenuOpen && (
        <div
          className="fixed inset-y-0 left-0 z-30 w-3 md:hidden"
          onTouchStart={() => setMobileMenuOpen(true)}
          aria-hidden="true"
        />
      )}

      <main className="flex-1 overflow-y-auto">
        <LiveTicker />
        <PageHeader
          onToggleActivity={toggleActivity}
          activityOpen={activityOpen}
          onMobileMenu={() => setMobileMenuOpen(true)}
        />

        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
          <PageErrorBoundary>
            <Suspense fallback={<SkeletonPage />}>
              <Outlet />
            </Suspense>
          </PageErrorBoundary>
        </div>
      </main>

      {/* Activity panel — hidden on mobile */}
      <div className="hidden lg:block">
        <ActivityPanel open={activityOpen} onClose={toggleActivity} />
      </div>

      <CommandPalette open={commandOpen} onClose={closeCommand} />
      <ShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <ToastContainer />
      <FeedbackWidget />
    </div>
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
  const [recentTickers, setRecentTickers] = useState<string[]>(getRecentTickers);

  // Refresh recents on route change
  useEffect(() => {
    setRecentTickers(getRecentTickers());
  }, [pathname]);

  const isCompanyPage = pathname.startsWith('/company/');

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
    funds: 'Fund Screener',
    'econ-calendar': 'Economic Calendar',
    'dark-pool': 'Dark Pool Activity',
    correlation: 'Correlation Matrix',
    'short-interest': 'Short Interest',
    'analyst-ratings': 'Analyst Ratings',
    filings: 'SEC Filings',
    trending: 'Trending Stocks',
    'trade-journal': 'Trade Journal',
    macro: 'Macro Dashboard',
    'position-sizer': 'Position Sizer',
    'screener-builder': 'Screener Builder',
    estimates: 'Earnings Estimates',
    institutional: 'Institutional Holdings',
    ownership: 'Ownership Structure',
    breadth: 'Market Breadth',
    volatility: 'Volatility',
    premarket: 'Pre/Post Market',
    'options-flow': 'Options Flow',
    seasonality: 'Seasonality',
    valuation: 'Valuation',
    'supply-chain': 'Supply Chain',
    'debt-monitor': 'Debt Monitor',
    'currency-converter': 'Currency Converter',
    'margin-calculator': 'Margin Calculator',
    'earnings-surprises': 'Earnings Surprises',
    'insider-sentiment': 'Insider Sentiment',
    'market-profile': 'Market Profile',
    'peer-analysis': 'Peer Analysis',
    'dividend-tracker': 'Dividend Tracker',
    'revenue-segments': 'Revenue Segments',
    'earnings-pro': 'Earnings Calendar Pro',
    'fund-flows': 'Fund Flows',
    'social-sentiment': 'Social Sentiment',
    'factor-exposure': 'Factor Exposure',
    'earnings-transcript': 'Earnings Transcripts',
    'ipo-analysis': 'IPO Analysis',
    'relative-strength': 'Relative Strength',
    'insider-tracker': 'Insider Tracker',
    'sector-rotation': 'Sector Rotation',
    'yield-curve': 'Yield Curve',
    'gap-scanner': 'Gap Scanner',
    'money-flow': 'Money Flow',
    'earnings-revisions': 'Earnings Revisions',
    'market-regime': 'Market Regime',
    'tax-lots': 'Tax Lot Optimizer',
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

        {/* Recent tickers pills — shown on non-company pages */}
        {!isCompanyPage && recentTickers.length > 0 && (
          <div className="ml-3 hidden items-center gap-1 border-l border-slate-200 pl-3 dark:border-slate-700/50 sm:flex">
            {recentTickers.slice(0, 5).map((ticker) => (
              <Link
                key={ticker}
                to={`/company/${ticker}`}
                className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 transition-colors hover:bg-indigo-100 hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400"
              >
                {ticker}
              </Link>
            ))}
          </div>
        )}
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
    <AuthProvider>
      <ErrorBoundary>
      <BrowserRouter>
        <TitleUpdater />
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            {/* Public routes — outside workspace layout */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* Protected workspace routes */}
            <Route element={<ProtectedRoute><WorkspaceLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/company/:ticker" element={<CompanyPage />} />
            <Route path="/entity/:entityId" element={<EntityPage />} />
            <Route path="/screener" element={<ScreenerPage />} />
            <Route path="/economics" element={<EconomicsPage />} />
            <Route path="/predictions" element={<PredictionsPage />} />
            <Route path="/ontology" element={<OntologyPage />} />
            <Route path="/world" element={<WorldPage />} />
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
            <Route path="/funds" element={<FundsPage />} />
            <Route path="/econ-calendar" element={<EconCalendarPage />} />
            <Route path="/dark-pool" element={<DarkPoolPage />} />
            <Route path="/correlation" element={<CorrelationPage />} />
            <Route path="/short-interest" element={<ShortInterestPage />} />
            <Route path="/analyst-ratings" element={<AnalystRatingsPage />} />
            <Route path="/filings" element={<FilingsPage />} />
            <Route path="/trending" element={<TrendingPage />} />
            <Route path="/trade-journal" element={<TradeJournalPage />} />
            <Route path="/macro" element={<MacroPage />} />
            <Route path="/position-sizer" element={<PositionSizerPage />} />
            <Route path="/screener-builder" element={<ScreenerBuilderPage />} />
            <Route path="/estimates" element={<EstimatesPage />} />
            <Route path="/institutional" element={<InstitutionalPage />} />
            <Route path="/ownership" element={<OwnershipPage />} />
            <Route path="/breadth" element={<BreadthPage />} />
            <Route path="/volatility" element={<VolatilityPage />} />
            <Route path="/premarket" element={<PremarketPage />} />
            <Route path="/options-flow" element={<OptionsFlowPage />} />
            <Route path="/seasonality" element={<SeasonalityPage />} />
            <Route path="/valuation" element={<ValuationPage />} />
            <Route path="/supply-chain" element={<SupplyChainPage />} />
            <Route path="/debt-monitor" element={<DebtMonitorPage />} />
            <Route path="/currency-converter" element={<CurrencyConverterPage />} />
            <Route path="/margin-calculator" element={<MarginCalculatorPage />} />
            <Route path="/earnings-surprises" element={<EarningsSurprisesPage />} />
            <Route path="/insider-sentiment" element={<InsiderSentimentPage />} />
            <Route path="/market-profile" element={<MarketProfilePage />} />
            <Route path="/peer-analysis" element={<PeerAnalysisPage />} />
            <Route path="/dividend-tracker" element={<DividendTrackerPage />} />
            <Route path="/revenue-segments" element={<RevenueSegmentsPage />} />
            <Route path="/earnings-pro" element={<EarningsCalendarProPage />} />
            <Route path="/fund-flows" element={<FundFlowsPage />} />
            <Route path="/social-sentiment" element={<SocialSentimentPage />} />
            <Route path="/factor-exposure" element={<FactorExposurePage />} />
            <Route path="/earnings-transcript" element={<EarningsTranscriptPage />} />
            <Route path="/ipo-analysis" element={<IPOAnalysisPage />} />
            <Route path="/relative-strength" element={<RelativeStrengthPage />} />
            <Route path="/insider-tracker" element={<InsiderTrackerPage />} />
            <Route path="/sector-rotation" element={<SectorRotationPage />} />
            <Route path="/yield-curve" element={<YieldCurvePage />} />
            <Route path="/gap-scanner" element={<GapScannerPage />} />
            <Route path="/money-flow" element={<MoneyFlowPage />} />
            <Route path="/earnings-revisions" element={<EarningsRevisionsPage />} />
            <Route path="/market-regime" element={<MarketRegimePage />} />
            <Route path="/tax-lots" element={<TaxLotPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
      </BrowserRouter>
      </ErrorBoundary>
    </AuthProvider>
  );
}
