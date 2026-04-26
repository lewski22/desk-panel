/**
 * FloorPlanView — widok readonly floor plan z pinami statusu
 * Sprint D3c — dla wszystkich ról
 * - Piny z kolorami statusu (zielony/niebieski/czerwony/szary)
 * - Kliknięcie pinu → DeskInfoCard (popup)
 * - Filtr "Pokaż tylko wolne"
 * - Legenda kolorów
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation }   from 'react-i18next';
import { DeskMapItem }       from '../../types';
import { DeskPin }           from './DeskPin';
import { appApi }            from '../../api/client';
import { format }            from 'date-fns';

interface Props {
  locationId:     string;
  desks:          DeskMapItem[];
  userRole:       string;
  selectedDate?:  string;
  currentUserId?: string;
  onReserve?:     (desk: DeskMapItem) => void;  // otwiera ReservationModal
}

// ── Desk Info Popup ───────────────────────────────────────────
function DeskInfoCard({ desk, onClose, onReserve, userRole, style }: {
  desk: DeskMapItem; onClose: () => void; onReserve?: () => void; userRole: string;
  style: React.CSSProperties;
}) {
  const { t } = useTranslation();

  const statusLabel = () => {
    if (!desk.isOnline) return { label: t('devices.status.offline'), color: 'text-zinc-500' };
    if (desk.isOccupied) return { label: t('desks.stats.occupied'), color: 'text-red-600' };
    if (desk.currentReservation) return { label: t('desks.stats.reserved'), color: 'text-amber-600' };
    return { label: t('desks.stats.free'), color: 'text-emerald-600' };
  };

  const { label, color } = statusLabel();
  const canBook = desk.isOnline && !desk.isOccupied && desk.status === 'ACTIVE';
  const isStaff = ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'].includes(userRole);

  return (
    <div className="absolute z-30 bg-white rounded-2xl shadow-2xl border border-zinc-200 p-4 w-60"
      style={style}
      onClick={e => e.stopPropagation()}>

      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-zinc-800">{desk.name}</p>
          <p className="text-xs text-zinc-400 font-mono">{desk.code}</p>
        </div>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-1">✕</button>
      </div>

      <p className={`text-sm font-semibold mb-2 ${color}`}>{label}</p>

      {/* Kto siedzi — tylko dla STAFF+ */}
      {isStaff && desk.isOccupied && desk.currentCheckin && (
        <div className="bg-indigo-50 rounded-lg p-2.5 mb-3">
          <p className="text-xs font-semibold text-indigo-700">
            {desk.currentCheckin.user?.firstName} {desk.currentCheckin.user?.lastName}
          </p>
          <p className="text-[10px] text-indigo-400 mt-0.5">
            od {format(new Date(desk.currentCheckin.checkedInAt), 'HH:mm')}
          </p>
        </div>
      )}

      {/* Rezerwacja */}
      {desk.currentReservation && (
        <div className="bg-sky-50 rounded-lg p-2.5 mb-3">
          {isStaff && (
            <p className="text-xs font-semibold text-sky-700">
              {desk.currentReservation.user?.firstName} {desk.currentReservation.user?.lastName}
            </p>
          )}
          <p className="text-[10px] text-sky-500">
            {format(new Date(desk.currentReservation.startTime), 'HH:mm')}–{format(new Date(desk.currentReservation.endTime), 'HH:mm')}
          </p>
        </div>
      )}

      {/* Zone/Floor */}
      {(desk.zone || desk.floor) && (
        <p className="text-xs text-zinc-400 mb-3">
          {[desk.zone, desk.floor && `${t('deskcard.floor')} ${desk.floor}`].filter(Boolean).join(' · ')}
        </p>
      )}

      {canBook && onReserve && (
        <button onClick={onReserve}
          className="w-full py-2 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand-hover transition-colors">
          + {t('deskcard.book')}
        </button>
      )}
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────
function Legend() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-4 mb-3 px-1 flex-wrap">
      {[
        { color: '#10b981', bg: '#d1fae5', label: t('desks.stats.free') },
        { color: '#f59e0b', bg: '#fef3c7', label: t('desks.stats.reserved') },
        { color: '#7c3aed', bg: '#ede9fe', label: t('deskmap.legend.mine', 'Moje') },
        { color: '#ef4444', bg: '#fee2e2', label: t('desks.stats.occupied') },
        { color: '#a1a1aa', bg: '#f4f4f5', label: t('devices.status.offline') },
      ].map(({ color, bg, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span style={{
            display: 'inline-block',
            width: 10, height: 10,
            borderRadius: '50%',
            background: bg,
            border: `1.5px solid ${color}`,
            flexShrink: 0,
          }} />
          <span className="text-xs text-zinc-500">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Floor Tabs ────────────────────────────────────────────────
function FloorTabs({ floors, active, onChange }: { floors: string[]; active: string; onChange: (f: string) => void }) {
  if (floors.length <= 1) return null;
  return (
    <div className="flex gap-1 mb-3 overflow-x-auto">
      {floors.map(f => (
        <button key={f} onClick={() => onChange(f)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
            f === active
              ? 'bg-brand text-white border-brand'
              : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
          }`}>
          {f}
        </button>
      ))}
    </div>
  );
}

// ── Popup position helper ─────────────────────────────────────
function popupStyle(
  posX: number, posY: number,
  containerW: number, canvasW: number, canvasH: number,
): React.CSSProperties {
  const svgW = Math.min(canvasW, containerW);
  const svgH = svgW * canvasH / canvasW;
  const xPx  = (posX / 100) * svgW;
  const yPx  = (posY / 100) * svgH;
  return posX > 55
    ? { top: yPx, right: containerW - xPx + 8, transform: 'translateY(-50%)' }
    : { top: yPx, left: xPx + 8, transform: 'translateY(-50%)' };
}

// ── Main FloorPlanView ────────────────────────────────────────
export function FloorPlanView({ locationId, desks, userRole, selectedDate: _selectedDate, currentUserId, onReserve }: Props) {
  const { t }                  = useTranslation();
  const [floorPlan, setFP]     = useState<any>(null);
  const [loading,   setL]      = useState(true);
  const [selected,  setSel]    = useState<DeskMapItem | null>(null);
  const [freeOnly,  setFO]     = useState(false);
  const [floors,    setFloors] = useState<string[]>([]);
  const [activeFloor, setActiveFloor] = useState<string>('');
  const [zoom,      setZoom]   = useState(1.0);
  const containerRef = useRef<HTMLDivElement>(null);

  const ZOOM_STEP = 0.2;
  const ZOOM_MIN  = 0.5;
  const ZOOM_MAX  = 3.0;

  const handleWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(z => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(z - e.deltaY * 0.001).toFixed(2))));
  };

  const isStaff = ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'].includes(userRole);

  // Pobierz listę pięter z biurek (te z planem) i z API floors
  useEffect(() => {
    appApi.locations.floors(locationId)
      .then(list => {
        setFloors(list);
        if (list.length > 0 && !activeFloor) setActiveFloor(list[0]);
      })
      .catch(() => {});
  }, [locationId]);

  useEffect(() => {
    if (!activeFloor && floors.length === 0) {
      // Brak pięter — załaduj legacy single floor plan
      appApi.locations.floorPlan.get(locationId)
        .then(fp => { if (fp?.floorPlanUrl) setFP(fp); })
        .catch(() => {})
        .finally(() => setL(false));
      return;
    }
    if (!activeFloor) return;
    setL(true);
    appApi.locations.floorPlan.get(locationId, activeFloor)
      .then(fp => setFP(fp?.floorPlanUrl ? fp : null))
      .catch(() => setFP(null))
      .finally(() => setL(false));
  }, [locationId, activeFloor, floors.length]);

  const canvasW = floorPlan?.floorPlanW ?? 1200;
  const canvasH = floorPlan?.floorPlanH ?? 800;

  // Biurka z pozycją, przefiltrowane po aktywnym piętrze
  const placedDesks = useMemo(() =>
    desks.filter(d =>
      d.posX != null && d.posY != null &&
      (floors.length === 0 || !activeFloor || d.floor === activeFloor) &&
      (!freeOnly || (!d.isOccupied && !d.currentReservation && d.isOnline))
    ), [desks, freeOnly, activeFloor, floors.length]);

  if (loading) return (
    <div className="flex justify-center py-8">
      <div className="w-5 h-5 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" />
    </div>
  );

  if (!floorPlan?.floorPlanUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-400">
        <span className="text-4xl mb-3">🗺</span>
        <p className="text-sm font-medium">{t('floorplan.view.no_plan')}</p>
        <p className="text-xs mt-1">{t('floorplan.view.no_plan_sub')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* 1. Legenda — nad mapą */}
      <Legend />

      <FloorTabs floors={floors} active={activeFloor} onChange={f => { setActiveFloor(f); setSel(null); }} />

      {/* 2. Pasek kontrolny: filtr + licznik + zoom */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFO(v => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              freeOnly
                ? 'bg-brand text-white border-brand'
                : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
            }`}>
            {freeOnly ? '✓ ' : ''}{t('floorplan.view.free_only')}
          </button>
          <span className="text-xs text-zinc-400">
            {placedDesks.length} {t('floorplan.view.desks_visible')}
          </span>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(1)))}
            className="w-7 h-7 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 text-sm font-mono flex items-center justify-center">
            −
          </button>
          <span className="text-xs text-zinc-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(1)))}
            className="w-7 h-7 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 text-sm font-mono flex items-center justify-center">
            +
          </button>
          <button onClick={() => setZoom(1.0)}
            className="text-xs text-zinc-400 hover:text-zinc-600 px-2 py-1 rounded-lg border border-zinc-200 hover:bg-zinc-100">
            Reset
          </button>
        </div>
      </div>

      {/* 3. SVG canvas */}
      <div ref={containerRef}
        className="relative bg-zinc-100 rounded-xl overflow-auto border border-zinc-200"
        style={{ maxHeight: '65vh' }}
        onClick={() => setSel(null)}
        onWheel={handleWheel}>
        <svg
          width={canvasW * zoom}
          height={canvasH * zoom}
          viewBox={`0 0 ${canvasW} ${canvasH}`}
          style={{ display: 'block', background: '#fafafa' }}
        >
          <image href={floorPlan.floorPlanUrl} x={0} y={0}
            width={canvasW} height={canvasH} preserveAspectRatio="xMidYMid meet" />

          {placedDesks.map(desk => (
            <DeskPin
              key={desk.id}
              desk={desk}
              pos={{ id: desk.id, posX: desk.posX!, posY: desk.posY!, rotation: desk.rotation ?? 0, width: desk.width ?? 2, height: desk.height ?? 1 }}
              canvasW={canvasW}
              canvasH={canvasH}
              showAvatars={isStaff}
              currentUserId={currentUserId}
              onClick={d => setSel(d)}
            />
          ))}
        </svg>

        {/* Popup */}
        {selected && containerRef.current && (
          <DeskInfoCard
            desk={selected}
            onClose={() => setSel(null)}
            onReserve={onReserve ? () => { const d = selected; setSel(null); onReserve(d); } : undefined}
            userRole={userRole}
            style={popupStyle(
              selected.posX ?? 50, selected.posY ?? 50,
              containerRef.current.clientWidth, canvasW, canvasH,
            )}
          />
        )}
      </div>
    </div>
  );
}
