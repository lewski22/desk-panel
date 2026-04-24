/**
 * ResourceCard — Sprint E2
 * Karta sali konferencyjnej, miejsca parkingowego lub sprzętu
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const TYPE_META: Record<string, { icon: string; color: string }> = {
  ROOM:      { icon: '🏛',  color: 'bg-violet-50 border-violet-200' },
  PARKING:   { icon: '🅿️',  color: 'bg-sky-50 border-sky-200'      },
  EQUIPMENT: { icon: '🔧',  color: 'bg-amber-50 border-amber-200'   },
};

const AMENITY_ICONS: Record<string, string> = {
  TV:         '📺', whiteboard: '📋', videoconf: '📹',
  projector:  '📽', phone:      '📞', ac:        '❄️',
};

interface Props {
  resource: any;
  onBook?:  (resource: any) => void;
  compact?: boolean;
}

export function ResourceCard({ resource, onBook, compact = false }: Props) {
  const { t } = useTranslation();
  const meta = TYPE_META[resource.type] ?? TYPE_META.ROOM;
  const isActive  = resource.status === 'ACTIVE';
  const isOccupied = isActive && !!resource.currentBooking;

  const statusBadge = !isActive
    ? { cls: 'bg-zinc-100 text-zinc-500',      label: t('resource.status.inactive') }
    : isOccupied
    ? { cls: 'bg-red-100 text-red-700',         label: t('resource.status.occupied')  }
    : { cls: 'bg-emerald-100 text-emerald-700', label: t('resource.status.free')      };

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2.5 transition-all hover:shadow-md ${meta.color} ${!isActive ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{meta.icon}</span>
          <div>
            <p className="font-semibold text-zinc-800 text-sm">{resource.name}</p>
            <p className="text-xs text-zinc-400 font-mono">{resource.code}</p>
          </div>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge.cls}`}>
          {statusBadge.label}
        </span>
      </div>

      {/* Current booking info */}
      {isOccupied && resource.currentBooking && (
        <div className="bg-red-50/80 border border-red-100 rounded-lg px-2.5 py-1.5 text-[11px] text-red-700">
          {resource.currentBooking.user?.firstName
            ? `${resource.currentBooking.user.firstName} ${resource.currentBooking.user.lastName ?? ''}`.trim()
            : t('resource.someone')}
          {' · '}
          {new Date(resource.currentBooking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {'–'}
          {new Date(resource.currentBooking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* Type-specific details */}
      {resource.type === 'ROOM' && resource.capacity && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-600">
          <span>👤</span>
          <span>{t('resource.capacity', { count: resource.capacity })}</span>
        </div>
      )}

      {resource.type === 'PARKING' && resource.vehicleType && (
        <div className="text-xs text-zinc-600 flex items-center gap-1.5">
          <span>{resource.vehicleType === 'car' ? '🚗' : resource.vehicleType === 'moto' ? '🏍' : '🚲'}</span>
          <span>{String(t(`resource.vehicle.${resource.vehicleType}`))}</span>
        </div>
      )}

      {/* Amenities */}
      {resource.amenities?.length > 0 && !compact && (
        <div className="flex flex-wrap gap-1.5">
          {resource.amenities.map((a: string) => (
            <span key={a} className="flex items-center gap-1 text-[10px] bg-white/60 border border-zinc-200/60 px-1.5 py-0.5 rounded-md text-zinc-600">
              {AMENITY_ICONS[a] ?? '•'} {a}
            </span>
          ))}
        </div>
      )}

      {/* Location */}
      {(resource.floor || resource.zone) && (
        <p className="text-xs text-zinc-400">
          {[resource.zone, resource.floor && `${t('deskcard.floor')} ${resource.floor}`].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* Book button */}
      {onBook && isActive && (
        <button
          onClick={() => onBook(resource)}
          className="mt-auto w-full py-2 rounded-xl bg-violet-500 text-white text-xs font-semibold hover:bg-violet-600 transition-colors">
          + {t('resource.book')}
        </button>
      )}
    </div>
  );
}
