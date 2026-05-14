import React, { useEffect, useState } from 'react';
import { appApi } from '../../api/client';

interface Props {
  orgId: string;
  orgName?: string;
}

/**
 * EntraIdSection — konfiguracja Microsoft Entra ID (Azure AD) dla organizacji.
 * Widoczna dla SUPER_ADMIN i OFFICE_ADMIN.
 * Umożliwia podanie Tenant ID i włączenie SSO → wymagane dla Teams App.
 */
export function EntraIdSection({ orgId, orgName }: Props) {
  const [tenantId,   setTenantId]   = useState('');
  const [enabled,    setEnabled]    = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [testing,    setTesting]    = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);
  const [err,        setErr]        = useState('');
  const [saved,      setSaved]      = useState(false);

  useEffect(() => {
    setLoading(true);
    appApi.organizations.getAzureConfig(orgId)
      .then((c: any) => {
        setTenantId(c.azureTenantId ?? '');
        setEnabled(c.azureEnabled ?? false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId]);

  const save = async () => {
    setSaving(true); setErr(''); setSaved(false);
    try {
      await appApi.organizations.updateAzureConfig(orgId, {
        azureTenantId: tenantId.trim() || null,
        azureEnabled:  enabled,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  const test = async () => {
    if (!tenantId.trim()) return;
    setTesting(true); setTestResult(null);
    try {
      const r = await fetch(
        `https://login.microsoftonline.com/${tenantId.trim()}/discovery/v2.0/keys`
      );
      setTestResult(r.ok ? 'ok' : 'fail');
    } catch { setTestResult('fail'); }
    setTesting(false);
  };

  if (loading) {
    return <div className="text-sm text-zinc-500 py-4">Ładowanie konfiguracji…</div>;
  }

  const clientId = (window as any).__VITE_AZURE_CLIENT_ID__ ?? import.meta.env?.VITE_AZURE_CLIENT_ID ?? '';
  const consentUrl = clientId
    ? `https://login.microsoftonline.com/organizations/adminconsent?client_id=${clientId}&redirect_uri=${encodeURIComponent(`${window.location.origin}/auth-redirect.html`)}&prompt=login`
    : '';

  return (
    <div className="space-y-5">
      {/* Instrukcja krok po kroku */}
      <div className="bg-blue-950/40 border border-blue-800/50 rounded-xl p-4 space-y-2.5 text-xs text-blue-300">
        <p className="font-semibold text-blue-200 text-sm">📋 Jak skonfigurować Entra ID (Microsoft 365)</p>
        <div className="space-y-2">
          <p><span className="font-medium text-blue-100">Krok 1</span> — Przekaż poniższy link IT Adminowi firmy (wymaga uprawnień Global Admin w Entra ID). Admin musi zalogować się <strong className="text-amber-300">służbowym</strong> kontem Microsoft 365 — konta osobiste (@hotmail, @outlook) nie są obsługiwane:</p>
          {consentUrl ? (
            <a href={consentUrl} target="_blank" rel="noopener noreferrer"
               className="block bg-blue-900/40 border border-blue-700/50 rounded-lg px-3 py-2 text-[11px] text-blue-300 break-all hover:bg-blue-900/70 transition-colors">
              🔗 {consentUrl}
            </a>
          ) : (
            <p className="text-amber-400 text-[11px]">⚠️ Skonfiguruj zmienną <code>VITE_AZURE_CLIENT_ID</code> aby wygenerować link.</p>
          )}
          <p><span className="font-medium text-blue-100">Krok 2</span> — Admin klika link, loguje się i zatwierdza uprawnienia aplikacji Reserti.</p>
          <p><span className="font-medium text-blue-100">Krok 3</span> — Skopiuj <strong>Tenant ID</strong> z Azure Portal → Entra ID → Overview.</p>
          <p><span className="font-medium text-blue-100">Krok 4</span> — Wklej Tenant ID poniżej, kliknij "Testuj połączenie", a następnie Zapisz.</p>
        </div>
      </div>

      {/* Tenant ID */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
          Tenant ID (Directory ID) {orgName && <span className="text-zinc-600">— {orgName}</span>}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={tenantId}
            onChange={e => setTenantId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            onClick={test}
            disabled={testing || !tenantId.trim()}
            className="px-4 py-2.5 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 border border-zinc-700 rounded-xl text-zinc-300 transition-colors whitespace-nowrap"
          >
            {testing ? '…' : 'Testuj'}
          </button>
        </div>
        {testResult === 'ok' && (
          <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
            ✅ Tenant ID poprawny — połączenie z Entra ID działa
          </p>
        )}
        {testResult === 'fail' && (
          <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
            ❌ Nie można połączyć — sprawdź Tenant ID
          </p>
        )}
      </div>

      {/* Enable toggle */}
      <label className="flex items-center gap-3 cursor-pointer group">
        <div className="relative">
          <input type="checkbox" className="sr-only" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
          <div className={`w-10 h-6 rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-zinc-700'}`} />
          <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : ''}`} />
        </div>
        <div>
          <span className="text-sm text-zinc-200 font-medium">Włącz Entra ID SSO</span>
          <p className="text-xs text-zinc-500 mt-0.5">Użytkownicy będą mogli logować się przez Microsoft 365. Wymagane do Teams App.</p>
        </div>
      </label>

      {err && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl px-3 py-2.5 text-xs text-red-400">
          {err}
        </div>
      )}

      {saved && (
        <div className="bg-green-900/30 border border-green-800 rounded-xl px-3 py-2.5 text-xs text-green-400">
          ✅ Konfiguracja zapisana
        </div>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
      >
        {saving ? 'Zapisywanie…' : '💾 Zapisz konfigurację Entra ID'}
      </button>
    </div>
  );
}
