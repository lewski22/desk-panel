/**
 * DeskToken — przeciągalny element biurka na floor plan canvas
 * Sprint D2b
 * - Drag & Drop przez SVG mouse/touch events (bez bibliotek)
 * - Prawy klik / klawisz R → rotacja
 * - Snap do siatki obsługuje rodzic (reducer)
 */
import React, { useRef, useCallback } from 'react';
import { DeskMapItem } from '../../types';
import { DeskPosition } from './useFloorPlanEditor';

// ── Kolory statusu ─────────────────────────────────────────────
const STATUS_FILL: Record<string, string> = {
  free:      '#d1fae5',  // emerald-100
  reserved:  '#fef3c7',  // amber-100
  occupied:  '#fee2e2',  // red-100
  offline:   '#f4f4f5',  // zinc-100
};
const STATUS_STROKE: Record<string, string> = {
  free:      '#10b981',
  reserved:  '#f59e0b',
  occupied:  '#ef4444',
  offline:   '#a1a1aa',
};

function deskStatus(d: DeskMapItem): string {
  if (!d.isOnline || d.status === 'MAINTENANCE') return 'offline';
  if (d.isOccupied)             return 'occupied';
  if (d.currentReservation)     return 'reserved';
  return 'free';
}

interface Props {
  desk:      DeskMapItem;
  pos:       DeskPosition;
  gridSize:  number;                         // px/unit → oblicza rozmiar tokenu
  canvasW:   number;                         // px — canvas viewport
  canvasH:   number;
  selected:  boolean;
  editMode:  boolean;                        // false = view only (D3)
  onDragEnd: (id: string, pctX: number, pctY: number) => void;
  onRotate:  (id: string) => void;
  onSelect:  (id: string) => void;
}

export function DeskToken({
  desk, pos, gridSize, canvasW, canvasH,
  selected, editMode, onDragEnd, onRotate, onSelect,
}: Props) {
  const dragging = useRef(false);
  const startXY  = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const status = deskStatus(desk);
  const fill   = STATUS_FILL[status]   ?? STATUS_FILL.offline;
  const stroke = STATUS_STROKE[status] ?? STATUS_STROKE.offline;

  // Token size in px
  const tokenW = pos.width  * gridSize;
  const tokenH = pos.height * gridSize;

  // Center of token in px (canvas coordinates)
  const cx = (pos.posX / 100) * canvasW;
  const cy = (pos.posY / 100) * canvasH;

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGGElement>) => {
    if (!editMode) return;
    if (e.button === 2) { e.preventDefault(); onRotate(desk.id); return; }
    e.stopPropagation();
    dragging.current = true;
    startXY.current  = { mx: e.clientX, my: e.clientY, px: cx, py: cy };

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const dx   = ev.clientX - startXY.current.mx;
      const dy   = ev.clientY - startXY.current.my;
      const newX = startXY.current.px + dx;
      const newY = startXY.current.py + dy;
      onDragEnd(desk.id, (newX / canvasW) * 100, (newY / canvasH) * 100);
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [editMode, desk.id, cx, cy, canvasW, canvasH, onDragEnd, onRotate]);

  // Touch support
  const handleTouchStart = useCallback((e: React.TouchEvent<SVGGElement>) => {
    if (!editMode) return;
    e.stopPropagation();
    const touch = e.touches[0];
    dragging.current = true;
    startXY.current  = { mx: touch.clientX, my: touch.clientY, px: cx, py: cy };

    const onMove = (ev: TouchEvent) => {
      if (!dragging.current) return;
      const t  = ev.touches[0];
      const dx = t.clientX - startXY.current.mx;
      const dy = t.clientY - startXY.current.my;
      onDragEnd(desk.id, ((startXY.current.px + dx) / canvasW) * 100, ((startXY.current.py + dy) / canvasH) * 100);
    };
    const onEnd = () => {
      dragging.current = false;
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend',  onEnd);
    };
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend',  onEnd);
  }, [editMode, desk.id, cx, cy, canvasW, canvasH, onDragEnd]);

  const transform = `translate(${cx}, ${cy}) rotate(${pos.rotation})`;

  return (
    <g
      transform={transform}
      style={{ cursor: editMode ? 'grab' : 'pointer', userSelect: 'none' }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onClick={e => { e.stopPropagation(); onSelect(desk.id); }}
      onContextMenu={e => { e.preventDefault(); if (editMode) onRotate(desk.id); }}
    >
      {/* Body */}
      <rect
        x={-tokenW / 2} y={-tokenH / 2}
        width={tokenW} height={tokenH}
        rx={4} ry={4}
        fill={fill}
        stroke={selected ? 'var(--brand)' : stroke}
        strokeWidth={selected ? 2 : 1}
      />

      {/* Status dot */}
      <circle
        cx={tokenW / 2 - 5} cy={-tokenH / 2 + 5}
        r={4}
        fill={stroke}
      />

      {/* Rotation handle (only in edit mode) */}
      {editMode && (
        <circle
          cx={0} cy={-tokenH / 2 - 8}
          r={5}
          fill="var(--brand)"
          opacity={0.7}
          style={{ cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); onRotate(desk.id); }}
        />
      )}

      {/* Code label */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={Math.min(11, tokenW / 3)}
        fontFamily="monospace"
        fontWeight="600"
        fill="#374151"
        style={{ pointerEvents: 'none' }}
      >
        {desk.code}
      </text>

      {/* Floor label — shown when token is tall enough */}
      {desk.floor && tokenH > 28 && (
        <text
          y={-tokenH / 2 + 10}
          textAnchor="middle"
          fontSize={Math.min(8, tokenW / 4)}
          fontFamily="sans-serif"
          fill="#9ca3af"
          style={{ pointerEvents: 'none' }}
        >
          P{desk.floor}
        </text>
      )}

      {/* Ocupant initials — editor only shows name, view shows avatar */}
      {desk.isOccupied && desk.currentCheckin?.user && (
        <text
          y={tokenH / 2 - 8}
          textAnchor="middle"
          fontSize={9}
          fill="#6366f1"
          style={{ pointerEvents: 'none' }}
        >
          {desk.currentCheckin.user.firstName?.[0]}{desk.currentCheckin.user.lastName?.[0]}
        </text>
      )}

      {/* Selection ring */}
      {selected && (
        <rect
          x={-tokenW / 2 - 3} y={-tokenH / 2 - 3}
          width={tokenW + 6} height={tokenH + 6}
          rx={6} ry={6}
          fill="none"
          stroke="var(--brand)"
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />
      )}
    </g>
  );
}
