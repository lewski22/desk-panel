import { useState, useEffect } from 'react';
import { useTranslation }      from 'react-i18next';
import { appApi }              from '../api/client';

export function KioskAccountPage() {
  const { t }                             = useTranslation();
  const [account,       setAccount]       = useState<any>(null);
  const [loading,       setLoading]       = useState(true);
  const [passwordModal, setPasswordModal] = useState<string | null>(null);
  const [busy,          setBusy]          = useState(false);

  const load = () => {
    setLoading(true);
    appApi.kiosk.getAccount()
      .then(a => setAccount(a))
      .catch((e: any) => {
        const status = e?.status ?? e?.response?.status;
        if (status === 404) setAccount(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setBusy(true);
    try {
      const res = await appApi.kiosk.createAccount();
      setPasswordModal(res.plaintextPassword);
      load();
    } catch (e: any) {
      alert(e.message ?? 'Błąd tworzenia konta');
    } finally { setBusy(false); }
  };

  const handleResetPassword = async () => {
    if (!confirm('Zresetować hasło konta kiosk? Aktywne sesje zostaną wylogowane.')) return;
    setBusy(true);
    try {
      const res = await appApi.kiosk.resetPassword();
      setPasswordModal(res.plaintextPassword);
    } catch (e: any) {
      alert(e.message ?? 'Błąd resetu hasła');
    } finally { setBusy(false); }
  };

  const handleToggleStatus = async () => {
    if (!account) return;
    setBusy(true);
    try {
      await appApi.kiosk.toggleStatus(!account.isActive);
      load();
    } catch (e: any) {
      alert(e.message ?? 'Błąd zmiany statusu');
    } finally { setBusy(false); }
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-5 h-5 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-lg">
      <h2 className="text-lg font-semibold text-zinc-800 mb-4">
        {t('kiosk.account_title', 'Konto Kiosk')}
      </h2>

      {!account ? (
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 text-center">
          <p className="text-zinc-500 text-sm mb-4">
            Brak konta kiosk dla tej organizacji.
          </p>
          <button
            onClick={handleCreate}
            disabled={busy}
            className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold
              hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {busy ? '…' : `+ ${t('kiosk.account_create', 'Utwórz konto kiosk')}`}
          </button>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-2xl p-6">
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Email</span>
              <span className="text-zinc-800 font-mono text-xs">{account.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Status</span>
              <span className={account.isActive ? 'text-emerald-600' : 'text-red-500'}>
                {account.isActive ? '🟢 Aktywne' : '🔴 Nieaktywne'}
              </span>
            </div>
            {account.updatedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Ostatnia zmiana</span>
                <span className="text-zinc-600 text-xs">
                  {new Date(account.updatedAt).toLocaleString('pl-PL')}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleResetPassword}
              disabled={busy}
              className="flex-1 py-2 rounded-xl text-sm border border-zinc-200
                text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 transition-all disabled:opacity-40"
            >
              {t('kiosk.account_reset', 'Reset hasła')}
            </button>
            <button
              onClick={handleToggleStatus}
              disabled={busy}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 ${
                account.isActive
                  ? 'border border-red-200 text-red-600 hover:bg-red-50'
                  : 'bg-emerald-600 text-white hover:opacity-90'
              }`}
            >
              {account.isActive
                ? t('kiosk.account_deactivate', 'Dezaktywuj')
                : t('kiosk.account_activate', 'Aktywuj')
              }
            </button>
          </div>
        </div>
      )}

      {/* Modal z jednorazowym hasłem */}
      {passwordModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <p className="text-amber-600 font-semibold mb-1 text-sm">
              ⚠️ {t('kiosk.account_password_once', 'Zapisz to hasło — pokazujemy je tylko raz!')}
            </p>
            <p className="text-zinc-500 text-xs mb-3">{account?.email}</p>
            <div className="flex items-center gap-2 bg-zinc-100 rounded-xl px-3 py-2.5 mb-4">
              <code className="flex-1 text-zinc-800 font-mono text-sm break-all">{passwordModal}</code>
              <button
                onClick={() => navigator.clipboard.writeText(passwordModal)}
                title={t('kiosk.account_copy', 'Kopiuj')}
                className="text-zinc-400 hover:text-zinc-700 transition-colors text-lg flex-shrink-0"
              >
                📋
              </button>
            </div>
            <button
              onClick={() => setPasswordModal(null)}
              className="w-full py-2 bg-zinc-800 text-white rounded-xl text-sm font-semibold hover:opacity-90"
            >
              {t('kiosk.account_close', 'Rozumiem, zamknij')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
