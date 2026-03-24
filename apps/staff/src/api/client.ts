import { DeskMapItem, Reservation, Checkin } from '../types';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

function getToken() {
  return localStorage.getItem('access_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401) {
    // Try refresh
    const refreshed = await tryRefresh();
    if (!refreshed) {
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    return request<T>(path, options);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Request failed');
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem('access_token', data.accessToken);
    localStorage.setItem('refresh_token', data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// ── Auth ──────────────────────────────────────────────────────
export const api = {
  auth: {
    async login(email: string, password: string) {
      const data = await request<{ accessToken: string; refreshToken: string; user: any }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) },
      );
      localStorage.setItem('access_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);
      return data.user;
    },
    logout() {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        fetch(`${BASE}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        }).catch(() => {});
      }
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    },
  },

  // ── Desks ──────────────────────────────────────────────────
  desks: {
    getStatus(locationId: string) {
      return request<DeskMapItem[]>(`/locations/${locationId}/desks/status`);
    },
    getAll(locationId: string) {
      return request<DeskMapItem[]>(`/locations/${locationId}/desks`);
    },
  },

  // ── Reservations ──────────────────────────────────────────
  reservations: {
    getToday(locationId: string) {
      const today = new Date().toISOString().slice(0, 10);
      return request<Reservation[]>(`/reservations?locationId=${locationId}&date=${today}`);
    },
    getUpcoming(locationId: string) {
      return request<Reservation[]>(`/reservations?locationId=${locationId}`);
    },
    cancel(id: string) {
      return request<void>(`/reservations/${id}`, { method: 'DELETE' });
    },
  },

  // ── Checkins ──────────────────────────────────────────────
  checkins: {
    manual(deskId: string, userId: string, reservationId?: string) {
      return request<Checkin>('/checkins/manual', {
        method: 'POST',
        body: JSON.stringify({ deskId, userId, reservationId }),
      });
    },
    checkout(checkinId: string) {
      return request<Checkin>(`/checkins/${checkinId}/checkout`, { method: 'PATCH' });
    },
  },
};
