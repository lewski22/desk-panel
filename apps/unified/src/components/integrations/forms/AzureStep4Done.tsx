import React from 'react';

interface Props {
  tenantId:          string;
  onTestConnection:  () => void;
  testResult:        'ok' | 'fail' | null;
}

export function AzureStep4Done({ tenantId, onTestConnection, testResult }: Props) {
  return (
    <div className="text-center py-4 space-y-4">
      <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="#10B981" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      <div>
        <p className="text-base font-semibold text-zinc-800 mb-1">Integracja zapisana</p>
        <p className="text-xs text-zinc-500">
          Azure Entra ID został skonfigurowany dla Tenant&nbsp;
          <code className="font-mono bg-zinc-100 px-1 rounded">{tenantId.slice(0, 8)}…</code>
        </p>
      </div>
      <button
        onClick={onTestConnection}
        className="text-xs px-4 py-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
      >
        Przetestuj połączenie
      </button>
      {testResult === 'ok' && (
        <p className="text-xs text-emerald-600 flex items-center gap-1 justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          Połączenie działa poprawnie
        </p>
      )}
      {testResult === 'fail' && (
        <p className="text-xs text-red-500 flex items-center gap-1 justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
          Problem z połączeniem — sprawdź Tenant ID
        </p>
      )}
    </div>
  );
}
