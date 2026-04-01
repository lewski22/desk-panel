const BASE = import.meta.env.VITE_API_URL ?? 'https://api.prohalw2026.ovh/api/v1';

// ── Token storage ─────────────────────────────────────────────
// Outlook Add-in działa w sandboxie — używamy sessionStorage
const TOKEN_KEY   = 'outlook_access';
const REFRESH_KEY = 'outlook_refresh';
const USER_KEY    = 'outlook_user';

export function getToken()  { return sessionStorage.getItem(TOKEN_KEY); }
export function getUser()   {
  try { return JSON.parse(sessionStorage.getItem(USER_KEY) ?? 'null'); } catch { return null; }
}
export function clearAuth() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(USER_KEY);
}

// ── Auto-refresh przy 401 ─────────────────────────────────────
async function tryRefresh(): Promise<boolean> {
  const rt = sessionStorage.getItem(REFRESH_KEY);
  if (!rt) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) return false;
    const d = await res.json();
    sessionStorage.setItem(TOKEN_KEY,   d.accessToken);
    sessionStorage.setItem(REFRESH_KEY, d.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// ── HTTP helper ───────────────────────────────────────────────
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
    clearAuth();
    throw new Error('Sesja wygasła — zaloguj się ponownie');
  }
  if (res.status === 401) {
    clearAuth();
    throw new Error('Sesja wygasła — zaloguj się ponownie');
  }
  if (res.status === 204) return undefined as unknown as T;
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── API ───────────────────────────────────────────────────────
export const outlookApi = {

  // Auth
  auth: {
    async loginAzure(idToken: string) {
      const d = await req<any>('/auth/azure', {
        method: 'POST',
        body:   JSON.stringify({ idToken }),
      });
      sessionStorage.setItem(TOKEN_KEY,   d.accessToken);
      sessionStorage.setItem(REFRESH_KEY, d.refreshToken);
      sessionStorage.setItem(USER_KEY,    JSON.stringify(d.user));
      return d.user;
    },

    async checkSso(email: string): Promise<{ available: boolean; tenantId?: string }> {
      return req(`/auth/azure/check?email=${encodeURIComponent(email)}`);
    },
  },

  // Locations — pobierz biura dostępne dla użytkownika
  locations: {
    list: () => req<any[]>('/locations'),
  },

  // Biurka wolne na dany slot
  desks: {
    available: (params: {
      locationId: string;
      date:       string;   // YYYY-MM-DD
      startTime:  string;   // HH:MM
      endTime:    string;   // HH:MM
    }) => req<any[]>(
      `/desks/available?locationId=${params.locationId}&date=${params.date}&startTime=${params.startTime}&endTime=${params.endTime}`,
    ),
  },

  // Rezerwacje
  reservations: {
    create: (body: {
      deskId:    string;
      date:      string;
      startTime: string;
      endTime:   string;
    }) => req<any>('/reservations', { method: 'POST', body: JSON.stringify(body) }),

    cancel: (id: string) => req<any>(`/reservations/${id}`, { method: 'DELETE' }),

    my: (date: string) => req<any[]>(`/reservations/my?date=${date}`),
  },
};
