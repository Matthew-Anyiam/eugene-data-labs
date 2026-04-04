import { useQuery } from '@tanstack/react-query';
import { fetchSEC } from '../lib/api';
import type { EugeneResponse } from '../lib/types';

export interface PeerMetric {
  value: number;
  percentile: number;
}

export interface Peer {
  ticker: string;
  name: string;
  metrics: Record<string, PeerMetric>;
}

export interface PeersData {
  ticker: string;
  company_name: string;
  sector: string;
  peers: Peer[];
}

export function usePeers(ticker: string, limit = 10) {
  return useQuery<EugeneResponse<PeersData>>({
    queryKey: ['peers', ticker, limit],
    queryFn: () => fetchSEC(ticker, new URLSearchParams({ extract: 'peers', limit: String(limit) })),
    enabled: !!ticker,
    staleTime: 10 * 60 * 1000,
  });
}
