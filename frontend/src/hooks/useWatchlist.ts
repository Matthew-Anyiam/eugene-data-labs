import { useState, useCallback, useEffect, useRef } from 'react';
import { getStoredToken } from '../lib/auth';

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

function saveWatchlistLocal(tickers: string[]) {
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

/** Sync watchlist to backend (fire-and-forget) */
async function syncToBackend(tickers: string[]): Promise<void> {
  const token = getStoredToken();
  if (!token) return;

  try {
    // Get existing watchlists
    const res = await fetch('/v1/watchlists', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;

    const { watchlists } = await res.json();
    if (watchlists?.length > 0) {
      // Update the first watchlist
      await fetch(`/v1/watchlists/${watchlists[0].id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tickers }),
      });
    } else {
      // Create default watchlist
      await fetch('/v1/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'Default', tickers }),
      });
    }
  } catch {
    // Silent — local is source of truth, backend is best-effort
  }
}

/** Pull watchlist from backend on mount if authenticated */
async function pullFromBackend(): Promise<string[] | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await fetch('/v1/watchlists', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;

    const { watchlists } = await res.json();
    if (watchlists?.length > 0 && watchlists[0].tickers?.length > 0) {
      return watchlists[0].tickers;
    }
  } catch {
    // Silent
  }
  return null;
}

export function useWatchlist() {
  const [tickers, setTickers] = useState<string[]>(loadWatchlist);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hasSynced = useRef(false);

  // Pull from backend on first mount (if authenticated)
  useEffect(() => {
    if (hasSynced.current) return;
    hasSynced.current = true;

    pullFromBackend().then((remote) => {
      if (remote) {
        setTickers(remote);
        saveWatchlistLocal(remote);
        emitChange();
      }
    });
  }, []);

  // Listen for changes from other instances of this hook
  useEffect(() => {
    const handler = () => setTickers(loadWatchlist());
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  /** Debounced sync: save locally immediately, sync to backend after 2s idle */
  const syncTickers = useCallback((next: string[]) => {
    saveWatchlistLocal(next);
    emitChange();
    // Debounce backend sync
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => syncToBackend(next), 2000);
  }, []);

  const addTicker = useCallback((ticker: string) => {
    const normalized = ticker.trim().toUpperCase();
    if (!normalized || normalized.length > 10) return false;
    setTickers((prev) => {
      if (prev.includes(normalized)) return prev;
      const next = [...prev, normalized];
      syncTickers(next);
      return next;
    });
    return true;
  }, [syncTickers]);

  const removeTicker = useCallback((ticker: string) => {
    const normalized = ticker.trim().toUpperCase();
    setTickers((prev) => {
      const next = prev.filter((t) => t !== normalized);
      syncTickers(next);
      return next;
    });
  }, [syncTickers]);

  const hasTicker = useCallback((ticker: string) => {
    return tickers.includes(ticker.trim().toUpperCase());
  }, [tickers]);

  const moveTicker = useCallback((from: number, to: number) => {
    setTickers((prev) => {
      const next = [...prev];
      const [removed] = next.splice(from, 1);
      next.splice(to, 0, removed);
      syncTickers(next);
      return next;
    });
  }, [syncTickers]);

  return {
    tickers,
    addTicker,
    removeTicker,
    hasTicker,
    moveTicker,
    count: tickers.length,
  };
}
