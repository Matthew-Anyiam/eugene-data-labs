import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  Loader2, Network, AlertTriangle, ArrowLeft, ExternalLink,
  Database, Activity, Clock, Tag,
} from 'lucide-react';
import { eugeneApi } from '../lib/api';
import { cn } from '../lib/utils';

interface EntityData {
  id: string;
  canonical_name: string;
  entity_type: string;
  source: string;
  source_id: string;
  attributes: Record<string, any>;
  aliases: string[];
  created_at: string;
}

interface EntityRelationship {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  target_name?: string;
  source_name?: string;
  confidence?: number;
}

interface EntitySignal {
  id: string;
  signal_type: string;
  magnitude: number;
  occurred_at: string;
  metadata: Record<string, any>;
}

const ENTITY_ICONS: Record<string, string> = {
  company: '\uD83C\uDFE2',
  person: '\uD83D\uDC64',
  institution: '\uD83C\uDFDB\uFE0F',
  filing: '\uD83D\uDCC4',
  transaction: '\uD83D\uDCB8',
  economic_indicator: '\uD83D\uDCCA',
  crypto_asset: '\u20BF',
  news_event: '\uD83D\uDCF0',
  disaster_event: '\uD83C\uDF0A',
  conflict_event: '\u2694\uFE0F',
  sanction: '\uD83D\uDEAB',
};

const RISK_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  elevated: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  moderate: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  low: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

export function EntityPage() {
  const { entityId = '' } = useParams();
  const [entity, setEntity] = useState<EntityData | null>(null);
  const [relationships, setRelationships] = useState<EntityRelationship[]>([]);
  const [signals, setSignals] = useState<EntitySignal[]>([]);
  const [convergence, setConvergence] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'signals' | 'relationships'>('overview');

  useEffect(() => {
    if (!entityId) return;

    let cancelled = false;
    const fetchEntity = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch entity details
        const data = await eugeneApi<any>(`/v1/ontology/entities/${entityId}`);
        if (cancelled) return;

        if (data?.entity) {
          setEntity(data.entity);
        } else if (data?.id) {
          setEntity(data);
        } else {
          setError('Entity not found');
          setLoading(false);
          return;
        }

        // Fetch related data in parallel
        const [relRes, sigRes, convRes] = await Promise.allSettled([
          eugeneApi<any>(`/v1/ontology/entities/${entityId}/relationships`),
          eugeneApi<any>(`/v1/ontology/entities/${entityId}/signals?time_window=7d&limit=20`),
          eugeneApi<any>(`/v1/ontology/convergence?entity_id=${entityId}&time_window=24h`),
        ]);

        if (!cancelled) {
          if (relRes.status === 'fulfilled') {
            setRelationships(relRes.value?.relationships || relRes.value?.edges || []);
          }
          if (sigRes.status === 'fulfilled') {
            setSignals(sigRes.value?.signals || []);
          }
          if (convRes.status === 'fulfilled' && convRes.value?.alerts?.length > 0) {
            setConvergence(convRes.value.alerts[0]);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load entity');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchEntity();
    return () => { cancelled = true; };
  }, [entityId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
        <span className="ml-2 text-sm text-slate-500">Loading entity...</span>
      </div>
    );
  }

  if (error || !entity) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <Database className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
        <h2 className="mt-4 text-lg font-semibold text-slate-700 dark:text-slate-300">
          {error || 'Entity not found'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          The entity may have been deleted or the ID is invalid.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/ontology"
            className="flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            <Network className="h-4 w-4" />
            Go to Ontology
          </Link>
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const icon = ENTITY_ICONS[entity.entity_type] || '\uD83D\uDCC1';
  const tabs = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'signals' as const, label: `Signals (${signals.length})` },
    { key: 'relationships' as const, label: `Relationships (${relationships.length})` },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <div>
        <Link
          to="/ontology"
          className="mb-3 flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Ontology
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{icon}</span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {entity.canonical_name}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {entity.entity_type.replace(/_/g, ' ')}
                </span>
                {entity.source && (
                  <span className="text-xs text-slate-400">
                    via {entity.source}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Convergence risk badge */}
          {convergence && (
            <div className="text-right">
              <span className={cn(
                'rounded-full px-3 py-1 text-xs font-bold',
                RISK_COLORS[convergence.risk_level] || RISK_COLORS.moderate
              )}>
                {convergence.risk_level?.toUpperCase()}
              </span>
              <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-300">
                {(convergence.composite_risk * 100).toFixed(0)}% risk
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-violet-500 text-violet-700 dark:text-violet-300'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <OverviewSection entity={entity} convergence={convergence} signalCount={signals.length} relCount={relationships.length} />
      )}
      {activeTab === 'signals' && (
        <SignalsSection signals={signals} />
      )}
      {activeTab === 'relationships' && (
        <RelationshipsSection relationships={relationships} currentEntityId={entity.id} />
      )}
    </div>
  );
}

function OverviewSection({
  entity,
  convergence,
  signalCount,
  relCount,
}: {
  entity: EntityData;
  convergence: any;
  signalCount: number;
  relCount: number;
}) {
  const attrs = entity.attributes || {};
  const attrEntries = Object.entries(attrs).filter(([, v]) => v != null && v !== '');

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Signals (7d)" value={signalCount} icon={Activity} />
        <StatCard label="Relationships" value={relCount} icon={Network} />
        <StatCard label="Aliases" value={entity.aliases?.length || 0} icon={Tag} />
        <StatCard
          label="Created"
          value={entity.created_at ? new Date(entity.created_at).toLocaleDateString() : '—'}
          icon={Clock}
        />
      </div>

      {/* Aliases */}
      {entity.aliases && entity.aliases.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Aliases</h3>
          <div className="flex flex-wrap gap-2">
            {entity.aliases.map((alias, i) => (
              <span
                key={i}
                className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400"
              >
                {alias}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Attributes */}
      {attrEntries.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Attributes</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {attrEntries.map(([key, value]) => (
              <div key={key} className="flex justify-between rounded bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                <span className="text-xs text-slate-500">{key.replace(/_/g, ' ')}</span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Convergence detail */}
      {convergence && convergence.breakdown && (
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Convergence Breakdown (24h)
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {convergence.breakdown.map((b: any) => (
              <div key={b.signal_type} className="rounded bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {b.signal_type.replace(/_/g, ' ')}
                  </span>
                  <span className="font-mono text-xs font-bold">{b.count}x</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span>avg: {b.avg_magnitude?.toFixed(2)}</span>
                  <span>max: {b.max_magnitude?.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entity ID (debug/reference) */}
      <div className="text-[11px] text-slate-400">
        ID: <code className="rounded bg-slate-100 px-1 py-0.5 font-mono dark:bg-slate-800">{entity.id}</code>
        {entity.source_id && (
          <> | Source ID: <code className="rounded bg-slate-100 px-1 py-0.5 font-mono dark:bg-slate-800">{entity.source_id}</code></>
        )}
      </div>
    </div>
  );
}

function SignalsSection({ signals }: { signals: EntitySignal[] }) {
  if (signals.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 p-8 text-center dark:border-slate-700">
        <Activity className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
        <p className="mt-2 text-sm text-slate-500">No signals recorded in the last 7 days</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {signals.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between rounded-md border border-slate-100 px-4 py-2.5 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/30"
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                s.magnitude > 0.7 ? 'bg-red-500' : s.magnitude > 0.3 ? 'bg-amber-500' : 'bg-blue-400'
              )}
            />
            <div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {s.signal_type.replace(/_/g, ' ')}
              </span>
              {s.metadata && Object.keys(s.metadata).length > 0 && (
                <p className="mt-0.5 truncate text-xs text-slate-400" style={{ maxWidth: '300px' }}>
                  {s.metadata.title || s.metadata.name || s.metadata.type || JSON.stringify(s.metadata).slice(0, 60)}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="font-mono text-sm font-bold text-slate-600 dark:text-slate-400">
              {s.magnitude.toFixed(2)}
            </span>
            <p className="text-[10px] text-slate-400">
              {new Date(s.occurred_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RelationshipsSection({
  relationships,
  currentEntityId,
}: {
  relationships: EntityRelationship[];
  currentEntityId: string;
}) {
  if (relationships.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 p-8 text-center dark:border-slate-700">
        <Network className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
        <p className="mt-2 text-sm text-slate-500">No relationships found</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {relationships.map((r) => {
        const isOutbound = r.source_entity_id === currentEntityId;
        const linkedId = isOutbound ? r.target_entity_id : r.source_entity_id;
        const linkedName = isOutbound ? (r.target_name || linkedId) : (r.source_name || linkedId);

        return (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-md border border-slate-100 px-4 py-2.5 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/30"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">{isOutbound ? '\u2192' : '\u2190'}</span>
              <div>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {r.relationship_type.replace(/_/g, ' ')}
                </span>
                <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                  {linkedName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {r.confidence != null && (
                <span className="font-mono text-[10px] text-slate-400">
                  {(r.confidence * 100).toFixed(0)}%
                </span>
              )}
              <Link
                to={`/entity/${linkedId}`}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-[11px] text-slate-500">{label}</span>
      </div>
      <p className="mt-1 text-lg font-bold text-slate-800 dark:text-slate-100">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
