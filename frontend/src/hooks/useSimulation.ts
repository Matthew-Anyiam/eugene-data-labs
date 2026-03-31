import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';

export interface AgentDecision {
  persona: 'analyst' | 'trader' | 'insider' | 'institutional' | 'macro';
  action: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  reasoning: string;
  key_signal: string;
}

export interface SimulationResponse {
  ticker: string;
  company_name?: string;
  mode: 'simulation';
  scenario?: string | null;
  consensus?: 'bullish' | 'bearish' | 'neutral';
  confidence?: number;
  convergence_score?: number;
  agent_decisions?: AgentDecision[];
  key_signals?: string[];
  narrative?: string;
  tokens_used?: number;
  model?: string;
  source: string;
  disclaimer?: string;
  error?: string;
  remaining?: number;
  rate_limited?: boolean;
}

export function useSimulation(ticker: string, enabled = false, scenario?: string) {
  return useQuery<SimulationResponse>({
    queryKey: ['simulation', ticker, scenario ?? ''],
    queryFn: () => {
      const params: Record<string, string | number | undefined> = {};
      if (scenario) params.scenario = scenario;
      return eugeneApi<SimulationResponse>(
        `/v1/sec/${encodeURIComponent(ticker)}/simulate`,
        params,
      );
    },
    enabled: !!ticker && enabled,
    staleTime: 30 * 60 * 1000, // 30 min — simulation is expensive
    gcTime: 60 * 60 * 1000,
  });
}
