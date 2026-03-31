import { useNavigate } from 'react-router-dom';
import type { ResearchResponse } from '../../hooks/useResearch';
import { useState } from 'react';
import { AlertTriangle, Brain, TrendingUp, Shield, Target, BarChart3, FileText, Sparkles, Lock, Users, Building2, Newspaper, Lightbulb } from 'lucide-react';

interface ResearchBriefProps {
  data: ResearchResponse | undefined;
  isLoading: boolean;
  error: unknown;
  onGenerate: (scenario?: string) => void;
  hasRequested: boolean;
}

const SECTIONS = [
  { key: 'company_overview', label: 'Company Overview', icon: FileText },
  { key: 'financial_health', label: 'Financial Health', icon: TrendingUp },
  { key: 'key_metrics', label: 'Key Metrics', icon: BarChart3 },
  { key: 'insider_activity', label: 'Insider Activity', icon: Users },
  { key: 'institutional_holdings', label: 'Institutional Holdings', icon: Building2 },
  { key: 'recent_events', label: 'Recent Events', icon: Newspaper },
  { key: 'recent_developments', label: 'Recent Developments', icon: Sparkles },
  { key: 'risk_factors', label: 'Risk Factors', icon: AlertTriangle },
  { key: 'competitive_position', label: 'Competitive Position', icon: Target },
  { key: 'outlook_summary', label: 'Outlook', icon: Shield },
  { key: 'scenario_analysis', label: 'Scenario Analysis', icon: Lightbulb },
] as const;

export function ResearchBrief({ data, isLoading, error, onGenerate, hasRequested }: ResearchBriefProps) {
  const navigate = useNavigate();
  const [scenario, setScenario] = useState('');

  if (!hasRequested) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 py-16 dark:border-slate-800">
        <Brain className="mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
        <h3 className="mb-2 text-lg font-semibold">AI Deep Research</h3>
        <p className="mb-6 max-w-md text-center text-sm text-slate-500 dark:text-slate-400">
          Generate a comprehensive research brief using SEC filings, insider trades,
          institutional holdings, 8-K events, financial metrics, and management commentary.
          Analysis is cached for 24 hours.
        </p>
        <div className="mb-4 w-full max-w-md">
          <input
            type="text"
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder="Optional: What if tariffs increase 25%?"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
          />
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Add a scenario to see how it would impact this company
          </p>
        </div>
        <button
          onClick={() => onGenerate(scenario || undefined)}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          {scenario ? 'Generate Scenario Research' : 'Generate Deep Research Brief'}
        </button>
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          Powered by Claude &middot; 3 free briefs/day &middot; Not investment advice
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 py-16 dark:border-slate-800">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <p className="text-sm font-medium">Running deep research analysis...</p>
        <p className="mt-1 text-xs text-slate-400">Gathering SEC filings, insider trades, holdings, and events — 15-30 seconds</p>
      </div>
    );
  }

  // Rate limit hit — show upgrade prompt
  if (data?.rate_limited) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-blue-200 bg-blue-50 py-16 dark:border-blue-900/50 dark:bg-blue-950/30">
        <Lock className="mb-4 h-10 w-10 text-blue-400" />
        <h3 className="mb-2 text-lg font-semibold">Daily Limit Reached</h3>
        <p className="mb-6 max-w-md text-center text-sm text-slate-600 dark:text-slate-400">
          You've used all 3 free research briefs for today. Upgrade to Pro for unlimited AI research analysis.
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

  if (error || data?.error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 dark:border-red-900/50 dark:bg-red-950/30">
        <p className="text-sm font-medium text-red-800 dark:text-red-300">
          {data?.error || (error as Error)?.message || 'Failed to generate research'}
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

  if (!data?.research) return null;

  const research = data.research;

  return (
    <div className="space-y-4">
      {/* Disclaimer banner */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {data.disclaimer || 'AI-generated analysis for informational purposes only. Not investment advice.'}
        </p>
      </div>

      {/* Research sections */}
      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map(({ key, label, icon: Icon }) => {
          const content = research[key as keyof typeof research];
          if (!content || content === 'Insufficient data available.') return null;

          return (
            <div
              key={key}
              className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                <h4 className="text-sm font-semibold">{label}</h4>
              </div>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {content}
              </p>
            </div>
          );
        })}
      </div>

      {/* Footer with remaining count and data sources */}
      <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
        <span>
          Powered by Claude &middot; Sources: SEC EDGAR, Form 4, 13F, 8-K
        </span>
        <span>
          {data.remaining !== undefined
            ? `${data.remaining} free brief${data.remaining !== 1 ? 's' : ''} remaining today`
            : ''}
        </span>
      </div>
    </div>
  );
}
