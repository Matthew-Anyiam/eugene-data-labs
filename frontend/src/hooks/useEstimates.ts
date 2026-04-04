import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';

export interface Estimate {
  analyst_name: string;
  analyst_company: string;
  rating: string;
  price_target: number;
  published_date: string;
}

export interface EarningsEstimate {
  date: string;
  symbol: string;
  eps_estimated: number;
  eps_actual: number | null;
  revenue_estimated: number;
  revenue_actual: number | null;
  fiscal_period: string;
}

export function useEstimates(ticker: string) {
  return useQuery<Estimate[]>({
    queryKey: ['estimates', ticker],
    queryFn: async () => {
      const raw = await eugeneApi<any>(`/v1/sec/${ticker}/estimates`);
      return Array.isArray(raw) ? raw : raw?.data ?? raw?.estimates ?? [];
    },
    enabled: !!ticker,
    staleTime: 10 * 60 * 1000,
  });
}

export function useEarnings(ticker: string) {
  return useQuery<EarningsEstimate[]>({
    queryKey: ['earnings-history', ticker],
    queryFn: async () => {
      const raw = await eugeneApi<any>(`/v1/sec/${ticker}/earnings`);
      return Array.isArray(raw) ? raw : raw?.data ?? raw?.earnings ?? [];
    },
    enabled: !!ticker,
    staleTime: 10 * 60 * 1000,
  });
}
