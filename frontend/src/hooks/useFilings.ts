import { useQuery } from '@tanstack/react-query';
import { fetchSEC } from '../lib/api';
import type { EugeneResponse, FilingsData } from '../lib/types';

export function useFilings(ticker: string, form?: string) {
  return useQuery<EugeneResponse<FilingsData>>({
    queryKey: ['filings', ticker, form],
    queryFn: () => {
      const params = new URLSearchParams({ extract: 'filings', limit: '20' });
      if (form) params.set('form', form);
      return fetchSEC(ticker, params);
    },
    enabled: !!ticker,
    staleTime: 5 * 60 * 1000,
  });
}
