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
    queryFn: async () => {
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

      const raw = await eugeneApi<ScreenerResponse | ScreenerResult[]>('/v1/screener', params);

      // Handle both array and {results: [...]} response shapes
      if (Array.isArray(raw)) {
        return { results: raw, count: raw.length, source: 'api' } as ScreenerResponse;
      }
      // If the response has a `data` field instead of `results`
      const obj = raw as any;
      if (obj.data && Array.isArray(obj.data)) {
        return { results: obj.data, count: obj.data.length, source: obj.source ?? 'api', note: obj.note, alternatives: obj.alternatives } as ScreenerResponse;
      }
      return raw as ScreenerResponse;
    },
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}
