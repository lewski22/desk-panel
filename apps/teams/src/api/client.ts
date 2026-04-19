/**
 * api/client.ts — Axios klient dla Teams App
 *
 * Automatycznie dodaje Bearer token z sessionStorage.
 * Przy 401 → refresh JWT przez Teams SSO i retry.
 *
 * apps/teams/src/api/client.ts
 */
import axios from 'axios';
import { getStoredJwt, refreshJwt } from '../auth/teamsAuth';

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://api.prohalw2026.ovh/api/v1';

export const api = axios.create({ baseURL: API_BASE });

// Request interceptor — dodaj Authorization header
api.interceptors.request.use(config => {
  const token = getStoredJwt();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — przy 401 refresh i retry
api.interceptors.response.use(
  r => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const newToken = await refreshJwt();
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        // Nie udało się odświeżyć — wyczyść i rzuć
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);

// ── Reserti API methods ────────────────────────────────────────

export interface Location { id: string; name: string; address?: string; openTime: string; closeTime: string; }
export interface Desk { id: string; name: string; code: string; zone?: string; floor?: string; isOccupied: boolean; isOnline: boolean; }
export interface Reservation { id: string; deskId: string; date: string; startTime: string; endTime: string; status: string; desk?: { name: string }; }
export interface CreateReservationInput { deskId: string; date: string; startTime: string; endTime: string; }

export const resrApi = {
  /** Pobierz lokalizacje dostępne dla użytkownika */
  locations: {
    list: () => api.get<Location[]>('/locations/my').then(r => r.data),
  },

  /** Biurka — status live */
  desks: {
    status:    (locationId: string) =>
      api.get<{ desks: Desk[] }>(`/locations/${locationId}/desks/status`).then(r => r.data.desks ?? []),
    available: (locationId: string, date: string, start: string, end: string) =>
      api.get<Desk[]>('/desks/available', { params: { locationId, date, start, end } }).then(r => r.data),
    recommended: (locationId: string, date: string) =>
      api.get<{ recommendation: any }>('/desks/recommended', { params: { locationId, date } }).then(r => r.data.recommendation),
  },

  /** Rezerwacje */
  reservations: {
    my:     (date?: string) =>
      api.get<Reservation[]>('/reservations/my', { params: date ? { date } : {} }).then(r => r.data),
    create: (dto: CreateReservationInput) =>
      api.post<Reservation>('/reservations', dto).then(r => r.data),
    cancel: (id: string) =>
      api.delete<void>(`/reservations/${id}`).then(r => r.data),
  },

  /** Użytkownik */
  me: {
    get: () => api.get('/users/me').then(r => r.data),
  },
};
