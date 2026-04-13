import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi } from '../../api/client';
import { Modal } from '../ui';

interface Props {
  user: { id: string; firstName?: string | null; lastName?: string | null; cardUid?: string | null };
  onClose: () => void;
}

type Mode   = 'choose' | 'scanning' | 'done' | 'manual';
type Status = 'waiting' | 'found' | 'timeout';

export function NfcCardModal({ user, onClose }: Props) {
  const { t } = useTranslation();
  const [mode,      setMode]      = useState<Mode>('choose');
  const [status,    setStatus]    = useState<Status | null>(null);
  const [secondsLeft, setSeconds] = useState(60);
  const [cardUid,   setCardUid]   = useState(user.cardUid ?? '');
  const [busy,      setBusy]      = useState(false);
  const [err,       setErr]       = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startScan = async () => {
    setErr(''); setMode('scanning'); setStatus('waiting'); setSeconds(60);
    try {
      await appApi.users.nfcScanStart(user.id);
    } catch (e: any) {
      setErr(e.message ?? t('users.nfcModal.errors.start_failed')); setMode('choose'); return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const res = await appApi.users.nfcScanStatus(user.id);
        if (res.status === 'found') {
          stopPolling();
          setStatus('found');
          setCardUid(res.cardUid ?? '');
          setMode('done');
        } else if (res.status === 'timeout') {
          stopPolling();
          setStatus('timeout');
          setMode('choose');
          setErr(t('users.nfcModal.errors.timeout'));
        } else {
          setSeconds(res.secondsLeft ?? 0);
        }
      } catch { /* network hiccup — ignore */ }
    }, 2_000);
  };

  const saveManual = async () => {
    if (!cardUid.trim()) return;
    setBusy(true); setErr('');
    try {
      await appApi.users.assignCard(user.id, cardUid.trim().toUpperCase());
      onClose();
    } catch (e: any) { setErr(e.message ?? t('users.nfcModal.errors.save_failed')); }
    setBusy(false);
  };

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');

  return (
    <Modal title={t('users.nfcModal.title', { name })} onClose={() => { stopPolling(); onClose(); }}>
      <div className="flex flex-col gap-4">

        {err && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{err}</div>
        )}

        {/* Aktualny UID */}
        {user.cardUid && mode !== 'done' && (
          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
            <p className="text-xs text-zinc-400 mb-1">{t('users.nfcModal.current_card')}</p>
            <p className="font-mono text-sm text-zinc-700">{user.cardUid}</p>
          </div>
        )}

        {/* ── Wybór trybu ── */}
        {mode === 'choose' && (
          <>
            <button
              onClick={startScan}
              className="w-full py-3.5 rounded-xl bg-[#B53578] hover:bg-[#9d2d66] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-lg">📡</span>
              {t('users.nfcModal.scan_auto', { seconds: 60 })}
            </button>

            <div className="relative flex items-center">
              <div className="flex-grow border-t border-zinc-200" />
              <span className="mx-3 text-xs text-zinc-400">{t('users.nfcModal.or_manual')}</span>
              <div className="flex-grow border-t border-zinc-200" />
            </div>

            <button
              onClick={() => { setMode('manual'); setCardUid(user.cardUid ?? ''); }}
              className="w-full py-2.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm transition-colors"
            >
              {t('users.nfcModal.manual_button')}
            </button>
          </>
        )}

        {/* ── Skanowanie ── */}
        {mode === 'scanning' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-[#B53578]/20 animate-ping" />
              <div className="absolute inset-2 rounded-full border-4 border-[#B53578]/40 animate-ping [animation-delay:0.3s]" />
              <span className="text-3xl relative z-10">📡</span>
            </div>
            <div className="text-center">
              <p className="font-semibold text-zinc-800">{t('users.nfcModal.waiting_title')}</p>
              <p className="text-sm text-zinc-500 mt-1">
                {t('users.nfcModal.waiting_desc_prefix')} <strong>{t('users.nfcModal.waiting_desc_strong')}</strong> {t('users.nfcModal.waiting_desc_suffix')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-32 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full bg-[#B53578] rounded-full transition-all duration-1000"
                  style={{ width: `${(secondsLeft / 60) * 100}%` }}
                />
              </div>
              <span className="text-xs text-zinc-400 w-8 text-right">{t('users.nfcModal.seconds', { seconds: secondsLeft })}</span>
            </div>
            <button
              onClick={() => { stopPolling(); setMode('choose'); setErr(''); }}
              className="text-xs text-zinc-400 hover:text-zinc-600 underline"
            >
              {t('btn.cancel')}
            </button>
          </div>
        )}

        {/* ── Sukces ── */}
        {mode === 'done' && (
          <div className="flex flex-col items-center gap-3 py-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-2xl">✓</div>
            <p className="font-semibold text-zinc-800">{t('users.nfcModal.assigned')}</p>
            <p className="font-mono text-sm text-zinc-600">{cardUid}</p>
            <button
              onClick={onClose}
              className="mt-2 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors"
            >
              {t('users.nfcModal.done')}
            </button>
          </div>
        )}

        {/* ── Ręczny wpis ── */}
        {mode === 'manual' && (
          <>
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">
                {t('users.nfcModal.label_uid')}
              </label>
              <input
                type="text"
                placeholder={t('users.nfcModal.placeholder_uid')}
                value={cardUid}
                onChange={e => setCardUid(e.target.value.toUpperCase())}
                className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setMode('choose'); setErr(''); }}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm font-medium transition-colors"
              >
                {t('users.nfcModal.back')}
              </button>
              <button
                onClick={saveManual}
                disabled={busy || !cardUid.trim()}
                className="flex-1 py-2.5 rounded-xl bg-[#B53578] hover:bg-[#9d2d66] text-white font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {busy ? t('users.nfcModal.saving') : t('users.nfcModal.save')}
              </button>
            </div>
          </>
        )}

      </div>
    </Modal>
  );
}
