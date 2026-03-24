import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';
import type { FredCategory } from '../lib/types';

export function useEconomics(category: string) {
  return useQuery({
    queryKey: ['economics', category],
    queryFn: () => eugeneApi<FredCategory>(`/v1/economics/${category}`),
    enabled: !!category,
    staleTime: 30 * 60 * 1000,
  });
}
