import { useQuery } from '@tanstack/react-query';
import { fetchSEC } from '../lib/api';
import type { EugeneResponse } from '../lib/types';

export interface InsiderTransaction {
  owner: string;
  title: string;
  transaction_type: string;
  date: string;
  shares: number;
  price_per_share: number;
  value: number;
  shares_owned_after: number;
  filing_url: string;
}

export interface InsidersData {
  transactions: InsiderTransaction[];
  total: number;
}

export function useInsiders(ticker: string) {
  return useQuery<EugeneResponse<InsidersData>>({
    queryKey: ['insiders', ticker],
    queryFn: () => fetchSEC(ticker, new URLSearchParams({ extract: 'insiders', limit: '20' })),
    enabled: !!ticker,
    staleTime: 5 * 60 * 1000,
  });
}
