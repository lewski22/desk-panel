/**
 * FloorPlanView — widok readonly floor plan z pinami statusu
 * Sprint D3c — dla wszystkich ról
 * - Piny z kolorami statusu (zielony/niebieski/czerwony/szary)
 * - Kliknięcie pinu → DeskInfoCard (popup)
 * - Filtr "Pokaż tylko wolne"
 * - Legenda kolorów
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation }   from 'react-i18next';
import { DeskMapItem }       from '../../types';
import { DeskPin }           from './DeskPin';
import { appApi }            from '../../api/client';
import { format }            from 'date-fns';

interface Props {
  locationId:   string;
  desks:        DeskMapItem[];
  userRole:     string;
  onReserve?:   (desk: DeskMapItem) => void;  // otwiera ReservationModal
}

// ── Desk Info Popup ───────────────────────────────────────────
function DeskInfoCard({ desk, onClose, onReserve, userRole }: {
  desk: DeskMapItem; onClose: () => void; onReserve?: () => void; userRole: string;
}) {
  const { t } = useTranslation();

  const statusLabel = () => {
    if (!desk.isOnline) return { label: t('devices.status.offline'), color: 'text-zinc-500' };
    if (desk.isOccupied) return { label: t('desks.stats.occupied'), color: 'text-indigo-600' };
    if (desk.currentReservation) return { label: t('desks.stats.reserved'), color: 'text-sky-600' };
    return { label: t('desks.stats.free'), color: 'text-emerald-600' };
  };

  const { label, color } = statusLabel();
  const canBook = desk.isOnline && !desk.isOccupied && desk.status === 'ACTIVE';
  const isStaff = ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'].includes(userRole);

  const px = desk.posX ?? 50;
  const py = desk.posY ?? 50;
  const popupStyle: React.CSSProperties = px > 55
    ? { top: `${py}%`, right: `${100 - px + 2}%`, transform: 'translateY(-50%)' }
    : { top: `${py}%`, left: `${px + 2}%`, transform: 'translateY(-50%)' };

  return (
    <div className="absolute z-30 bg-white rounded-2xl shadow-2xl border border-zinc-200 p-4 w-60"
      style={popupStyle}
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
          {[desk.zone, desk.floor && `Piętro ${desk.floor}`].filter(Boolean).join(' · ')}
        </p>
      )}

      {canBook && onReserve && (
        <button onClick={onReserve}
          className="w-full py-2 rounded-xl bg-[#B53578] text-white text-xs font-semibold hover:bg-[#9d2d67] transition-colors">
          + {t('deskcard.book')}
        </button>
      )}
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────
function Legend() {
  const { t } = useTranslation();
  const items = [
    { color: '#10b981', label: t('dashboard.legend.free') },
    { color: '#0ea5e9', label: t('dashboard.legend.reserved') },
    { color: '#6366f1', label: t('dashboard.legend.occupied') },
    { color: '#a1a1aa', label: t('dashboard.legend.offline') },
  ];
  return (
    <div className="flex flex-wrap gap-4 mt-3">
      {items.map(item => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span className="w-3 h-3 rounded-full" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

// ── Main FloorPlanView ────────────────────────────────────────
export function FloorPlanView({ locationId, desks, userRole, onReserve }: Props) {
  const { t }              = useTranslation();
  const [floorPlan, setFP] = useState<any>(null);
  const [loading,   setL]  = useState(true);
  const [selected,  setSel]= useState<DeskMapItem | null>(null);
  const [freeOnly,  setFO] = useState(false);

  const isStaff = ['SUPER_ADMIN','OFFICE_ADMIN','STAFF'].includes(userRole);

  useEffect(() => {
    appApi.locations.floorPlan.get(locationId)
      .then(fp => { if (fp?.floorPlanUrl) setFP(fp); })
      .catch(() => {})
      .finally(() => setL(false));
  }, [locationId]);

  const canvasW = floorPlan?.floorPlanW ?? 1200;
  const canvasH = floorPlan?.floorPlanH ?? 800;

  // Tylko biurka z pozycją
  const placedDesks = useMemo(() =>
    desks.filter(d =>
      d.posX != null && d.posY != null &&
      (!freeOnly || (!d.isOccupied && !d.currentReservation && d.isOnline))
    ), [desks, freeOnly]);

  if (loading) return (
    <div className="flex justify-center py-8">
      <div className="w-5 h-5 border-2 border-zinc-200 border-t-[#B53578] rounded-full animate-spin" />
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
      {/* Filter */}
      <div className="flex items-center gap-3 mb-3">
        <button onClick={() => setFO(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
            freeOnly
              ? 'bg-emerald-500 text-white border-emerald-500'
              : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
          }`}>
          {freeOnly ? '✓' : ''} {t('floorplan.view.free_only')}
        </button>
        <span className="text-xs text-zinc-400">
          {placedDesks.length} {t('floorplan.view.desks_visible')}
        </span>
      </div>

      {/* SVG canvas */}
      <div className="relative bg-zinc-100 rounded-xl overflow-auto border border-zinc-200"
        style={{ maxHeight: '65vh' }}
        onClick={() => setSel(null)}>
        <svg
          width={canvasW}
          height={canvasH}
          viewBox={`0 0 ${canvasW} ${canvasH}`}
          style={{ display: 'block', background: '#fafafa', maxWidth: '100%', height: 'auto' }}
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
              onClick={d => setSel(d)}
            />
          ))}
        </svg>

        {/* Popup */}
        {selected && (
          <DeskInfoCard
            desk={selected}
            onClose={() => setSel(null)}
            onReserve={onReserve ? () => { const d = selected; setSel(null); onReserve(d); } : undefined}
            userRole={userRole}
          />
        )}
      </div>

      <Legend />
    </div>
  );
}
