import { SearchInput } from '../ui/SearchInput';
import { Link } from 'react-router-dom';

export function Hero() {
  return (
    <section className="px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
          SEC &middot; XBRL &middot; FRED
        </p>

        <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
          Look up any public company. Get the filings, financials, and context — fast.
        </h1>

        <p className="mt-5 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
          Eugene pulls directly from SEC EDGAR, normalizes XBRL data, and gives you
          clean financial statements, insider trades, institutional holdings, and more.
          Every number links back to its source filing.
        </p>

        <div className="mt-8 max-w-md">
          <SearchInput large />
        </div>

        <div className="mt-12 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 dark:border-slate-800 dark:bg-slate-800">
          {[
            { label: 'Extract types', value: '17' },
            { label: 'XBRL concepts', value: '36' },
            { label: 'FRED categories', value: '9' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white px-5 py-4 dark:bg-slate-900">
              <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FeatureGrid() {
  const features = [
    {
      title: 'Financial Statements',
      desc: 'Income statement, balance sheet, cash flow — normalized from raw XBRL. Annual or quarterly, with derived ratios.',
    },
    {
      title: 'Insider & Institutional',
      desc: 'Form 4 insider transactions and 13F institutional holdings parsed directly from EDGAR filings.',
    },
    {
      title: 'Market Data',
      desc: 'Real-time quotes, OHLCV history, technicals (SMA, RSI, MACD), and a stock screener with sector/cap filters.',
    },
    {
      title: 'Economic Indicators',
      desc: 'FRED data for inflation, employment, GDP, housing, rates, and more. Each series with full history.',
    },
    {
      title: 'Filing Text',
      desc: 'Extract MD&A, risk factors, and business descriptions from 10-K/10-Q filings. Read the actual prose.',
    },
    {
      title: 'Full Provenance',
      desc: 'Every response includes source URLs. You can always verify the data against the original SEC filing.',
    },
  ];

  return (
    <section className="border-t border-slate-200 dark:border-slate-800">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <h2 className="text-sm font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
          What you get
        </h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title}>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CTASection() {
  return (
    <section className="border-t border-slate-200 dark:border-slate-800">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight">Try it out</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Search a ticker above, or browse the tools:
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/screener"
            className="rounded-md border border-slate-200 px-5 py-2.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Screener
          </Link>
          <Link
            to="/economics"
            className="rounded-md border border-slate-200 px-5 py-2.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Economics
          </Link>
          <Link
            to="/docs"
            className="rounded-md border border-slate-200 px-5 py-2.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Documentation
          </Link>
        </div>
      </div>
    </section>
  );
}
