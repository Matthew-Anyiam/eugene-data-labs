import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { BetaBanner } from './components/landing/Hero';
import { LandingPage } from './pages/LandingPage';
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
  '/screener': 'Screener — Eugene Intelligence',
  '/economics': 'Economics — Eugene Intelligence',
  '/predictions': 'Predictions — Eugene Intelligence',
  '/ontology': 'Ontology — Eugene Intelligence',
  '/world': 'World Intelligence — Eugene Intelligence',
  '/dashboard': 'Dashboard — Eugene Intelligence',
  '/docs': 'Documentation — Eugene Intelligence',
  '/pricing': 'Pricing — Eugene Intelligence',
};

function TitleUpdater() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname.startsWith('/company/')) {
      const ticker = pathname.split('/')[2]?.toUpperCase();
      document.title = ticker
        ? `${ticker} — Eugene Intelligence`
        : 'Company — Eugene Intelligence';
    } else {
      document.title = PAGE_TITLES[pathname] ?? 'Eugene Intelligence';
    }
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <TitleUpdater />
      <div className="flex min-h-screen flex-col">
        <BetaBanner />
        <Header />
        <main className="flex-1">
          <Suspense fallback={<div className="flex items-center justify-center py-32"><div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 dark:border-slate-600 dark:border-t-white" /></div>}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
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
        </main>
        <Footer />
        <FeedbackWidget />
      </div>
    </BrowserRouter>
  );
}
