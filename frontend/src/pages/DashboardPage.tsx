import { useState } from 'react';
import {
  useDashboardSummary,
  useConvergenceAlerts,
  useCompositeRisk,
} from '../hooks/useConvergence';
import type { ConvergenceAlert, CompositeRiskEntity } from '../hooks/useConvergence';
import {
  Activity, AlertTriangle, BarChart3, Loader2, Shield,
  TrendingUp, Zap, Clock, Database, Layers,
} from 'lucide-react';

const RISK_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  elevated: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  moderate: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  low: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

const RISK_BAR_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  elevated: 'bg-amber-500',
  moderate: 'bg-blue-400',
  low: 'bg-green-400',
};

const ENTITY_TYPE_ICONS: Record<string, string> = {
  company: '🏢',
  person: '👤',
  institution: '🏛️',
  filing: '📄',
  transaction: '💸',
  economic_indicator: '📊',
  crypto_asset: '₿',
  news_event: '📰',
  disaster_event: '🌊',
  conflict_event: '⚔️',
  sanction: '🚫',
};

const TIME_WINDOWS = [
  { key: '1h', label: '1H' },
  { key: '24h', label: '24H' },
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
];

export function DashboardPage() {
  const [timeWindow, setTimeWindow] = useState('24h');
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'risk'>('overview');

  const dashboard = useDashboardSummary(timeWindow);
  const alerts = useConvergenceAlerts(timeWindow);
  const risk = useCompositeRisk(timeWindow);

  const tabs = [
    { key: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { key: 'alerts' as const, label: 'Convergence Alerts', icon: AlertTriangle },
    { key: 'risk' as const, label: 'Risk Leaderboard', icon: Shield },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Activity className="h-7 w-7 text-violet-500" />
            Intelligence Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Cross-signal convergence scoring, alerts, and composite risk across all data streams
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
          {TIME_WINDOWS.map((tw) => (
            <button
              key={tw.key}
              onClick={() => setTimeWindow(tw.key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                timeWindow === tw.key
                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {tw.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-violet-500 text-violet-700 dark:text-violet-300'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab
          data={dashboard.data}
          isLoading={dashboard.isLoading}
        />
      )}
      {activeTab === 'alerts' && (
        <AlertsTab
          alerts={alerts.data?.alerts ?? []}
          isLoading={alerts.isLoading}
          totalAlerts={alerts.data?.total_alerts ?? 0}
        />
      )}
      {activeTab === 'risk' && (
        <RiskTab
          entities={risk.data?.entities ?? []}
          isLoading={risk.isLoading}
          total={risk.data?.total ?? 0}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({ data, isLoading }: { data: any; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
        <span className="ml-2 text-sm text-slate-500">Loading dashboard...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-slate-200 p-8 text-center dark:border-slate-700">
        <Database className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
        <h3 className="mt-3 font-medium text-slate-700 dark:text-slate-300">No data yet</h3>
        <p className="mt-1 text-sm text-slate-500">
          Ingest data via the Ontology page or API to see convergence signals here.
        </p>
      </div>
    );
  }

  const overview = data.overview || {};
  const riskDist = data.risk_distribution || {};
  const signalBreakdown = data.signal_breakdown || [];
  const entityBreakdown = data.entity_breakdown || [];
  const timeline = data.signal_timeline || [];
  const topAlerts = data.top_alerts || [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <KPICard
          label="Entities"
          value={overview.total_entities ?? 0}
          icon={Database}
          color="text-slate-500"
        />
        <KPICard
          label="Active"
          value={overview.active_entities ?? 0}
          icon={Zap}
          color="text-green-500"
        />
        <KPICard
          label="Signals"
          value={overview.total_signals ?? 0}
          icon={TrendingUp}
          color="text-blue-500"
        />
        <KPICard
          label="Signal Types"
          value={overview.signal_types_active ?? 0}
          icon={Layers}
          color="text-amber-500"
        />
        <KPICard
          label="Alerts"
          value={overview.convergence_alerts ?? 0}
          icon={AlertTriangle}
          color="text-red-500"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Risk Distribution */}
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <Shield className="h-4 w-4" /> Risk Distribution
          </h3>
          <div className="space-y-2">
            {Object.entries(riskDist).map(([level, count]) => {
              const total = Object.values(riskDist).reduce((a: number, b: any) => a + (b as number), 0) as number;
              const pct = total > 0 ? ((count as number) / total) * 100 : 0;
              return (
                <div key={level} className="flex items-center gap-3">
                  <span className="w-16 text-xs font-medium capitalize text-slate-600 dark:text-slate-400">{level}</span>
                  <div className="flex-1">
                    <div className="h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all ${RISK_BAR_COLORS[level] || 'bg-slate-400'}`}
                        style={{ width: `${Math.max(pct, 1)}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-8 text-right text-xs font-mono text-slate-500">{count as number}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Signal Timeline */}
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <BarChart3 className="h-4 w-4" /> Signal Timeline
          </h3>
          {timeline.length > 0 ? (
            <div className="flex h-32 items-end gap-0.5">
              {timeline.map((t: any, i: number) => {
                const maxCount = Math.max(...timeline.map((x: any) => x.count), 1);
                const height = Math.max((t.count / maxCount) * 100, 4);
                return (
                  <div
                    key={i}
                    className="group relative flex-1"
                    title={`${t.hour}: ${t.count} signals (avg: ${t.avg_magnitude})`}
                  >
                    <div
                      className="rounded-t bg-violet-400 transition-all hover:bg-violet-500 dark:bg-violet-600 dark:hover:bg-violet-500"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">No signal activity in this window</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Signal Breakdown */}
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <Zap className="h-4 w-4" /> Signal Breakdown
          </h3>
          {signalBreakdown.length > 0 ? (
            <div className="space-y-1.5">
              {signalBreakdown.slice(0, 10).map((s: any) => (
                <div key={s.signal_type} className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                    {s.signal_type.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{s.avg_magnitude.toFixed(2)} avg</span>
                    <span className="w-8 text-right font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{s.count}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-slate-400">No signals recorded</p>
          )}
        </div>

        {/* Entity Breakdown */}
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <Database className="h-4 w-4" /> Entity Breakdown
          </h3>
          {entityBreakdown.length > 0 ? (
            <div className="space-y-1.5">
              {entityBreakdown.slice(0, 10).map((e: any) => (
                <div key={e.entity_type} className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                  <span className="flex items-center gap-2">
                    <span>{ENTITY_TYPE_ICONS[e.entity_type] || '📁'}</span>
                    <span className="text-slate-600 dark:text-slate-400">
                      {e.entity_type.replace(/_/g, ' ')}
                    </span>
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{e.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-slate-400">No entities</p>
          )}
        </div>
      </div>

      {/* Top Alerts preview */}
      {topAlerts.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <AlertTriangle className="h-4 w-4 text-red-500" /> Top Convergence Alerts
          </h3>
          <div className="space-y-2">
            {topAlerts.map((alert: ConvergenceAlert) => (
              <AlertCard key={alert.entity_id} alert={alert} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alerts Tab
// ---------------------------------------------------------------------------

function AlertsTab({
  alerts,
  isLoading,
  totalAlerts,
}: {
  alerts: ConvergenceAlert[];
  isLoading: boolean;
  totalAlerts: number;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 p-8 text-center dark:border-slate-700">
        <AlertTriangle className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
        <h3 className="mt-3 font-medium text-slate-700 dark:text-slate-300">No convergence alerts</h3>
        <p className="mt-1 text-sm text-slate-500">
          Alerts appear when multiple independent signal types fire on the same entity within the time window.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">{totalAlerts} convergence alert{totalAlerts !== 1 ? 's' : ''} detected</p>
      {alerts.map((alert) => (
        <AlertCard key={alert.entity_id} alert={alert} expanded />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk Leaderboard Tab
// ---------------------------------------------------------------------------

function RiskTab({
  entities,
  isLoading,
  total,
}: {
  entities: CompositeRiskEntity[];
  isLoading: boolean;
  total: number;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 p-8 text-center dark:border-slate-700">
        <Shield className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
        <h3 className="mt-3 font-medium text-slate-700 dark:text-slate-300">No risk data</h3>
        <p className="mt-1 text-sm text-slate-500">
          Entities with signals will appear here ranked by composite risk score.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">{total} entities ranked by composite risk</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-400">Entity</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-400">Type</th>
              <th className="px-4 py-2.5 text-center font-medium text-slate-600 dark:text-slate-400">Risk</th>
              <th className="px-4 py-2.5 text-center font-medium text-slate-600 dark:text-slate-400">Score</th>
              <th className="px-4 py-2.5 text-center font-medium text-slate-600 dark:text-slate-400">Signals</th>
              <th className="px-4 py-2.5 text-center font-medium text-slate-600 dark:text-slate-400">Types</th>
              <th className="hidden px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-400 md:table-cell">Factors</th>
              <th className="hidden px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-400 lg:table-cell">Patterns</th>
            </tr>
          </thead>
          <tbody>
            {entities.map((entity) => (
              <tr key={entity.entity_id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/30">
                <td className="px-4 py-2.5">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{entity.entity_name}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-slate-500">{ENTITY_TYPE_ICONS[entity.entity_type] || '📁'} {entity.entity_type.replace(/_/g, ' ')}</span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${RISK_COLORS[entity.risk_level] || RISK_COLORS.moderate}`}>
                    {entity.risk_level}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className="font-mono text-sm font-bold">{(entity.composite_risk * 100).toFixed(0)}%</span>
                </td>
                <td className="px-4 py-2.5 text-center font-mono text-slate-500">{entity.total_signals}</td>
                <td className="px-4 py-2.5 text-center font-mono text-slate-500">{entity.signal_type_count}</td>
                <td className="hidden px-4 py-2.5 md:table-cell">
                  <div className="flex gap-1">
                    {Object.entries(entity.factors).map(([k, v]) => (
                      <span
                        key={k}
                        className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800"
                        title={`${k}: ${v}`}
                      >
                        {k.charAt(0).toUpperCase()}: {(v * 100).toFixed(0)}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="hidden px-4 py-2.5 lg:table-cell">
                  {entity.matched_patterns.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {entity.matched_patterns.map((p) => (
                        <span key={p} className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                          {p.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

function KPICard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: any;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function AlertCard({ alert, expanded }: { alert: ConvergenceAlert; expanded?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span>{ENTITY_TYPE_ICONS[alert.entity_type] || '📁'}</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{alert.entity_name}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${RISK_COLORS[alert.risk_level] || RISK_COLORS.moderate}`}>
              {alert.risk_level}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {alert.signal_types.map((st) => (
              <span key={st} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {st.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
            {(alert.composite_risk * 100).toFixed(0)}%
          </div>
          <div className="text-[11px] text-slate-400">
            {alert.signal_type_count} types / {alert.total_signals} signals
          </div>
        </div>
      </div>

      {/* Matched patterns */}
      {alert.matched_patterns.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {alert.matched_patterns.map((p) => (
            <span
              key={p.pattern}
              className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
              title={p.description}
            >
              {p.pattern.replace(/_/g, ' ')} ({(p.score * 100).toFixed(0)}%)
            </span>
          ))}
        </div>
      )}

      {/* Expanded breakdown */}
      {expanded && alert.breakdown.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {alert.breakdown.map((b) => (
              <div key={b.signal_type} className="rounded bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {b.signal_type.replace(/_/g, ' ')}
                  </span>
                  <span className="font-mono text-xs font-bold">{b.count}x</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span>avg: {b.avg_magnitude.toFixed(2)}</span>
                  <span>max: {b.max_magnitude.toFixed(2)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
                  <Clock className="h-2.5 w-2.5" />
                  {new Date(b.last_seen).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
