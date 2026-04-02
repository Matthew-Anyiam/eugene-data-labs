import { useEffect, useState, useCallback, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Sidebar } from './components/workspace/Sidebar';
import { CommandPalette } from './components/workspace/CommandPalette';
import { ActivityPanel } from './components/workspace/ActivityPanel';
import { FeedbackWidget } from './components/ui/FeedbackWidget';

const CompanyPage = lazy(() => import('./pages/CompanyPage').then(m => ({ default: m.CompanyPage })));
const ScreenerPage = lazy(() => import('./pages/ScreenerPage').then(m => ({ default: m.ScreenerPage })));
const EconomicsPage = lazy(() => import('./pages/EconomicsPage').then(m => ({ default: m.EconomicsPage })));
const PredictionsPage = lazy(() => import('./pages/PredictionsPage').then(m => ({ default: m.PredictionsPage })));
const OntologyPage = lazy(() => import('./pages/OntologyPage').then(m => ({ default: m.OntologyPage })));
const WorldPage = lazy(() => import('./pages/WorldPage').then(m => ({ default: m.WorldPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const DocsPage = lazy(() => import('./pages/DocsPage').then(m => ({ default: m.DocsPage })));
const PricingPage = lazy(() => import('./pages/PricingPage').then(m => ({ default: m.PricingPage })));
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
};

function TitleUpdater() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname.startsWith('/company/')) {
      const ticker = pathname.split('/')[2]?.toUpperCase();
      document.title = ticker
        ? `${ticker} — Eugene`
        : 'Company — Eugene';
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('eugene_sidebar') === 'collapsed';
    } catch {
      return false;
    }
  });
  const [commandOpen, setCommandOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(() => {
    try {
      return localStorage.getItem('eugene_activity') === 'open';
    } catch {
      return false;
    }
  });

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

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K / Ctrl+K — command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
      // Cmd+. / Ctrl+. — activity panel
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
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        onCommandPalette={openCommand}
      />

      <main className="flex-1 overflow-y-auto">
        {/* Page breadcrumb bar */}
        <PageHeader onToggleActivity={toggleActivity} activityOpen={activityOpen} />

        <div className="mx-auto max-w-6xl px-6 py-6">
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<DashboardRedirect />} />
              <Route path="/company/:ticker" element={<CompanyPage />} />
              <Route path="/screener" element={<ScreenerPage />} />
              <Route path="/economics" element={<EconomicsPage />} />
              <Route path="/predictions" element={<PredictionsPage />} />
              <Route path="/ontology" element={<OntologyPage />} />
              <Route path="/world" element={<WorldPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/docs" element={<DocsPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </div>
      </main>

      <ActivityPanel open={activityOpen} onClose={toggleActivity} />
      <CommandPalette open={commandOpen} onClose={closeCommand} />
      <FeedbackWidget />
    </div>
  );
}

/** Redirect / to /dashboard — no more landing page in app mode */
function DashboardRedirect() {
  const DashboardPageLazy = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <DashboardPageLazy />
    </Suspense>
  );
}

/** Minimal breadcrumb bar at top of content area */
function PageHeader({ onToggleActivity, activityOpen }: { onToggleActivity: () => void; activityOpen: boolean }) {
  const { pathname } = useLocation();

  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) parts.push('dashboard');

  const labels: Record<string, string> = {
    company: 'Company',
    screener: 'Screener',
    economics: 'Economics',
    predictions: 'Predictions',
    ontology: 'Ontology',
    world: 'World Intelligence',
    dashboard: 'Dashboard',
    docs: 'Documentation',
    pricing: 'Pricing',
  };

  return (
    <div className="flex h-10 items-center justify-between border-b border-slate-100 px-6 dark:border-slate-800/50">
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
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleActivity}
          className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
            activityOpen
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300'
          }`}
          title="Toggle activity panel (Cmd+.)"
        >
          Activity
        </button>
        <kbd className="hidden text-[10px] text-slate-300 dark:text-slate-600 sm:inline">
          {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}.
        </kbd>
      </div>
    </div>
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
