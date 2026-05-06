/**
 * FloorPlanView — widok readonly floor plan z pinami statusu
 * Sprint D3c — dla wszystkich ról
 * - Piny z kolorami statusu (zielony/niebieski/czerwony/szary)
 * - Kliknięcie pinu → DeskInfoCard (popup)
 * - Filtr "Pokaż tylko wolne"
 * - Legenda kolorów
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal }      from 'react-dom';
import { useTranslation }    from 'react-i18next';
import { DeskMapItem }        from '../../types';
import { DeskPin }            from './DeskPin';
import { appApi }             from '../../api/client';
import { format }             from 'date-fns';

interface Props {
  locationId:     string;
  desks:          DeskMapItem[];
  userRole:       string;
  selectedDate?:  string;
  currentUserId?: string;
  timezone?:      string;
  onReserve?:     (desk: DeskMapItem) => void;  // otwiera ReservationModal
}

// ── Desk Info Card — bottom sheet (mobile) / fixed popover (desktop) ──
const POPUP_W = 240;

function DeskInfoCard({ desk, onClose, onReserve, userRole, anchorRect, timezone }: {
  desk: DeskMapItem;
  onClose: () => void;
  onReserve?: () => void;
  userRole: string;
  anchorRect: DOMRect | null;
  timezone?: string;
}) {
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const statusLabel = () => {
    if (!desk.isOnline) return { label: t('devices.status.offline'), color: 'text-zinc-500' };
    if (desk.isOccupied) return { label: t('desks.stats.occupied'), color: 'text-red-600' };
    if (desk.currentReservation) return { label: t('desks.stats.reserved'), color: 'text-amber-600' };
    return { label: t('desks.stats.free'), color: 'text-emerald-600' };
  };

  const { label, color } = statusLabel();
  const canBook = desk.isOnline && !desk.isOccupied && desk.status === 'ACTIVE';
  const isStaff = ['SUPER_ADMIN', 'OFFICE_ADMIN', 'STAFF'].includes(userRole);

  const content = (
    <div onClick={e => e.stopPropagation()}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-zinc-800">{desk.name}</p>
          {(desk.zone || desk.floor) && (
            <p className="text-xs text-zinc-400 mt-0.5">
              {[desk.zone, desk.floor && `${t('deskcard.floor')} ${desk.floor}`].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="text-xs text-zinc-400 font-mono">{desk.code}</p>
        </div>
        <button onClick={onClose}
          className="text-zinc-400 hover:text-zinc-600 p-1 ml-2 shrink-0 text-lg leading-none">
          ✕
        </button>
      </div>

      <p className={`text-sm font-semibold mb-2 ${color}`}>{label}</p>

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

      {desk.currentReservation && (
        <div className="bg-sky-50 rounded-lg p-2.5 mb-3">
          {isStaff && (
            <p className="text-xs font-semibold text-sky-700">
              {desk.currentReservation.user?.firstName} {desk.currentReservation.user?.lastName}
            </p>
          )}
          <p className="text-[10px] text-sky-500">
            {new Date(desk.currentReservation.startTime).toLocaleTimeString('pl-PL', {
              hour: '2-digit', minute: '2-digit', timeZone: timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
            })}
            –
            {new Date(desk.currentReservation.endTime).toLocaleTimeString('pl-PL', {
              hour: '2-digit', minute: '2-digit', timeZone: timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
            })}
          </p>
        </div>
      )}

      {canBook && onReserve && (
        <button onClick={onReserve}
          className="w-full py-2.5 rounded-xl bg-brand text-white text-sm font-semibold
                     hover:bg-brand-hover transition-colors active:scale-[0.98]">
          + {t('deskcard.book')}
        </button>
      )}
    </div>
  );

  // Mobile: fixed bottom sheet via portal
  if (isMobile) {
    return createPortal(
      <>
        <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl p-5 border-t border-zinc-200"
          style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
        >
          <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto mb-4" />
          {content}
        </div>
      </>,
      document.body,
    );
  }

  // Desktop: fixed popover pozycjonowany względem viewport
  const POPUP_H_EST = 220;
  let left = (anchorRect?.left ?? 0) + (anchorRect?.width ?? 0) / 2 - POPUP_W / 2;
  let top  = (anchorRect?.top  ?? 0) - POPUP_H_EST - 8;
  left = Math.max(8, Math.min(left, window.innerWidth  - POPUP_W - 8));
  if (top < 8) top = (anchorRect?.bottom ?? 0) + 8;

  return createPortal(
    <div
      className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-zinc-200 p-4"
      style={{ width: POPUP_W, top, left }}
      onClick={e => e.stopPropagation()}
    >
      {content}
    </div>,
    document.body,
  );
}

// ── Main FloorPlanView ────────────────────────────────────────
export function FloorPlanView({ locationId, desks, userRole, selectedDate: _selectedDate, currentUserId, timezone, onReserve }: Props) {
  const { t }                  = useTranslation();
  const [floorPlan, setFP]     = useState<any>(null);
  const [loading,   setL]      = useState(true);
  const [selected,     setSel]    = useState<DeskMapItem | null>(null);
  const [selectedRect, setSelRect] = useState<DOMRect | null>(null);
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

  // ── Pinch-to-zoom (native listeners required for preventDefault to work) ──
  const lastTouchDist = useRef<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const getTouchDist = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        lastTouchDist.current = getTouchDist(e.touches);
        e.preventDefault();
      } else {
        lastTouchDist.current = null;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastTouchDist.current !== null) {
        e.preventDefault();
        const newDist = getTouchDist(e.touches);
        const scale   = newDist / lastTouchDist.current;
        lastTouchDist.current = newDist;
        setZoom(z => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * scale)));
      }
    };

    const onTouchEnd = () => { lastTouchDist.current = null; };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
  }, []);

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
      {/* ── Toolbar: 2 wiersze ───────────────────────────────────── */}
      <div className="mb-2 space-y-1.5">

        {/* Wiersz 1: Piętro + filtr + licznik */}
        <div className="flex items-center gap-2 flex-wrap">

          {/* Wybór piętra z labelem — ukryty gdy 1 piętro */}
          {floors.length > 1 && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-zinc-400 font-medium shrink-0">
                  {t('floorplan.floor_label', 'Piętro')}:
                </span>
                {floors.map(f => (
                  <button
                    key={f}
                    onClick={() => { setActiveFloor(f); setSel(null); setSelRect(null); }}
                    className={`min-w-[26px] h-[26px] px-2 rounded-md text-[11px] font-semibold
                                transition-all border ${
                      f === activeFloor
                        ? 'bg-brand text-white border-brand'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <span className="w-px h-4 bg-zinc-200 shrink-0" />
            </>
          )}

          {/* Filtr "Tylko wolne" */}
          <button
            onClick={() => setFO(v => !v)}
            className={`h-7 px-3 rounded-lg text-[11px] font-semibold border transition-colors ${
              freeOnly
                ? 'bg-brand text-white border-brand'
                : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300'
            }`}
          >
            {freeOnly ? '✓ ' : ''}{t('floorplan.view.free_only')}
          </button>

          {/* Licznik */}
          <span className="text-[11px] text-zinc-400">
            {placedDesks.length} {t('floorplan.view.desks_visible', 'biurek')}
          </span>

        </div>

        {/* Wiersz 2: Legenda + zoom */}
        <div className="flex items-center gap-3 flex-wrap">

          {/* Legenda kolorów */}
          <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
            {[
              { color: '#10b981', bg: '#d1fae5', label: t('desks.stats.free') },
              { color: '#f59e0b', bg: '#fef3c7', label: t('desks.stats.reserved') },
              { color: '#7c3aed', bg: '#ede9fe', label: t('deskmap.legend.mine', 'Moje') },
              { color: '#ef4444', bg: '#fee2e2', label: t('desks.stats.occupied') },
              { color: '#a1a1aa', bg: '#f4f4f5', label: t('devices.status.offline') },
            ].map(({ color, bg, label }) => (
              <div key={label} className="flex items-center gap-1">
                <span style={{
                  display: 'inline-block', width: 8, height: 8,
                  borderRadius: '50%', background: bg,
                  border: `1.5px solid ${color}`, flexShrink: 0,
                }} />
                <span className="text-[11px] text-zinc-500 whitespace-nowrap">{label}</span>
              </div>
            ))}
          </div>

          {/* Separator */}
          <span className="w-px h-4 bg-zinc-200 shrink-0" />

          {/* Zoom controls */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(1)))}
              className="w-7 h-7 rounded-md border border-zinc-200 bg-white text-zinc-500
                         hover:bg-zinc-50 text-sm font-mono flex items-center justify-center"
            >−</button>
            <span className="text-[11px] text-zinc-400 w-9 text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(1)))}
              className="w-7 h-7 rounded-md border border-zinc-200 bg-white text-zinc-500
                         hover:bg-zinc-50 text-sm font-mono flex items-center justify-center"
            >+</button>
            <button
              onClick={() => setZoom(1.0)}
              className="text-[11px] text-zinc-400 hover:text-zinc-600 px-1.5 py-1 rounded-md
                         border border-zinc-200 hover:bg-zinc-50"
            >
              {t('floorplan.zoom_reset', 'Reset')}
            </button>
          </div>

        </div>

      </div>

      {/* 3. SVG canvas */}
      <div ref={containerRef}
        className="relative bg-zinc-100 rounded-xl overflow-auto border border-zinc-200"
        style={{ maxHeight: '65vh', touchAction: 'pan-x pan-y' }}
        onClick={() => { setSel(null); setSelRect(null); }}
        onWheel={handleWheel}
      >
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
              onClick={(d, rect) => { setSel(d); setSelRect(rect); }}
            />
          ))}
        </svg>

        {/* Portal-based card — renderowana poza scrollującym kontenerem */}
        {selected && (
          <DeskInfoCard
            desk={selected}
            onClose={() => { setSel(null); setSelRect(null); }}
            onReserve={onReserve ? () => { const d = selected; setSel(null); setSelRect(null); onReserve(d); } : undefined}
            userRole={userRole}
            anchorRect={selectedRect}
            timezone={timezone}
          />
        )}
      </div>
    </div>
  );
}
