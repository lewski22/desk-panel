import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { PageHeader, Btn } from '../components/ui';

const PLANS    = ['free', 'trial', 'starter', 'pro', 'enterprise'];
const FEATURES: [string, string][] = [
  ['ota', 'OTA Updates'],
  ['sso', 'SSO / Azure'],
  ['smtp', 'Custom SMTP'],
  ['api', 'API Access'],
];

// helpers: euro cents ↔ display string
function centsToEur(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2);
}
function eurToCents(eur: string): number | null {
  if (eur === '') return null;
  const n = Math.round(parseFloat(eur) * 100);
  return isNaN(n) ? null : n;
}
function displayEur(cents: number | null | undefined): string {
  if (cents == null) return '—';
  return `€${(cents / 100).toFixed(2)}`;
}

// ─── Hardware section ─────────────────────────────────────────
function HardwareSection() {
  const { t } = useTranslation();
  const [beaconCents, setBeaconCents] = useState<number | null>(null);
  const [input,       setInput]       = useState('');
  const [editing,     setEditing]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [err,         setErr]         = useState('');

  useEffect(() => {
    appApi.subscription.getHardwarePricing()
      .then(d => { setBeaconCents(d.beaconPriceEurCents); })
      .catch(() => {});
  }, []);

  const startEdit = () => {
    setInput(centsToEur(beaconCents));
    setEditing(true);
    setErr('');
  };

  const cancel = () => { setEditing(false); setErr(''); };

  const save = async () => {
    const cents = eurToCents(input);
    if (cents !== null && cents < 0) { setErr('Cena nie może być ujemna'); return; }
    setSaving(true); setErr('');
    try {
      const d = await appApi.subscription.setHardwarePricing({ beaconPriceEurCents: cents });
      setBeaconCents(d.beaconPriceEurCents);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base">📡</span>
          <span className="font-semibold text-zinc-800">BEACON</span>
          <span className="text-xs text-zinc-400">(cena za 1 sztukę)</span>
          {saved && <span className="text-xs text-emerald-600 font-medium">✓ Zapisano</span>}
        </div>
        {!editing
          ? <Btn size="sm" variant="secondary" onClick={startEdit}>Edytuj</Btn>
          : <div className="flex gap-2">
              <Btn size="sm" variant="secondary" onClick={cancel}>{t('btn.cancel')}</Btn>
              <Btn size="sm" onClick={save} loading={saving}>{t('btn.save')}</Btn>
            </div>
        }
      </div>

      {!editing ? (
        <div className="flex items-center gap-4">
          <div className="bg-zinc-50 rounded-lg px-4 py-3 text-center min-w-[120px]">
            <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1">Cena jednostkowa</p>
            <p className="text-xl font-bold text-zinc-800 font-mono">{displayEur(beaconCents)}</p>
          </div>
          <p className="text-xs text-zinc-400">Cena netto w euro za jeden fizyczny beacon ESP32 sprzedany klientowi.</p>
        </div>
      ) : (
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">Cena za 1 sztukę (EUR)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400 font-mono">€</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="0.00"
                className="pl-7 w-40 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B03472]/20"
              />
            </div>
          </div>
          {err && <p className="text-xs text-red-500 mb-1">{err}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Plan templates ───────────────────────────────────────────
interface PlanForm {
  desks: string; users: string; gateways: string; locations: string;
  ota: boolean; sso: boolean; smtp: boolean; api: boolean;
  priceMonthly: string; priceYearly: string;
}

export function OwnerPlansPage() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<Record<string, any>>({});
  const [editing,   setEditing]   = useState<string | null>(null);
  const [form,      setForm]      = useState<PlanForm>({ desks: '', users: '', gateways: '', locations: '', ota: false, sso: false, smtp: false, api: false, priceMonthly: '', priceYearly: '' });
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState<string | null>(null);
  const [err,       setErr]       = useState('');

  useEffect(() => {
    appApi.subscription.getPlans().then(setTemplates).catch(() => {});
  }, []);

  const startEdit = (plan: string) => {
    setEditing(plan);
    const tpl = templates[plan] ?? {};
    setForm({
      desks:         tpl.desks     != null ? String(tpl.desks)     : '',
      users:         tpl.users     != null ? String(tpl.users)     : '',
      gateways:      tpl.gateways  != null ? String(tpl.gateways)  : '',
      locations:     tpl.locations != null ? String(tpl.locations) : '',
      ota:           !!tpl.ota,
      sso:           !!tpl.sso,
      smtp:          !!tpl.smtp,
      api:           !!tpl.api,
      priceMonthly:  centsToEur(tpl.priceMonthlyEurCents),
      priceYearly:   centsToEur(tpl.priceYearlyEurCents),
    });
    setErr('');
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true); setErr('');
    const toNum = (v: string) => v === '' ? null : Number(v);
    try {
      const updated = await appApi.subscription.updatePlanTemplate(editing, {
        desks:                toNum(form.desks),
        users:                toNum(form.users),
        gateways:             toNum(form.gateways),
        locations:            toNum(form.locations),
        ota:                  form.ota,
        sso:                  form.sso,
        smtp:                 form.smtp,
        api:                  form.api,
        priceMonthlyEurCents: eurToCents(form.priceMonthly),
        priceYearlyEurCents:  eurToCents(form.priceYearly),
      });
      setTemplates(prev => ({ ...prev, [editing]: { ...prev[editing], ...updated } }));
      setSaved(editing);
      setEditing(null);
      setTimeout(() => setSaved(null), 3000);
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <div>
      <PageHeader
        title={t('layout.nav.owner_plans')}
        subtitle="Globalne limity, funkcje i cennik dla każdego planu"
      />

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700 mb-5">
        Zmiany szablonów wpływają na domyślne limity przy przypisywaniu planu oraz na limity organizacji, które nie mają ustawionych indywidualnych overridów.
        Ceny są podane w euro (EUR) i służą wyłącznie do celów informacyjnych w panelu operatora.
      </div>

      <div className="space-y-4">
        {PLANS.map(plan => {
          const tpl       = templates[plan] ?? {};
          const isEditing = editing === plan;
          return (
            <div key={plan} className="bg-white border border-zinc-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-800 capitalize">{plan}</span>
                  {saved === plan && <span className="text-xs text-emerald-600 font-medium">✓ Zapisano</span>}
                </div>
                {!isEditing
                  ? <Btn size="sm" variant="secondary" onClick={() => startEdit(plan)}>Edytuj</Btn>
                  : <div className="flex gap-2">
                      <Btn size="sm" variant="secondary" onClick={() => setEditing(null)}>{t('btn.cancel')}</Btn>
                      <Btn size="sm" onClick={save} loading={saving}>{t('btn.save')}</Btn>
                    </div>
                }
              </div>

              {!isEditing ? (
                <div className="space-y-3">
                  {/* Limity */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {[
                      ['Biurka',      tpl.desks     ?? '∞'],
                      ['Użytkownicy', tpl.users     ?? '∞'],
                      ['Gatewaye',    tpl.gateways  ?? '∞'],
                      ['Biura',       tpl.locations ?? '∞'],
                    ].map(([label, val]) => (
                      <div key={label as string} className="bg-zinc-50 rounded-lg px-3 py-2">
                        <p className="text-zinc-400 mb-0.5">{label}</p>
                        <p className="font-semibold text-zinc-700">{val}</p>
                      </div>
                    ))}
                  </div>
                  {/* Ceny */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                      <p className="text-emerald-600 mb-0.5 font-medium">Cena miesięczna</p>
                      <p className="font-bold text-emerald-700 font-mono text-sm">{displayEur(tpl.priceMonthlyEurCents)}</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                      <p className="text-emerald-600 mb-0.5 font-medium">Cena roczna</p>
                      <p className="font-bold text-emerald-700 font-mono text-sm">{displayEur(tpl.priceYearlyEurCents)}</p>
                    </div>
                  </div>
                  {/* Funkcje */}
                  <div className="flex gap-3 flex-wrap">
                    {FEATURES.map(([key, label]) => (
                      <span key={key} className={`text-[10px] px-2 py-0.5 rounded font-medium ${tpl[key] ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-400'}`}>
                        {tpl[key] ? '✓' : '✗'} {label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Limity */}
                  <div>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-2">Limity</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        ['desks',     'Biurka (puste=∞)'],
                        ['users',     'Użytkownicy'],
                        ['gateways',  'Gatewaye'],
                        ['locations', 'Biura'],
                      ].map(([key, label]) => (
                        <div key={key}>
                          <label className="block text-[11px] text-zinc-500 mb-1">{label}</label>
                          <input
                            type="number"
                            value={form[key]}
                            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                            placeholder="∞"
                            className="w-full border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B03472]/20"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Ceny */}
                  <div>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-2">Ceny (EUR)</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ['priceMonthly', 'Cena miesięczna'],
                        ['priceYearly',  'Cena roczna'],
                      ].map(([key, label]) => (
                        <div key={key}>
                          <label className="block text-[11px] text-zinc-500 mb-1">{label}</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400 font-mono">€</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={form[key]}
                              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                              placeholder="0.00"
                              className="pl-7 w-full border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B03472]/20"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Funkcje */}
                  <div>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-2">Funkcje</p>
                    <div className="flex flex-wrap gap-3">
                      {FEATURES.map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-zinc-600">
                          <input
                            type="checkbox"
                            checked={!!form[key]}
                            onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                            className="rounded"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                  {err && <p className="text-xs text-red-500">{err}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hardware pricing */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Hardware</h2>
        <HardwareSection />
      </div>
    </div>
  );
}
