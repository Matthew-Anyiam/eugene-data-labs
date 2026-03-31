import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';
import type { FredCategory, FredSeries } from '../lib/types';

interface RawSeriesEntry {
  label: string;
  value: number;
  date: string;
  error?: string;
}

interface RawCategoryResponse {
  category: string;
  series: Record<string, RawSeriesEntry>;
  source?: string;
}

interface RawAllResponse {
  categories: Record<string, RawCategoryResponse>;
  source?: string;
}

function transformCategory(raw: RawCategoryResponse): FredCategory {
  const series: FredSeries[] = Object.entries(raw.series)
    .filter(([, s]) => !s.error)
    .map(([id, s]) => ({
      id,
      title: s.label,
      value: s.value,
      date: s.date,
      units: '',
      frequency: '',
    }));
  return { category: raw.category, series };
}

function transformAll(raw: RawAllResponse): FredCategory {
  const allSeries: FredSeries[] = [];
  for (const [catName, catData] of Object.entries(raw.categories)) {
    const transformed = transformCategory(catData);
    for (const s of transformed.series) {
      // Tag each series with its category for grouping in the UI
      allSeries.push({ ...s, frequency: catName });
    }
  }
  return { category: 'all', series: allSeries };
}

export function useEconomics(category: string) {
  return useQuery({
    queryKey: ['economics', category],
    queryFn: async () => {
      if (category === 'all') {
        const raw = await eugeneApi<RawAllResponse>(`/v1/economics/all`);
        // Handle case where backend returns the "all" wrapper format
        if ('categories' in raw && typeof raw.categories === 'object') {
          return transformAll(raw);
        }
        // Fallback: maybe it returns a flat category format
        return transformCategory(raw as unknown as RawCategoryResponse);
      }
      const raw = await eugeneApi<RawCategoryResponse>(`/v1/economics/${category}`);
      return transformCategory(raw);
    },
    enabled: !!category,
    staleTime: 30 * 60 * 1000,
  });
}
