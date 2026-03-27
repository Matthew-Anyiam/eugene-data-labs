import { useQuery } from '@tanstack/react-query';
import { fetchSEC } from '../lib/api';
import type { EugeneResponse, InsidersData } from '../lib/types';

export function useInsiders(ticker: string) {
  return useQuery<EugeneResponse<InsidersData>>({
    queryKey: ['insiders', ticker],
    queryFn: () => fetchSEC(ticker, new URLSearchParams({ extract: 'insiders', limit: '20' })),
    enabled: !!ticker,
    staleTime: 5 * 60 * 1000,
  });
}
