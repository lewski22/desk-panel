import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import { DeskMapItem, Reservation } from '../types';

const LOCATION_ID = import.meta.env.VITE_LOCATION_ID ?? 'seed-location-01';

// ── useDesks: polls desk status every 15s ─────────────────────
export function useDesks() {
  const [desks, setDesks] = useState<DeskMapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetch = useCallback(async () => {
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
    fetch();
    const id = setInterval(fetch, 15_000);
    return () => clearInterval(id);
  }, [fetch]);

  return { desks, loading, error, lastUpdated, refetch: fetch };
}

// ── useReservations: today's reservations, refetch on demand ──
export function useReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.reservations.getToday(LOCATION_ID);
      setReservations(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => clearInterval(id);
  }, [fetch]);

  const cancel = useCallback(async (id: string) => {
    await api.reservations.cancel(id);
    await fetch();
  }, [fetch]);

  return { reservations, loading, error, refetch: fetch, cancel };
}

// ── useAuth: reads stored user from localStorage ──────────────
export function useAuth() {
  const [user, setUser] = useState<any>(() => {
    try {
      const raw = localStorage.getItem('staff_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const login = async (email: string, password: string) => {
    const u = await api.auth.login(email, password);
    localStorage.setItem('staff_user', JSON.stringify(u));
    setUser(u);
    return u;
  };

  const logout = () => {
    api.auth.logout();
    localStorage.removeItem('staff_user');
    setUser(null);
  };

  return { user, login, logout };
}
