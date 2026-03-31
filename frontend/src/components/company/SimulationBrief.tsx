import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SimulationResponse, AgentDecision } from '../../hooks/useSimulation';
import {
  Activity,
  LineChart,
  Zap,
  UserCheck,
  Landmark,
  Globe,
  AlertTriangle,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface SimulationBriefProps {
  data: SimulationResponse | undefined;
  isLoading: boolean;
  error: unknown;
  onGenerate: (scenario?: string) => void;
  hasRequested: boolean;
}

const PERSONA_CONFIG: Record<string, { label: string; icon: typeof Activity; color: string }> = {
  analyst: { label: 'Analyst', icon: LineChart, color: 'text-blue-500' },
  trader: { label: 'Trader', icon: Zap, color: 'text-amber-500' },
  insider: { label: 'Insider', icon: UserCheck, color: 'text-emerald-500' },
  institutional: { label: 'Institutional', icon: Landmark, color: 'text-purple-500' },
  macro: { label: 'Macro', icon: Globe, color: 'text-rose-500' },
};

function ActionBadge({ action }: { action: string }) {
  const styles: Record<string, string> = {
    bullish: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    bearish: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  };
  return (
    <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize', styles[action] ?? styles.neutral)}>
      {action}
    </span>
  );
}

function ConfidenceBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-500">{pct}%</span>
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentDecision }) {
  const config = PERSONA_CONFIG[agent.persona] ?? PERSONA_CONFIG.analyst;
  const Icon = config.icon;
  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={cn('h-4 w-4', config.color)} />
        <span className="text-sm font-semibold">{config.label}</span>
        <ActionBadge action={agent.action} />
      </div>
      <ConfidenceBar value={agent.confidence} className="mb-2" />
      <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
        {agent.key_signal}
      </p>
      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
        {agent.reasoning}
      </p>
    </div>
  );
}

function ConsensusBadge({ consensus }: { consensus: string }) {
  const styles: Record<string, string> = {
    bullish: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400',
    bearish: 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400',
    neutral: 'border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-bold uppercase', styles[consensus] ?? styles.neutral)}>
      {consensus}
    </span>
  );
}

export function SimulationBrief({ data, isLoading, error, onGenerate, hasRequested }: SimulationBriefProps) {
  const navigate = useNavigate();
  const [scenarioInput, setScenarioInput] = useState('');

  // CTA — not yet requested
  if (!hasRequested) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 py-16 dark:border-slate-800">
        <Activity className="mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
        <h3 className="mb-2 text-lg font-semibold">Multi-Agent Market Simulation</h3>
        <p className="mb-4 max-w-lg text-center text-sm text-slate-500 dark:text-slate-400">
          Run 5 AI agent personas — Analyst, Trader, Insider, Institutional, and Macro — against
          real SEC and FRED data to produce emergent market predictions through simulated debate.
        </p>
        <div className="mb-4 flex w-full max-w-md items-center gap-2 px-4">
          <input
            type="text"
            placeholder="Optional scenario (e.g. &quot;Fed cuts rates 50bps&quot;)"
            value={scenarioInput}
            onChange={(e) => setScenarioInput(e.target.value)}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:placeholder:text-slate-600"
          />
        </div>
        <button
          onClick={() => onGenerate(scenarioInput || undefined)}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Run Simulation
        </button>
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          Premium feature &middot; 3 free runs/day &middot; Powered by Claude &middot; Not investment advice
        </p>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 py-16 dark:border-slate-800">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <p className="text-sm font-medium">Running multi-agent simulation...</p>
        <p className="mt-1 text-xs text-slate-400">
          5 AI agents analyzing SEC filings, technicals, insider trades, holdings, and macro data — 30-60 seconds
        </p>
      </div>
    );
  }

  // Rate limited
  if (data?.rate_limited) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-blue-200 bg-blue-50 py-16 dark:border-blue-900/50 dark:bg-blue-950/30">
        <Lock className="mb-4 h-10 w-10 text-blue-400" />
        <h3 className="mb-2 text-lg font-semibold">Daily Limit Reached</h3>
        <p className="mb-6 max-w-md text-center text-sm text-slate-600 dark:text-slate-400">
          You've used all 3 free simulation runs for today. Upgrade to Pro for unlimited AI-powered market simulations.
        </p>
        <button
          onClick={() => navigate('/pricing')}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Upgrade to Pro — $29/mo
        </button>
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          Limit resets in 24 hours
        </p>
      </div>
    );
  }

  // Error
  if (error || data?.error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 dark:border-red-900/50 dark:bg-red-950/30">
        <p className="text-sm font-medium text-red-800 dark:text-red-300">
          {data?.error || (error as Error)?.message || 'Simulation failed'}
        </p>
        <button
          onClick={() => onGenerate()}
          className="mt-3 text-sm text-red-600 underline hover:text-red-700 dark:text-red-400"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data?.consensus) return null;

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Market Simulation</h3>
        </div>
        <ConsensusBadge consensus={data.consensus} />
        {data.scenario && (
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            Scenario: {data.scenario}
          </span>
        )}
      </div>

      {/* Confidence + Convergence meters */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Overall Confidence</p>
          <ConfidenceBar value={data.confidence ?? 0} />
        </div>
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Agent Convergence</p>
          <ConfidenceBar value={data.convergence_score ?? 0} />
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {data.disclaimer || 'AI-generated simulation for informational purposes only. Not investment advice.'}
        </p>
      </div>

      {/* Agent decision cards */}
      <div>
        <h4 className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">Agent Decisions</h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.agent_decisions?.map((agent) => (
            <AgentCard key={agent.persona} agent={agent} />
          ))}
        </div>
      </div>

      {/* Key signals */}
      {data.key_signals && data.key_signals.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">Key Signals</h4>
          <ul className="space-y-1">
            {data.key_signals.map((signal, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                {signal}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Narrative synthesis */}
      {data.narrative && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <h4 className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">Synthesis</h4>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {data.narrative}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
        <span>
          Powered by Claude &middot; 5 agent personas &middot; Sources: SEC EDGAR, FRED, Form 4, 13F
        </span>
        <span>
          {data.remaining !== undefined
            ? `${data.remaining} free run${data.remaining !== 1 ? 's' : ''} remaining today`
            : ''}
        </span>
      </div>
    </div>
  );
}
