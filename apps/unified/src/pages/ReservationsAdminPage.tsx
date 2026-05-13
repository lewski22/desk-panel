/**
 * ReservationsAdminPage — Sprint A3
 * - Sortowanie kolumn (czas, biurko, status) z URL state
 * - Bulk actions: Zaznacz + Anuluj zaznaczone
 * - Kontekstowy empty state
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { Btn, EmptyState, SortHeader } from '../components/ui';
import { SkeletonCards } from '../components/ui/Skeleton';
import { format } from 'date-fns';
import { pl, enUS } from 'date-fns/locale';
import { useSortable } from '../hooks/useSortable';
import { STATUS_CFG } from '../utils/reservationStatus';

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;


function todayLocal() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
}

function DaySlider({ selected, onChange }: {
  selected: string;
  onChange:  (d: string) => void;
}) {
  const { i18n } = useTranslation();
  const today = todayLocal();

  const days = useMemo(() => {
    const result: string[] = [];
    const base = new Date();
    base.setDate(base.getDate() - 3);
    for (let i = 0; i <= 17; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      result.push(d.toLocaleDateString('sv-SE', { timeZone: TZ }));
    }
    return result;
  }, []);

  const fmt = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00Z');
    return {
      day: d.toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'pl-PL',
        { day: 'numeric', timeZone: TZ }),
      dow: d.toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'pl-PL',
        { weekday: 'short', timeZone: TZ }),
    };
  };

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {days.map(dateStr => {
        const { day, dow } = fmt(dateStr);
        const isToday    = dateStr === today;
        const isSelected = dateStr === selected;
        const isPast     = dateStr < today;
        return (
          <button
            key={dateStr}
            onClick={() => onChange(dateStr)}
            className={`flex-shrink-0 flex flex-col items-center px-3 py-1.5 rounded-xl border
                        text-xs font-medium transition-all min-w-[44px] ${
              isSelected
                ? 'bg-brand text-white border-brand'
                : isPast
                ? 'bg-zinc-50 text-zinc-400 border-zinc-100 hover:border-zinc-200'
                : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <span className={`text-[10px] mb-0.5 ${isSelected ? 'text-white/80' : 'text-zinc-400'}`}>
              {dow}
            </span>
            <span className="leading-none">{day}</span>
            {isToday && !isSelected && (
              <span className="mt-0.5 w-1 h-1 rounded-full bg-brand" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function StatusChips({ counts, selected, onChange }: {
  counts:   Record<string, number>;
  selected: string;
  onChange:  (s: string) => void;
}) {
  const { t } = useTranslation();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => onChange('')}
        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full
                    border text-xs font-medium transition-all ${
          !selected
            ? 'bg-zinc-800 text-white border-zinc-800'
            : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
        }`}
      >
        {t('reservations.filter.all', 'Wszystkie')}
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
          !selected ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-500'
        }`}>
          {total}
        </span>
      </button>

      {Object.entries(STATUS_CFG).map(([s, cfg]) => {
        const count    = counts[s] ?? 0;
        const isActive = selected === s;
        return (
          <button
            key={s}
            onClick={() => onChange(selected === s ? '' : s)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full
                        border text-xs font-medium transition-all ${
              isActive
                ? 'text-white border-transparent'
                : 'bg-white border-zinc-200 hover:border-zinc-300'
            }`}
            style={isActive
              ? { background: cfg.activeBg, borderColor: cfg.activeBg }
              : { color: cfg.text }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: isActive ? 'rgba(255,255,255,0.8)' : cfg.dot }}
            />
            {cfg.label}
            {count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-white/20 text-white' : 'text-zinc-500'
              }`}
              style={!isActive ? { background: cfg.bg } : {}}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

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

  const [activeTab, setActiveTab] = useState<'desks' | 'resources'>('desks');

  const [res, setRes]         = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate]       = useState(todayLocal());
  const [status, setStatus]   = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const [bookings,        setBookings]        = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsErr,     setBookingsErr]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    const filters: Record<string, string> = { date };
    if (status) filters.status = status;
    setRes(await appApi.reservations.list(filters).catch(() => []));
    setLoading(false);
  }, [date, status]);

  const loadBookings = useCallback(async () => {
    setBookingsLoading(true);
    setBookingsErr('');
    setBookings(await appApi.resources.allBookings({ date }).catch(() => []));
    setBookingsLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (activeTab === 'resources') loadBookings(); }, [activeTab, loadBookings]);

  const cancel = async (id: string) => {
    if (!confirm(t('reservations.confirm_cancel_simple'))) return;
    await appApi.reservations.cancel(id);
    load();
  };

  const cancelBooking = async (id: string) => {
    if (!confirm(t('reservations.confirm_cancel_simple'))) return;
    try {
      await appApi.resources.cancelBooking(id);
    } catch (e: any) {
      setBookingsErr(e?.response?.data?.message ?? e.message ?? 'Błąd anulowania');
      return;
    }
    loadBookings();
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

  const cancellable = res.filter(r => ['CONFIRMED','PENDING'].includes(r.status));
  const allSelected = cancellable.length > 0 && selected.size === cancellable.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-zinc-800">{t('pages.reservationsAdmin.title')}</h1>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setActiveTab('desks')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
            activeTab === 'desks'
              ? 'bg-brand text-white border-brand'
              : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
          }`}
        >
          🪑 {t('layout.nav.desks', 'Biurka')}
        </button>
        <button
          onClick={() => setActiveTab('resources')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
            activeTab === 'resources'
              ? 'bg-brand text-white border-brand'
              : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
          }`}
        >
          🏛 {t('layout.nav.resources', 'Sale i Parking')}
        </button>
      </div>

      {/* Day slider */}
      <div className="mb-4">
        <DaySlider selected={date} onChange={d => { setDate(d); }} />
      </div>

      {/* ── Resources (Sale/Parking) tab ──────────────────────── */}
      {activeTab === 'resources' && (
        <div>
          {bookingsErr && (
            <div className="mb-3 p-3 rounded-xl bg-red-50 text-red-600 text-sm">{bookingsErr}</div>
          )}
          <div className="flex justify-end mb-3">
            <button
              onClick={loadBookings}
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 transition-colors"
            >
              ↺ {t('btn.refresh')}
            </button>
          </div>
          {bookingsLoading ? (
            <SkeletonCards rows={4} />
          ) : bookings.length === 0 ? (
            <EmptyState icon="🏛" title={t('reservations.none_filters')} sub={t('reservations.none_filters_sub')} />
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-none sm:rounded-xl border-y sm:border border-zinc-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-100">
                  <tr>
                    <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('reservations.table.time', 'Godzina')}</th>
                    <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('resources.resource', 'Zasób')}</th>
                    <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider hidden sm:table-cell">{t('reservations.table.user', 'Użytkownik')}</th>
                    <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider hidden sm:table-cell">{t('desks.location', 'Lokalizacja')}</th>
                    <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('reservations.table.actions', 'Akcje')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(b => {
                    const tz   = b.resource?.location?.timezone ?? TZ;
                    const fmt  = (iso: string) => new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: tz });
                    return (
                      <tr key={b.id} className="border-b border-zinc-50 hover:bg-zinc-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-zinc-600 whitespace-nowrap">
                          {fmt(b.startTime)}–{fmt(b.endTime)}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-zinc-800">
                            {b.resource?.type === 'PARKING' ? '🅿️' : '🏛'} {b.resource?.name ?? '—'}
                          </p>
                          <p className="text-xs text-zinc-400">{b.resource?.code}</p>
                        </td>
                        <td className="py-3 px-4 text-xs text-zinc-500 hidden sm:table-cell">
                          {b.user?.firstName} {b.user?.lastName}
                          {b.user?.email && <p className="text-zinc-400">{b.user.email}</p>}
                        </td>
                        <td className="py-3 px-4 text-xs text-zinc-500 hidden sm:table-cell">
                          {b.resource?.location?.name ?? '—'}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => cancelBooking(b.id)}
                            className="text-xs px-2 py-1.5 sm:py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          >
                            {t('reservations.cancel')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Desks tab ─────────────────────────────────────────── */}
      {activeTab === 'desks' && (<>

      {/* Status chips + refresh */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <StatusChips
          counts={Object.fromEntries(
            ['CONFIRMED','PENDING','COMPLETED','CANCELLED','EXPIRED'].map(s => [
              s,
              res.filter(r => r.status === s).length,
            ])
          )}
          selected={status}
          onChange={setStatus}
        />
        <button
          onClick={load}
          className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 bg-white
                     text-zinc-500 hover:bg-zinc-50 transition-colors flex-shrink-0"
        >
          ↺ {t('btn.refresh')}
        </button>
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
        <SkeletonCards rows={5} />
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
      </>)}
    </div>
  );
}
