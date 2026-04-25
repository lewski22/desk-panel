import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi } from '../../api/client';

interface Props { onClose: () => void; }

export function ChangePasswordModal({ onClose }: Props) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next,    setNext]    = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');
  const [ok,      setOk]      = useState(false);

  const submit = async () => {
    setErr('');
    if (next.length < 8)  { setErr(t('changePassword.errors.min_length')); return; }
    if (next !== confirm)  { setErr(t('changePassword.errors.not_identical')); return; }
    if (current === next)  { setErr(t('changePassword.errors.different')); return; }
    setSaving(true);
    try {
      await appApi.auth.changePassword(current, next);
      setOk(true);
      setTimeout(onClose, 1500);
    } catch (e: any) {
      setErr(e.message ?? t('changePassword.errors.generic'));
    }
    setSaving(false);
  };

  // FIX P2-1: modal uses light bg-white to match the app's light theme
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-zinc-800 flex items-center gap-2">
            <span>🔑</span> {t('changePassword.submit')}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none">×</button>
        </div>

        {ok ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-emerald-600 font-medium">{t('changePassword.changed')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">{t('changePassword.current_label')}</label>
              <input
                type="password" value={current} onChange={e => setCurrent(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">{t('changePassword.new_label')}</label>
              <input
                type="password" value={next} onChange={e => setNext(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
                placeholder={t('changePassword.min_chars')}
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">{t('changePassword.confirm_label')}</label>
              <input
                type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
            </div>

            {err && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-600">
                {err}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={onClose}
                className="flex-1 border border-zinc-200 hover:bg-zinc-50 text-zinc-600 text-sm font-medium py-2.5 rounded-xl transition-colors">
                {t('changePassword.cancel')}
              </button>
              <button onClick={submit} disabled={saving || !current || !next || !confirm}
                className="flex-1 bg-brand hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
                {saving ? t('changePassword.saving') : t('changePassword.submit')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
