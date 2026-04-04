import { useEffect, useRef, useState, useCallback } from 'react';
import { getStoredToken } from '../lib/auth';

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

/** Exponential backoff: 2s, 4s, 8s, 16s, 30s max. Resets on successful connection. */
const BASE_DELAY = 2000;
const MAX_DELAY = 30_000;
const MAX_RETRIES = 10;

function getBackoffDelay(attempt: number): number {
  return Math.min(BASE_DELAY * 2 ** attempt, MAX_DELAY);
}

/**
 * Real-time price streaming hook.
 * Tries WebSocket first (bidirectional, lower latency), falls back to SSE.
 * Uses exponential backoff for reconnection with max retry limit.
 */
export function useRealtimePrices(tickers: string[], enabled = true, interval = 5) {
  const [prices, setPrices] = useState<Record<string, RealtimePrice>>({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const transportRef = useRef<'ws' | 'sse' | null>(null);
  const wsRetriesRef = useRef(0);
  const sseRetriesRef = useRef(0);

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

  /** Try connecting via WebSocket with auth token */
  const connectWS = useCallback(() => {
    if (!tickers.length || !enabled) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_API_URL
      ? new URL(import.meta.env.VITE_API_URL).host
      : window.location.host;

    // Pass auth token as query param (WebSocket doesn't support custom headers)
    const token = getStoredToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    const url = `${protocol}//${host}/v1/ws/prices${tokenParam}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        transportRef.current = 'ws';
        wsRetriesRef.current = 0; // Reset on successful connection
        setConnected(true);
        setError(null);
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
        ws.close();
        wsRef.current = null;
        connectSSE(); // Fall back to SSE
      };

      ws.onclose = (event) => {
        if (event.code === 4001) {
          // Auth rejected — don't retry
          setError('Authentication required for price streaming');
          setConnected(false);
          return;
        }
        if (transportRef.current === 'ws') {
          setConnected(false);
          if (wsRetriesRef.current < MAX_RETRIES) {
            const delay = getBackoffDelay(wsRetriesRef.current);
            wsRetriesRef.current++;
            reconnectRef.current = setTimeout(connectWS, delay);
          } else {
            setError('Connection lost. Refresh to reconnect.');
          }
        }
      };
    } catch {
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
      sseRetriesRef.current = 0; // Reset on successful connection
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
      if (sseRetriesRef.current < MAX_RETRIES) {
        const delay = getBackoffDelay(sseRetriesRef.current);
        sseRetriesRef.current++;
        reconnectRef.current = setTimeout(connectSSE, delay);
      } else {
        setError('Connection lost. Refresh to reconnect.');
      }
    };
  }, [tickerKey, enabled, interval, handlePriceData]);

  useEffect(() => {
    connectWS();

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
