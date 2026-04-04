import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';

export interface SentimentResult {
  query: string;
  sentiment_score: number;
  positive_percentage: number;
  negative_percentage: number;
  articles_analyzed: number;
  trend: 'improving' | 'declining' | 'neutral';
}

export interface NewsArticle {
  title: string;
  summary: string;
  date: string;
  source: string;
  url: string;
  topic: string;
  sentiment_score: number;
}

export function useNewsSentiment(query: string, timespan = '30d') {
  return useQuery<SentimentResult>({
    queryKey: ['news-sentiment', query, timespan],
    queryFn: () => eugeneApi<SentimentResult>('/v1/world/news/sentiment', { q: query, timespan }),
    enabled: !!query,
    staleTime: 5 * 60 * 1000,
  });
}

export function useWorldNews(query: string, topic?: string, timespan = '24h', limit = 25) {
  return useQuery<{ articles: NewsArticle[] }>({
    queryKey: ['world-news', query, topic, timespan, limit],
    queryFn: () => eugeneApi('/v1/world/news', { q: query, topic, timespan, limit }),
    enabled: !!query,
    staleTime: 2 * 60 * 1000,
  });
}
