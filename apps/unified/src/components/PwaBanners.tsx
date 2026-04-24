import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const INSTALL_DISMISSED_KEY = 'pwa:install-dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaBanners() {
  const { t } = useTranslation();
  const [showUpdate,  setShowUpdate]  = useState(false);
  const [updateFn,    setUpdateFn]    = useState<(() => void) | null>(null);
  const [offlineReady, setOfflineReady] = useState(false);
  const [isOffline,   setIsOffline]   = useState(!navigator.onLine);
  const [installEvt,  setInstallEvt]  = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const onUpdate = (e: Event) => {
      const { updateSW } = (e as CustomEvent).detail ?? {};
      setUpdateFn(() => () => updateSW?.(true));
      setShowUpdate(true);
    };
    const onOffline = () => setOfflineReady(true);
    const onOnline  = () => setIsOffline(false);
    const onOfflineEvt = () => setIsOffline(true);
    const onInstall = (e: Event) => {
      e.preventDefault();
      if (!localStorage.getItem(INSTALL_DISMISSED_KEY)) {
        setInstallEvt(e as BeforeInstallPromptEvent);
        setShowInstall(true);
      }
    };

    window.addEventListener('pwa:update-ready',  onUpdate);
    window.addEventListener('pwa:offline-ready', onOffline);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOfflineEvt);
    window.addEventListener('beforeinstallprompt', onInstall);
    return () => {
      window.removeEventListener('pwa:update-ready',  onUpdate);
      window.removeEventListener('pwa:offline-ready', onOffline);
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOfflineEvt);
      window.removeEventListener('beforeinstallprompt', onInstall);
    };
  }, []);

  // Auto-hide offline-ready toast after 4s
  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(t);
  }, [offlineReady]);

  const doInstall = async () => {
    if (!installEvt) return;
    await installEvt.prompt();
    const { outcome } = await installEvt.userChoice;
    if (outcome === 'dismissed') localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
    setShowInstall(false);
    setInstallEvt(null);
  };
  const dismissInstall = () => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
    setShowInstall(false);
    setInstallEvt(null);
  };

  return (
    <>
      {/* Offline bar */}
      {isOffline && (
        <div className="fixed top-0 inset-x-0 z-[60] bg-amber-500 text-white text-xs font-medium text-center py-1.5 px-4"
          style={{ paddingTop: 'max(0.375rem, env(safe-area-inset-top))' }}>
          {t('pwa.offline')}
        </div>
      )}

      {/* Update banner */}
      {showUpdate && (
        <div className="fixed sm:bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:left-auto sm:w-80 z-[60]
          bg-zinc-900 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom) + 8px)' }}>
          <span className="text-lg select-none">🔄</span>
          <p className="flex-1 text-xs font-medium">{t('pwa.update_ready')}</p>
          <button
            onClick={() => { setShowUpdate(false); updateFn?.(); }}
            className="text-xs font-semibold bg-brand hover:bg-brand-hover text-white px-3 py-1.5 rounded-lg transition-colors shrink-0">
            {t('pwa.reload')}
          </button>
          <button onClick={() => setShowUpdate(false)}
            className="text-zinc-400 hover:text-white text-lg leading-none shrink-0">×</button>
        </div>
      )}

      {/* Offline-ready toast */}
      {offlineReady && (
        <div className="fixed sm:bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:left-auto sm:w-72 z-[60]
          bg-emerald-600 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom) + 8px)' }}>
          <span className="text-lg select-none">✅</span>
          <p className="flex-1 text-xs font-medium">{t('pwa.offline_ready')}</p>
        </div>
      )}

      {/* Install prompt */}
      {showInstall && (
        <div className="fixed sm:bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:left-auto sm:w-80 z-[60]
          bg-white border border-zinc-200 rounded-xl shadow-2xl px-4 py-3"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom) + 8px)' }}>
          <div className="flex items-start gap-3">
            <img src="/icon-192.svg" alt="" className="w-10 h-10 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-800">{t('pwa.install_title')}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{t('pwa.install_sub')}</p>
            </div>
            <button onClick={dismissInstall} className="text-zinc-400 hover:text-zinc-700 text-lg leading-none shrink-0">×</button>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={doInstall}
              className="flex-1 text-xs font-semibold bg-brand hover:bg-brand-hover text-white px-3 py-2 rounded-lg transition-colors">
              {t('pwa.install_cta')}
            </button>
            <button onClick={dismissInstall}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-700 px-3 py-2 rounded-lg hover:bg-zinc-50 transition-colors">
              {t('pwa.install_later')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
