import React from 'react';
import { useTranslation } from 'react-i18next';

export type IntegrationStatus = 'connected' | 'configuring' | 'available' | 'error';

interface Props {
  id:          string;
  name:        string;
  description: string;
  logo:        React.ReactNode;
  logoColor:   string;
  status:      IntegrationStatus;
  onSelect:    () => void;
}

const STATUS_CFG: Record<IntegrationStatus, { dot: string; bg: string; text: string }> = {
  connected:   { dot: '#10B981', bg: '#d1fae5', text: '#065f46' },
  configuring: { dot: '#B53578', bg: '#fdf4f9', text: '#B53578' },
  available:   { dot: '#a1a1aa', bg: '#f4f4f5', text: '#6B5F7A' },
  error:       { dot: '#EF4444', bg: '#fee2e2', text: '#991b1b' },
};

export function IntegrationCard({ name, description, logo, logoColor, status, onSelect }: Props) {
  const { t } = useTranslation();
  const cfg = STATUS_CFG[status];

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        status === 'configuring'
          ? 'border-brand bg-brand/5 ring-1 ring-brand/20'
          : status === 'connected'
          ? 'border-emerald-200 bg-emerald-50/30 hover:border-emerald-300'
          : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm'
      }`}
    >
      <div
        className="w-9 h-9 rounded-lg mb-3 flex items-center justify-center"
        style={{ background: logoColor }}
      >
        {logo}
      </div>

      <p className="text-sm font-semibold text-zinc-800 mb-1">{name}</p>
      <p className="text-xs text-zinc-500 leading-relaxed mb-3">{description}</p>

      <span
        className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full"
        style={{ background: cfg.bg, color: cfg.text }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
        {t(`integrations.status.${status}`)}
      </span>
    </button>
  );
}
