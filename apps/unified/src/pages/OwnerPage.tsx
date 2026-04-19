import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { PageHeader, Btn, Modal, Input, Spinner } from '../components/ui';
import { PlanBadge } from '../components/subscription/PlanBadge';

// ─── Modal: nowa firma ────────────────────────────────────────
function CreateOrgModal({ onClose, onCreated }: { onClose(): void; onCreated(): void }) {
  const { t } = useTranslation();
  const [name, setName]         = useState('');
  const [slug, setSlug]         = useState('');
  const [plan, setPlan]         = useState('starter');
  const [email, setEmail]       = useState('');
  const [firstName, setFirst]   = useState('');
  const [lastName,  setLast]    = useState('');
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');
  const [result, setResult]     = useState<any>(null);

  // Auto-slug z nazwy
  useEffect(() => {
    if (name) setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  }, [name]);

  const submit = async () => {
    setSaving(true); setErr('');
    try {
      const r = await appApi.owner.createOrg({ name, slug, plan, adminEmail: email, adminFirstName: firstName, adminLastName: lastName });
      setResult(r);
      onCreated();
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  if (result) return (
    <Modal title="✅ Firma utworzona" onClose={onClose}>
      <p className="text-green-600 font-semibold mb-3">Firma <strong>{result.org?.name}</strong> gotowa.</p>
      <p className="text-xs text-zinc-500 mb-2">Konto admina:</p>
      <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 font-mono text-sm space-y-1">
        <div>📧 {result.user?.email}</div>
        <div>🔑 {result.temporaryPassword}</div>
      </div>
      <p className="text-xs text-red-500 mt-2">⚠️ Skopiuj hasło — nie będzie widoczne ponownie.</p>
      <div className="mt-4"><Btn onClick={onClose}>{t('btn.cancel')}</Btn></div>
    </Modal>
  );

  return (
    <Modal title="Nowa firma" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nazwa firmy *" value={name} onChange={e => setName(e.target.value)} placeholder="Acme Corp" />
          <Input label="Slug (URL) *" value={slug} onChange={e => setSlug(e.target.value)} placeholder="acme-corp" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1 font-medium">Plan</label>
          <select value={plan} onChange={e => setPlan(e.target.value)}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="trial">Trial</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <p className="text-xs text-zinc-400 pt-1 border-t border-zinc-100">Konto SUPER_ADMIN (hasło tymczasowe):</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Imię *" value={firstName} onChange={e => setFirst(e.target.value)} placeholder="Jan" />
          <Input label="Nazwisko *" value={lastName} onChange={e => setLast(e.target.value)} placeholder="Kowalski" />
        </div>
        <Input label="Email admina *" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@firma.pl" />
        {err && <p className="text-sm text-red-500">{err}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Btn variant="secondary" onClick={onClose}>{t('btn.cancel')}</Btn>
          <Btn onClick={submit} loading={saving}
            disabled={!name || !slug || !email || !firstName || !lastName}>
            Utwórz firmę
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal: edycja firmy ──────────────────────────────────────
// ── Definicje modułów ─────────────────────────────────────────
const MODULE_DEFS = [
  { id: 'DESKS',       icon: '🪑', label: 'Biurka',           desc: 'Rezerwacja biurek, mapa, check-in NFC/QR' },
  { id: 'ROOMS',       icon: '🏛',  label: 'Sale konferencyjne', desc: 'Rezerwacja sal, kalendarz dostępności' },
  { id: 'PARKING',     icon: '🅿️', label: 'Parking',           desc: 'Miejsca parkingowe — rezerwacja i status' },
  { id: 'FLOOR_PLAN',  icon: '🗺',  label: 'Plan piętra',       desc: 'Interaktywna mapa SVG z pozycjami biurek' },
  { id: 'WEEKLY_VIEW', icon: '📅', label: 'Widok tygodniowy',  desc: 'Kto jest w biurze — widok kalendarza tygodnia' },
] as const;

function ModuleToggle({
  moduleId, icon, label, desc, enabled, onChange,
}: {
  moduleId: string; icon: string; label: string; desc: string;
  enabled: boolean; onChange: (id: string, val: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(moduleId, !enabled)}
      className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
        enabled
          ? 'bg-[#B53578]/5 border-[#B53578]/30 ring-1 ring-[#B53578]/20'
          : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
      }`}
    >
      <span className="text-xl shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${enabled ? 'text-[#B53578]' : 'text-zinc-700'}`}>{label}</p>
        <p className="text-xs text-zinc-400 mt-0.5">{desc}</p>
      </div>
      {/* Toggle pill */}
      <span className={`shrink-0 mt-1 w-9 h-5 rounded-full flex items-center transition-colors ${
        enabled ? 'bg-[#B53578]' : 'bg-zinc-300'
      }`}>
        <span className={`w-4 h-4 bg-white rounded-full shadow mx-0.5 transition-transform ${
          enabled ? 'translate-x-4' : 'translate-x-0'
        }`} />
      </span>
    </button>
  );
}

function EditOrgModal({ org, onClose, onSaved }: { org: any; onClose(): void; onSaved(): void }) {
  const { t } = useTranslation();
  const [name,  setName]  = useState(org.name);
  const [plan,  setPlan]  = useState(org.plan ?? 'starter');
  const [notes, setNotes] = useState(org.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  // Moduły: pusta tablica = wszystkie aktywne (legacy)
  // Jeśli enabledModules nie ma w org — inicjalizuj jako ALL (wszystkie zaznaczone)
  const [modules, setModules] = useState<string[]>(() => {
    const em = org.enabledModules ?? [];
    // Jeśli brak konfiguracji — zaznacz wszystkie
    return em.length === 0
      ? MODULE_DEFS.map(m => m.id)
      : em;
  });

  const allEnabled = modules.length === MODULE_DEFS.length;

  const toggleModule = (id: string, val: boolean) => {
    setModules(prev =>
      val ? [...prev, id] : prev.filter(m => m !== id)
    );
  };

  const toggleAll = () => {
    setModules(allEnabled ? [] : MODULE_DEFS.map(m => m.id));
  };

  const submit = async () => {
    setSaving(true); setErr('');
    try {
      // Zapisz nazwę, plan, notatki
      await appApi.owner.updateOrg(org.id, { name, plan, notes });
      // Zapisz moduły osobno (whitelist po stronie backendu)
      // Pusta tablica gdy wszystkie zaznaczone = backward compat
      const toSave = modules.length === MODULE_DEFS.length ? [] : modules;
      await appApi.owner.setModules(org.id, toSave);
      onSaved(); onClose();
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <Modal title={`Edytuj: ${org.name}`} onClose={onClose} wide>
      <div className="space-y-4">
        <Input label="Nazwa firmy" value={name} onChange={e => setName(e.target.value)} />
        <div>
          <label className="block text-xs text-zinc-500 mb-1 font-medium">Plan</label>
          <select value={plan} onChange={e => setPlan(e.target.value)}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="trial">Trial</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1 font-medium">Notatki</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none" />
        </div>

        {/* Sekcja modułów */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs text-zinc-500 font-medium uppercase tracking-wider">
              Aktywne moduły
            </label>
            <button type="button" onClick={toggleAll}
              className="text-xs text-[#B53578] hover:underline">
              {allEnabled ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
            </button>
          </div>
          <div className="space-y-2">
            {MODULE_DEFS.map(m => (
              <ModuleToggle
                key={m.id}
                moduleId={m.id}
                icon={m.icon}
                label={m.label}
                desc={m.desc}
                enabled={modules.includes(m.id)}
                onChange={toggleModule}
              />
            ))}
          </div>
          <p className="text-[10px] text-zinc-400 mt-2">
            Wyłączone moduły są ukryte dla użytkowników tej organizacji.
            Dane nie są usuwane.
          </p>
        </div>

        {err && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
        <div className="flex gap-2 justify-end">
          <Btn variant="secondary" onClick={onClose}>{t('btn.cancel')}</Btn>
          <Btn onClick={submit} loading={saving}>{t('btn.save')}</Btn>
        </div>
      </div>
    </Modal>
  );
}


// ─── Modal edycji planu subskrypcji (Owner) ──────────────────
function LegacySubPlanModal({ org, onClose }: { org: any; onClose: () => void }) {
  const [plan,          setPlan]          = useState(org.plan ?? 'starter');
  const [planExpiresAt, setPlanExpiresAt] = useState(org.planExpiresAt ? org.planExpiresAt.slice(0,10) : '');
  const [mrr,           setMrr]           = useState(String(org.mrr ? (org.mrr / 100).toFixed(0) : ''));
  const [billingEmail,  setBillingEmail]  = useState(org.billingEmail ?? '');
  const [limitDesks,    setLimitDesks]    = useState(String(org.limitDesks ?? ''));
  const [limitUsers,    setLimitUsers]    = useState(String(org.limitUsers ?? ''));
  const [note,          setNote]          = useState('');
  const [saving,        setSaving]        = useState(false);
  const [err,           setErr]           = useState('');
  const [events,        setEvents]        = useState<any[]>([]);

  useEffect(() => {
    appApi.subscription.getEvents(org.id).then(setEvents).catch(() => {});
  }, [org.id]);

  const submit = async () => {
    setSaving(true); setErr('');
    try {
      await appApi.subscription.updatePlan(org.id, {
        plan,
        planExpiresAt: planExpiresAt ? new Date(planExpiresAt).toISOString() : undefined,
        mrr:           mrr ? Math.round(parseFloat(mrr) * 100) : undefined,
        billingEmail:  billingEmail || undefined,
        limitDesks:    limitDesks ? parseInt(limitDesks) : null,
        limitUsers:    limitUsers ? parseInt(limitUsers) : null,
        note:          note || undefined,
      });
      onClose();
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  const PLANS = ['starter', 'trial', 'pro', 'enterprise'];

  return (
    <Modal title={`Subskrypcja: ${org.name}`} onClose={onClose} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Plan */}
        <div>
          <label className="block text-xs text-zinc-500 font-medium mb-1">Plan</label>
          <div className="flex gap-2 flex-wrap">
            {PLANS.map(p => (
              <button key={p} type="button" onClick={() => setPlan(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all capitalize ${
                  plan === p ? 'border-[#B53578] bg-[#B53578]/10 text-[#B53578]' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
                }`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Expiry */}
        <div>
          <label className="block text-xs text-zinc-500 font-medium mb-1">Ważny do</label>
          <input type="date" value={planExpiresAt} onChange={e => setPlanExpiresAt(e.target.value)}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
          <p className="text-[10px] text-zinc-400 mt-1">Puste = bezterminowy (Enterprise)</p>
        </div>

        {/* MRR */}
        <div>
          <label className="block text-xs text-zinc-500 font-medium mb-1">MRR (PLN/miesiąc)</label>
          <input type="number" value={mrr} onChange={e => setMrr(e.target.value)} placeholder="399"
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
        </div>

        {/* Billing email */}
        <div>
          <label className="block text-xs text-zinc-500 font-medium mb-1">Email faktur</label>
          <input type="email" value={billingEmail} onChange={e => setBillingEmail(e.target.value)}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
        </div>

        {/* Custom limits */}
        <div>
          <label className="block text-xs text-zinc-500 font-medium mb-1">Limit biurek (puste = z planu)</label>
          <input type="number" value={limitDesks} onChange={e => setLimitDesks(e.target.value)} placeholder="50"
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 font-medium mb-1">Limit użytkowników</label>
          <input type="number" value={limitUsers} onChange={e => setLimitUsers(e.target.value)} placeholder="150"
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
        </div>

        {/* Note */}
        <div className="col-span-2">
          <label className="block text-xs text-zinc-500 font-medium mb-1">Notatka (pojawi się w historii)</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="np. Odnowienie roczne FV 123/2026"
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      <div className="flex gap-2 justify-end mt-4">
        <Btn variant="secondary" onClick={onClose}>Anuluj</Btn>
        <Btn onClick={submit} loading={saving}>Zapisz</Btn>
      </div>

      {/* Historia zmian */}
      {events.length > 0 && (
        <div className="mt-5 pt-4 border-t border-zinc-100">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Historia zmian</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {events.map(e => (
              <div key={e.id} className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="text-zinc-300">{new Date(e.createdAt).toLocaleDateString('pl-PL')}</span>
                <span className="capitalize">{e.type.replace('_', ' ')}</span>
                {e.previousPlan && <span className="text-zinc-400">{e.previousPlan} → {e.newPlan}</span>}
                {e.note && <span className="text-zinc-400 truncate">· {e.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Główna strona ────────────────────────────────────────────
// ─── SubscriptionTab + SubPlanModal — Sprint B3 ─────────────────

function SubPlanModal({ org, onClose, onSaved }: { org: any; onClose(): void; onSaved(): void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    plan:           org.plan           ?? 'starter',
    planExpiresAt:  org.planExpiresAt  ? (typeof org.planExpiresAt === 'string' ? org.planExpiresAt.slice(0,10) : new Date(org.planExpiresAt).toISOString().slice(0,10)) : '',
    limitDesks:     org.limitDesks     ?? '',
    limitUsers:     org.limitUsers     ?? '',
    limitGateways:  org.limitGateways  ?? '',
    limitLocations: org.limitLocations ?? '',
    mrr:            org.mrr            ?? '',
    billingEmail:   org.billingEmail   ?? '',
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toNum = (v: string | number) => v === '' || v === null ? null : Number(v);

  const submit = async () => {
    setSaving(true); setErr('');
    try {
      await appApi.subscription.updatePlan(org.id, {
        plan: form.plan,
        planExpiresAt:  form.planExpiresAt  || undefined,
        limitDesks:     toNum(form.limitDesks),
        limitUsers:     toNum(form.limitUsers),
        limitGateways:  toNum(form.limitGateways),
        limitLocations: toNum(form.limitLocations),
        mrr:            toNum(form.mrr),
        billingEmail:   form.billingEmail   || undefined,
        note:           form.note           || undefined,
      });
      onSaved(); onClose();
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <Modal title={`Subskrypcja: ${org.name}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-zinc-500 mb-1 font-medium">Plan</label>
          <select value={form.plan} onChange={e => set('plan', e.target.value)}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm">
            {['trial','starter','pro','enterprise'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <Input label="Ważny do (puste = bezterminowy)" type="date" value={String(form.planExpiresAt)}
          onChange={e => set('planExpiresAt', e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Input label="Limit biurek (puste=∞)"    type="number" value={String(form.limitDesks)}     onChange={e => set('limitDesks',     e.target.value)} />
          <Input label="Limit użytkowników"         type="number" value={String(form.limitUsers)}     onChange={e => set('limitUsers',     e.target.value)} />
          <Input label="Limit gatewayów"            type="number" value={String(form.limitGateways)}  onChange={e => set('limitGateways',  e.target.value)} />
          <Input label="Limit biur"                 type="number" value={String(form.limitLocations)} onChange={e => set('limitLocations', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input label="MRR (grosze PLN)" type="number" value={String(form.mrr)}         onChange={e => set('mrr',         e.target.value)} />
          <Input label="Email billing"               value={String(form.billingEmail)}   onChange={e => set('billingEmail', e.target.value)} />
        </div>
        <Input label="Notatka (opcjonalnie)" value={form.note} onChange={e => set('note', e.target.value)} />
        {err && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Btn variant="secondary" onClick={onClose}>{t('btn.cancel')}</Btn>
          <Btn onClick={submit} loading={saving}>{t('btn.save')}</Btn>
        </div>
      </div>
    </Modal>
  );
}

function SubscriptionTab({ orgs, subDash, onEdit }: {
  orgs: any[]; subDash: any; onEdit: (org: any) => void;
}) {
  const now = new Date();
  const rows = orgs.map(org => {
    const exp  = org.trialEndsAt ?? org.planExpiresAt;
    const days = exp ? Math.ceil((new Date(exp).getTime() - now.getTime()) / 86_400_000) : null;
    const isTrial = !!org.trialEndsAt;
    let statusLabel = 'Aktywny';
    let statusCls   = 'bg-emerald-100 text-emerald-700';
    if (days !== null && days <= 0)  { statusLabel = 'Wygasły';            statusCls = 'bg-red-100 text-red-600'; }
    else if (days !== null && days <= 14) { statusLabel = `Wygasa ${days}d`; statusCls = 'bg-amber-100 text-amber-700'; }
    if (isTrial && days !== null && days > 0) { statusLabel = `Trial (${days}d)`; statusCls = 'bg-sky-100 text-sky-700'; }
    return { ...org, days, statusLabel, statusCls };
  });

  return (
    <div>
      {subDash && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'MRR łącznie',      value: `${((subDash.totalMrr ?? 0)/100).toFixed(0)} zł`, cls: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
            { label: 'Wygasa (14 dni)',   value: subDash.expiringSoon,  cls: 'text-amber-700 bg-amber-50 border-amber-100' },
            { label: 'Wygasłe',           value: subDash.expired,       cls: 'text-red-600 bg-red-50 border-red-100' },
            { label: 'Trial',             value: subDash.onTrial,       cls: 'text-sky-700 bg-sky-50 border-sky-100' },
          ].map(({ label, value, cls }) => (
            <div key={label} className={`rounded-xl border p-4 ${cls.split(' ').slice(1).join(' ')}`}>
              <p className={`text-2xl font-bold font-mono ${cls.split(' ')[0]}`}>{value}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-zinc-100">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-100">
            <tr>
              {['Firma','Plan','Status','Wygasa','MRR',''].map(h => (
                <th key={h} className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(org => (
              <tr key={org.id} className="border-b border-zinc-50 hover:bg-zinc-50/60 group">
                <td className="py-3 px-4 font-medium text-zinc-800">{org.name}</td>
                <td className="py-3 px-4"><PlanBadge plan={org.plan} /></td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${org.statusCls}`}>{org.statusLabel}</span>
                </td>
                <td className="py-3 px-4 text-xs text-zinc-500">
                  {org.trialEndsAt ?? org.planExpiresAt
                    ? new Date(org.trialEndsAt ?? org.planExpiresAt).toLocaleDateString('pl-PL')
                    : '∞'}
                </td>
                <td className="py-3 px-4 text-xs font-mono text-zinc-600">
                  {org.mrr ? `${(org.mrr/100).toFixed(0)} zł` : '—'}
                </td>
                <td className="py-3 px-4">
                  <button onClick={() => onEdit(org)}
                    className="text-xs px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 opacity-0 group-hover:opacity-100 transition-all">
                    Edytuj plan
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function OwnerPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [stats, setStats]       = useState<any>(null);
  const [orgs,  setOrgs]        = useState<any[]>([]);
  const [subDash, setSubDash]   = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'orgs'|'sub'>(
    searchParams.get('tab') === 'sub' ? 'sub' : 'orgs'
  );
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editOrg, setEditOrg]       = useState<any>(null);
  const [subEditOrg, setSubEditOrg] = useState<any>(null);
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const [s, o, sd] = await Promise.all([
        appApi.owner.getStats(),
        appApi.owner.listOrgs(),
        appApi.subscription.getDashboard(),
      ]);
      setStats(s);
      setOrgs(Array.isArray(o) ? o : []);
      setSubDash(sd);
    } catch (e: any) {
      setErr(e.message || t('qr.no_connection'));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleImpersonate = async (org: any) => {
    setImpersonating(org.id);
    try {
      const r = await appApi.owner.impersonate(org.id);
      const url = r.adminUrl || `${window.location.origin}/auth/impersonate?token=${r.token}`;
      window.open(url, '_blank');
    } catch (e: any) { setErr(e.message); }
    setImpersonating(null);
  };

  const handleDeactivate = async (org: any) => {
    if (!confirm(`Dezaktywować firmę "${org.name}"?`)) return;
    try { await appApi.owner.deactivateOrg(org.id); load(); }
    catch (e: any) { setErr(e.message); }
  };

  const handleActivate = async (org: any) => {
    try { await appApi.owner.updateOrg(org.id, { isActive: true }); load(); }
    catch (e: any) { setErr(e.message); }
  };

  // stats z API: { orgsTotal, orgsActive, orgsInactive, gatewaysTotal, gatewaysOnline, beaconsTotal, beaconsOnline, checkinsToday, checkinsWeek }
  const statCards = stats ? [
    { label: t('pages.organizations.title'),   val: stats.orgsActive,     sub: `${stats.orgsTotal}`,              icon: '🏢' },
    { label: t('provisioning.gateways_title'),  val: stats.gatewaysOnline,  sub: `${stats.gatewaysTotal}`,           icon: '📡' },
    { label: t('provisioning.beacons_title'),  val: stats.beaconsOnline,   sub: `${stats.beaconsTotal}`,            icon: '🔵' },
    { label: t('dashboard.kpi.checkins_today'),  val: stats.checkinsToday,   sub: `${stats.checkinsWeek}`,         icon: '✅' },
    ...(subDash ? [
      { label: 'MRR', val: subDash.totalMrr ? `${(subDash.totalMrr/100).toFixed(0)} zł` : '0 zł', sub: `${subDash.totalActive} org`, icon: '💰' },
      { label: 'Wygasa wkrótce', val: subDash.expiringSoon, sub: `${subDash.expired} wygasłe`, icon: '⏳' },
    ] : []),
  ] : [];

  const filtered = orgs.filter(o =>
    !search || o.name?.toLowerCase().includes(search.toLowerCase()) || o.slug?.includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Panel Operatora"
        subtitle="Zarządzanie firmami i infrastrukturą platformy Reserti"
        action={<Btn onClick={() => setShowCreate(true)}>+ Nowa firma</Btn>}
      />

      {err && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {err}
        </div>
      )}

      {/* Statystyki platformy */}
      {statCards.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {statCards.map(({ label, val, sub, icon }) => (
            <div key={label} className="bg-white border border-zinc-100 rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">{label}</p>
                  <p className="text-2xl font-bold text-zinc-800 mt-1">{val ?? '—'}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>
                </div>
                <span className="text-2xl">{icon}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-100 rounded-xl p-1 mb-5 w-fit">
        {([['orgs','🏢 Organizacje'],['sub','💳 Subskrypcje']] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Filtry — tylko dla zakładki Organizacje */}
      {activeTab === 'orgs' && (
      <div className="flex gap-2 mb-4 items-center">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Szukaj firmy..."
          className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none min-w-[200px]"
        />
        <button onClick={load}
          className="text-xs px-3 py-1.5 border border-zinc-200 rounded-lg text-zinc-500 hover:bg-zinc-50">
          ↺ Odśwież
        </button>
        <span className="text-xs text-zinc-400 ml-auto">{filtered.length} firm</span>
      </div>
      )}

      {/* Tabela organizacji */}
      {activeTab === 'orgs' && <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-zinc-400 text-sm">{t('btn.saving').replace('…','')}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-zinc-400 text-sm">
            {err ? t('qr.error_title') : t('organizations.no_locations')}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                {[t('organizations.label_office'), 'Slug', 'Plan', t('users.table.name'), t('desks.col.status'), t('desks.col.actions')].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((org, i) => (
                <tr key={org.id} className={`border-b border-zinc-50 ${i % 2 === 1 ? 'bg-zinc-50/50' : ''} ${!org.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-800 text-sm">{org.name}</div>
                    {org.notes && <div className="text-xs text-zinc-400 mt-0.5 truncate max-w-[200px]">{org.notes}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">{org.slug}</code>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      org.plan === 'enterprise' ? 'bg-yellow-100 text-yellow-700' :
                      org.plan === 'standard'   ? 'bg-purple-100 text-purple-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>{org.plan ?? 'basic'}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {org.usersCount ?? org._count?.users ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${org.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {org.isActive ? 'aktywna' : 'nieaktywna'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      <Btn size="sm" onClick={() => handleImpersonate(org)}
                        loading={impersonating === org.id}>
                        🔑 Wejdź
                      </Btn>
                      <Btn size="sm" variant="secondary" onClick={() => setEditOrg(org)}>{t('users.actions.edit')}</Btn>
                      {org.isActive
                        ? <Btn size="sm" variant="danger" onClick={() => handleDeactivate(org)}>{t('desks.actions_extra.deactivate')}</Btn>
                        : <Btn size="sm" variant="secondary" onClick={() => handleActivate(org)}>{t('desks.actions.activate')}</Btn>
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>}

      {/* Zakładka Subskrypcje */}
      {activeTab === 'sub' && (
        <SubscriptionTab
          orgs={orgs}
          subDash={subDash}
          onEdit={setSubEditOrg}
        />
      )}

      {showCreate && <CreateOrgModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {editOrg    && <EditOrgModal org={editOrg} onClose={() => setEditOrg(null)} onSaved={load} />}

      {/* Modal edycji planu subskrypcji */}
      {subEditOrg && <SubPlanModal org={subEditOrg} onClose={() => setSubEditOrg(null)} onSaved={load} />}
    </div>
  );
}
