import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { PageHeader, Btn, Card, Modal, Input } from '../components/ui';
import { useDirtyGuard } from '../hooks/useDirtyGuard';
import { DirtyGuardDialog } from '../components/ui/DirtyGuardDialog';
import { parseApiError, FieldErrors } from '../utils/parseApiError';
import { FieldError } from '../components/ui/FieldError';
import { toast } from '../components/ui/Toast';

function getUser() {
  try { return JSON.parse(localStorage.getItem('app_user') ?? 'null'); } catch { return null; }
}

// FEATURE P4-B3: ISO 3166-1 alpha-2 country codes for holiday-aware workday counting
const COUNTRY_OPTIONS = [
  { code: 'PL', label: 'Polska (PL)' },
  { code: 'DE', label: 'Niemcy (DE)' },
  { code: 'GB', label: 'Wielka Brytania (GB)' },
  { code: 'FR', label: 'Francja (FR)' },
  { code: 'CZ', label: 'Czechy (CZ)' },
  { code: 'SK', label: 'Słowacja (SK)' },
  { code: 'HU', label: 'Węgry (HU)' },
  { code: 'RO', label: 'Rumunia (RO)' },
  { code: 'AT', label: 'Austria (AT)' },
  { code: 'NL', label: 'Holandia (NL)' },
  { code: 'BE', label: 'Belgia (BE)' },
  { code: 'ES', label: 'Hiszpania (ES)' },
  { code: 'IT', label: 'Włochy (IT)' },
  { code: 'PT', label: 'Portugalia (PT)' },
  { code: 'SE', label: 'Szwecja (SE)' },
  { code: 'NO', label: 'Norwegia (NO)' },
  { code: 'DK', label: 'Dania (DK)' },
  { code: 'FI', label: 'Finlandia (FI)' },
  { code: 'US', label: 'USA (US)' },
  { code: 'CA', label: 'Kanada (CA)' },
  { code: 'AU', label: 'Australia (AU)' },
  { code: 'SG', label: 'Singapur (SG)' },
  { code: 'JP', label: 'Japonia (JP)' },
  { code: 'IN', label: 'Indie (IN)' },
  { code: 'AE', label: 'Zjednoczone Emiraty (AE)' },
];

// ── Modal: konfiguracja Azure SSO ────────────────────────────
function AzureConfigModal({ location, onClose }: { location: any; onClose: () => void }) {
  const [config,   setConfig]   = useState<any>(null);
  const [tenantId, setTenantId] = useState('');
  const [enabled,  setEnabled]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [testing,  setTesting]  = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);
  const [err, setErr]           = useState('');

  // Znajdź organizationId przez location — API konfiguracji jest per-org
  const { t } = useTranslation();
  const orgId = location.organizationId;

  useEffect(() => {
    if (!orgId) return;
    appApi.orgs.getAzureConfig(orgId)
      .then(c => { setConfig(c); setTenantId(c.azureTenantId ?? ''); setEnabled(c.azureEnabled); })
      .catch(() => {});
  }, [orgId]);

  const save = async () => {
    setSaving(true); setErr('');
    try {
      await appApi.orgs.updateAzureConfig(orgId, { azureTenantId: tenantId || null, azureEnabled: enabled });
      onClose();
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  const test = async () => {
    if (!tenantId) return;
    setTesting(true); setTestResult(null);
    try {
      // Sprawdź czy JWKS endpoint odpowiada dla tego tenanta
      const r = await fetch(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`);
      setTestResult(r.ok ? 'ok' : 'fail');
    } catch { setTestResult('fail'); }
    setTesting(false);
  };

  return (
    <Modal title={`Microsoft 365 SSO — ${location.name}`} onClose={onClose}>
      <div className="space-y-4">
        {/* Instrukcja */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700 space-y-1.5">
          <p className="font-semibold">Jak skonfigurować (IT Admin firmy):</p>
          <p>1. Otwórz link w przeglądarce zalogowanej jako Global Admin Entra ID:</p>
          <code className="block bg-blue-100 rounded px-2 py-1 text-[10px] break-all">
            {`https://login.microsoftonline.com/organizations/adminconsent?client_id=${import.meta.env.VITE_AZURE_CLIENT_ID ?? 'CLIENT_ID'}&redirect_uri=${encodeURIComponent(window.location.origin)}`}
          </code>
          <p>2. Kliknij "Akceptuj" → Skopiuj <strong>Tenant ID</strong> z URL lub Azure Portal</p>
          <p>3. Wklej Tenant ID poniżej i włącz SSO</p>
        </div>

        {err && <p className="text-sm text-red-500 bg-red-50 p-2.5 rounded-lg">{err}</p>}

        <div>
          <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Azure Tenant ID</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={tenantId}
              onChange={e => { setTenantId(e.target.value); setTestResult(null); }}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <button
              onClick={test}
              disabled={testing || !tenantId}
              className="text-xs px-3 py-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-600 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {testing ? '…' : t('btn.retry')}
            </button>
          </div>
          {testResult === 'ok'   && <p className="text-xs text-emerald-600 mt-1">✓ Tenant ID poprawny — Entra ID odpowiada</p>}
          {testResult === 'fail' && <p className="text-xs text-red-500 mt-1">✗ Nie można połączyć z tym tenant ID</p>}
          <p className="text-[10px] text-zinc-400 mt-1">
            Znajdziesz w: Azure Portal → Azure Active Directory → Overview → Tenant ID
          </p>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 bg-zinc-50">
          <div>
            <p className="text-sm font-medium text-zinc-700">Logowanie przez Microsoft</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {enabled ? 'Przycisk "Zaloguj przez Microsoft" widoczny na stronie logowania' : 'Wyłączone — tylko email i hasło'}
            </p>
          </div>
          <button
            onClick={() => setEnabled(e => !e)}
            className={`relative w-10 h-6 rounded-full transition-colors ${enabled ? 'bg-brand' : 'bg-zinc-300'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${enabled ? 'left-5' : 'left-1'}`} />
          </button>
        </div>

        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <span className="text-amber-500 shrink-0 mt-0.5">⚠</span>
          <p className="text-xs text-amber-700">
            Logowanie hasłem pozostaje aktywne — użytkownicy mogą używać obu metod.
            Wyłączenie hasła planowane w przyszłej wersji.
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <Btn variant="secondary" onClick={onClose}>{t('btn.cancel')}</Btn>
          <Btn onClick={save} loading={saving} disabled={enabled && !tenantId}>{t('btn.save')}</Btn>
        </div>
      </div>
    </Modal>
  );
}

function InstallTokenModal({ location, onClose }: { location: any; onClose: () => void }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [token,   setToken]   = useState<any>(null);
  const [copied,  setCopied]  = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    appApi.gateways.createSetupToken(location.id)
      .then(t => { setToken(t); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [location.id]);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Modal title={`Dodaj gateway — ${location.name}`} onClose={onClose}>
      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>
      )}
      {token && (
        <div className="space-y-5">
          {/* Instrukcja */}
          <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
            <p className="text-sm font-semibold text-zinc-700 mb-2">Jak zainstalować gateway:</p>
            <ol className="text-sm text-zinc-600 space-y-1.5 list-decimal list-inside">
              <li>Włącz Raspberry Pi i połącz z internetem</li>
              <li>Otwórz terminal (SSH lub lokalnie)</li>
              <li>Wklej poniższą komendę i naciśnij Enter</li>
              <li>Skrypt zapyta tylko o nazwę WiFi (jeśli na kablu — pomija)</li>
            </ol>
          </div>

          {/* Komenda instalacyjna */}
          <div>
            <p className="text-xs text-zinc-400 mb-1.5 font-medium">Komenda instalacyjna (ważna 24h, jednorazowa)</p>
            <div className="bg-zinc-950 rounded-xl p-4 flex items-start gap-3">
              <code className="text-emerald-400 text-xs font-mono flex-1 break-all leading-relaxed">
                {token.installCmd}
              </code>
              <button
                onClick={() => copy(token.installCmd)}
                className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors font-medium"
              >
                {copied ? '✓' : '⎘'}
              </button>
            </div>
          </div>

          {/* Informacje */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-zinc-50 rounded-lg p-3">
              <p className="text-zinc-400 mb-0.5">{t('organizations.label_office')}</p>
              <p className="font-medium text-zinc-700">{token.location?.name}</p>
            </div>
            <div className="bg-zinc-50 rounded-lg p-3">
              <p className="text-zinc-400 mb-0.5">{t('organizations.valid_until')}</p>
              <p className="font-medium text-zinc-700">
                {new Date(token.expiresAt).toLocaleString('pl-PL', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <span className="text-amber-500 shrink-0">⚠</span>
            <p className="text-xs text-amber-700">{t('organizations.gateway_token_single_use')}</p>
          </div>

          <div className="flex justify-end">
            <Btn onClick={onClose}>{t('btn.cancel')}</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function OrganizationsPage() {
  const user = getUser();
  const { t, i18n } = useTranslation();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [locations, setLocations] = useState<any[]>([]);
  const [orgs,      setOrgs]      = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState<'create'|'edit'|null>(null);
  const [target,    setTarget]    = useState<any>(null);
  const [form,      setForm]      = useState({
    name: '', address: '', city: '', openTime: '08:00', closeTime: '17:00', organizationId: '', maxDaysAhead: 14, maxHoursPerDay: 8, timezone: 'Europe/Warsaw', country: '', parkingBookingMode: 'HOURLY',
  });
  const [saving,       setSaving]       = useState(false);
  const [err,          setErr]          = useState('');
  const [fieldErrors,  setFieldErrors]  = useState<FieldErrors>({});
  const [installModal,    setInstallModal]    = useState<any>(null);
  const [azureModal,      setAzureModal]      = useState<any>(null);
  const [wifiSsid,        setWifiSsid]        = useState('');
  const [wifiPass,        setWifiPass]        = useState('');
  const [wifiPassVisible, setWifiPassVisible] = useState(false);
  const [editTab,         setEditTab]         = useState<'basic'|'hours'|'iot'|'resources'>('basic');

  const closeModal = () => setModal(null);
  const { markDirty, resetDirty, requestClose, showConfirm, confirmClose, cancelClose } =
    useDirtyGuard(closeModal);

  const load = async () => {
    setLoading(true);
    try {
      const [locs, os] = await Promise.all([
        appApi.locations.listAll(),
        isSuperAdmin ? appApi.orgs.list() : Promise.resolve([]),
      ]);
      setLocations(locs);
      setOrgs(os);
    } catch (e: any) { console.error('Failed to load locations:', e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    resetDirty();
    setForm({ name:'', address:'', city:'', openTime:'08:00', closeTime:'17:00', maxDaysAhead: 14, maxHoursPerDay: 8, timezone: 'Europe/Warsaw', country: '', parkingBookingMode: 'HOURLY',
      organizationId: user?.organizationId ?? '' });
    setWifiSsid(''); setWifiPass(''); setWifiPassVisible(false);
    setErr('');
    setEditTab('basic');
    setModal('create');
  };

  const openEdit = (loc: any) => {
    resetDirty();
    setTarget(loc);
    setForm({
      name: loc.name, address: loc.address ?? '', city: loc.city ?? '',
      openTime: loc.openTime ?? '08:00', closeTime: loc.closeTime ?? '17:00',
      maxDaysAhead: loc.maxDaysAhead ?? 14, maxHoursPerDay: loc.maxHoursPerDay ?? 8,
      timezone: loc.timezone ?? 'Europe/Warsaw',
      country: loc.country ?? '',
      parkingBookingMode: loc.parkingBookingMode ?? 'HOURLY',
      organizationId: loc.organizationId,
    });
    setWifiSsid(''); setWifiPass(''); setWifiPassVisible(false);
    setErr('');
    setEditTab('basic');
    setModal('edit');
    // Pre-fill WiFi credentials from backend (decrypted)
    appApi.locations.getWifiCredentials(loc.id)
      .then(c => { setWifiSsid(c.wifiSsid ?? ''); setWifiPass(c.wifiPass ?? ''); })
      .catch(() => {});
  };

  const save = async () => {
    setSaving(true); setErr(''); setFieldErrors({});
    try {
      if (modal === 'create') {
        const orgId = form.organizationId || user?.organizationId;
        await appApi.locations.create({
          name: form.name, address: form.address, city: form.city,
          openTime: form.openTime, closeTime: form.closeTime,
          maxDaysAhead: form.maxDaysAhead, maxHoursPerDay: form.maxHoursPerDay,
          timezone: form.timezone,
          country: form.country || undefined,
          organizationId: orgId,
          wifiSsid: wifiSsid || undefined,
          wifiPass: wifiPass || undefined,
          parkingBookingMode: form.parkingBookingMode,
        });
      } else if (target) {
        await appApi.locations.update(target.id, {
          name: form.name, address: form.address, city: form.city,
          openTime: form.openTime, closeTime: form.closeTime,
          maxDaysAhead: form.maxDaysAhead, maxHoursPerDay: form.maxHoursPerDay,
          timezone: form.timezone,
          country: form.country || null,
          wifiSsid: wifiSsid,
          wifiPass: wifiPass,
          parkingBookingMode: form.parkingBookingMode,
        });
      }
      resetDirty();
      setModal(null);
      toast(t('toast.location_saved', 'Biuro zapisano'));
      await load();
    } catch (e: any) { const p = parseApiError(e); setErr(p.global); setFieldErrors(p.fields); }
    setSaving(false);
  };

  return (
    <div>
      <PageHeader
        title={t('pages.organizations.title')}
        sub={t('organizations.subtitle')}
        action={<Btn onClick={openCreate}>{t('organizations.new_location')}</Btn>}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-5 h-5 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {locations.map(loc => (
            <Card key={loc.id} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand font-bold text-lg shrink-0">
                {loc.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-zinc-800 truncate">{loc.name}</p>
                  {!loc.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">{t('organizations.inactive')}</span>
                  )}
                  {isSuperAdmin && loc.organization && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-medium">
                      {loc.organization.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {[loc.address, loc.city].filter(Boolean).join(', ') || t('organizations.no_address')}
                </p>
                {/* ID do prowizjonowania */}
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">{t('organizations.id_label')}</span>
                  <code className="text-[10px] font-mono text-zinc-500 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded select-all">{loc.id}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(loc.id); }}
                    className="text-[10px] text-zinc-400 hover:text-brand transition-colors"
                    title="Kopiuj ID"
                  >⎘</button>
                </div>
              </div>
              {/* Godziny i limity */}
              <div className="shrink-0 text-center px-4 border-l border-zinc-100">
                <p className="text-sm font-mono font-semibold text-zinc-700">
                  {loc.openTime ?? '08:00'} – {loc.closeTime ?? '17:00'}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">godziny pracy</p>
                <p className="text-xs text-zinc-500 mt-1 font-medium">
                  max {loc.maxDaysAhead ?? 14}d · {loc.maxHoursPerDay ?? 8}h
                </p>
                <p className="text-[10px] text-zinc-400 mt-1">
                  {loc.timezone ?? 'Europe/Warsaw'}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <p className="text-xs text-zinc-400">
                  {new Date(loc.createdAt).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'pl-PL')}
                </p>
                <Btn variant="ghost" size="sm" onClick={() => setAzureModal(loc)}>{t('organizations_extra.m365_button')}</Btn>
                <Btn variant="ghost" size="sm" onClick={() => setInstallModal(loc)}>+ Gateway</Btn>
                <Btn variant="ghost" size="sm" onClick={() => openEdit(loc)}>{t('organizations_extra.edit')}</Btn>
              </div>
            </Card>
          ))}
          {locations.length === 0 && (
            <div className="text-center py-16 text-zinc-400">
              <p className="text-3xl mb-2">🏢</p>
              <p className="text-sm">{t('organizations.no_locations')}</p>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit modal */}
      {(() => {
        const calcOpenHours = (open: string, close: string): string => {
          const [oh, om] = open.split(':').map(Number);
          const [ch, cm] = close.split(':').map(Number);
          const mins = (ch * 60 + cm) - (oh * 60 + om);
          if (mins <= 0) return '—';
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          return m > 0 ? `${h}h ${m}m` : `${h}h`;
        };

        return (
          <Modal
            open={modal !== null}
            title=""
            onClose={requestClose}
            wide
            noPadding
          >
            <div>
              {/* ── Header z quick-stats ─────────────────────────── */}
              <div className="px-5 pt-4 pb-3 border-b border-zinc-100">
                <div>
                  <h2 className="text-base font-semibold text-zinc-800">
                    {modal === 'create'
                      ? t('organizations_extra.new_title')
                      : form.name || t('organizations_extra.edit_title', { name: target?.name })}
                  </h2>
                  {modal === 'edit' && target && (
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {[form.address, form.city].filter(Boolean).join(', ')}
                      {target._count?.desks > 0 && ` · ${target._count.desks} biurek`}
                    </p>
                  )}
                </div>

                {/* Quick stats — tylko przy edycji */}
                {modal === 'edit' && target && (
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {[
                      { num: target._count?.desks ?? 0,    label: 'biurek' },
                      { num: target._count?.gateways ?? 0, label: 'gatewayów' },
                      { num: `${form.openTime}–${form.closeTime}`, label: calcOpenHours(form.openTime, form.closeTime) },
                      { num: `${form.maxDaysAhead}d`,      label: 'z góry' },
                    ].map(({ num, label }) => (
                      <div key={label}
                        className="bg-zinc-50 rounded-lg px-2 py-2 text-center border border-zinc-100">
                        <p className="text-sm font-semibold text-zinc-800 leading-none">{num}</p>
                        <p className="text-[10px] text-zinc-400 mt-1">{label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Tab bar ──────────────────────────────────────── */}
              <div className="flex border-b border-zinc-100 bg-zinc-50 overflow-x-auto">
                {([
                  { id: 'basic',     label: 'Podstawowe',      icon: '🏢' },
                  { id: 'hours',     label: 'Godziny i limity', icon: '🕐' },
                  { id: 'iot',       label: 'IoT i WiFi',       icon: '📡' },
                  { id: 'resources', label: 'Zasoby',           icon: '🪑' },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setEditTab(tab.id)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium
                                border-b-2 transition-colors whitespace-nowrap ${
                      editTab === tab.id
                        ? 'border-brand text-brand bg-white'
                        : 'border-transparent text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    <span style={{ fontSize: 13 }}>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ── Tab content ──────────────────────────────────── */}
              <div className="px-5 pt-4 pb-2">
                {err && (
                  <p className="mb-3 text-sm text-red-500 bg-red-50 border border-red-200
                                 rounded-lg px-3 py-2">{err}</p>
                )}

                {/* ── TAB: Podstawowe ── */}
                {editTab === 'basic' && (
                  <div className="flex flex-col gap-3">
                    {isSuperAdmin && modal === 'create' && (
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1 font-medium">
                          {t('organizations.form.org_label')}
                        </label>
                        <p className="px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-600">
                          {orgs.find((o: any) => o.id === form.organizationId)?.name ?? form.organizationId}
                        </p>
                      </div>
                    )}
                    <div>
                      <Input
                        label={t('organizations.form.name_label')}
                        value={form.name}
                        onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFieldErrors(fe => ({ ...fe, name: '' })); markDirty(); }}
                        placeholder={t('organizations.form.name_ph')}
                      />
                      <FieldError error={fieldErrors.name} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label={t('organizations.form.address_label')}
                        value={form.address}
                        onChange={e => { setForm(f => ({ ...f, address: e.target.value })); markDirty(); }}
                        placeholder={t('organizations.form.address_ph')}
                      />
                      <Input
                        label={t('organizations.form.city_label')}
                        value={form.city}
                        onChange={e => { setForm(f => ({ ...f, city: e.target.value })); markDirty(); }}
                        placeholder={t('organizations.form.city_ph')}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1 font-medium">
                          {t('organizations.form.timezone')}
                        </label>
                        <select
                          value={form.timezone}
                          onChange={e => { setForm(f => ({ ...f, timezone: e.target.value })); markDirty(); }}
                          className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm
                                     focus:outline-none focus:ring-2 focus:ring-brand/30"
                        >
                          <option value="Europe/Warsaw">Europe/Warsaw (UTC+1/+2)</option>
                          <option value="Europe/London">Europe/London (UTC+0/+1)</option>
                          <option value="Europe/Berlin">Europe/Berlin (UTC+1/+2)</option>
                          <option value="Europe/Prague">Europe/Prague (UTC+1/+2)</option>
                          <option value="Europe/Budapest">Europe/Budapest (UTC+1/+2)</option>
                          <option value="Europe/Bucharest">Europe/Bucharest (UTC+2/+3)</option>
                          <option value="Europe/Helsinki">Europe/Helsinki (UTC+2/+3)</option>
                          <option value="Europe/Moscow">Europe/Moscow (UTC+3)</option>
                          <option value="America/New_York">America/New_York (UTC-5/-4)</option>
                          <option value="America/Chicago">America/Chicago (UTC-6/-5)</option>
                          <option value="America/Los_Angeles">America/Los_Angeles (UTC-8/-7)</option>
                          <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
                          <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
                          <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                          <option value="Australia/Sydney">Australia/Sydney (UTC+10/+11)</option>
                          <option value="UTC">UTC</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1 font-medium">
                          {t('organizations.form.country_label')}
                        </label>
                        <select
                          value={form.country}
                          onChange={e => { setForm(f => ({ ...f, country: e.target.value })); markDirty(); }}
                          className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm
                                     focus:outline-none focus:ring-2 focus:ring-brand/30"
                        >
                          <option value="">{t('organizations.form.country_auto')}</option>
                          {COUNTRY_OPTIONS.map(c => (
                            <option key={c.code} value={c.code}>{c.label}</option>
                          ))}
                        </select>
                        <p className="text-[10px] text-zinc-400 mt-1">
                          {t('organizations.form.country_hint')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB: Godziny i limity ── */}
                {editTab === 'hours' && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-2 font-medium">
                        Godziny pracy
                      </label>
                      <div className="flex items-end gap-3">
                        <div className="flex-1">
                          <p className="text-[10px] text-zinc-400 mb-1">Otwarcie</p>
                          <input
                            type="time"
                            value={form.openTime}
                            onChange={e => { setForm(f => ({ ...f, openTime: e.target.value })); markDirty(); }}
                            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-brand/30"
                          />
                        </div>
                        <span className="text-zinc-400 pb-2">—</span>
                        <div className="flex-1">
                          <p className="text-[10px] text-zinc-400 mb-1">Zamknięcie</p>
                          <input
                            type="time"
                            value={form.closeTime}
                            onChange={e => { setForm(f => ({ ...f, closeTime: e.target.value })); markDirty(); }}
                            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-brand/30"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] text-zinc-400 mb-1">Łącznie</p>
                          <div className="w-full border border-zinc-100 rounded-lg px-3 py-2 text-sm
                                           text-center bg-zinc-50 text-zinc-500">
                            {calcOpenHours(form.openTime, form.closeTime)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1 font-medium">
                          {t('organizations.form.max_days')}
                        </label>
                        <input
                          type="number" min={1} max={365}
                          value={form.maxDaysAhead}
                          onChange={e => { setForm(f => ({ ...f, maxDaysAhead: Number(e.target.value) })); markDirty(); }}
                          className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm
                                     focus:outline-none focus:ring-2 focus:ring-brand/30"
                        />
                        <p className="text-[10px] text-zinc-400 mt-1">Ile dni w przód user może zarezerwować</p>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1 font-medium">
                          {t('organizations.form.max_hours')}
                        </label>
                        <input
                          type="number" min={1} max={24}
                          value={form.maxHoursPerDay}
                          onChange={e => { setForm(f => ({ ...f, maxHoursPerDay: Number(e.target.value) })); markDirty(); }}
                          className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm
                                     focus:outline-none focus:ring-2 focus:ring-brand/30"
                        />
                        <p className="text-[10px] text-zinc-400 mt-1">Maksymalna długość jednej rezerwacji</p>
                      </div>
                    </div>
                    <div className="bg-zinc-50 border-l-2 border-brand rounded-r-lg px-3 py-2.5">
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        {t('organizations.form.limits_hint')}
                      </p>
                    </div>
                  </div>
                )}

                {/* ── TAB: IoT i WiFi ── */}
                {editTab === 'iot' && (
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1 font-medium">
                        {t('organizations.form.wifi_ssid_label')}
                      </label>
                      <input
                        value={wifiSsid}
                        onChange={e => { setWifiSsid(e.target.value); markDirty(); }}
                        placeholder={t('organizations.form.wifi_ssid_placeholder')}
                        className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm
                                   focus:outline-none focus:ring-2 focus:ring-brand/30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1 font-medium">
                        {t('organizations.form.wifi_pass_label')}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type={wifiPassVisible ? 'text' : 'password'}
                          value={wifiPass}
                          onChange={e => { setWifiPass(e.target.value); markDirty(); }}
                          placeholder="••••••••"
                          className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm
                                     focus:outline-none focus:ring-2 focus:ring-brand/30"
                        />
                        <button
                          type="button"
                          onClick={() => setWifiPassVisible(v => !v)}
                          className="px-3 py-2 text-xs border border-zinc-200 rounded-lg bg-zinc-50
                                     text-zinc-500 hover:bg-zinc-100 transition-colors whitespace-nowrap"
                        >
                          {wifiPassVisible ? t('common.hide') : t('common.show')}
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1.5 flex items-center gap-1">
                        <span className="text-emerald-500">🔒</span>
                        {t('organizations.form.wifi_hint')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1 font-medium">
                        PIN kiosku
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        pattern="[0-9]{4}"
                        placeholder="0000"
                        defaultValue=""
                        onChange={() => markDirty()}
                        className="w-28 border border-zinc-200 rounded-lg px-3 py-2 text-sm
                                   font-mono text-center focus:outline-none focus:ring-2 focus:ring-brand/30"
                      />
                      <p className="text-[10px] text-zinc-400 mt-1">
                        4-cyfrowy PIN do wyjścia z trybu kiosku
                      </p>
                    </div>
                  </div>
                )}

                {/* ── TAB: Zasoby ── */}
                {editTab === 'resources' && (
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1 font-medium">
                        {t('organizations.form.parking_mode', 'Tryb rezerwacji parkingu')}
                      </label>
                      <select
                        value={form.parkingBookingMode}
                        onChange={e => { setForm(f => ({ ...f, parkingBookingMode: e.target.value })); markDirty(); }}
                        className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm
                                   focus:outline-none focus:ring-2 focus:ring-brand/30"
                      >
                        <option value="HOURLY">
                          {t('organizations.form.parking_hourly', 'Godzinowy (wybór godziny)')}
                        </option>
                        <option value="ALL_DAY">
                          {t('organizations.form.parking_allday', 'Na cały dzień (brak wyboru godziny)')}
                        </option>
                      </select>
                      <p className="text-[10px] text-zinc-400 mt-1">
                        {t('organizations.form.parking_hint',
                          'Czy miejsca parkingowe są rezerwowane na konkretne godziny czy na cały dzień.')}
                      </p>
                    </div>
                    <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                      <p className="text-xs text-zinc-500">
                        Włączanie/wyłączanie modułów (Sale, Parking, Sprzęt) jest dostępne
                        w <span className="text-brand font-medium">Panelu Operatora → Moduły</span>.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Footer ───────────────────────────────────────── */}
              <div className="px-5 py-3 border-t border-zinc-100 flex items-center justify-between
                               bg-zinc-50 mt-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
                <div>
                  {modal === 'edit' && target?.updatedAt && (
                    <p className="text-[10px] text-zinc-400">
                      Edytowano: {new Date(target.updatedAt).toLocaleDateString('pl-PL', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Btn variant="secondary" onClick={requestClose}>
                    {t('btn.cancel')}
                  </Btn>
                  <Btn onClick={save} loading={saving} disabled={!form.name.trim()}>
                    {modal === 'create' ? t('btn.create') : t('btn.save')}
                  </Btn>
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}

      {showConfirm && <DirtyGuardDialog onConfirm={confirmClose} onCancel={cancelClose} />}

      {/* Modal konfiguracji Azure SSO */}
      {azureModal && (
        <AzureConfigModal location={azureModal} onClose={() => setAzureModal(null)} />
      )}

      {/* Install token modal */}
      {installModal && (
        <InstallTokenModal location={installModal} onClose={() => setInstallModal(null)} />
      )}
    </div>
  );
}
