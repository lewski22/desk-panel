/**
 * FloorPlanCanvas — SVG viewport z tłem, siatką i tokenami biurek
 * Sprint D2a
 */
import React, { useRef, useCallback } from 'react';
import { DeskMapItem } from '../../types';
import { DeskPosition } from './useFloorPlanEditor';
import { DeskToken } from './DeskToken';

interface Props {
  desks:       DeskMapItem[];
  positions:   Record<string, DeskPosition>;
  background:  string | null;
  backgroundW: number;
  backgroundH: number;
  gridSize:    number;
  snapToGrid:  boolean;
  zoom:        number;
  selectedId:  string | null;
  editMode:    boolean;
  onMove:      (id: string, x: number, y: number) => void;
  onRotate:    (id: string) => void;
  onSelect:    (id: string | null) => void;
  onCanvasClick?: () => void;
}

export function FloorPlanCanvas({
  desks, positions, background, backgroundW, backgroundH,
  gridSize, snapToGrid, zoom, selectedId, editMode,
  onMove, onRotate, onSelect, onCanvasClick,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Oblicz linie siatki
  const gridLines = () => {
    if (!editMode) return null;
    const lines: React.ReactNode[] = [];
    const cols = Math.ceil((backgroundW / gridSize));
    const rows = Math.ceil((backgroundH / gridSize));
    for (let c = 0; c <= cols; c++) {
      const x = (c / cols) * backgroundW;
      lines.push(<line key={`vc-${c}`} x1={x} y1={0} x2={x} y2={backgroundH}
        stroke="#e4e4e7" strokeWidth={0.5} strokeDasharray="2 4" />);
    }
    for (let r = 0; r <= rows; r++) {
      const y = (r / rows) * backgroundH;
      lines.push(<line key={`hr-${r}`} x1={0} y1={y} x2={backgroundW} y2={y}
        stroke="#e4e4e7" strokeWidth={0.5} strokeDasharray="2 4" />);
    }
    return <g opacity={0.6}>{lines}</g>;
  };

  // Desks z pozycjami (posX/posY != null) — rysujemy na canvas
  const placedDesks   = desks.filter(d => positions[d.id]?.posX != null);
  // Desks bez pozycji — boczny panel
  const unplacedDesks = desks.filter(d => positions[d.id]?.posX == null && !editMode === false);

  return (
    <div
      className="relative bg-zinc-100 rounded-xl overflow-auto border border-zinc-200"
      style={{ maxHeight: '70vh' }}
    >
      <svg
        ref={svgRef}
        width={backgroundW * zoom}
        height={backgroundH * zoom}
        viewBox={`0 0 ${backgroundW} ${backgroundH}`}
        style={{ display: 'block', background: '#fafafa', touchAction: 'none' }}
        onClick={() => { onSelect(null); onCanvasClick?.(); }}
      >
        {/* Tło (floor plan image) */}
        {background && (
          <image
            href={background}
            x={0} y={0}
            width={backgroundW} height={backgroundH}
            preserveAspectRatio="xMidYMid meet"
          />
        )}

        {/* Siatka */}
        {snapToGrid && gridLines()}

        {/* Tokeny biurek z pozycjami */}
        {placedDesks.map(desk => {
          const pos = positions[desk.id];
          if (!pos || pos.posX == null) return null;
          return (
            <DeskToken
              key={desk.id}
              desk={desk}
              pos={pos}
              gridSize={gridSize}
              canvasW={backgroundW}
              canvasH={backgroundH}
              selected={selectedId === desk.id}
              editMode={editMode}
              onDragEnd={onMove}
              onRotate={onRotate}
              onSelect={onSelect}
            />
          );
        })}

        {/* Watermark gdy brak tła */}
        {!background && editMode && (
          <text x={backgroundW / 2} y={backgroundH / 2}
            textAnchor="middle" dominantBaseline="central"
            fontSize={14} fill="#d4d4d8" fontFamily="sans-serif">
            Wgraj plan biura (PNG/SVG) w pasku narzędzi
          </text>
        )}
      </svg>
    </div>
  );
}
