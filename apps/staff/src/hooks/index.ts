import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import { DeskMapItem, Reservation } from '../types';

const LOCATION_ID = import.meta.env.VITE_LOCATION_ID ?? 'seed-location-01';

// ── useDesks: polls desk status every 15s ─────────────────────
export function useDesks() {
  const [desks,       setDesks]       = useState<DeskMapItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // FIX: renamed from `fetch` to `loadDesks` — `fetch` shadows the global Web API
  const loadDesks = useCallback(async () => {
    try {
      const data = await api.desks.getStatus(LOCATION_ID);
      setDesks(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDesks();
    const id = setInterval(loadDesks, 15_000);
    return () => clearInterval(id);
  }, [loadDesks]);

  return { desks, loading, error, lastUpdated, refetch: loadDesks };
}

// ── useReservations: today's reservations, refetch on demand ──
export function useReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  // END_USER sees only their own reservations
  const storedUser = (() => {
    try { return JSON.parse(localStorage.getItem('staff_user') ?? 'null'); } catch { return null; }
  })();
  const userId = storedUser?.role === 'END_USER' ? storedUser?.id : undefined;

  const loadReservations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.reservations.getToday(LOCATION_ID, userId);
      setReservations(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadReservations();
    const id = setInterval(loadReservations, 30_000);
    return () => clearInterval(id);
  }, [loadReservations]);

  const cancel = useCallback(async (id: string) => {
    await api.reservations.cancel(id);
    await loadReservations();
  }, [loadReservations]);

  return { reservations, loading, error, refetch: loadReservations, cancel };
}

// ── useAuth: reads stored user from localStorage ──────────────
export function useAuth() {
  const [user, setUser] = useState<any>(() => {
    try {
      const raw = localStorage.getItem('staff_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const login = useCallback(async (email: string, password: string) => {
    const u = await api.auth.login(email, password);
    localStorage.setItem('staff_user', JSON.stringify(u));
    setUser(u);
    return u;
  }, []);

  const loginAzure = useCallback(async (idToken: string) => {
    const u = await api.auth.loginAzure(idToken);
    localStorage.setItem('staff_user', JSON.stringify(u));
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    api.auth.logout();
    localStorage.removeItem('staff_user');
    setUser(null);
  }, []);

  return { user, login, loginAzure, logout };
}
