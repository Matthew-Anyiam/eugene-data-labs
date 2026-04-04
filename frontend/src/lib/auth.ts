const API_BASE = import.meta.env.VITE_API_URL || '';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

const TOKEN_KEY = 'eugene_token';
const USER_KEY = 'eugene_user';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeAuth(token: string, user: AuthUser): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // silent — storage may be unavailable
  }
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // silent
  }
}

async function authFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message || body.error || `Auth error ${res.status}`);
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const data = await authFetch<AuthResponse>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  storeAuth(data.token, data.user);
  return data;
}

export async function signup(email: string, password: string, name: string): Promise<AuthResponse> {
  const data = await authFetch<AuthResponse>('/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
  storeAuth(data.token, data.user);
  return data;
}

export async function getMe(token: string): Promise<AuthUser> {
  return authFetch<AuthUser>('/v1/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function refreshToken(token: string): Promise<{ token: string }> {
  return authFetch<{ token: string }>('/v1/auth/refresh', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function logout(): void {
  clearAuth();
}
