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

// Backend returns sections as a dict { mdna: { text, char_count } } with filing info separate
interface RawSectionsData {
  filing: { form: string; filed_date: string; accession: string };
  sections: Record<string, { text: string | null; char_count?: number; truncated?: boolean }>;
}

function transformSections(raw: EugeneResponse<RawSectionsData>): EugeneResponse<SectionsData> {
  const filing = raw.data?.filing;
  const sections: FilingSection[] = Object.entries(raw.data?.sections ?? {}).map(([key, s]) => ({
    section: key,
    title: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    text: s.text ?? '',
    filing_date: filing?.filed_date ?? '',
    form: filing?.form ?? '',
    accession: filing?.accession ?? '',
  }));
  return { ...raw, data: { sections } } as EugeneResponse<SectionsData>;
}

export function useSections(ticker: string, section?: string) {
  return useQuery<EugeneResponse<SectionsData>>({
    queryKey: ['sections', ticker, section],
    queryFn: async () => {
      const params = new URLSearchParams({ extract: 'sections', limit: '5' });
      if (section) params.set('section', section);
      const raw = await fetchSEC<RawSectionsData>(ticker, params);
      return transformSections(raw);
    },
    enabled: !!ticker,
    staleTime: 10 * 60 * 1000,
  });
}
