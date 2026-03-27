import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';
import type { ScreenerResult } from '../lib/types';

export interface ScreenerFilters {
  sector?: string;
  marketCapMin?: number;
  marketCapMax?: number;
  priceMin?: number;
  priceMax?: number;
  volumeMin?: number;
  betaMin?: number;
  betaMax?: number;
  country?: string;
  limit?: number;
}

export interface ScreenerResponse {
  results: ScreenerResult[];
  count: number;
  source: string;
  note?: string;
  alternatives?: string;
}

export function useScreener(filters: ScreenerFilters, enabled = true) {
  return useQuery({
    queryKey: ['screener', filters],
    queryFn: () => {
      const params: Record<string, string | number | undefined> = {
        limit: filters.limit || 50,
      };
      if (filters.sector) params.sector = filters.sector;
      if (filters.marketCapMin) params.marketCapMin = filters.marketCapMin;
      if (filters.marketCapMax) params.marketCapMax = filters.marketCapMax;
      if (filters.priceMin) params.priceMin = filters.priceMin;
      if (filters.priceMax) params.priceMax = filters.priceMax;
      if (filters.volumeMin) params.volumeMin = filters.volumeMin;
      if (filters.betaMin) params.betaMin = filters.betaMin;
      if (filters.betaMax) params.betaMax = filters.betaMax;
      if (filters.country) params.country = filters.country;
      return eugeneApi<ScreenerResponse>('/v1/screener', params);
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}
