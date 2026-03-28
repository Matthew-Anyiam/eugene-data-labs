const API_BASE = import.meta.env.VITE_API_URL || '';

export async function fetchSEC<T = any>(ticker: string, params: URLSearchParams): Promise<T> {
  return eugeneApi<T>(`/v1/sec/${encodeURIComponent(ticker)}?${params.toString()}`);
}

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

  const res = await fetch(`${API_BASE}${url.pathname}${url.search}`, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}
