import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';
import type { CryptoQuote, CryptoBarsData } from '../lib/types';

export function useCryptoQuote(symbol: string) {
  return useQuery({
    queryKey: ['crypto-quote', symbol],
    queryFn: () => eugeneApi<CryptoQuote>(`/v1/crypto/${symbol}`, { interval: 'quote' }),
    enabled: !!symbol,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000, // auto-refresh every minute
  });
}

export function useCryptoBars(symbol: string, interval: 'daily' | '1hour' | '5min' = 'daily') {
  return useQuery({
    queryKey: ['crypto-bars', symbol, interval],
    queryFn: () => eugeneApi<CryptoBarsData>(`/v1/crypto/${symbol}`, { interval }),
    enabled: !!symbol,
    staleTime: interval === '5min' ? 60 * 1000 : 5 * 60 * 1000,
  });
}
