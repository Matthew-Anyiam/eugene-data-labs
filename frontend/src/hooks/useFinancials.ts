import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';
import type { EugeneResponse, FinancialsData } from '../lib/types';

export function useFinancials(ticker: string, period: 'FY' | 'Q' = 'FY', limit = 5) {
  return useQuery({
    queryKey: ['financials', ticker, period, limit],
    queryFn: () =>
      eugeneApi<EugeneResponse<FinancialsData>>(`/v1/sec/${ticker}`, {
        extract: 'financials',
        period,
        limit,
      }),
    enabled: !!ticker,
    staleTime: 5 * 60 * 1000,
  });
}
