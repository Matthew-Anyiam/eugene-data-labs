import { useParams, useSearchParams, Link } from 'react-router-dom';
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
import { useTechnicals } from '../hooks/useTechnicals';
import { useTranscripts } from '../hooks/useTranscripts';
import { useSegments } from '../hooks/useSegments';
import { useEstimates, useEarnings } from '../hooks/useEstimates';
import { usePeers } from '../hooks/usePeers';
import { useOwnership } from '../hooks/useOwnership';
import { CompanyHeader } from '../components/company/CompanyHeader';
import { ConvergencePanel } from '../components/company/ConvergencePanel';
import { AIResearchPanel } from '../components/company/AIResearchPanel';
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

const PAGE_TABS = ['Overview', 'Research', 'Debate', 'Simulation', 'Technical', 'Transcripts', 'Segments', 'Estimates', 'Valuation', 'Peers', 'Ownership', 'Financials', 'Metrics', 'Filings', 'Insiders', 'News', 'Predictions', 'Sections'];

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
  const technicals = useTechnicals(ticker);
  const transcripts = useTranscripts(ticker, 5);
  const segments = useSegments(ticker, 5);
  const estimates = useEstimates(ticker);
  const earnings = useEarnings(ticker);
  const peers = usePeers(ticker, 10);
  const ownership = useOwnership(ticker, 20);

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
              {(metrics.data?.data?.periods?.[0]?.metrics || metrics.data?.data?.periods?.[0]?.ratios) && (
                <OverviewMetrics m={(metrics.data!.data!.periods[0].metrics ?? metrics.data!.data!.periods[0].ratios)!} />
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

              {/* Convergence Intelligence */}
              <ConvergencePanel ticker={ticker} />

              {/* AI Research */}
              <AIResearchPanel ticker={ticker} />
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

      {tab === 'Technical' && (
        <div className="space-y-6">
          {technicals.isLoading && <SkeletonStatsGrid cols={4} />}
          {technicals.error && <p className="text-sm text-red-500">Failed to load technical indicators</p>}
          {technicals.data?.data && <TechnicalTab data={technicals.data.data} currentPrice={prices.data?.price} />}
          {technicals.data?.provenance && <ProvenanceBar items={technicals.data.provenance} className="mt-4" />}
        </div>
      )}

      {tab === 'Transcripts' && (
        <div className="space-y-6">
          {transcripts.isLoading && <SkeletonTable rows={6} cols={1} />}
          {transcripts.error && <p className="text-sm text-red-500">Failed to load transcripts</p>}
          {transcripts.data?.data?.transcripts && <TranscriptsTab transcripts={transcripts.data.data.transcripts} />}
          {transcripts.data?.provenance && <ProvenanceBar items={transcripts.data.provenance} className="mt-4" />}
        </div>
      )}

      {tab === 'Segments' && (
        <div className="space-y-6">
          {segments.isLoading && <SkeletonTable rows={6} cols={4} />}
          {segments.error && <p className="text-sm text-red-500">Failed to load segment data</p>}
          {segments.data?.data?.periods && <SegmentsTab periods={segments.data.data.periods} />}
          {segments.data?.provenance && <ProvenanceBar items={segments.data.provenance} className="mt-4" />}
        </div>
      )}

      {tab === 'Estimates' && (
        <div className="space-y-6">
          {(estimates.isLoading || earnings.isLoading) && <SkeletonStatsGrid cols={3} />}
          {estimates.error && <p className="text-sm text-red-500">Failed to load estimates</p>}
          <EstimatesTab estimates={estimates.data ?? []} earnings={earnings.data ?? []} />
        </div>
      )}

      {tab === 'Valuation' && (
        <div className="space-y-6">
          {metrics.isLoading && <SkeletonStatsGrid cols={4} />}
          {metrics.error && <p className="text-sm text-red-500">Failed to load valuation data</p>}
          {(metrics.data?.data?.periods?.[0]?.metrics || metrics.data?.data?.periods?.[0]?.ratios) && (
            <ValuationTab m={(metrics.data!.data!.periods[0].metrics ?? metrics.data!.data!.periods[0].ratios)!} currentPrice={prices.data?.price} />
          )}
        </div>
      )}

      {tab === 'Peers' && (
        <div className="space-y-6">
          {peers.isLoading && <SkeletonTable rows={10} cols={6} />}
          {peers.error && <p className="text-sm text-red-500">Failed to load peer data</p>}
          {peers.data?.data && <PeersTab data={peers.data.data} />}
          {peers.data?.provenance && <ProvenanceBar items={peers.data.provenance} className="mt-4" />}
        </div>
      )}

      {tab === 'Ownership' && (
        <div className="space-y-6">
          {ownership.isLoading && <SkeletonTable rows={10} cols={5} />}
          {ownership.error && <p className="text-sm text-red-500">Failed to load ownership data</p>}
          {ownership.data?.data && <OwnershipTab data={ownership.data.data} />}
          {ownership.data?.provenance && <ProvenanceBar items={ownership.data.provenance} className="mt-4" />}
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

// ─── Technical tab ───────────────────────────────────────────────────

function TechnicalTab({ data, currentPrice }: { data: import('../hooks/useTechnicals').TechnicalsData; currentPrice?: number }) {
  const ind = data?.indicators;
  if (!ind) return <p className="text-sm text-slate-500">No technical data available.</p>;

  const price = currentPrice ?? data?.latest_close ?? 0;
  const rsi = ind.rsi_14;
  const rsiColor = rsi != null && rsi >= 70 ? 'text-red-600 dark:text-red-400' : rsi != null && rsi <= 30 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400';
  const macdBullish = ind.macd?.histogram != null ? ind.macd.histogram > 0 : false;

  // Signal summary
  const signals: { label: string; signal: 'bullish' | 'bearish' | 'neutral' }[] = [];
  if (price && ind.sma_50 != null) {
    signals.push({ label: 'Price vs SMA 50', signal: price > ind.sma_50 ? 'bullish' : 'bearish' });
  }
  if (price && ind.sma_200 != null) {
    signals.push({ label: 'Price vs SMA 200', signal: price > ind.sma_200 ? 'bullish' : 'bearish' });
  }
  if (ind.sma_50 != null && ind.sma_200 != null) {
    signals.push({ label: 'SMA 50 vs 200', signal: ind.sma_50 > ind.sma_200 ? 'bullish' : 'bearish' });
  }
  if (rsi != null) {
    signals.push({ label: 'RSI', signal: rsi >= 70 ? 'bearish' : rsi <= 30 ? 'bullish' : 'neutral' });
  }
  if (ind.macd) {
    signals.push({ label: 'MACD', signal: macdBullish ? 'bullish' : 'bearish' });
  }

  const signalColorMap = { bullish: 'text-emerald-600 dark:text-emerald-400', bearish: 'text-red-600 dark:text-red-400', neutral: 'text-amber-600 dark:text-amber-400' };

  const indicatorCards: { label: string; value: string; sub?: string; colorClass?: string }[] = [];
  if (ind.sma_20 != null) indicatorCards.push({ label: 'SMA 20', value: formatPrice(ind.sma_20) });
  if (ind.sma_50 != null) indicatorCards.push({ label: 'SMA 50', value: formatPrice(ind.sma_50) });
  if (ind.sma_200 != null) indicatorCards.push({ label: 'SMA 200', value: formatPrice(ind.sma_200) });
  if (ind.ema_12 != null) indicatorCards.push({ label: 'EMA 12', value: formatPrice(ind.ema_12) });
  if (ind.ema_26 != null) indicatorCards.push({ label: 'EMA 26', value: formatPrice(ind.ema_26) });
  if (rsi != null) {
    indicatorCards.push({ label: 'RSI (14)', value: rsi.toFixed(1), sub: rsi >= 70 ? 'Overbought' : rsi <= 30 ? 'Oversold' : 'Neutral', colorClass: rsiColor });
  }
  if (ind.macd) {
    indicatorCards.push({ label: 'MACD', value: ind.macd.macd_line.toFixed(3), sub: `Signal: ${ind.macd.signal.toFixed(3)}`, colorClass: macdBullish ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400' });
    indicatorCards.push({ label: 'MACD Histogram', value: ind.macd.histogram.toFixed(3), colorClass: macdBullish ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400' });
  }
  if (ind.bollinger_bands) {
    indicatorCards.push({ label: 'Bollinger Upper', value: formatPrice(ind.bollinger_bands.upper) });
    indicatorCards.push({ label: 'Bollinger Middle', value: formatPrice(ind.bollinger_bands.middle) });
    indicatorCards.push({ label: 'Bollinger Lower', value: formatPrice(ind.bollinger_bands.lower) });
  }
  if (ind.atr_14 != null) indicatorCards.push({ label: 'ATR', value: ind.atr_14.toFixed(2) });
  if (ind.vwap_20 != null) indicatorCards.push({ label: 'VWAP', value: formatPrice(ind.vwap_20) });

  return (
    <div className="space-y-6">
      {/* Signal summary */}
      {signals.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-700">
          <h3 className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">Signal summary</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {signals.map((s) => (
              <div key={s.label} className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">{s.label}</span>
                <span className={cn('text-xs font-semibold capitalize', signalColorMap[s.signal])}>{s.signal}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Indicator cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {indicatorCards.map((c) => (
          <div key={c.label} className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
            <p className="text-xs text-slate-400 dark:text-slate-500">{c.label}</p>
            <p className={cn('mt-1 text-lg font-semibold tabular-nums', c.colorClass)}>{c.value}</p>
            {c.sub && <p className={cn('text-xs', c.colorClass ?? 'text-slate-400')}>{c.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Transcripts tab ─────────────────────────────────────────────────

function TranscriptsTab({ transcripts }: { transcripts: import('../hooks/useTranscripts').Transcript[] }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  if (transcripts.length === 0) return <p className="text-sm text-slate-500">No transcripts available.</p>;

  const t = transcripts[selectedIdx];
  const tone = t.tone_analysis;
  const totalWords = (tone?.positive_words ?? 0) + (tone?.negative_words ?? 0);
  const positivePct = totalWords > 0 ? ((tone.positive_words / totalWords) * 100).toFixed(0) : '—';
  const sentimentColor = (tone?.sentiment_score ?? 0) >= 0.6
    ? 'border-emerald-400 dark:border-emerald-600'
    : (tone?.sentiment_score ?? 0) <= 0.4
      ? 'border-red-400 dark:border-red-600'
      : 'border-amber-400 dark:border-amber-600';

  return (
    <div className="space-y-6">
      {/* Quarter selector */}
      <div className="flex flex-wrap gap-2">
        {transcripts.map((tr, i) => (
          <button
            key={`${tr.quarter}-${tr.year}`}
            onClick={() => setSelectedIdx(i)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              i === selectedIdx
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'border border-slate-200 text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400'
            )}
          >
            {tr.quarter} {tr.year}
          </button>
        ))}
      </div>

      {/* Sentiment card */}
      {tone && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
            <p className="text-xs text-slate-400 dark:text-slate-500">Sentiment score</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{tone.sentiment_score?.toFixed(2) ?? '—'}</p>
          </div>
          <div className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
            <p className="text-xs text-slate-400 dark:text-slate-500">Positive tone</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{positivePct}%</p>
          </div>
          <div className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
            <p className="text-xs text-slate-400 dark:text-slate-500">Positive words</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{tone.positive_words}</p>
          </div>
          <div className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
            <p className="text-xs text-slate-400 dark:text-slate-500">Negative words</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-red-600 dark:text-red-400">{tone.negative_words}</p>
          </div>
        </div>
      )}

      {/* Guidance */}
      {t.guidance && (
        <div className={cn('rounded-lg border-l-4 bg-slate-50 p-4 dark:bg-slate-900/50', sentimentColor)}>
          <h4 className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Guidance</h4>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{t.guidance}</p>
        </div>
      )}

      {/* Management remarks */}
      {t.management_remarks && (
        <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-700">
          <h4 className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">Management remarks</h4>
          <div className="space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {t.management_remarks.split('\n').filter(Boolean).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      )}

      {/* Q&A section */}
      {t.qa_section && (
        <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-700">
          <h4 className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">Q&A session</h4>
          <div className="space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {t.qa_section.split('\n').filter(Boolean).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Segments tab ────────────────────────────────────────────────────

function SegmentsTab({ periods }: { periods: import('../hooks/useSegments').SegmentPeriod[] }) {
  if (periods.length === 0) return <p className="text-sm text-slate-500">No segment data available.</p>;

  const latest = periods[0];
  const biz = latest.business_segments ?? [];
  const geo = latest.geographic_segments ?? [];

  const maxBizRev = Math.max(...biz.map((s) => s.revenue || 0), 1);
  const maxGeoRev = Math.max(...geo.map((s) => s.revenue || 0), 1);

  return (
    <div className="space-y-6">
      {latest.period_end && (
        <p className="text-xs text-slate-400 dark:text-slate-500">Period ending {latest.period_end}</p>
      )}

      {/* Business segments */}
      {biz.length > 0 && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700">
          <h3 className="border-b border-slate-200 px-5 py-3 text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Business segments
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {biz.map((seg) => (
              <div key={seg.segment_name} className="flex items-center gap-4 px-5 py-3">
                <span className="w-40 shrink-0 text-sm font-medium text-slate-700 dark:text-slate-300">{seg.segment_name}</span>
                <div className="flex-1">
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${((seg.revenue || 0) / maxBizRev) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="w-28 text-right text-sm tabular-nums text-slate-600 dark:text-slate-400">
                  {formatPrice(seg.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Geographic segments */}
      {geo.length > 0 && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700">
          <h3 className="border-b border-slate-200 px-5 py-3 text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Geographic segments
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {geo.map((seg) => (
              <div key={seg.region} className="flex items-center gap-4 px-5 py-3">
                <span className="w-40 shrink-0 text-sm font-medium text-slate-700 dark:text-slate-300">{seg.region}</span>
                <div className="flex-1">
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${((seg.revenue || 0) / maxGeoRev) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="w-28 text-right text-sm tabular-nums text-slate-600 dark:text-slate-400">
                  {formatPrice(seg.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Estimates tab ───────────────────────────────────────────────────

function EstimatesTab({ estimates, earnings }: { estimates: import('../hooks/useEstimates').Estimate[]; earnings: import('../hooks/useEstimates').EarningsEstimate[] }) {
  // Compute consensus from analyst ratings
  const ratingCounts: Record<string, number> = {};
  for (const e of estimates) {
    const r = (e.rating ?? '').toLowerCase();
    ratingCounts[r] = (ratingCounts[r] ?? 0) + 1;
  }
  const priceSummary = estimates.length > 0 ? {
    mean: estimates.reduce((s, e) => s + (e.price_target ?? 0), 0) / estimates.length,
    high: Math.max(...estimates.map((e) => e.price_target ?? 0)),
    low: Math.min(...estimates.map((e) => e.price_target ?? 0)),
  } : null;

  return (
    <div className="space-y-6">
      {/* Price targets */}
      {priceSummary && (
        <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-700">
          <h3 className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">Analyst price targets</h3>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Low</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-red-600 dark:text-red-400">{formatPrice(priceSummary.low)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Mean</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatPrice(priceSummary.mean)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">High</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatPrice(priceSummary.high)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Consensus */}
      {Object.keys(ratingCounts).length > 0 && (
        <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-700">
          <h3 className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">Consensus breakdown ({estimates.length} analysts)</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(ratingCounts).sort((a, b) => b[1] - a[1]).map(([rating, count]) => (
              <div key={rating} className="rounded-md border border-slate-100 px-3 py-2 dark:border-slate-800">
                <span className="text-xs capitalize text-slate-500 dark:text-slate-400">{rating || 'unrated'}</span>
                <p className="text-lg font-semibold tabular-nums">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent analyst estimates */}
      {estimates.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Analyst</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Firm</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Rating</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Price Target</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {estimates.slice(0, 15).map((e, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{e.analyst_name || '—'}</td>
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{e.analyst_company || '—'}</td>
                  <td className="px-4 py-2">
                    <span className={cn(
                      'inline-block rounded px-2 py-0.5 text-xs font-medium',
                      (e.rating ?? '').toLowerCase().includes('buy') ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      (e.rating ?? '').toLowerCase().includes('sell') ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    )}>
                      {e.rating || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{formatPrice(e.price_target)}</td>
                  <td className="px-4 py-2 text-right text-slate-500 dark:text-slate-400">{e.published_date ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Earnings history */}
      {earnings.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <h3 className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Earnings history
          </h3>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Period</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">EPS Est.</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">EPS Actual</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Surprise</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Rev Est.</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Rev Actual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {earnings.slice(0, 12).map((e, i) => {
                const beat = e.eps_actual != null && e.eps_actual >= e.eps_estimated;
                return (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{e.fiscal_period ?? e.date}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-500">${e.eps_estimated?.toFixed(2) ?? '—'}</td>
                    <td className={cn(
                      'px-4 py-2 text-right tabular-nums font-medium',
                      e.eps_actual != null ? (beat ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400') : 'text-slate-500'
                    )}>
                      {e.eps_actual != null ? `$${e.eps_actual.toFixed(2)}` : '—'}
                    </td>
                    <td className={cn(
                      'px-4 py-2 text-right tabular-nums text-xs font-medium',
                      e.eps_actual != null ? (beat ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400') : 'text-slate-400'
                    )}>
                      {e.eps_actual != null ? (beat ? 'Beat' : 'Miss') : '—'}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-500">{e.revenue_estimated != null ? formatPrice(e.revenue_estimated) : '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{e.revenue_actual != null ? formatPrice(e.revenue_actual) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {estimates.length === 0 && earnings.length === 0 && (
        <p className="text-sm text-slate-500">No estimate or earnings data available.</p>
      )}
    </div>
  );
}

// ─── Valuation tab ───────────────────────────────────────────────────

function ValuationTab({ m, currentPrice }: { m: MetricCategory; currentPrice?: number }) {
  const val = m.valuation ?? {};
  const prof = m.profitability ?? {};
  const ps = m.per_share ?? {};
  const growth = m.growth ?? {};

  const valuationItems: { label: string; value: string }[] = [];
  if (val.pe_ratio != null) valuationItems.push({ label: 'P/E Ratio', value: val.pe_ratio.toFixed(1) });
  if (val.pb_ratio != null) valuationItems.push({ label: 'P/B Ratio', value: val.pb_ratio.toFixed(2) });
  if (val.ps_ratio != null) valuationItems.push({ label: 'P/S Ratio', value: val.ps_ratio.toFixed(2) });
  if (val.ev_ebitda != null) valuationItems.push({ label: 'EV/EBITDA', value: val.ev_ebitda.toFixed(1) });
  if (val.ev_revenue != null) valuationItems.push({ label: 'EV/Revenue', value: val.ev_revenue.toFixed(2) });
  if (val.peg_ratio != null) valuationItems.push({ label: 'PEG Ratio', value: val.peg_ratio.toFixed(2) });

  const profitItems: { label: string; value: string; positive: boolean }[] = [];
  if (prof.gross_margin != null) profitItems.push({ label: 'Gross Margin', value: `${(prof.gross_margin * 100).toFixed(1)}%`, positive: prof.gross_margin > 0 });
  if (prof.operating_margin != null) profitItems.push({ label: 'Operating Margin', value: `${(prof.operating_margin * 100).toFixed(1)}%`, positive: prof.operating_margin > 0 });
  if (prof.net_margin != null) profitItems.push({ label: 'Net Margin', value: `${(prof.net_margin * 100).toFixed(1)}%`, positive: prof.net_margin > 0 });
  if (prof.return_on_equity != null) profitItems.push({ label: 'ROE', value: `${(prof.return_on_equity * 100).toFixed(1)}%`, positive: prof.return_on_equity > 0 });
  if (prof.return_on_assets != null) profitItems.push({ label: 'ROA', value: `${(prof.return_on_assets * 100).toFixed(1)}%`, positive: prof.return_on_assets > 0 });
  if (prof.return_on_capital != null) profitItems.push({ label: 'ROIC', value: `${(prof.return_on_capital * 100).toFixed(1)}%`, positive: prof.return_on_capital > 0 });

  const perShareItems: { label: string; value: string }[] = [];
  const epsDiluted = ps.eps_diluted ?? ps.eps_basic;
  if (epsDiluted != null) perShareItems.push({ label: 'EPS (Diluted)', value: `$${epsDiluted.toFixed(2)}` });
  if (ps.book_value != null) perShareItems.push({ label: 'Book Value', value: `$${ps.book_value.toFixed(2)}` });
  if (ps.revenue_per_share != null) perShareItems.push({ label: 'Revenue/Share', value: `$${ps.revenue_per_share.toFixed(2)}` });
  if (ps.free_cash_flow_per_share != null) perShareItems.push({ label: 'FCF/Share', value: `$${ps.free_cash_flow_per_share.toFixed(2)}` });

  // Simple fair value estimate: EPS * (1 + growth) * PE
  const epsVal = epsDiluted;
  const growthRate = growth.earnings_growth ?? growth.revenue_growth;
  const fairValue = epsVal != null && val.pe_ratio != null && growthRate != null
    ? epsVal * (1 + growthRate) * val.pe_ratio
    : null;

  return (
    <div className="space-y-6">
      {/* Fair value estimate */}
      {fairValue != null && currentPrice != null && (
        <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-700">
          <h3 className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">Simple fair value estimate</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Current price</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatPrice(currentPrice)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Estimated fair value</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatPrice(fairValue)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Upside / Downside</p>
              <p className={cn(
                'mt-1 text-lg font-semibold tabular-nums',
                fairValue > currentPrice ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
              )}>
                {fairValue > currentPrice ? '+' : ''}{(((fairValue - currentPrice) / currentPrice) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            Based on forward EPS growth ({((growthRate ?? 0) * 100).toFixed(1)}%) applied to current P/E. For illustration only.
          </p>
        </div>
      )}

      {/* Valuation multiples */}
      {valuationItems.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">Valuation multiples</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {valuationItems.map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
                <p className="text-xs text-slate-400 dark:text-slate-500">{item.label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profitability */}
      {profitItems.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">Profitability</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {profitItems.map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
                <p className="text-xs text-slate-400 dark:text-slate-500">{item.label}</p>
                <p className={cn(
                  'mt-1 text-lg font-semibold tabular-nums',
                  item.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                )}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-share metrics */}
      {perShareItems.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">Per-share metrics</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {perShareItems.map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
                <p className="text-xs text-slate-400 dark:text-slate-500">{item.label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Peers tab ───────────────────────────────────────────────────────

function PeersTab({ data }: { data: import('../hooks/usePeers').PeersData }) {
  const peerList = data.peers ?? [];
  if (peerList.length === 0) return <p className="text-sm text-slate-500">No peer data available.</p>;

  const metricKeys = peerList.length > 0
    ? Object.keys(peerList[0].metrics ?? {}).slice(0, 6)
    : [];

  return (
    <div className="space-y-4">
      {data.sector && (
        <p className="text-xs text-slate-400 dark:text-slate-500">Sector: {data.sector}</p>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Ticker</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Name</th>
              {metricKeys.map((k) => (
                <th key={k} className="px-4 py-2 text-right text-xs font-medium text-slate-500">
                  {k.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {peerList.map((peer) => (
              <tr key={peer.ticker} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                <td className="px-4 py-2">
                  <Link
                    to={`/company/${peer.ticker}`}
                    className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {peer.ticker}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{peer.name}</td>
                {metricKeys.map((k) => {
                  const m = peer.metrics?.[k];
                  return (
                    <td key={k} className="px-4 py-2 text-right">
                      <span className="tabular-nums text-slate-700 dark:text-slate-300">
                        {m != null ? (typeof m === 'object' ? m.value?.toLocaleString(undefined, { maximumFractionDigits: 2 }) : (m as number).toLocaleString(undefined, { maximumFractionDigits: 2 })) : '—'}
                      </span>
                      {m != null && typeof m === 'object' && m.percentile != null && (
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              m.percentile >= 70 ? 'bg-emerald-500' : m.percentile <= 30 ? 'bg-red-500' : 'bg-amber-500',
                            )}
                            style={{ width: `${m.percentile}%` }}
                          />
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Ownership tab ───────────────────────────────────────────────────

function OwnershipTab({ data }: { data: import('../hooks/useOwnership').OwnershipData }) {
  const institutions = data.institutions ?? [];
  if (institutions.length === 0) return <p className="text-sm text-slate-500">No ownership data available.</p>;

  // Aggregate summary: total unique holders, total value, total shares
  const allHoldings = institutions.flatMap((inst) =>
    (inst.holdings ?? []).map((h) => ({ ...h, investor_name: inst.investor_name, form_date: inst.form_date }))
  );
  const totalShares = allHoldings.reduce((s, h) => s + (h.shares ?? 0), 0);
  const totalValue = allHoldings.reduce((s, h) => s + (h.value ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
          <p className="text-xs text-slate-400 dark:text-slate-500">Institutional holders</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{institutions.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
          <p className="text-xs text-slate-400 dark:text-slate-500">Total shares held</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{totalShares.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
          <p className="text-xs text-slate-400 dark:text-slate-500">Total value</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatPrice(totalValue)}</p>
        </div>
      </div>

      {/* Holdings by institution */}
      {institutions.map((inst) => (
        <div key={inst.cik ?? inst.investor_name} className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">{inst.investor_name}</h3>
            {inst.form_date && <span className="text-xs text-slate-400">{inst.form_date}</span>}
          </div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Holding</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Shares</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Value ($1k)</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Sole voting</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Shared voting</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(inst.holdings ?? []).slice(0, 20).map((h, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                  <td className="px-4 py-2">
                    {h.ticker ? (
                      <Link to={`/company/${h.ticker}`} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                        {h.name || h.ticker}
                      </Link>
                    ) : (
                      <span className="text-slate-700 dark:text-slate-300">{h.name || h.cusip}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{h.shares?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{h.value?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-500">{h.sole_voting?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-500">{h.shared_voting?.toLocaleString() ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
