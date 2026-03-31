import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useProfile } from '../hooks/useProfile';
import { usePrices } from '../hooks/usePrices';
import { useFinancials } from '../hooks/useFinancials';
import { useOHLCV } from '../hooks/useOHLCV';
import { useMetrics } from '../hooks/useMetrics';
import { useFilings } from '../hooks/useFilings';
import { useInsiders } from '../hooks/useInsiders';
import { useSections } from '../hooks/useSections';
import { useNews } from '../hooks/useNews';
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
import { ResearchBrief } from '../components/company/ResearchBrief';
import { DebateBrief } from '../components/company/DebateBrief';
import { SimulationBrief } from '../components/company/SimulationBrief';
import { Tabs } from '../components/ui/Tabs';
import { ProvenanceBar } from '../components/ui/Provenance';
import { SkeletonCompanyHeader, SkeletonStatsGrid, SkeletonChart, SkeletonTable } from '../components/ui/Skeleton';
import { formatPrice } from '../lib/utils';

const PAGE_TABS = ['Overview', 'Research', 'Debate', 'Simulation', 'Financials', 'Metrics', 'Filings', 'Insiders', 'News', 'Sections'];

export function CompanyPage() {
  const { ticker = '' } = useParams();
  const [tab, setTab] = useState(PAGE_TABS[0]);
  const [sectionType, setSectionType] = useState('mdna');
  const [researchRequested, setResearchRequested] = useState(false);
  const [researchScenario, setResearchScenario] = useState<string | undefined>();
  const [debateRequested, setDebateRequested] = useState(false);
  const [simulationRequested, setSimulationRequested] = useState(false);
  const [simulationScenario, setSimulationScenario] = useState<string | undefined>();

  const profile = useProfile(ticker);
  const prices = usePrices(ticker);
  const financials = useFinancials(ticker);
  const ohlcv = useOHLCV(ticker);
  const metrics = useMetrics(ticker);
  const filings = useFilings(ticker);
  const insiders = useInsiders(ticker);
  const sections = useSections(ticker, sectionType);
  const news = useNews(ticker);
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

              {ohlcv.isLoading && <SkeletonChart />}
              {ohlcv.data?.bars && ohlcv.data.bars.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">Price history</h3>
                  <PriceChart bars={ohlcv.data.bars} />
                </div>
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
        <div>
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
