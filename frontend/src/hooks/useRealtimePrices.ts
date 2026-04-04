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
  type: 'prices' | 'error' | 'subscribed' | 'interval_set';
  data?: Record<string, any>;
  message?: string;
  timestamp?: string;
  tickers?: string[];
  interval?: number;
}

function parsePrice(ticker: string, data: any, timestamp?: string): RealtimePrice {
  return {
    ticker,
    price: data.price ?? 0,
    change: data.change ?? 0,
    change_percent: data.changesPercentage ?? data.change_percent ?? 0,
    volume: data.volume ?? 0,
    market_cap: data.marketCap ?? data.market_cap,
    day_high: data.dayHigh ?? data.day_high,
    day_low: data.dayLow ?? data.day_low,
    timestamp: timestamp ?? new Date().toISOString(),
  };
}

/**
 * Real-time price streaming hook.
 * Tries WebSocket first (bidirectional, lower latency), falls back to SSE.
 */
export function useRealtimePrices(tickers: string[], enabled = true, interval = 5) {
  const [prices, setPrices] = useState<Record<string, RealtimePrice>>({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const transportRef = useRef<'ws' | 'sse' | null>(null);

  const tickerKey = tickers.join(',');

  const handlePriceData = useCallback((update: PriceUpdate) => {
    if (update.type === 'prices' && update.data) {
      setPrices((prev) => {
        const next = { ...prev };
        for (const [ticker, data] of Object.entries(update.data!)) {
          next[ticker] = parsePrice(ticker, data, update.timestamp);
        }
        return next;
      });
    } else if (update.type === 'error') {
      setError(update.message ?? 'Stream error');
    }
  }, []);

  /** Try connecting via WebSocket */
  const connectWS = useCallback(() => {
    if (!tickers.length || !enabled) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_API_URL
      ? new URL(import.meta.env.VITE_API_URL).host
      : window.location.host;
    const url = `${protocol}//${host}/v1/ws/prices`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        transportRef.current = 'ws';
        setConnected(true);
        setError(null);
        // Subscribe to tickers
        ws.send(JSON.stringify({ action: 'subscribe', tickers }));
        if (interval !== 5) {
          ws.send(JSON.stringify({ action: 'set_interval', interval }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const update: PriceUpdate = JSON.parse(event.data);
          handlePriceData(update);
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {
        // WebSocket failed — fall back to SSE
        ws.close();
        wsRef.current = null;
        connectSSE();
      };

      ws.onclose = () => {
        if (transportRef.current === 'ws') {
          setConnected(false);
          reconnectRef.current = setTimeout(connectWS, 5000);
        }
      };
    } catch {
      // WebSocket constructor failed — fall back to SSE
      connectSSE();
    }
  }, [tickerKey, enabled, interval, handlePriceData]);

  /** Fallback: connect via Server-Sent Events */
  const connectSSE = useCallback(() => {
    if (!tickers.length || !enabled) return;
    if (esRef.current) esRef.current.close();

    const base = import.meta.env.VITE_API_URL || '';
    const url = `${base}/v1/stream/prices?tickers=${encodeURIComponent(tickerKey)}&interval=${interval}`;

    const es = new EventSource(url);
    esRef.current = es;
    transportRef.current = 'sse';

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (event) => {
      try {
        const update: PriceUpdate = JSON.parse(event.data);
        handlePriceData(update);
      } catch {
        // ignore
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      reconnectRef.current = setTimeout(connectSSE, 5000);
    };
  }, [tickerKey, enabled, interval, handlePriceData]);

  useEffect(() => {
    connectWS(); // Start with WebSocket, auto-fallback to SSE

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
      }
      transportRef.current = null;
    };
  }, [connectWS]);

  return { prices, connected, error, transport: transportRef.current };
}
