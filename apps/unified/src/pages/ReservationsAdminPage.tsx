/**
 * ReservationsAdminPage — Sprint A3
 * - Sortowanie kolumn (czas, biurko, status) z URL state
 * - Bulk actions: Zaznacz + Anuluj zaznaczone
 * - Kontekstowy empty state
 */
import { localDateStr } from '../utils/date';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { Btn, Card, EmptyState, SortHeader, SortState } from '../components/ui';
import { format } from 'date-fns';
import { pl, enUS } from 'date-fns/locale';
import { useSortable } from '../hooks/useSortable';

const STATUS_CLS: Record<string, string> = {
  CONFIRMED: 'bg-emerald-100 text-emerald-700',
  PENDING:   'bg-amber-100  text-amber-700',
  CANCELLED: 'bg-zinc-100   text-zinc-500',
  EXPIRED:   'bg-red-100    text-red-600',
  COMPLETED: 'bg-sky-100    text-sky-700',
};

export function ReservationsAdminPage() {
  const { t, i18n }   = useTranslation();
  const dfns           = i18n.language === 'en' ? enUS : pl;
  const { sort, toggle, sortArray } = useSortable('startTime', 'asc');

  const [res, setRes]         = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate]       = useState(localDateStr());
  const [status, setStatus]   = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    const filters: Record<string, string> = { date };
    if (status) filters.status = status;
    setRes(await appApi.reservations.list(filters).catch(() => []));
    setLoading(false);
  }, [date, status]);

  useEffect(() => { load(); }, [load]);

  const cancel = async (id: string) => {
    if (!confirm(t('reservations.confirm_cancel_simple'))) return;
    await appApi.reservations.cancel(id);
    load();
  };

  const checkin = async (r: any) => {
    await appApi.checkins.manual(r.deskId, r.userId, r.id);
    load();
  };

  // ── Bulk cancel ─────────────────────────────────────────────
  const bulkCancel = async () => {
    if (selected.size === 0) return;
    if (!confirm(t('reservations.bulk_cancel_confirm', { count: selected.size }))) return;
    setBulkLoading(true);
    await Promise.all([...selected].map(id => appApi.reservations.cancel(id).catch(() => {})));
    setBulkLoading(false);
    load();
  };

  const toggleSelect = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const toggleAll = () => {
    const cancellable = res.filter(r => ['CONFIRMED','PENDING'].includes(r.status)).map(r => r.id);
    setSelected(prev => prev.size === cancellable.length ? new Set() : new Set(cancellable));
  };

  // ── Sorted list ──────────────────────────────────────────────
  const sorted = useMemo(() => sortArray(res, item => {
    if (sort.field === 'desk')   return item.desk?.name ?? '';
    if (sort.field === 'user')   return `${item.user?.firstName ?? ''} ${item.user?.lastName ?? ''}`;
    if (sort.field === 'status') return item.status;
    return item.startTime;
  }), [res, sort, sortArray]);

  const statuses = ['CONFIRMED','PENDING','CANCELLED','EXPIRED','COMPLETED'];
  const cancellable = res.filter(r => ['CONFIRMED','PENDING'].includes(r.status));
  const allSelected = cancellable.length > 0 && selected.size === cancellable.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-zinc-800">{t('pages.reservationsAdmin.title')}</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-end">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">{t('reservations.filter.date')}</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">{t('reservations.filter.status')}</label>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30">
            <option value="">{t('reservations.filter.all')}</option>
            {statuses.map(s => (
              <option key={s} value={s}>{t(`reservations.status.${s.toLowerCase()}`)}</option>
            ))}
          </select>
        </div>
        <button onClick={load} className="px-4 py-2 text-sm rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors">
          ↺ {t('btn.refresh')}
        </button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-5 gap-2 mb-5">
        {statuses.map(s => {
          const count = res.filter(r => r.status === s).length;
          return (
            <button key={s} onClick={() => setStatus(status === s ? '' : s)}
              className={`border rounded-xl p-3 text-center transition-all ${status === s ? 'border-brand bg-brand/5' : 'border-zinc-100 bg-white hover:border-zinc-200'}`}>
              <p className="text-lg font-bold font-mono text-zinc-700">{count}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5 truncate">{t(`reservations.status.${s.toLowerCase()}`)}</p>
            </button>
          );
        })}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-brand/5 border border-brand/20 rounded-xl">
          <span className="text-sm font-medium text-brand">
            {t('reservations.selected', { count: selected.size })}
          </span>
          <Btn variant="danger" loading={bulkLoading} onClick={bulkCancel}>
            {t('reservations.bulk_cancel', { count: selected.size })}
          </Btn>
          <button onClick={() => setSelected(new Set())}
            className="text-xs text-zinc-500 hover:text-zinc-700 ml-auto">
            {t('btn.cancel_selection')}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon="📋"
          title={t('reservations.none_filters')}
          sub={t('reservations.none_filters_sub')}
          action={
            <button onClick={() => setStatus('')}
              className="text-sm text-brand underline mt-2">{t('reservations.show_all')}</button>
          }
        />
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-none sm:rounded-xl border-y sm:border border-zinc-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                {/* Bulk checkbox */}
                <th className="py-2.5 px-3 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="rounded border-zinc-300 text-brand focus:ring-brand/20 cursor-pointer" />
                </th>
                <SortHeader field="startTime" sort={sort} onToggle={toggle}
                  className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  {t('reservations.table.time')}
                </SortHeader>
                <SortHeader field="desk" sort={sort} onToggle={toggle}
                  className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  {t('reservations.table.desk')} / {t('reservations.table.user')}
                </SortHeader>
                <SortHeader field="status" sort={sort} onToggle={toggle}
                  className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  {t('reservations.table.status')}
                </SortHeader>
                <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider hidden sm:table-cell">
                  {t('reservations.table.checkin')}
                </th>
                <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  {t('reservations.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const cls = STATUS_CLS[r.status] ?? STATUS_CLS.PENDING;
                const isCancellable = ['CONFIRMED','PENDING'].includes(r.status);
                const isSelected    = selected.has(r.id);
                return (
                  <tr key={r.id}
                    className={`border-b border-zinc-50 group transition-colors ${isSelected ? 'bg-brand/5' : 'hover:bg-zinc-50/60'}`}>
                    <td className="py-3 px-3">
                      {isCancellable && (
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(r.id)}
                          className="rounded border-zinc-300 text-brand focus:ring-brand/20 cursor-pointer" />
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-zinc-600 whitespace-nowrap">
                      {format(new Date(r.startTime), 'HH:mm')}–{format(new Date(r.endTime), 'HH:mm')}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-zinc-800">{r.desk?.name ?? r.deskId}</p>
                      <p className="text-xs text-zinc-400">{r.user?.firstName} {r.user?.lastName}</p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
                          {t(`reservations.status.${r.status.toLowerCase()}`)}
                        </span>
                        {/* FEATURE P4-B1: amber badge for non-standard reservation types */}
                        {r.reservationType && r.reservationType !== 'STANDARD' && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                            {t(`desks.reserve.type.${r.reservationType}`, r.reservationType)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-zinc-500 hidden sm:table-cell">
                      {r.checkin ? (
                        <div className="space-y-0.5">
                          <p className="font-medium text-zinc-700">{format(new Date(r.checkin.checkedInAt), 'HH:mm')}</p>
                          <p className="text-zinc-400">{String(t(`reservations.method.${r.checkin.method.toLowerCase()}`, r.checkin.method))}</p>
                        </div>
                      ) : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {r.status === 'CONFIRMED' && !r.checkin && (
                          <button onClick={() => checkin(r)}
                            className="text-xs px-2 py-1.5 sm:py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors font-medium">
                            Check-in
                          </button>
                        )}
                        {isCancellable && (
                          <button onClick={() => cancel(r.id)}
                            className="text-xs px-2 py-1.5 sm:py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                            {t('reservations.cancel')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
