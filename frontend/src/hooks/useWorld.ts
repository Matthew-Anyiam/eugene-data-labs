import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';

// --- News types ---

export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  source_country?: string;
  language?: string;
  seendate?: string;
  tone: number;
  image?: string;
}

export interface NewsFeedResponse {
  articles: NewsArticle[];
  count: number;
  sentiment: {
    label: string;
    avg_tone: number;
    sample_size: number;
  };
  tone_timeline?: { date: string; tone: number }[];
  query: string;
  timespan: string;
  source: string;
}

export interface SentimentResponse {
  query: string;
  sentiment: {
    label: string;
    avg_tone: number;
    shift: number;
    shift_label: string;
  };
  tone_timeline: { date: string; tone: number }[];
  volume_timeline: { date: string; value: number }[];
  timespan: string;
}

export interface BriefResponse {
  brief: string;
  articles: NewsArticle[];
  sentiment: { label: string; avg_tone: number };
  article_count: number;
  source: string;
}

// --- Sanctions types ---

export interface SanctionsEntry {
  id: string;
  name: string;
  entity_type: string;
  program: string;
  title?: string;
  remarks?: string;
  source: string;
  authority: string;
}

export interface ScreeningResult {
  screened_name: string;
  is_sanctioned: boolean;
  match_count: number;
  max_score: number;
  risk_level: string;
  matches: (SanctionsEntry & { match_score: number; match_type: string })[];
  lists_checked: string[];
}

export interface ExposureResult {
  ticker: string;
  company_screening: ScreeningResult | null;
  officer_screenings: (ScreeningResult & { name: string; title: string })[];
  overall_risk: string;
}

export interface RegulatoryChange {
  title: string;
  type: string;
  abstract: string;
  publication_date: string;
  url: string;
  agencies: string[];
}

// --- Hooks ---

export function useNewsFeed(query?: string, topic?: string, timespan: string = '24h') {
  return useQuery<NewsFeedResponse>({
    queryKey: ['world', 'news', query, topic, timespan],
    queryFn: () => eugeneApi('/v1/world/news', { q: query, topic, timespan, limit: 25 }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useNewsSentiment(query: string, timespan: string = '30d') {
  return useQuery<SentimentResponse>({
    queryKey: ['world', 'sentiment', query, timespan],
    queryFn: () => eugeneApi('/v1/world/news/sentiment', { q: query, timespan }),
    enabled: !!query,
    staleTime: 15 * 60 * 1000,
  });
}

export function useNewsBrief(query?: string, topic?: string, enabled: boolean = true) {
  return useQuery<BriefResponse>({
    queryKey: ['world', 'brief', query, topic],
    queryFn: () => eugeneApi('/v1/world/news/brief', { q: query, topic }),
    enabled,
    staleTime: 15 * 60 * 1000,
  });
}

export function useSanctionsScreen(name: string) {
  return useQuery<ScreeningResult>({
    queryKey: ['world', 'sanctions', 'screen', name],
    queryFn: () => eugeneApi('/v1/world/sanctions/screen', { name }),
    enabled: name.length >= 2,
    staleTime: 60 * 60 * 1000,
  });
}

export function useSanctionsList(source: string = 'ofac', limit: number = 50) {
  return useQuery<{ entries: SanctionsEntry[]; total: number }>({
    queryKey: ['world', 'sanctions', 'list', source, limit],
    queryFn: () => eugeneApi('/v1/world/sanctions', { source, limit }),
    staleTime: 60 * 60 * 1000,
  });
}

export function useSanctionsExposure(ticker: string) {
  return useQuery<ExposureResult>({
    queryKey: ['world', 'sanctions', 'exposure', ticker],
    queryFn: () => eugeneApi(`/v1/world/sanctions/exposure/${encodeURIComponent(ticker)}`),
    enabled: !!ticker,
    staleTime: 60 * 60 * 1000,
  });
}

export function useRegulatoryChanges(days: number = 7) {
  return useQuery<{ changes: RegulatoryChange[]; count: number }>({
    queryKey: ['world', 'regulatory', days],
    queryFn: () => eugeneApi('/v1/world/sanctions/changes', { days }),
    staleTime: 60 * 60 * 1000,
  });
}
