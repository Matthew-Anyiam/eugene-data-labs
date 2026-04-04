import { useState, useCallback, useRef, useEffect } from 'react';
import { getStoredToken } from '../lib/auth';

const STORAGE_KEY = 'eugene_preferences';

export interface UserPreferences {
  sidebarCollapsed: boolean;
  darkMode: boolean;
  defaultWatchlist: string[];
  sidebarSections: Record<string, boolean>;
  onboarded: boolean;
  lastVisitedTicker: string | null;
  defaultTimeframe: '1h' | '24h' | '7d' | '30d';
  tickerBarEnabled: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  sidebarCollapsed: false,
  darkMode: false,
  defaultWatchlist: [],
  sidebarSections: {},
  onboarded: false,
  lastVisitedTicker: null,
  defaultTimeframe: '24h',
  tickerBarEnabled: true,
};

function loadPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_PREFERENCES, ...parsed };
    }
  } catch { /* noop */ }
  return { ...DEFAULT_PREFERENCES };
}

function savePreferencesLocal(prefs: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* noop */ }
}

/** Sync preferences to backend (fire-and-forget) */
async function syncToBackend(prefs: UserPreferences): Promise<void> {
  const token = getStoredToken();
  if (!token) return;
  try {
    await fetch('/v1/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        theme: prefs.darkMode ? 'dark' : 'light',
        sidebar_collapsed: prefs.sidebarCollapsed,
        ticker_bar_enabled: prefs.tickerBarEnabled,
        preferences: prefs,
      }),
    });
  } catch {
    // Silent
  }
}

/** Pull preferences from backend */
async function pullFromBackend(): Promise<Partial<UserPreferences> | null> {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const res = await fetch('/v1/preferences', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.preferences && typeof data.preferences === 'object') {
      return data.preferences;
    }
  } catch {
    // Silent
  }
  return null;
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(loadPreferences);
  const prefsRef = useRef(preferences);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hasSynced = useRef(false);
  prefsRef.current = preferences;

  // Pull from backend on mount
  useEffect(() => {
    if (hasSynced.current) return;
    hasSynced.current = true;

    pullFromBackend().then((remote) => {
      if (remote) {
        setPreferences((prev) => {
          const merged = { ...prev, ...remote };
          savePreferencesLocal(merged);
          return merged;
        });
      }
    });
  }, []);

  const updatePreference = useCallback(<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value };
      savePreferencesLocal(next);
      // Debounce backend sync
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => syncToBackend(next), 2000);
      return next;
    });
  }, []);

  const resetPreferences = useCallback(() => {
    const defaults = { ...DEFAULT_PREFERENCES };
    setPreferences(defaults);
    savePreferencesLocal(defaults);
    syncToBackend(defaults);
  }, []);

  return { preferences, updatePreference, resetPreferences };
}
