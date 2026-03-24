import { Link, useLocation } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { SearchInput } from '../ui/SearchInput';
import { LogoFull } from '../ui/Logo';
import { cn } from '../../lib/utils';

const NAV_LINKS = [
  { to: '/screener', label: 'Screener' },
  { to: '/economics', label: 'Economics' },
];

export function Header() {
  const { dark, toggle } = useDarkMode();
  const location = useLocation();

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
        </div>
      </div>
    </header>
  );
}
