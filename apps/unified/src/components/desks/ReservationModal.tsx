import { localDateStr, localDateTimeISO } from '../../utils/date';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { DeskMapItem, LocationLimits } from '../../types/index';
import { appApi } from '../../api/client';
import { RecurringToggle, type RecurrenceConfig } from '../reservations/RecurringToggle';

interface Props {
  desk:       DeskMapItem;
  onClose:    () => void;
  onSuccess:  () => void;
  isEndUser?: boolean;
  users?:     any[];
  limits?:    LocationLimits | null;
}

export function ReservationModal({ desk, onClose, onSuccess, isEndUser = true, users = [], limits }: Props) {
  const today   = localDateStr();
  const { t }   = useTranslation();
  const maxDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + (limits?.maxDaysAhead ?? 14));
    return localDateStr(d);
  })();
  const [date,       setDate]      = useState(today);
  const [start,      setStart]     = useState(limits?.openTime  ?? '09:00');
  const [end,        setEnd]       = useState(limits?.closeTime ?? '17:00');
  const [userId,     setUserId]    = useState('');
  const [busy,       setBusy]      = useState(false);
  const [err,        setErr]       = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceConfig>({ enabled: false, rule: '', label: '' });
  const [recurResult, setRecurResult] = useState<any>(null);

  const submit = async () => {
    if (start >= end) { setErr(t('desks.reserve.errors.end_after_start')); return; }
    if (limits) {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      const durH = (eh * 60 + em - sh * 60 - sm) / 60;
      if (durH > limits.maxHoursPerDay) {
        setErr(`Maksymalna długość rezerwacji to ${limits.maxHoursPerDay}h`); return;
      }
      if (date > maxDate) {
        setErr(`Rezerwacja możliwa maksymalnie ${limits.maxDaysAhead} dni do przodu`); return;
      }
    }
    setBusy(true); setErr('');
    try {
      const startISO = localDateTimeISO(date, start);
      const endISO   = localDateTimeISO(date, end);
      const body: any = { deskId: desk.id, date, startTime: startISO, endTime: endISO };
      if (!isEndUser && userId) body.targetUserId = userId;

      if (recurrence.enabled && recurrence.rule) {
        const result = await appApi.reservations.createRecurring({ ...body, recurrenceRule: recurrence.rule });
        if (result.conflicts?.length > 0) {
          setRecurResult(result);
          return;
        }
      } else {
        await appApi.reservations.create(body);
      }
      onSuccess();
    } catch (e: any) { setErr(e.message ?? t('desks.reserve.errors.failed')); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm max-h-[92vh] flex flex-col">
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <span className="w-10 h-1 bg-zinc-300 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 sm:py-4 border-b border-zinc-100 shrink-0">
          <div>
            <p className="font-semibold text-zinc-800">{t('desks.reserve.title')}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{desk.name} · {desk.code}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-xl min-w-touch min-h-touch flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-colors">×</button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto flex-1"
             style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {err && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{err}</div>}

          {!isEndUser && (
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">
                {t('desks.reserve.staff_label')} <span className="text-zinc-300 font-normal">{t('desks.reserve.staff_helper')}</span>
              </label>
              <select value={userId} onChange={e => setUserId(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30">
                <option value="">{t('desks.reserve.for_self')}</option>
                {users.filter((u: any) => u.isActive).map((u: any) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName} · {u.email}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs text-zinc-500 mb-1.5 font-medium">{t('desks.reserve.date')}</label>
            <input type="date" value={date} min={today} max={maxDate} onChange={e => setDate(e.target.value)}
              className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">{t('desks.reserve.from')}</label>
              <input type="time" value={start} onChange={e => setStart(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">{t('desks.reserve.to')}</label>
              <input type="time" value={end} onChange={e => setEnd(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
          </div>

          <p className="text-[11px] text-zinc-400 -mt-1">
            {limits ? t('desks.reserve.open_hours', { open: limits.openTime, close: limits.closeTime, maxHours: limits.maxHoursPerDay, maxDays: limits.maxDaysAhead }) : t('desks.reserve.any_time')}
          </p>

          <div className="border-t border-zinc-100 pt-3">
            <RecurringToggle startDate={date} onChange={setRecurrence} />
          </div>

          {recurResult && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-1">
              <p className="font-semibold text-amber-700">
                ✓ {t('recurring.result_created', { count: recurResult.created?.length ?? 0 })}
              </p>
              {recurResult.conflicts?.length > 0 && (
                <p className="text-amber-600">
                  ⚠ {t('recurring.result_conflicts', { count: recurResult.conflicts.length })}: {recurResult.conflicts.join(', ')}
                </p>
              )}
              <button onClick={onSuccess}
                className="mt-2 w-full py-2 rounded-lg bg-amber-500 text-white font-medium text-xs hover:bg-amber-600 transition-colors">
                {t('recurring.close')}
              </button>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm font-medium transition-colors">
              {t('btn.cancel')}
            </button>
            <button onClick={submit} disabled={busy}
              className="flex-1 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-sm transition-colors disabled:opacity-50">
              {busy
                ? <span className="inline-flex items-center gap-2 justify-center">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('desks.reserve.submitting')}
                  </span>
                : t('desks.reserve.action')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
