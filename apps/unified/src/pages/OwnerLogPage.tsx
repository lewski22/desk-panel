import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { PageHeader } from '../components/ui';

const LOG_LIMIT = 50;

const EVENT_COLORS: Record<string, string> = {
  org_registered:           'bg-blue-50 text-blue-700',
  email_verified:           'bg-green-50 text-green-700',
  email_unverified_deleted: 'bg-red-50 text-red-700',
  plan_changed:             'bg-purple-50 text-purple-700',
  renewed:                  'bg-indigo-50 text-indigo-700',
  invoice_sent:             'bg-amber-50 text-amber-700',
  invoice_paid:             'bg-green-50 text-green-700',
  plan_expired:             'bg-red-50 text-red-700',
  limit_warning:            'bg-orange-50 text-orange-700',
};

const EVENT_LABELS: Record<string, string> = {
  org_registered:           'Rejestracja',
  email_verified:           'Email OK',
  email_unverified_deleted: 'Usunięto konto',
  plan_changed:             'Zmiana planu',
  renewed:                  'Odnowienie',
  invoice_sent:             'Faktura wysłana',
  invoice_paid:             'Faktura opłacona',
  plan_expired:             'Plan wygasł',
  limit_warning:            'Limit > 80%',
};

export function OwnerLogPage() {
  const { t } = useTranslation();

  const [events,      setEvents]      = useState<any[]>([]);
  const [total,       setTotal]       = useState(0);
  const [offset,      setOffset]      = useState(0);
  const [typeFilter,  setTypeFilter]  = useState('');
  const [orgFilter,   setOrgFilter]   = useState('');
  const [orgs,        setOrgs]        = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    appApi.owner.listOrgs().then(d => setOrgs(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const load = useCallback(async (off = offset, type = typeFilter, orgId = orgFilter) => {
    setLoading(true);
    try {
      const r = await appApi.subscription.getGlobalLog({
        limit:  LOG_LIMIT,
        offset: off,
        type:   type  || undefined,
        orgId:  orgId || undefined,
      });
      setEvents(r.events);
      setTotal(r.total);
    } catch (err) {
      console.warn('OwnerLogPage: load failed', err);
    }
    setLoading(false);
  }, [offset, typeFilter, orgFilter]);

  useEffect(() => { load(); }, [load]);

  const handleTypeChange = (v: string) => { setTypeFilter(v); setOffset(0); };
  const handleOrgChange  = (v: string) => { setOrgFilter(v);  setOffset(0); };

  return (
    <div>
      <PageHeader
        title={t('layout.nav.owner_log')}
        subtitle="Historia zdarzeń subskrypcyjnych dla wszystkich organizacji"
      />

      <div className="flex gap-3 flex-wrap items-center mb-4">
        <select
          value={typeFilter}
          onChange={e => handleTypeChange(e.target.value)}
          className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-600 focus:outline-none"
        >
          <option value="">Wszystkie typy</option>
          {Object.entries(EVENT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={orgFilter}
          onChange={e => handleOrgChange(e.target.value)}
          className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-600 focus:outline-none"
        >
          <option value="">Wszystkie organizacje</option>
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>

        <button
          onClick={() => load(offset, typeFilter, orgFilter)}
          className="text-xs px-3 py-1.5 border border-zinc-200 rounded-lg text-zinc-500 hover:bg-zinc-50"
        >
          ↺
        </button>

        <span className="text-xs text-zinc-400 ml-auto">{total} zdarzeń</span>
      </div>

      <div className="bg-white overflow-x-auto rounded-xl border border-zinc-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 text-xs text-zinc-500 uppercase tracking-wide border-b border-zinc-100">
              <th className="py-2.5 px-4 text-left">Data</th>
              <th className="py-2.5 px-4 text-left">Organizacja</th>
              <th className="py-2.5 px-4 text-left">Zdarzenie</th>
              <th className="py-2.5 px-4 text-left">Plan</th>
              <th className="py-2.5 px-4 text-left">Notatka</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading ? (
              <tr><td colSpan={5} className="py-12 text-center text-zinc-400 text-sm">Ładowanie…</td></tr>
            ) : events.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-zinc-400 text-sm">Brak zdarzeń</td></tr>
            ) : events.map(ev => (
              <tr key={ev.id} className="hover:bg-zinc-50 transition-colors">
                <td className="py-2.5 px-4 text-xs text-zinc-500 whitespace-nowrap font-mono">
                  {new Date(ev.createdAt).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="py-2.5 px-4">
                  <div className="font-medium text-zinc-800">{ev.organization?.name ?? '—'}</div>
                  <div className="text-xs text-zinc-400">{ev.organization?.plan ?? ''}</div>
                </td>
                <td className="py-2.5 px-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EVENT_COLORS[ev.type] ?? 'bg-zinc-100 text-zinc-600'}`}>
                    {EVENT_LABELS[ev.type] ?? ev.type}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-xs text-zinc-500">
                  {ev.previousPlan && ev.newPlan && ev.previousPlan !== ev.newPlan
                    ? <span>{ev.previousPlan} → <strong>{ev.newPlan}</strong></span>
                    : ev.newPlan ?? ev.previousPlan ?? '—'}
                </td>
                <td className="py-2.5 px-4 text-xs text-zinc-500 max-w-[280px] truncate">{ev.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > LOG_LIMIT && (
        <div className="flex items-center gap-3 justify-center pt-4">
          <button
            onClick={() => setOffset(o => Math.max(0, o - LOG_LIMIT))}
            disabled={offset === 0}
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40"
          >← Wcześniej</button>
          <span className="text-xs text-zinc-500">
            {offset + 1}–{Math.min(offset + LOG_LIMIT, total)} z {total}
          </span>
          <button
            onClick={() => setOffset(o => o + LOG_LIMIT)}
            disabled={offset + LOG_LIMIT >= total}
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40"
          >Później →</button>
        </div>
      )}
    </div>
  );
}
