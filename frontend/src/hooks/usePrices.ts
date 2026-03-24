import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';
import type { PriceData } from '../lib/types';

export function usePrices(ticker: string) {
  return useQuery({
    queryKey: ['prices', ticker],
    queryFn: () => eugeneApi<PriceData>(`/v1/sec/${ticker}/prices`),
    enabled: !!ticker,
    staleTime: 60 * 1000,
  });
}
