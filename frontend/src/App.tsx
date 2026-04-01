import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { BetaBanner } from './components/landing/Hero';
import { LandingPage } from './pages/LandingPage';
import { CompanyPage } from './pages/CompanyPage';
import { ScreenerPage } from './pages/ScreenerPage';
import { EconomicsPage } from './pages/EconomicsPage';
import { PredictionsPage } from './pages/PredictionsPage';
import { OntologyPage } from './pages/OntologyPage';
import { WorldPage } from './pages/WorldPage';
import { DocsPage } from './pages/DocsPage';
import { PricingPage } from './pages/PricingPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { FeedbackWidget } from './components/ui/FeedbackWidget';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Eugene Intelligence',
  '/screener': 'Screener — Eugene Intelligence',
  '/economics': 'Economics — Eugene Intelligence',
  '/predictions': 'Predictions — Eugene Intelligence',
  '/ontology': 'Ontology — Eugene Intelligence',
  '/world': 'World Intelligence — Eugene Intelligence',
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
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/company/:ticker" element={<CompanyPage />} />
            <Route path="/screener" element={<ScreenerPage />} />
            <Route path="/economics" element={<EconomicsPage />} />
            <Route path="/predictions" element={<PredictionsPage />} />
            <Route path="/ontology" element={<OntologyPage />} />
            <Route path="/world" element={<WorldPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <Footer />
        <FeedbackWidget />
      </div>
    </BrowserRouter>
  );
}
