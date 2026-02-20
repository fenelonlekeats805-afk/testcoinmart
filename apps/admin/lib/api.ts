export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://testcoinmart.top/v1';

export async function apiFetch(path: string, init?: RequestInit, token?: string) {
  const headers = new Headers(init?.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || `HTTP ${res.status}`);
  }
  return body;
}
