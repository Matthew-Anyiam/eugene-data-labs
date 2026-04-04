import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';

// Mock the API module
vi.mock('../lib/api', () => ({
  eugeneApi: vi.fn(),
}));

import { useConvergenceScore } from '../hooks/useConvergenceScore';
import { eugeneApi } from '../lib/api';

const mockedApi = vi.mocked(eugeneApi);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// Helper to build technicals response
function makeTechnicals(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      indicators: {
        rsi_14: 50,
        macd: { histogram: 0 },
        sma_50: 100,
        sma_200: 100,
        bollinger_bands: { lower: 90, upper: 110 },
        ...overrides,
      },
      latest_close: 100,
      ...(overrides._root as Record<string, unknown> ?? {}),
    },
  };
}

// Helper to build insider response
function makeInsiders(signal: string, score: number, purchases = 5, sales = 2) {
  return {
    data: {
      sentiment: { signal, score },
      summary: { total_purchases: purchases, total_sales: sales },
    },
  };
}

// Helper to build price bars
function makeBars(recentClose: number, olderClose: number, count = 25) {
  const bars = [];
  for (let i = 0; i < count - 5; i++) {
    bars.push({ close: olderClose });
  }
  for (let i = 0; i < 5; i++) {
    bars.push({ close: recentClose });
  }
  return { data: { bars } };
}

// Setup API mock to return given responses for each endpoint
function setupMocks(
  techResponse: unknown = null,
  insiderResponse: unknown = null,
  priceResponse: unknown = null,
) {
  mockedApi.mockImplementation(async (_path: string, params?: Record<string, string | number | undefined>) => {
    const extract = params?.extract;
    if (extract === 'technicals') {
      if (techResponse instanceof Error) throw techResponse;
      return techResponse;
    }
    if (extract === 'insiders') {
      if (insiderResponse instanceof Error) throw insiderResponse;
      return insiderResponse;
    }
    if (extract === 'ohlcv') {
      if (priceResponse instanceof Error) throw priceResponse;
      return priceResponse;
    }
    return {};
  });
}

describe('useConvergenceScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('bullish signals', () => {
    it('returns a bullish score when RSI is oversold', async () => {
      setupMocks(
        makeTechnicals({ rsi_14: 20, macd: null, sma_50: null, sma_200: null, bollinger_bands: null }),
        null,
        null,
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const data = result.current.data!;
      expect(data.score).toBe(20);
      expect(data.direction).toBe('bullish');
      const rsiSignal = data.signals.find(s => s.source === 'RSI (14)');
      expect(rsiSignal).toBeDefined();
      expect(rsiSignal!.signal).toBe('bullish');
      expect(rsiSignal!.strength).toBeCloseTo((30 - 20) / 30);
    });

    it('returns a strongly bullish score when all signals align bullish', async () => {
      // RSI < 30, MACD histogram > 0, golden cross, price below lower BB, bullish insiders, upward momentum
      setupMocks(
        {
          data: {
            indicators: {
              rsi_14: 22,
              macd: { histogram: 0.15 },
              sma_50: 110,
              sma_200: 100,
              bollinger_bands: { lower: 95, upper: 115 },
            },
            latest_close: 90, // below lower BB
          },
        },
        makeInsiders('bullish', 80, 10, 1),
        makeBars(110, 100, 25), // +10% momentum
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const data = result.current.data!;
      // RSI: +20, MACD: +15, MA: +20, BB: +10, Insider: +15, Momentum: +20 = 100
      expect(data.score).toBe(100);
      expect(data.direction).toBe('bullish');
      expect(data.signals.length).toBe(6);
      expect(data.confidence).toBe(1); // 6/6 = 1
    });

    it('detects golden cross as bullish', async () => {
      setupMocks(
        makeTechnicals({ rsi_14: null, macd: null, sma_50: 120, sma_200: 100, bollinger_bands: null }),
        null,
        null,
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const data = result.current.data!;
      expect(data.score).toBe(20);
      const maSignal = data.signals.find(s => s.source === 'MA Crossover');
      expect(maSignal!.signal).toBe('bullish');
      expect(maSignal!.detail).toContain('Golden cross');
    });

    it('detects price below lower Bollinger band as bullish', async () => {
      setupMocks(
        {
          data: {
            indicators: {
              rsi_14: null,
              macd: null,
              sma_50: null,
              sma_200: null,
              bollinger_bands: { lower: 95, upper: 115 },
            },
            latest_close: 90,
          },
        },
        null,
        null,
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const data = result.current.data!;
      expect(data.score).toBe(10);
      const bbSignal = data.signals.find(s => s.source === 'Bollinger Bands');
      expect(bbSignal!.signal).toBe('bullish');
    });

    it('detects strong upward price momentum as bullish', async () => {
      setupMocks(
        null,
        null,
        makeBars(120, 100, 25), // +20% momentum
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const data = result.current.data!;
      expect(data.score).toBe(20);
      const momSignal = data.signals.find(s => s.source === 'Price Momentum');
      expect(momSignal!.signal).toBe('bullish');
    });
  });

  describe('bearish signals', () => {
    it('returns a bearish score when RSI is overbought', async () => {
      setupMocks(
        makeTechnicals({ rsi_14: 82, macd: null, sma_50: null, sma_200: null, bollinger_bands: null }),
        null,
        null,
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const data = result.current.data!;
      expect(data.score).toBe(-20);
      expect(data.direction).toBe('bearish');
      const rsiSignal = data.signals.find(s => s.source === 'RSI (14)');
      expect(rsiSignal!.signal).toBe('bearish');
      expect(rsiSignal!.strength).toBeCloseTo((82 - 70) / 30);
    });

    it('returns a strongly bearish score when all signals align bearish', async () => {
      setupMocks(
        {
          data: {
            indicators: {
              rsi_14: 80,
              macd: { histogram: -0.2 },
              sma_50: 90,
              sma_200: 110,
              bollinger_bands: { lower: 85, upper: 105 },
            },
            latest_close: 110, // above upper BB
          },
        },
        makeInsiders('bearish', -70, 0, 12),
        makeBars(90, 100, 25), // -10% momentum
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const data = result.current.data!;
      // RSI: -20, MACD: -15, MA: -20, BB: -10, Insider: -15, Momentum: -20 = -100
      expect(data.score).toBe(-100);
      expect(data.direction).toBe('bearish');
      expect(data.signals.length).toBe(6);
    });

    it('detects death cross as bearish', async () => {
      setupMocks(
        makeTechnicals({ rsi_14: null, macd: null, sma_50: 90, sma_200: 110, bollinger_bands: null }),
        null,
        null,
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const maSignal = result.current.data!.signals.find(s => s.source === 'MA Crossover');
      expect(maSignal!.signal).toBe('bearish');
      expect(maSignal!.detail).toContain('Death cross');
    });

    it('detects negative MACD histogram as bearish', async () => {
      setupMocks(
        makeTechnicals({ rsi_14: null, macd: { histogram: -0.08 }, sma_50: null, sma_200: null, bollinger_bands: null }),
        null,
        null,
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const data = result.current.data!;
      expect(data.score).toBe(-15);
      const macdSignal = data.signals.find(s => s.source === 'MACD');
      expect(macdSignal!.signal).toBe('bearish');
      expect(macdSignal!.strength).toBeCloseTo(0.8); // 0.08 * 10
    });
  });

  describe('score clamping to -100..+100', () => {
    it('clamps score to 100 even with extreme bullish input', async () => {
      // All bullish max = 20+15+20+10+15+20 = 100, exactly at boundary
      setupMocks(
        {
          data: {
            indicators: {
              rsi_14: 5, // extreme oversold
              macd: { histogram: 5 },
              sma_50: 200,
              sma_200: 50,
              bollinger_bands: { lower: 150, upper: 250 },
            },
            latest_close: 50, // way below lower
          },
        },
        makeInsiders('bullish', 100),
        makeBars(200, 100, 25),
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data!.score).toBeLessThanOrEqual(100);
      expect(result.current.data!.score).toBeGreaterThanOrEqual(-100);
    });

    it('clamps score to -100 even with extreme bearish input', async () => {
      setupMocks(
        {
          data: {
            indicators: {
              rsi_14: 98,
              macd: { histogram: -5 },
              sma_50: 50,
              sma_200: 200,
              bollinger_bands: { lower: 40, upper: 80 },
            },
            latest_close: 200, // way above upper
          },
        },
        makeInsiders('bearish', -100),
        makeBars(80, 100, 25),
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data!.score).toBeGreaterThanOrEqual(-100);
      expect(result.current.data!.score).toBeLessThanOrEqual(100);
    });
  });

  describe('mixed signals', () => {
    it('produces moderate score with conflicting signals', async () => {
      // RSI bullish (+20) but MACD bearish (-15) and death cross (-20) = -15
      setupMocks(
        makeTechnicals({
          rsi_14: 25,
          macd: { histogram: -0.05 },
          sma_50: 95,
          sma_200: 100,
          bollinger_bands: null,
        }),
        null,
        null,
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const data = result.current.data!;
      // 20 - 15 - 20 = -15
      expect(data.score).toBe(-15);
      // -15 is not < -15, so direction is neutral (threshold is strictly less than)
      expect(data.direction).toBe('neutral');
      expect(data.signals.some(s => s.signal === 'bullish')).toBe(true);
      expect(data.signals.some(s => s.signal === 'bearish')).toBe(true);
    });

    it('returns neutral direction for small mixed scores', async () => {
      // RSI bullish (+20) + MACD bearish (-15) = 5
      setupMocks(
        makeTechnicals({
          rsi_14: 25,
          macd: { histogram: -0.05 },
          sma_50: null,
          sma_200: null,
          bollinger_bands: null,
        }),
        null,
        null,
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const data = result.current.data!;
      expect(data.score).toBe(5); // 20 - 15
      expect(data.direction).toBe('neutral');
    });

    it('produces correct summary of bullish/bearish/neutral counts', async () => {
      // RSI neutral (50), MACD bullish, golden cross, price within BB
      setupMocks(
        makeTechnicals({
          rsi_14: 50,
          macd: { histogram: 0.03 },
          sma_50: 110,
          sma_200: 100,
          bollinger_bands: { lower: 90, upper: 120 },
        }),
        null,
        null,
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const data = result.current.data!;
      // RSI neutral, MACD bullish, MA bullish, BB neutral (price 100 within 90-120)
      expect(data.summary).toContain('2 bullish');
      expect(data.summary).toContain('0 bearish');
      expect(data.summary).toContain('2 neutral');
    });
  });

  describe('missing/failed data handling', () => {
    it('returns zero score and no signals when all APIs fail', async () => {
      setupMocks(
        new Error('Network error'),
        new Error('Network error'),
        new Error('Network error'),
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const data = result.current.data!;
      expect(data.score).toBe(0);
      expect(data.direction).toBe('neutral');
      expect(data.signals).toHaveLength(0);
      expect(data.confidence).toBe(0);
    });

    it('handles null technicals data gracefully', async () => {
      setupMocks(
        { data: null },
        makeInsiders('bullish', 60),
        null,
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const data = result.current.data!;
      // Only insider signal should be present
      expect(data.signals).toHaveLength(1);
      expect(data.signals[0].source).toBe('Insider Activity');
      expect(data.score).toBe(15);
    });

    it('handles empty insider data gracefully', async () => {
      setupMocks(
        null,
        { data: {} }, // no sentiment field
        null,
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const data = result.current.data!;
      expect(data.signals.find(s => s.source === 'Insider Activity')).toBeUndefined();
    });

    it('handles too few price bars gracefully (< 20)', async () => {
      setupMocks(
        null,
        null,
        { data: { bars: Array(10).fill({ close: 100 }) } },
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const data = result.current.data!;
      expect(data.signals.find(s => s.source === 'Price Momentum')).toBeUndefined();
    });

    it('handles partial technicals (only RSI available)', async () => {
      setupMocks(
        { data: { indicators: { rsi_14: 35 } } },
        null,
        null,
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const data = result.current.data!;
      expect(data.signals).toHaveLength(1);
      expect(data.signals[0].source).toBe('RSI (14)');
      // RSI 35 is neutral (between 30 and 70)
      expect(data.signals[0].signal).toBe('neutral');
      expect(data.score).toBe(0);
    });

    it('does not fire query when ticker is empty', async () => {
      setupMocks();

      const { result } = renderHook(() => useConvergenceScore(''), {
        wrapper: createWrapper(),
      });

      // Should remain idle / not fetch
      expect(result.current.isFetching).toBe(false);
      expect(mockedApi).not.toHaveBeenCalled();
    });
  });

  describe('confidence calculation', () => {
    it('returns confidence proportional to signal count', async () => {
      // Only 2 signals: RSI + MACD
      setupMocks(
        makeTechnicals({ rsi_14: 25, macd: { histogram: 0.05 }, sma_50: null, sma_200: null, bollinger_bands: null }),
        null,
        null,
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // 2 signals / 6 max = 0.333
      expect(result.current.data!.confidence).toBeCloseTo(2 / 6);
    });

    it('caps confidence at 1.0', async () => {
      // All 6 signals present
      setupMocks(
        {
          data: {
            indicators: {
              rsi_14: 50,
              macd: { histogram: 0.01 },
              sma_50: 100,
              sma_200: 100,
              bollinger_bands: { lower: 90, upper: 110 },
            },
            latest_close: 100,
          },
        },
        makeInsiders('neutral', 5),
        makeBars(101, 100, 25),
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data!.confidence).toBe(1);
      expect(result.current.data!.signals.length).toBe(6);
    });
  });

  describe('signal strength calculations', () => {
    it('calculates RSI strength correctly for extreme oversold', async () => {
      setupMocks(
        makeTechnicals({ rsi_14: 5, macd: null, sma_50: null, sma_200: null, bollinger_bands: null }),
        null,
        null,
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const rsi = result.current.data!.signals.find(s => s.source === 'RSI (14)');
      // (30 - 5) / 30 = 0.833
      expect(rsi!.strength).toBeCloseTo(25 / 30);
    });

    it('caps RSI strength at 1', async () => {
      // RSI = 0, strength would be 30/30 = 1
      setupMocks(
        makeTechnicals({ rsi_14: 0, macd: null, sma_50: null, sma_200: null, bollinger_bands: null }),
        null,
        null,
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const rsi = result.current.data!.signals.find(s => s.source === 'RSI (14)');
      expect(rsi!.strength).toBeLessThanOrEqual(1);
    });

    it('caps MACD strength at 1', async () => {
      setupMocks(
        makeTechnicals({ rsi_14: null, macd: { histogram: 0.5 }, sma_50: null, sma_200: null, bollinger_bands: null }),
        null,
        null,
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const macd = result.current.data!.signals.find(s => s.source === 'MACD');
      // 0.5 * 10 = 5, capped to 1
      expect(macd!.strength).toBe(1);
    });

    it('caps momentum strength at 1', async () => {
      setupMocks(
        null,
        null,
        makeBars(200, 100, 25), // 100% momentum, /10 = 10, capped to 1
      );

      const { result } = renderHook(() => useConvergenceScore('AAPL'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const mom = result.current.data!.signals.find(s => s.source === 'Price Momentum');
      expect(mom!.strength).toBe(1);
    });
  });
});
