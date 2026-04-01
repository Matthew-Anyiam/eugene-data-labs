import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useOntologyResolve,
  useOntologyEntity,
  useOntologyRelationships,
  useOntologySearch,
  useOntologyStats,
  useOntologyConvergence,
  useOntologySignals,
  useOntologyIngest,
} from '../hooks/useOntology';
import type { OntologyEntity, OntologyEdge, ConvergenceAlert } from '../hooks/useOntology';
import {
  Search, Network, Database, Activity, ChevronRight,
  Building2, User, FileText, TrendingUp, Landmark, Globe, Loader2,
  ArrowRight, ArrowLeft, Zap, BarChart3, Plus,
} from 'lucide-react';

const TYPE_ICONS: Record<string, typeof Building2> = {
  company: Building2,
  person: User,
  institution: Landmark,
  filing: FileText,
  transaction: TrendingUp,
  economic_indicator: BarChart3,
  crypto_asset: Globe,
};

const TYPE_COLORS: Record<string, string> = {
  company: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  person: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  institution: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  filing: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  transaction: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  economic_indicator: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  crypto_asset: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
};

const REL_COLORS: Record<string, string> = {
  officer_of: 'text-purple-500',
  holds: 'text-amber-500',
  filed: 'text-slate-500',
  transacted: 'text-green-500',
  peer_of: 'text-blue-500',
  exposed_to: 'text-cyan-500',
  operates: 'text-indigo-500',
  sanctioned_by: 'text-red-500',
  mentions: 'text-emerald-500',
  affects: 'text-orange-500',
};

export function OntologyPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<'search' | 'entity' | 'convergence' | 'stats'>('search');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();

  const stats = useOntologyStats();
  const searchResults = useOntologySearch(activeSearch || undefined, typeFilter);
  const resolveResults = useOntologyResolve(activeSearch, typeFilter);
  const entity = useOntologyEntity(selectedEntityId);
  const relationships = useOntologyRelationships(selectedEntityId);
  const signals = useOntologySignals(selectedEntityId);
  const convergence = useOntologyConvergence('24h');
  const ingest = useOntologyIngest();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery);
    setActiveTab('search');
  };

  const selectEntity = (id: string) => {
    setSelectedEntityId(id);
    setActiveTab('entity');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Network className="h-7 w-7 text-blue-500" />
            Entity Ontology
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Unified knowledge graph linking entities, relationships, and signals across all data sources
          </p>
        </div>
        {stats.data && (
          <div className="hidden gap-4 text-center sm:flex">
            <StatBadge label="Entities" value={stats.data.total_entities} />
            <StatBadge label="Edges" value={stats.data.total_edges} />
            <StatBadge label="Signals" value={stats.data.total_signals} />
          </div>
        )}
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entities by name, ticker, CIK..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <select
          value={typeFilter || ''}
          onChange={(e) => setTypeFilter(e.target.value || undefined)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">All types</option>
          <option value="company">Companies</option>
          <option value="person">People</option>
          <option value="institution">Institutions</option>
          <option value="filing">Filings</option>
          <option value="transaction">Transactions</option>
          <option value="economic_indicator">Indicators</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Search
        </button>
      </form>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {[
          { key: 'search', label: 'Search', icon: Search },
          { key: 'entity', label: 'Entity Detail', icon: Database },
          { key: 'convergence', label: 'Convergence', icon: Zap },
          { key: 'stats', label: 'Graph Stats', icon: BarChart3 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'search' && (
        <SearchTab
          searchResults={searchResults.data}
          resolveResults={resolveResults.data}
          isLoading={searchResults.isLoading || resolveResults.isLoading}
          onSelect={selectEntity}
          onIngest={(ticker) => ingest.mutate(ticker)}
          ingestPending={ingest.isPending}
          activeSearch={activeSearch}
        />
      )}

      {activeTab === 'entity' && (
        <EntityDetailTab
          entity={entity.data}
          relationships={relationships.data}
          signals={signals.data}
          isLoading={entity.isLoading}
          onSelect={selectEntity}
        />
      )}

      {activeTab === 'convergence' && (
        <ConvergenceTab
          data={convergence.data}
          isLoading={convergence.isLoading}
          onSelect={selectEntity}
        />
      )}

      {activeTab === 'stats' && (
        <StatsTab data={stats.data} isLoading={stats.isLoading} />
      )}
    </div>
  );
}

// --- Sub-components ---

function StatBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-1.5 dark:border-slate-700">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function SearchTab({
  searchResults,
  resolveResults,
  isLoading,
  onSelect,
  onIngest,
  ingestPending,
  activeSearch,
}: {
  searchResults: any;
  resolveResults: any;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onIngest: (ticker: string) => void;
  ingestPending: boolean;
  activeSearch: string;
}) {
  const entities = searchResults?.entities || [];
  const matches = resolveResults?.matches || [];
  const combined = [...matches, ...entities.filter((e: OntologyEntity) => !matches.find((m: OntologyEntity) => m.id === e.id))];

  if (!activeSearch) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 py-16 dark:border-slate-800">
        <Network className="mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
        <h3 className="mb-2 text-lg font-semibold">Entity Knowledge Graph</h3>
        <p className="mb-4 max-w-md text-center text-sm text-slate-500 dark:text-slate-400">
          Explore the unified entity graph — companies, people, institutions, indicators, and their
          relationships. Ingest entities to start building connections across data sources.
        </p>
        <div className="flex gap-2">
          {['AAPL', 'MSFT', 'NVDA', 'TSLA'].map((t) => (
            <button
              key={t}
              onClick={() => onIngest(t)}
              disabled={ingestPending}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <Plus className="h-3 w-3" />
              {t}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (combined.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 px-6 py-12 text-center dark:border-slate-800">
        <p className="text-slate-500">No entities found for "{activeSearch}"</p>
        <button
          onClick={() => onIngest(activeSearch.toUpperCase())}
          disabled={ingestPending}
          className="mt-3 flex items-center gap-1 mx-auto rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {ingestPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Ingest {activeSearch.toUpperCase()}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500">{combined.length} result{combined.length !== 1 ? 's' : ''}</p>
      {combined.map((entity: OntologyEntity) => (
        <EntityCard key={entity.id} entity={entity} onClick={() => onSelect(entity.id)} />
      ))}
    </div>
  );
}

function EntityCard({ entity, onClick }: { entity: OntologyEntity; onClick: () => void }) {
  const Icon = TYPE_ICONS[entity.entity_type] || Globe;
  const colorClass = TYPE_COLORS[entity.entity_type] || 'bg-slate-100 text-slate-700';

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colorClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{entity.canonical_name}</p>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="capitalize">{entity.entity_type.replace('_', ' ')}</span>
          {entity.source_id && <span>· {entity.source_id}</span>}
          {entity.source && <span>· {entity.source}</span>}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
  );
}

function EntityDetailTab({
  entity,
  relationships,
  signals,
  isLoading,
  onSelect,
}: {
  entity: OntologyEntity | undefined;
  relationships: any;
  signals: any;
  isLoading: boolean;
  onSelect: (id: string) => void;
}) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="rounded-xl border border-slate-200 px-6 py-12 text-center dark:border-slate-800">
        <Database className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-slate-500">Select an entity from search results to view details</p>
      </div>
    );
  }

  const Icon = TYPE_ICONS[entity.entity_type] || Globe;
  const colorClass = TYPE_COLORS[entity.entity_type] || 'bg-slate-100 text-slate-700';
  const outbound: OntologyEdge[] = relationships?.outbound || [];
  const inbound: OntologyEdge[] = relationships?.inbound || [];
  const signalList = signals?.signals || [];
  const signalSummary = signals?.summary || [];

  return (
    <div className="space-y-6">
      {/* Entity header */}
      <div className="flex items-start gap-4 rounded-xl border border-slate-200 p-5 dark:border-slate-700">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colorClass}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{entity.canonical_name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
              {entity.entity_type.replace('_', ' ')}
            </span>
            {entity.source && <span>Source: {entity.source}</span>}
            {entity.source_id && <span>· ID: {entity.source_id}</span>}
          </div>
          {entity.entity_type === 'company' && entity.attributes?.ticker && (
            <button
              onClick={() => navigate(`/company/${entity.attributes.ticker}`)}
              className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              View company page →
            </button>
          )}
        </div>
      </div>

      {/* Attributes */}
      {entity.attributes && Object.keys(entity.attributes).length > 0 && (
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="mb-2 text-sm font-semibold text-slate-500">Attributes</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(entity.attributes).map(([key, value]) => (
              value && (
                <div key={key}>
                  <p className="text-xs text-slate-400">{key.replace(/_/g, ' ')}</p>
                  <p className="truncate text-sm font-medium">
                    {typeof value === 'string' ? value.slice(0, 100) : String(value)}
                  </p>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* Aliases */}
      {entity.aliases && entity.aliases.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="mb-2 text-sm font-semibold text-slate-500">
            Aliases ({entity.aliases.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {entity.aliases.map((a, i) => (
              <span key={i} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs dark:bg-slate-800">
                {a.alias}
                {a.alias_type && <span className="ml-1 text-slate-400">({a.alias_type})</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Relationships */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Outbound */}
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-500">
            <ArrowRight className="h-4 w-4" />
            Outbound ({outbound.length})
          </h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {outbound.length === 0 && <p className="text-xs text-slate-400">No outbound relationships</p>}
            {outbound.map((edge) => (
              <button
                key={edge.id}
                onClick={() => onSelect(edge.target_id)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className={`text-xs font-medium ${REL_COLORS[edge.relationship] || 'text-slate-500'}`}>
                  {edge.relationship}
                </span>
                <span className="truncate">{edge.target_name || edge.target_id.slice(0, 8)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Inbound */}
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-500">
            <ArrowLeft className="h-4 w-4" />
            Inbound ({inbound.length})
          </h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {inbound.length === 0 && <p className="text-xs text-slate-400">No inbound relationships</p>}
            {inbound.map((edge) => (
              <button
                key={edge.id}
                onClick={() => onSelect(edge.source_id)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className={`text-xs font-medium ${REL_COLORS[edge.relationship] || 'text-slate-500'}`}>
                  {edge.relationship}
                </span>
                <span className="truncate">{edge.source_name || edge.source_id.slice(0, 8)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Signals */}
      {signalSummary.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-500">
            <Activity className="h-4 w-4" />
            Signals ({signalList.length})
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {signalSummary.map((s: any) => (
              <div key={s.signal_type} className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800">
                <p className="text-xs font-medium">{s.signal_type.replace(/_/g, ' ')}</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-lg font-bold">{s.count}</span>
                  <span className="text-xs text-slate-400">avg {(s.avg_magnitude * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConvergenceTab({
  data,
  isLoading,
  onSelect,
}: {
  data: any;
  isLoading: boolean;
  onSelect: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  const alerts: ConvergenceAlert[] = data?.alerts || [];

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 py-16 dark:border-slate-800">
        <Zap className="mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
        <h3 className="mb-2 text-lg font-semibold">No Convergence Alerts</h3>
        <p className="max-w-md text-center text-sm text-slate-500 dark:text-slate-400">
          Convergence alerts fire when multiple independent signal types co-occur on the same entity —
          e.g. insider selling + earnings miss + sentiment shift. Ingest entities to start detecting cross-signal patterns.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">{alerts.length} convergence alert{alerts.length !== 1 ? 's' : ''} in last 24h</p>
      {alerts.map((alert) => (
        <button
          key={alert.entity_id}
          onClick={() => onSelect(alert.entity_id)}
          className="w-full rounded-lg border border-slate-200 p-4 text-left transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{alert.entity_name}</p>
              <p className="text-xs text-slate-500 capitalize">{alert.entity_type}</p>
            </div>
            <div className="text-right">
              <div className={`text-lg font-bold ${
                alert.composite_risk > 0.7 ? 'text-red-500' :
                alert.composite_risk > 0.4 ? 'text-amber-500' : 'text-green-500'
              }`}>
                {(alert.composite_risk * 100).toFixed(0)}%
              </div>
              <p className="text-xs text-slate-400">risk score</p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {alert.signal_types.map((st) => (
              <span key={st} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                {st.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-4 text-xs text-slate-400">
            <span>{alert.signal_type_count} signal types</span>
            <span>{alert.total_signals} total signals</span>
            <span>avg magnitude: {(alert.avg_magnitude * 100).toFixed(0)}%</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function StatsTab({ data, isLoading }: { data: any; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-slate-500">No stats available</p>;
  }

  return (
    <div className="space-y-6">
      {/* Top-level stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Entities', value: data.total_entities, icon: Database },
          { label: 'Edges', value: data.total_edges, icon: Network },
          { label: 'Signals', value: data.total_signals, icon: Activity },
          { label: 'Aliases', value: data.total_aliases, icon: Search },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-slate-400" />
              <p className="text-xs text-slate-400">{label}</p>
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Breakdowns */}
      <div className="grid gap-4 sm:grid-cols-3">
        <BreakdownCard title="Entity Types" data={data.entity_breakdown} />
        <BreakdownCard title="Relationship Types" data={data.edge_breakdown} />
        <BreakdownCard title="Signal Types" data={data.signal_breakdown} />
      </div>
    </div>
  );
}

function BreakdownCard({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <h3 className="mb-3 text-sm font-semibold text-slate-500">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-xs text-slate-400">No data yet</p>
      ) : (
        <div className="space-y-2">
          {entries.map(([key, value]) => (
            <div key={key}>
              <div className="flex justify-between text-xs">
                <span>{key.replace(/_/g, ' ')}</span>
                <span className="tabular-nums font-medium">{value.toLocaleString()}</span>
              </div>
              <div className="mt-0.5 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-1.5 rounded-full bg-blue-500"
                  style={{ width: `${total > 0 ? (value / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
