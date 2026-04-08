import { useState, useEffect, useCallback } from 'react';
import { appApi } from '../api/client';
import { DeskMapItem, LocationLimits, Reservation } from '../types/index';

// locationId: pobierany z API lub fallback na env var
// Używany przez useDesks i useReservations — przekazywany jako argument
// żeby strona mogła wybrać biuro dynamicznie

// ── useDesks: polls desk status every 15s ────────────────────
export function useDesks(locationId: string) {
  const [desks,          setDesks]          = useState<DeskMapItem[]>([]);
  const [locationLimits, setLocationLimits] = useState<LocationLimits | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [lastUpdated,    setLastUpdated]    = useState<Date | null>(null);

  const loadDesks = useCallback(async () => {
    if (!locationId) return;
    try {
      const { desks, locationLimits: limits } = await appApi.desks.status(locationId);
      setDesks(desks);
      setLocationLimits(limits);
      setLastUpdated(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    loadDesks();
    const id = setInterval(loadDesks, 15_000);
    return () => clearInterval(id);
  }, [loadDesks]);

  return { desks, locationLimits, loading, error, lastUpdated, refetch: loadDesks };
}

// ── useReservations: today, refetch on demand ─────────────────
export function useReservations(locationId: string, user: any) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  // END_USER widzi tylko swoje rezerwacje
  const userId = user?.role === 'END_USER' ? user?.id : undefined;

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const data = await appApi.reservations.getToday(locationId, userId);
      setReservations(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [locationId, userId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const cancel = useCallback(async (id: string) => {
    await appApi.reservations.cancel(id);
    await load();
  }, [load]);

  return { reservations, loading, error, refetch: load, cancel };
}
