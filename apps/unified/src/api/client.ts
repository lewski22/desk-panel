/**
 * apps/unified/src/api/client.ts
 * GH baseline + Sprint C (reports) + Sprint F (integrations) +
 * Sprint K (recommendations, insights) + M4 (graph) + Google SSO
 */

const BASE      = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

const KEYS = {
  access:  'app_access',
  refresh: 'app_refresh',
  user:    'app_user',
};

const getToken = () => localStorage.getItem(KEYS.access);

let _refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
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
  })().finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

async function req<T>(path: string, opts: RequestInit = {}, _retry = true): Promise<T> {
  if (DEMO_MODE) {
    const { getDemoResponse } = await import('../mocks/demoHandlers');
    const mock = getDemoResponse(path, opts.method ?? 'GET');
    if (mock !== undefined) {
      await new Promise(r => setTimeout(r, 80));
      return mock as T;
    }
  }

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
    throw new Error((e as any).message ?? res.statusText);
  }
  return res.json();
}

export const appApi = {
  // ── Auth ────────────────────────────────────────────────────
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
      return req('/auth/azure/check?email=' + encodeURIComponent(email));
    },
    logout() {
      const rt = localStorage.getItem(KEYS.refresh);
      if (rt) req('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: rt }) }).catch((e) => console.error('[client] logout', e));
      localStorage.removeItem(KEYS.access);
      localStorage.removeItem(KEYS.refresh);
      localStorage.removeItem(KEYS.user);
    },
    user() {
      try { return JSON.parse(localStorage.getItem(KEYS.user) ?? 'null'); } catch { return null; }
    },
    changePassword: (currentPassword: string, newPassword: string) =>
      req('/auth/change-password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }),
    inviteUser: (body: { email: string; role?: string; expiresInDays?: number }) =>
      req<{ ok: boolean; email: string; expiresAt: string }>('/auth/invite', { method: 'POST', body: JSON.stringify(body) }),
    getInviteInfo: (token: string) =>
      req<{ email: string; orgName: string; role: string; expired: boolean; used: boolean }>(`/auth/invite/${token}`),
    register: (body: { token: string; firstName: string; lastName: string; password: string }) =>
      req<any>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    async getMe() {
      const u = await req<any>('/auth/me');
      const existing = JSON.parse(localStorage.getItem(KEYS.user) ?? '{}');
      const updated = { ...existing, ...u };
      localStorage.setItem(KEYS.user, JSON.stringify(updated));
      return updated;
    },
  },

  // ── Organizations ────────────────────────────────────────────
  orgs: {
    list:              ()                       => req<any[]>('/organizations'),
    getAzureConfig:    (orgId: string)          => req<any>(`/organizations/${orgId}/azure`),
    updateAzureConfig: (orgId: string, body: any) =>
      req<any>(`/organizations/${orgId}/azure`, { method: 'PATCH', body: JSON.stringify(body) }),
  },

  // ── Locations ────────────────────────────────────────────────
  locations: {
    list:         ()                         => req<any[]>('/locations/my'),
    listAll:      ()                         => req<any[]>('/locations'),
    create:       (d: any)                   => req<any>('/locations', { method: 'POST', body: JSON.stringify(d) }),
    update:       (id: string, d: any)       => req<any>(`/locations/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
    remove:       (id: string)               => req<any>(`/locations/${id}`, { method: 'DELETE' }),
    uploadFloorPlan: (id: string, d: any)    => req<any>(`/locations/${id}/floor-plan`, { method: 'POST', body: JSON.stringify(d) }),
    attendance:   (id: string, week?: string) => req<any>(`/locations/${id}/attendance${week ? `?week=${week}` : ''}`),
    verifyKioskPin: (id: string, pin: string) =>
      req<any>(`/locations/${id}/kiosk/verify-pin`, { method: 'POST', body: JSON.stringify({ pin }) }),
    floors: (id: string) => req<string[]>(`/locations/${id}/floors`),
    floorPlan: {
      get:    (id: string, floor?: string)          => req<any>(`/locations/${id}/floor-plan${floor ? `?floor=${encodeURIComponent(floor)}` : ''}`),
      update: (id: string, d: any, floor?: string)  => req<any>(`/locations/${id}/floor-plan${floor ? `?floor=${encodeURIComponent(floor)}` : ''}`, { method: 'POST', body: JSON.stringify(d) }),
      upload: (id: string, d: any, floor?: string)  => req<any>(`/locations/${id}/floor-plan${floor ? `?floor=${encodeURIComponent(floor)}` : ''}`, { method: 'POST', body: JSON.stringify(d) }),
      delete: (id: string, floor?: string)          => req<any>(`/locations/${id}/floor-plan/delete${floor ? `?floor=${encodeURIComponent(floor)}` : ''}`, { method: 'POST' }),
    },
    // Dashboard extended / issues
    extended: (id: string)      => req<any>(`/locations/${id}/analytics/extended`),
    issues:   (id: string)      => req<any>(`/locations/${id}/issues`),
    getWifiCredentials: (locationId: string) =>
      req<{ wifiSsid: string | null; wifiPass: string | null }>(`/locations/${locationId}/wifi-credentials`),
  },

  // ── Desks ────────────────────────────────────────────────────
  desks: {
    list:         (locId: string)            => req<any[]>(`/locations/${locId}/desks`),
    status:       (locId: string)            => req<any>(`/locations/${locId}/desks/status`),
    create:       (locId: string, d: any)    => req<any>(`/locations/${locId}/desks`, { method: 'POST', body: JSON.stringify(d) }),
    update:       (id: string, d: any)       => req<any>(`/desks/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
    batchPositions: (updates: any[])          => req<any>('/desks/batch-positions', { method: 'PATCH', body: JSON.stringify({ updates }) }),
    remove:        (id: string)              => req<any>(`/desks/${id}`, { method: 'DELETE' }),
    permanentDelete: (id: string)            => req<any>(`/desks/${id}/permanent`, { method: 'DELETE' }),
    unpair:        (id: string)              => req<any>(`/desks/${id}/unpair`, { method: 'PATCH' }),
    getAvailable:  (locId: string, start: string, end: string) =>
      req<any[]>(`/desks/available?locationId=${locId}&startTime=${start}&endTime=${end}`),
    getByQr:       (token: string)           => req<any>(`/desks/qr/${token}`),
    availability:  (id: string, date: string) => req<any>(`/desks/${id}/availability?date=${date}`),
    // Sprint K1 — AI recommendation
    getRecommended: (params: { locationId: string; date: string; start?: string; end?: string }) =>
      req<any>(`/desks/recommended?${new URLSearchParams(params as Record<string,string>).toString()}`),
    // Aliases used by GH DesksPage
    activate:   (id: string)   => req<any>(`/desks/${id}/activate`, { method: 'POST', body: '{}' }),
    hardDelete: (id: string)   => req<any>(`/desks/${id}/permanent`, { method: 'DELETE' }),
  },

  // ── Devices ─────────────────────────────────────────────────
  devices: {
    list:           (gwId?: string)                     => req<any[]>(`/devices${gwId ? `?gatewayId=${gwId}` : ''}`),
    provision:      (d: any)                            => req<any>('/devices/provision', { method: 'POST', body: JSON.stringify(d) }),
    assign:         (id: string, deskId: string)        => req<any>(`/devices/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ deskId }) }),
    command:        (id: string, cmd: string, params?: any) =>
      req<any>(`/devices/${id}/command`, { method: 'POST', body: JSON.stringify({ command: cmd, params }) }),
    remove:         (id: string)                        => req<any>(`/devices/${id}`, { method: 'DELETE' }),
    firmwareLatest: ()                                  => req<any>('/devices/firmware/latest'),
    triggerOta:     (id: string)                        => req<any>(`/devices/${id}/ota`, { method: 'POST' }),
    otaAll:         (locationId?: string)               => req<any>('/devices/ota-all', { method: 'POST', body: JSON.stringify({ locationId }) }),
  },

  // ── Gateways ────────────────────────────────────────────────
  gateways: {
    list:             (locId?: string)               => req<any[]>(`/gateway${locId ? `?locationId=${locId}` : ''}`),
    register:         (locId: string, name: string)  => req<any>('/gateway/register', { method: 'POST', body: JSON.stringify({ locationId: locId, name }) }),
    remove:           (id: string)                   => req<any>(`/gateway/${id}`, { method: 'DELETE' }),
    regenerateSecret: (id: string)                   => req<any>(`/gateway/${id}/regenerate-secret`, { method: 'POST' }),
    rotateSecret:     (id: string)                   => req<any>(`/gateway/${id}/rotate-secret`, { method: 'POST' }),
    triggerUpdate:    (id: string, channel = 'main') => req<any>(`/gateway/${id}/update`, { method: 'POST', body: JSON.stringify({ channel }) }),
    createSetupToken: (locationId: string)           => req<any>('/gateway/setup-tokens', { method: 'POST', body: JSON.stringify({ locationId }) }),
    listSetupTokens:  (locationId: string)           => req<any[]>(`/gateway/setup-tokens/${locationId}`),
    revokeSetupToken: (tokenId: string)              => req<any>(`/gateway/setup-tokens/${tokenId}`, { method: 'DELETE' }),
  },

  // ── Users ────────────────────────────────────────────────────
  users: {
    list:            (orgId?: string)                    => req<any[]>(`/users${orgId ? `?organizationId=${orgId}` : ''}`),
    listDeactivated: (orgId?: string)                    => req<any[]>(`/users/deactivated${orgId ? `?organizationId=${orgId}` : ''}`),
    create:          (d: any)                            => req<any>('/users', { method: 'POST', body: JSON.stringify(d) }),
    update:          (id: string, d: any)                => req<any>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
    assignCard:      (id: string, uid: string)           => req<any>(`/users/${id}/card`, { method: 'PATCH', body: JSON.stringify({ cardUid: uid }) }),
    nfcScanStart:    (id: string)                        => req<any>(`/users/${id}/nfc-scan-start`, { method: 'POST' }),
    nfcScanStatus:   (id: string)                        => req<{ status: string; cardUid?: string; secondsLeft?: number }>(`/users/${id}/nfc-scan-status`),
    deactivate:      (id: string, retentionDays?: number) => req<any>(`/users/${id}`, { method: 'DELETE', body: JSON.stringify({ retentionDays: retentionDays ?? 30 }) }),
    restore:         (id: string)                        => req<any>(`/users/${id}/restore`, { method: 'PATCH' }),
    hardDelete:      (id: string)                        => req<any>(`/users/${id}/permanent`, { method: 'DELETE' }),
  },

  // ── Reservations ─────────────────────────────────────────────
  reservations: {
    list:            (filters: Record<string, string>) => req<any[]>('/reservations?' + new URLSearchParams(filters).toString()),
    getToday:        (locationId: string, userId?: string) => {
      const today = new Date().toISOString().slice(0, 10);
      const p = new URLSearchParams({ locationId, date: today });
      if (userId) p.set('userId', userId);
      return req<any[]>(`/reservations?${p}`);
    },
    getMy:           (date?: string, limit?: number) => {
      const p = new URLSearchParams();
      if (date)  p.set('date',  date);
      if (limit) p.set('limit', String(limit));
      return req<any[]>(`/reservations/my?${p}`);
    },
    create:          (d: any)                          => req<any>('/reservations', { method: 'POST', body: JSON.stringify(d) }),
    cancel:          (id: string)                      => req<any>(`/reservations/${id}`, { method: 'DELETE' }),
    createRecurring: (body: any)                       => req<any>('/reservations/recurring', { method: 'POST', body: JSON.stringify(body) }),
    cancelRecurring: (id: string, scope: 'single' | 'following' | 'all') =>
      req<any>(`/reservations/${id}/cancel-recurring`, { method: 'POST', body: JSON.stringify({ scope }) }),
    getQr:           (id: string)                      => req<any>(`/reservations/${id}/qr`),
  },

  // ── Checkins ─────────────────────────────────────────────────
  checkins: {
    manual:   (deskId: string, userId: string, resId?: string) =>
      req<any>('/checkins/manual', { method: 'POST', body: JSON.stringify({ deskId, userId, reservationId: resId }) }),
    web:      (reservationId: string)              => req<any>('/checkins/web', { method: 'POST', body: JSON.stringify({ reservationId }) }),
    checkout: (id: string)                        => req<any>(`/checkins/${id}/checkout`, { method: 'PATCH' }),
    qr:       (deskId: string, qrToken: string)   => req<any>('/checkins/qr', { method: 'POST', body: JSON.stringify({ deskId, qrToken }) }),
    walkin:   (deskId: string)                    => req<any>('/checkins/qr/walkin', { method: 'POST', body: JSON.stringify({ deskId }) }),
  },

  // ── Resources ─────────────────────────────────────────────────
  resources: {
    list:         (locId: string, type?: string)  => req<any[]>(`/locations/${locId}/resources${type ? `?type=${type}` : ''}`),
    create:       (locId: string, body: any)      => req<any>(`/locations/${locId}/resources`, { method: 'POST', body: JSON.stringify(body) }),
    update:       (id: string, body: any)         => req<any>(`/resources/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove:       (id: string)                    => req<any>(`/resources/${id}`, { method: 'DELETE' }),
    availability: (id: string, date: string)      => req<any>(`/resources/${id}/availability?date=${date}`),
    book:         (id: string, body: any)         => req<any>(`/resources/${id}/bookings`, { method: 'POST', body: JSON.stringify(body) }),
  },
  bookings: {
    cancel: (id: string)    => req<any>(`/bookings/${id}/cancel`, { method: 'POST', body: '{}' }),
    myList: (from?: string) => req<any[]>(`/users/me/bookings${from ? `?from=${from}` : ''}`),
  },

  // ── Subscription ─────────────────────────────────────────────
  subscription: {
    getStatus:    ()                => req<any>('/subscription/status'),
    getOrgStatus: (id: string)      => req<any>(`/owner/organizations/${id}/subscription`),
    updatePlan:   (id: string, body: any) => req<any>(`/owner/organizations/${id}/subscription`, { method: 'POST', body: JSON.stringify(body) }),
    getEvents:    (id: string)      => req<any[]>(`/owner/organizations/${id}/subscription/events`),
    getDashboard:       ()                    => req<any>('/owner/subscription/dashboard'),
    getPlans:           ()                    => req<any>('/owner/subscription/plans'),
    updatePlanTemplate: (plan: string, body: any) =>
      req<any>(`/owner/subscription/plans/${plan}`, { method: 'PUT', body: JSON.stringify(body) }),
  },

  // ── Visitors ─────────────────────────────────────────────────
  visitors: {
    list:     (locId: string, date?: string) => req<any[]>(`/locations/${locId}/visitors${date ? `?date=${date}` : ''}`),
    invite:   (locId: string, body: any)     => req<any>(`/locations/${locId}/visitors`, { method: 'POST', body: JSON.stringify(body) }),
    checkin:  (id: string)                   => req<any>(`/visitors/${id}/checkin`, { method: 'POST', body: '{}' }),
    checkout: (id: string)                   => req<any>(`/visitors/${id}/checkout`, { method: 'POST', body: '{}' }),
    cancel:   (id: string)                   => req<any>(`/visitors/${id}/cancel`, { method: 'POST', body: '{}' }),
  },

  // ── In-App Notification Rules (Owner) ────────────────────────
  inapp: {
    getRules:   ()             => req<any[]>('/notifications/inapp/rules'),
    saveRules:  (rules: any[]) => req<any[]>('/notifications/inapp/rules', { method: 'POST', body: JSON.stringify({ rules }) }),
    announce:   (body: { title: string; body: string; targetRoles: string[] }) =>
      req<{ count: number }>('/notifications/inapp/announce', { method: 'POST', body: JSON.stringify(body) }),
  },

  // ── Notifications ─────────────────────────────────────────────
  notifications: {
    inapp:        (unreadOnly = false) => req<any[]>(`/notifications/inapp${unreadOnly ? '?unread=true' : ''}`),
    countUnread:  ()                   => req<{ count: number }>('/notifications/inapp/count'),
    markRead:     (ids: string[])      => req<any>('/notifications/inapp/read', { method: 'PATCH', body: JSON.stringify({ ids }) }),
    markAllRead:  ()                   => req<any>('/notifications/inapp/read-all', { method: 'PATCH' }),
    deleteOne:    (id: string)         => req<any>(`/notifications/inapp/${id}`, { method: 'DELETE' }),
    getSettings:  (orgId: string)      => req<any[]>(`/notifications/settings?organizationId=${orgId}`),
    saveSettings: (orgId: string, type: string, body: any) =>
      req<any>(`/notifications/settings/${type}?organizationId=${orgId}`, { method: 'PUT', body: JSON.stringify(body) }),
    testSend:     (orgId: string, type: string) =>
      req<any>('/notifications/test-email', { method: 'POST', body: JSON.stringify({ organizationId: orgId, type }) }),
    getLog:       (orgId: string)      => req<any[]>(`/notifications/log?organizationId=${orgId}`),
    getSmtp:      (orgId: string)      => req<any>(`/notifications/smtp?organizationId=${orgId}`),
    saveSmtp:     (orgId: string, body: any) =>
      req<any>(`/notifications/smtp?organizationId=${orgId}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteSmtp:   (orgId: string)      =>
      req<any>(`/notifications/smtp?organizationId=${orgId}`, { method: 'DELETE' }),
    testSmtp:     (orgId: string)      =>
      req<any>(`/notifications/smtp/test?organizationId=${orgId}`, { method: 'POST', body: '{}' }),
  },

  // ── Owner ─────────────────────────────────────────────────────
  owner: {
    listOrgs:       ()                         => req<any[]>('/owner/organizations'),
    createOrg:      (d: any)                   => req<any>('/owner/organizations', { method: 'POST', body: JSON.stringify(d) }),
    updateOrg:      (id: string, d: any)       => req<any>(`/owner/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
    deactivateOrg:  (id: string)               => req<any>(`/owner/organizations/${id}`, { method: 'DELETE' }),
    impersonate:    (id: string)               => req<any>(`/owner/organizations/${id}/impersonate`, { method: 'POST', body: '{}' }),
    stopImpersonation: ()                      => req<any>('/owner/stop-impersonation', { method: 'POST', body: '{}' }),
    getStats:       ()                         => req<any>('/owner/stats'),
    setModules:     (id: string, modules: string[]) =>
      req<any>(`/owner/organizations/${id}/modules`, { method: 'PATCH', body: JSON.stringify({ enabledModules: modules }) }),
  },

  // ── Organizations ─────────────────────────────────────────────
  organizations: {
    getAzureConfig:    (id: string)         => req<any>(`/organizations/${id}/azure`),
    updateAzureConfig: (id: string, d: any) => req<any>(`/organizations/${id}/azure`, { method: 'PUT', body: JSON.stringify(d) }),
  },

  // ── Push Notifications ────────────────────────────────────────
  push: {
    getVapidKey: () => req<{ publicKey: string }>('/push/vapid-key'),
    subscribe:   (sub: any) => req<any>('/push/subscribe', { method: 'POST', body: JSON.stringify(sub) }),
    unsubscribe: (endpoint: string) => req<any>('/push/unsubscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
  },

  // ── Sprint C — Reports ────────────────────────────────────────
  reports: {
    heatmap: (params: Record<string, string>) =>
      req<any>('/reports/heatmap?' + new URLSearchParams(params).toString()),
    export: (params: Record<string, string>): Promise<Blob> =>
      fetch(`${BASE}/reports/export?${new URLSearchParams(params)}`, {
        headers: { Authorization: `Bearer ${getToken() ?? ''}` },
      }).then(r => r.blob()),
    // Generic — used by ReportsPage
    get: (endpoint: string, params?: Record<string, string>): Promise<any> => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return req<any>(`/reports${endpoint}${qs}`);
    },
  },

  // ── Sprint F — Integration Marketplace ───────────────────────
  integrations: {
    list:   ()                            => req<any>('/integrations'),
    get:    (provider: string)            => req<any>(`/integrations/${provider}`),
    upsert: (provider: string, body: any) => req<any>(`/integrations/${provider}`, { method: 'PUT',    body: JSON.stringify(body) }),
    toggle: (provider: string, isEnabled: boolean) =>
      req<any>(`/integrations/${provider}/toggle`, { method: 'PATCH', body: JSON.stringify({ isEnabled }) }),
    remove: (provider: string)            => req<any>(`/integrations/${provider}`, { method: 'DELETE' }),
    test:   (provider: string)            => req<any>(`/integrations/${provider}/test`, { method: 'POST', body: '{}' }),
  },

  // ── Sprint K — AI Insights ────────────────────────────────────
  insights: {
    getForLocation: (locationId: string) => req<any>(`/insights?locationId=${locationId}`),
    getForOrg:      (orgId?: string)     => req<any>(`/insights/org${orgId ? `?orgId=${orgId}` : ''}`),
    refresh:        (locationId: string) => req<any>(`/insights/refresh?locationId=${locationId}`, { method: 'POST', body: '{}' }),
  },

  // ── M4 — Microsoft Graph Calendar Sync ───────────────────────
  graph: {
    status:     () => req<any>('/graph/status'),
    disconnect: () => req<any>('/graph/disconnect', { method: 'DELETE' }),
    subscribe:  () => req<any>('/graph/subscribe',  { method: 'POST', body: '{}' }),
  },

  // ── Google SSO ────────────────────────────────────────────────
  google: {
    check: (email?: string, orgSlug?: string) => {
      const p = new URLSearchParams();
      if (email)   p.set('email',   email);
      if (orgSlug) p.set('orgSlug', orgSlug);
      return req<any>(`/auth/google/check?${p}`);
    },
  },
};

export type AppApi = typeof appApi;
