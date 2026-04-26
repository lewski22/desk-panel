/**
 * DeskPin — pin statusu biurka w trybie readonly (FloorPlanView)
 * Sprint D3a
 * Mały element SVG z kolorem statusu, reaguje na kliknięcie
 */
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DeskMapItem } from '../../types';
import { DeskPosition } from './useFloorPlanEditor';

const PIN_FILL: Record<string, string> = {
  free:     '#10b981',  // emerald
  reserved: '#f59e0b',  // amber
  mine:     '#7c3aed',  // violet — moja rezerwacja
  occupied: '#ef4444',  // red
  offline:  '#a1a1aa',  // zinc
};

function deskStatus(d: DeskMapItem, currentUserId?: string): string {
  if (!d.isOnline || d.status === 'MAINTENANCE') return 'offline';
  if (d.isOccupied) return 'occupied';
  if (d.currentReservation) {
    return (currentUserId && d.currentReservation.userId === currentUserId) ? 'mine' : 'reserved';
  }
  return 'free';
}

interface Props {
  desk:          DeskMapItem;
  pos:           DeskPosition;
  canvasW:       number;
  canvasH:       number;
  showAvatars:   boolean;  // STAFF+ widzi inicjały
  currentUserId?: string;
  onClick:       (desk: DeskMapItem, rect: DOMRect | null) => void;
}

export function DeskPin({ desk, pos, canvasW, canvasH, showAvatars, currentUserId, onClick }: Props) {
  const { t }     = useTranslation();
  const [hover, setHover] = useState(false);
  const gRef = useRef<SVGGElement>(null);
  const status = deskStatus(desk, currentUserId);
  const fill   = PIN_FILL[status] ?? PIN_FILL.offline;

  const cx = (pos.posX / 100) * canvasW;
  const cy = (pos.posY / 100) * canvasH;
  const r  = hover ? 14 : 11;

  return (
    <g
      ref={gRef}
      transform={`translate(${cx}, ${cy})`}
      style={{ cursor: 'pointer' }}
      onClick={e => { e.stopPropagation(); onClick(desk, gRef.current?.getBoundingClientRect() ?? null); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Pulsująca animacja dla wolnych biurek i własnych rezerwacji */}
      {(status === 'free' || status === 'mine') && (
        <circle r={18} fill={fill} opacity={0.15}>
          <animate attributeName="r"    values="12;20;12" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.2;0;0.2" dur="2s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Główny okrąg */}
      <circle r={r} fill={fill} opacity={status === 'offline' ? 0.5 : 1}
        stroke="white" strokeWidth={2} style={{ transition: 'r 0.15s' }} />

      {/* Inicjały (STAFF+) lub kod */}
      <text textAnchor="middle" dominantBaseline="central"
        fontSize={9} fontWeight="700" fill="white"
        style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {showAvatars && desk.currentCheckin?.user
          ? `${desk.currentCheckin.user.firstName?.[0] ?? ''}${desk.currentCheckin.user.lastName?.[0] ?? ''}`
          : desk.code.split('-').pop()?.slice(0, 3) ?? desk.code.slice(0, 3)}
      </text>

      {/* Tooltip przy hover */}
      {hover && (
        <g transform="translate(16, -36)">
          <rect x={0} y={0} width={90} height={desk.floor ? 38 : 30} rx={4} fill="#18181b" opacity={0.9} />
          <text x={8} y={12} fontSize={9} fontWeight="600" fill="white"
            style={{ pointerEvents: 'none' }}>{desk.name}</text>
          {desk.floor && (
            <text x={8} y={22} fontSize={8} fill="#d4d4d8"
              style={{ pointerEvents: 'none' }}>
              {t('deskcard.floor')} {desk.floor}{desk.zone ? ` · ${desk.zone}` : ''}
            </text>
          )}
          <text x={8} y={desk.floor ? 33 : 23} fontSize={8} fill="#a1a1aa"
            style={{ pointerEvents: 'none' }}>
            {status === 'free' ? t('desks.stats.free') : status === 'occupied' ? t('desks.stats.occupied') : status === 'reserved' ? t('desks.stats.reserved') : t('devices.status.offline')}
          </text>
        </g>
      )}
    </g>
  );
}
