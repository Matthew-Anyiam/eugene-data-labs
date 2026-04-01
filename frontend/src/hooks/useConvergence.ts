import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';

// --- Types ---

export interface ConvergenceAlert {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  composite_risk: number;
  risk_level: string;
  signal_type_count: number;
  total_signals: number;
  avg_magnitude: number;
  max_magnitude: number;
  signal_types: string[];
  first_signal: string;
  last_signal: string;
  matched_patterns: {
    pattern: string;
    description: string;
    score: number;
    matched_required: string[];
    matched_boost: string[];
  }[];
  breakdown: {
    signal_type: string;
    count: number;
    avg_magnitude: number;
    max_magnitude: number;
    first_seen: string;
    last_seen: string;
  }[];
}

export interface CompositeRiskEntity {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  composite_risk: number;
  risk_level: string;
  factors: {
    diversity: number;
    magnitude: number;
    frequency: number;
    pattern_match: number;
  };
  signal_type_count: number;
  total_signals: number;
  avg_magnitude: number;
  max_magnitude: number;
  signal_types: string[];
  matched_patterns: string[];
}

export interface EntitySignals {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  time_window: string;
  total_signals: number;
  signal_types: number;
  composite_risk: number;
  type_summaries: {
    signal_type: string;
    count: number;
    avg_magnitude: number;
    max_magnitude: number;
    trend: string;
    trend_pct: number;
    latest: string | null;
  }[];
  matched_patterns: {
    pattern: string;
    description: string;
    score: number;
  }[];
}

export interface DashboardSummary {
  time_window: string;
  overview: {
    total_entities: number;
    active_entities: number;
    total_signals: number;
    signal_types_active: number;
    convergence_alerts: number;
  };
  signal_breakdown: {
    signal_type: string;
    count: number;
    avg_magnitude: number;
  }[];
  entity_breakdown: {
    entity_type: string;
    count: number;
  }[];
  risk_distribution: Record<string, number>;
  top_alerts: ConvergenceAlert[];
  signal_timeline: {
    hour: string;
    count: number;
    avg_magnitude: number;
  }[];
}

// --- Hooks ---

export function useConvergenceAlerts(window: string = '24h', entityType?: string) {
  return useQuery<{ time_window: string; alerts: ConvergenceAlert[]; total_alerts: number }>({
    queryKey: ['convergence', 'alerts', window, entityType],
    queryFn: () =>
      eugeneApi('/v1/world/convergence/alerts', { window, type: entityType, limit: 20 }),
    staleTime: 60 * 1000,
  });
}

export function useConvergenceEntitySignals(entityId: string | undefined, window: string = '7d') {
  return useQuery<EntitySignals>({
    queryKey: ['convergence', 'entity', entityId, window],
    queryFn: () =>
      eugeneApi(`/v1/world/convergence/entity/${entityId}`, { window }),
    enabled: !!entityId,
    staleTime: 60 * 1000,
  });
}

export function useCompositeRisk(window: string = '24h', entityType?: string) {
  return useQuery<{ time_window: string; entities: CompositeRiskEntity[]; total: number }>({
    queryKey: ['convergence', 'risk', window, entityType],
    queryFn: () =>
      eugeneApi('/v1/world/convergence/risk', { window, type: entityType, limit: 20 }),
    staleTime: 60 * 1000,
  });
}

export function useDashboardSummary(window: string = '24h') {
  return useQuery<DashboardSummary>({
    queryKey: ['convergence', 'dashboard', window],
    queryFn: () =>
      eugeneApi('/v1/world/convergence/dashboard', { window }),
    staleTime: 60 * 1000,
  });
}
