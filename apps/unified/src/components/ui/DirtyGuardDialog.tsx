import React from 'react';
import { useTranslation } from 'react-i18next';

export function DirtyGuardDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-5 max-w-xs mx-4 shadow-2xl">
        <p className="font-semibold text-zinc-800 mb-1">{t('dirty_guard.title', 'Niezapisane zmiany')}</p>
        <p className="text-sm text-zinc-500 mb-4">{t('dirty_guard.message', 'Masz niezapisane zmiany. Czy na pewno chcesz wyjść?')}</p>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-2 rounded-xl border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">
            {t('dirty_guard.stay', 'Zostań')}
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors">
            {t('dirty_guard.discard', 'Odrzuć zmiany')}
          </button>
        </div>
      </div>
    </div>
  );
}
