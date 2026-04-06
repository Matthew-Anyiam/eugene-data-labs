import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';

export interface Port {
  port_code: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  type: string;
  status: string;
  risk_score: number;
  risk_factors: string[];
}

export interface TradeFlow {
  reporter: string;
  partner: string;
  commodity_code: string;
  commodity: string;
  flow: string;
  value_usd: number;
  quantity: number;
  unit: string;
  year: number;
}

export interface Chokepoint {
  name: string;
  lat: number;
  lng: number;
  trade_share_pct: number;
  risk_score: number;
  status: string;
  risk_factors: string[];
}

export function usePortStatus(country?: string) {
  return useQuery<{ ports: Port[]; count: number; operational: number; congested: number; disrupted: number }>({
    queryKey: ['supply-chain', 'ports', country],
    queryFn: () => eugeneApi('/v1/world/supply-chain/ports', { country, limit: 20 }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTradeFlows(reporter: string = 'US', partner?: string, flow: string = 'X') {
  return useQuery<{ records: TradeFlow[]; count: number }>({
    queryKey: ['supply-chain', 'trade', reporter, partner, flow],
    queryFn: () => eugeneApi('/v1/world/supply-chain/trade', { reporter, partner, flow, limit: 50 }),
    staleTime: 60 * 60 * 1000,
  });
}

export function useRouteRisk() {
  return useQuery<{ chokepoints: Chokepoint[]; count: number; avg_risk: number; high_risk_count: number }>({
    queryKey: ['supply-chain', 'routes'],
    queryFn: () => eugeneApi('/v1/world/supply-chain/routes'),
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Chokepoint impact analysis
// ---------------------------------------------------------------------------

export interface ChokepointDetail {
  name: string;
  lat: number;
  lng: number;
  trade_share_pct: number;
  risk_score: number;
  status: string;
  risk_factors: string[];
  commodities: string[];
  daily_vessel_transits: number;
  alternatives: string[];
}

export interface ChokepointImpact {
  chokepoint: string;
  current_status: string;
  risk_score: number;
  commodities_affected: { commodity: string; share_pct: number; price_impact_pct: number }[];
  scenarios: { scenario: string; probability: string; description: string; price_impact: string }[];
  live_signals: { type: string; description: string; date: string }[];
}

export interface CommodityExposure {
  commodity: string;
  chokepoints: { name: string; share_pct: number; risk_score: number; status: string }[];
  total_exposure_score: number;
}

export function useChokepoints() {
  return useQuery<{ chokepoints: ChokepointDetail[]; count: number }>({
    queryKey: ['supply-chain', 'chokepoints'],
    queryFn: () => eugeneApi('/v1/world/supply-chain/chokepoints'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useChokepointImpact(name: string | undefined) {
  return useQuery<ChokepointImpact>({
    queryKey: ['supply-chain', 'chokepoint-impact', name],
    queryFn: () => eugeneApi('/v1/world/supply-chain/chokepoint-impact', { name }),
    staleTime: 5 * 60 * 1000,
    enabled: !!name,
  });
}

export function useCommodityExposure(commodity: string | undefined) {
  return useQuery<CommodityExposure>({
    queryKey: ['supply-chain', 'commodity-exposure', commodity],
    queryFn: () => eugeneApi('/v1/world/supply-chain/commodity-exposure', { commodity }),
    staleTime: 10 * 60 * 1000,
    enabled: !!commodity,
  });
}
