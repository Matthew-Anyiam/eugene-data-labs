import { getStoredToken, clearAuth } from './auth';

const API_BASE = import.meta.env.VITE_API_URL || '';

/** Listeners notified on 401 so AuthContext can clear state */
type AuthExpiredListener = () => void;
const authExpiredListeners = new Set<AuthExpiredListener>();
export function onAuthExpired(listener: AuthExpiredListener): () => void {
  authExpiredListeners.add(listener);
  return () => authExpiredListeners.delete(listener);
}
function notifyAuthExpired() {
  clearAuth();
  authExpiredListeners.forEach((fn) => fn());
}

export async function fetchSEC<T = any>(ticker: string, params: URLSearchParams): Promise<T> {
  return eugeneApi<T>(`/v1/sec/${encodeURIComponent(ticker)}?${params.toString()}`);
}

export const apiFetch = eugeneApi;

export async function eugeneApi<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    });
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = import.meta.env.VITE_API_KEY;
  if (apiKey) headers['X-API-Key'] = apiKey;

  // Inject auth token if available
  const token = getStoredToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${url.pathname}${url.search}`, { headers });

  // Handle 401 — token expired or invalid
  if (res.status === 401) {
    notifyAuthExpired();
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}
