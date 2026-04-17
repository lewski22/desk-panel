/**
 * FloorPlanEditor — główny wrapper edytora floor plan
 * Sprint D2e
 * - Łączy Canvas + Toolbar + UnplacedPanel
 * - Obsługuje keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z, R)
 * - Batch save do API
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation }    from 'react-i18next';
import { DeskMapItem }        from '../../types';
import { useFloorPlanEditor } from './useFloorPlanEditor';
import { FloorPlanCanvas }    from './FloorPlanCanvas';
import { FloorPlanToolbar }   from './FloorPlanToolbar';
import { UnplacedPanel }      from './UnplacedPanel';
import { appApi }             from '../../api/client';

interface Props {
  locationId: string;
  desks:      DeskMapItem[];
  onSaved?:   () => void;
}

export function FloorPlanEditor({ locationId, desks, onSaved }: Props) {
  const { t }         = useTranslation();
  const [saving,      setSaving]      = useState(false);
  const [saveErr,     setSaveErr]     = useState<string | null>(null);
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [floorPlan,   setFloorPlan]   = useState<any>(null);
  const [fpLoading,   setFpLoading]   = useState(true);

  // Załaduj floor plan metadata
  useEffect(() => {
    appApi.locations.floorPlan.get(locationId)
      .then(setFloorPlan)
      .catch(() => {})
      .finally(() => setFpLoading(false));
  }, [locationId]);

  const {
    state, canUndo, canRedo,
    moveDeskTo, rotateDesk,
    setBackground, removeBackground,
    setZoom, toggleSnap,
    undo, redo, reset, markSaved,
  } = useFloorPlanEditor(desks, floorPlan ?? undefined);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        if (e.key === 'z' &&  e.shiftKey) { e.preventDefault(); redo(); }
        if (e.key === 'y')                { e.preventDefault(); redo(); }
      }
      if (e.key === 'r' && selectedId && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        rotateDesk(selectedId);
      }
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, rotateDesk, selectedId]);

  // Umieść biurko bez pozycji w centrum canvasu
  const handlePlace = useCallback((id: string) => {
    moveDeskTo(id, 50, 50);
    setSelectedId(id);
  }, [moveDeskTo]);

  // Save — batch update pozycji + save floor plan background
  const handleSave = async () => {
    setSaving(true);
    setSaveErr(null);
    try {
      // 1. Zapisz pozycje biurek
      const updates = Object.values(state.positions)
        .filter(p => p.posX != null)
        .map(p => ({ id: p.id, posX: p.posX, posY: p.posY, rotation: p.rotation, width: p.width, height: p.height }));

      if (updates.length > 0) {
        await appApi.desks.batchPositions(updates);
      }

      // 2. Zapisz tło jeśli zostało zmienione
      if (state.background && state.isDirty) {
        await appApi.locations.floorPlan.upload(locationId, {
          floorPlanUrl: state.background,
          floorPlanW:   state.backgroundW,
          floorPlanH:   state.backgroundH,
          gridSize:     state.gridSize,
        });
      } else if (!state.background && floorPlan?.floorPlanUrl) {
        await appApi.locations.floorPlan.delete(locationId);
      }

      markSaved();
      onSaved?.();
    } catch (e: any) {
      setSaveErr(e.message ?? t('floorplan.save_error'));
    }
    setSaving(false);
  };

  const handleDiscard = () => {
    if (state.isDirty && !confirm(t('floorplan.discard_confirm'))) return;
    const orig: Record<string, any> = {};
    for (const d of desks) {
      orig[d.id] = { id: d.id, posX: d.posX ?? null, posY: d.posY ?? null, rotation: d.rotation ?? 0, width: d.width ?? 2, height: d.height ?? 1 };
    }
    reset(orig);
    setSaveErr(null);
  };

  if (fpLoading) return (
    <div className="flex justify-center py-16">
      <div className="w-5 h-5 border-2 border-zinc-200 border-t-[#B53578] rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      {saveErr && (
        <div className="mb-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          ⚠ {saveErr}
        </div>
      )}

      <FloorPlanToolbar
        snapToGrid={state.snapToGrid}
        zoom={state.zoom}
        canUndo={canUndo}
        canRedo={canRedo}
        isDirty={state.isDirty}
        saving={saving}
        hasBackground={!!state.background}
        onToggleSnap={toggleSnap}
        onZoomIn={() => setZoom(state.zoom + 0.25)}
        onZoomOut={() => setZoom(state.zoom - 0.25)}
        onUndo={undo}
        onRedo={redo}
        onSave={handleSave}
        onDiscard={handleDiscard}
        onBackgroundUpload={setBackground}
        onBackgroundRemove={removeBackground}
      />

      <FloorPlanCanvas
        desks={desks}
        positions={state.positions}
        background={state.background}
        backgroundW={state.backgroundW}
        backgroundH={state.backgroundH}
        gridSize={state.gridSize}
        snapToGrid={state.snapToGrid}
        zoom={state.zoom}
        selectedId={selectedId}
        editMode={true}
        onMove={moveDeskTo}
        onRotate={rotateDesk}
        onSelect={setSelectedId}
        onCanvasClick={() => setSelectedId(null)}
      />

      <UnplacedPanel
        desks={desks}
        positions={state.positions}
        onPlace={handlePlace}
      />

      {selectedId && (
        <div className="mt-3 px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-500 flex items-center gap-3">
          <span className="font-semibold text-zinc-700">
            {desks.find(d => d.id === selectedId)?.name ?? selectedId}
          </span>
          <button onClick={() => rotateDesk(selectedId)}
            className="px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors">
            ↻ {t('floorplan.rotate')} (R)
          </button>
          <button onClick={() => setSelectedId(null)} className="ml-auto text-zinc-400 hover:text-zinc-600">✕</button>
        </div>
      )}
    </div>
  );
}
