import { useState, useCallback, useEffect } from 'react';

export interface Position {
  ticker: string;
  shares: number;
  avgCost: number;
  addedAt: number; // timestamp
}

const STORAGE_KEY = 'eugene_portfolio';

function loadPortfolio(): Position[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function savePortfolio(positions: Position[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // localStorage might be full
  }
}

// Cross-component sync
const listeners = new Set<() => void>();
function emitChange() {
  listeners.forEach((fn) => fn());
}

export function usePortfolio() {
  const [positions, setPositions] = useState<Position[]>(loadPortfolio);

  useEffect(() => {
    const handler = () => setPositions(loadPortfolio());
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const addPosition = useCallback((ticker: string, shares: number, avgCost: number) => {
    const normalized = ticker.trim().toUpperCase();
    if (!normalized || shares <= 0 || avgCost <= 0) return false;
    setPositions((prev) => {
      const existing = prev.find((p) => p.ticker === normalized);
      let next: Position[];
      if (existing) {
        // Average in: (old_shares * old_cost + new_shares * new_cost) / total_shares
        const totalShares = existing.shares + shares;
        const totalCost = existing.shares * existing.avgCost + shares * avgCost;
        next = prev.map((p) =>
          p.ticker === normalized
            ? { ...p, shares: totalShares, avgCost: totalCost / totalShares }
            : p
        );
      } else {
        next = [...prev, { ticker: normalized, shares, avgCost, addedAt: Date.now() }];
      }
      savePortfolio(next);
      emitChange();
      return next;
    });
    return true;
  }, []);

  const removePosition = useCallback((ticker: string) => {
    const normalized = ticker.trim().toUpperCase();
    setPositions((prev) => {
      const next = prev.filter((p) => p.ticker !== normalized);
      savePortfolio(next);
      emitChange();
      return next;
    });
  }, []);

  const updatePosition = useCallback((ticker: string, shares: number, avgCost: number) => {
    const normalized = ticker.trim().toUpperCase();
    if (shares <= 0 || avgCost <= 0) return;
    setPositions((prev) => {
      const next = prev.map((p) =>
        p.ticker === normalized ? { ...p, shares, avgCost } : p
      );
      savePortfolio(next);
      emitChange();
      return next;
    });
  }, []);

  const hasPosition = useCallback((ticker: string) => {
    return positions.some((p) => p.ticker === ticker.trim().toUpperCase());
  }, [positions]);

  const totalCostBasis = positions.reduce((sum, p) => sum + p.shares * p.avgCost, 0);

  return {
    positions,
    addPosition,
    removePosition,
    updatePosition,
    hasPosition,
    totalCostBasis,
    count: positions.length,
  };
}
