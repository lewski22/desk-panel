import { useTranslation } from 'react-i18next';
import React from 'react';

// ── Button ────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: 'sm' | 'md';
  loading?: boolean;
}
const VARIANT_CLS: Record<BtnVariant, string> = {
  primary:   'bg-brand hover:bg-brand-hover text-white',
  secondary: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700',
  danger:    'bg-red-100 hover:bg-red-200 text-red-700',
  ghost:     'hover:bg-zinc-100 text-zinc-600',
};
export function Btn({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...props }: BtnProps) {
  const sizeCls = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm';
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${sizeCls} ${VARIANT_CLS[variant]} ${className}`}
    >
      {loading && <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
}

// ── Card ──────────────────────────────────────────────────────
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-zinc-100 rounded-xl p-4 ${className}`}>{children}</div>;
}

// ── Stat ──────────────────────────────────────────────────────
export function Stat({ label, value, sub, color, accent }: {
  label: string; value: string | number; sub?: string; color?: string; accent?: boolean;
}) {
  return (
    <Card>
      <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-bold font-mono ${accent ? 'text-brand' : color ?? 'text-zinc-800'}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-400 mt-1">{sub}</p>}
    </Card>
  );
}

// ── Spinner ───────────────────────────────────────────────────
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';
  return (
    <div className="flex items-center justify-center py-12">
      <div className={`${sz} border-2 border-zinc-200 border-t-brand rounded-full animate-spin`} />
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────
export type BadgeColor = 'green' | 'blue' | 'amber' | 'red' | 'gray' | 'purple' | 'zinc';
const BADGE_CLS: Record<BadgeColor, string> = {
  green:  'bg-emerald-100 text-emerald-700',
  blue:   'bg-sky-100 text-sky-700',
  amber:  'bg-amber-100 text-amber-700',
  red:    'bg-red-100 text-red-600',
  gray:   'bg-zinc-100 text-zinc-500',
  purple: 'bg-purple-100 text-purple-700',
  zinc:   'bg-zinc-100 text-zinc-500',
};
export function Badge({ label, color = 'gray', children }: {
  label?: string; color?: BadgeColor; children?: React.ReactNode;
}) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_CLS[color]}`}>
      {label ?? children}
    </span>
  );
}

// ── FormField ─────────────────────────────────────────────────
export function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 font-medium mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-zinc-400 mt-1">{hint}</p>}
    </div>
  );
}

// ── Input — supports optional label prop ─────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}
export function Input({ label, className = '', ...props }: InputProps) {
  const input = (
    <input
      {...props}
      className={`w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all ${className}`}
    />
  );
  if (!label) return input;
  return (
    <div>
      <label className="block text-xs text-zinc-500 font-medium mb-1.5">{label}</label>
      {input}
    </div>
  );
}

// ── Select — supports optional label prop ────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: React.ReactNode;
}
export function Select({ label, children, className = '', ...props }: SelectProps) {
  const select = (
    <select
      {...props}
      className={`w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 ${className}`}
    >
      {children}
    </select>
  );
  if (!label) return select;
  return (
    <div>
      <label className="block text-xs text-zinc-500 font-medium mb-1.5">{label}</label>
      {select}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ open = true, title, onClose, children, wide = false, noPadding = false }: {
  open?: boolean; title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; noPadding?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92vh] sm:max-h-[90vh] flex flex-col`}>
        {/* Drag handle — mobile only */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <span className="w-10 h-1 bg-zinc-300 rounded-full" />
        </div>
        {title ? (
          <div className="flex items-center justify-between px-5 py-3 sm:py-4 border-b border-zinc-100 shrink-0">
            <h3 className="font-semibold text-zinc-800">{title}</h3>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none min-w-touch min-h-touch flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-colors">×</button>
          </div>
        ) : (
          <div className="flex justify-end px-3 pt-1 shrink-0">
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none min-w-touch min-h-touch flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-colors">×</button>
          </div>
        )}
        <div className={`overflow-y-auto flex-1 ${noPadding ? '' : 'px-5 py-4'}`} style={{ paddingBottom: noPadding ? undefined : 'max(1rem, env(safe-area-inset-bottom))' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── PageHeader ────────────────────────────────────────────────
export function PageHeader({ title, subtitle, sub, action }: {
  title: string; subtitle?: string; sub?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-zinc-800 leading-tight">{title}</h1>
        {(subtitle || sub) && <p className="text-xs text-zinc-400 mt-0.5">{subtitle ?? sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ── Table with headers + empty state ─────────────────────────
type TableHeader = string | { label: string; hideOnMobile?: boolean };

function TableEmpty() {
  const { t } = useTranslation();
  return <p className="text-sm">{t('table.empty')}</p>;
}

export function Table({ children, headers, empty }: {
  children: React.ReactNode; headers?: TableHeader[]; empty?: boolean;
}) {
  if (empty) {
    return (
      <div className="text-center py-16 text-zinc-400">
        <p className="text-3xl mb-2">📭</p>
        <TableEmpty />
      </div>
    );
  }
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-none sm:rounded-xl border-y sm:border border-zinc-100">
      <table className="w-full text-left text-sm">
        {headers && (
          <thead className="bg-zinc-50/80 border-b border-zinc-100">
            <tr>
              {headers.map((h, i) => {
                const label = typeof h === 'string' ? h : h.label;
                const hide  = typeof h === 'object' && h.hideOnMobile;
                return (
                  <th key={i}
                    className={`py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider whitespace-nowrap
                      ${hide ? 'hidden sm:table-cell' : ''}`}>
                    {label}
                  </th>
                );
              })}
            </tr>
          </thead>
        )}
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// ── TR / TD ───────────────────────────────────────────────────
export function TR({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-zinc-50 hover:bg-zinc-50/60 transition-colors group">{children}</tr>;
}
export function TD({ children, mono, hideOnMobile }: {
  children?: React.ReactNode; mono?: boolean; hideOnMobile?: boolean;
}) {
  return (
    <td className={`py-3 px-4 text-zinc-700
      ${mono ? 'font-mono text-xs' : 'text-sm'}
      ${hideOnMobile ? 'hidden sm:table-cell' : ''}`}>
      {children}
    </td>
  );
}

// ── Alert ─────────────────────────────────────────────────────
type AlertKind = 'error' | 'success' | 'warning' | 'info';
const ALERT_CLS: Record<AlertKind, string> = {
  error:   'bg-red-50 border-red-200 text-red-700',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  info:    'bg-sky-50 border-sky-200 text-sky-700',
};
export function Alert({ kind = 'error', children }: { kind?: AlertKind; children: React.ReactNode }) {
  return <div className={`p-3 rounded-lg border text-sm ${ALERT_CLS[kind]}`}>{children}</div>;
}

// ── Credentials display ───────────────────────────────────────
export function Credentials({ items }: { items: { key: string; value: string; highlight?: boolean }[] }) {
  return (
    <div className="bg-zinc-950 rounded-xl p-4 font-mono text-xs text-zinc-200 space-y-1 select-all">
      {items.map(({ key, value, highlight }) => (
        <p key={key}>
          <span className="text-zinc-500">{key}=</span>
          <span className={highlight ? 'text-amber-400' : ''}>{value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────
export function Empty({ icon = '📭', title, sub, action }: {
  icon?: string; title: string; sub?: string; action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-16 text-zinc-400">
      <p className="text-4xl mb-3">{icon}</p>
      <p className="font-medium text-zinc-500">{title}</p>
      {sub && <p className="text-sm mt-1">{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Thead (standalone) ────────────────────────────────────────
export function Thead({ cols }: { cols: string[] }) {
  return (
    <thead className="bg-zinc-50/80 border-b border-zinc-100">
      <tr>{cols.map(c => <th key={c} className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider whitespace-nowrap">{c}</th>)}</tr>
    </thead>
  );
}

// ── Sprint A: Sortowanie nagłówków tabel ──────────────────────
export interface SortState {
  field: string | null;
  dir:   'asc' | 'desc';
}

export function SortHeader({
  field, sort, onToggle, children, className = '',
}: {
  field:    string;
  sort:     SortState;
  onToggle: (f: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const active = sort.field === field;
  return (
    <th className={`cursor-pointer select-none group ${className}`} onClick={() => onToggle(field)}>
      <span className="flex items-center gap-1">
        {children}
        <span className={`text-[10px] transition-colors ${active ? 'text-brand' : 'text-zinc-300 group-hover:text-zinc-400'}`}>
          {active ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </span>
    </th>
  );
}

// ── Sprint A: Empty State z ilustracją SVG ────────────────────
export function EmptyState({
  icon, title, sub, action, illustration,
}: {
  icon?:         React.ReactNode;
  title:         string;
  sub?:          string;
  action?:       React.ReactNode;
  illustration?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {illustration ?? (
        icon ? <span className="text-5xl mb-4 select-none leading-none">{icon}</span> : null
      )}
      <p className="text-sm font-semibold text-zinc-600 mb-1">{title}</p>
      {sub && <p className="text-xs text-zinc-400 mb-4 max-w-xs">{sub}</p>}
      {action}
    </div>
  );
}

// ── Sprint A: KPI Trend badge ─────────────────────────────────
export function TrendBadge({ pct, positive = true }: { pct: number; positive?: boolean }) {
  if (pct === 0) return <span className="text-[10px] text-zinc-400 font-medium">→ 0%</span>;
  const good = positive ? pct > 0 : pct < 0;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
      good ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
    }`}>
      {pct > 0 ? '↑' : '↓'} {Math.abs(pct)}%
    </span>
  );
}
