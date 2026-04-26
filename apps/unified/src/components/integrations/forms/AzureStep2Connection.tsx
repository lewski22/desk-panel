import React from 'react';

interface Props {
  tenantId:        string;
  onTenantId:      (v: string) => void;
  allowedDomains:  string;
  onDomains:       (v: string) => void;
  useCustomApp:    boolean;
  onCustomApp:     (v: boolean) => void;
  clientId:        string;
  onClientId:      (v: string) => void;
  clientSecret:    string;
  onClientSecret:  (v: string) => void;
  hasClientSecret?: boolean;
  testResult:      'ok' | 'fail' | 'testing' | null;
  onTest:          () => void;
  error:           string;
}

export function AzureStep2Connection({
  tenantId, onTenantId,
  allowedDomains, onDomains,
  useCustomApp, onCustomApp,
  clientId, onClientId,
  clientSecret, onClientSecret,
  hasClientSecret,
  testResult, onTest,
  error,
}: Props) {
  return (
    <div className="space-y-4">
      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">
          Azure Tenant ID <span className="text-red-400">*</span>
        </label>
        <div className="flex gap-2">
          <input
            value={tenantId}
            onChange={e => onTenantId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand bg-white"
          />
          <button
            onClick={onTest}
            disabled={!tenantId || testResult === 'testing'}
            className="text-xs px-3 py-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 whitespace-nowrap transition-colors"
          >
            {testResult === 'testing' ? '…' : 'Testuj'}
          </button>
        </div>
        {testResult === 'ok' && (
          <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Tenant ID poprawny — Entra ID odpowiada
          </p>
        )}
        {testResult === 'fail' && (
          <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
            Nie można połączyć z tym Tenant ID
          </p>
        )}
        <p className="text-[10px] text-zinc-400 mt-1.5 leading-relaxed">
          Azure Portal → Azure Active Directory → Overview → Tenant ID
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">
          Dozwolone domeny email
          <span className="font-normal text-zinc-400 ml-1">(opcjonalnie)</span>
        </label>
        <input
          value={allowedDomains}
          onChange={e => onDomains(e.target.value)}
          placeholder="company.com, subsidiary.com"
          className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand bg-white"
        />
        <p className="text-[10px] text-zinc-400 mt-1.5">
          Oddziel przecinkami. Puste = brak ograniczeń — każde konto Microsoft może się zalogować.
        </p>
      </div>

      <div className="border border-zinc-200 rounded-xl p-3.5">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-semibold text-zinc-700">Własna aplikacja Azure (BYOA)</p>
              <span className="text-[9px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-sm">
                Zaawansowane
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Domyślnie używamy globalnej aplikacji Reserti. Wybierz tę opcję jeśli Twoja firma
              wymaga własnej rejestracji App Registration w Azure.
            </p>
          </div>
          <button
            onClick={() => onCustomApp(!useCustomApp)}
            className={`relative w-9 h-5 rounded-full transition-colors shrink-0 mt-0.5 ${
              useCustomApp ? 'bg-brand' : 'bg-zinc-200'
            }`}
          >
            <span
              className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
              style={{ left: useCustomApp ? '18px' : '2px' }}
            />
          </button>
        </div>

        {useCustomApp && (
          <div className="mt-3 pt-3 border-t border-zinc-100 space-y-3">
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 mb-1">Client ID</label>
              <input
                value={clientId}
                onChange={e => onClientId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand/20 bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 mb-1">
                Client Secret {hasClientSecret && <span className="text-emerald-600">(ustawiony)</span>}
              </label>
              <input
                type="password"
                value={clientSecret}
                onChange={e => onClientSecret(e.target.value)}
                placeholder={hasClientSecret ? '••••••••••••••••' : 'Wklej Client Secret z Azure'}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand/20 bg-white"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
