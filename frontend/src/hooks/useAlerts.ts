import { useState, useCallback, useEffect } from 'react';

export type AlertCondition = 'above' | 'below' | 'change_up' | 'change_down' | 'new_filing';

export interface Alert {
  id: string;
  ticker: string;
  condition: AlertCondition;
  value: number; // price threshold or % change threshold
  label: string; // human-readable description
  createdAt: number;
  triggered: boolean;
  triggeredAt?: number;
  read: boolean;
}

const STORAGE_KEY = 'eugene_alerts';

function generateId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadAlerts(): Alert[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveAlerts(alerts: Alert[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    // localStorage might be full
  }
}

// Cross-component sync
const listeners = new Set<() => void>();
function emitChange() {
  listeners.forEach((fn) => fn());
}

function conditionLabel(ticker: string, condition: AlertCondition, value: number): string {
  switch (condition) {
    case 'above':
      return `${ticker} price above $${value.toFixed(2)}`;
    case 'below':
      return `${ticker} price below $${value.toFixed(2)}`;
    case 'change_up':
      return `${ticker} up ${value.toFixed(1)}% in a day`;
    case 'change_down':
      return `${ticker} down ${value.toFixed(1)}% in a day`;
    case 'new_filing':
      return `New SEC filing for ${ticker}`;
    default:
      return `${ticker} alert`;
  }
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>(loadAlerts);

  useEffect(() => {
    const handler = () => setAlerts(loadAlerts());
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const addAlert = useCallback((ticker: string, condition: AlertCondition, value: number) => {
    const normalized = ticker.trim().toUpperCase();
    if (!normalized) return null;
    const alert: Alert = {
      id: generateId(),
      ticker: normalized,
      condition,
      value,
      label: conditionLabel(normalized, condition, value),
      createdAt: Date.now(),
      triggered: false,
      read: false,
    };
    setAlerts((prev) => {
      const next = [alert, ...prev];
      saveAlerts(next);
      emitChange();
      return next;
    });
    return alert;
  }, []);

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => {
      const next = prev.filter((a) => a.id !== id);
      saveAlerts(next);
      emitChange();
      return next;
    });
  }, []);

  const triggerAlert = useCallback((id: string) => {
    setAlerts((prev) => {
      const next = prev.map((a) =>
        a.id === id ? { ...a, triggered: true, triggeredAt: Date.now() } : a
      );
      saveAlerts(next);
      emitChange();
      return next;
    });
  }, []);

  const markRead = useCallback((id: string) => {
    setAlerts((prev) => {
      const next = prev.map((a) =>
        a.id === id ? { ...a, read: true } : a
      );
      saveAlerts(next);
      emitChange();
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setAlerts((prev) => {
      const next = prev.map((a) => ({ ...a, read: true }));
      saveAlerts(next);
      emitChange();
      return next;
    });
  }, []);

  const clearTriggered = useCallback(() => {
    setAlerts((prev) => {
      const next = prev.filter((a) => !a.triggered);
      saveAlerts(next);
      emitChange();
      return next;
    });
  }, []);

  const unreadCount = alerts.filter((a) => a.triggered && !a.read).length;
  const activeCount = alerts.filter((a) => !a.triggered).length;

  return {
    alerts,
    addAlert,
    removeAlert,
    triggerAlert,
    markRead,
    markAllRead,
    clearTriggered,
    unreadCount,
    activeCount,
    count: alerts.length,
  };
}
