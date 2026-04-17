/**
 * UnplacedPanel — lista biurek bez pozycji na planie
 * Sprint D2e
 * Pokazuje biurka, które nie zostały jeszcze rozmieszczone.
 * Admin klika biurko → pojawia się w centrum canvasu.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { DeskMapItem } from '../../types';
import { DeskPosition } from './useFloorPlanEditor';

interface Props {
  desks:     DeskMapItem[];
  positions: Record<string, DeskPosition>;
  onPlace:   (id: string) => void;  // umieszcza biurko w centrum
}

export function UnplacedPanel({ desks, positions, onPlace }: Props) {
  const { t } = useTranslation();
  const unplaced = desks.filter(d => positions[d.id]?.posX == null);
  if (unplaced.length === 0) return null;

  return (
    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
      <p className="text-xs font-semibold text-amber-700 mb-2">
        {t('floorplan.unplaced.title', { count: unplaced.length })}
      </p>
      <div className="flex flex-wrap gap-2">
        {unplaced.map(d => (
          <button key={d.id}
            onClick={() => onPlace(d.id)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-amber-200 rounded-lg
              text-xs font-medium text-zinc-700 hover:bg-amber-100 hover:border-amber-300 transition-colors">
            <span className="w-2 h-2 rounded-full bg-zinc-300 shrink-0" />
            {d.name}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-amber-500 mt-2">{t('floorplan.unplaced.hint')}</p>
    </div>
  );
}
