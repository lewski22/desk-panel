/**
 * PushOptIn — Sprint G2
 * Opt-in dialog dla PWA Push Notifications
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi }          from '../../api/client';

type PushState = 'idle' | 'loading' | 'subscribed' | 'denied' | 'unsupported';

async function registerPushSubscription(vapidPublicKey: string) {
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  const pad = vapidPublicKey.replace(/-/g,'+').replace(/_/g,'/');
  const raw = atob(pad); const key = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) key[i] = raw.charCodeAt(i);
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

interface Props { compact?: boolean; onSuccess?: () => void; }

export function PushOptIn({ compact = false, onSuccess }: Props) {
  const { t }             = useTranslation();
  const [state, setState] = useState<PushState>('idle');
  const [dismissed, setDismissed] = useState(
    localStorage.getItem('push_dismissed') === 'true'
  );

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported'); return;
    }
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription().then(sub => { if (sub) setState('subscribed'); }))
      .catch(() => setState('unsupported'));
  }, []);

  const handleEnable = async () => {
    setState('loading');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState('denied'); return; }
      const { publicKey } = await appApi.push.vapidKey();
      if (!publicKey) throw new Error('VAPID key not configured');
      const sub  = await registerPushSubscription(publicKey);
      const json = sub.toJSON();
      await appApi.push.subscribe({
        endpoint: sub.endpoint,
        p256dh:   json.keys?.p256dh ?? '',
        auth:     json.keys?.auth   ?? '',
        userAgent: navigator.userAgent.slice(0, 200),
      });
      setState('subscribed'); onSuccess?.();
    } catch { setState('idle'); }
  };

  const dismiss = () => { localStorage.setItem('push_dismissed','true'); setDismissed(true); };

  if (state === 'unsupported' || dismissed || state === 'subscribed') return null;

  if (compact) return (
    <div className="flex items-center gap-3 px-4 py-3 bg-violet-50 border border-violet-200 rounded-xl mb-4">
      <span className="text-xl shrink-0">🔔</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-violet-800">{t('push.banner_title')}</p>
        <p className="text-xs text-violet-500 mt-0.5">{t('push.banner_sub')}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={dismiss} className="text-xs text-zinc-400 hover:text-zinc-600 px-2 py-1">{t('btn.later')}</button>
        <button onClick={handleEnable} disabled={state === 'loading'}
          className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium disabled:opacity-50">
          {state === 'loading' ? '...' : t('push.enable_btn')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">🔔</span>
        <div>
          <p className="font-semibold text-zinc-800">{t('push.card_title')}</p>
          <p className="text-xs text-zinc-400 mt-0.5">{t('push.card_sub')}</p>
        </div>
      </div>
      <ul className="space-y-1.5 mb-4">
        {['push.benefit1','push.benefit2','push.benefit3'].map(k => (
          <li key={k} className="flex items-center gap-2 text-xs text-zinc-600">
            <span className="text-emerald-500">✓</span> {t(k)}
          </li>
        ))}
      </ul>
      {state === 'denied' && <p className="text-xs text-red-500 mb-3">{t('push.denied_hint')}</p>}
      <div className="flex gap-2">
        <button onClick={dismiss}
          className="flex-1 py-2 rounded-xl border border-zinc-200 text-sm text-zinc-500 hover:bg-zinc-50">
          {t('btn.later')}
        </button>
        <button onClick={handleEnable} disabled={state === 'loading'}
          className="flex-1 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
          {state === 'loading' ? '...' : t('push.enable_btn')}
        </button>
      </div>
    </div>
  );
}
