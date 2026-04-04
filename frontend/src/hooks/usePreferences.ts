import { useState, useCallback, useRef } from 'react';

const STORAGE_KEY = 'eugene_preferences';

export interface UserPreferences {
  sidebarCollapsed: boolean;
  darkMode: boolean;
  defaultWatchlist: string[];
  sidebarSections: Record<string, boolean>;
  onboarded: boolean;
  lastVisitedTicker: string | null;
  defaultTimeframe: '1h' | '24h' | '7d' | '30d';
}

const DEFAULT_PREFERENCES: UserPreferences = {
  sidebarCollapsed: false,
  darkMode: false,
  defaultWatchlist: [],
  sidebarSections: {},
  onboarded: false,
  lastVisitedTicker: null,
  defaultTimeframe: '24h',
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

function savePreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* noop */ }
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(loadPreferences);
  const prefsRef = useRef(preferences);
  prefsRef.current = preferences;

  const updatePreference = useCallback(<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value };
      savePreferences(next);
      return next;
    });
  }, []);

  const resetPreferences = useCallback(() => {
    const defaults = { ...DEFAULT_PREFERENCES };
    setPreferences(defaults);
    savePreferences(defaults);
  }, []);

  return { preferences, updatePreference, resetPreferences };
}
