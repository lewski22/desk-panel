/**
 * BookingModal — Sprint E2
 * Modal rezerwacji sali konferencyjnej / parkingu
 * - Pobiera wolne sloty (co 30 min 8–20)
 * - Wizualna oś czasu dostępności
 * - Wybór przedziału czasowego
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format }          from 'date-fns';
import { pl, enUS }        from 'date-fns/locale';
import { appApi }          from '../../api/client';
import { Modal, Btn }      from '../ui';
import { localDateStr }    from '../../utils/date';

interface Props {
  resource: any;
  onClose:  () => void;
  onBooked: () => void;
}

export function BookingModal({ resource, onClose, onBooked }: Props) {
  const { t, i18n }   = useTranslation();
  const dfns           = i18n.language === 'en' ? enUS : pl;
  const [date, setDate]           = useState(localDateStr());
  const [avail, setAvail]         = useState<any>(null);
  const [loading, setLoading]     = useState(false);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime,   setEndTime]   = useState<string | null>(null);
  const [notes,     setNotes]     = useState('');
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setStartTime(null); setEndTime(null);
    appApi.resources.availability(resource.id, date)
      .then(setAvail)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [resource.id, date]);

  // Obsługa wyboru przedziału — klik start → klik end
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

  const handleBook = async () => {
    if (!startTime || !endTime) return;
    setSaving(true); setErr(null);
    try {
      // Traktuj godziny jako wall-clock UTC — bez konwersji strefy
      // Sloty na backendzie też są wall-clock UTC (T08:00:00.000Z = "8 rano w biurze")
      const [eh, em] = endTime.split(':').map(Number);
      const endMinutes = eh * 60 + em + 30;
      const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0');
      const endM = String(endMinutes % 60).padStart(2, '0');
      await appApi.resources.book(resource.id, {
        date,
        startTime: `${date}T${startTime}:00.000Z`,
        endTime:   `${date}T${endH}:${endM}:00.000Z`,
        notes,
      });
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

        {/* Slots grid */}
        <div>
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

          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-4 h-4 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-64 overflow-y-auto pr-1">
              {(avail?.slots ?? []).map((slot: any) => {
                const isSel     = selectedSlots.has(slot.time);
                const isStart   = slot.time === startTime;
                const isEnd     = slot.time === endTime;
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
          )}
          <p className="text-[10px] text-zinc-400 mt-2">
            <span className="inline-block w-3 h-3 rounded bg-zinc-50 border border-zinc-200 mr-1" />{t('resource.legend.free')}
            <span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-100 ml-3 mr-1" />{t('resource.legend.taken')}
          </p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs text-zinc-500 font-medium mb-1">{t('resource.notes')}</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder={t('resource.notes_placeholder')}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/30" />
        </div>

        {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="secondary" onClick={onClose}>{t('btn.cancel')}</Btn>
          <Btn onClick={handleBook} loading={saving}
            disabled={!startTime || !endTime}>
            {t('resource.confirm_book')}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
