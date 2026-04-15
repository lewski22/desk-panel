import { localDateStr } from '../utils/date';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { Btn, Card } from '../components/ui';
import { format } from 'date-fns';
import { pl, enUS } from 'date-fns/locale';

const LOC_ID = import.meta.env.VITE_LOCATION_ID ?? '';

const STATUS_CLS: Record<string, string> = {
  CONFIRMED: 'bg-emerald-100 text-emerald-700',
  PENDING:   'bg-amber-100  text-amber-700',
  CANCELLED: 'bg-zinc-100   text-zinc-500',
  EXPIRED:   'bg-red-100    text-red-600',
  COMPLETED: 'bg-sky-100    text-sky-700',
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

  const statuses = ['CONFIRMED','PENDING','CANCELLED','EXPIRED','COMPLETED'];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">{t('pages.reservationsAdmin.title')}</h1>
        </div>
      </div>

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
            {statuses.map(s => (
              <option key={s} value={s}>{t(`reservations.status.${s.toLowerCase()}`)}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={load} className="px-4 py-2 text-sm rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors">
            {t('btn.refresh')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-5">
        {statuses.map(s => {
          const count = res.filter(r => r.status === s).length;
          return (
            <div key={s} className="bg-white border border-zinc-100 rounded-xl p-3 text-center">
              <p className="text-lg font-bold font-mono text-zinc-700">{count}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{t(`reservations.status.${s.toLowerCase()}`)}</p>
            </div>
          );
        })}
      </div>

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
                const cls = STATUS_CLS[r.status] ?? STATUS_CLS.PENDING;
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
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
                        {t(`reservations.status.${r.status.toLowerCase()}`)}
                      </span>
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
                <tr><td colSpan={5} className="py-10 text-center text-zinc-400 text-sm">{t('reservations.none_filters')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
