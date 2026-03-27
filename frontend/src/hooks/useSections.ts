import { useQuery } from '@tanstack/react-query';
import { fetchSEC } from '../lib/api';
import type { EugeneResponse } from '../lib/types';

export interface FilingSection {
  section: string;
  title: string;
  text: string;
  filing_date: string;
  form: string;
  accession: string;
}

export interface SectionsData {
  sections: FilingSection[];
}

export function useSections(ticker: string, section?: string) {
  return useQuery<EugeneResponse<SectionsData>>({
    queryKey: ['sections', ticker, section],
    queryFn: () => {
      const params = new URLSearchParams({ extract: 'sections', limit: '5' });
      if (section) params.set('section', section);
      return fetchSEC(ticker, params);
    },
    enabled: !!ticker,
    staleTime: 10 * 60 * 1000,
  });
}
