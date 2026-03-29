import { Link } from 'react-router-dom';

type FooterLink = { label: string; to?: string; href?: string };

const footerLinks: Record<string, FooterLink[]> = {
  Product: [
    { label: 'REST API', to: '/docs' },
    { label: 'MCP Server', to: '/docs' },
    { label: 'CLI', to: '/docs' },
    { label: 'Pricing', to: '/pricing' },
  ],
  Data: [
    { label: 'Company Explorer', to: '/company/AAPL' },
    { label: 'Stock Screener', to: '/screener' },
    { label: 'Economics', to: '/economics' },
  ],
  Resources: [
    { label: 'Documentation', to: '/docs' },
    { label: 'PyPI Package', href: 'https://pypi.org/project/eugene-intelligence/' },
    { label: 'GitHub', href: 'https://github.com/Matthew-Anyiam/eugene-data-labs' },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <p className="font-semibold">Eugene Intelligence</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Financial data infrastructure for AI agents and analysts.
            </p>
            <a
              href="mailto:info@eugeneintelligence.com"
              className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              info@eugeneintelligence.com
            </a>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <p className="text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {heading}
              </p>
              <ul className="mt-3 space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    {'to' in link && link.to ? (
                      <Link
                        to={link.to}
                        className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6 dark:border-slate-800">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Data from SEC EDGAR and FRED. Not investment advice. &copy; {new Date().getFullYear()} Eugene Intelligence.
          </p>
        </div>
      </div>
    </footer>
  );
}
