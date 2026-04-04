import { useQuery } from '@tanstack/react-query';
import { fetchSEC } from '../lib/api';
import type { EugeneResponse } from '../lib/types';

export interface SegmentPeriod {
  period_end: string;
  business_segments: { segment_name: string; revenue: number }[];
  geographic_segments: { region: string; revenue: number }[];
}

export interface SegmentsData {
  periods: SegmentPeriod[];
}

export function useSegments(ticker: string, limit = 5) {
  return useQuery<EugeneResponse<SegmentsData>>({
    queryKey: ['segments', ticker, limit],
    queryFn: () => fetchSEC(ticker, new URLSearchParams({ extract: 'segments', period: 'FY', limit: String(limit) })),
    enabled: !!ticker,
    staleTime: 10 * 60 * 1000,
  });
}
