import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';
import type { EugeneResponse, ProfileData } from '../lib/types';

export function useProfile(ticker: string) {
  return useQuery({
    queryKey: ['profile', ticker],
    queryFn: () => eugeneApi<EugeneResponse<ProfileData>>(`/v1/sec/${ticker}`, { extract: 'profile' }),
    enabled: !!ticker,
    staleTime: 5 * 60 * 1000,
  });
}
