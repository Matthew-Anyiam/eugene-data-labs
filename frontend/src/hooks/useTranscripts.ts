import { useQuery } from '@tanstack/react-query';
import { fetchSEC } from '../lib/api';
import type { EugeneResponse } from '../lib/types';

export interface Transcript {
  quarter: string;
  year: number;
  date: string;
  management_remarks: string;
  qa_section: string;
  guidance: string;
  key_metrics: Record<string, any>;
  tone_analysis: {
    positive_words: number;
    negative_words: number;
    sentiment_score: number;
  };
}

export interface TranscriptsData {
  transcripts: Transcript[];
}

export function useTranscripts(ticker: string, limit = 5) {
  return useQuery<EugeneResponse<TranscriptsData>>({
    queryKey: ['transcripts', ticker, limit],
    queryFn: () => fetchSEC(ticker, new URLSearchParams({ extract: 'transcripts', limit: String(limit) })),
    enabled: !!ticker,
    staleTime: 10 * 60 * 1000,
  });
}
