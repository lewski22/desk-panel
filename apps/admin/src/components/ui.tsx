import React from 'react';

// ── Button ────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
}
const VARIANT_CLS: Record<BtnVariant, string> = {
  primary:   'bg-[#B53578] hover:bg-[#9d2d66] text-white',
  secondary: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700',
  danger:    'bg-red-100 hover:bg-red-200 text-red-700',
  ghost:     'hover:bg-zinc-100 text-zinc-600',
};
export function Btn({ variant = 'primary', className = '', children, ...props }: BtnProps) {
  return (
    <button {...props} className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${VARIANT_CLS[variant]} ${className}`}>
      {children}
    </button>
  );
}

// ── Card ──────────────────────────────────────────────────────
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-zinc-100 rounded-xl p-4 ${className}`}>{children}</div>;
}

// ── Stat ──────────────────────────────────────────────────────
export function Stat({ label, value, sub, color = 'text-zinc-800' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card>
      <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-bold font-mono ${color}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-400 mt-1">{sub}</p>}
    </Card>
  );
}

// ── Spinner ───────────────────────────────────────────────────
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';
  return <div className={`${sz} border-2 border-zinc-200 border-t-[#B53578] rounded-full animate-spin`} />;
}

// ── Badge ─────────────────────────────────────────────────────
type BadgeColor = 'green' | 'blue' | 'amber' | 'red' | 'gray' | 'purple';
const BADGE_CLS: Record<BadgeColor, string> = {
  green:  'bg-emerald-100 text-emerald-700',
  blue:   'bg-sky-100 text-sky-700',
  amber:  'bg-amber-100 text-amber-700',
  red:    'bg-red-100 text-red-600',
  gray:   'bg-zinc-100 text-zinc-500',
  purple: 'bg-purple-100 text-purple-700',
};
export function Badge({ label, color = 'gray' }: { label: string; color?: BadgeColor }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_CLS[color]}`}>{label}</span>;
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

// ── Input ─────────────────────────────────────────────────────
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className={`w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30 transition-all ${props.className ?? ''}`} />
  );
}

// ── Select ────────────────────────────────────────────────────
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  const { children, className = '', ...rest } = props;
  return (
    <select {...rest} className={`w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#B53578]/30 ${className}`}>
      {children}
    </select>
  );
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ open, title, onClose, children, wide = false }: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 shrink-0">
          <h3 className="font-semibold text-zinc-800">{title}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-colors">×</button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────
export function Empty({ icon = '📭', title, sub, action }: { icon?: string; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-16 text-zinc-400">
      <p className="text-4xl mb-3">{icon}</p>
      <p className="font-medium text-zinc-500">{title}</p>
      {sub && <p className="text-sm mt-1">{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Table helpers ─────────────────────────────────────────────
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-100">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}
export function Thead({ cols }: { cols: string[] }) {
  return (
    <thead className="bg-zinc-50/80 border-b border-zinc-100">
      <tr>{cols.map(c => <th key={c} className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider whitespace-nowrap">{c}</th>)}</tr>
    </thead>
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

// ── Credentials display (one-time secret) ────────────────────
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
