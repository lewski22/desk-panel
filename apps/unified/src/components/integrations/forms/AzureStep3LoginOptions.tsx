import React from 'react';

interface Props {
  isEnabled:       boolean;
  onEnabled:       (v: boolean) => void;
  forceSSO:        boolean;
  onForceSSO:      (v: boolean) => void;
  autoProvision:   boolean;
  onAutoProvision: (v: boolean) => void;
}

function ToggleRow({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-zinc-100 last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-800 mb-0.5">{label}</p>
        <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-9 h-5 rounded-full transition-colors shrink-0 mt-0.5 ${
          value ? 'bg-brand' : 'bg-zinc-200'
        }`}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
          style={{ left: value ? '18px' : '2px' }}
        />
      </button>
    </div>
  );
}

export function AzureStep3LoginOptions({
  isEnabled, onEnabled,
  forceSSO, onForceSSO,
  autoProvision, onAutoProvision,
}: Props) {
  return (
    <div>
      <ToggleRow
        label="Włącz logowanie przez Microsoft"
        description='Przycisk "Zaloguj przez Microsoft" pojawi się na stronie logowania Reserti.'
        value={isEnabled}
        onChange={onEnabled}
      />
      <ToggleRow
        label="Wymuś SSO (ukryj hasło)"
        description="Użytkownicy z Twojej domeny będą mogli logować się wyłącznie przez Microsoft — formularz hasła zostanie ukryty."
        value={forceSSO}
        onChange={onForceSSO}
      />
      <ToggleRow
        label="Automatyczne tworzenie kont"
        description="Nowy użytkownik z dozwolonej domeny otrzyma konto END_USER automatycznie przy pierwszym logowaniu przez SSO."
        value={autoProvision}
        onChange={onAutoProvision}
      />
    </div>
  );
}
