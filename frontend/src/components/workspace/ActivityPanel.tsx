import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, Globe, Zap, TrendingUp,
  Shield, Loader2, RefreshCw, X,
} from 'lucide-react';
import { eugeneApi } from '../../lib/api';
import { cn } from '../../lib/utils';

interface ActivityPanelProps {
  open: boolean;
  onClose: () => void;
}

interface SignalActivity {
  signal_type: string;
  count: number;
  avg_magnitude: number;
  max_magnitude: number;
}

interface ConvergenceAlert {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  composite_risk: number;
  signal_type_count: number;
  total_signals: number;
  signal_types: string[];
}

interface DeltaSummary {
  total_changes: number;
  direction: string;
  new_signals: string[];
  escalated: string[];
}

const SIGNAL_ICONS: Record<string, typeof AlertTriangle> = {
  news_sentiment: Globe,
  sanctions_match: Shield,
  disaster_event: AlertTriangle,
  conflict_event: AlertTriangle,
  port_congestion: TrendingUp,
  default: Zap,
};

const SIGNAL_COLORS: Record<string, string> = {
  news_sentiment: 'text-blue-500',
  sanctions_match: 'text-red-500',
  disaster_event: 'text-orange-500',
  conflict_event: 'text-red-400',
  port_congestion: 'text-amber-500',
  default: 'text-violet-500',
};

export function ActivityPanel({ open, onClose }: ActivityPanelProps) {
  const [tab, setTab] = useState<'signals' | 'alerts' | 'delta'>('signals');
  const [signals, setSignals] = useState<SignalActivity[]>([]);
  const [alerts, setAlerts] = useState<ConvergenceAlert[]>([]);
  const [delta, setDelta] = useState<DeltaSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, alertRes, deltaRes] = await Promise.allSettled([
        eugeneApi<{ signal_breakdown?: SignalActivity[] }>('/v1/ontology/dashboard?time_window=1h'),
        eugeneApi<{ alerts?: ConvergenceAlert[] }>('/v1/ontology/convergence?time_window=24h&min_signal_types=2&limit=10'),
        eugeneApi<{ summary?: DeltaSummary }>('/v1/world/convergence/delta'),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value?.signal_breakdown) {
        setSignals(dashRes.value.signal_breakdown);
      }
      if (alertRes.status === 'fulfilled' && alertRes.value?.alerts) {
        setAlerts(alertRes.value.alerts);
      }
      if (deltaRes.status === 'fulfilled' && deltaRes.value?.summary) {
        setDelta(deltaRes.value.summary);
      }
      setLastRefresh(new Date());
    } catch {
      // Silently fail — activity panel is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchActivity();
    }
  }, [open, fetchActivity]);

  if (!open) return null;

  const tabs = [
    { key: 'signals' as const, label: 'Signals', count: signals.length },
    { key: 'alerts' as const, label: 'Alerts', count: alerts.length },
    { key: 'delta' as const, label: 'Delta', count: delta?.total_changes ?? 0 },
  ];

  return (
    <div className="flex h-full w-72 flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b border-slate-200 px-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">Activity</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchActivity}
            disabled={loading}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            title="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 px-2 py-2 text-[11px] font-medium transition-colors',
              tab === t.key
                ? 'border-b-2 border-emerald-500 text-emerald-700 dark:text-emerald-400'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1 rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && !lastRefresh ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {tab === 'signals' && <SignalsView signals={signals} />}
            {tab === 'alerts' && <AlertsView alerts={alerts} />}
            {tab === 'delta' && <DeltaView delta={delta} />}
          </>
        )}
      </div>

      {/* Last refresh */}
      {lastRefresh && (
        <div className="border-t border-slate-200 px-3 py-1.5 dark:border-slate-800">
          <span className="text-[10px] text-slate-400">
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  );
}

function SignalsView({ signals }: { signals: SignalActivity[] }) {
  if (signals.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-sm text-slate-400">
        No signal activity in the last hour
      </div>
    );
  }

  return (
    <div className="space-y-0.5 p-2">
      {signals.map((s) => {
        const Icon = SIGNAL_ICONS[s.signal_type] || SIGNAL_ICONS.default;
        const color = SIGNAL_COLORS[s.signal_type] || SIGNAL_COLORS.default;
        return (
          <div
            key={s.signal_type}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} />
            <div className="flex-1 min-w-0">
              <span className="block truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                {s.signal_type.replace(/_/g, ' ')}
              </span>
              <span className="text-[10px] text-slate-400">
                avg {s.avg_magnitude.toFixed(2)} / max {s.max_magnitude.toFixed(2)}
              </span>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {s.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AlertsView({ alerts }: { alerts: ConvergenceAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-sm text-slate-400">
        No convergence alerts in 24h
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {alerts.map((a) => {
        const riskPct = (a.composite_risk * 100).toFixed(0);
        const riskColor =
          a.composite_risk > 0.7
            ? 'text-red-500'
            : a.composite_risk > 0.4
            ? 'text-amber-500'
            : 'text-blue-500';

        return (
          <Link
            key={a.entity_id}
            to={a.entity_type === 'company' ? `/company/${a.entity_name}` : '/dashboard'}
            className="block rounded-md px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            <div className="flex items-center justify-between">
              <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                {a.entity_name}
              </span>
              <span className={cn('text-xs font-bold', riskColor)}>{riskPct}%</span>
            </div>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {a.signal_types.slice(0, 3).map((st) => (
                <span
                  key={st}
                  className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-mono text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                >
                  {st.replace(/_/g, ' ')}
                </span>
              ))}
              {a.signal_types.length > 3 && (
                <span className="text-[9px] text-slate-400">+{a.signal_types.length - 3}</span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function DeltaView({ delta }: { delta: DeltaSummary | null }) {
  if (!delta) {
    return (
      <div className="px-3 py-8 text-center text-sm text-slate-400">
        No delta sweep data available
      </div>
    );
  }

  const directionColor =
    delta.direction === 'escalating'
      ? 'text-red-500'
      : delta.direction === 'deescalating'
      ? 'text-green-500'
      : 'text-slate-500';

  const directionIcon =
    delta.direction === 'escalating'
      ? '\u2191'
      : delta.direction === 'deescalating'
      ? '\u2193'
      : '\u2194';

  return (
    <div className="space-y-3 p-3">
      {/* Summary */}
      <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Changes</span>
          <span className="text-lg font-bold text-slate-800 dark:text-slate-200">{delta.total_changes}</span>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <span className="text-xs text-slate-500">Direction:</span>
          <span className={cn('text-xs font-semibold', directionColor)}>
            {directionIcon} {delta.direction}
          </span>
        </div>
      </div>

      {/* New signals */}
      {delta.new_signals.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            New Signals
          </h4>
          <div className="space-y-0.5">
            {delta.new_signals.map((s) => (
              <div key={s} className="flex items-center gap-2 rounded px-2 py-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Zap className="h-3 w-3" />
                {s.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Escalated */}
      {delta.escalated.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Escalated
          </h4>
          <div className="space-y-0.5">
            {delta.escalated.map((s) => (
              <div key={s} className="flex items-center gap-2 rounded px-2 py-1 text-xs text-orange-600 dark:text-orange-400">
                <AlertTriangle className="h-3 w-3" />
                {s.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
        </div>
      )}

      {delta.total_changes === 0 && (
        <div className="text-center text-xs text-slate-400">
          No changes since last sweep
        </div>
      )}
    </div>
  );
}
