/**
 * DeskMapPage — Sprint A2 + D4
 * - Location tabs z live occupancy
 * - Toggle [🗺 Plan] [⊞ Karty]
 * - FloorPlanView lub DeskMap grid
 * - Preferencja widoku w localStorage
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation }  from 'react-i18next';
import { useNavigate }      from 'react-router-dom';
import { useDesks }         from '../hooks';
import { DeskMap }                  from '../components/desks/DeskMap';
import { FloorPlanView }            from '../components/floor-plan/FloorPlanView';
import { ResourceFloorPlanView }    from '../components/floor-plan/ResourceFloorPlanView';
import { ResourceCard }             from '../components/desks/ResourceCard';
import { BookingModal }     from '../components/desks/BookingModal';
import { ReservationModal } from '../components/desks/ReservationModal';
import { appApi }           from '../api/client';
import { EmptyState }       from '../components/ui';
import { useOrgModules }    from '../hooks/useOrgModules';

// ── Helpers ──────────────────────────────────────────────────
function occupancyColor(occupied: number, total: number) {
  const pct = total === 0 ? 0 : (occupied / total) * 100;
  if (pct >= 90) return 'text-red-600 bg-red-50 border-red-200';
  if (pct >= 70) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-emerald-600 bg-emerald-50 border-emerald-200';
}

// ── Location Tabs ─────────────────────────────────────────────
function LocationTabs({ locations, activeId, desksPerLocation, onChange }: {
  locations: any[]; activeId: string;
  desksPerLocation: Record<string, { occupied: number; total: number }>;
  onChange: (id: string) => void;
}) {
  if (locations.length === 0) return null;
  if (locations.length === 1) return <p className="text-sm text-zinc-500 mb-4 font-medium">{locations[0].name}</p>;
  return (
    <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
      {locations.map(loc => {
        const occ   = desksPerLocation[loc.id] ?? { occupied: 0, total: 0 };
        const active = loc.id === activeId;
        const color = occupancyColor(occ.occupied, occ.total);
        return (
          <button key={loc.id} onClick={() => onChange(loc.id)}
            className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
              active ? 'bg-brand text-white border-brand shadow-sm' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
            }`}>
            <span>{loc.name}</span>
            {occ.total > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-semibold ${active ? 'bg-white/20 text-white border-white/30' : color}`}>
                {occ.occupied}/{occ.total}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── View Toggle ───────────────────────────────────────────────
type ViewMode = 'plan' | 'cards';

function ViewToggle({ mode, onChange, hasPlan }: { mode: ViewMode; onChange: (m: ViewMode) => void; hasPlan: boolean }) {
  const { t } = useTranslation();
  if (!hasPlan) return null;
  return (
    <div className="flex gap-1 bg-zinc-100 rounded-xl p-1 mb-4 w-fit">
      <button onClick={() => onChange('plan')}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          mode === 'plan' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
        }`}>
        🗺 {t('floorplan.view.toggle_plan')}
      </button>
      <button onClick={() => onChange('cards')}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          mode === 'cards' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
        }`}>
        ⊞ {t('floorplan.view.toggle_cards')}
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export function DeskMapPage() {
  const { t }       = useTranslation();
  const navigate    = useNavigate();
  const [locations,     setLocations]     = useState<any[]>([]);
  const [locationId,    setLocationId]    = useState(import.meta.env.VITE_LOCATION_ID ?? '');
  const [locLoading,    setLocLoading]    = useState(true);
  const [occupancyCache, setOccupancyCache] = useState<Record<string, { occupied: number; total: number }>>({});
  const [hasPlan,       setHasPlan]       = useState(false);
  const [viewMode,      setViewMode]      = useState<ViewMode>(() => {
    try {
      const role = JSON.parse(localStorage.getItem('app_user') ?? 'null')?.role ?? '';
      if (role === 'END_USER') return 'plan';
    } catch {}
    return (localStorage.getItem('desk_view_mode') as ViewMode) ?? 'cards';
  });
  const [reservationTarget, setReservationTarget] = useState<any>(null);
  const [reservationUsers,  setReservationUsers]  = useState<any[]>([]);

  // ── Sprint E2: Resources (Sale / Parking) ─────────────────
  type MapTab = 'desks' | 'rooms' | 'parking';
  const [mapTab, setMapTab]           = useState<MapTab>('desks');
  const [resources,  setResources]    = useState<any[]>([]);
  const [resLoading, setResLoading]   = useState(false);
  const [bookTarget, setBookTarget]   = useState<any>(null);
  const [resViewMode, setResViewMode] = useState<ViewMode>('plan');

  const userRole = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('app_user') ?? 'null')?.role ?? ''; } catch { return ''; }
  }, []);
  const isAdmin   = ['SUPER_ADMIN','OFFICE_ADMIN'].includes(userRole);
  const isStaff   = ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'].includes(userRole);
  const isEndUser = userRole === 'END_USER';
  const { isEnabled } = useOrgModules();

  useEffect(() => {
    if (!isEndUser) {
      appApi.users.list().then(setReservationUsers).catch((e) => console.error('[DeskMapPage] users.list', e));
    }
  }, [isEndUser]);

  useEffect(() => {
    appApi.locations.listAll()
      .then(locs => {
        setLocations(locs);
        if (!locationId && locs.length > 0) setLocationId(locs[0].id);
      })
      .catch((e) => console.error('[DeskMapPage] locations.listAll', e))
      .finally(() => setLocLoading(false));
  }, []);

  // Sprawdź czy lokalizacja ma floor plan → ustaw domyślny tryb
  useEffect(() => {
    if (!locationId) return;
    const saved = localStorage.getItem('desk_view_mode') as ViewMode | null;
    appApi.locations.floorPlan.get(locationId)
      .then(fp => {
        const has = !!fp?.floorPlanUrl;
        setHasPlan(has);
        if (!saved || isEndUser) setViewMode(has ? 'plan' : 'cards');
      })
      .catch(() => setHasPlan(false));
  }, [locationId, isEndUser]);

  const handleViewMode = (m: ViewMode) => {
    setViewMode(m);
    localStorage.setItem('desk_view_mode', m);
  };

  // Załaduj resources gdy zakładka aktywna
  useEffect(() => {
    if (mapTab === 'desks' || !locationId) return;
    const typeMap: Record<string, string> = { rooms: 'ROOM', parking: 'PARKING' };
    setResLoading(true);
    appApi.resources.list(locationId, typeMap[mapTab])
      .then(setResources)
      .catch((e) => console.error('[DeskMapPage] resources.list', e))
      .finally(() => setResLoading(false));
  }, [mapTab, locationId]);

  const { desks, locationLimits, loading, error, lastUpdated, refetch } = useDesks(locationId);

  useEffect(() => {
    if (!locationId || desks.length === 0) return;
    setOccupancyCache(prev => ({
      ...prev,
      [locationId]: { occupied: desks.filter(d => d.isOccupied).length, total: desks.length },
    }));
  }, [desks, locationId]);

  if (locLoading || (loading && desks.length === 0 && locationId)) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3 text-zinc-300">
        <div className="w-6 h-6 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" />
        <p className="text-sm">{t('deskmap.loading')}</p>
      </div>
    </div>
  );

  return (
    <div>
      <LocationTabs
        locations={locations}
        activeId={locationId}
        desksPerLocation={occupancyCache}
        onChange={setLocationId}
      />

      {/* Tab bar: Biurka | Sale | Parking — filtrowane przez moduły org */}
      <div className="flex gap-1 bg-zinc-100 rounded-xl p-1 mb-4 w-fit">
        {([
          ['desks',   '🪑', 'DESKS'  ],
          ['rooms',   '🏛', 'ROOMS'  ],
          ['parking', '🅿️', 'PARKING'],
        ] as const).filter(([, , mod]) => isEnabled(mod)).map(([tab, icon]) => (
          <button key={tab} onClick={() => setMapTab(tab as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              mapTab === tab ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            }`}>
            <span>{icon}</span>
            <span>{t(`deskmap.tab.${tab}`)}</span>
          </button>
        ))}
      </div>

      {/* Toolbar row: View toggle + Edit floor plan link */}
      <div className="flex items-center justify-between mb-1">
        {mapTab === 'desks' && <ViewToggle mode={viewMode} onChange={handleViewMode} hasPlan={hasPlan} />}
        {isAdmin && locationId && (
          <button
            onClick={() => navigate(`/floor-plan/${locationId}`)}
            className="text-xs text-brand hover:underline flex items-center gap-1">
            ✏ {t('floorplan.view.edit_plan')}
          </button>
        )}
      </div>

      {error && desks.length === 0 && (
        <EmptyState icon="⚠️" title={t('deskmap.error_title')} sub={error}
          action={<button onClick={refetch} className="text-sm text-brand underline mt-2">{t('btn.retry')}</button>} />
      )}
      {!loading && desks.length === 0 && !error && (
        <EmptyState icon="🪑" title={t('deskmap.no_desks_title')} sub={t('deskmap.no_desks_sub')} />
      )}

      {desks.length > 0 && viewMode === 'plan' && mapTab === 'desks' && (
        <FloorPlanView
          locationId={locationId}
          desks={desks}
          userRole={userRole}
          onReserve={desk => setReservationTarget(desk)}
        />
      )}

      {desks.length > 0 && viewMode === 'cards' && mapTab === 'desks' && (
        <DeskMap
          desks={desks}
          locationLimits={locationLimits}
          lastUpdated={lastUpdated}
          onRefresh={refetch}
          userRole={userRole}
          showAvatars={isStaff}
          users={reservationUsers}
        />
      )}

      {/* Resources — Sale i Parking */}
      {mapTab !== 'desks' && (
        <div>
          {resLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" />
            </div>
          ) : resources.length === 0 ? (
            <EmptyState
              icon={mapTab === 'rooms' ? '🏛' : '🅿️'}
              title={t(`deskmap.empty.${mapTab}`)}
              sub={t('deskmap.empty.sub')}
            />
          ) : (
            <>
              {resources.some(r => r.posX != null) && (
                <ViewToggle mode={resViewMode} onChange={setResViewMode} hasPlan={true} />
              )}
              {resViewMode === 'plan' && resources.some(r => r.posX != null) ? (
                <ResourceFloorPlanView
                  locationId={locationId}
                  resources={resources}
                  onBook={setBookTarget}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {resources.map(r => (
                    <ResourceCard key={r.id} resource={r} onBook={setBookTarget} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Booking Modal — Sale / Parking */}
      {bookTarget && (
        <BookingModal
          resource={bookTarget}
          onClose={() => setBookTarget(null)}
          onBooked={() => { setBookTarget(null); }}
        />
      )}

      {/* Reservation Modal — Biurka z FloorPlanView */}
      {reservationTarget && (
        <ReservationModal
          desk={reservationTarget}
          isEndUser={isEndUser}
          users={reservationUsers}
          limits={locationLimits}
          onClose={() => setReservationTarget(null)}
          onSuccess={() => { setReservationTarget(null); refetch(); }}
        />
      )}
    </div>
  );
}
