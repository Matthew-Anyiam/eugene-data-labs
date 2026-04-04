import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  type AuthUser,
  login as authLogin,
  signup as authSignup,
  logout as authLogout,
  getMe,
  getStoredToken,
  getStoredUser,
  storeAuth,
  clearAuth,
} from '../lib/auth';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

    // Validate stored token with the backend
    getMe(storedToken)
      .then((validatedUser) => {
        setUser(validatedUser);
        setToken(storedToken);
        storeAuth(storedToken, validatedUser);
      })
      .catch(() => {
        // Token is invalid/expired — try using cached user as fallback
        // so we don't flash login page when backend is down
        const cachedUser = getStoredUser();
        if (cachedUser) {
          setUser(cachedUser);
          setToken(storedToken);
        } else {
          clearAuth();
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authLogin(email, password);
    setUser(result.user);
    setToken(result.token);
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    const result = await authSignup(email, password, name);
    setUser(result.user);
    setToken(result.token);
  }, []);

  const logout = useCallback(() => {
    authLogout();
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
