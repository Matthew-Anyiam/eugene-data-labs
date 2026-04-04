import { useQuery } from '@tanstack/react-query';
import { fetchSEC } from '../lib/api';
import type { EugeneResponse } from '../lib/types';

export interface CorporateAction {
  type: 'dividend' | 'split' | 'event';
  date: string;
  value: number;
  description: string;
  source: string;
}

export interface CorporateActionsData {
  actions: CorporateAction[];
}

export function useCorporateActions(ticker: string, limit = 20) {
  return useQuery<EugeneResponse<CorporateActionsData>>({
    queryKey: ['corporate-actions', ticker, limit],
    queryFn: () => fetchSEC(ticker, new URLSearchParams({ extract: 'corporate_actions', limit: String(limit) })),
    enabled: !!ticker,
    staleTime: 10 * 60 * 1000,
  });
}
