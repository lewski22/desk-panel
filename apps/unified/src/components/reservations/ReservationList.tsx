import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Reservation } from '../../types/index';
import { format } from 'date-fns';
import { pl, enUS } from 'date-fns/locale';
import { STATUS_CFG } from '../../utils/reservationStatus';

interface Props {
  reservations: Reservation[];
  loading: boolean;
  onCancel: (id: string) => Promise<void>;
  onRefresh: () => void;
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  CONFIRMED: { label: 'Potwierdzona', className: 'bg-emerald-100 text-emerald-700' },
  PENDING:   { label: 'Oczekuje',     className: 'bg-amber-100  text-amber-700'   },
  CANCELLED: { label: 'Anulowana',    className: 'bg-zinc-100   text-zinc-500'    },
  EXPIRED:   { label: 'Wygasła',      className: 'bg-red-100    text-red-600'     },
  COMPLETED: { label: 'Zakończona',   className: 'bg-sky-100    text-sky-700'     },
};

const METHOD_ICON: Record<string, string> = {
  NFC:    'ti-antenna',
  QR:     'ti-qrcode',
  MANUAL: 'ti-hand-stop',
  WEB:    'ti-world',
};

function Row({ r, onCancel }: { r: Reservation; onCancel: (id: string) => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const meta = STATUS_META[r.status] ?? STATUS_META.PENDING;
  const canCancel = ['CONFIRMED', 'PENDING'].includes(r.status);

  const handleCancel = async () => {
    if (!confirm(`Anulować rezerwację ${r.desk.code}?`)) return;
    setBusy(true);
    try { await onCancel(r.id); } catch (e: any) { console.error(e.message); }
    setBusy(false);
  };

  return (
    <tr className="border-b border-zinc-50 hover:bg-zinc-50/60 transition-colors group">
      {/* Time */}
      <td className="py-3 px-4 text-sm font-mono text-zinc-600 whitespace-nowrap">
        {format(new Date(r.startTime), 'HH:mm')}
        <span className="text-zinc-300 mx-1">–</span>
        {format(new Date(r.endTime), 'HH:mm')}
      </td>

      {/* Desk */}
      <td className="py-3 px-4">
        <p className="text-sm font-semibold text-zinc-800">{r.desk.name}</p>
        <p className="text-xs text-zinc-400">
          {[r.desk.zone, r.desk.floor && `Piętro ${r.desk.floor}`].filter(Boolean).join(' · ')}
        </p>
      </td>

      {/* User */}
      <td className="py-3 px-4">
        <p className="text-sm text-zinc-800">{r.user.firstName} {r.user.lastName}</p>
        <p className="text-xs text-zinc-400">{r.user.email}</p>
      </td>

      {/* Check-in method */}
      <td className="py-3 px-4 text-xs text-zinc-500">
        {r.checkin ? (
          <div>
            <p className="flex items-center gap-1">
              <i className={`ti ${METHOD_ICON[r.checkin.method] ?? 'ti-login'} text-[#A898B8]`} aria-hidden="true" />
              {r.checkin.method}
            </p>
            <p className="text-zinc-400">
              {format(new Date(r.checkin.checkedInAt), 'HH:mm')}
              {r.checkin.checkedOutAt && ` → ${format(new Date(r.checkin.checkedOutAt), 'HH:mm')}`}
            </p>
          </div>
        ) : (
          <span className="text-zinc-300">—</span>
        )}
      </td>

      {/* Status */}
      <td className="py-3 px-4">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.className}`}>
          {meta.label}
        </span>
      </td>

      {/* Actions */}
      <td className="py-3 px-4 text-right">
        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={busy}
            title={t('reservations.cancel')}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-[#DCD6EA] text-[#6B5F7A] hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors disabled:opacity-40 ml-auto"
          >
            {busy
              ? <i className="ti ti-loader-2 text-sm animate-spin" aria-hidden="true" />
              : <i className="ti ti-x text-sm" aria-hidden="true" />
            }
          </button>
        )}
      </td>
    </tr>
  );
}

export function ReservationList({ reservations, loading, onCancel, onRefresh }: Props) {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<string>('ALL');

  const filtered = filter === 'ALL'
    ? reservations
    : reservations.filter(r => r.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold text-zinc-800">{t('reservations.today_title')}</h2>
          <p className="text-xs text-zinc-400">
            {format(new Date(), 'EEEE, d MMMM yyyy', { locale: i18n.language === 'en' ? enUS : pl })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Chip Wszystkie */}
          <button
            onClick={() => setFilter('ALL')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
              filter === 'ALL'
                ? 'bg-[#FDF4F9] border-[#B53578] text-[#B53578]'
                : 'bg-white border-[#DCD6EA] text-[#6B5F7A] hover:bg-[#F8F6FC]'
            }`}
          >
            {t('reservations.filter.all')} {filter === 'ALL' && `(${reservations.length})`}
          </button>

          {/* Chipy statusów */}
          {(['CONFIRMED','PENDING','COMPLETED','CANCELLED'] as const).map(s => {
            const cfg   = STATUS_CFG[s];
            const count = reservations.filter(r => r.status === s).length;
            if (count === 0) return null;
            const isActive = filter === s;
            return (
              <button key={s}
                onClick={() => setFilter(isActive ? 'ALL' : s)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full
                            border text-xs font-medium transition-all ${
                  isActive ? 'text-white border-transparent' : 'bg-white border-zinc-200 hover:border-zinc-300'
                }`}
                style={isActive
                  ? { background: cfg.activeBg }
                  : { color: cfg.text }}
              >
                <span className="w-1.5 h-1.5 rounded-full"
                  style={{ background: isActive ? 'rgba(255,255,255,0.8)' : cfg.dot }} />
                {cfg.label}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ background: isActive ? 'rgba(255,255,255,0.2)' : cfg.bg,
                           color: isActive ? '#fff' : cfg.text }}>
                  {count}
                </span>
              </button>
            );
          })}

          <button onClick={onRefresh}
            title={t('btn.refresh', 'Odśwież')}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-[#DCD6EA] text-[#6B5F7A] hover:bg-[#F8F6FC] transition-colors">
            <i className="ti ti-refresh text-sm" aria-hidden="true" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-300">
          <div className="inline-block w-5 h-5 border-2 border-zinc-200 border-t-indigo-400 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <i className="ti ti-calendar-off text-4xl text-[#A898B8] mb-2 block" aria-hidden="true" />
          <p className="text-sm">{t('reservations.none_today')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-100">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/70">
                {[t('reservations.table.time'), t('reservations.table.desk'), t('reservations.table.user'), t('reservations.table.checkin'), t('reservations.table.status'), ''].map(h => (
                  <th key={h} className="py-2.5 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <Row key={r.id} r={r} onCancel={onCancel} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
