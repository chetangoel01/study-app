const BASE = import.meta.env.VITE_API_BASE ?? '';

async function apiFetch<T>(path: string, options: RequestInit & { skipRefresh?: boolean } = {}): Promise<T> {
  const { skipRefresh, ...opts } = options;
  const res = await fetch(`${BASE}${path}`, {
    ...opts, credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
  });

  if (res.status === 401 && !skipRefresh) {
    const ok = await fetch(`${BASE}/api/auth/refresh`, { method: 'POST', credentials: 'include' }).then(r => r.ok);
    if (ok) return apiFetch(path, { ...options, skipRefresh: true });
    window.dispatchEvent(new Event('session-expired'));
    throw Object.assign(new Error('session-expired'), { status: 401 });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error ?? `HTTP ${res.status}`), { status: res.status, body });
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
