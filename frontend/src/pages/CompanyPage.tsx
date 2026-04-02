import { useParams, useSearchParams } from 'react-router-dom';
import { useState, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, BarChart3,
  Activity, Layers, Building2, Globe, Calendar,
} from 'lucide-react';
import { useProfile } from '../hooks/useProfile';
import { usePrices } from '../hooks/usePrices';
import { useFinancials } from '../hooks/useFinancials';
import { useOHLCV } from '../hooks/useOHLCV';
import { useMetrics } from '../hooks/useMetrics';
import { useFilings } from '../hooks/useFilings';
import { useInsiders } from '../hooks/useInsiders';
import { useSections } from '../hooks/useSections';
import { useNews } from '../hooks/useNews';
import { useTickerPredictions } from '../hooks/usePredictions';
import { useResearch } from '../hooks/useResearch';
import { useDebate } from '../hooks/useDebate';
import { useSimulation } from '../hooks/useSimulation';
import { CompanyHeader } from '../components/company/CompanyHeader';
import { PriceChart } from '../components/charts/PriceChart';
import { FinancialStatements } from '../components/company/FinancialStatements';
import { MetricsGrid } from '../components/company/MetricsGrid';
import { FilingsTable } from '../components/company/FilingsTable';
import { InsidersTable } from '../components/company/InsidersTable';
import { SectionsView } from '../components/company/SectionsView';
import { NewsSection } from '../components/company/NewsSection';
import { PredictionsView } from '../components/company/PredictionsView';
import { ResearchBrief } from '../components/company/ResearchBrief';
import { DebateBrief } from '../components/company/DebateBrief';
import { SimulationBrief } from '../components/company/SimulationBrief';
import { Tabs } from '../components/ui/Tabs';
import { ProvenanceBar } from '../components/ui/Provenance';
import { SkeletonCompanyHeader, SkeletonStatsGrid, SkeletonChart, SkeletonTable } from '../components/ui/Skeleton';
import { formatPrice } from '../lib/utils';
import { cn } from '../lib/utils';

const PAGE_TABS = ['Overview', 'Research', 'Debate', 'Simulation', 'Financials', 'Metrics', 'Filings', 'Insiders', 'News', 'Predictions', 'Sections'];

export function CompanyPage() {
  const { ticker = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = PAGE_TABS.find((t) => t.toLowerCase() === searchParams.get('tab')) || PAGE_TABS[0];
  const [tab, setTabState] = useState(initialTab);

  const setTab = useCallback((t: string) => {
    setTabState(t);
    const next = new URLSearchParams(searchParams);
    if (t === PAGE_TABS[0]) {
      next.delete('tab');
    } else {
      next.set('tab', t.toLowerCase());
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const [sectionType, setSectionType] = useState('mdna');
  const [financialPeriod, setFinancialPeriod] = useState<'FY' | 'Q'>('FY');
  const [researchRequested, setResearchRequested] = useState(false);
  const [researchScenario, setResearchScenario] = useState<string | undefined>();
  const [debateRequested, setDebateRequested] = useState(false);
  const [simulationRequested, setSimulationRequested] = useState(false);
  const [simulationScenario, setSimulationScenario] = useState<string | undefined>();

  const profile = useProfile(ticker);
  const prices = usePrices(ticker);
  const financials = useFinancials(ticker, financialPeriod);
  const ohlcv = useOHLCV(ticker);
  const metrics = useMetrics(ticker);
  const filings = useFilings(ticker);
  const insiders = useInsiders(ticker);
  const sections = useSections(ticker, sectionType);
  const news = useNews(ticker);
  const predictions = useTickerPredictions(ticker);
  const research = useResearch(ticker, researchRequested, researchScenario);
  const debate = useDebate(ticker, debateRequested);
  const simulation = useSimulation(ticker, simulationRequested, simulationScenario);

  const isLoading = profile.isLoading || prices.isLoading;
  const error = profile.error || prices.error;

  if (error && !profile.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <p className="text-red-600 dark:text-red-400">Failed to load data for {ticker}</p>
        <p className="mt-1 text-sm text-slate-500">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      {isLoading ? (
        <SkeletonCompanyHeader />
      ) : (
        <>
          <CompanyHeader profile={profile.data} prices={prices.data} />
          {profile.data?.provenance && (
            <ProvenanceBar items={profile.data.provenance} />
          )}
        </>
      )}

      <Tabs tabs={PAGE_TABS} active={tab} onChange={setTab} />

      {tab === 'Overview' && (
        <div className="space-y-6">
          {isLoading ? (
            <>
              <SkeletonStatsGrid cols={4} />
              <SkeletonChart />
            </>
          ) : (
            <>
              {/* Price stats grid */}
              {prices.data && (
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-sm dark:border-slate-800 dark:bg-slate-800 sm:grid-cols-4">
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

              {/* Key metrics quick view (from latest metrics data) */}
              {metrics.data?.data?.periods?.[0]?.metrics && (
                <OverviewMetrics m={metrics.data.data.periods[0].metrics} />
              )}

              {/* Price chart with time range selector */}
              {ohlcv.isLoading && <SkeletonChart />}
              {ohlcv.data?.bars && ohlcv.data.bars.length > 0 && (
                <PriceChart bars={ohlcv.data.bars} />
              )}

              {/* Company info card */}
              {profile.data?.data && (
                <CompanyInfoCard profile={profile.data.data} />
              )}
            </>
          )}
        </div>
      )}

      {tab === 'Research' && (
        <div>
          <ResearchBrief
            data={research.data}
            isLoading={research.isLoading}
            error={research.error}
            onGenerate={(scenario?: string) => { setResearchScenario(scenario); setResearchRequested(true); }}
            hasRequested={researchRequested}
          />
        </div>
      )}

      {tab === 'Debate' && (
        <div>
          <DebateBrief
            data={debate.data}
            isLoading={debate.isLoading}
            error={debate.error}
            onGenerate={() => setDebateRequested(true)}
            hasRequested={debateRequested}
          />
        </div>
      )}

      {tab === 'Simulation' && (
        <div>
          <SimulationBrief
            data={simulation.data}
            isLoading={simulation.isLoading}
            error={simulation.error}
            onGenerate={(scenario?: string) => { setSimulationScenario(scenario); setSimulationRequested(true); }}
            hasRequested={simulationRequested}
          />
        </div>
      )}

      {tab === 'Financials' && (
        <div className="space-y-4">
          {/* Annual / Quarterly toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Period:</span>
            <div className="flex gap-0.5 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
              {(['FY', 'Q'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setFinancialPeriod(p)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                    financialPeriod === p
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  )}
                >
                  {p === 'FY' ? 'Annual' : 'Quarterly'}
                </button>
              ))}
            </div>
          </div>
          {financials.isLoading && <SkeletonTable rows={8} cols={5} />}
          {financials.data?.data?.periods && (
            <>
              <FinancialStatements periods={financials.data.data.periods} />
              {financials.data.provenance && (
                <ProvenanceBar items={financials.data.provenance} className="mt-4" />
              )}
            </>
          )}
          {financials.error && <p className="text-sm text-red-500">Failed to load financials</p>}
        </div>
      )}

      {tab === 'Metrics' && (
        <div>
          {metrics.isLoading && <SkeletonTable rows={6} cols={5} />}
          {metrics.data?.data && (
            <>
              <MetricsGrid metrics={metrics.data.data} />
              {metrics.data.provenance && (
                <ProvenanceBar items={metrics.data.provenance} className="mt-4" />
              )}
            </>
          )}
          {metrics.error && <p className="text-sm text-red-500">Failed to load metrics</p>}
        </div>
      )}

      {tab === 'Filings' && (
        <div>
          {filings.isLoading && <SkeletonTable rows={10} cols={4} />}
          {filings.data?.data?.filings && (
            <>
              <FilingsTable filings={filings.data.data.filings} />
              {filings.data.provenance && (
                <ProvenanceBar items={filings.data.provenance} className="mt-4" />
              )}
            </>
          )}
          {filings.error && <p className="text-sm text-red-500">Failed to load filings</p>}
        </div>
      )}

      {tab === 'Insiders' && (
        <div>
          {insiders.isLoading && <SkeletonTable rows={10} cols={6} />}
          {insiders.data?.data?.insider_filings && (
            <>
              <InsidersTable filings={insiders.data.data.insider_filings} />
              {insiders.data.provenance && (
                <ProvenanceBar items={insiders.data.provenance} className="mt-4" />
              )}
            </>
          )}
          {insiders.error && <p className="text-sm text-red-500">Failed to load insider data</p>}
        </div>
      )}

      {tab === 'News' && (
        <div>
          {news.isLoading && <SkeletonTable rows={6} cols={1} />}
          {news.data?.articles && <NewsSection articles={news.data.articles} />}
          {news.error && <p className="text-sm text-red-500">Failed to load news</p>}
        </div>
      )}

      {tab === 'Predictions' && (
        <div>
          <PredictionsView
            data={predictions.data}
            isLoading={predictions.isLoading}
            error={predictions.error as Error | null}
            ticker={ticker}
          />
        </div>
      )}

      {tab === 'Sections' && (
        <div>
          {sections.isLoading && <SkeletonTable rows={4} cols={1} />}
          {sections.data?.data?.sections && (
            <>
              <SectionsView
                sections={sections.data.data.sections}
                onSectionChange={setSectionType}
              />
              {sections.data.provenance && (
                <ProvenanceBar items={sections.data.provenance} className="mt-4" />
              )}
            </>
          )}
          {sections.error && <p className="text-sm text-red-500">Failed to load filing sections</p>}
        </div>
      )}
    </div>
  );
}

// ─── Overview helper components ───────────────────────────────────────

interface MetricCategory {
  profitability?: Record<string, number>;
  liquidity?: Record<string, number>;
  leverage?: Record<string, number>;
  efficiency?: Record<string, number>;
  valuation?: Record<string, number>;
  growth?: Record<string, number>;
  per_share?: Record<string, number>;
}

function OverviewMetrics({ m }: { m: MetricCategory }) {
  const items: { label: string; value: string; icon: React.ReactNode; delta?: number }[] = [];

  // P/E ratio
  const pe = m.valuation?.pe_ratio;
  if (pe != null) items.push({ label: 'P/E Ratio', value: pe.toFixed(1), icon: <BarChart3 className="h-3.5 w-3.5" /> });

  // EPS
  const eps = m.per_share?.eps_diluted ?? m.per_share?.eps_basic;
  if (eps != null) items.push({ label: 'EPS', value: `$${eps.toFixed(2)}`, icon: <DollarSign className="h-3.5 w-3.5" /> });

  // ROE
  const roe = m.profitability?.return_on_equity;
  if (roe != null) items.push({ label: 'ROE', value: `${(roe * 100).toFixed(1)}%`, icon: <TrendingUp className="h-3.5 w-3.5" />, delta: roe });

  // Gross margin
  const gm = m.profitability?.gross_margin;
  if (gm != null) items.push({ label: 'Gross Margin', value: `${(gm * 100).toFixed(1)}%`, icon: <Activity className="h-3.5 w-3.5" /> });

  // Debt-to-equity
  const de = m.leverage?.debt_to_equity;
  if (de != null) items.push({ label: 'D/E Ratio', value: de.toFixed(2), icon: <Layers className="h-3.5 w-3.5" /> });

  // Current ratio
  const cr = m.liquidity?.current_ratio;
  if (cr != null) items.push({ label: 'Current Ratio', value: cr.toFixed(2), icon: <Activity className="h-3.5 w-3.5" /> });

  // Revenue growth
  const rg = m.growth?.revenue_growth;
  if (rg != null) items.push({ label: 'Rev Growth', value: `${(rg * 100).toFixed(1)}%`, icon: rg >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />, delta: rg });

  // Net margin
  const nm = m.profitability?.net_margin;
  if (nm != null) items.push({ label: 'Net Margin', value: `${(nm * 100).toFixed(1)}%`, icon: <DollarSign className="h-3.5 w-3.5" /> });

  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">Key metrics</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.slice(0, 8).map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700"
          >
            <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              {item.icon}
              {item.label}
            </div>
            <p className={cn(
              'mt-1 text-lg font-semibold tabular-nums',
              item.delta != null && item.delta >= 0 && 'text-emerald-600 dark:text-emerald-400',
              item.delta != null && item.delta < 0 && 'text-red-600 dark:text-red-400',
            )}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompanyInfoCard({ profile }: { profile: import('../lib/types').ProfileData }) {
  const infoItems: { label: string; value: string; icon: React.ReactNode }[] = [];

  if (profile.exchanges?.length > 0) {
    infoItems.push({ label: 'Exchange', value: profile.exchanges.join(', '), icon: <Building2 className="h-3.5 w-3.5" /> });
  }
  if (profile.sic_description) {
    infoItems.push({ label: 'Industry', value: profile.sic_description, icon: <Layers className="h-3.5 w-3.5" /> });
  }
  if (profile.state) {
    infoItems.push({ label: 'State', value: profile.state, icon: <Globe className="h-3.5 w-3.5" /> });
  }
  if (profile.fiscal_year_end) {
    infoItems.push({ label: 'Fiscal Year End', value: profile.fiscal_year_end, icon: <Calendar className="h-3.5 w-3.5" /> });
  }
  if (profile.website) {
    infoItems.push({ label: 'Website', value: profile.website, icon: <Globe className="h-3.5 w-3.5" /> });
  }

  if (infoItems.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-700">
      <h3 className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">Company information</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {infoItems.map((item) => (
          <div key={item.label} className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 text-slate-400">{item.icon}</span>
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">{item.label}</p>
              {item.label === 'Website' ? (
                <a
                  href={item.value.startsWith('http') ? item.value : `https://${item.value}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {item.value}
                </a>
              ) : (
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.value}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
