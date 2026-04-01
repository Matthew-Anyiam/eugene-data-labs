import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Moon, Sun, Menu, X } from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { SearchInput } from '../ui/SearchInput';
import { LogoFull } from '../ui/Logo';
import { cn } from '../../lib/utils';

const NAV_LINKS = [
  { to: '/screener', label: 'Screener' },
  { to: '/economics', label: 'Economics' },
  { to: '/predictions', label: 'Predictions' },
  { to: '/world', label: 'World Intel' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/docs', label: 'Docs' },
  { to: '/pricing', label: 'Pricing' },
];

export function Header() {
  const { dark, toggle } = useDarkMode();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4 sm:px-6">
        <Link to="/" className="shrink-0">
          <LogoFull />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                'px-3 py-1.5 text-sm transition-colors',
                location.pathname === link.to
                  ? 'font-medium text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SearchInput className="hidden w-56 sm:block" />
          <button
            onClick={toggle}
            className="rounded-md p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-md p-1.5 text-slate-400 hover:text-slate-600 md:hidden dark:hover:text-slate-300"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-slate-200 px-4 pb-4 pt-2 md:hidden dark:border-slate-800">
          <div className="mb-3">
            <SearchInput className="w-full" />
          </div>
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'rounded-md px-3 py-2 text-sm transition-colors',
                  location.pathname === link.to
                    ? 'bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-white'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
