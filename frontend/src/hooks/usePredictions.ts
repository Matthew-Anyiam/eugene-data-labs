import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';

export interface Prediction {
  question: string;
  outcomes?: { outcome: string; probability_pct: number | null }[];
  yes_probability_pct?: number | null;
  no_probability_pct?: number | null;
  volume_24h?: number;
  volume_total?: number;
  source: string;
  url?: string;
  category?: string;
  expiration?: string;
}

export interface PredictionsResponse {
  predictions: Prediction[];
  count: number;
  sources?: { polymarket: number; kalshi: number };
  topic?: string;
}

export function usePredictions(topic?: string) {
  return useQuery<PredictionsResponse>({
    queryKey: ['predictions', topic ?? 'all'],
    queryFn: () =>
      eugeneApi<PredictionsResponse>('/v1/predictions', topic ? { topic } : undefined),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTickerPredictions(ticker: string) {
  return useQuery<PredictionsResponse>({
    queryKey: ['predictions', 'ticker', ticker],
    queryFn: () =>
      eugeneApi<PredictionsResponse>(`/v1/sec/${encodeURIComponent(ticker)}/predictions`),
    enabled: !!ticker,
    staleTime: 5 * 60 * 1000,
  });
}
