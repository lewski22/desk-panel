import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReservations } from '../hooks';
import { ReservationList } from '../components/reservations/ReservationList';
import { appApi } from '../api/client';

export function ReservationsPage() {
  const { t } = useTranslation();
  const [locations,  setLocations]  = useState<any[]>([]);
  const [locationId, setLocationId] = useState(import.meta.env.VITE_LOCATION_ID ?? '');

  useEffect(() => {
    appApi.locations.listAll().then(locs => {
      setLocations(locs);
      if (!locationId && locs.length > 0) setLocationId(locs[0].id);
    }).catch(() => {});
  }, []);

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('app_user') ?? 'null'); } catch { return null; }
  })();

  const { reservations, loading, error, refetch, cancel } = useReservations(locationId, user);

  return (
    <div>
      {locations.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-zinc-400">{t('reservations.location')}</span>
          <select value={locationId} onChange={e => setLocationId(e.target.value)}
            className="border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 font-medium">
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">⚠ {error}</div>
      )}
      <ReservationList reservations={reservations} loading={loading} onCancel={cancel} onRefresh={refetch} />
    </div>
  );
}
