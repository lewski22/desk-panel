/**
 * ResourceCard — Sprint E2 + Reserti DS (ROOM-FIX 0.18)
 * Karta sali konferencyjnej, miejsca parkingowego lub sprzętu
 */
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const TYPE_META: Record<string, { icon: string; borderColor: string }> = {
  ROOM:      { icon: 'ti-building-community', borderColor: '#10B981' },
  PARKING:   { icon: 'ti-parking',            borderColor: '#10B981' },
  EQUIPMENT: { icon: 'ti-tool',               borderColor: '#F59E0B' },
};

const AMENITY_ICONS: Record<string, string> = {
  TV:         'ti-device-tv',
  whiteboard: 'ti-writing',
  videoconf:  'ti-video',
  projector:  'ti-device-projector',
  phone:      'ti-phone',
  ac:         'ti-air-conditioning',
  coffee:     'ti-coffee',
  espresso:   'ti-coffee',
  printer:    'ti-printer',
  scanner:    'ti-scan',
  ethernet:   'ti-plug',
  piano:      'ti-music',
  xbox:       'ti-device-gamepad-2',
  standing:   'ti-armchair',
  sofa:       'ti-armchair',
  outdoor:    'ti-trees',
};

const VEHICLE_ICONS: Record<string, string> = {
  car:  'ti-car',
  moto: 'ti-motorbike',
  bike: 'ti-bike',
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

  const currentUserId = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('app_user') ?? 'null')?.id ?? ''; } catch { return ''; }
  }, []);

  const meta             = TYPE_META[resource.type] ?? TYPE_META.ROOM;
  const isActive         = resource.status === 'ACTIVE';
  const isOccupied       = isActive && !!resource.currentBooking;
  const canBook          = !!onBook && isActive;
  const isAssignedToOther = resource.type === 'PARKING'
    && !!resource.assignedUserId
    && resource.assignedUserId !== currentUserId;

  // Border-top color encodes status at a glance
  const topBorderColor = isOccupied
    ? '#EF4444'
    : isAssignedToOther
      ? '#F59E0B'
      : meta.borderColor;

  // Status badge config
  const statusBadge = !isActive
    ? { bg: '#F4F4F5', text: '#71717A', dot: undefined,    label: t('resource.status.inactive') }
    : isOccupied
      ? { bg: '#FEF2F2', text: '#B91C1C', dot: '#EF4444', label: t('resource.status.occupied')  }
      : { bg: '#DCFCE7', text: '#166534', dot: '#16A34A', label: t('resource.status.free')      };

  return (
    <div style={{
      background:   'white',
      border:       '0.5px solid #EDE8FA',
      borderTop:    `3px solid ${topBorderColor}`,
      borderRadius: '0 0 12px 12px',
      padding:      14,
      display:      'flex',
      flexDirection:'column',
      minHeight:    180,
      opacity:      isActive ? 1 : 0.6,
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className={`ti ${meta.icon}`} style={{ fontSize: 15, color: '#6B5F7A', flexShrink: 0 }} />
          <div>
            <p style={{ fontFamily: 'Sora, sans-serif', fontSize: 14, fontWeight: 600, color: '#1A0A2E', margin: 0, lineHeight: 1.2 }}>
              {resource.name}
            </p>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 400, color: '#A898B8', margin: 0 }}>
              {resource.code}
            </p>
          </div>
        </div>

        {/* Status badge — assigned takes priority */}
        {isAssignedToOther ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 20, padding: '3px 8px', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 500, color: '#92400E', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <i className="ti ti-lock" style={{ fontSize: 11 }} /> {t('resource.assigned', 'Przypisane')}
          </span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: statusBadge.bg, borderRadius: 20, padding: '3px 8px', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 500, color: statusBadge.text, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {statusBadge.dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusBadge.dot, flexShrink: 0 }} />}
            {statusBadge.label}
          </span>
        )}
      </div>

      {/* Current booking info bar — keep (red, as per spec §H) */}
      {isOccupied && resource.currentBooking && (
        <div style={{ background: 'rgba(254,242,242,0.8)', border: '0.5px solid #FEE2E2', borderRadius: 6, padding: '6px 9px', fontSize: 11, fontFamily: 'DM Sans, sans-serif', color: '#B91C1C', marginBottom: 8 }}>
          {resource.currentBooking.user?.firstName
            ? `${resource.currentBooking.user.firstName} ${resource.currentBooking.user.lastName ?? ''}`.trim()
            : t('resource.someone')}
          {' · '}
          {new Date(resource.currentBooking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {'–'}
          {new Date(resource.currentBooking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* Metadata zone — min-height 52px */}
      <div style={{ minHeight: 52, display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 6 }}>
        {/* Capacity (ROOM) */}
        {resource.type === 'ROOM' && resource.capacity && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#F8F6FC', border: '0.5px solid #EDE8FA', borderRadius: 6, padding: '3px 7px', fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: '#6B5F7A' }}>
              <i className="ti ti-users" style={{ fontSize: 11 }} />
              {t('resource.capacity', { count: resource.capacity })}
            </span>
          </div>
        )}

        {/* Vehicle type (PARKING) */}
        {resource.type === 'PARKING' && resource.vehicleType && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#F8F6FC', border: '0.5px solid #EDE8FA', borderRadius: 6, padding: '3px 7px', fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: '#6B5F7A' }}>
              <i className={`ti ${VEHICLE_ICONS[resource.vehicleType] ?? 'ti-car'}`} style={{ fontSize: 11 }} />
              {String(t(`resource.vehicle.${resource.vehicleType}`))}
            </span>
          </div>
        )}

        {/* Amenities */}
        {resource.amenities?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {resource.amenities.map((a: string) => (
              <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#F8F6FC', border: '0.5px solid #EDE8FA', borderRadius: 6, padding: '3px 7px', fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: '#6B5F7A' }}>
                {AMENITY_ICONS[a] && <i className={`ti ${AMENITY_ICONS[a]}`} style={{ fontSize: 11 }} />}
                {a}
              </span>
            ))}
          </div>
        )}

        {/* Floor / Zone */}
        {(resource.floor || resource.zone) && (
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: '#A898B8', margin: 0 }}>
            {[resource.zone, resource.floor && `${t('deskcard.floor')} ${resource.floor}`].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {/* Time context bar / Assigned info — hidden in compact */}
      {!compact && (
        isAssignedToOther ? (
          <div style={{ background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 6, padding: '7px 9px', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: '#92400E', marginBottom: 8 }}>
            <i className="ti ti-info-circle" style={{ fontSize: 13, flexShrink: 0 }} />
            {`${t('resource.assigned_to', 'Miejsce przypisane do')} ${resource.assignedUser?.firstName ?? '—'}`}
          </div>
        ) : (
          <div style={{ background: '#F8F6FC', borderRadius: 6, padding: '6px 9px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'DM Sans, sans-serif', fontSize: 11, marginBottom: 8 }}>
            {isOccupied ? (
              <>
                <span style={{ color: '#6B5F7A' }}>{t('rooms.free_from', 'Wolna od')}</span>
                <span style={{ color: '#B45309', fontWeight: 500 }}>{resource.nextAvailableSlot ?? '—'}</span>
              </>
            ) : (
              <>
                <span style={{ color: '#6B5F7A' }}>{t('rooms.available_until', 'Dostępna do')}</span>
                <span style={{ color: '#166534', fontWeight: 500 }}>
                  {resource.nextAvailableSlot
                    ? formatSlotEnd(resource.nextAvailableSlot)
                    : t('rooms.all_day', 'Cały dzień')
                  }
                </span>
              </>
            )}
          </div>
        )
      )}

      {/* CTA buttons — 2-column grid, hidden in compact */}
      {canBook && !compact && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 'auto' }}>
          {/* Button 1 — Teraz (quick book) */}
          {(!isOccupied && !isAssignedToOther) ? (
            <button
              onClick={() => onBook!(resource, 'now')}
              style={{ background: '#B53578', color: '#fff', border: 'none', borderRadius: 8, padding: 9, fontFamily: 'Sora, sans-serif', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
            >
              <i className="ti ti-bolt" style={{ fontSize: 13 }} />
              {t('rooms.quick_book', 'Teraz')}
            </button>
          ) : (
            <button
              disabled
              style={{ background: '#F4F4F5', color: '#A1A1AA', border: 'none', borderRadius: 8, padding: 9, fontFamily: 'Sora, sans-serif', fontSize: 12, fontWeight: 600, cursor: 'not-allowed' }}
            >
              {isAssignedToOther ? t('resource.unavailable', 'Niedostępne') : t('resource.status.occupied')}
            </button>
          )}

          {/* Button 2 — Wybierz slot */}
          {!isAssignedToOther ? (
            <button
              onClick={() => onBook!(resource)}
              style={{ background: 'white', border: '0.5px solid #B53578', color: '#B53578', borderRadius: 8, padding: 9, fontFamily: 'Sora, sans-serif', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              {t('rooms.pick_slot', 'Wybierz slot')}
            </button>
          ) : (
            <button
              disabled
              style={{ background: '#F4F4F5', color: '#A1A1AA', border: 'none', borderRadius: 8, padding: 9, fontFamily: 'Sora, sans-serif', fontSize: 12, fontWeight: 600, cursor: 'not-allowed' }}
            >
              {t('resource.unavailable', 'Niedostępne')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
