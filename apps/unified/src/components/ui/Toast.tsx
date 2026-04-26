import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id:      number;
  message: string;
  kind:    ToastKind;
}

const ICONS: Record<ToastKind, string> = {
  success: '✓', error: '✕', info: 'ℹ', warning: '⚠',
};
const COLORS: Record<ToastKind, string> = {
  success: 'bg-emerald-600',
  error:   'bg-red-500',
  info:    'bg-sky-600',
  warning: 'bg-amber-500',
};

let _nextId = 1;
const _listeners: ((t: ToastItem) => void)[] = [];

export function toast(message: string, kind: ToastKind = 'success') {
  const item = { id: _nextId++, message, kind };
  _listeners.forEach(fn => fn(item));
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  const add = useCallback((t: ToastItem) => {
    setItems(prev => [...prev, t]);
    setTimeout(() => {
      setItems(prev => prev.filter(i => i.id !== t.id));
    }, 3500);
  }, []);

  useEffect(() => {
    _listeners.push(add);
    return () => {
      const idx = _listeners.indexOf(add);
      if (idx > -1) _listeners.splice(idx, 1);
    };
  }, [add]);

  if (!items.length) return null;

  return createPortal(
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {items.map(item => (
        <div
          key={item.id}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-white text-sm
                      font-medium max-w-xs pointer-events-auto ${COLORS[item.kind]}`}
          style={{ animation: 'slideInRight 0.2s ease-out' }}
        >
          <span className="text-base leading-none shrink-0">{ICONS[item.kind]}</span>
          <span>{item.message}</span>
        </div>
      ))}
    </div>,
    document.body,
  );
}
