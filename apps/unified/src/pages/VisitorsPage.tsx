/**
 * VisitorsPage — Sprint J2
 * Zarządzanie gośćmi biura: lista, zapraszanie, check-in/out
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi }          from '../api/client';
import {
  Btn, Card, Modal, Input, FormField, Spinner, EmptyState,
} from '../components/ui';
import { localDateStr }    from '../utils/date';
import { format }          from 'date-fns';
import { pl, enUS }        from 'date-fns/locale';

const STATUS_CFG: Record<string, { label: string; cls: string; icon: string }> = {
  INVITED:     { label: 'Zaproszony',    cls: 'bg-sky-100 text-sky-700',     icon: '✉️' },
  CHECKED_IN:  { label: 'W biurze',      cls: 'bg-emerald-100 text-emerald-700', icon: '🏢' },
  CHECKED_OUT: { label: 'Wyszedł',       cls: 'bg-zinc-100 text-zinc-500',   icon: '👋' },
  CANCELLED:   { label: 'Anulowany',     cls: 'bg-red-50 text-red-500',      icon: '✗' },
};

// ── Invite Modal ──────────────────────────────────────────────
function InviteModal({ locationId, onClose, onSaved }: {
  locationId: string; onClose: () => void; onSaved: () => void;
}) {
  const { t }   = useTranslation();
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '',
    company: '', visitDate: localDateStr(), purpose: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.firstName || !form.lastName || !form.email || !form.visitDate) {
      setErr(t('visitors.form.required')); return;
    }
    setSaving(true); setErr('');
    try {
      await appApi.visitors.invite(locationId, form);
      onSaved(); onClose();
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <Modal title={t('visitors.invite_title')} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('users.form.firstName')} value={form.firstName} onChange={e => set('firstName', e.target.value)} />
          <Input label={t('users.form.lastName')}  value={form.lastName}  onChange={e => set('lastName', e.target.value)} />
        </div>
        <Input label={t('users.form.email')} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        <Input label={t('visitors.form.company')} value={form.company} onChange={e => set('company', e.target.value)} />
        <Input label={t('visitors.form.visit_date')} type="date" value={form.visitDate}
          onChange={e => set('visitDate', e.target.value)} min={localDateStr()} />
        <div>
          <label className="block text-xs text-zinc-500 font-medium mb-1">{t('visitors.form.purpose')}</label>
          <textarea value={form.purpose} onChange={e => set('purpose', e.target.value)} rows={2}
            placeholder={t('visitors.form.purpose_ph')}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/30" />
        </div>
        {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Btn variant="secondary" onClick={onClose}>{t('btn.cancel')}</Btn>
          <Btn onClick={submit} loading={saving}>{t('visitors.invite_btn')}</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ── Visitor row ───────────────────────────────────────────────
function VisitorRow({ v, onCheckin, onCheckout, onCancel, locale }: {
  v: any; locale: string;
  onCheckin:  (id: string) => void;
  onCheckout: (id: string) => void;
  onCancel:   (id: string) => void;
}) {
  const cfg = STATUS_CFG[v.status] ?? STATUS_CFG.INVITED;
  return (
    <tr className="border-b border-zinc-50 hover:bg-zinc-50/60 group">
      <td className="py-3 px-4">
        <p className="font-medium text-zinc-800">{v.firstName} {v.lastName}</p>
        <p className="text-xs text-zinc-400">{v.email}</p>
        {v.company && <p className="text-xs text-zinc-400">{v.company}</p>}
      </td>
      <td className="py-3 px-4 text-xs text-zinc-500 hidden sm:table-cell">
        {format(new Date(v.visitDate), 'dd MMM yyyy', { locale: locale === 'pl-PL' ? pl : enUS })}
      </td>
      <td className="py-3 px-4 text-xs text-zinc-400 hidden md:table-cell">
        {v.host?.firstName} {v.host?.lastName}
      </td>
      <td className="py-3 px-4 text-xs text-zinc-400 hidden lg:table-cell">
        {v.purpose ?? '—'}
      </td>
      <td className="py-3 px-4">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
          {cfg.icon} {cfg.label}
        </span>
      </td>
      <td className="py-3 px-4">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {v.status === 'INVITED' && (
            <button onClick={() => onCheckin(v.id)}
              className="text-xs px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors font-medium">
              Check-in
            </button>
          )}
          {v.status === 'CHECKED_IN' && (
            <button onClick={() => onCheckout(v.id)}
              className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors">
              Check-out
            </button>
          )}
          {['INVITED','CHECKED_IN'].includes(v.status) && (
            <button onClick={() => onCancel(v.id)}
              className="text-xs px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors">
              Anuluj
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export function VisitorsPage() {
  const { t, i18n } = useTranslation();
  const locale       = i18n.language === 'en' ? 'en-GB' : 'pl-PL';
  const [locations, setLocations]   = useState<any[]>([]);
  const [locationId, setLocId]      = useState('');
  const [date, setDate]             = useState(localDateStr());
  const [visitors, setVisitors]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    appApi.locations.listAll()
      .then(locs => { setLocations(locs); if (locs.length > 0) setLocId(locs[0].id); })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    appApi.visitors.list(locationId, date)
      .then(setVisitors).catch(() => [])
      .finally(() => setLoading(false));
  }, [locationId, date]);

  useEffect(() => { load(); }, [load]);

  const checkin  = async (id: string) => { await appApi.visitors.checkin(id); load(); };
  const checkout = async (id: string) => { await appApi.visitors.checkout(id); load(); };
  const cancel   = async (id: string) => {
    if (!confirm(t('visitors.confirm_cancel'))) return;
    await appApi.visitors.cancel(id); load();
  };

  const stats = useMemo(() => ({
    expected:  visitors.filter(v => v.status !== 'CANCELLED').length,
    arrived:   visitors.filter(v => v.status === 'CHECKED_IN').length,
    left:      visitors.filter(v => v.status === 'CHECKED_OUT').length,
  }), [visitors]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">{t('visitors.title')}</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{t('visitors.subtitle')}</p>
        </div>
        <Btn onClick={() => setInviteOpen(true)}>+ {t('visitors.invite_btn')}</Btn>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        {locations.length > 1 && (
          <select value={locationId} onChange={e => setLocId(e.target.value)}
            className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
        <button onClick={load}
          className="px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-sm transition-colors">
          ↺ {t('btn.refresh')}
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: t('visitors.kpi.expected'),  value: stats.expected, color: 'text-sky-700',     bg: 'bg-sky-50 border-sky-100' },
          { label: t('visitors.kpi.arrived'),   value: stats.arrived,  color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
          { label: t('visitors.kpi.left'),      value: stats.left,     color: 'text-zinc-600',    bg: 'bg-zinc-50 border-zinc-100' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-xl border p-4 ${bg}`}>
            <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? <Spinner /> : visitors.length === 0 ? (
        <EmptyState icon="👤" title={t('visitors.empty')} sub={t('visitors.empty_sub')}
          action={<Btn onClick={() => setInviteOpen(true)}>+ {t('visitors.invite_btn')}</Btn>} />
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-none sm:rounded-xl border-y sm:border border-zinc-100">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('visitors.col.guest')}</th>
                <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider hidden sm:table-cell">{t('visitors.col.date')}</th>
                <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider hidden md:table-cell">{t('visitors.col.host')}</th>
                <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider hidden lg:table-cell">{t('visitors.col.purpose')}</th>
                <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('visitors.col.status')}</th>
                <th className="py-2.5 px-4" />
              </tr>
            </thead>
            <tbody>
              {visitors.map(v => (
                <VisitorRow key={v.id} v={v} locale={locale}
                  onCheckin={checkin} onCheckout={checkout} onCancel={cancel} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inviteOpen && (
        <InviteModal locationId={locationId} onClose={() => setInviteOpen(false)} onSaved={load} />
      )}
    </div>
  );
}
