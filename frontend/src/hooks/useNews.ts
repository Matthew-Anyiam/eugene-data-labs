import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';

export interface NewsArticle {
  title: string;
  date: string;
  source: string;
  url: string;
  snippet?: string;
  image?: string;
}

interface NewsResponse {
  articles: NewsArticle[];
  ticker: string;
  source: string;
}

export function useNews(ticker: string) {
  return useQuery<NewsResponse>({
    queryKey: ['news', ticker],
    queryFn: () => eugeneApi<NewsResponse>(`/v1/sec/${encodeURIComponent(ticker)}/news`),
    enabled: !!ticker,
    staleTime: 5 * 60 * 1000,
  });
}
