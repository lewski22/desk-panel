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
import { DeskMap, DeskStats }        from '../components/desks/DeskMap';
import { FloorPlanView }            from '../components/floor-plan/FloorPlanView';
import { ResourceFloorPlanView }    from '../components/floor-plan/ResourceFloorPlanView';
import { ResourceCard }             from '../components/desks/ResourceCard';
import { BookingModal }     from '../components/desks/BookingModal';
import { ReservationModal } from '../components/desks/ReservationModal';
import { appApi }           from '../api/client';
import { EmptyState }       from '../components/ui';
import { useOrgModules }    from '../hooks/useOrgModules';
import { RecommendationBanner } from '../components/recommendations/RecommendationBanner';
import { localDateStr }         from '../utils/date';

// ── Helpers ──────────────────────────────────────────────────
// FIX P1-2: occupied = free desks count, total = active+online desks — invert thresholds
function occupancyColor(occupied: number, total: number) {
  const pct = total === 0 ? 100 : (occupied / total) * 100; // pct of FREE desks
  if (pct <= 10) return 'text-red-600 bg-red-50 border-red-200';   // almost full
  if (pct <= 30) return 'text-amber-600 bg-amber-50 border-amber-200'; // filling up
  return 'text-emerald-600 bg-emerald-50 border-emerald-200'; // plenty free
}

// ── Location Tabs ─────────────────────────────────────────────
function LocationTabs({ locations, activeId, desksPerLocation, onChange, userRole }: {
  locations: any[]; activeId: string;
  desksPerLocation: Record<string, { occupied: number; total: number }>;
  onChange: (id: string) => void;
  userRole: string;
}) {
  const { t } = useTranslation();
  if (locations.length === 0) return null;
  if (locations.length === 1) return <p className="text-sm text-zinc-500 mb-4 font-medium">{locations[0].name}</p>;
  return (
    <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
      {locations.map(loc => {
        const occ   = desksPerLocation[loc.id] ?? { occupied: 0, total: 0 };
        const active = loc.id === activeId;
        const color = occupancyColor(occ.occupied, occ.total);
        // FEATURE P4-3A: gray out empty locations for END_USER
        const isEmpty = occ.total === 0 && userRole === 'END_USER';
        return (
          <button key={loc.id}
            onClick={isEmpty ? undefined : () => onChange(loc.id)}
            title={isEmpty ? t('deskmap.location_no_desks') : undefined}
            className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
              active ? 'bg-brand text-white border-brand shadow-sm' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
            } ${isEmpty ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}>
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

// ── Helpers ──────────────────────────────────────────────────
const todayStr = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });

// ── Main Page ─────────────────────────────────────────────────
export function DeskMapPage() {
  const { t }       = useTranslation();
  const navigate    = useNavigate();
  const [locations,     setLocations]     = useState<any[]>([]);
  const [locationId,    setLocationId]    = useState<string>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('app_user') ?? 'null');
      if (stored?.id) {
        const pref = localStorage.getItem(`user_default_location_${stored.id}`);
        if (pref) return pref;
      }
      const last = localStorage.getItem('desks_loc');
      if (last) return last;
    } catch {}
    return import.meta.env.VITE_LOCATION_ID ?? '';
  });
  const [selectedDate,  setSelectedDate]  = useState<string>(todayStr());
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
  const userId = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('app_user') ?? 'null')?.id ?? ''; } catch { return ''; }
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
        if (!saved || isEndUser || isStaff) setViewMode(has ? 'plan' : 'cards');
      })
      .catch(() => setHasPlan(false));
  }, [locationId, isEndUser]);

  const handleViewMode = (m: ViewMode) => {
    setViewMode(m);
    localStorage.setItem('desk_view_mode', m);
  };

  // Załaduj resources gdy zakładka aktywna
  const loadResources = useCallback(() => {
    if (mapTab === 'desks' || !locationId) return;
    const typeMap: Record<string, string> = { rooms: 'ROOM', parking: 'PARKING' };
    setResLoading(true);
    appApi.resources.list(locationId, typeMap[mapTab])
      .then(setResources)
      .catch((e) => console.error('[DeskMapPage] resources.list', e))
      .finally(() => setResLoading(false));
  }, [mapTab, locationId]);

  useEffect(() => { loadResources(); }, [loadResources]);

  const { desks, locationLimits, loading, error, lastUpdated, refetch } = useDesks(locationId, selectedDate);

  useEffect(() => {
    if (!locationId || desks.length === 0) return;
    // FIX P1-2: show free/active count — "N free of M active" is more useful than "N occupied/total"
    const activeDesksList = desks.filter(d => d.isOnline && d.status === 'ACTIVE');
    const freeDesksList   = activeDesksList.filter(d => !d.isOccupied && !d.currentReservation);
    setOccupancyCache(prev => ({
      ...prev,
      [locationId]: { occupied: freeDesksList.length, total: activeDesksList.length },
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
        onChange={id => { setLocationId(id); localStorage.setItem('desks_loc', id); }}
        userRole={userRole}
      />

      {locations.length > 1 && locationId && (
        <div className="flex justify-end -mt-2 mb-3">
          <button
            onClick={() => {
              try {
                const stored = JSON.parse(localStorage.getItem('app_user') ?? 'null');
                if (stored?.id) {
                  localStorage.setItem(`user_default_location_${stored.id}`, locationId);
                }
              } catch {}
            }}
            className="text-xs text-brand hover:underline font-medium">
            ☆ {t('deskmap.set_default', 'Domyślne')}
          </button>
        </div>
      )}

      {/* Tab bar: Biurka | Sale | Parking — filtrowane przez moduły org — FEATURE P4-4: larger buttons */}
      <div className="flex gap-1 bg-zinc-100 rounded-xl p-1.5 mb-4 w-fit">
        {([
          ['desks',   '🪑', 'DESKS'  ],
          ['rooms',   '🏛', 'ROOMS'  ],
          ['parking', '🅿️', 'PARKING'],
        ] as const).filter(([, , mod]) => isEnabled(mod)).map(([tab, icon]) => (
          <button key={tab} onClick={() => setMapTab(tab as any)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
              mapTab === tab ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            }`}>
            <span className="text-base">{icon}</span>
            <span>{t(`deskmap.tab.${tab}`)}</span>
          </button>
        ))}
      </div>

      {/* Date picker */}
      {mapTab === 'desks' && (
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <label className="text-xs font-medium text-zinc-500 shrink-0">
            {t('deskmap.date_label', 'Pokaż dostępność na:')}
          </label>
          <input
            type="date"
            value={selectedDate}
            min={todayStr()}
            max={(() => {
              const d = new Date();
              d.setDate(d.getDate() + (locationLimits?.maxDaysAhead ?? 14));
              return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
            })()}
            onChange={e => setSelectedDate(e.target.value)}
            className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-700
                       focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand
                       bg-white cursor-pointer"
          />
          {selectedDate !== todayStr() && (
            <button
              onClick={() => setSelectedDate(todayStr())}
              className="text-xs text-brand hover:underline font-medium">
              {t('deskmap.today', 'Dziś')}
            </button>
          )}
        </div>
      )}

      {/* Stats — above map, for non-END_USER on desks tab */}
      {mapTab === 'desks' && !isEndUser && desks.length > 0 && (
        <DeskStats desks={desks} />
      )}

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
      {!loading && desks.length === 0 && !error && mapTab === 'desks' && ( // FIX P1-1: only show desk empty state when on desks tab
        <EmptyState icon="🪑" title={t('deskmap.no_desks_title')} sub={t('deskmap.no_desks_sub')} />
      )}

      {mapTab === 'desks' && locationId && userId && (
        <RecommendationBanner
          locationId={locationId}
          userId={userId}
          date={localDateStr()}
          onReserve={deskId => {
            const desk = desks.find(d => d.id === deskId);
            if (desk) setReservationTarget(desk);
          }}
        />
      )}

      {desks.length > 0 && viewMode === 'plan' && mapTab === 'desks' && (
        <FloorPlanView
          locationId={locationId}
          desks={desks}
          userRole={userRole}
          selectedDate={selectedDate}
          currentUserId={userId}
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
          selectedDate={selectedDate}
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
          onBooked={() => { setBookTarget(null); loadResources(); }}
        />
      )}

      {/* Reservation Modal — Biurka z FloorPlanView */}
      {reservationTarget && (
        <ReservationModal
          desk={reservationTarget}
          isEndUser={isEndUser}
          users={reservationUsers}
          limits={locationLimits}
          initialDate={selectedDate}
          onClose={() => setReservationTarget(null)}
          onSuccess={() => { setReservationTarget(null); refetch(); }}
        />
      )}
    </div>
  );
}
