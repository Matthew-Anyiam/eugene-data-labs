import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';

export interface Disaster {
  id: string;
  type: string;
  name: string;
  severity: number | null;
  severity_tier?: 'critical' | 'high' | 'moderate' | 'low';
  alert_level: string;
  lat: number;
  lng: number;
  date: string;
  details?: Record<string, any>;
  signals?: string[];
  url?: string;
  source: string;
}

export interface ConflictEvent {
  id: string;
  country: string;
  region: string;
  conflict_name: string;
  type_of_violence: string;
  side_a: string;
  side_b: string;
  deaths_total: number;
  deaths_civilians: number;
  lat: number;
  lng: number;
  date_start: string;
  year: string;
}

export interface EscalationScore {
  country: string;
  escalation_score: number;
  risk_level: string;
  event_count: number;
  total_fatalities: number;
  civilian_fatalities: number;
}

export function useActiveDisasters(days: number = 7) {
  return useQuery<{ disasters: Disaster[]; count: number; signals: string[]; sources: string[] }>({
    queryKey: ['world', 'disasters', days],
    queryFn: () => eugeneApi('/v1/world/disasters', { days }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEarthquakes(minMagnitude: number = 4.5, days: number = 7) {
  return useQuery<{ earthquakes: any[]; count: number }>({
    queryKey: ['world', 'earthquakes', minMagnitude, days],
    queryFn: () => eugeneApi('/v1/world/disasters/earthquakes', { min_magnitude: minMagnitude, days }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useConflictEvents(country?: string) {
  return useQuery<{ events: ConflictEvent[]; count: number }>({
    queryKey: ['world', 'conflict', 'events', country],
    queryFn: () => eugeneApi('/v1/world/conflict/events', { country, limit: 50 }),
    staleTime: 60 * 60 * 1000,
  });
}

export function useActiveConflicts(region?: string) {
  return useQuery<{ conflicts: any[]; count: number }>({
    queryKey: ['world', 'conflict', 'active', region],
    queryFn: () => eugeneApi('/v1/world/conflict', { region }),
    staleTime: 60 * 60 * 1000,
  });
}

export function useEscalation(country: string) {
  return useQuery<EscalationScore>({
    queryKey: ['world', 'conflict', 'escalation', country],
    queryFn: () => eugeneApi(`/v1/world/conflict/escalation/${encodeURIComponent(country)}`),
    enabled: !!country,
    staleTime: 60 * 60 * 1000,
  });
}
