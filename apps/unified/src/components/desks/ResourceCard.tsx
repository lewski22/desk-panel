/**
 * ResourceCard — Sprint E2 + ROOM-FIX (0.17.7)
 * Karta sali konferencyjnej, miejsca parkingowego lub sprzętu
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, ParkingCircle, Wrench } from 'lucide-react';

const TYPE_META: Record<string, { icon: JSX.Element; color: string }> = {
  ROOM:      { icon: <Monitor size={16} className="text-muted" />,       color: 'bg-white border-border' },
  PARKING:   { icon: <ParkingCircle size={16} className="text-muted" />, color: 'bg-white border-border' },
  EQUIPMENT: { icon: <Wrench size={16} className="text-muted" />,        color: 'bg-white border-border' },
};

const AMENITY_ICONS: Record<string, string> = {
  TV:         '📺', whiteboard: '📋', videoconf: '📹',
  projector:  '📽', phone:      '📞', ac:        '❄️',
  coffee:     '☕', espresso:   '☕', piano:      '🎹',
  xbox:       '🎮', standing:   '🧍', sofa:       '🛋️',
  outdoor:    '🌿', printer:    '🖨️', scanner:    '🖷',
  ethernet:   '🔌',
};

function formatSlotEnd(isoTime: string): string {
  return new Date(isoTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  resource: any;
  onBook?:  (resource: any, mode?: 'now') => void;
  compact?: boolean;
}

export function ResourceCard({ resource, onBook, compact = false }: Props) {
  const { t } = useTranslation();
  const meta = TYPE_META[resource.type] ?? TYPE_META.ROOM;
  const isActive   = resource.status === 'ACTIVE';
  const isOccupied = isActive && !!resource.currentBooking;
  const canBook    = onBook && isActive;

  const statusBadge = !isActive
    ? { cls: 'bg-zinc-100 text-zinc-500',           dot: 'bg-zinc-400',    label: t('resource.status.inactive') }
    : isOccupied
    ? { cls: 'bg-red-100 text-red-700',              dot: 'bg-red-500',     label: t('resource.status.occupied')  }
    : { cls: 'bg-emerald-100 text-emerald-700',      dot: 'bg-emerald-500', label: t('resource.status.free')      };

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2.5 transition-all hover:shadow-sm hover:border-border-m ${meta.color} ${!isActive ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex-shrink-0">{meta.icon}</span>
          <div>
            <p className="font-semibold text-ink text-sm leading-tight">{resource.name}</p>
            <p className="text-xs text-muted font-mono">{resource.code}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusBadge.cls}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusBadge.dot}`} />
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

      {/* Next available / booked-until */}
      {isOccupied && resource.nextAvailableSlot && (
        <p className="text-[11px] text-amber-600 mt-1">
          {t('rooms.next_free', 'Wolna od:')} {resource.nextAvailableSlot}
        </p>
      )}
      {!isOccupied && resource.currentBooking && (
        <p className="text-[11px] text-zinc-400 mt-1">
          {t('rooms.booked_until', 'Zarezerwowana do:')} {formatSlotEnd(resource.currentBooking.endTime)}
        </p>
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
            <span key={a} className="flex items-center gap-1 text-xs bg-surface border border-border px-2 py-0.5 rounded-md text-body">
              {AMENITY_ICONS[a] ?? '•'} {a}
            </span>
          ))}
        </div>
      )}

      {/* Location */}
      {(resource.floor || resource.zone) && (
        <p className="text-xs text-muted">
          {[resource.zone, resource.floor && `${t('deskcard.floor')} ${resource.floor}`].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* Book buttons */}
      {canBook && (
        <div className="flex gap-2 mt-auto">
          {isActive && !resource.currentBooking && (
            <button
              onClick={() => onBook(resource, 'now')}
              className="flex-1 py-2 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand/90 transition-colors">
              {t('rooms.quick_book', 'Teraz')}
            </button>
          )}
          <button
            onClick={() => onBook(resource)}
            className="flex-1 py-2 rounded-xl bg-white border border-border text-body text-xs font-semibold hover:bg-surface transition-colors">
            {t('resource.book')}
          </button>
        </div>
      )}
    </div>
  );
}
