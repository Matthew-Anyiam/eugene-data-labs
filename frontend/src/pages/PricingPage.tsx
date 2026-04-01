import { Link } from 'react-router-dom';
import { WaitlistForm } from '../components/landing/Hero';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    description: 'For individuals exploring the intelligence platform.',
    features: [
      '100 requests / day',
      'Company data (profile, financials, prices)',
      'World intelligence (news, sanctions)',
      'Community support',
    ],
    cta: 'Current plan',
    current: true,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/mo',
    description: 'For developers and analysts who need full access.',
    features: [
      '10,000 requests / day',
      'All 19 extract types + world intelligence',
      'Convergence alerts & risk scoring',
      'Private credit data',
      'MCP server + CSV export',
      'Priority support',
    ],
    cta: 'Join waitlist',
    current: false,
    highlight: true,
  },
  {
    name: 'Team',
    price: '$99',
    period: '/mo',
    description: 'For teams building on Eugene intelligence.',
    features: [
      '50,000 requests / day',
      'Full platform access',
      'Bulk data export (Parquet)',
      'Real-time convergence webhooks',
      'Multiple API keys',
      'Dedicated support',
    ],
    cta: 'Join waitlist',
    current: false,
  },
];

export function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
          FREE DURING BETA
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          Simple pricing, launching July 2026
        </h1>
        <p className="mt-3 text-lg text-slate-600 dark:text-slate-400">
          Everything is free right now. No API key needed. We'll notify you before paid tiers start.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`rounded-lg border p-6 ${
              tier.highlight
                ? 'border-slate-900 ring-1 ring-slate-900 dark:border-white dark:ring-white'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <h3 className="text-lg font-semibold">{tier.name}</h3>
            <div className="mt-3">
              <span className="text-3xl font-bold">{tier.price}</span>
              {tier.period && (
                <span className="text-sm text-slate-500 dark:text-slate-400">{tier.period}</span>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{tier.description}</p>

            <ul className="mt-6 space-y-2.5">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 text-emerald-600 dark:text-emerald-400">&#10003;</span>
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-6">
              {tier.current ? (
                <Link
                  to="/"
                  className="block rounded-md border border-slate-200 py-2 text-center text-sm font-medium text-slate-500 dark:border-slate-700"
                >
                  Free during beta
                </Link>
              ) : (
                <div className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <p className="mb-2 text-center text-xs text-slate-400">Launching July 2026</p>
                  <WaitlistForm />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 rounded-lg border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900/50">
        <h2 className="text-xl font-bold">Need more?</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Enterprise plans with custom rate limits, SLAs, and dedicated infrastructure.
        </p>
        <a
          href="mailto:hello@eugeneintelligence.com"
          className="mt-4 inline-block rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          Contact us
        </a>
      </div>
    </div>
  );
}
