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
