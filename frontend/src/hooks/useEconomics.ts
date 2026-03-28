import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';
import type { FredCategory, FredSeries } from '../lib/types';

interface RawEconomicsResponse {
  category: string;
  series: Record<string, { label: string; value: number; date: string }>;
  source?: string;
}

function transformResponse(raw: RawEconomicsResponse): FredCategory {
  const series: FredSeries[] = Object.entries(raw.series).map(([id, s]) => ({
    id,
    title: s.label,
    value: s.value,
    date: s.date,
    units: '',
    frequency: '',
  }));
  return { category: raw.category, series };
}

export function useEconomics(category: string) {
  return useQuery({
    queryKey: ['economics', category],
    queryFn: async () => {
      const raw = await eugeneApi<RawEconomicsResponse>(`/v1/economics/${category}`);
      return transformResponse(raw);
    },
    enabled: !!category,
    staleTime: 30 * 60 * 1000,
  });
}
