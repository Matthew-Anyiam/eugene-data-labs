import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';

export interface ConvergenceSignal {
  source: string;
  signal: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0-1
  detail: string;
}

export interface ConvergenceData {
  ticker: string;
  score: number; // -100 to +100
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-1
  signals: ConvergenceSignal[];
  summary: string;
  updated_at: string;
}

export function useConvergenceScore(ticker: string) {
  return useQuery<ConvergenceData>({
    queryKey: ['convergence-score', ticker],
    queryFn: async () => {
      // Fetch multiple data points in parallel and synthesize
      const [techRes, insiderRes, priceRes] = await Promise.allSettled([
        eugeneApi(`/v1/sec/${encodeURIComponent(ticker)}`, { extract: 'technicals' }),
        eugeneApi(`/v1/sec/${encodeURIComponent(ticker)}`, { extract: 'insiders', limit: '10' }),
        eugeneApi(`/v1/sec/${encodeURIComponent(ticker)}`, { extract: 'ohlcv', interval: 'daily', limit: '50' }),
      ]);

      const signals: ConvergenceSignal[] = [];
      let totalScore = 0;
      let signalCount = 0;

      // Technical signals
      if (techRes.status === 'fulfilled') {
        const tech = (techRes.value as any)?.data;
        if (tech?.indicators) {
          const ind = tech.indicators;
          // RSI signal
          if (ind.rsi_14 != null) {
            const rsi = ind.rsi_14;
            const rsiSignal = rsi < 30 ? 'bullish' : rsi > 70 ? 'bearish' : 'neutral';
            const rsiStrength = rsi < 30 ? (30 - rsi) / 30 : rsi > 70 ? (rsi - 70) / 30 : 0.1;
            signals.push({
              source: 'RSI (14)',
              signal: rsiSignal as ConvergenceSignal['signal'],
              strength: Math.min(rsiStrength, 1),
              detail: `RSI at ${rsi.toFixed(1)}`,
            });
            totalScore += rsiSignal === 'bullish' ? 20 : rsiSignal === 'bearish' ? -20 : 0;
            signalCount++;
          }
          // MACD signal
          if (ind.macd?.histogram != null) {
            const hist = ind.macd.histogram;
            const macdSignal = hist > 0 ? 'bullish' : hist < 0 ? 'bearish' : 'neutral';
            signals.push({
              source: 'MACD',
              signal: macdSignal as ConvergenceSignal['signal'],
              strength: Math.min(Math.abs(hist) * 10, 1),
              detail: `Histogram: ${hist.toFixed(4)}`,
            });
            totalScore += macdSignal === 'bullish' ? 15 : macdSignal === 'bearish' ? -15 : 0;
            signalCount++;
          }
          // Moving average trend
          if (ind.sma_50 != null && ind.sma_200 != null) {
            const golden = ind.sma_50 > ind.sma_200;
            signals.push({
              source: 'MA Crossover',
              signal: golden ? 'bullish' : 'bearish',
              strength: 0.7,
              detail: golden ? 'Golden cross (50 > 200)' : 'Death cross (50 < 200)',
            });
            totalScore += golden ? 20 : -20;
            signalCount++;
          }
          // Bollinger position
          if (ind.bollinger_bands && tech.latest_close) {
            const bb = ind.bollinger_bands;
            const price = tech.latest_close;
            const bbSignal = price < bb.lower ? 'bullish' : price > bb.upper ? 'bearish' : 'neutral';
            signals.push({
              source: 'Bollinger Bands',
              signal: bbSignal as ConvergenceSignal['signal'],
              strength: 0.6,
              detail: `Price ${price > bb.upper ? 'above upper' : price < bb.lower ? 'below lower' : 'within'} band`,
            });
            totalScore += bbSignal === 'bullish' ? 10 : bbSignal === 'bearish' ? -10 : 0;
            signalCount++;
          }
        }
      }

      // Insider signal
      if (insiderRes.status === 'fulfilled') {
        const insData = (insiderRes.value as any)?.data;
        if (insData?.sentiment) {
          const sent = insData.sentiment;
          const insSignal = sent.signal === 'bullish' ? 'bullish' : sent.signal === 'bearish' ? 'bearish' : 'neutral';
          signals.push({
            source: 'Insider Activity',
            signal: insSignal as ConvergenceSignal['signal'],
            strength: Math.min(Math.abs(sent.score) / 100, 1),
            detail: `${insData.summary?.total_purchases ?? 0} buys, ${insData.summary?.total_sales ?? 0} sells`,
          });
          totalScore += insSignal === 'bullish' ? 15 : insSignal === 'bearish' ? -15 : 0;
          signalCount++;
        }
      }

      // Price momentum
      if (priceRes.status === 'fulfilled') {
        const bars = (priceRes.value as any)?.data?.bars;
        if (bars && bars.length >= 20) {
          const recent = bars.slice(-5);
          const older = bars.slice(-20, -5);
          const recentAvg = recent.reduce((s: number, b: any) => s + b.close, 0) / recent.length;
          const olderAvg = older.reduce((s: number, b: any) => s + b.close, 0) / older.length;
          const momentum = ((recentAvg - olderAvg) / olderAvg) * 100;
          const momSignal = momentum > 2 ? 'bullish' : momentum < -2 ? 'bearish' : 'neutral';
          signals.push({
            source: 'Price Momentum',
            signal: momSignal as ConvergenceSignal['signal'],
            strength: Math.min(Math.abs(momentum) / 10, 1),
            detail: `${momentum > 0 ? '+' : ''}${momentum.toFixed(1)}% over 20 days`,
          });
          totalScore += momSignal === 'bullish' ? 20 : momSignal === 'bearish' ? -20 : 0;
          signalCount++;
        }
      }

      const clampedScore = Math.max(-100, Math.min(100, totalScore));
      const direction: ConvergenceData['direction'] =
        clampedScore > 15 ? 'bullish' : clampedScore < -15 ? 'bearish' : 'neutral';
      const confidence = signalCount > 0 ? Math.min(signalCount / 6, 1) : 0;

      return {
        ticker,
        score: clampedScore,
        direction,
        confidence,
        signals,
        summary: `${signals.filter(s => s.signal === 'bullish').length} bullish, ${signals.filter(s => s.signal === 'bearish').length} bearish, ${signals.filter(s => s.signal === 'neutral').length} neutral signals`,
        updated_at: new Date().toISOString(),
      };
    },
    enabled: !!ticker,
    staleTime: 2 * 60 * 1000,
  });
}
