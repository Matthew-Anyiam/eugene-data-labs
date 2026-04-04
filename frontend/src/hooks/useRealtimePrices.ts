import { useEffect, useRef, useState, useCallback } from 'react';

export interface RealtimePrice {
  ticker: string;
  price: number;
  change: number;
  change_percent: number;
  volume: number;
  market_cap?: number;
  day_high?: number;
  day_low?: number;
  timestamp: string;
}

interface PriceUpdate {
  type: 'prices' | 'error';
  data?: Record<string, any>;
  message?: string;
  timestamp?: string;
}

export function useRealtimePrices(tickers: string[], enabled = true, interval = 5) {
  const [prices, setPrices] = useState<Record<string, RealtimePrice>>({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const connect = useCallback(() => {
    if (!tickers.length || !enabled) return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const tickerStr = tickers.join(',');
    const url = `/v1/stream/prices?tickers=${encodeURIComponent(tickerStr)}&interval=${interval}`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (event) => {
      try {
        const update: PriceUpdate = JSON.parse(event.data);
        if (update.type === 'prices' && update.data) {
          setPrices(prev => {
            const next = { ...prev };
            for (const [ticker, data] of Object.entries(update.data!)) {
              next[ticker] = {
                ticker,
                price: data.price ?? 0,
                change: data.change ?? 0,
                change_percent: data.changesPercentage ?? data.change_percent ?? 0,
                volume: data.volume ?? 0,
                market_cap: data.marketCap ?? data.market_cap,
                day_high: data.dayHigh ?? data.day_high,
                day_low: data.dayLow ?? data.day_low,
                timestamp: update.timestamp ?? new Date().toISOString(),
              };
            }
            return next;
          });
        } else if (update.type === 'error') {
          setError(update.message ?? 'Stream error');
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      // Reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(connect, 5000);
    };
  }, [tickers.join(','), enabled, interval]);

  useEffect(() => {
    connect();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return { prices, connected, error };
}
