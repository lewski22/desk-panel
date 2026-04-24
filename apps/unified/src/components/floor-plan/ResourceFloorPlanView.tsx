import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi }         from '../../api/client';

interface Resource {
  id: string; name: string; type: string; status: string;
  posX?: number | null; posY?: number | null;
  floor?: string | null; zone?: string | null;
  capacity?: number | null;
}

interface Props {
  locationId: string;
  resources:  Resource[];
  onBook:     (r: Resource) => void;
}

// ── Resource pin (SVG) ────────────────────────────────────────
function ResourcePin({ res, canvasW, canvasH, onClick }: {
  res: Resource & { currentBooking?: any }; canvasW: number; canvasH: number; onClick: (r: Resource) => void;
}) {
  const [hover, setHover] = useState(false);
  const fill = res.status !== 'ACTIVE' ? '#a1a1aa' : res.currentBooking ? '#ef4444' : '#10b981';
  const cx   = ((res.posX ?? 50) / 100) * canvasW;
  const cy   = ((res.posY ?? 50) / 100) * canvasH;
  const r    = hover ? 14 : 11;
  const label = res.name.slice(0, 3);

  return (
    <g transform={`translate(${cx}, ${cy})`} style={{ cursor: 'pointer' }}
      onClick={e => { e.stopPropagation(); onClick(res); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}>
      <circle r={r} fill={fill} stroke="white" strokeWidth={2}
        style={{ transition: 'r 0.15s' }} />
      <text textAnchor="middle" dominantBaseline="central"
        fontSize={9} fontWeight="700" fill="white"
        style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {label}
      </text>
      {hover && (
        <g transform="translate(16, -28)">
          <rect x={0} y={0} width={88} height={20} rx={4} fill="#18181b" opacity={0.9} />
          <text x={8} y={13} fontSize={9} fontWeight="600" fill="white"
            style={{ pointerEvents: 'none' }}>{res.name}</text>
        </g>
      )}
    </g>
  );
}

// ── Info popup ────────────────────────────────────────────────
function ResourceInfoCard({ res, style, onClose, onBook }: {
  res: Resource; style: React.CSSProperties;
  onClose: () => void; onBook: () => void;
}) {
  const { t } = useTranslation();
  const isActive   = res.status === 'ACTIVE';
  const isOccupied = isActive && !!res.currentBooking;

  return (
    <div className="absolute z-30 bg-white rounded-2xl shadow-2xl border border-zinc-200 p-4 w-56"
      style={style} onClick={e => e.stopPropagation()}>
      <div className="flex items-start justify-between mb-2">
        <p className="font-semibold text-zinc-800 text-sm">{res.name}</p>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-0.5">✕</button>
      </div>
      <p className="text-xs text-zinc-400 mb-1">
        {t(`resource.type.${res.type}`, res.type)}
        {res.capacity ? ` · ${res.capacity} ${t('resource.seats', 'os.')}` : ''}
      </p>
      {res.zone && <p className="text-xs text-zinc-400 mb-2">{res.zone}</p>}
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
        !isActive   ? 'bg-zinc-100 text-zinc-500'     :
        isOccupied  ? 'bg-red-100 text-red-700'        :
                      'bg-emerald-50 text-emerald-600'
      }`}>
        {!isActive  ? t('resource.status.inactive') :
         isOccupied ? t('resource.status.occupied')  :
                      t('resource.status.free')}
      </span>
      {isOccupied && res.currentBooking && (
        <p className="text-[11px] text-red-600 mt-1">
          {res.currentBooking.user?.firstName
            ? `${res.currentBooking.user.firstName} ${res.currentBooking.user.lastName ?? ''}`.trim()
            : t('resource.someone')}
          {' '}
          {new Date(res.currentBooking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {'–'}
          {new Date(res.currentBooking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
      {isActive && (
        <button onClick={onBook}
          className="mt-3 w-full bg-brand hover:bg-brand-hover text-white text-xs font-semibold
            py-2 rounded-xl transition-colors">
          + {t('resource.book')}
        </button>
      )}
    </div>
  );
}

// ── Floor tabs ────────────────────────────────────────────────
function FloorTabs({ floors, active, onChange }: {
  floors: string[]; active: string; onChange: (f: string) => void;
}) {
  const { t } = useTranslation();
  if (floors.length <= 1) return null;
  return (
    <div className="flex gap-1 mb-3 overflow-x-auto pb-0.5">
      {floors.map(f => (
        <button key={f} onClick={() => onChange(f)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
            active === f
              ? 'bg-brand text-white border-brand'
              : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
          }`}>
          {t('floorplan.view.floor_prefix', 'Piętro')} {f}
        </button>
      ))}
    </div>
  );
}

// ── Popup position ────────────────────────────────────────────
function popupStyle(posX: number, posY: number, containerW: number, canvasW: number, canvasH: number): React.CSSProperties {
  const svgW = Math.min(canvasW, containerW);
  const svgH = svgW * canvasH / canvasW;
  const xPx  = (posX / 100) * svgW;
  const yPx  = (posY / 100) * svgH;
  return posX > 55
    ? { top: yPx, right: containerW - xPx + 8, transform: 'translateY(-50%)' }
    : { top: yPx, left: xPx + 8, transform: 'translateY(-50%)' };
}

// ── Main component ────────────────────────────────────────────
export function ResourceFloorPlanView({ locationId, resources, onBook }: Props) {
  const { t }                     = useTranslation();
  const [floorPlan, setFP]        = useState<any>(null);
  const [loading,   setL]         = useState(true);
  const [selected,  setSel]       = useState<Resource | null>(null);
  const [floors,    setFloors]    = useState<string[]>([]);
  const [activeFloor, setAF]      = useState('');
  const containerRef              = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const derived = [...new Set(resources.map(r => r.floor).filter(Boolean) as string[])].sort();
    setFloors(derived);
    if (derived.length > 0 && !activeFloor) setAF(derived[0]);
  }, [resources]);

  useEffect(() => {
    setL(true);
    appApi.locations.floorPlan.get(locationId, activeFloor || undefined)
      .then(fp => setFP(fp?.floorPlanUrl ? fp : null))
      .catch(() => setFP(null))
      .finally(() => setL(false));
  }, [locationId, activeFloor]);

  const canvasW = floorPlan?.floorPlanW ?? 1200;
  const canvasH = floorPlan?.floorPlanH ?? 800;

  const placed = useMemo(() =>
    resources.filter(r =>
      r.posX != null && r.posY != null &&
      (floors.length === 0 || !activeFloor || r.floor === activeFloor),
    ), [resources, activeFloor, floors.length]);

  if (loading) return (
    <div className="flex justify-center py-8">
      <div className="w-5 h-5 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" />
    </div>
  );

  if (!floorPlan?.floorPlanUrl) return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-400">
      <span className="text-4xl mb-3">🗺</span>
      <p className="text-sm font-medium">{t('floorplan.view.no_plan')}</p>
      <p className="text-xs mt-1">{t('floorplan.view.no_plan_sub')}</p>
    </div>
  );

  return (
    <div>
      <FloorTabs floors={floors} active={activeFloor} onChange={f => { setAF(f); setSel(null); }} />

      <div ref={containerRef}
        className="relative bg-zinc-100 rounded-xl overflow-auto border border-zinc-200"
        style={{ maxHeight: '65vh' }}
        onClick={() => setSel(null)}>
        <svg
          width={canvasW} height={canvasH}
          viewBox={`0 0 ${canvasW} ${canvasH}`}
          style={{ display: 'block', background: '#fafafa', maxWidth: '100%', height: 'auto' }}>
          <image href={floorPlan.floorPlanUrl} x={0} y={0}
            width={canvasW} height={canvasH} preserveAspectRatio="xMidYMid meet" />
          {placed.map(r => (
            <ResourcePin key={r.id} res={r} canvasW={canvasW} canvasH={canvasH}
              onClick={setSel} />
          ))}
        </svg>

        {selected && containerRef.current && (
          <ResourceInfoCard
            res={selected}
            onClose={() => setSel(null)}
            onBook={() => { const r = selected; setSel(null); onBook(r); }}
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
