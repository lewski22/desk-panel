const BASE = import.meta.env.VITE_API_URL ?? 'https://api.prohalw2026.ovh/api/v1';

const getToken = () => localStorage.getItem('owner_access');

async function tryRefresh(): Promise<boolean> {
  const rt = localStorage.getItem('owner_refresh');
  if (!rt) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) return false;
    const d = await res.json();
    localStorage.setItem('owner_access',  d.accessToken);
    localStorage.setItem('owner_refresh', d.refreshToken);
    return true;
  } catch { return false; }
}

async function req<T>(path: string, opts: RequestInit = {}, _retry = true): Promise<T> {
  const tok = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  if (res.status === 401 && _retry) {
    const ok = await tryRefresh();
    if (ok) return req<T>(path, opts, false);
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (res.status === 204) return undefined as unknown as T;
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message ?? res.statusText);
  }
  return res.json();
}

export const ownerApi = {
  auth: {
    async login(email: string, password: string) {
      const d = await req<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('owner_access',  d.accessToken);
      localStorage.setItem('owner_refresh', d.refreshToken);
      localStorage.setItem('owner_user',    JSON.stringify(d.user));
      return d.user;
    },
    logout() {
      const rt = localStorage.getItem('owner_refresh');
      if (rt) fetch(`${BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      }).catch(() => {});
      ['owner_access', 'owner_refresh', 'owner_user'].forEach(k => localStorage.removeItem(k));
    },
    user(): any {
      try { return JSON.parse(localStorage.getItem('owner_user') ?? 'null'); } catch { return null; }
    },
  },

  organizations: {
    list:         (params?: { isActive?: boolean; plan?: string; search?: string }) => {
      const q = new URLSearchParams();
      if (params?.isActive !== undefined) q.set('isActive', String(params.isActive));
      if (params?.plan)   q.set('plan', params.plan);
      if (params?.search) q.set('search', params.search);
      return req<any[]>(`/owner/organizations?${q}`);
    },
    get:          (id: string)    => req<any>(`/owner/organizations/${id}`),
    create:       (d: any)        => req<any>('/owner/organizations', { method: 'POST', body: JSON.stringify(d) }),
    update:       (id: string, d: any) => req<any>(`/owner/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
    deactivate:   (id: string)    => req<any>(`/owner/organizations/${id}`, { method: 'DELETE' }),
    impersonate:  (id: string)    => req<any>(`/owner/organizations/${id}/impersonate`, { method: 'POST' }),
  },

  health: {
    global:   (params?: { status?: string; orgId?: string }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set('status', params.status);
      if (params?.orgId)  q.set('orgId',  params.orgId);
      return req<any[]>(`/owner/health?${q}`);
    },
    org: (orgId: string) => req<any>(`/owner/health/${orgId}`),
  },

  stats: () => req<any>('/owner/stats'),
};
