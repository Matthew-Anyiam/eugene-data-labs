import { useState } from 'react';
import { useResearch, type ResearchResponse, type ResearchBrief } from '../../hooks/useResearch';
import { useDebate, type DebateResponse } from '../../hooks/useDebate';
import { useSimulation, type SimulationResponse } from '../../hooks/useSimulation';
import { cn } from '../../lib/utils';
import {
  Brain, Swords, FlaskConical, Loader2, Sparkles, AlertCircle,
  ChevronDown, ChevronUp, TrendingUp, TrendingDown, Scale,
  Shield, Target, BarChart3, FileText, Users, Building2,
  Newspaper, Lightbulb, Activity, AlertTriangle,
} from 'lucide-react';

type AITab = 'research' | 'debate' | 'simulation';

export function AIResearchPanel({ ticker }: { ticker: string }) {
  const [activeTab, setActiveTab] = useState<AITab>('research');
  const [simScenario, setSimScenario] = useState('revenue decline 20%');

  // Research state
  const [researchRequested, setResearchRequested] = useState(false);
  const [researchScenario, setResearchScenario] = useState<string | undefined>();
  const research = useResearch(ticker, researchRequested, researchScenario);

  // Debate state
  const [debateRequested, setDebateRequested] = useState(false);
  const debate = useDebate(ticker, debateRequested);

  // Simulation state
  const [simulationRequested, setSimulationRequested] = useState(false);
  const [simulationScenarioCommitted, setSimulationScenarioCommitted] = useState<string | undefined>();
  const simulation = useSimulation(ticker, simulationRequested, simulationScenarioCommitted);

  const tabs: { key: AITab; label: string; Icon: typeof Brain }[] = [
    { key: 'research', label: 'AI Research', Icon: Brain },
    { key: 'debate', label: 'Bull vs Bear', Icon: Swords },
    { key: 'simulation', label: 'Scenario Sim', Icon: FlaskConical },
  ];

  return (
    <div className="space-y-4">
      {/* Tab selector */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              activeTab === key
                ? 'bg-white text-slate-900 shadow-sm dark:bg-indigo-600 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'research' && (
        <ResearchView
          data={research.data}
          isLoading={research.isLoading}
          error={research.error}
          hasRequested={researchRequested}
          onGenerate={(scenario?: string) => {
            setResearchScenario(scenario);
            setResearchRequested(true);
          }}
        />
      )}
      {activeTab === 'debate' && (
        <DebateView
          data={debate.data}
          isLoading={debate.isLoading}
          error={debate.error}
          hasRequested={debateRequested}
          onGenerate={() => setDebateRequested(true)}
        />
      )}
      {activeTab === 'simulation' && (
        <SimulationView
          data={simulation.data}
          isLoading={simulation.isLoading}
          error={simulation.error}
          hasRequested={simulationRequested}
          scenario={simScenario}
          onScenarioChange={setSimScenario}
          onGenerate={(scenario: string) => {
            setSimulationScenarioCommitted(scenario);
            setSimulationRequested(true);
          }}
        />
      )}
    </div>
  );
}

// ─── Research View ──────────────────────────────────────────────────────

const RESEARCH_SECTIONS = [
  { key: 'company_overview', label: 'Company Overview', icon: FileText },
  { key: 'financial_health', label: 'Financial Health', icon: TrendingUp },
  { key: 'key_metrics', label: 'Key Metrics', icon: BarChart3 },
  { key: 'insider_activity', label: 'Insider Activity', icon: Users },
  { key: 'institutional_holdings', label: 'Institutional Holdings', icon: Building2 },
  { key: 'recent_events', label: 'Recent Events', icon: Newspaper },
  { key: 'recent_developments', label: 'Recent Developments', icon: Sparkles },
  { key: 'risk_factors', label: 'Risk Factors', icon: AlertTriangle },
  { key: 'competitive_position', label: 'Competitive Position', icon: Target },
  { key: 'market_sentiment', label: 'Market Sentiment', icon: Activity },
  { key: 'outlook_summary', label: 'Outlook', icon: Shield },
  { key: 'scenario_analysis', label: 'Scenario Analysis', icon: Lightbulb },
] as const;

function ResearchView({
  data,
  isLoading,
  error,
  hasRequested,
  onGenerate,
}: {
  data: ResearchResponse | undefined;
  isLoading: boolean;
  error: unknown;
  hasRequested: boolean;
  onGenerate: (scenario?: string) => void;
}) {
  const [scenario, setScenario] = useState('');

  if (!hasRequested) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">AI Deep Research</h3>
        </div>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          Generate a comprehensive research brief using SEC filings, insider trades,
          holdings, events, and financial metrics.
        </p>
        <div className="mb-3">
          <input
            type="text"
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder="Optional: What if tariffs increase 25%?"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder-slate-500"
          />
        </div>
        <button
          onClick={() => onGenerate(scenario || undefined)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
        >
          {scenario ? 'Generate Scenario Research' : 'Generate Research Brief'}
        </button>
        <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
          Powered by Claude -- 3 free briefs/day -- Not investment advice
        </p>
      </div>
    );
  }

  if (isLoading) return <LoadingCard text="Generating AI research brief..." />;
  if (data?.rate_limited) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-700/50 dark:bg-amber-900/20">
        <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-3.5 w-3.5" />
          Daily limit reached. Upgrade to Pro for unlimited research briefs.
        </div>
      </div>
    );
  }
  if (error || data?.error) return <ErrorCard text={data?.error || (error as Error)?.message || 'Research generation failed'} />;
  if (!data?.research) return <ErrorCard text="No research data available" />;

  const research = data.research;

  return (
    <div className="space-y-3">
      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/30">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-[10px] text-amber-700 dark:text-amber-300">
          {data.disclaimer || 'AI-generated analysis for informational purposes only. Not investment advice.'}
        </p>
      </div>

      {/* Research sections in compact grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {RESEARCH_SECTIONS.map(({ key, label, icon: Icon }) => {
          const content = research[key as keyof ResearchBrief];
          if (!content || content === 'Insufficient data available.') return null;

          return (
            <div
              key={key}
              className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</h4>
              </div>
              <p className="text-xs leading-relaxed text-slate-600 line-clamp-6 dark:text-slate-400">
                {content}
              </p>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
        <span>Powered by Claude -- Sources: SEC EDGAR, Form 4, 13F, 8-K</span>
        <span>
          {data.remaining !== undefined
            ? `${data.remaining} free brief${data.remaining !== 1 ? 's' : ''} remaining`
            : ''}
        </span>
      </div>
    </div>
  );
}

// ─── Debate View ────────────────────────────────────────────────────────

function DebateView({
  data,
  isLoading,
  error,
  hasRequested,
  onGenerate,
}: {
  data: DebateResponse | undefined;
  isLoading: boolean;
  error: unknown;
  hasRequested: boolean;
  onGenerate: () => void;
}) {
  const [expanded, setExpanded] = useState<'bull' | 'bear' | null>(null);

  if (!hasRequested) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex items-center gap-2 mb-3">
          <Swords className="h-4 w-4 text-purple-500 dark:text-purple-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Bull vs Bear Debate</h3>
        </div>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          Two AI agents argue opposing investment cases using real SEC data,
          then a third synthesizes a balanced verdict.
        </p>
        <button
          onClick={onGenerate}
          className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-purple-700"
        >
          Start Bull/Bear Debate
        </button>
        <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
          3 AI calls per debate -- Uses same daily limit as research
        </p>
      </div>
    );
  }

  if (isLoading) return <LoadingCard text="Running bull vs bear debate..." />;
  if (data?.rate_limited) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-700/50 dark:bg-amber-900/20">
        <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-3.5 w-3.5" />
          Daily limit reached.
        </div>
      </div>
    );
  }
  if (error || data?.error) return <ErrorCard text={data?.error || (error as Error)?.message || 'Debate generation failed'} />;
  if (!data?.bull_case && !data?.bear_case) return <ErrorCard text="No debate data available" />;

  return (
    <div className="space-y-3">
      {/* Bull case */}
      {data?.bull_case && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-700/50 dark:bg-emerald-900/10">
          <button
            onClick={() => setExpanded(expanded === 'bull' ? null : 'bull')}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Bull Case</h3>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                {Math.round(data.bull_case.confidence * 100)}% confidence
              </span>
            </div>
            {expanded === 'bull' ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>
          <div className={cn('mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400', expanded !== 'bull' && 'line-clamp-3')}>
            {data.bull_case.thesis}
          </div>
          {expanded === 'bull' && data.bull_case.key_points?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {data.bull_case.key_points.map((point, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <span className="mt-0.5 text-emerald-500">+</span>
                  {point}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Bear case */}
      {data?.bear_case && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-700/50 dark:bg-red-900/10">
          <button
            onClick={() => setExpanded(expanded === 'bear' ? null : 'bear')}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
              <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Bear Case</h3>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/50 dark:text-red-300">
                {Math.round(data.bear_case.confidence * 100)}% confidence
              </span>
            </div>
            {expanded === 'bear' ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>
          <div className={cn('mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400', expanded !== 'bear' && 'line-clamp-3')}>
            {data.bear_case.thesis}
          </div>
          {expanded === 'bear' && data.bear_case.key_points?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {data.bear_case.key_points.map((point, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <span className="mt-0.5 text-red-500">-</span>
                  {point}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Synthesis */}
      {data?.synthesis && (
        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-700/50 dark:bg-purple-900/10">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-400">Verdict</h3>
            </div>
            {data.synthesis.conviction && (
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                {data.synthesis.conviction.replace('-', ' ')}
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {data.synthesis.verdict}
          </p>
          {data.synthesis.summary && (
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-500">
              {data.synthesis.summary}
            </p>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {data.synthesis.key_catalysts?.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Key Catalysts
                </p>
                <ul className="space-y-0.5">
                  {data.synthesis.key_catalysts.map((c, i) => (
                    <li key={i} className="text-[11px] text-slate-600 dark:text-slate-400">
                      + {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.synthesis.key_risks?.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-semibold text-red-600 dark:text-red-400">
                  Key Risks
                </p>
                <ul className="space-y-0.5">
                  {data.synthesis.key_risks.map((r, i) => (
                    <li key={i} className="text-[11px] text-slate-600 dark:text-slate-400">
                      - {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
        <span>Powered by Claude -- 3 AI agents -- Sources: SEC EDGAR</span>
        <span>
          {data?.remaining !== undefined
            ? `${data.remaining} free brief${data.remaining !== 1 ? 's' : ''} remaining`
            : ''}
        </span>
      </div>
    </div>
  );
}

// ─── Simulation View ────────────────────────────────────────────────────

const SCENARIO_PRESETS = [
  'revenue decline 20%',
  'interest rates +200bps',
  'major competitor enters market',
  'supply chain disruption',
  'regulatory crackdown',
  'AI productivity boost',
];

function SimulationView({
  data,
  isLoading,
  error,
  hasRequested,
  scenario,
  onScenarioChange,
  onGenerate,
}: {
  data: SimulationResponse | undefined;
  isLoading: boolean;
  error: unknown;
  hasRequested: boolean;
  scenario: string;
  onScenarioChange: (s: string) => void;
  onGenerate: (scenario: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Scenario selector */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex items-center gap-2 mb-3">
          <FlaskConical className="h-4 w-4 text-purple-500 dark:text-purple-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Scenario Simulation</h3>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {SCENARIO_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => onScenarioChange(preset)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                scenario === preset
                  ? 'bg-purple-600 text-white'
                  : 'border border-slate-200 text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-white',
              )}
            >
              {preset}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={scenario}
            onChange={(e) => onScenarioChange(e.target.value)}
            placeholder="Custom scenario..."
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
          />
          <button
            onClick={() => onGenerate(scenario)}
            disabled={!scenario || isLoading}
            className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Simulate
          </button>
        </div>
        {!hasRequested && (
          <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
            Multi-agent simulation using analyst, trader, insider, institutional, and macro personas
          </p>
        )}
      </div>

      {isLoading && <LoadingCard text={`Simulating: "${scenario}"...`} />}
      {!isLoading && !!error && <ErrorCard text={String((error as Error)?.message || 'Simulation failed')} />}
      {!isLoading && data?.rate_limited && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-700/50 dark:bg-amber-900/20">
          <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-3.5 w-3.5" />
            Daily limit reached.
          </div>
        </div>
      )}

      {!isLoading && data && !data.rate_limited && !data.error && (
        <div className="space-y-3">
          {/* Consensus header */}
          {data.consensus && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Consensus</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                      data.consensus === 'bullish'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                        : data.consensus === 'bearish'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                    )}
                  >
                    {data.consensus}
                  </span>
                </div>
                {data.confidence != null && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {Math.round(data.confidence * 100)}% confidence
                  </span>
                )}
              </div>
              {data.narrative && (
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">{data.narrative}</p>
              )}
              {data.convergence_score != null && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 dark:text-slate-500">Convergence:</span>
                  <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-purple-500"
                      style={{ width: `${Math.min(data.convergence_score * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-slate-500">
                    {(data.convergence_score * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Agent decisions */}
          {data.agent_decisions && data.agent_decisions.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.agent_decisions.map((agent, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-lg border p-3',
                    agent.action === 'bullish'
                      ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-700/30 dark:bg-emerald-900/10'
                      : agent.action === 'bearish'
                        ? 'border-red-200 bg-red-50/50 dark:border-red-700/30 dark:bg-red-900/10'
                        : 'border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50',
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold capitalize text-slate-700 dark:text-slate-300">
                      {agent.persona}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-semibold uppercase',
                        agent.action === 'bullish'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : agent.action === 'bearish'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-slate-500',
                      )}
                    >
                      {agent.action}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-3 dark:text-slate-400">
                    {agent.reasoning}
                  </p>
                  {agent.key_signal && (
                    <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-500">
                      Key signal: {agent.key_signal}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Key signals */}
          {data.key_signals && data.key_signals.length > 0 && (
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <h4 className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">Key Signals</h4>
              <ul className="space-y-0.5">
                {data.key_signals.map((signal, i) => (
                  <li key={i} className="text-[11px] text-slate-600 dark:text-slate-400">
                    -- {signal}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shared utility components ──────────────────────────────────────────

function LoadingCard({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/50">
      <Loader2 className="h-5 w-5 animate-spin text-indigo-500 dark:text-indigo-400" />
      <span className="text-sm text-slate-500 dark:text-slate-400">{text}</span>
    </div>
  );
}

function ErrorCard({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-700/30 dark:bg-red-900/10 dark:text-red-400">
      <AlertCircle className="mr-1 inline h-4 w-4" />
      {text}
    </div>
  );
}
