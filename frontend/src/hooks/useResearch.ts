import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';

export interface ResearchBrief {
  company_overview: string;
  financial_health: string;
  key_metrics: string;
  recent_developments: string;
  risk_factors: string;
  competitive_position: string;
  outlook_summary: string;
}

export interface ResearchResponse {
  ticker: string;
  company_name?: string;
  research: ResearchBrief | null;
  tokens_used?: number;
  model?: string;
  source: string;
  disclaimer?: string;
  error?: string;
  remaining?: number;
  rate_limited?: boolean;
}

export function useResearch(ticker: string, enabled = false) {
  return useQuery<ResearchResponse>({
    queryKey: ['research', ticker],
    queryFn: () => eugeneApi<ResearchResponse>(`/v1/sec/${encodeURIComponent(ticker)}/research`),
    enabled: !!ticker && enabled,
    staleTime: 30 * 60 * 1000, // 30 min — research is expensive
    gcTime: 60 * 60 * 1000,
  });
}
