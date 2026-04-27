import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { PageHeader, Btn, Modal, Input } from '../components/ui';
import { useDirtyGuard } from '../hooks/useDirtyGuard';
import { DirtyGuardDialog } from '../components/ui/DirtyGuardDialog';
import { parseApiError, FieldErrors } from '../utils/parseApiError';
import { FieldError } from '../components/ui/FieldError';
import { toast } from '../components/ui/Toast';

function getUser() {
  try { return JSON.parse(localStorage.getItem('app_user') ?? 'null'); } catch { return null; }
}

// ── LedColorPicker ──────────────────────────────────────────────
const LED_PRESETS = [
  '#00C800','#22C55E','#10B981','#14B8A6',
  '#0050DC','#3B82F6','#6366F1','#8B5CF6',
  '#DC0000','#EF4444','#F97316','#FB923C',
  '#C8A000','#EAB308','#EC4899','#FFFFFF',
];

function LedColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen]   = useState(false);
  const [hex,  setHex]    = useState(value);
  const rootRef           = useRef<HTMLDivElement>(null);

  useEffect(() => { setHex(value); }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const apply = (color: string) => {
    const c = color.startsWith('#') ? color.toUpperCase() : `#${color}`.toUpperCase();
    onChange(c); setHex(c); setOpen(false);
  };

  const handleHex = (raw: string) => {
    setHex(raw);
    const c = (raw.startsWith('#') ? raw : `#${raw}`).toUpperCase();
    if (/^#[0-9A-Fa-f]{6}$/.test(c)) onChange(c);
  };

  const isValid = /^#[0-9A-Fa-f]{6}$/.test(hex.startsWith('#') ? hex : `#${hex}`);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-2 border border-zinc-200 rounded-xl
                   bg-white hover:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/30
                   transition-colors"
      >
        <span
          className="w-5 h-5 rounded-md border border-zinc-200 shrink-0"
          style={{ background: isValid ? (hex.startsWith('#') ? hex : `#${hex}`) : '#ccc' }}
        />
        <span className="text-xs font-mono text-zinc-500 uppercase tracking-wide flex-1 text-left">
          {value}
        </span>
        <span className="text-zinc-300 text-[10px]">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute z-50 top-full mt-1.5 left-0 bg-white border border-zinc-200
                       rounded-2xl shadow-xl p-3 w-52"
            onClick={e => e.stopPropagation()}
          >
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {LED_PRESETS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => apply(c)}
                  className={`w-full aspect-square rounded-lg border-2 transition-all ${
                    value.toUpperCase() === c.toUpperCase()
                      ? 'border-brand scale-110 shadow-sm'
                      : 'border-transparent hover:border-zinc-300'
                  }`}
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-zinc-100 pt-2.5">
              <span
                className="w-5 h-5 rounded shrink-0 border border-zinc-200"
                style={{ background: isValid ? (hex.startsWith('#') ? hex : `#${hex}`) : '#ccc' }}
              />
              <input
                className="flex-1 text-xs font-mono border border-zinc-200 rounded-lg px-2 py-1.5
                           focus:outline-none focus:ring-2 focus:ring-brand/30 uppercase bg-zinc-50"
                value={hex}
                onChange={e => handleHex(e.target.value)}
                maxLength={7}
                placeholder="#000000"
                spellCheck={false}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
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
  const { t } = useTranslation();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [locations, setLocations] = useState<any[]>([]);
  const [orgs,      setOrgs]      = useState<any[]>([]);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState<'create'|'edit'|null>(null);
  const [target,    setTarget]    = useState<any>(null);
  const [form,      setForm]      = useState({
    name: '', address: '', city: '', openTime: '08:00', closeTime: '17:00', organizationId: '', maxDaysAhead: 14, maxHoursPerDay: 8, timezone: 'Europe/Warsaw', country: '', parkingBookingMode: 'HOURLY',
    ledBrightness: 100,
    ledColorFree: '#00C800', ledColorReserved: '#0050DC', ledColorOccupied: '#DC0000', ledColorGuestReserved: '#C8A000',
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
      organizationId: user?.organizationId ?? '',
      ledBrightness: 100,
      ledColorFree: '#00C800', ledColorReserved: '#0050DC', ledColorOccupied: '#DC0000', ledColorGuestReserved: '#C8A000',
    });
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
      ledBrightness:         loc.ledBrightness         ?? 100,
      ledColorFree:          loc.ledColorFree          ?? '#00C800',
      ledColorReserved:      loc.ledColorReserved      ?? '#0050DC',
      ledColorOccupied:      loc.ledColorOccupied      ?? '#DC0000',
      ledColorGuestReserved: loc.ledColorGuestReserved ?? '#C8A000',
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
          ledBrightness: form.ledBrightness,
          ledColorFree: form.ledColorFree,
          ledColorReserved: form.ledColorReserved,
          ledColorOccupied: form.ledColorOccupied,
          ledColorGuestReserved: form.ledColorGuestReserved,
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
          ledBrightness: form.ledBrightness,
          ledColorFree: form.ledColorFree,
          ledColorReserved: form.ledColorReserved,
          ledColorOccupied: form.ledColorOccupied,
          ledColorGuestReserved: form.ledColorGuestReserved,
        });
      }
      resetDirty();
      setModal(null);
      toast(t('toast.location_saved', 'Biuro zapisano'));
      await load();
    } catch (e: any) { const p = parseApiError(e); setErr(p.global); setFieldErrors(p.fields); }
    setSaving(false);
  };

  const totalDesks    = locations.reduce((s, l) => s + (l._count?.desks    ?? 0), 0);
  const totalGateways = locations.reduce((s, l) => s + (l._count?.gateways ?? 0), 0);
  const activeCount   = locations.filter(l => l.isActive).length;
  const filtered      = locations.filter(l =>
    !search ||
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    (l.city    ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (l.address ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title={t('pages.organizations.title')}
        sub={t('organizations.subtitle')}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-5 h-5 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Summary chips ─────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {[
              { num: locations.length, label: t('organizations.summary.locations', 'Biur')      },
              { num: activeCount,      label: t('organizations.summary.active',    'Aktywnych'), color: '#3B6D11' },
              { num: totalDesks,       label: t('organizations.summary.desks',     'Biurek')     },
              { num: totalGateways,    label: t('organizations.summary.gateways',  'Gatewayów')  },
            ].map(({ num, label, color }) => (
              <div key={label}
                className="bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2.5 text-center">
                <p className="text-xl font-semibold" style={{ color: color ?? 'inherit' }}>{num}</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* ── Topbar: wyszukiwarka + przycisk dodaj ─────── */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('organizations.search_placeholder', 'Szukaj biura...')}
              className="flex-1 min-w-[180px] max-w-sm h-9 border border-zinc-200 rounded-lg
                         px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30
                         bg-white text-zinc-800 placeholder-zinc-400"
            />
            <Btn onClick={openCreate}>
              + {t('organizations.new_location', 'Nowe biuro')}
            </Btn>
          </div>

          {/* ── Siatka kart ───────────────────────────────── */}
          <div className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>

            {filtered.map(loc => {
              const desksCount    = loc._count?.desks    ?? 0;
              const gatewaysCount = loc._count?.gateways ?? 0;
              const avatarLetter  = loc.name[0]?.toUpperCase() ?? '?';

              return (
                <div key={loc.id}
                  className={`bg-white border border-zinc-200 rounded-2xl overflow-hidden
                              flex flex-col ${!loc.isActive ? 'opacity-60' : ''}`}
                >
                  <div className="h-0.5"
                    style={{ background: loc.isActive ? '#10B981' : '#a1a1aa' }} />

                  {/* Card head */}
                  <div className="px-4 pt-3.5 pb-2.5 flex items-start gap-3 border-b border-zinc-100">
                    <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center
                                    text-base font-semibold"
                      style={{ background: '#FBEAF0', color: '#993556' }}>
                      {avatarLetter}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-sm font-semibold text-zinc-800 truncate">{loc.name}</p>
                        {!loc.isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full
                                           bg-zinc-100 text-zinc-500 font-medium">
                            {t('organizations.inactive')}
                          </span>
                        )}
                        {isSuperAdmin && loc.organization && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full
                                           bg-violet-50 text-violet-700 font-medium">
                            {loc.organization.name}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-tight">
                        {[loc.address, loc.city].filter(Boolean).join(', ')
                          || t('organizations.no_address')}
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {loc.timezone ?? 'Europe/Warsaw'} ·{' '}
                        {loc.openTime ?? '08:00'}–{loc.closeTime ?? '17:00'}
                      </p>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 border-b border-zinc-100 divide-x divide-zinc-100">
                    {[
                      { num: desksCount,    label: t('organizations.stat_desks',    'biurek')    },
                      { num: gatewaysCount, label: t('organizations.stat_gateways', 'gatewayów') },
                      { num: `${loc.maxDaysAhead ?? 14}d·${loc.maxHoursPerDay ?? 8}h`,
                                            label: t('organizations.stat_limits',   'max')       },
                    ].map(({ num, label }) => (
                      <div key={label} className="py-2.5 text-center">
                        <p className="text-base font-semibold text-zinc-800 leading-none">{num}</p>
                        <p className="text-[10px] text-zinc-400 mt-1">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Location ID */}
                  <div className="px-4 py-2.5 border-b border-zinc-100 flex items-center gap-2">
                    <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider shrink-0">
                      {t('organizations.id_label')}
                    </span>
                    <code className="text-[10px] font-mono text-zinc-500 bg-zinc-50 border border-zinc-200
                                     rounded px-1.5 py-0.5 flex-1 truncate select-all">
                      {loc.id}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(loc.id)}
                      className="text-[11px] text-zinc-400 hover:text-brand transition-colors
                                 border border-zinc-200 rounded px-1.5 py-0.5 shrink-0"
                      title="Kopiuj ID"
                    >⎘</button>
                  </div>

                  {/* Actions footer */}
                  <div className="px-3 py-2.5 bg-zinc-50 flex gap-1.5 flex-wrap mt-auto">
                    <button
                      onClick={() => openEdit(loc)}
                      className="text-[11px] px-3 py-1.5 rounded-lg border border-brand/40
                                 bg-brand/5 text-brand hover:bg-brand/10 font-semibold
                                 transition-colors flex-1 text-center"
                    >
                      {t('organizations_extra.edit', 'Edytuj')}
                    </button>
                    <button
                      onClick={() => setInstallModal(loc)}
                      className="text-[11px] px-3 py-1.5 rounded-lg border border-zinc-200
                                 bg-white text-zinc-600 hover:bg-zinc-100 font-medium
                                 transition-colors"
                    >
                      + Gateway
                    </button>
                    <button
                      onClick={() => setAzureModal(loc)}
                      className="text-[11px] px-2.5 py-1.5 rounded-lg border border-zinc-200
                                 bg-white text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100
                                 transition-colors"
                      title="Azure / M365"
                    >
                      M365
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Empty state */}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-16 text-zinc-400">
                {search ? (
                  <>
                    <p className="text-2xl mb-2">🔍</p>
                    <p className="text-sm">
                      {t('organizations.no_search_results', 'Brak biur pasujących do „{{q}}"', { q: search })}
                    </p>
                    <button
                      onClick={() => setSearch('')}
                      className="text-xs text-brand hover:underline mt-2"
                    >
                      {t('organizations.clear_search', 'Wyczyść wyszukiwanie')}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-3xl mb-2">🏢</p>
                    <p className="text-sm">{t('organizations.no_locations')}</p>
                  </>
                )}
              </div>
            )}
          </div>
        </>
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
                    {/* Jasność LED */}
                    <div>
                      <label className="block text-xs text-zinc-400 mb-2 font-medium">
                        {t('organizations.form.led_brightness_label')}
                      </label>
                      <div className="flex gap-1.5">
                        {([10, 25, 50, 75, 100] as const).map(pct => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => { setForm(f => ({ ...f, ledBrightness: pct })); markDirty(); }}
                            className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                              form.ledBrightness === pct
                                ? 'border-brand bg-brand text-white'
                                : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1.5">
                        {t('organizations.form.led_brightness_hint')}
                      </p>
                    </div>

                    {/* Kolory LED beacona */}
                    <div>
                      <label className="block text-xs text-zinc-400 mb-2 font-medium">
                        {t('organizations.form.led_colors_label')}
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {([
                          { key: 'ledColorFree',          labelKey: 'led_color_free'           },
                          { key: 'ledColorReserved',      labelKey: 'led_color_reserved'       },
                          { key: 'ledColorOccupied',      labelKey: 'led_color_occupied'       },
                          { key: 'ledColorGuestReserved', labelKey: 'led_color_guest_reserved' },
                        ] as const).map(({ key, labelKey }) => (
                          <div key={key}>
                            <p className="text-[10px] text-zinc-400 mb-1 font-medium">
                              {t(`organizations.form.${labelKey}`)}
                            </p>
                            <LedColorPicker
                              value={form[key]}
                              onChange={c => { setForm(f => ({ ...f, [key]: c })); markDirty(); }}
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1.5">
                        {t('organizations.form.led_colors_hint')}
                      </p>
                    </div>
                    <hr className="border-zinc-100" />
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
