import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';

export interface Aircraft {
  icao24: string;
  callsign: string;
  origin_country: string;
  lat: number | null;
  lng: number | null;
  altitude_ft: number | null;
  on_ground: boolean;
  velocity_kts: number | null;
  heading: number | null;
  category: string;
}

export interface Airport {
  icao: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  status: string;
  traffic_count: number;
  risk_score: number;
}

export interface Anomaly {
  type: string;
  confidence: number;
  icao24?: string;
  callsign?: string;
  origin_country?: string;
  lat?: number;
  lng?: number;
  altitude_ft?: number;
  region?: string;
}

export function useAirportStatus(country?: string) {
  return useQuery<{ airports: Airport[]; count: number }>({
    queryKey: ['flights', 'airports', country],
    queryFn: () => eugeneApi('/v1/world/flights/airports', { country, limit: 20 }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAirspaceStatus(region?: string) {
  return useQuery<{ regions: { region: string; label: string; traffic_count: number; density: string; status: string }[]; count: number }>({
    queryKey: ['flights', 'airspace', region],
    queryFn: () => eugeneApi('/v1/world/flights/airspace', { region }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useFlightAnomalies(region?: string) {
  return useQuery<{ anomalies: Anomaly[]; count: number }>({
    queryKey: ['flights', 'anomalies', region],
    queryFn: () => eugeneApi('/v1/world/flights/anomalies', { region, limit: 20 }),
    staleTime: 5 * 60 * 1000,
  });
}
