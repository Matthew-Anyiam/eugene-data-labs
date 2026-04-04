import { useQuery } from '@tanstack/react-query';
import { fetchSEC } from '../lib/api';
import type { EugeneResponse } from '../lib/types';

export interface TechnicalsData {
  ticker: string;
  indicators: {
    sma: { sma_20: number; sma_50: number; sma_200: number };
    ema: { ema_12: number; ema_26: number };
    rsi: number;
    macd: { macd: number; signal: number; histogram: number };
    bollinger_bands: { upper: number; middle: number; lower: number };
    atr: number;
    vwap: number;
  };
}

export function useTechnicals(ticker: string) {
  return useQuery<EugeneResponse<TechnicalsData>>({
    queryKey: ['technicals', ticker],
    queryFn: () => fetchSEC(ticker, new URLSearchParams({ extract: 'technicals' })),
    enabled: !!ticker,
    staleTime: 60 * 1000,
  });
}
