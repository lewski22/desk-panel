import React from 'react';
interface Props { label: string; used: number; limit: number | null; pct: number; }
function barColor(p: number) { return p >= 90 ? 'bg-red-500' : p >= 70 ? 'bg-amber-400' : 'bg-emerald-500'; }
function txtColor(p: number) { return p >= 90 ? 'text-red-600' : p >= 70 ? 'text-amber-600' : 'text-emerald-600'; }
export function UsageBar({ label, used, limit, pct }: Props) {
  const inf = limit === null;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-zinc-700">{label}</span>
        <span className={`text-xs font-semibold ${inf ? 'text-zinc-400' : txtColor(pct)}`}>
          {inf ? `${used} / ∞` : `${used} / ${limit}  (${pct}%)`}
          {!inf && pct >= 80 && ' ⚠'}
        </span>
      </div>
      <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${inf ? 'bg-zinc-200' : barColor(pct)}`}
          style={{ width: inf ? '100%' : `${Math.min(pct,100)}%` }} />
      </div>
    </div>
  );
}
