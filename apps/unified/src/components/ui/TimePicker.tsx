import React, { useState } from 'react';

interface TimePickerProps {
  value:     string;           // "HH:MM"
  onChange:  (v: string) => void;
  min?:      string;           // "HH:MM"
  max?:      string;
  label?:    string;
}

const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 10, 20, 30, 40, 50];

export function TimePicker({ value, onChange, min, max, label }: TimePickerProps) {
  const [open, setOpen] = useState(false);

  const [selH, selM] = value.split(':').map(Number);

  const isDisabled = (h: number, m: number) => {
    const hhmm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (min && hhmm < min) return true;
    if (max && hhmm > max) return true;
    return false;
  };

  return (
    <div className="relative">
      {label && <label className="text-xs text-zinc-500 mb-1.5 block font-medium">{label}</label>}

      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 border border-zinc-200
                   rounded-xl text-sm text-zinc-800 bg-white hover:border-brand
                   focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
      >
        <span className="font-mono">{value || '––:––'}</span>
        <span className="text-zinc-400 text-xs">🕐</span>
      </button>

      {open && (
        <div
          className="absolute z-50 top-full mt-1 left-0 bg-white border border-zinc-200
                     rounded-2xl shadow-xl p-3 flex gap-3 min-w-[180px]"
          onClick={e => e.stopPropagation()}
        >
          {/* Godziny */}
          <div className="flex flex-col gap-0.5 overflow-y-auto max-h-48 pr-1">
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1 text-center">h</p>
            {HOURS.map(h => {
              const allDisabled = MINUTES.every(m => isDisabled(h, m));
              return (
                <button key={h} type="button"
                  disabled={allDisabled}
                  onClick={() => {
                    const newM = isDisabled(h, selM)
                      ? (MINUTES.find(m => !isDisabled(h, m)) ?? 0)
                      : selM;
                    onChange(`${String(h).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
                  }}
                  className={`w-9 py-1 rounded-lg text-sm font-mono transition-colors ${
                    h === selH
                      ? 'bg-brand text-white font-semibold'
                      : 'hover:bg-zinc-100 text-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed'
                  }`}
                >
                  {String(h).padStart(2, '0')}
                </button>
              );
            })}
          </div>

          {/* Minuty co 10 */}
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1 text-center">min</p>
            {MINUTES.map(m => (
              <button key={m} type="button"
                disabled={isDisabled(selH, m)}
                onClick={() => {
                  onChange(`${String(selH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                  setOpen(false);
                }}
                className={`w-9 py-1 rounded-lg text-sm font-mono transition-colors ${
                  m === selM
                    ? 'bg-brand text-white font-semibold'
                    : 'hover:bg-zinc-100 text-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed'
                }`}
              >
                {String(m).padStart(2, '0')}
              </button>
            ))}
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}
