import { useNavigate } from 'react-router-dom';
import type { DebateResponse } from '../../hooks/useDebate';
import { AlertTriangle, TrendingUp, TrendingDown, Scale, Lock } from 'lucide-react';

interface DebateBriefProps {
  data: DebateResponse | undefined;
  isLoading: boolean;
  error: unknown;
  onGenerate: () => void;
  hasRequested: boolean;
}

const CONVICTION_COLORS: Record<string, string> = {
  'strong-bull': 'bg-green-600 text-white',
  'moderate-bull': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'neutral': 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
  'moderate-bear': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  'strong-bear': 'bg-red-600 text-white',
};

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-2 rounded-full bg-blue-500"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-slate-500">{Math.round(value * 100)}%</span>
    </div>
  );
}

export function DebateBrief({ data, isLoading, error, onGenerate, hasRequested }: DebateBriefProps) {
  const navigate = useNavigate();

  if (!hasRequested) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 py-16 dark:border-slate-800">
        <Scale className="mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
        <h3 className="mb-2 text-lg font-semibold">Bull/Bear Debate</h3>
        <p className="mb-6 max-w-md text-center text-sm text-slate-500 dark:text-slate-400">
          Two AI agents argue opposing investment cases using real SEC data,
          then a third synthesizes a balanced verdict with conviction score.
        </p>
        <button
          onClick={onGenerate}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Start Bull/Bear Debate
        </button>
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          3 AI calls per debate &middot; Uses same daily limit as research
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 py-16 dark:border-slate-800">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <p className="text-sm font-medium">Running bull/bear debate...</p>
        <p className="mt-1 text-xs text-slate-400">3 AI agents analyzing SEC data — 20-40 seconds</p>
      </div>
    );
  }

  if (data?.rate_limited) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-blue-200 bg-blue-50 py-16 dark:border-blue-900/50 dark:bg-blue-950/30">
        <Lock className="mb-4 h-10 w-10 text-blue-400" />
        <h3 className="mb-2 text-lg font-semibold">Daily Limit Reached</h3>
        <p className="mb-6 max-w-md text-center text-sm text-slate-600 dark:text-slate-400">
          You've used all 3 free research briefs for today.
        </p>
        <button
          onClick={() => navigate('/pricing')}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Upgrade to Pro
        </button>
      </div>
    );
  }

  if (error || data?.error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 dark:border-red-900/50 dark:bg-red-950/30">
        <p className="text-sm font-medium text-red-800 dark:text-red-300">
          {data?.error || (error as Error)?.message || 'Failed to generate debate'}
        </p>
        <button onClick={onGenerate} className="mt-3 text-sm text-red-600 underline hover:text-red-700 dark:text-red-400">
          Try again
        </button>
      </div>
    );
  }

  if (!data?.bull_case && !data?.bear_case) return null;

  return (
    <div className="space-y-4">
      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {data?.disclaimer || 'AI-generated analysis for informational purposes only. Not investment advice.'}
        </p>
      </div>

      {/* Bull and Bear cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Bull Case */}
        {data?.bull_case && (
          <div className="rounded-lg border-2 border-green-200 p-5 dark:border-green-900/50">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              <h4 className="font-semibold text-green-700 dark:text-green-300">Bull Case</h4>
            </div>
            <p className="mb-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {data.bull_case.thesis}
            </p>
            <ul className="mb-3 space-y-1.5">
              {data.bull_case.key_points?.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span className="mt-0.5 text-green-500">+</span>
                  {point}
                </li>
              ))}
            </ul>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Confidence</p>
              <ConfidenceBar value={data.bull_case.confidence} />
            </div>
          </div>
        )}

        {/* Bear Case */}
        {data?.bear_case && (
          <div className="rounded-lg border-2 border-red-200 p-5 dark:border-red-900/50">
            <div className="mb-3 flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
              <h4 className="font-semibold text-red-700 dark:text-red-300">Bear Case</h4>
            </div>
            <p className="mb-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {data.bear_case.thesis}
            </p>
            <ul className="mb-3 space-y-1.5">
              {data.bear_case.key_points?.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span className="mt-0.5 text-red-500">&ndash;</span>
                  {point}
                </li>
              ))}
            </ul>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Confidence</p>
              <ConfidenceBar value={data.bear_case.confidence} />
            </div>
          </div>
        )}
      </div>

      {/* Synthesis */}
      {data?.synthesis && (
        <div className="rounded-lg border-2 border-purple-200 p-5 dark:border-purple-900/50">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <h4 className="font-semibold text-purple-700 dark:text-purple-300">Synthesis</h4>
            </div>
            {data.synthesis.conviction && (
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${CONVICTION_COLORS[data.synthesis.conviction] || CONVICTION_COLORS.neutral}`}>
                {data.synthesis.conviction.replace('-', ' ')}
              </span>
            )}
          </div>
          <p className="mb-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {data.synthesis.verdict}
          </p>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {data.synthesis.summary}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {data.synthesis.key_catalysts?.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-green-600 dark:text-green-400">Key Catalysts</p>
                <ul className="space-y-1">
                  {data.synthesis.key_catalysts.map((c, i) => (
                    <li key={i} className="text-xs text-slate-600 dark:text-slate-400">+ {c}</li>
                  ))}
                </ul>
              </div>
            )}
            {data.synthesis.key_risks?.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-red-600 dark:text-red-400">Key Risks</p>
                <ul className="space-y-1">
                  {data.synthesis.key_risks.map((r, i) => (
                    <li key={i} className="text-xs text-slate-600 dark:text-slate-400">&ndash; {r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
        <span>Powered by Claude &middot; 3 AI agents &middot; Sources: SEC EDGAR</span>
        <span>
          {data?.remaining !== undefined
            ? `${data.remaining} free brief${data.remaining !== 1 ? 's' : ''} remaining today`
            : ''}
        </span>
      </div>
    </div>
  );
}
