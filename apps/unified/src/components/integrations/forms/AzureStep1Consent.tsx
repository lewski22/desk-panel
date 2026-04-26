import React from 'react';

interface Props { adminConsentUrl: string; }

export function AzureStep1Consent({ adminConsentUrl }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 leading-relaxed">
        Przed konfiguracją połączenia, administrator Entra ID Twojej firmy musi zaakceptować
        uprawnienia aplikacji Reserti w Azure.
      </p>

      <div className="border border-violet-200 bg-violet-50/50 rounded-xl p-4 flex gap-3 items-start">
        <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L1.5 4.5v3.5C1.5 11.9 4.4 15.2 8 16c3.6-.8 6.5-4.1 6.5-8V4.5L8 1z"
              fill="#7c3aed" opacity=".15" stroke="#7c3aed" strokeWidth=".8"/>
            <path d="M5.5 8l1.5 1.5 3-3" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-800 mb-1">Otwórz link jako Global Admin</p>
          <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
            Zaloguj się do Azure jako Global Administrator i kliknij "Akceptuj"
            na stronie zgody Microsoft.
          </p>
          <a
            href={adminConsentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand border border-brand/30 bg-white rounded-lg px-3 py-1.5 hover:bg-brand/5 transition-colors"
          >
            Otwórz stronę zgody (Global Admin) ↗
          </a>
        </div>
      </div>

      <div className="space-y-2">
        {[
          'Zaloguj się jako Global Administrator Azure Active Directory',
          'Kliknij "Akceptuj" na stronie zgody Microsoft',
          'Skopiuj Tenant ID z Azure Portal → Active Directory → Overview',
        ].map((step, i) => (
          <div key={i} className="flex gap-2.5 items-start">
            <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-500 text-[10px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </span>
            <p className="text-xs text-zinc-500 leading-relaxed">{step}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-zinc-400 bg-zinc-50 rounded-lg px-3 py-2">
        Już zrobione? Kliknij <strong>Dalej →</strong> aby przejść do konfiguracji połączenia.
      </p>
    </div>
  );
}
