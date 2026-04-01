import { useQuery, useMutation } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';

// --- Types ---

export interface OntologyEntity {
  id: string;
  entity_type: string;
  canonical_name: string;
  attributes: Record<string, any>;
  source?: string;
  source_id?: string;
  created_at?: string;
  updated_at?: string;
  aliases?: { alias: string; alias_type: string; source?: string }[];
  relationship_counts?: {
    outbound: Record<string, number>;
    inbound: Record<string, number>;
  };
  match_score?: number;
  match_type?: string;
}

export interface OntologyEdge {
  id: string;
  source_id: string;
  target_id: string;
  relationship: string;
  attributes: Record<string, any>;
  confidence?: number;
  valid_from?: string;
  valid_to?: string;
  target_name?: string;
  target_type?: string;
  source_name?: string;
  source_type?: string;
}

export interface TraversalResult {
  root: string;
  max_depth: number;
  nodes: (OntologyEntity & { depth: number })[];
  edges: OntologyEdge[];
  node_count: number;
  edge_count: number;
}

export interface ConvergenceAlert {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  signal_type_count: number;
  total_signals: number;
  composite_risk: number;
  avg_magnitude: number;
  max_magnitude: number;
  signal_types: string[];
  breakdown: {
    signal_type: string;
    count: number;
    avg_magnitude: number;
    max_magnitude: number;
    first_seen: string;
    last_seen: string;
  }[];
}

export interface OntologyStats {
  total_entities: number;
  total_edges: number;
  total_signals: number;
  total_aliases: number;
  entity_breakdown: Record<string, number>;
  edge_breakdown: Record<string, number>;
  signal_breakdown: Record<string, number>;
}

export interface IngestResult {
  ticker?: string;
  entities: number;
  edges: number;
  signals: number;
  errors: string[];
}

// --- Hooks ---

export function useOntologyResolve(query: string, type?: string) {
  return useQuery<{ query: string; matches: OntologyEntity[] }>({
    queryKey: ['ontology', 'resolve', query, type],
    queryFn: () =>
      eugeneApi('/v1/ontology/resolve', { q: query, type, limit: 10 }),
    enabled: query.length >= 1,
    staleTime: 60 * 1000,
  });
}

export function useOntologyEntity(entityId: string | undefined) {
  return useQuery<OntologyEntity>({
    queryKey: ['ontology', 'entity', entityId],
    queryFn: () => eugeneApi(`/v1/ontology/entity/${entityId}`),
    enabled: !!entityId,
    staleTime: 30 * 1000,
  });
}

export function useOntologyRelationships(
  entityId: string | undefined,
  relationship?: string,
  direction: string = 'both',
) {
  return useQuery<{ entity_id: string; outbound: OntologyEdge[]; inbound: OntologyEdge[] }>({
    queryKey: ['ontology', 'relationships', entityId, relationship, direction],
    queryFn: () =>
      eugeneApi(`/v1/ontology/entity/${entityId}/relationships`, {
        relationship,
        direction,
        limit: 50,
      }),
    enabled: !!entityId,
    staleTime: 30 * 1000,
  });
}

export function useOntologyTraverse(
  entityId: string | undefined,
  depth: number = 2,
  relationship?: string,
) {
  return useQuery<TraversalResult>({
    queryKey: ['ontology', 'traverse', entityId, depth, relationship],
    queryFn: () =>
      eugeneApi(`/v1/ontology/entity/${entityId}/traverse`, {
        depth,
        relationship,
        limit: 100,
      }),
    enabled: !!entityId,
    staleTime: 30 * 1000,
  });
}

export function useOntologySearch(query?: string, type?: string, limit: number = 20) {
  return useQuery<{ entities: OntologyEntity[]; total: number }>({
    queryKey: ['ontology', 'search', query, type, limit],
    queryFn: () => eugeneApi('/v1/ontology/search', { q: query, type, limit }),
    staleTime: 30 * 1000,
  });
}

export function useOntologyConvergence(window: string = '24h', entityId?: string) {
  return useQuery<{ time_window: string; alerts: ConvergenceAlert[]; total_alerts: number }>({
    queryKey: ['ontology', 'convergence', window, entityId],
    queryFn: () =>
      eugeneApi('/v1/ontology/convergence', { window, entity_id: entityId, limit: 20 }),
    staleTime: 60 * 1000,
  });
}

export function useOntologySignals(entityId: string | undefined, window: string = '7d') {
  return useQuery({
    queryKey: ['ontology', 'signals', entityId, window],
    queryFn: () => eugeneApi(`/v1/ontology/entity/${entityId}/signals`, { window }),
    enabled: !!entityId,
    staleTime: 60 * 1000,
  });
}

export function useOntologyStats() {
  return useQuery<OntologyStats>({
    queryKey: ['ontology', 'stats'],
    queryFn: () => eugeneApi('/v1/ontology/stats'),
    staleTime: 60 * 1000,
  });
}

export function useOntologyIngest() {
  return useMutation<IngestResult, Error, string>({
    mutationFn: async (ticker: string) => {
      const res = await fetch('/v1/ontology/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });
      if (!res.ok) throw new Error(`Ingest failed: ${res.statusText}`);
      return res.json();
    },
  });
}
