import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';

// ---------------------------------------------------------------------------
// Emerging Markets data (World Bank)
// ---------------------------------------------------------------------------

export interface EMCountrySummary {
  code: string;
  name: string;
  region: string;
  income_group: string;
  gdp_growth: number | null;
  inflation: number | null;
  current_account_pct: number | null;
  fx_reserves_months: number | null;
  commodity_exposure: string[];
  risk_tier: string;
}

export interface EMCountryDetail {
  code: string;
  name: string;
  region: string;
  income_group: string;
  indicators: Record<string, { value: number; year: number }[]>;
  commodity_exposure: string[];
  risk_tier: string;
}

export interface EMRanking {
  rank: number;
  code: string;
  name: string;
  region: string;
  value: number;
  year: number;
}

export function useEmergingMarkets(region?: string) {
  return useQuery<{ countries: EMCountrySummary[]; count: number }>({
    queryKey: ['emerging-markets', region],
    queryFn: () => eugeneApi('/v1/world/emerging-markets', { region }),
    staleTime: 60 * 60 * 1000, // 1h — macro data doesn't change fast
  });
}

export function useEMCountry(code: string | undefined) {
  return useQuery<EMCountryDetail>({
    queryKey: ['emerging-markets', 'country', code],
    queryFn: () => eugeneApi('/v1/world/emerging-markets/country', { code }),
    staleTime: 60 * 60 * 1000,
    enabled: !!code,
  });
}

export function useEMRankings(indicator: string) {
  return useQuery<{ indicator: string; rankings: EMRanking[]; count: number }>({
    queryKey: ['emerging-markets', 'rankings', indicator],
    queryFn: () => eugeneApi('/v1/world/emerging-markets/rankings', { indicator }),
    staleTime: 60 * 60 * 1000,
  });
}
