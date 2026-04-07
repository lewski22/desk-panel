import React, { useEffect, useState } from 'react';
import { appApi } from '../api/client';
import { PageHeader, Btn, Card, Modal, Input } from '../components/ui';

function getUser() {
  try { return JSON.parse(localStorage.getItem('app_user') ?? 'null'); } catch { return null; }
}

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
              className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
            />
            <button
              onClick={test}
              disabled={testing || !tenantId}
              className="text-xs px-3 py-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-600 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {testing ? '…' : 'Testuj'}
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
            className={`relative w-10 h-6 rounded-full transition-colors ${enabled ? 'bg-[#B53578]' : 'bg-zinc-300'}`}
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
          <Btn variant="secondary" onClick={onClose}>Anuluj</Btn>
          <Btn onClick={save} loading={saving} disabled={enabled && !tenantId}>Zapisz</Btn>
        </div>
      </div>
    </Modal>
  );
}

function InstallTokenModal({ location, onClose }: { location: any; onClose: () => void }) {
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
          <div className="w-6 h-6 border-2 border-zinc-200 border-t-[#B53578] rounded-full animate-spin" />
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
              <p className="text-zinc-400 mb-0.5">Biuro</p>
              <p className="font-medium text-zinc-700">{token.location?.name}</p>
            </div>
            <div className="bg-zinc-50 rounded-lg p-3">
              <p className="text-zinc-400 mb-0.5">Ważny do</p>
              <p className="font-medium text-zinc-700">
                {new Date(token.expiresAt).toLocaleString('pl-PL', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <span className="text-amber-500 shrink-0">⚠</span>
            <p className="text-xs text-amber-700">
              Token jest jednorazowy — po użyciu wygasa. Jeśli instalacja się nie powiedzie,
              wróć tutaj i wygeneruj nowy.
            </p>
          </div>

          <div className="flex justify-end">
            <Btn onClick={onClose}>Zamknij</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function OrganizationsPage() {
  const user = getUser();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [locations, setLocations] = useState<any[]>([]);
  const [orgs,      setOrgs]      = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState<'create'|'edit'|null>(null);
  const [target,    setTarget]    = useState<any>(null);
  const [form,      setForm]      = useState({
    name: '', address: '', city: '', openTime: '08:00', closeTime: '17:00', organizationId: '', maxDaysAhead: 14, maxHoursPerDay: 8,
  });
  const [saving,       setSaving]       = useState(false);
  const [err,          setErr]          = useState('');
  const [installModal, setInstallModal] = useState<any>(null);
  const [azureModal,   setAzureModal]   = useState<any>(null);

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
    setForm({ name:'', address:'', city:'', openTime:'08:00', closeTime:'17:00', maxDaysAhead: 14, maxHoursPerDay: 8,
      organizationId: isSuperAdmin ? '' : (user?.organizationId ?? '') });
    setErr('');
    setModal('create');
  };

  const openEdit = (loc: any) => {
    setTarget(loc);
    setForm({
      name: loc.name, address: loc.address ?? '', city: loc.city ?? '',
      openTime: loc.openTime ?? '08:00', closeTime: loc.closeTime ?? '17:00',
      maxDaysAhead: loc.maxDaysAhead ?? 14, maxHoursPerDay: loc.maxHoursPerDay ?? 8,
      organizationId: loc.organizationId,
    });
    setErr('');
    setModal('edit');
  };

  const save = async () => {
    setSaving(true); setErr('');
    try {
      if (modal === 'create') {
        const orgId = form.organizationId || user?.organizationId;
        await appApi.locations.create(orgId, {
          name: form.name, address: form.address, city: form.city,
          openTime: form.openTime, closeTime: form.closeTime,
          maxDaysAhead: form.maxDaysAhead, maxHoursPerDay: form.maxHoursPerDay,
          organizationId: orgId,
        });
      } else if (target) {
        await appApi.locations.update(target.id, {
          name: form.name, address: form.address, city: form.city,
          openTime: form.openTime, closeTime: form.closeTime,
          maxDaysAhead: form.maxDaysAhead, maxHoursPerDay: form.maxHoursPerDay,
        });
      }
      setModal(null);
      await load();
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <div>
      <PageHeader
        title="Biura"
        sub="Fizyczne biura — godziny pracy, adresy, lokalizacje"
        action={<Btn onClick={openCreate}>+ Nowe biuro</Btn>}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-5 h-5 border-2 border-zinc-200 border-t-[#B53578] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {locations.map(loc => (
            <Card key={loc.id} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#B53578]/10 flex items-center justify-center text-[#B53578] font-bold text-lg shrink-0">
                {loc.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-zinc-800 truncate">{loc.name}</p>
                  {!loc.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Nieaktywne</span>
                  )}
                  {isSuperAdmin && loc.organization && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-medium">
                      {loc.organization.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {[loc.address, loc.city].filter(Boolean).join(', ') || 'Brak adresu'}
                </p>
                {/* ID do prowizjonowania */}
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">ID:</span>
                  <code className="text-[10px] font-mono text-zinc-500 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded select-all">{loc.id}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(loc.id); }}
                    className="text-[10px] text-zinc-400 hover:text-[#B53578] transition-colors"
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
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <p className="text-xs text-zinc-400">
                  {new Date(loc.createdAt).toLocaleDateString('pl-PL')}
                </p>
                <Btn variant="ghost" size="sm" onClick={() => setAzureModal(loc)}>M365</Btn>
                <Btn variant="ghost" size="sm" onClick={() => setInstallModal(loc)}>+ Gateway</Btn>
                <Btn variant="ghost" size="sm" onClick={() => openEdit(loc)}>Edytuj</Btn>
              </div>
            </Card>
          ))}
          {locations.length === 0 && (
            <div className="text-center py-16 text-zinc-400">
              <p className="text-3xl mb-2">🏢</p>
              <p className="text-sm">Brak biur — dodaj pierwsze biuro</p>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={modal !== null}
        title={modal === 'create' ? 'Nowe biuro' : `Edytuj: ${target?.name}`}
        onClose={() => setModal(null)}
      >
        {err && <p className="mb-3 text-sm text-red-500 bg-red-50 p-2.5 rounded-lg">{err}</p>}
        <div className="flex flex-col gap-3">
          {/* Super Admin wybiera firmę */}
          {isSuperAdmin && modal === 'create' && (
            <div>
              <label className="block text-xs text-zinc-400 mb-1 font-medium">Firma</label>
              <select
                value={form.organizationId}
                onChange={e => setForm(f => ({ ...f, organizationId: e.target.value }))}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
              >
                <option value="">— wybierz firmę —</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
          <Input label="Nazwa biura" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Warszawa HQ" />
          <Input label="Adres" value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            placeholder="ul. Marszałkowska 1" />
          <Input label="Miasto" value={form.city}
            onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
            placeholder="Warszawa" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1 font-medium">Otwarcie</label>
              <input type="time" value={form.openTime}
                onChange={e => setForm(f => ({ ...f, openTime: e.target.value }))}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1 font-medium">Zamknięcie</label>
              <input type="time" value={form.closeTime}
                onChange={e => setForm(f => ({ ...f, closeTime: e.target.value }))}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30" />
            </div>
          </div>
          {/* Limity rezerwacji */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1 font-medium">Max dni do przodu</label>
              <input type="number" min={1} max={365} value={form.maxDaysAhead}
                onChange={e => setForm(f => ({ ...f, maxDaysAhead: Number(e.target.value) }))}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1 font-medium">Max godzin / rezerwacja</label>
              <input type="number" min={1} max={24} value={form.maxHoursPerDay}
                onChange={e => setForm(f => ({ ...f, maxHoursPerDay: Number(e.target.value) }))}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30" />
            </div>
          </div>
          <p className="text-xs text-zinc-400">
            Godziny pracy i limity określają, kiedy i jak długo użytkownicy mogą rezerwować biurka.
            Walk-in przez QR kończy się automatycznie o godzinie zamknięcia.
          </p>
          <div className="flex gap-2 mt-1 justify-end">
            <Btn variant="secondary" onClick={() => setModal(null)}>Anuluj</Btn>
            <Btn onClick={save} loading={saving}>
              {modal === 'create' ? 'Utwórz' : 'Zapisz'}
            </Btn>
          </div>
        </div>
      </Modal>

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
