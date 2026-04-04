import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot, Brain, Swords, Users, Search, ArrowRight,
  FileText, TrendingUp, BarChart3, Shield, Zap,
  Loader2, AlertTriangle, Clock, Sparkles,
} from 'lucide-react';
import { useResearch } from '../hooks/useResearch';
import { useDebate } from '../hooks/useDebate';
import { useSimulation } from '../hooks/useSimulation';
import { cn } from '../lib/utils';

// Agent definitions
const AGENTS = [
  {
    id: 'research' as const,
    name: 'Research Analyst',
    description: 'Deep-dive company analysis across financials, risk factors, competitive position, and market sentiment',
    icon: Brain,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    accentColor: 'bg-blue-600',
    sections: ['Company Overview', 'Financial Health', 'Key Metrics', 'Risk Factors', 'Competitive Position', 'Outlook'],
    supportsScenario: true,
    estimatedTime: '15-30s',
  },
  {
    id: 'debate' as const,
    name: 'Bull/Bear Debater',
    description: 'Generates opposing investment theses with confidence scores, catalysts, and risk assessment',
    icon: Swords,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    accentColor: 'bg-amber-600',
    sections: ['Bull Case', 'Bear Case', 'Synthesis', 'Key Catalysts', 'Key Risks'],
    supportsScenario: false,
    estimatedTime: '20-40s',
  },
  {
    id: 'simulation' as const,
    name: 'Market Simulator',
    description: 'Multi-agent simulation with 5 personas (Analyst, Trader, Insider, Institutional, Macro) reaching consensus',
    icon: Users,
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
    accentColor: 'bg-violet-600',
    sections: ['5 Agent Personas', 'Consensus Direction', 'Confidence Score', 'Convergence', 'Key Signals'],
    supportsScenario: true,
    estimatedTime: '30-60s',
  },
];

type AgentId = typeof AGENTS[number]['id'];

export function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<AgentId | null>(null);
  const [ticker, setTicker] = useState('');
  const [scenario, setScenario] = useState('');
  const [activeTicker, setActiveTicker] = useState('');
  const [activeScenario, setActiveScenario] = useState<string | undefined>();
  const [requested, setRequested] = useState<Record<AgentId, boolean>>({
    research: false,
    debate: false,
    simulation: false,
  });

  const research = useResearch(activeTicker, requested.research, activeScenario);
  const debate = useDebate(activeTicker, requested.debate);
  const simulation = useSimulation(activeTicker, requested.simulation, activeScenario);

  const runAgent = useCallback(() => {
    const t = ticker.trim().toUpperCase();
    if (!t || !selectedAgent) return;
    setActiveTicker(t);
    setActiveScenario(scenario.trim() || undefined);
    setRequested((prev) => ({ ...prev, [selectedAgent]: true }));
  }, [ticker, scenario, selectedAgent]);

  const getAgentData = (id: AgentId) => {
    switch (id) {
      case 'research': return research;
      case 'debate': return debate;
      case 'simulation': return simulation;
    }
  };

  const activeAgent = selectedAgent ? AGENTS.find((a) => a.id === selectedAgent) : null;
  const activeData = selectedAgent ? getAgentData(selectedAgent) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Bot className="h-7 w-7 text-violet-500" />
          AI Agents
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Autonomous AI agents for deep research, investment debate, and multi-agent market simulation
        </p>
      </div>

      {/* Agent selector cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {AGENTS.map((agent) => {
          const isSelected = selectedAgent === agent.id;
          const data = getAgentData(agent.id);
          const hasResult = data?.data && !data.data.error;

          return (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent.id)}
              className={cn(
                'rounded-xl border p-5 text-left transition-all',
                isSelected
                  ? `${agent.borderColor} ${agent.bgColor} ring-2 ring-offset-0 ring-${agent.color.replace('text-', '')}`
                  : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
              )}
            >
              <div className="flex items-center justify-between">
                <div className={cn('rounded-lg p-2', agent.bgColor)}>
                  <agent.icon className={cn('h-5 w-5', agent.color)} />
                </div>
                {hasResult && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <Sparkles className="h-2.5 w-2.5" />
                    Ready
                  </span>
                )}
                {data?.isLoading && (
                  <Loader2 className={cn('h-4 w-4 animate-spin', agent.color)} />
                )}
              </div>
              <h3 className="mt-3 font-semibold text-slate-800 dark:text-slate-200">{agent.name}</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{agent.description}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {agent.sections.slice(0, 3).map((s) => (
                  <span key={s} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {s}
                  </span>
                ))}
                {agent.sections.length > 3 && (
                  <span className="text-[10px] text-slate-400">+{agent.sections.length - 3}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Agent workspace */}
      {selectedAgent && activeAgent && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700">
          {/* Agent workspace header */}
          <div className={cn('flex items-center justify-between rounded-t-xl border-b border-slate-200 px-5 py-4 dark:border-slate-700', activeAgent.bgColor)}>
            <div className="flex items-center gap-3">
              <activeAgent.icon className={cn('h-5 w-5', activeAgent.color)} />
              <div>
                <h2 className="font-semibold text-slate-800 dark:text-slate-200">{activeAgent.name}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <Clock className="mr-1 inline h-3 w-3" />
                  ~{activeAgent.estimatedTime} per run | 3 free/day
                </p>
              </div>
            </div>
            {activeTicker && requested[selectedAgent] && (
              <Link
                to={`/company/${activeTicker}?tab=${selectedAgent}`}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                View in {activeTicker} <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          {/* Input form */}
          <div className="space-y-3 px-5 py-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Ticker</label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    placeholder="AAPL, NVDA, TSLA..."
                    maxLength={10}
                    className="flex-1 bg-transparent text-sm font-mono placeholder:text-slate-400 focus:outline-none"
                    onKeyDown={(e) => { if (e.key === 'Enter') runAgent(); }}
                  />
                </div>
              </div>
              {activeAgent.supportsScenario && (
                <div className="flex-[2]">
                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Scenario (optional)</label>
                  <input
                    type="text"
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value)}
                    placeholder="e.g. What if tariffs increase 25%?"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                    onKeyDown={(e) => { if (e.key === 'Enter') runAgent(); }}
                  />
                </div>
              )}
            </div>
            <button
              onClick={runAgent}
              disabled={!ticker.trim() || activeData?.isLoading}
              className={cn(
                'flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-40',
                activeAgent.accentColor,
                'hover:brightness-110'
              )}
            >
              {activeData?.isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running {activeAgent.name}...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Run {activeAgent.name}
                </>
              )}
            </button>
          </div>

          {/* Results */}
          {activeData && requested[selectedAgent] && (
            <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-700">
              {activeData.isLoading && (
                <div className="flex flex-col items-center py-12">
                  <Loader2 className={cn('h-8 w-8 animate-spin', activeAgent.color)} />
                  <p className="mt-3 text-sm text-slate-500">
                    Running {activeAgent.name} on {activeTicker}...
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    This typically takes {activeAgent.estimatedTime}
                  </p>
                </div>
              )}

              {activeData.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-700 dark:text-red-300">
                      {(activeData.error as Error).message || 'Agent encountered an error'}
                    </span>
                  </div>
                </div>
              )}

              {!activeData.isLoading && !activeData.error && activeData.data && (
                <AgentResults agentId={selectedAgent} data={activeData.data} ticker={activeTicker} />
              )}
            </div>
          )}
        </div>
      )}

      {/* No agent selected placeholder */}
      {!selectedAgent && (
        <div className="rounded-xl border border-slate-200 p-12 text-center dark:border-slate-700">
          <Bot className="mx-auto h-12 w-12 text-slate-200 dark:text-slate-700" />
          <h3 className="mt-3 font-medium text-slate-600 dark:text-slate-400">Select an agent above</h3>
          <p className="mt-1 text-sm text-slate-400">
            Choose an AI agent to run deep analysis on any company
          </p>
        </div>
      )}

      {/* Agent comparison table */}
      <AgentComparisonTable />
    </div>
  );
}

// ─── Agent Results ────────────────────────────────────────────────────

function AgentResults({ agentId, data, ticker }: { agentId: AgentId; data: any; ticker: string }) {
  if (data.rate_limited) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center dark:border-blue-800 dark:bg-blue-900/20">
        <Shield className="mx-auto h-6 w-6 text-blue-500" />
        <p className="mt-2 text-sm font-medium text-blue-700 dark:text-blue-300">Daily limit reached</p>
        <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
          {data.remaining === 0 ? 'Upgrade for unlimited access' : `${data.remaining} runs remaining today`}
        </p>
        <Link
          to="/pricing"
          className="mt-3 inline-block rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
        >
          Upgrade Plan
        </Link>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
        <p className="text-sm text-red-700 dark:text-red-300">{data.error}</p>
      </div>
    );
  }

  switch (agentId) {
    case 'research':
      return <ResearchResults data={data} ticker={ticker} />;
    case 'debate':
      return <DebateResults data={data} ticker={ticker} />;
    case 'simulation':
      return <SimulationResults data={data} ticker={ticker} />;
    default:
      return null;
  }
}

function ResearchResults({ data }: { data: any; ticker: string }) {
  const brief = data.research;
  if (!brief) return <p className="text-sm text-slate-400">No research data returned</p>;

  const sections = [
    { key: 'company_overview', label: 'Company Overview', icon: FileText },
    { key: 'financial_health', label: 'Financial Health', icon: BarChart3 },
    { key: 'key_metrics', label: 'Key Metrics', icon: TrendingUp },
    { key: 'risk_factors', label: 'Risk Factors', icon: AlertTriangle },
    { key: 'competitive_position', label: 'Competitive Position', icon: Shield },
    { key: 'outlook_summary', label: 'Outlook Summary', icon: Sparkles },
  ].filter((s) => brief[s.key]);

  return (
    <div className="space-y-4">
      {data.disclaimer && (
        <p className="rounded bg-amber-50 p-2 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          {data.disclaimer}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <div key={s.key} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <div className="mb-2 flex items-center gap-2">
              <s.icon className="h-4 w-4 text-blue-500" />
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">{s.label}</h4>
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{brief[s.key]}</p>
          </div>
        ))}
      </div>
      {brief.scenario_analysis && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-900/10">
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-300">
            <Sparkles className="h-4 w-4" /> Scenario Analysis
          </h4>
          <p className="text-sm leading-relaxed text-blue-600 dark:text-blue-400">{brief.scenario_analysis}</p>
        </div>
      )}
      <ResultFooter data={data} />
    </div>
  );
}

function DebateResults({ data }: { data: any; ticker: string }) {
  const { bull_case, bear_case, synthesis } = data;

  return (
    <div className="space-y-4">
      {data.disclaimer && (
        <p className="rounded bg-amber-50 p-2 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          {data.disclaimer}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Bull case */}
        {bull_case && (
          <div className="rounded-lg border border-emerald-200 p-4 dark:border-emerald-800">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                <TrendingUp className="h-4 w-4" /> Bull Case
              </h4>
              <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                {(bull_case.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">{bull_case.thesis}</p>
            {bull_case.key_points?.length > 0 && (
              <ul className="space-y-1">
                {bull_case.key_points.map((p: string, i: number) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Bear case */}
        {bear_case && (
          <div className="rounded-lg border border-red-200 p-4 dark:border-red-800">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-red-700 dark:text-red-400">
                <TrendingUp className="h-4 w-4 rotate-180" /> Bear Case
              </h4>
              <span className="text-xs font-mono text-red-600 dark:text-red-400">
                {(bear_case.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">{bear_case.thesis}</p>
            {bear_case.key_points?.length > 0 && (
              <ul className="space-y-1">
                {bear_case.key_points.map((p: string, i: number) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-red-400" />
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Synthesis */}
      {synthesis && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-800 dark:bg-violet-900/10">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-violet-700 dark:text-violet-300">Synthesis</h4>
            {synthesis.conviction && (
              <ConvictionBadge conviction={synthesis.conviction} />
            )}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">{synthesis.summary || synthesis.verdict}</p>
        </div>
      )}

      <ResultFooter data={data} />
    </div>
  );
}

function SimulationResults({ data }: { data: any; ticker: string }) {
  const PERSONA_ICONS: Record<string, string> = {
    analyst: '📊', trader: '⚡', insider: '🔍', institutional: '🏛️', macro: '🌐',
  };

  return (
    <div className="space-y-4">
      {data.disclaimer && (
        <p className="rounded bg-amber-50 p-2 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          {data.disclaimer}
        </p>
      )}

      {/* Consensus header */}
      {data.consensus && (
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <div>
            <p className="text-xs text-slate-400">Consensus</p>
            <p className={cn(
              'text-lg font-bold capitalize',
              data.consensus === 'bullish' && 'text-emerald-600 dark:text-emerald-400',
              data.consensus === 'bearish' && 'text-red-600 dark:text-red-400',
              data.consensus === 'neutral' && 'text-slate-600 dark:text-slate-400',
            )}>
              {data.consensus}
            </p>
          </div>
          {data.confidence != null && (
            <div>
              <p className="text-xs text-slate-400">Confidence</p>
              <p className="text-lg font-bold font-mono">{(data.confidence * 100).toFixed(0)}%</p>
            </div>
          )}
          {data.convergence_score != null && (
            <div>
              <p className="text-xs text-slate-400">Convergence</p>
              <p className="text-lg font-bold font-mono">{(data.convergence_score * 100).toFixed(0)}%</p>
            </div>
          )}
        </div>
      )}

      {/* Agent decisions */}
      {data.agent_decisions?.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.agent_decisions.map((agent: any) => (
            <div key={agent.persona} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-semibold capitalize">
                  {PERSONA_ICONS[agent.persona] || '🤖'} {agent.persona}
                </span>
                <span className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  agent.action === 'bullish' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                  agent.action === 'bearish' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                  agent.action === 'neutral' && 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
                )}>
                  {agent.action}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    agent.action === 'bullish' ? 'bg-emerald-500' : agent.action === 'bearish' ? 'bg-red-500' : 'bg-slate-400',
                  )}
                  style={{ width: `${(agent.confidence || 0) * 100}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-3">{agent.reasoning}</p>
            </div>
          ))}
        </div>
      )}

      {/* Key signals */}
      {data.key_signals?.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h4 className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">Key Signals</h4>
          <ul className="space-y-1">
            {data.key_signals.map((s: string, i: number) => (
              <li key={i} className="flex items-start gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                <Zap className="mt-0.5 h-3 w-3 shrink-0 text-violet-500" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Narrative */}
      {data.narrative && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-800 dark:bg-violet-900/10">
          <h4 className="mb-2 text-xs font-semibold text-violet-700 dark:text-violet-300">Narrative Synthesis</h4>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{data.narrative}</p>
        </div>
      )}

      <ResultFooter data={data} />
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────

function ConvictionBadge({ conviction }: { conviction: string }) {
  const colors: Record<string, string> = {
    'strong-bull': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    'moderate-bull': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'neutral': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    'moderate-bear': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    'strong-bear': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-semibold', colors[conviction] || colors.neutral)}>
      {conviction.replace(/-/g, ' ')}
    </span>
  );
}

function ResultFooter({ data }: { data: any }) {
  return (
    <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-400 dark:border-slate-800">
      <div className="flex items-center gap-3">
        {data.source && <span>Source: {data.source}</span>}
        {data.model && <span>Model: {data.model}</span>}
        {data.tokens_used && <span>{data.tokens_used.toLocaleString()} tokens</span>}
      </div>
      {data.remaining != null && (
        <span>{data.remaining} run{data.remaining !== 1 ? 's' : ''} remaining today</span>
      )}
    </div>
  );
}

function AgentComparisonTable() {
  return (
    <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-700">
      <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Agent Capabilities</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="pb-2 text-left text-xs font-medium text-slate-500">Feature</th>
              <th className="pb-2 text-center text-xs font-medium text-blue-500">Research</th>
              <th className="pb-2 text-center text-xs font-medium text-amber-500">Debate</th>
              <th className="pb-2 text-center text-xs font-medium text-violet-500">Simulation</th>
            </tr>
          </thead>
          <tbody className="text-xs text-slate-600 dark:text-slate-400">
            {[
              ['Data Sources', 'SEC, Form 4, 13F, 8-K', 'SEC EDGAR', 'SEC, FRED, Form 4, 13F'],
              ['Custom Scenarios', 'Yes', 'No', 'Yes'],
              ['Output Sections', '12', '5', '7+'],
              ['Agent Personas', '1', '2 (Bull/Bear)', '5'],
              ['Confidence Score', 'No', 'Per case', 'Per agent + overall'],
              ['Estimated Time', '15-30s', '20-40s', '30-60s'],
              ['Free Runs/Day', '3', '3', '3'],
            ].map(([feature, ...values]) => (
              <tr key={feature} className="border-b border-slate-50 dark:border-slate-800/50">
                <td className="py-2 font-medium text-slate-500">{feature}</td>
                {values.map((v, i) => (
                  <td key={i} className="py-2 text-center">{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
