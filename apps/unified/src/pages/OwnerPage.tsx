import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { PageHeader, Btn, Modal, Input, Spinner } from '../components/ui';
import { PlanBadge } from '../components/subscription/PlanBadge';
import { OrgInsightsWidget } from '../components/insights/InsightsWidget';
import { useDirtyGuard } from '../hooks/useDirtyGuard';
import { DirtyGuardDialog } from '../components/ui/DirtyGuardDialog';
import { OrgLogoUpload } from '../components/org/OrgLogoUpload';

// ─── Modal: nowa firma ────────────────────────────────────────
function CreateOrgModal({ onClose, onCreated }: { onClose(): void; onCreated(): void }) {
  const { t } = useTranslation();
  const [name,      setName]    = useState('');
  const [slug,      setSlug]    = useState('');
  const [plan,      setPlan]    = useState('starter');
  const [email,     setEmail]   = useState('');
  const [adminName, setAdmin]   = useState('');
  const [saving,    setSaving]  = useState(false);
  const [err,       setErr]     = useState('');
  const [result,    setResult]  = useState<any>(null);

  // Auto-slug z nazwy
  useEffect(() => {
    if (name) setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  }, [name]);

  const submit = async () => {
    setSaving(true); setErr('');
    try {
      const r = await appApi.owner.createOrg({ name, slug, plan, adminEmail: email, adminName });
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
            <option value="free">Free</option>
            <option value="trial">Trial</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <p className="text-xs text-zinc-400 pt-1 border-t border-zinc-100">Konto SUPER_ADMIN (hasło tymczasowe):</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Imię i nazwisko *" value={adminName} onChange={e => setAdmin(e.target.value)} placeholder="Jan Kowalski" />
          <Input label="Email admina *" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@firma.pl" />
        </div>
        {err && <p className="text-sm text-red-500">{err}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Btn variant="secondary" onClick={onClose}>{t('btn.cancel')}</Btn>
          <Btn onClick={submit} loading={saving}
            disabled={!name || !slug || !email || !adminName}>
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
  { id: 'DESKS',       icon: '🪑', label: 'Biurka',               desc: 'Rezerwacje biurek, mapa, QR check-in' },
  { id: 'BEACONS',     icon: '📡', label: 'Beacony IoT',           desc: 'Fizyczne beacony ESP32 + bramki Raspberry Pi. NFC check-in, LED, provisioning, OTA. Wymagany zakup hardware Reserti.' },
  { id: 'ROOMS',       icon: '🏛',  label: 'Sale konferencyjne',   desc: 'Rezerwacje sal, sloty 30-min' },
  { id: 'PARKING',     icon: '🅿️', label: 'Parkingi',              desc: 'Zarządzanie miejscami parkingowymi' },
  { id: 'FLOOR_PLAN',  icon: '🗺',  label: 'Plan piętra',           desc: 'Interaktywna mapa SVG z pozycjami biurek' },
  { id: 'WEEKLY_VIEW', icon: '📅', label: 'Widok tygodniowy',      desc: 'Siatka tygodnia z rezerwacjami zespołu' },
  { id: 'EQUIPMENT',   icon: '🔧', label: 'Sprzęt',                desc: 'Zarządzanie wyposażeniem biura' },
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
          ? 'bg-brand/5 border-brand/30 ring-1 ring-brand/20'
          : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
      }`}
    >
      <span className="text-xl shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${enabled ? 'text-brand' : 'text-zinc-700'}`}>{label}</p>
        <p className="text-xs text-zinc-400 mt-0.5">{desc}</p>
      </div>
      {/* Toggle pill */}
      <span className={`shrink-0 mt-1 w-9 h-5 rounded-full flex items-center transition-colors ${
        enabled ? 'bg-brand' : 'bg-zinc-300'
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
  const [name,               setName]               = useState(org.name);
  const [plan,               setPlan]               = useState(org.plan ?? 'starter');
  const [notes,              setNotes]              = useState(org.notes ?? '');
  const [passwordExpiryDays, setPasswordExpiryDays] = useState<string>(org.passwordExpiryDays != null ? String(org.passwordExpiryDays) : '');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const { markDirty, resetDirty, requestClose, showConfirm, confirmClose, cancelClose } =
    useDirtyGuard(onClose);

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
    markDirty();
  };

  const toggleAll = () => {
    setModules(allEnabled ? [] : MODULE_DEFS.map(m => m.id));
    markDirty();
  };

  const submit = async () => {
    if (modules.includes('BEACONS') && !modules.includes('DESKS')) {
      setErr(t('beacons_gate.dependency_warning'));
      return;
    }
    setSaving(true); setErr('');
    try {
      // Zapisz nazwę, plan, notatki i politykę haseł
      const expiryDays = passwordExpiryDays ? parseInt(passwordExpiryDays, 10) : null;
      await appApi.owner.updateOrg(org.id, { name, plan, notes, passwordExpiryDays: expiryDays });
      // Zapisz moduły osobno (whitelist po stronie backendu)
      // Pusta tablica gdy wszystkie zaznaczone = backward compat
      const toSave = modules.length === MODULE_DEFS.length ? [] : modules;
      await appApi.owner.setModules(org.id, toSave);
      resetDirty();
      onSaved();
      onClose();
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <Modal title={`Edytuj: ${org.name}`} onClose={requestClose} wide>
      <div className="space-y-4">
        <Input label="Nazwa firmy" value={name} onChange={e => { setName(e.target.value); markDirty(); }} />
        <div>
          <label className="block text-xs text-zinc-500 mb-1 font-medium">Plan</label>
          <select value={plan} onChange={e => { setPlan(e.target.value); markDirty(); }}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="free">Free</option>
            <option value="trial">Trial</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1 font-medium">Notatki</label>
          <textarea value={notes} onChange={e => { setNotes(e.target.value); markDirty(); }} rows={2}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1 font-medium">Wygaśnięcie hasła (dni)</label>
          <input
            type="number" min={1} max={365}
            placeholder="np. 90 (puste = bez rotacji)"
            value={passwordExpiryDays}
            onChange={e => { setPasswordExpiryDays(e.target.value); markDirty(); }}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
          />
          <p className="text-[10px] text-zinc-400 mt-1">Użytkownicy będą proszeni o zmianę hasła po upływie podanej liczby dni. Puste = brak rotacji.</p>
        </div>

        {/* Sekcja modułów */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs text-zinc-500 font-medium uppercase tracking-wider">
              Aktywne moduły
            </label>
            <button type="button" onClick={toggleAll}
              className="text-xs text-brand hover:underline">
              {allEnabled ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
            </button>
          </div>
          <div className="space-y-2">
            {MODULE_DEFS.map(m => (
              <React.Fragment key={m.id}>
                {m.id === 'BEACONS' && (
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest pt-2 pb-1">
                    Hardware IoT
                  </p>
                )}
                {m.id === 'ROOMS' && (
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest pt-2 pb-1 border-t border-zinc-100 mt-1">
                    Moduły przestrzeni
                  </p>
                )}
                <ModuleToggle
                  moduleId={m.id}
                  icon={m.icon}
                  label={m.label}
                  desc={m.desc}
                  enabled={modules.includes(m.id)}
                  onChange={toggleModule}
                />
                {m.id === 'BEACONS' && modules.includes('BEACONS') && !modules.includes('DESKS') && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 -mt-1">
                    ⚠️ {t('beacons_gate.dependency_warning')}
                  </p>
                )}
              </React.Fragment>
            ))}
          </div>
          <p className="text-[10px] text-zinc-400 mt-2">
            Wyłączone moduły są ukryte dla użytkowników tej organizacji.
            Dane nie są usuwane.
          </p>
        </div>

        {err && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
        <div className="flex gap-2 justify-end">
          <Btn variant="secondary" onClick={requestClose}>{t('btn.cancel')}</Btn>
          <Btn onClick={submit} loading={saving}>{t('btn.save')}</Btn>
        </div>
      </div>

      <OrgLogoUpload
        orgId={org.id}
        logoUrl={org.logoUrl ?? null}
        logoBgColor={org.logoBgColor ?? null}
        whitelabelEnabled={org.whitelabelEnabled ?? false}
        onSaved={onSaved}
      />

      {showConfirm && <DirtyGuardDialog onConfirm={confirmClose} onCancel={cancelClose} />}
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

  const PLANS = ['free', 'starter', 'trial', 'pro', 'enterprise'];

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
                  plan === p ? 'border-brand bg-brand/10 text-brand' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
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

// ─── Modal: oznaczanie faktury ────────────────────────────────
function InvoiceModal({ org, type, onClose, onDone }: {
  org:     any;
  type:    'sent' | 'paid';
  onClose(): void;
  onDone():  void;
}) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [sentTo,        setSentTo]        = useState(type === 'sent' ? (org.billingEmail ?? '') : '');
  const [saving,        setSaving]        = useState(false);
  const [err,           setErr]           = useState('');

  const submit = async () => {
    setSaving(true); setErr('');
    try {
      if (type === 'sent') {
        await appApi.subscription.markInvoiceSent(org.id, {
          invoiceNumber: invoiceNumber || undefined,
          sentTo:        sentTo        || undefined,
        });
      } else {
        await appApi.subscription.markInvoicePaid(org.id, {
          invoiceNumber: invoiceNumber || undefined,
        });
      }
      onDone();
      onClose();
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  const title = type === 'sent' ? '📨 Oznacz fakturę jako wysłaną' : '✅ Oznacz fakturę jako opłaconą';

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3">
        <Input
          label="Numer faktury (opcjonalnie)"
          value={invoiceNumber}
          onChange={e => setInvoiceNumber(e.target.value)}
          placeholder="np. FV/2026/05/001"
        />
        {type === 'sent' && (
          <Input
            label="Wyślij na email"
            value={sentTo}
            onChange={e => setSentTo(e.target.value)}
            placeholder={org.billingEmail ?? 'billing@firma.pl'}
          />
        )}
        {err && <p className="text-sm text-red-500">{err}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Btn variant="secondary" onClick={onClose}>Anuluj</Btn>
          <Btn onClick={submit} loading={saving}>Zapisz</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Główna strona ────────────────────────────────────────────
// ─── SubscriptionTab + SubPlanModal — Sprint B3 ─────────────────

function SubPlanModal({ org, onClose, onSaved }: { org: any; onClose(): void; onSaved(): void }) {
  const { t } = useTranslation();
  const [planTemplates, setPlanTemplates] = useState<Record<string, any>>({});
  const [form, setForm] = useState({
    plan:           org.plan           ?? 'starter',
    planExpiresAt:  org.planExpiresAt  ? (typeof org.planExpiresAt === 'string' ? org.planExpiresAt.slice(0,10) : new Date(org.planExpiresAt).toISOString().slice(0,10)) : '',
    limitDesks:     org.limitDesks     != null ? String(org.limitDesks)     : '',
    limitUsers:     org.limitUsers     != null ? String(org.limitUsers)     : '',
    limitGateways:  org.limitGateways  != null ? String(org.limitGateways)  : '',
    limitLocations: org.limitLocations != null ? String(org.limitLocations) : '',
    mrr:            org.mrr            ?? '',
    billingEmail:   org.billingEmail   ?? '',
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toNum = (v: string | number) => v === '' || v === null ? null : Number(v);

  useEffect(() => {
    appApi.subscription.getPlans().then(setPlanTemplates).catch(() => {});
  }, []);

  const applyPlanDefaults = (p: string) => {
    const tpl = planTemplates[p];
    if (!tpl) { set('plan', p); return; }
    setForm(f => ({
      ...f,
      plan:           p,
      limitDesks:     tpl.desks     != null ? String(tpl.desks)     : '',
      limitUsers:     tpl.users     != null ? String(tpl.users)     : '',
      limitGateways:  tpl.gateways  != null ? String(tpl.gateways)  : '',
      limitLocations: tpl.locations != null ? String(tpl.locations) : '',
    }));
  };

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

  const tpl = planTemplates[form.plan];

  return (
    <Modal title={`Subskrypcja: ${org.name}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-zinc-500 mb-1 font-medium">Plan</label>
          <div className="flex gap-2 flex-wrap">
            {['trial','starter','pro','enterprise'].map(p => (
              <button key={p} type="button" onClick={() => applyPlanDefaults(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all capitalize ${
                  form.plan === p ? 'border-brand bg-brand/10 text-brand' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
                }`}>
                {p}
              </button>
            ))}
          </div>
          {tpl && (
            <p className="text-[10px] text-zinc-400 mt-1.5">
              Domyślne limity szablonu: biurka {tpl.desks ?? '∞'} · użytkownicy {tpl.users ?? '∞'} · gatewaye {tpl.gateways ?? '∞'} · biura {tpl.locations ?? '∞'}
            </p>
          )}
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

// ─── Edytor szablonów planów ──────────────────────────────────
function PlanTemplatesTab() {
  const [templates, setTemplates] = useState<Record<string, any>>({});
  const [editing,   setEditing]   = useState<string | null>(null);
  const [form,      setForm]      = useState<any>({});
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState<string | null>(null);
  const [err,       setErr]       = useState('');

  useEffect(() => {
    appApi.subscription.getPlans().then(setTemplates).catch(() => {});
  }, []);

  const startEdit = (plan: string) => {
    setEditing(plan);
    const t = templates[plan] ?? {};
    setForm({
      desks:     t.desks     != null ? String(t.desks)     : '',
      users:     t.users     != null ? String(t.users)     : '',
      gateways:  t.gateways  != null ? String(t.gateways)  : '',
      locations: t.locations != null ? String(t.locations) : '',
      ota:  !!t.ota,
      sso:  !!t.sso,
      smtp: !!t.smtp,
      api:  !!t.api,
    });
    setErr('');
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true); setErr('');
    const toNum = (v: string) => v === '' ? null : Number(v);
    try {
      const updated = await appApi.subscription.updatePlanTemplate(editing, {
        desks:     toNum(form.desks),
        users:     toNum(form.users),
        gateways:  toNum(form.gateways),
        locations: toNum(form.locations),
        ota:  form.ota,
        sso:  form.sso,
        smtp: form.smtp,
        api:  form.api,
      });
      setTemplates(prev => ({ ...prev, [editing]: { ...prev[editing], ...updated } }));
      setSaved(editing);
      setEditing(null);
      setTimeout(() => setSaved(null), 3000);
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  const PLANS = ['free', 'trial', 'starter', 'pro', 'enterprise'];
  const FEATURES: [string, string][] = [['ota','OTA Updates'],['sso','SSO / Azure'],['smtp','Custom SMTP'],['api','API Access']];

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
        Zmiany szablonów wpływają na domyślne limity przy przypisywaniu planu oraz na limity organizacji, które nie mają ustawionych indywidualnych overridów.
      </div>
      {PLANS.map(plan => {
        const tpl = templates[plan] ?? {};
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
                    <Btn size="sm" variant="secondary" onClick={() => setEditing(null)}>Anuluj</Btn>
                    <Btn size="sm" onClick={save} loading={saving}>Zapisz</Btn>
                  </div>
              }
            </div>

            {!isEditing ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {[
                  ['Biurka',       tpl.desks     ?? '∞'],
                  ['Użytkownicy',  tpl.users     ?? '∞'],
                  ['Gatewaye',     tpl.gateways  ?? '∞'],
                  ['Biura',        tpl.locations ?? '∞'],
                ].map(([label, val]) => (
                  <div key={label as string} className="bg-zinc-50 rounded-lg px-3 py-2">
                    <p className="text-zinc-400 mb-0.5">{label}</p>
                    <p className="font-semibold text-zinc-700">{val}</p>
                  </div>
                ))}
                <div className="col-span-2 sm:col-span-4 flex gap-3 mt-1">
                  {FEATURES.map(([key, label]) => (
                    <span key={key} className={`text-[10px] px-2 py-0.5 rounded font-medium ${tpl[key] ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-400'}`}>
                      {tpl[key] ? '✓' : '✗'} {label}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    ['desks',     'Biurka (puste=∞)'],
                    ['users',     'Użytkownicy'],
                    ['gateways',  'Gatewaye'],
                    ['locations', 'Biura'],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-[11px] text-zinc-500 mb-1">{label}</label>
                      <input type="number" value={form[key]}
                        onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
                        placeholder="∞"
                        className="w-full border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B03472]/20" />
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  {FEATURES.map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-zinc-600">
                      <input type="checkbox" checked={!!form[key]}
                        onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.checked }))}
                        className="rounded" />
                      {label}
                    </label>
                  ))}
                </div>
                {err && <p className="text-xs text-red-500">{err}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
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

const STEPS = [
  { key: 'registered',      label: 'Rejestracja',      icon: '📝' },
  { key: 'emailVerified',   label: 'Email OK',          icon: '✉️' },
  { key: 'hasBillingEmail', label: 'Email faktury',     icon: '💳' },
  { key: 'hasDesks',        label: 'Biurka dodane',     icon: '🪑' },
  { key: 'hasGateway',      label: 'Gateway',           icon: '📡' },
  { key: 'hasMrr',          label: 'MRR ustawione',     icon: '💰' },
  { key: 'invoiceSent',     label: 'Faktura wysłana',   icon: '📨' },
  { key: 'invoicePaid',     label: 'Faktura opłacona',  icon: '✅' },
];

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

const LOG_LIMIT = 50;

export function OwnerPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [stats, setStats]       = useState<any>(null);
  const [orgs,  setOrgs]        = useState<any[]>([]);
  const [subDash, setSubDash]   = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'orgs'|'sub'|'plans'|'insights'|'log'|'unverified'|'onboarding'>(
    searchParams.get('tab') === 'sub' ? 'sub' : 'orgs'
  );
  const [unverified,      setUnverified]      = useState<any[]>([]);
  const [unverifiedCount, setUnverifiedCount] = useState(0);
  const [deletingId,      setDeletingId]      = useState<string | null>(null);
  const [onboarding,      setOnboarding]      = useState<any[]>([]);
  const [globalLog,       setGlobalLog]       = useState<any[]>([]);
  const [logTotal,        setLogTotal]        = useState(0);
  const [logOffset,       setLogOffset]       = useState(0);
  const [logTypeFilter,   setLogTypeFilter]   = useState('');
  const [logOrgFilter,    setLogOrgFilter]    = useState('');
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editOrg, setEditOrg]       = useState<any>(null);
  const [subEditOrg, setSubEditOrg] = useState<any>(null);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [invoiceModal,  setInvoiceModal]  = useState<{ org: any; type: 'sent' | 'paid' } | null>(null);

  const loadLog = useCallback(async (offset = logOffset, type = logTypeFilter, orgId = logOrgFilter) => {
    try {
      const r = await appApi.subscription.getGlobalLog({ limit: LOG_LIMIT, offset, type: type || undefined, orgId: orgId || undefined });
      setGlobalLog(r.events);
      setLogTotal(r.total);
    } catch (err) {
      console.warn('loadLog failed', err);
    }
  }, [logOffset, logTypeFilter, logOrgFilter]);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const [s, o, sd] = await Promise.all([
        appApi.owner.getStats(),
        appApi.owner.listOrgs(),
        appApi.subscription.getDashboard(),
      ]);
      const orgList = Array.isArray(o) ? o : [];
      setStats(s);
      setOrgs(orgList);
      setSubDash(sd);
      setEditOrg(prev => prev ? (orgList.find(x => x.id === prev.id) ?? prev) : null);
      appApi.owner.getUnverifiedAccounts().then(d => { setUnverified(d); setUnverifiedCount(d.length); }).catch(e => console.warn('getUnverifiedAccounts failed', e));
      appApi.owner.getOnboardingStatus().then(setOnboarding).catch(e => console.warn('getOnboardingStatus failed', e));
    } catch (e: any) {
      setErr(e.message || t('qr.no_connection'));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (activeTab === 'log') loadLog(); }, [activeTab, loadLog]);

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

  const handleToggleWhitelabel = async (org: any) => {
    const next = !org.whitelabelEnabled;
    setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, whitelabelEnabled: next } : o));
    try {
      await appApi.organizations.setWhitelabel(org.id, next);
    } catch (e: any) {
      setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, whitelabelEnabled: !next } : o));
      setErr(e.message);
    }
  };

  const handleForcePasswordReset = async (org: any) => {
    if (!confirm(`Wymusić zmianę hasła dla wszystkich użytkowników "${org.name}"?`)) return;
    try {
      const r = await appApi.owner.forcePasswordReset(org.id);
      alert(`Gotowe — ${r.affected} użytkownik(ów) zostanie poproszonych o zmianę hasła przy następnym logowaniu.`);
    } catch (e: any) { setErr(e.message); }
  };

  const handleForcePasswordResetAll = async () => {
    if (!confirm('Wymusić zmianę hasła dla WSZYSTKICH użytkowników na całej platformie?')) return;
    try {
      const r = await appApi.owner.forcePasswordResetAll();
      alert(`Gotowe — ${r.affected} użytkownik(ów) na całej platformie zostanie poproszonych o zmianę hasła.`);
    } catch (e: any) { setErr(e.message); }
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
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
          {statCards.map(({ label, val, sub, icon }) => (
            <div key={label} className="bg-white border border-zinc-100 rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div className="min-w-0">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wide font-semibold truncate">{label}</p>
                  <p className="text-2xl font-bold text-zinc-800 mt-1">{val ?? '—'}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>
                </div>
                <span className="text-xl shrink-0 ml-1">{icon}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs + filtry */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1 bg-zinc-100 rounded-xl p-1 overflow-x-auto">
          {([
            ['orgs',        '🏢 Organizacje'],
            ['sub',         '💳 Subskrypcje'],
            ['plans',       '📋 Szablony planów'],
            ['insights',    '🤖 AI Insights'],
            ['log',         '📋 Log'],
            ['unverified',  `⏳ Niezweryfikowane${unverifiedCount > 0 ? ` (${unverifiedCount})` : ''}`],
            ['onboarding',  '🚀 Onboarding'],
          ] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab as any)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'orgs' && (
          <div className="flex gap-2 items-center flex-1 min-w-0">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Szukaj firmy…"
              className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none flex-1 min-w-[160px] max-w-[280px]"
            />
            <button onClick={load}
              className="text-xs px-3 py-1.5 border border-zinc-200 rounded-lg text-zinc-500 hover:bg-zinc-50 shrink-0">
              ↺
            </button>
            <span className="text-xs text-zinc-400 shrink-0">{filtered.length} firm</span>
            <Btn size="sm" variant="danger" onClick={handleForcePasswordResetAll}>
              🔐 Reset haseł (wszystkie)
            </Btn>
          </div>
        )}
      </div>

      {/* Tabela organizacji */}
      {activeTab === 'orgs' && <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-zinc-400 text-sm">Ładowanie…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-zinc-400 text-sm">
            {err ? t('qr.error_title') : 'Brak organizacji'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/80">
                  {['Firma', 'Slug', 'Plan', 'Użytkownicy', 'Status', 'White-label', 'Akcje'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map(org => (
                  <tr key={org.id} className={`hover:bg-zinc-50/60 transition-colors ${!org.isActive ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-zinc-800 text-sm">{org.name}</div>
                      {org.notes && <div className="text-xs text-zinc-400 mt-0.5 truncate max-w-[180px]">{org.notes}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-md">{org.slug}</code>
                    </td>
                    <td className="px-4 py-3">
                      <PlanBadge plan={org.plan ?? 'basic'} />
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-500 tabular-nums">
                      {org.usersCount ?? org._count?.users ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        org.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${org.isActive ? 'bg-emerald-500' : 'bg-red-400'}`} />
                        {org.isActive ? 'Aktywna' : 'Nieaktywna'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleWhitelabel(org)}
                        title={org.whitelabelEnabled ? 'White-label aktywny' : 'White-label wyłączony'}
                        className={`relative w-9 h-5 rounded-full transition-colors ${org.whitelabelEnabled ? 'bg-brand' : 'bg-zinc-300'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${org.whitelabelEnabled ? 'left-4' : 'left-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 items-center flex-wrap">
                        <Btn size="sm" onClick={() => handleImpersonate(org)} loading={impersonating === org.id}>
                          🔑 Wejdź
                        </Btn>
                        <Btn size="sm" variant="secondary" onClick={() => setEditOrg(org)}>
                          ✏️ Edytuj
                        </Btn>
                        {org.isActive
                          ? <Btn size="sm" variant="danger" onClick={() => handleDeactivate(org)}>Dezaktywuj</Btn>
                          : <Btn size="sm" variant="secondary" onClick={() => handleActivate(org)}>Aktywuj</Btn>
                        }
                        <Btn size="sm" variant="secondary" onClick={() => handleForcePasswordReset(org)}>
                          🔐 Reset haseł
                        </Btn>
                        <button
                          onClick={() => setInvoiceModal({ org, type: 'sent' })}
                          className="text-xs px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          📨 Wysłana
                        </button>
                        <button
                          onClick={() => setInvoiceModal({ org, type: 'paid' })}
                          className="text-xs px-2 py-1 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          ✅ Opłacona
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      {/* Zakładka Szablony planów */}
      {activeTab === 'plans' && <PlanTemplatesTab />}

      {/* Zakładka AI Insights — per lokalizacja wszystkich org */}
      {activeTab === 'insights' && (
        <div className="bg-white border border-zinc-100 rounded-xl p-5">
          <OrgInsightsWidget />
        </div>
      )}

      {/* Zakładka: Niezweryfikowane konta */}
      {activeTab === 'unverified' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-800">
              Konta bez potwierdzonego emaila
              {unverified.length > 0 && (
                <span className="ml-2 text-sm bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{unverified.length}</span>
              )}
            </h2>
            <button onClick={() => appApi.owner.getUnverifiedAccounts().then(d => { setUnverified(d); setUnverifiedCount(d.length); })}
              className="text-xs text-brand hover:underline">Odśwież</button>
          </div>
          {unverified.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-sm">Brak kont oczekujących na weryfikację</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 text-xs text-zinc-500 uppercase tracking-wide">
                    <th className="py-2.5 px-4 text-left">Email</th>
                    <th className="py-2.5 px-4 text-left">Organizacja</th>
                    <th className="py-2.5 px-4 text-left">Plan</th>
                    <th className="py-2.5 px-4 text-left">Wiek</th>
                    <th className="py-2.5 px-4 text-left">Status</th>
                    <th className="py-2.5 px-4 text-right">Akcja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {unverified.map(u => (
                    <tr key={u.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-800">{u.email}</div>
                        <div className="text-xs text-zinc-400">{u.firstName} {u.lastName}</div>
                      </td>
                      <td className="py-3 px-4 text-zinc-600">{u.organization?.name ?? '—'}</td>
                      <td className="py-3 px-4">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium capitalize">{u.organization?.plan ?? '—'}</span>
                      </td>
                      <td className="py-3 px-4 text-zinc-500">{u.ageHours < 1 ? '< 1h' : `${u.ageHours}h`}</td>
                      <td className="py-3 px-4">
                        {u.isExpired
                          ? <span className="text-xs text-red-600 font-medium">⚠ Link wygasł</span>
                          : <span className="text-xs text-amber-600 font-medium">⏳ Oczekuje</span>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={async () => {
                            if (!confirm(`Usunąć konto ${u.email}?`)) return;
                            setDeletingId(u.id);
                            try {
                              await appApi.owner.deleteUnverifiedAccount(u.id);
                              setUnverified(prev => prev.filter(x => x.id !== u.id));
                              setUnverifiedCount(c => c - 1);
                            } catch (e: any) { alert(e.message ?? 'Błąd usuwania'); }
                            setDeletingId(null);
                          }}
                          disabled={deletingId === u.id}
                          className="text-xs px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-medium disabled:opacity-50 transition-colors"
                        >
                          {deletingId === u.id ? '…' : 'Usuń'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Zakładka: Status onboardingu */}
      {activeTab === 'onboarding' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-800">Status onboardingu organizacji</h2>
          {onboarding.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 text-sm">Brak danych</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 text-xs text-zinc-500 uppercase tracking-wide">
                    <th className="py-2.5 px-4 text-left">Organizacja</th>
                    <th className="py-2.5 px-4 text-left">Plan</th>
                    {STEPS.map(s => (
                      <th key={s.key} className="py-2.5 px-3 text-center" title={s.label}>{s.icon}</th>
                    ))}
                    <th className="py-2.5 px-4 text-right">Ukończono</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {onboarding.map(org => {
                    const done = STEPS.filter(s => org.steps[s.key]).length;
                    const pct  = Math.round((done / STEPS.length) * 100);
                    return (
                      <tr key={org.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-zinc-800">{org.name}</div>
                          <div className="text-xs text-zinc-400">{org.adminEmail ?? '—'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 capitalize">{org.plan}</span>
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
      )}

      {/* Zakładka: Globalny log zdarzeń */}
      {activeTab === 'log' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap items-center">
            <h2 className="text-lg font-semibold text-zinc-800 mr-2">Globalny log zdarzeń</h2>
            <select
              value={logTypeFilter}
              onChange={e => { setLogTypeFilter(e.target.value); setLogOffset(0); }}
              className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-600 focus:outline-none"
            >
              <option value="">Wszystkie typy</option>
              {Object.entries(EVENT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={logOrgFilter}
              onChange={e => { setLogOrgFilter(e.target.value); setLogOffset(0); }}
              className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-600 focus:outline-none"
            >
              <option value="">Wszystkie org</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <span className="text-xs text-zinc-400 ml-auto">{logTotal} zdarzeń</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 text-xs text-zinc-500 uppercase tracking-wide">
                  <th className="py-2.5 px-4 text-left">Data</th>
                  <th className="py-2.5 px-4 text-left">Organizacja</th>
                  <th className="py-2.5 px-4 text-left">Zdarzenie</th>
                  <th className="py-2.5 px-4 text-left">Plan</th>
                  <th className="py-2.5 px-4 text-left">Notatka</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {globalLog.map(ev => (
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
                {globalLog.length === 0 && (
                  <tr><td colSpan={5} className="py-12 text-center text-zinc-400 text-sm">Brak zdarzeń</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {logTotal > LOG_LIMIT && (
            <div className="flex items-center gap-3 justify-center pt-2">
              <button
                onClick={() => setLogOffset(o => Math.max(0, o - LOG_LIMIT))}
                disabled={logOffset === 0}
                className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40"
              >← Wcześniej</button>
              <span className="text-xs text-zinc-500">{logOffset + 1}–{Math.min(logOffset + LOG_LIMIT, logTotal)} z {logTotal}</span>
              <button
                onClick={() => setLogOffset(o => o + LOG_LIMIT)}
                disabled={logOffset + LOG_LIMIT >= logTotal}
                className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40"
              >Później →</button>
            </div>
          )}
        </div>
      )}

      {showCreate && <CreateOrgModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {editOrg    && <EditOrgModal org={editOrg} onClose={() => setEditOrg(null)} onSaved={load} />}

      {/* Modal edycji planu subskrypcji */}
      {subEditOrg && <SubPlanModal org={subEditOrg} onClose={() => setSubEditOrg(null)} onSaved={load} />}

      {/* Modal oznaczania faktury */}
      {invoiceModal && (
        <InvoiceModal
          org={invoiceModal.org}
          type={invoiceModal.type}
          onClose={() => setInvoiceModal(null)}
          onDone={() => { setLogOffset(0); loadLog(0); }}
        />
      )}
    </div>
  );
}
