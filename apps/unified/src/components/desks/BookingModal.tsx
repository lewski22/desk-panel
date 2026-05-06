/**
 * BookingModal — Sprint E2 + ROOM-FIX (0.17.7)
 * Modal rezerwacji sali konferencyjnej / parkingu
 * - HOURLY: sloty 30-min z siatką wyboru
 * - ALL_DAY: jeden slot "cały dzień" dla parkingów
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi }          from '../../api/client';
import { Modal, Btn }      from '../ui';
import { CharCount }       from '../ui/CharCount';
import { localDateStr, localDateTimeISO } from '../../utils/date';

interface Props {
  resource:     any;
  onClose:      () => void;
  onBooked:     () => void;
  initialDate?: string;
  presetNow?:   boolean;
}

function roundToNext30(date: Date): string | null {
  const totalMin = date.getHours() * 60 + date.getMinutes();
  const rounded  = Math.ceil(totalMin / 30) * 30;
  if (rounded >= 24 * 60) return null; // past midnight — no valid slot today
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
}

export function BookingModal({ resource, onClose, onBooked, initialDate, presetNow }: Props) {
  const { t }                     = useTranslation();
  const [date, setDate]           = useState(initialDate ?? localDateStr());
  const [avail, setAvail]         = useState<any>(null);
  const [loading, setLoading]     = useState(false);
  const [startTime, setStartTime] = useState<string | null>(() => presetNow ? roundToNext30(new Date()) : null);
  const presetDate = useMemo(() => initialDate ?? localDateStr(), [initialDate]);
  const [endTime,   setEndTime]   = useState<string | null>(null);
  const [notes,     setNotes]     = useState('');
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [usersList, setUsersList]       = useState<any[]>([]);

  const userRole = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('app_user') ?? 'null')?.role ?? ''; } catch { return ''; }
  }, []);
  const isAdmin = ['OFFICE_ADMIN', 'SUPER_ADMIN'].includes(userRole);

  useEffect(() => {
    if (!isAdmin) return;
    appApi.users.list().then(setUsersList).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    setLoading(true);
    // Reset selection on date change; preserve presetNow only on the initial date
    if (!presetNow || date !== presetDate) {
      setStartTime(null);
      setEndTime(null);
    }
    appApi.resources.availability(resource.id, date)
      .then(setAvail)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [resource.id, date]);

  const handleSlotClick = (time: string, available: boolean) => {
    if (!available) return;
    if (!startTime || endTime) {
      setStartTime(time); setEndTime(null);
    } else {
      if (time <= startTime) { setStartTime(time); setEndTime(null); return; }
      setEndTime(time);
    }
  };

  const selectedSlots = useMemo(() => {
    if (!startTime || !avail?.slots) return new Set<string>();
    const s = new Set<string>();
    let capturing = false;
    for (const slot of avail.slots) {
      if (slot.time === startTime) capturing = true;
      if (capturing) {
        s.add(slot.time);
        if (endTime && slot.time === endTime) break;
      }
    }
    return s;
  }, [startTime, endTime, avail?.slots]);

  const endTimeDisplay = useMemo(() => {
    if (!endTime) return null;
    const [eh, em] = endTime.split(':').map(Number);
    const total = eh * 60 + em + 30;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }, [endTime]);

  const handleBook = async () => {
    setSaving(true); setErr(null);
    try {
      if (avail?.allDayMode) {
        await appApi.resources.book(resource.id, {
          date,
          startTime: localDateTimeISO(date, '00:00'),
          endTime:   localDateTimeISO(date, '23:59'),
          allDay:    true,
          notes,
          ...(targetUserId ? { targetUserId } : {}),
        });
      } else {
        if (!startTime || !endTime) { setSaving(false); return; }
        const [eh, em] = endTime.split(':').map(Number);
        const endMinutes = eh * 60 + em + 30;
        const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0');
        const endM = String(endMinutes % 60).padStart(2, '0');
        await appApi.resources.book(resource.id, {
          date,
          startTime: localDateTimeISO(date, startTime),
          endTime:   localDateTimeISO(date, `${endH}:${endM}`),
          notes,
          ...(targetUserId ? { targetUserId } : {}),
        });
      }
      onBooked();
    } catch (e: any) {
      setErr(e.message ?? t('common.error'));
    }
    setSaving(false);
  };

  const durationMin = useMemo(() => {
    if (!startTime || !endTime) return 0;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    return (eh * 60 + em + 30) - (sh * 60 + sm);
  }, [startTime, endTime]);

  return (
    <Modal title={`${t('resource.book')} — ${resource.name}`} onClose={onClose} wide>
      <div className="space-y-4">
        {/* Date picker */}
        <div>
          <label className="block text-xs text-zinc-500 font-medium mb-1">{t('reservations.filter.date')}</label>
          <input type="date" value={date} min={localDateStr()}
            onChange={e => setDate(e.target.value)}
            className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
        </div>

        {/* Slots / ALL_DAY */}
        <div>
          {!avail?.allDayMode && (
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-zinc-500 font-medium">{t('resource.select_time')}</label>
              {startTime && !endTime && (
                <p className="text-xs text-brand">{t('resource.select_end')}</p>
              )}
              {startTime && endTime && (
                <p className="text-xs text-emerald-600 font-semibold">
                  {startTime}–{endTime} (+30m) · {durationMin} min
                </p>
              )}
            </div>
          )}

          {/* Working hours info */}
          {avail && !avail.allDayMode && (avail.openTime || avail.closeTime) && (
            <p className="text-xs text-zinc-400 text-center mb-2">
              {t('resource.working_hours', 'Godziny pracy')}: {avail.openTime ?? '08:00'} – {avail.closeTime ?? '18:00'}
            </p>
          )}

          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-4 h-4 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" />
            </div>
          ) : avail?.allDayMode ? (
            <div className="rounded-xl border border-zinc-200 p-4 text-center">
              {avail.available ? (
                <>
                  <p className="text-emerald-600 font-semibold text-sm mb-1">
                    {t('resource.allday_free', 'Miejsce dostępne na cały dzień')}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {t('resource.allday_hint', 'Rezerwacja obejmuje cały dzień roboczy.')}
                  </p>
                </>
              ) : (
                <p className="text-red-500 font-semibold text-sm">
                  {t('resource.allday_taken', 'Miejsce zajęte na ten dzień')}
                  {avail.currentBooking?.user?.firstName
                    ? ` — ${avail.currentBooking.user.firstName} ${avail.currentBooking.user.lastName ?? ''}`
                    : ''}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-64 overflow-y-auto pr-1">
                {(avail?.slots ?? []).map((slot: any) => {
                  const isSel   = selectedSlots.has(slot.time);
                  const isStart = slot.time === startTime;
                  const isEnd   = slot.time === endTime;
                  return (
                    <button
                      key={slot.time}
                      disabled={!slot.available}
                      onClick={() => handleSlotClick(slot.time, slot.available)}
                      className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center ${
                        !slot.available
                          ? 'bg-red-50 text-red-300 border border-red-100 cursor-not-allowed'
                          : isStart || isEnd
                          ? 'bg-brand text-white border-brand shadow-sm'
                          : isSel
                          ? 'bg-brand/20 text-brand border-brand/30'
                          : 'bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300'
                      }`}
                    >
                      {slot.time}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-zinc-400 mt-2">
                <span className="inline-block w-3 h-3 rounded bg-zinc-50 border border-zinc-200 mr-1" />{t('resource.legend.free')}
                <span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-100 ml-3 mr-1" />{t('resource.legend.taken')}
              </p>

              {/* Visual range label */}
              {startTime && (
                <p className="text-sm text-zinc-600 text-center py-2">
                  {endTime
                    ? `📅 ${startTime} → ${endTimeDisplay}`
                    : `⏱ ${t('resource.select_end_hint', 'Wybierz koniec: od')} ${startTime}…`
                  }
                </p>
              )}
            </>
          )}
        </div>

        {/* Notes */}
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <label className="block text-xs text-zinc-500 font-medium">{t('resource.notes')}</label>
            <CharCount value={notes} max={200} />
          </div>
          <textarea value={notes} onChange={e => setNotes(e.target.value.slice(0, 200))} rows={2}
            placeholder={t('resource.notes_placeholder')}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/30" />
        </div>

        {/* Book on behalf of (admin only) */}
        {isAdmin && usersList.length > 0 && (
          <div>
            <label className="block text-xs text-zinc-500 font-medium mb-1">
              {t('rooms.book_for', 'Rezerwuj dla:')}
            </label>
            <select
              value={targetUserId ?? ''}
              onChange={e => setTargetUserId(e.target.value || null)}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="">{t('rooms.book_for_self', 'Siebie (domyślnie)')}</option>
              {usersList.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} — {u.email}
                </option>
              ))}
            </select>
          </div>
        )}

        {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="secondary" onClick={onClose}>{t('btn.cancel')}</Btn>
          {avail?.allDayMode
            ? avail?.available && (
                <Btn onClick={handleBook} loading={saving}>
                  {t('resource.book_allday', 'Zarezerwuj cały dzień')}
                </Btn>
              )
            : (
                <Btn onClick={handleBook} loading={saving} disabled={!startTime || !endTime}>
                  {t('resource.confirm_book')}
                </Btn>
              )
          }
        </div>
      </div>
    </Modal>
  );
}
