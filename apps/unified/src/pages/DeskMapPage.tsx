/**
 * DeskMapPage — Sprint A2 + D4
 * - Location tabs z live occupancy
 * - Toggle [🗺 Plan] [⊞ Karty]
 * - FloorPlanView lub DeskMap grid
 * - Preferencja widoku w localStorage
 */
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
import { toast }            from '../components/ui/Toast';
import { useOrgModules }    from '../hooks/useOrgModules';
import { RecommendationBanner } from '../components/recommendations/RecommendationBanner';
import { localDateStr }         from '../utils/date';
import { format }               from 'date-fns';
import { Monitor, Building2, ParkingCircle } from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────
const AMENITY_ICONS: Record<string, string> = {
  TV: '📺', videoconf: '📹', whiteboard: '📋', projector: '📽',
};

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
              active ? 'bg-brand/10 text-brand border-brand/20' : 'bg-white text-muted border-border hover:text-ink hover:bg-surface'
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

// ── Resource Stats ────────────────────────────────────────────
function ResourceStats({ resources }: { resources: any[] }) {
  const { t } = useTranslation();

  const free   = resources.filter(r => r.status === 'ACTIVE' && !r.currentBooking).length;
  const booked = resources.filter(r => r.status === 'ACTIVE' && !!r.currentBooking).length;

  const stats = [
    { num: free,   color: '#10b981', bg: '#d1fae5', label: t('desks.stats.free') },
    { num: booked, color: '#f59e0b', bg: '#fef3c7', label: t('resource.status.occupied') },
  ];

  return (
    <div className="grid grid-cols-2 mb-3">
      {stats.map(({ num, color, bg, label }) => (
        <div key={label}
          className="flex flex-col items-center justify-center py-3 px-2 border-r border-zinc-100 last:border-r-0"
          style={{ background: num > 0 ? bg + '33' : undefined }}>
          <span className="text-xl font-medium leading-none" style={{ color: num > 0 ? color : '#a1a1aa' }}>
            {num}
          </span>
          <span className="text-[10px] text-zinc-400 mt-1 text-center leading-tight">{label}</span>
        </div>
      ))}
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
const todayStr = (tz?: string) => new Date().toLocaleDateString('sv-SE', { timeZone: tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone });

// ── Day Slider ────────────────────────────────────────────────
function DaySlider({ selected, onChange, maxDaysAhead = 14, timezone }: {
  selected: string;
  onChange: (d: string) => void;
  maxDaysAhead?: number;
  timezone?: string;
}) {
  const { i18n } = useTranslation();
  const tz    = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = todayStr(tz);

  const days = useMemo(() => {
    const result: string[] = [];
    const start = new Date();
    start.setDate(start.getDate() - 3);
    for (let i = 0; i <= Math.min(maxDaysAhead + 3, 17); i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      result.push(d.toLocaleDateString('sv-SE', { timeZone: tz }));
    }
    return result;
  }, [maxDaysAhead, tz]);

  const fmt = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00Z');
    return {
      day: d.toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'pl-PL', { day: 'numeric', timeZone: tz }),
      dow: d.toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'pl-PL', { weekday: 'short', timeZone: tz }),
    };
  };

  const sliderRef = useRef<HTMLDivElement>(null);

  // Scroll selected chip into view on mount/change
  React.useEffect(() => {
    if (!sliderRef.current) return;
    const idx = days.indexOf(selected);
    if (idx < 0) return;
    const btn = sliderRef.current.children[idx] as HTMLElement | undefined;
    btn?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [selected, days]);

  return (
    <div ref={sliderRef} className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-3 scrollbar-none">
      {days.map(dateStr => {
        const { day, dow } = fmt(dateStr);
        const isToday    = dateStr === today;
        const isSelected = dateStr === selected;
        const isPast     = dateStr < today;
        return (
          <button
            key={dateStr}
            onClick={() => onChange(dateStr)}
            className={`flex-shrink-0 flex flex-col items-center px-3 py-1.5 rounded-xl border text-xs
              transition-all font-medium
              ${isSelected
                ? 'bg-brand text-white border-brand'
                : isPast
                  ? 'bg-zinc-50 text-zinc-400 border-zinc-100 hover:border-zinc-200'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
              }`}
            style={{ minWidth: 44 }}
          >
            <span className={`text-[10px] mb-0.5 ${isSelected ? 'text-white/80' : 'text-zinc-400'}`}>
              {dow}
            </span>
            <span className="leading-none">{day}</span>
            {isToday && !isSelected && (
              <span className="mt-0.5 w-1 h-1 rounded-full bg-brand" />
            )}
          </button>
        );
      })}
    </div>
  );
}

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
  const [bookTarget, setBookTarget]   = useState<{ resource: any; mode?: 'now' } | null>(null);
  const [resViewMode, setResViewMode] = useState<ViewMode>('plan');

  // Room filters
  const [minCapacity,   setMinCapacity]   = useState<number | null>(null);
  const [amenityFilter, setAmenityFilter] = useState<string[]>([]);

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
  const activeLocationTz = useMemo(
    () => locations.find(l => l.id === locationId)?.timezone as string | undefined,
    [locations, locationId],
  );

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
    appApi.resources.list(locationId, typeMap[mapTab], selectedDate)
      .then(setResources)
      .catch((e) => console.error('[DeskMapPage] resources.list', e))
      .finally(() => setResLoading(false));
  }, [mapTab, locationId, selectedDate]);

  useEffect(() => { loadResources(); }, [loadResources]);

  const filteredResources = useMemo(() => {
    return resources
      .filter(r => !minCapacity || (r.capacity ?? 0) >= minCapacity)
      .filter(r => amenityFilter.every(a => r.amenities?.includes(a)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [resources, minCapacity, amenityFilter]);

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
          ['desks',   <Monitor size={15} />,       'DESKS'  ],
          ['rooms',   <Building2 size={15} />,     'ROOMS'  ],
          ['parking', <ParkingCircle size={15} />, 'PARKING'],
        ] as [string, React.ReactElement, 'DESKS' | 'ROOMS' | 'PARKING'][]).filter(([, , mod]) => isEnabled(mod)).map(([tab, icon]) => (
          <button key={tab} onClick={() => setMapTab(tab as any)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
              mapTab === tab ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            }`}>
            <span className="flex items-center">{icon}</span>
            <span>{t(`deskmap.tab.${tab}`)}</span>
          </button>
        ))}
      </div>

      {/* Day slider — wspólny dla wszystkich tabów */}
      <DaySlider
        selected={selectedDate}
        onChange={setSelectedDate}
        maxDaysAhead={locationLimits?.maxDaysAhead ?? 14}
        timezone={activeLocationTz}
      />

      {/* Stats — above map */}
      {desks.length > 0 && mapTab === 'desks' && !isEndUser && isEnabled('BEACONS') && (
        <DeskStats desks={desks} currentUserId={userId} />
      )}

      {/* Toolbar row: View toggle + last updated + Edit floor plan link */}
      <div className="flex items-center justify-between mb-1">
        {mapTab === 'desks' && <ViewToggle mode={viewMode} onChange={handleViewMode} hasPlan={hasPlan} />}
        <div className="flex items-center gap-3 ml-auto">
          {lastUpdated && (
            <span className="text-[11px] text-zinc-400">
              {t('deskmap.last_updated', 'Zaktualizowano')} {format(lastUpdated, 'HH:mm')}
            </span>
          )}
          <button onClick={refetch} title={t('btn.refresh', 'Odśwież')}
            className="text-zinc-400 hover:text-zinc-600 transition-colors text-sm">
            ↺
          </button>
          {isAdmin && locationId && (
            <button
              onClick={() => navigate(`/floor-plan/${locationId}`)}
              className="text-xs text-brand hover:underline flex items-center gap-1">
              ✏ {t('floorplan.view.edit_plan')}
            </button>
          )}
        </div>
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

      {viewMode === 'plan' && !hasPlan && mapTab === 'desks' && !loading && (
        <EmptyState
          icon="🗺"
          title={t('deskmap.no_plan_title', 'Brak planu piętra')}
          sub={t('deskmap.no_plan_sub', 'Dodaj plan piętra, aby zobaczyć biurka na mapie.')}
          action={isAdmin && locationId ? (
            <button
              onClick={() => navigate(`/floor-plan/${locationId}`)}
              className="mt-2 px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              {t('deskmap.no_plan_cta', '+ Dodaj plan piętra')}
            </button>
          ) : undefined}
        />
      )}

      {desks.length > 0 && hasPlan && viewMode === 'plan' && mapTab === 'desks' && (
        <FloorPlanView
          locationId={locationId}
          desks={desks}
          userRole={userRole}
          selectedDate={selectedDate}
          currentUserId={userId}
          timezone={activeLocationTz}
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
          timezone={activeLocationTz}
        />
      )}

      {/* Resources — Sale i Parking */}
      {mapTab !== 'desks' && (
        <div>
          {/* Room filters (only for rooms tab) */}
          {mapTab === 'rooms' && (
            <div className="flex flex-wrap gap-2 mb-3">
              <select
                value={minCapacity ?? ''}
                onChange={e => setMinCapacity(e.target.value ? Number(e.target.value) : null)}
                className="text-xs border rounded-lg px-2 py-1.5 text-zinc-600 bg-white border-zinc-200"
                aria-label={t('deskmap.filter.capacity', 'Minimalna pojemność')}
              >
                <option value="">{t('rooms.filter.any_capacity', 'Dowolna pojemność')}</option>
                <option value="4">≥ 4 os.</option>
                <option value="8">≥ 8 os.</option>
                <option value="12">≥ 12 os.</option>
                <option value="20">≥ 20 os.</option>
              </select>
              {(['TV', 'videoconf', 'whiteboard', 'projector'] as const).map(a => (
                <button key={a}
                  onClick={() => setAmenityFilter(f => f.includes(a) ? f.filter(x => x !== a) : [...f, a])}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                    amenityFilter.includes(a)
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white text-zinc-600 border-zinc-200'
                  }`}
                >
                  {AMENITY_ICONS[a]} {a}
                </button>
              ))}
            </div>
          )}

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
              {resources.length > 0 && !isEndUser && (
                <ResourceStats resources={resources} />
              )}
              {resources.some(r => r.posX != null) && (
                <ViewToggle mode={resViewMode} onChange={setResViewMode} hasPlan={true} />
              )}
              {resViewMode === 'plan' && resources.some(r => r.posX != null) ? (
                <ResourceFloorPlanView
                  locationId={locationId}
                  resources={filteredResources}
                  onBook={r => setBookTarget({ resource: r })}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredResources.map(r => {
                    const isLocked     = r.type === 'PARKING' && r.accessMode === 'GROUP_RESTRICTED' && r.userHasAccess === false;
                    const activeBlock  = r.activeBlock ?? null;

                    return (
                      <div key={r.id} className={`relative ${isLocked ? 'opacity-40' : ''}`}>
                        <ResourceCard
                          resource={r}
                          onBook={(res, mode) => {
                            if (isLocked) {
                              toast('Nie masz dostępu do tego miejsca parkingowego.', 'warning');
                              return;
                            }
                            if (activeBlock) {
                              const till = new Date(activeBlock.endTime).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
                              toast(`Miejsce zablokowane do ${till}${activeBlock.reason ? ` · ${activeBlock.reason}` : ''}`, 'warning');
                              return;
                            }
                            setBookTarget({ resource: res, mode });
                          }}
                        />
                        {isLocked && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-3xl drop-shadow-sm">🔒</span>
                          </div>
                        )}
                        {!isLocked && activeBlock && (
                          <div className="absolute top-2 right-2 pointer-events-none">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">⛔ Zablokowane</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Booking Modal — Sale / Parking */}
      {bookTarget && (
        <BookingModal
          resource={bookTarget.resource}
          initialDate={selectedDate}
          presetNow={bookTarget.mode === 'now'}
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
