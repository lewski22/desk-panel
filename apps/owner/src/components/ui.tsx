import React, { useState } from 'react';

// ── Btn ───────────────────────────────────────────────────────
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?:    'sm' | 'md';
  loading?: boolean;
}
export function Btn({ variant = 'primary', size = 'md', loading, disabled, children, className = '', ...rest }: BtnProps) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' };
  const variants = {
    primary:   'bg-[#B53578] hover:bg-[#9d2d66] text-white',
    secondary: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700',
    ghost:     'bg-transparent hover:bg-zinc-100 text-zinc-600',
    danger:    'bg-red-600 hover:bg-red-700 text-white',
  };
  return (
    <button disabled={loading || disabled} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {loading && <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />}
      {children}
    </button>
  );
}

// ── Card ──────────────────────────────────────────────────────
export function Card({ children, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bg-white border border-zinc-200 rounded-2xl p-5 ${className}`} {...rest}>
      {children}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────
export function Badge({ label, color }: { label: string; color: 'green' | 'yellow' | 'red' | 'zinc' | 'blue' | 'purple' }) {
  const colors = {
    green:  'bg-emerald-100 text-emerald-700',
    yellow: 'bg-amber-100   text-amber-700',
    red:    'bg-red-100     text-red-600',
    zinc:   'bg-zinc-100    text-zinc-600',
    blue:   'bg-blue-100    text-blue-700',
    purple: 'bg-purple-100  text-purple-700',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[color]}`}>{label}</span>;
}

// ── StatusDot ─────────────────────────────────────────────────
export function StatusDot({ status }: { status: 'healthy' | 'stale' | 'offline' | 'unknown' }) {
  const map = {
    healthy: { color: 'bg-emerald-500', label: 'Online' },
    stale:   { color: 'bg-amber-400',   label: 'Stale' },
    offline: { color: 'bg-red-500',     label: 'Offline' },
    unknown: { color: 'bg-zinc-400',    label: '—' },
  };
  const { color, label } = map[status] ?? map.unknown;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs text-zinc-500">{label}</span>
    </span>
  );
}

// ── MetricCard ────────────────────────────────────────────────
export function MetricCard({ label, value, sub, color = 'zinc' }: {
  label: string; value: number | string; sub?: string;
  color?: 'zinc' | 'green' | 'yellow' | 'red' | 'purple';
}) {
  const colors = {
    zinc:   'text-zinc-800',
    green:  'text-emerald-600',
    yellow: 'text-amber-600',
    red:    'text-red-600',
    purple: 'text-[#B53578]',
  };
  return (
    <Card>
      <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-400 mt-1">{sub}</p>}
    </Card>
  );
}

// ── Modal ─────────────────────────────────────────────────────
interface ModalProps { open: boolean; title: string; onClose: () => void; children: React.ReactNode; }
export function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-800">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors text-xl leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string; error?: string;
}
export function Input({ label, error, className = '', ...rest }: InputProps) {
  return (
    <div>
      {label && <label className="block text-xs text-zinc-500 mb-1.5 font-medium">{label}</label>}
      <input className={`w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all ${error ? 'border-red-400 focus:ring-red-300' : 'border-zinc-200 focus:ring-[#B53578]/30'} ${className}`} {...rest} />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return <div className={`${s[size]} border-2 border-zinc-200 border-t-[#B53578] rounded-full animate-spin`} />;
}

// ── PageHeader ────────────────────────────────────────────────
export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-800">{title}</h1>
        {sub && <p className="text-sm text-zinc-400 mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

// ── PlanBadge ─────────────────────────────────────────────────
export function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, { label: string; color: 'green' | 'blue' | 'purple' | 'zinc' }> = {
    starter:    { label: 'Starter',    color: 'zinc' },
    pro:        { label: 'Pro',        color: 'blue' },
    enterprise: { label: 'Enterprise', color: 'purple' },
  };
  const { label, color } = map[plan] ?? { label: plan, color: 'zinc' };
  return <Badge label={label} color={color} />;
}
