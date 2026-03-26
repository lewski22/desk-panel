const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

const getToken = () => localStorage.getItem('admin_access');

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  // FIX: read token once, not twice (was calling token() twice in headers spread)
  const tok = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Unauthorized'); }
  if (res.status === 204) return undefined as unknown as T;
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message ?? res.statusText);
  }
  return res.json();
}

export const adminApi = {
  auth: {
    async login(email: string, password: string) {
      const d = await req<any>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      localStorage.setItem('admin_access',  d.accessToken);
      localStorage.setItem('admin_refresh', d.refreshToken);
      localStorage.setItem('admin_user',    JSON.stringify(d.user));
      return d.user;
    },
    logout() {
      const rt = localStorage.getItem('admin_refresh');
      if (rt) fetch(`${BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      }).catch(() => {});
      ['admin_access', 'admin_refresh', 'admin_user'].forEach(k => localStorage.removeItem(k));
    },
    user(): any { try { return JSON.parse(localStorage.getItem('admin_user') ?? 'null'); } catch { return null; } },
  },

  orgs: {
    list:   ()                              => req<any[]>('/organizations'),
    create: (d: any)                        => req<any>('/organizations', { method: 'POST', body: JSON.stringify(d) }),
    update: (id: string, d: any)            => req<any>(`/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
  },

  locations: {
    listAll:   ()                           => req<any[]>('/locations'),
    list:      (orgId: string)              => req<any[]>(`/organizations/${orgId}/locations`),
    create:    (orgId: string, d: any)      => req<any>(`/organizations/${orgId}/locations`, { method: 'POST', body: JSON.stringify(d) }),
    update:    (id: string, d: any)         => req<any>(`/locations/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
    occupancy: (locId: string)              => req<any>(`/locations/${locId}/analytics/occupancy`),
    extended:  (locId: string)              => req<any>(`/locations/${locId}/analytics/extended`),
  },

  desks: {
    list:        (locId: string)            => req<any[]>(`/locations/${locId}/desks`),
    status:      (locId: string)            => req<any[]>(`/locations/${locId}/desks/status`),
    create:      (locId: string, d: any)    => req<any>(`/locations/${locId}/desks`, { method: 'POST', body: JSON.stringify(d) }),
    update:      (id: string, d: any)       => req<any>(`/desks/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
    remove:      (id: string)               => req<any>(`/desks/${id}`, { method: 'DELETE' }),
    activate:    (id: string)               => req<any>(`/desks/${id}/activate`, { method: 'PATCH' }),
    unpair:      (id: string)               => req<any>(`/desks/${id}/unpair`, { method: 'PATCH' }),
    availability:(id: string, date: string) => req<any>(`/desks/${id}/availability?date=${date}`),
  },

  devices: {
    list:     (gwId?: string)               => req<any[]>(`/devices${gwId ? `?gatewayId=${gwId}` : ''}`),
    provision: (d: any)                     => req<any>('/devices/provision', { method: 'POST', body: JSON.stringify(d) }),
    assign:   (id: string, deskId: string)  => req<any>(`/devices/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ deskId }) }),
    command:  (id: string, cmd: string, params?: any) =>
      req<any>(`/devices/${id}/command`, { method: 'POST', body: JSON.stringify({ command: cmd, params }) }),
    remove:   (id: string)                  => req<any>(`/devices/${id}`, { method: 'DELETE' }),
  },

  gateways: {
    list:             (locId?: string)              => req<any[]>(`/gateway${locId ? `?locationId=${locId}` : ''}`),
    register:         (locId: string, name: string) => req<any>('/gateway/register', { method: 'POST', body: JSON.stringify({ locationId: locId, name }) }),
    sync:             (id: string)                  => req<any>(`/gateway/${id}/sync`, { method: 'POST' }),
    remove:           (id: string)                  => req<any>(`/gateway/${id}`, { method: 'DELETE' }),
    regenerateSecret: (id: string)                  => req<any>(`/gateway/${id}/regenerate-secret`, { method: 'POST' }),
  },

  users: {
    list:          (orgId?: string)                      => req<any[]>(`/users${orgId ? `?organizationId=${orgId}` : ''}`),
    listDeactivated:(orgId?: string)                     => req<any[]>(`/users/deactivated${orgId ? `?organizationId=${orgId}` : ''}`),
    create:        (d: any)                              => req<any>('/users', { method: 'POST', body: JSON.stringify(d) }),
    update:        (id: string, d: any)                  => req<any>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
    assignCard:    (id: string, uid: string)             => req<any>(`/users/${id}/card`, { method: 'PATCH', body: JSON.stringify({ cardUid: uid }) }),
    deactivate:    (id: string, retentionDays?: number)  => req<any>(`/users/${id}`, { method: 'DELETE', body: JSON.stringify({ retentionDays: retentionDays ?? 30 }) }),
    restore:       (id: string)                          => req<any>(`/users/${id}/restore`, { method: 'PATCH' }),
    hardDelete:    (id: string)                          => req<any>(`/users/${id}/permanent`, { method: 'DELETE' }),
  },

  reservations: {
    list:   (filters: Record<string, string>) => req<any[]>('/reservations?' + new URLSearchParams(filters).toString()),
    create: (d: any)                          => req<any>('/reservations', { method: 'POST', body: JSON.stringify(d) }),
    cancel: (id: string)                      => req<any>(`/reservations/${id}`, { method: 'DELETE' }),
  },

  checkins: {
    manual:   (deskId: string, userId: string, resId?: string) =>
      req<any>('/checkins/manual', { method: 'POST', body: JSON.stringify({ deskId, userId, reservationId: resId }) }),
    checkout: (id: string)                    => req<any>(`/checkins/${id}/checkout`, { method: 'PATCH' }),
  },
};
