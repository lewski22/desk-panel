/**
 * FloorPlanToolbar — pasek narzędzi edytora floor plan
 * Sprint D2d
 * - Upload tła (PNG/SVG, konwertuje do base64)
 * - Snap toggle, Zoom +/-, Undo/Redo
 * - Save / Discard
 */
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn } from '../ui';

interface Props {
  snapToGrid:  boolean;
  zoom:        number;
  canUndo:     boolean;
  canRedo:     boolean;
  isDirty:     boolean;
  saving:      boolean;
  hasBackground: boolean;
  onToggleSnap:  () => void;
  onZoomIn:      () => void;
  onZoomOut:     () => void;
  onUndo:        () => void;
  onRedo:        () => void;
  onSave:        () => void;
  onDiscard:     () => void;
  onBackgroundUpload: (dataUrl: string, w: number, h: number) => void;
  onBackgroundRemove: () => void;
}

export function FloorPlanToolbar({
  snapToGrid, zoom, canUndo, canRedo, isDirty, saving, hasBackground,
  onToggleSnap, onZoomIn, onZoomOut, onUndo, onRedo,
  onSave, onDiscard, onBackgroundUpload, onBackgroundRemove,
}: Props) {
  const { t }    = useTranslation();
  const fileRef  = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_097_152) {
      alert(t('floorplan.toolbar.file_too_large'));
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      // Odczytaj wymiary obrazu
      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => onBackgroundUpload(dataUrl, img.naturalWidth, img.naturalHeight);
        img.src = dataUrl;
      } else {
        onBackgroundUpload(dataUrl, 1200, 800);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const iconBtn = (icon: string, label: string, onClick: () => void, disabled = false, active = false) => (
    <button
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1.5 text-sm rounded-lg transition-all border
        ${active   ? 'bg-brand/10 border-brand/30 text-brand'
        : disabled ? 'opacity-30 cursor-not-allowed border-transparent text-zinc-400'
        :            'border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800'}`}
    >
      {icon}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-white border border-zinc-200 rounded-xl mb-3">

      {/* Plik tła */}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={handleFile} />
      <div className="flex flex-col gap-0.5">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 transition-colors"
          title={t('floorplan.toolbar.upload_bg')}
        >
          🗺 {t('floorplan.toolbar.upload_bg')}
        </button>
        <span className="text-[10px] text-zinc-400 px-1">PNG / JPG / SVG · max 2 MB</span>
      </div>
      {hasBackground && (
        <button onClick={onBackgroundRemove}
          className="text-xs text-red-500 hover:text-red-700 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
          ✕ {t('floorplan.toolbar.remove_bg')}
        </button>
      )}

      <div className="w-px h-6 bg-zinc-200 mx-1" />

      {/* Snap toggle */}
      {iconBtn('⊞', t('floorplan.toolbar.snap'), onToggleSnap, false, snapToGrid)}

      {/* Zoom */}
      <div className="flex items-center gap-1">
        {iconBtn('−', t('floorplan.toolbar.zoom_out'), onZoomOut, zoom <= 0.25)}
        <span className="text-xs text-zinc-500 font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
        {iconBtn('+', t('floorplan.toolbar.zoom_in'), onZoomIn, zoom >= 3)}
      </div>

      <div className="w-px h-6 bg-zinc-200 mx-1" />

      {/* Undo / Redo */}
      {iconBtn('↩', t('floorplan.toolbar.undo'), onUndo, !canUndo)}
      {iconBtn('↪', t('floorplan.toolbar.redo'), onRedo, !canRedo)}

      {/* Skrót klawiaturowy hint */}
      <span className="hidden md:block text-[10px] text-zinc-300 ml-1">Ctrl+Z / Ctrl+Shift+Z | R = obrót</span>

      <div className="flex-1" />

      {/* Save / Discard */}
      {isDirty && (
        <>
          <button onClick={onDiscard}
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors">
            {t('floorplan.toolbar.discard')}
          </button>
          <Btn onClick={onSave} loading={saving} size="sm">
            💾 {t('floorplan.toolbar.save')}
          </Btn>
        </>
      )}
      {!isDirty && (
        <span className="text-xs text-zinc-300 font-medium">
          ✓ {t('floorplan.toolbar.saved')}
        </span>
      )}
    </div>
  );
}
