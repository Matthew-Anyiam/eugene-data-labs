import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';
import type { EugeneResponse, MetricsData } from '../lib/types';

export function useMetrics(ticker: string) {
  return useQuery({
    queryKey: ['metrics', ticker],
    queryFn: () =>
      eugeneApi<EugeneResponse<MetricsData>>(`/v1/sec/${ticker}`, { extract: 'metrics', limit: 1 }),
    enabled: !!ticker,
    staleTime: 5 * 60 * 1000,
  });
}
