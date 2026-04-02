import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'eugene_watchlist';
const DEFAULT_WATCHLIST = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL'];

function loadWatchlist(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_WATCHLIST;
  } catch {
    return DEFAULT_WATCHLIST;
  }
}

function saveWatchlist(tickers: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
  } catch {
    // localStorage might be full or unavailable
  }
}

// Simple event emitter for cross-component sync
const listeners = new Set<() => void>();
function emitChange() {
  listeners.forEach((fn) => fn());
}

export function useWatchlist() {
  const [tickers, setTickers] = useState<string[]>(loadWatchlist);

  // Listen for changes from other instances of this hook
  useEffect(() => {
    const handler = () => setTickers(loadWatchlist());
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const addTicker = useCallback((ticker: string) => {
    const normalized = ticker.trim().toUpperCase();
    if (!normalized || normalized.length > 10) return false;
    setTickers((prev) => {
      if (prev.includes(normalized)) return prev;
      const next = [...prev, normalized];
      saveWatchlist(next);
      emitChange();
      return next;
    });
    return true;
  }, []);

  const removeTicker = useCallback((ticker: string) => {
    const normalized = ticker.trim().toUpperCase();
    setTickers((prev) => {
      const next = prev.filter((t) => t !== normalized);
      saveWatchlist(next);
      emitChange();
      return next;
    });
  }, []);

  const hasTicker = useCallback((ticker: string) => {
    return tickers.includes(ticker.trim().toUpperCase());
  }, [tickers]);

  const moveTicker = useCallback((from: number, to: number) => {
    setTickers((prev) => {
      const next = [...prev];
      const [removed] = next.splice(from, 1);
      next.splice(to, 0, removed);
      saveWatchlist(next);
      emitChange();
      return next;
    });
  }, []);

  return {
    tickers,
    addTicker,
    removeTicker,
    hasTicker,
    moveTicker,
    count: tickers.length,
  };
}
