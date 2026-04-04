import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import {
  type AuthUser,
  login as authLogin,
  signup as authSignup,
  logout as authLogout,
  getMe,
  refreshToken as authRefreshToken,
  getStoredToken,
  getStoredUser,
  storeAuth,
  clearAuth,
} from '../lib/auth';
import { onAuthExpired } from '../lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const MOCK_USER: AuthUser = {
  id: 'dev-user-1',
  email: 'dev@eugene.io',
  name: 'Dev User',
  created_at: new Date().toISOString(),
};
const MOCK_TOKEN = 'dev-token-mock';

const AUTH_DISABLED = import.meta.env.VITE_AUTH_DISABLED === 'true';

/** Decode JWT payload without verification (for expiry check) */
function decodePayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

/** Milliseconds until token expires; negative = already expired */
function msUntilExpiry(token: string): number {
  const payload = decodePayload(token);
  if (!payload?.exp) return Infinity;
  return payload.exp * 1000 - Date.now();
}

/** Refresh threshold: 10 minutes before expiry */
const REFRESH_THRESHOLD_MS = 10 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** Schedule a token refresh before it expires */
  const scheduleRefresh = useCallback((currentToken: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

    const ms = msUntilExpiry(currentToken);
    if (ms === Infinity || ms < 0) return; // no exp or already expired

    const delay = Math.max(ms - REFRESH_THRESHOLD_MS, 0);
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const { token: newToken } = await authRefreshToken(currentToken);
        // Re-read user to update any changes
        const freshUser = await getMe(newToken);
        storeAuth(newToken, freshUser);
        setToken(newToken);
        setUser(freshUser);
        scheduleRefresh(newToken);
      } catch {
        // Refresh failed — clear auth
        clearAuth();
        setUser(null);
        setToken(null);
      }
    }, delay);
  }, []);

  // Bootstrap: check stored token on mount
  useEffect(() => {
    if (AUTH_DISABLED) {
      setUser(MOCK_USER);
      setToken(MOCK_TOKEN);
      setIsLoading(false);
      return;
    }

    const storedToken = getStoredToken();
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    // Check if token is already expired
    if (msUntilExpiry(storedToken) < 0) {
      clearAuth();
      setIsLoading(false);
      return;
    }

    // Validate stored token with the backend
    getMe(storedToken)
      .then((validatedUser) => {
        setUser(validatedUser);
        setToken(storedToken);
        storeAuth(storedToken, validatedUser);
        scheduleRefresh(storedToken);
      })
      .catch(() => {
        // Token is invalid/expired — try using cached user as fallback
        // so we don't flash login page when backend is down
        const cachedUser = getStoredUser();
        if (cachedUser) {
          setUser(cachedUser);
          setToken(storedToken);
          scheduleRefresh(storedToken);
        } else {
          clearAuth();
        }
      })
      .finally(() => setIsLoading(false));
  }, [scheduleRefresh]);

  // Listen for 401s from eugeneApi and auto-logout
  useEffect(() => {
    if (AUTH_DISABLED) return;
    return onAuthExpired(() => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      setUser(null);
      setToken(null);
    });
  }, []);

  // Cleanup refresh timer
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authLogin(email, password);
    setUser(result.user);
    setToken(result.token);
    scheduleRefresh(result.token);
  }, [scheduleRefresh]);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    const result = await authSignup(email, password, name);
    setUser(result.user);
    setToken(result.token);
    scheduleRefresh(result.token);
  }, [scheduleRefresh]);

  const logout = useCallback(() => {
    authLogout();
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
