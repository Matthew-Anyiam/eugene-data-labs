import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useProfile } from '../hooks/useProfile';
import { usePrices } from '../hooks/usePrices';
import { useFinancials } from '../hooks/useFinancials';
import { useOHLCV } from '../hooks/useOHLCV';
import { useMetrics } from '../hooks/useMetrics';
import { CompanyHeader } from '../components/company/CompanyHeader';
import { PriceChart } from '../components/charts/PriceChart';
import { FinancialStatements } from '../components/company/FinancialStatements';
import { MetricsGrid } from '../components/company/MetricsGrid';
import { Tabs } from '../components/ui/Tabs';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { formatPrice } from '../lib/utils';

const PAGE_TABS = ['Overview', 'Financials', 'Metrics'];

export function CompanyPage() {
  const { ticker = '' } = useParams();
  const [tab, setTab] = useState(PAGE_TABS[0]);

  const profile = useProfile(ticker);
  const prices = usePrices(ticker);
  const financials = useFinancials(ticker);
  const ohlcv = useOHLCV(ticker);
  const metrics = useMetrics(ticker);

  const isLoading = profile.isLoading || prices.isLoading;
  const error = profile.error || prices.error;

  if (isLoading) return <LoadingSpinner className="mt-20" />;
  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <p className="text-red-600 dark:text-red-400">Failed to load data for {ticker}</p>
        <p className="mt-1 text-sm text-slate-500">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <CompanyHeader profile={profile.data} prices={prices.data} />

      <Tabs tabs={PAGE_TABS} active={tab} onChange={setTab} />

      {tab === 'Overview' && (
        <div className="space-y-6">
          {prices.data && (
            <div className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-sm dark:border-slate-800 dark:bg-slate-800 sm:grid-cols-4">
              {[
                { label: 'Day range', value: `${formatPrice(prices.data.day_low)} – ${formatPrice(prices.data.day_high)}` },
                { label: '52W range', value: `${formatPrice(prices.data.year_low)} – ${formatPrice(prices.data.year_high)}` },
                { label: 'Volume', value: prices.data.volume?.toLocaleString() ?? '—' },
                { label: 'Avg 50/200', value: `${formatPrice(prices.data.avg_50)} / ${formatPrice(prices.data.avg_200)}` },
              ].map((item) => (
                <div key={item.label} className="bg-white px-4 py-3 dark:bg-slate-900">
                  <p className="text-xs text-slate-400 dark:text-slate-500">{item.label}</p>
                  <p className="mt-0.5 font-medium tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>
          )}

          {ohlcv.data?.bars && ohlcv.data.bars.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">Price history</h3>
              <PriceChart bars={ohlcv.data.bars} />
            </div>
          )}
          {ohlcv.isLoading && <LoadingSpinner />}
        </div>
      )}

      {tab === 'Financials' && (
        <div>
          {financials.isLoading && <LoadingSpinner />}
          {financials.data?.data?.periods && (
            <FinancialStatements periods={financials.data.data.periods} />
          )}
          {financials.error && (
            <p className="text-sm text-red-500">Failed to load financials</p>
          )}
        </div>
      )}

      {tab === 'Metrics' && (
        <div>
          {metrics.isLoading && <LoadingSpinner />}
          {metrics.data?.data && <MetricsGrid metrics={metrics.data.data} />}
          {metrics.error && <p className="text-sm text-red-500">Failed to load metrics</p>}
        </div>
      )}
    </div>
  );
}
