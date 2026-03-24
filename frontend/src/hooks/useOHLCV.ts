import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';
import type { OHLCVData } from '../lib/types';

export function useOHLCV(ticker: string) {
  return useQuery({
    queryKey: ['ohlcv', ticker],
    queryFn: () => eugeneApi<OHLCVData>(`/v1/sec/${ticker}/ohlcv`),
    enabled: !!ticker,
    staleTime: 60 * 1000,
  });
}
