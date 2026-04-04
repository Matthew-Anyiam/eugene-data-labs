import { useQuery } from '@tanstack/react-query';
import { fetchSEC } from '../lib/api';
import type { EugeneResponse } from '../lib/types';

export interface FloatData {
  ticker: string;
  outstanding_shares: number;
  float_shares: number;
  free_float: number;
}

export function useFloat(ticker: string) {
  return useQuery<EugeneResponse<FloatData>>({
    queryKey: ['float', ticker],
    queryFn: () => fetchSEC(ticker, new URLSearchParams({ extract: 'float' })),
    enabled: !!ticker,
    staleTime: 60 * 60 * 1000,
  });
}
