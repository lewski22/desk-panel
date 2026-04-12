import { localDateStr } from '../utils/date';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { Btn, Card } from '../components/ui';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

const LOC_ID = import.meta.env.VITE_LOCATION_ID ?? '';

const STATUS_META: Record<string, { cls: string }> = {
  CONFIRMED: { cls: 'bg-emerald-100 text-emerald-700' },
  PENDING:   { cls: 'bg-amber-100  text-amber-700'   },
  CANCELLED: { cls: 'bg-zinc-100   text-zinc-500'    },
  EXPIRED:   { cls: 'bg-red-100    text-red-600'     },
  COMPLETED: { cls: 'bg-sky-100    text-sky-700'     },
};

export function ReservationsAdminPage() {
  const { t, i18n } = useTranslation();
  const [res, setRes]         = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate]       = useState(localDateStr());
  const [status, setStatus]   = useState('');

  const load = async () => {
    setLoading(true);
    const filters: Record<string, string> = { locationId: LOC_ID, date };
    if (status) filters.status = status;
    setRes(await appApi.reservations.list(filters).catch(() => []));
    setLoading(false);
  };

  useEffect(() => { load(); }, [date, status]);

  const cancel = async (id: string) => {
    if (!confirm(t('reservations.confirm_cancel_simple'))) return;
    await appApi.reservations.cancel(id);
    await load();
  };

  const checkin = async (r: any) => {
    await appApi.checkins.manual(r.deskId, r.userId, r.id);
    await load();
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">{t('pages.reservations.title')}</h1>
          <p className="text-xs text-zinc-400 mt-0.5">{t('pages.reservations.sub', { defaultValue: 'Overview and management of reservations' })}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">{t('reservations.filter.date')}</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30" />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">{t('reservations.filter.status')}</label>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30">
            <option value="">{t('reservations.filter.all')}</option>
            {Object.keys(STATUS_META).map(s => <option key={s} value={s}>{t(`reservations.status.${s.toLowerCase()}`)}</option>)}
          </select>
        </div>
        <div className="self-end">
          <Btn variant="secondary" onClick={load}>↻ Odśwież</Btn>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-2 mb-5">
        {Object.keys(STATUS_META).map(s => {
          const m = STATUS_META[s];
          const count = res.filter(r => r.status === s).length;
          return (
            <div key={s} className="bg-white border border-zinc-100 rounded-xl p-3 text-center">
              <p className="text-lg font-bold font-mono text-zinc-700">{count}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{t(`reservations.status.${s.toLowerCase()}`)}</p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-zinc-200 border-t-[#B53578] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-none sm:rounded-xl border-y sm:border border-zinc-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('reservations.table.time')}</th>
                <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('reservations.table.desk')} / {t('reservations.table.user')}</th>
                <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('reservations.table.status')}</th>
                <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider hidden sm:table-cell">{t('reservations.table.checkin')}</th>
                <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('reservations.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {res.map(r => {
                const meta = STATUS_META[r.status] ?? STATUS_META.PENDING;
                return (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/60 group">
                    <td className="py-3 px-4 font-mono text-xs text-zinc-600 whitespace-nowrap">
                      {format(new Date(r.startTime), 'HH:mm')}–{format(new Date(r.endTime), 'HH:mm')}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-zinc-800">{r.desk?.name ?? r.deskId}</p>
                      <p className="text-xs text-zinc-400">{r.user?.firstName} {r.user?.lastName}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.cls}`}>{meta.label}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-zinc-500 hidden sm:table-cell">
                      {r.checkin ? (
                        <div className="space-y-0.5">
                          <p className="font-medium text-zinc-700">
                            {format(new Date(r.checkin.checkedInAt), 'HH:mm')}
                          </p>
                          <p className="text-zinc-400">
                              {r.checkin.method === 'NFC' ? t('reservations.method.nfc')
                               : r.checkin.method === 'QR' ? t('reservations.method.qr')
                               : t('reservations.method.manual')}
                          </p>
                        </div>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {r.status === 'CONFIRMED' && !r.checkin && (
                          <button onClick={() => checkin(r)}
                            className="text-xs px-2 py-1.5 sm:py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors font-medium">
                            {t('desks.actions.checkin')}
                          </button>
                        )}
                        {['CONFIRMED','PENDING'].includes(r.status) && (
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
              {res.length === 0 && (
                <tr><td colSpan={5} className="py-10 text-center text-zinc-400 text-sm">Brak rezerwacji dla wybranych filtrów</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
