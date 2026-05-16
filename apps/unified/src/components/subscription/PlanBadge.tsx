import React from 'react';
const COLORS: Record<string, string> = {
  free:       'bg-gray-100 text-gray-500 border-gray-200',
  starter:    'bg-zinc-100 text-zinc-600 border-zinc-200',
  trial:      'bg-amber-100 text-amber-700 border-amber-200',
  pro:        'bg-indigo-100 text-indigo-700 border-indigo-200',
  enterprise: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};
export function PlanBadge({ plan, size = 'sm' }: { plan: string; size?: 'sm' | 'md' }) {
  const cls = COLORS[plan?.toLowerCase()] ?? COLORS.starter;
  const sz  = size === 'md' ? 'text-sm px-3 py-1 font-bold' : 'text-xs px-2 py-0.5 font-semibold';
  return (
    <span className={`inline-flex items-center rounded-full border capitalize ${cls} ${sz}`}>
      {plan ?? 'starter'}
    </span>
  );
}
