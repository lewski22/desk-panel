import React from 'react';

export function CharCount({ value, max }: { value: string; max: number }) {
  const len = value.length;
  const near = len >= max * 0.85;
  const over  = len > max;
  return (
    <span className={`text-[11px] tabular-nums ${over ? 'text-red-500' : near ? 'text-amber-500' : 'text-zinc-400'}`}>
      {len}/{max}
    </span>
  );
}
