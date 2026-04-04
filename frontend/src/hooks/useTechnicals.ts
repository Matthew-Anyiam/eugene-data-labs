import { useQuery } from '@tanstack/react-query';
import { fetchSEC } from '../lib/api';
import type { EugeneResponse } from '../lib/types';

export interface TechnicalsData {
  ticker: string;
  latest_close?: number;
  data_points?: number;
  indicators: {
    sma_20?: number;
    sma_50?: number;
    sma_200?: number;
    ema_12?: number;
    ema_26?: number;
    rsi_14?: number;
    macd?: { macd_line: number; signal: number; histogram: number };
    bollinger_bands?: { upper: number; middle: number; lower: number; bandwidth?: number };
    atr_14?: number;
    vwap_20?: number;
    [key: string]: any;
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
