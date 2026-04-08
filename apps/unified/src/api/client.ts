const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

// Unified localStorage keys — zastępują admin_access/access_token itd.
const KEYS = {
  access:  'app_access',
  refresh: 'app_refresh',
  user:    'app_user',
};

const getToken = () => localStorage.getItem(KEYS.access);

async function tryRefresh(): Promise<boolean> {
  const rt = localStorage.getItem(KEYS.refresh);
  if (!rt) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) return false;
    const d = await res.json();
    localStorage.setItem(KEYS.access,  d.accessToken);
    localStorage.setItem(KEYS.refresh, d.refreshToken);
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
    const refreshed = await tryRefresh();
    if (refreshed) return req<T>(path, opts, false);
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Unauthorized'); }
  if (res.status === 204) return undefined as unknown as T;
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message ?? res.statusText);
  }
  return res.json();
}

export const appApi = {
  auth: {
    async login(email: string, password: string) {
      const d = await req<any>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      localStorage.setItem(KEYS.access,  d.accessToken);
      localStorage.setItem(KEYS.refresh, d.refreshToken);
      localStorage.setItem(KEYS.user,    JSON.stringify({ ...d.user, accessToken: d.accessToken }));
      return { ...d.user, accessToken: d.accessToken };
    },
    async loginAzure(idToken: string) {
      const d = await req<any>('/auth/azure', { method: 'POST', body: JSON.stringify({ idToken }) });
      localStorage.setItem(KEYS.access,  d.accessToken);
      localStorage.setItem(KEYS.refresh, d.refreshToken);
      localStorage.setItem(KEYS.user,    JSON.stringify({ ...d.user, accessToken: d.accessToken }));
      return { ...d.user, accessToken: d.accessToken };
    },
    async checkSso(email: string): Promise<{ available: boolean; tenantId?: string }> {
      return req<any>(`/auth/azure/check?email=${encodeURIComponent(email)}`);
    },
    logout() {
      const rt = localStorage.getItem(KEYS.refresh);
      if (rt) fetch(`${BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      }).catch(() => {});
      Object.values(KEYS).forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('app_impersonated');
    },
    user(): any {
      try { return JSON.parse(localStorage.getItem(KEYS.user) ?? 'null'); } catch { return null; }
    },
    changePassword(currentPassword: string, newPassword: string): Promise<void> {
      return req<void>('/auth/change-password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },
  },

  orgs: {
    list:              ()                              => req<any[]>('/organizations'),
    create:            (d: any)                        => req<any>('/organizations', { method: 'POST', body: JSON.stringify(d) }),
    update:            (id: string, d: any)            => req<any>(`/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
    getAzureConfig:    (id: string)                    => req<any>(`/organizations/${id}/azure`),
    updateAzureConfig: (id: string, d: any)            => req<any>(`/organizations/${id}/azure`, { method: 'PATCH', body: JSON.stringify(d) }),
  },


  owner: {
    // Statystyki platformy (firmy, gateway, beacony, check-iny)
    getStats:        ()                     => req<any>('/owner/stats'),
    // Lista wszystkich firm z metrykami
    listOrgs:        (params?: { search?: string; isActive?: string }) => {
      const qs = new URLSearchParams(params as any).toString();
      return req<any[]>(`/owner/organizations${qs ? '?' + qs : ''}`);
    },
    // Szczegóły firmy (biura, gateway, beacony)
    getOrg:          (id: string)           => req<any>(`/owner/organizations/${id}`),
    // Utwórz nową firmę + pierwszego SUPER_ADMIN
    createOrg:       (d: any)               => req<any>('/owner/organizations', { method: 'POST', body: JSON.stringify(d) }),
    // Edytuj firmę (plan, status, notatki)
    updateOrg:       (id: string, d: any)   => req<any>(`/owner/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
    // Dezaktywuj firmę (soft delete)
    deactivateOrg:   (id: string)           => req<void>(`/owner/organizations/${id}`, { method: 'DELETE' }),
    // Impersonacja — wejdź jako SUPER_ADMIN firmy (JWT 30 min)
    impersonate:     (id: string)           => req<{ token: string; adminUrl: string; org: any }>(`/owner/organizations/${id}/impersonate`, { method: 'POST' }),
    // Health globalny
    getHealth:       (params?: { status?: string; orgId?: string }) => {
      const qs = new URLSearchParams(params as any).toString();
      return req<any>(`/owner/health${qs ? '?' + qs : ''}`);
    },
    // Health jednej firmy
    getOrgHealth:    (orgId: string)        => req<any>(`/owner/health/${orgId}`),
  },
  locations: {
    listAll:   ()                           => req<any[]>('/locations'),
    list:      (orgId: string)              => req<any[]>(`/organizations/${orgId}/locations`),
    create:    (_orgId: string, d: any)     => req<any>('/locations', { method: 'POST', body: JSON.stringify(d) }),
    update:    (id: string, d: any)         => req<any>(`/locations/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
    occupancy: (locId: string)              => req<any>(`/locations/${locId}/analytics/occupancy`),
    extended:  (locId: string)              => req<any>(`/locations/${locId}/analytics/extended`),
  },

  desks: {
    list:        (locId: string)            => req<any[]>(`/locations/${locId}/desks`),
    status:      (locId: string)            => req<{ locationLimits: any; desks: any[] }>(`/locations/${locId}/desks/status`),
    create:      (locId: string, d: any)    => req<any>(`/locations/${locId}/desks`, { method: 'POST', body: JSON.stringify((({ locId: _l, ...rest }) => rest)(d)) }),
    update:      (id: string, d: any)       => req<any>(`/desks/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
    remove:      (id: string)               => req<any>(`/desks/${id}`, { method: 'DELETE' }),
    activate:    (id: string)               => req<any>(`/desks/${id}/activate`, { method: 'PATCH' }),
    hardDelete:  (id: string)               => req<any>(`/desks/${id}/permanent`, { method: 'DELETE' }),
    unpair:      (id: string)               => req<any>(`/desks/${id}/unpair`, { method: 'PATCH' }),
    availability:(id: string, date: string) => req<any>(`/desks/${id}/availability?date=${date}`),
    getAvailable:(locId: string, start: string, end: string) =>
      req<any[]>(`/desks/available?locationId=${locId}&startTime=${encodeURIComponent(start)}&endTime=${encodeURIComponent(end)}`),
  },

  devices: {
    list:      (gwId?: string)              => req<any[]>(`/devices${gwId ? `?gatewayId=${gwId}` : ''}`),
    provision: (d: any)                     => req<any>('/devices/provision', { method: 'POST', body: JSON.stringify(d) }),
    assign:    (id: string, deskId: string) => req<any>(`/devices/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ deskId }) }),
    command:   (id: string, cmd: string, params?: any) =>
      req<any>(`/devices/${id}/command`, { method: 'POST', body: JSON.stringify({ command: cmd, params }) }),
    remove:         (id: string)                 => req<any>(`/devices/${id}`, { method: 'DELETE' }),
    firmwareLatest: ()                           => req<any>('/devices/firmware/latest'),
    triggerOta:     (id: string)                 => req<any>(`/devices/${id}/ota`, { method: 'POST' }),
  },

  gateways: {
    list:             (locId?: string)              => req<any[]>(`/gateway${locId ? `?locationId=${locId}` : ''}`),
    register:         (locId: string, name: string) => req<any>('/gateway/register', { method: 'POST', body: JSON.stringify({ locationId: locId, name }) }),
    remove:           (id: string)                  => req<any>(`/gateway/${id}`, { method: 'DELETE' }),
    regenerateSecret: (id: string)                  => req<any>(`/gateway/${id}/regenerate-secret`, { method: 'POST' }),
    rotateSecret:      (id: string)                         => req<any>(`/gateway/${id}/rotate-secret`, { method: 'POST' }),
    triggerUpdate:     (id: string, channel = 'main')      => req<any>(`/gateway/${id}/update`, { method: 'POST', body: JSON.stringify({ channel }) }),
    createSetupToken: (locationId: string)          => req<any>('/gateway/setup-tokens', { method: 'POST', body: JSON.stringify({ locationId }) }),
    listSetupTokens:  (locationId: string)          => req<any[]>(`/gateway/setup-tokens/${locationId}`),
    revokeSetupToken: (tokenId: string)             => req<any>(`/gateway/setup-tokens/${tokenId}`, { method: 'DELETE' }),
  },

  users: {
    list:           (orgId?: string)                     => req<any[]>(`/users${orgId ? `?organizationId=${orgId}` : ''}`),
    listDeactivated:(orgId?: string)                     => req<any[]>(`/users/deactivated${orgId ? `?organizationId=${orgId}` : ''}`),
    create:         (d: any)                             => req<any>('/users', { method: 'POST', body: JSON.stringify(d) }),
    update:         (id: string, d: any)                 => req<any>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
    assignCard:     (id: string, uid: string)            => req<any>(`/users/${id}/card`, { method: 'PATCH', body: JSON.stringify({ cardUid: uid }) }),
    nfcScanStart:   (id: string)                         => req<any>(`/users/${id}/nfc-scan-start`, { method: 'POST' }),
    nfcScanStatus:  (id: string)                         => req<{ status: string; cardUid?: string; secondsLeft?: number }>(`/users/${id}/nfc-scan-status`),
    deactivate:     (id: string, retentionDays?: number) => req<any>(`/users/${id}`, { method: 'DELETE', body: JSON.stringify({ retentionDays: retentionDays ?? 30 }) }),
    restore:        (id: string)                         => req<any>(`/users/${id}/restore`, { method: 'PATCH' }),
    hardDelete:     (id: string)                         => req<any>(`/users/${id}/permanent`, { method: 'DELETE' }),
  },

  reservations: {
    list:           (filters: Record<string, string>) =>
      req<any[]>('/reservations?' + new URLSearchParams(filters).toString()),
    getToday:       (locationId: string, userId?: string) => {
      const today = new Date().toISOString().slice(0, 10);
      const p = new URLSearchParams({ locationId, date: today });
      if (userId) p.set('userId', userId);
      return req<any[]>(`/reservations?${p}`);
    },
    getUpcoming:    (locationId: string, userId?: string) => {
      const p = new URLSearchParams({ locationId });
      if (userId) p.set('userId', userId);
      return req<any[]>(`/reservations?${p}`);
    },
    getMy:          () => req<any[]>('/reservations/my'),
    create:         (d: any) => req<any>('/reservations', { method: 'POST', body: JSON.stringify(d) }),
    cancel:         (id: string) => req<any>(`/reservations/${id}`, { method: 'DELETE' }),
  },

  checkins: {
    manual:   (deskId: string, userId: string, resId?: string) =>
      req<any>('/checkins/manual', { method: 'POST', body: JSON.stringify({ deskId, userId, reservationId: resId }) }),
    checkout: (id: string) => req<any>(`/checkins/${id}/checkout`, { method: 'PATCH' }),
    qr:       (deskId: string, qrToken: string) =>
      req<any>('/checkins/qr', { method: 'POST', body: JSON.stringify({ deskId, qrToken }) }),
    walkin:   (deskId: string) =>
      req<any>('/checkins/qr/walkin', { method: 'POST', body: JSON.stringify({ deskId }) }),
  },
};
