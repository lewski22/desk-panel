import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { PageHeader } from '../components/ui';

const STEPS = [
  { key: 'registered',      label: 'Rejestracja',     icon: '📝' },
  { key: 'emailVerified',   label: 'Email OK',         icon: '✉️' },
  { key: 'hasBillingEmail', label: 'Email faktury',    icon: '💳' },
  { key: 'hasDesks',        label: 'Biurka dodane',    icon: '🪑' },
  { key: 'hasGateway',      label: 'Gateway',          icon: '📡' },
  { key: 'hasMrr',          label: 'MRR ustawione',    icon: '💰' },
  { key: 'invoiceSent',     label: 'Faktura wysłana',  icon: '📨' },
  { key: 'invoicePaid',     label: 'Faktura opłacona', icon: '✅' },
];

export function OwnerOnboardingPage() {
  const { t } = useTranslation();
  const [orgs,    setOrgs]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await appApi.owner.getOnboardingStatus();
      setOrgs(data);
    } catch (err) {
      console.warn('OwnerOnboardingPage: load failed', err);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader
        title={t('layout.nav.owner_onboarding')}
        subtitle="Status wdrożenia krok po kroku dla każdej organizacji"
        action={
          <button
            onClick={load}
            className="text-xs px-3 py-1.5 border border-zinc-200 rounded-lg text-zinc-500 hover:bg-zinc-50"
          >
            ↺ Odśwież
          </button>
        }
      />

      {loading ? (
        <div className="py-16 text-center text-zinc-400 text-sm">Ładowanie…</div>
      ) : orgs.length === 0 ? (
        <div className="py-16 text-center text-zinc-400 text-sm">Brak danych</div>
      ) : (
        <div className="bg-white overflow-x-auto rounded-xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100 text-xs text-zinc-500 uppercase tracking-wide">
                <th className="py-2.5 px-4 text-left">Organizacja</th>
                <th className="py-2.5 px-4 text-left">Plan</th>
                {STEPS.map(s => (
                  <th key={s.key} className="py-2.5 px-3 text-center" title={s.label}>{s.icon}</th>
                ))}
                <th className="py-2.5 px-4 text-right">Ukończono</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {orgs.map(org => {
                const done = STEPS.filter(s => org.steps[s.key]).length;
                const pct  = Math.round((done / STEPS.length) * 100);
                return (
                  <tr key={org.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-zinc-800">{org.name}</div>
                      <div className="text-xs text-zinc-400">
                        {org.noAdmin
                          ? <span className="text-amber-500">brak admina</span>
                          : org.adminEmail}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 capitalize">
                        {org.plan}
                      </span>
                    </td>
                    {STEPS.map(s => (
                      <td key={s.key} className="py-3 px-3 text-center">
                        {org.steps[s.key]
                          ? <span className="text-green-500 text-base">✓</span>
                          : <span className="text-zinc-300 text-base">○</span>}
                      </td>
                    ))}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-zinc-500">{pct}%</span>
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
