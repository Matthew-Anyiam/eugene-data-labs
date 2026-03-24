import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { LandingPage } from './pages/LandingPage';
import { CompanyPage } from './pages/CompanyPage';
import { ScreenerPage } from './pages/ScreenerPage';
import { EconomicsPage } from './pages/EconomicsPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/company/:ticker" element={<CompanyPage />} />
            <Route path="/screener" element={<ScreenerPage />} />
            <Route path="/economics" element={<EconomicsPage />} />
            <Route path="*" element={
              <div className="flex h-96 items-center justify-center">
                <p className="text-lg text-slate-500">Page not found</p>
              </div>
            } />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
