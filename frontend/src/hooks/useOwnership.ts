import { useQuery } from '@tanstack/react-query';
import { fetchSEC } from '../lib/api';
import type { EugeneResponse } from '../lib/types';

export interface Holding {
  name: string;
  ticker: string;
  cusip: string;
  value: number;
  shares: number;
  sole_voting: number;
  shared_voting: number;
  no_voting: number;
}

export interface InstitutionHolding {
  investor_name: string;
  cik: string;
  form_date: string;
  holdings: Holding[];
}

export interface OwnershipData {
  institutions: InstitutionHolding[];
}

export function useOwnership(ticker: string, limit = 10) {
  return useQuery<EugeneResponse<OwnershipData>>({
    queryKey: ['ownership', ticker, limit],
    queryFn: () => fetchSEC(ticker, new URLSearchParams({ extract: 'ownership', limit: String(limit) })),
    enabled: !!ticker,
    staleTime: 10 * 60 * 1000,
  });
}
