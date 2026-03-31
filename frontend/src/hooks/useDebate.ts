import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';

export interface DebateCase {
  thesis: string;
  key_points: string[];
  confidence: number;
}

export interface DebateSynthesis {
  verdict: string;
  conviction: string;
  key_risks: string[];
  key_catalysts: string[];
  summary: string;
}

export interface DebateResponse {
  ticker: string;
  company_name?: string;
  mode: string;
  bull_case: DebateCase | null;
  bear_case: DebateCase | null;
  synthesis: DebateSynthesis | null;
  tokens_used?: number;
  source: string;
  disclaimer?: string;
  error?: string;
  remaining?: number;
  rate_limited?: boolean;
}

export function useDebate(ticker: string, enabled = false) {
  return useQuery<DebateResponse>({
    queryKey: ['debate', ticker],
    queryFn: () => eugeneApi<DebateResponse>(`/v1/sec/${encodeURIComponent(ticker)}/debate`),
    enabled: !!ticker && enabled,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
