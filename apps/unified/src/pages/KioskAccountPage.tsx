import { useState, useEffect } from 'react';
import { useTranslation }      from 'react-i18next';
import { appApi }              from '../api/client';
import { toast }               from '../components/ui/Toast';

export function KioskAccountPage() {
  const { t }                             = useTranslation();
  const [account,       setAccount]       = useState<any>(null);
  const [loading,       setLoading]       = useState(true);
  const [passwordModal, setPasswordModal] = useState<string | null>(null);
  const [busy,          setBusy]          = useState(false);

  const [locations,     setLocations]     = useState<any[]>([]);
  const [locationsErr,  setLocationsErr]  = useState(false);
  const [selectedLoc,   setSelectedLoc]   = useState('');
  const [locSaving,     setLocSaving]     = useState(false);
  const [pinInputs,  setPinInputs]  = useState<Record<string, string>>({});
  const [pinSaving,  setPinSaving]  = useState<Record<string, boolean>>({});
  const [pinSuccess, setPinSuccess] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    appApi.locations.listAll()
      .then(locs => {
        const active = locs.filter((l: any) => l.isActive);
        setLocations(active);
        if (active.length > 0) setSelectedLoc(active[0].id);
      })
      .catch(() => setLocationsErr(true));
  }, []);

  // sync selectedLoc with account's current locationId once both are loaded
  useEffect(() => {
    if (!account || locations.length === 0) return;
    const currentLocId = account.kioskSettings?.locationId;
    if (currentLocId && locations.some((l: any) => l.id === currentLocId)) {
      setSelectedLoc(currentLocId);
    }
  }, [account, locations]);

  const handleCreate = async () => {
    if (!selectedLoc) { toast(t('kiosk.account_select_location', 'Wybierz lokalizację'), 'error'); return; }
    setBusy(true);
    try {
      const res = await appApi.kiosk.createAccount(selectedLoc);
      setPasswordModal(res.plaintextPassword);
      load();
    } catch (e: any) {
      toast(e.message ?? 'Błąd tworzenia konta', 'error');
    } finally { setBusy(false); }
  };

  const handleUpdateLocation = async () => {
    if (!selectedLoc) return;
    setLocSaving(true);
    try {
      await appApi.kiosk.updateLocation(selectedLoc);
      setAccount((a: any) => ({ ...a, kioskSettings: { ...(a.kioskSettings ?? {}), locationId: selectedLoc } }));
      toast(t('kiosk.account_location_saved', 'Lokalizacja zaktualizowana'), 'success');
    } catch (e: any) {
      toast(e.message ?? 'Błąd zmiany lokalizacji', 'error');
    } finally { setLocSaving(false); }
  };

  const handleResetPassword = async () => {
    if (!confirm(t('kiosk.reset_confirm', 'Zresetować hasło konta kiosk? Aktywne sesje zostaną wylogowane.'))) return;
    setBusy(true);
    try {
      const res = await appApi.kiosk.resetPassword();
      setPasswordModal(res.plaintextPassword);
    } catch (e: any) {
      toast(e.message ?? 'Błąd resetu hasła', 'error');
    } finally { setBusy(false); }
  };

  const handleToggleStatus = async () => {
    if (!account) return;
    setBusy(true);
    try {
      await appApi.kiosk.toggleStatus(!account.isActive);
      load();
    } catch (e: any) {
      toast(e.message ?? 'Błąd zmiany statusu', 'error');
    } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!confirm(t('kiosk.delete_confirm', 'Usunąć konto kiosk? Wszystkie aktywne sesje zostaną wylogowane. Tej operacji nie można cofnąć.'))) return;
    setBusy(true);
    try {
      await appApi.kiosk.deleteAccount();
      setAccount(null);
      toast(t('kiosk.deleted', 'Konto kiosk zostało usunięte'), 'success');
    } catch (e: any) {
      toast(e.message ?? 'Błąd usuwania konta', 'error');
    } finally { setBusy(false); }
  };

  const handleSetPin = async (locationId: string) => {
    const pin = pinInputs[locationId]?.trim();
    if (!pin || !/^\d{4,8}$/.test(pin)) { toast(t('kiosk.pin_invalid', 'PIN musi zawierać 4–8 cyfr'), 'error'); return; }
    const prev = locations.find(l => l.id === locationId)?.kioskPinSet ?? false;
    setPinSaving(s => ({ ...s, [locationId]: true }));
    setLocations(ls => ls.map(l => l.id === locationId ? { ...l, kioskPinSet: true } : l));
    try {
      await appApi.locations.updateKioskPin(locationId, pin);
      setPinInputs(p => ({ ...p, [locationId]: '' }));
      setPinSuccess(s => ({ ...s, [locationId]: true }));
      setTimeout(() => setPinSuccess(s => ({ ...s, [locationId]: false })), 2500);
    } catch (e: any) {
      setLocations(ls => ls.map(l => l.id === locationId ? { ...l, kioskPinSet: prev } : l));
      toast(e.message ?? 'Błąd zapisu PIN', 'error');
    } finally {
      setPinSaving(s => ({ ...s, [locationId]: false }));
    }
  };

  const handleClearPin = async (locationId: string) => {
    if (!confirm(t('kiosk.pin_clear_confirm', 'Usunąć PIN dla tej lokalizacji?'))) return;
    setPinSaving(s => ({ ...s, [locationId]: true }));
    setLocations(ls => ls.map(l => l.id === locationId ? { ...l, kioskPinSet: false } : l));
    try {
      await appApi.locations.updateKioskPin(locationId, null);
    } catch (e: any) {
      setLocations(ls => ls.map(l => l.id === locationId ? { ...l, kioskPinSet: true } : l));
      toast(e.message ?? 'Błąd zapisu', 'error');
    } finally {
      setPinSaving(s => ({ ...s, [locationId]: false }));
    }
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-5 h-5 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" />
    </div>
  );

  const currentLocName = account
    ? locations.find((l: any) => l.id === account.kioskSettings?.locationId)?.name
    : null;

  return (
    <div className="max-w-lg">
      <h2 className="text-lg font-semibold text-zinc-800 mb-4">
        {t('kiosk.account_title', 'Konto Kiosk')}
      </h2>

      {!account ? (
        /* ── Brak konta — formularz tworzenia ───────────────────── */
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6">
          <p className="text-zinc-500 text-sm mb-4">
            {t('kiosk.no_account', 'Brak konta kiosk dla tej organizacji.')}
          </p>
          {locations.length > 0 && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                📍 {t('kiosk.account_location_label', 'Domyślna lokalizacja kiosku')}
              </label>
              <select
                value={selectedLoc}
                onChange={e => setSelectedLoc(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2
                  text-sm text-zinc-800 focus:outline-none focus:border-brand"
              >
                {locations.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}
          {locationsErr && (
            <p className="text-xs text-red-500 mb-3">
              {t('kiosk.locations_load_error', 'Nie udało się załadować lokalizacji.')}
            </p>
          )}
          <button
            onClick={handleCreate}
            disabled={busy || !selectedLoc}
            className="w-full py-2.5 bg-brand text-white rounded-xl text-sm font-semibold
              hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {busy
              ? <span className="inline-flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </span>
              : `+ ${t('kiosk.account_create', 'Utwórz konto kiosk')}`
            }
          </button>
        </div>
      ) : (
        /* ── Istniejące konto ───────────────────────────────────── */
        <div className="bg-white border border-zinc-200 rounded-2xl p-6">
          {/* Info */}
          <div className="space-y-2 mb-5">
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
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">📍 {t('kiosk.account_location_label', 'Domyślna lokalizacja')}</span>
              <span className="text-zinc-600 text-xs">{currentLocName ?? '—'}</span>
            </div>
            {account.updatedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">{t('kiosk.account_updated', 'Ostatnia zmiana')}</span>
                <span className="text-zinc-600 text-xs">
                  {new Date(account.updatedAt).toLocaleString('pl-PL')}
                </span>
              </div>
            )}
          </div>

          {/* Zmiana lokalizacji */}
          {locations.length > 0 && (
            <div className="mb-5 pt-4 border-t border-zinc-100">
              <p className="text-xs font-medium text-zinc-500 mb-1.5">
                📍 {t('kiosk.account_location_label', 'Domyślna lokalizacja kiosku')}
              </p>
              <div className="flex gap-2">
                <select
                  value={selectedLoc}
                  onChange={e => setSelectedLoc(e.target.value)}
                  className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2
                    text-sm text-zinc-800 focus:outline-none focus:border-brand"
                >
                  {locations.map((l: any) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleUpdateLocation}
                  disabled={locSaving || selectedLoc === account.kioskSettings?.locationId}
                  className="px-3 py-2 bg-brand text-white rounded-xl text-sm font-semibold
                    hover:opacity-90 transition-opacity disabled:opacity-40 whitespace-nowrap"
                >
                  {locSaving
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                    : t('kiosk.account_location_save', 'Zmień')
                  }
                </button>
              </div>
            </div>
          )}

          {/* Akcje — Reset / Aktywuj-Dezaktywuj */}
          <div className="flex gap-3 mb-3">
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

          {/* Usuń konto */}
          <div className="pt-3 border-t border-zinc-100">
            <button
              onClick={handleDelete}
              disabled={busy}
              className="w-full py-2 rounded-xl text-sm border border-red-200 text-red-500
                hover:bg-red-50 hover:border-red-300 transition-all disabled:opacity-40"
            >
              {t('kiosk.account_delete', 'Usuń konto kiosk')}
            </button>
          </div>
        </div>
      )}

      {/* Sekcja PIN per-lokalizacja */}
      {locationsErr && (
        <p className="mt-4 text-xs text-red-500">
          {t('kiosk.locations_load_error', 'Nie udało się załadować lokalizacji. Odśwież stronę.')}
        </p>
      )}
      {!locationsErr && locations.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-zinc-700 mb-1">
            🔐 {t('kiosk.pin_section_title', 'Kod PIN kiosku — per lokalizacja')}
          </h3>
          <p className="text-xs text-zinc-400 mb-4">
            {t('kiosk.pin_section_desc', 'PIN wymagany do otwarcia panelu Ustawień oraz wyjścia z trybu kiosk. Ustaw oddzielny PIN dla każdej lokalizacji.')}
          </p>

          <div className="space-y-3">
            {locations.map(loc => (
              <div key={loc.id} className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-800">{loc.name}</p>
                    <p className="text-xs text-zinc-400">{loc.city ?? loc.address ?? ''}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    loc.kioskPinSet
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-zinc-100 text-zinc-400 border border-zinc-200'
                  }`}>
                    {loc.kioskPinSet
                      ? `🔒 ${t('kiosk.pin_set', 'PIN ustawiony')}`
                      : `🔓 ${t('kiosk.pin_not_set', 'Brak PIN')}`
                    }
                  </span>
                </div>

                <div className="flex gap-2 items-center">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder={t('kiosk.pin_placeholder', 'Nowy PIN (4–8 cyfr)')}
                    value={pinInputs[loc.id] ?? ''}
                    onChange={e => setPinInputs(p => ({ ...p, [loc.id]: e.target.value.replace(/\D/g, '') }))}
                    onKeyDown={e => e.key === 'Enter' && handleSetPin(loc.id)}
                    className="flex-1 bg-white border border-zinc-300 rounded-lg px-3 py-2
                      text-sm focus:outline-none focus:border-brand font-mono tracking-widest
                      placeholder:font-sans placeholder:tracking-normal"
                  />
                  <button
                    onClick={() => handleSetPin(loc.id)}
                    disabled={pinSaving[loc.id] || !pinInputs[loc.id]?.trim()}
                    className="px-3 py-2 bg-brand text-white rounded-lg text-sm font-semibold
                      hover:opacity-90 transition-opacity disabled:opacity-40 whitespace-nowrap"
                  >
                    {pinSaving[loc.id]
                      ? '…'
                      : pinSuccess[loc.id]
                        ? t('kiosk.pin_saved', '✓ Zapisano')
                        : t('kiosk.pin_save', 'Ustaw PIN')
                    }
                  </button>
                  {loc.kioskPinSet && (
                    <button
                      onClick={() => handleClearPin(loc.id)}
                      disabled={pinSaving[loc.id]}
                      title={t('kiosk.pin_clear', 'Usuń PIN')}
                      className="px-3 py-2 border border-zinc-200 text-zinc-400 rounded-lg text-sm
                        hover:border-red-200 hover:text-red-400 transition-colors disabled:opacity-40"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal z jednorazowym hasłem */}
      {passwordModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          role="alertdialog" aria-modal="true">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <p className="text-amber-600 font-semibold mb-1 text-sm">
              ⚠️ {t('kiosk.account_password_once', 'Zapisz to hasło — pokazujemy je tylko raz!')}
            </p>
            <p className="text-zinc-500 text-xs mb-3">{account?.email}</p>
            <div className="flex items-center gap-2 bg-zinc-100 rounded-xl px-3 py-2.5 mb-4">
              <code className="flex-1 text-zinc-800 font-mono text-sm break-all">{passwordModal}</code>
              <button
                onClick={() => navigator.clipboard.writeText(passwordModal)}
                aria-label={t('kiosk.account_copy', 'Kopiuj')}
                title={t('kiosk.account_copy', 'Kopiuj')}
                className="text-zinc-400 hover:text-zinc-700 transition-colors text-lg flex-shrink-0 p-1"
              >
                📋
              </button>
            </div>
            <button
              onClick={() => setPasswordModal(null)}
              className="w-full py-3 min-h-[44px] bg-zinc-800 text-white rounded-xl text-sm font-semibold hover:opacity-90"
            >
              {t('kiosk.account_close', 'Rozumiem, zamknij')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
