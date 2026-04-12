import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDesks } from '../hooks';
import { DeskMap } from '../components/desks/DeskMap';
import { appApi } from '../api/client';

function LocationPicker({
  locations, activeId, onChange,
}: { locations: any[]; activeId: string; onChange: (id: string) => void }) {
  const { t } = useTranslation();
  if (locations.length <= 1) return null;
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-xs text-zinc-400">{t('deskmap.location_label')}</span>
      <select value={activeId} onChange={e => onChange(e.target.value)}
        className="border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30 font-medium">
        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
    </div>
  );
}

export function DeskMapPage() {
  const { t } = useTranslation();
  const [locations,  setLocations]  = useState<any[]>([]);
  const [locationId, setLocationId] = useState(
    import.meta.env.VITE_LOCATION_ID ?? ''
  );
  const [locLoading, setLocLoading] = useState(true);

  // Load locations once
  useEffect(() => {
    appApi.locations.listAll()
      .then(locs => {
        setLocations(locs);
        if (!locationId && locs.length > 0) setLocationId(locs[0].id);
      })
      .catch(() => {})
      .finally(() => setLocLoading(false));
  }, []);

  const { desks, locationLimits, loading, error, lastUpdated, refetch } = useDesks(locationId);

  // Get user role from app_user
  const userRole = (() => {
    try { return JSON.parse(localStorage.getItem('app_user') ?? 'null')?.role ?? ''; }
    catch { return ''; }
  })();

  if (locLoading || (loading && desks.length === 0 && locationId)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-zinc-300">
          <div className="w-6 h-6 border-2 border-zinc-200 border-t-[#B53578] rounded-full animate-spin" />
          <p className="text-sm">{t('deskmap.loading')}</p>
        </div>
      </div>
    );
  }

  if (error && desks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-4xl mb-3">⚠️</p>
          <p className="text-zinc-600 font-medium mb-1">{t('deskmap.conn_error')}</p>
          <p className="text-zinc-400 text-sm mb-4">{error}</p>
          <button onClick={refetch}
            className="text-sm px-4 py-2 rounded-lg bg-[#B53578] text-white hover:bg-[#9d2d66] transition-colors">
            {t('btn.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <LocationPicker locations={locations} activeId={locationId} onChange={setLocationId} />
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm flex items-center gap-2">
          <span>⚠</span><span>{t('deskmap.stale_warning')}</span>
        </div>
      )}
      <DeskMap desks={desks} locationLimits={locationLimits} lastUpdated={lastUpdated} onRefresh={refetch} userRole={userRole} />
    </div>
  );
}
