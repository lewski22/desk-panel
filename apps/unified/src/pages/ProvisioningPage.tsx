import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { Btn, Modal, FormField, Input } from '../components/ui';

// ── Location selector hook ─────────────────────────────────────
function useLocations() {
  const [locations, setLocations] = useState<any[]>([]);
  const [activeLocId, setActiveLocId] = useState<string>(() =>
    localStorage.getItem('provisioning_loc') ?? import.meta.env.VITE_LOCATION_ID ?? ''
  );
  useEffect(() => {
    appApi.locations.listAll().then(locs => {
      setLocations(locs);
      if (!activeLocId && locs.length > 0) {
        setActiveLocId(locs[0].id);
        localStorage.setItem('provisioning_loc', locs[0].id);
      }
    }).catch(() => {});
  }, []);
  const setLoc = (id: string) => {
    setActiveLocId(id);
    localStorage.setItem('provisioning_loc', id);
  };
  return { locations, activeLocId, setLoc };
}

// ── GatewaySection ────────────────────────────────────────────
function GatewaySection({ locations, activeLocId }: { locations: any[]; activeLocId: string }) {
  const [gateways,     setGateways]     = useState<any[]>([]);
  const [modal,        setModal]        = useState<'install'|'secret'|null>(null);
  const [locId,        setLocId]        = useState(activeLocId);
  const [tokenResult,  setTokenResult]  = useState<any>(null);
  const [secretResult, setSecretResult] = useState<any>(null);
  const [busy,         setBusy]         = useState(false);
  const [copied,       setCopied]       = useState(false);

  useEffect(() => { setLocId(activeLocId); }, [activeLocId]);

  const load = () => {
    appApi.gateways.list().then(setGateways).catch(() => {});
  };
  useEffect(() => {
    load();
    // Auto-refresh co 15s — aktualizuje status Online/Offline bez przeładowania
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);

  // Nowy flow: generuj token instalacyjny zamiast ręcznego rejestrowania
  const openInstall = async () => {
    setLocId(activeLocId);
    setTokenResult(null);
    setModal('install');
    setBusy(true);
    try {
      const r = await appApi.gateways.createSetupToken(activeLocId);
      setTokenResult(r);
    } catch (e: any) { setGwErr(e.message); setModal(null); }
    setBusy(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Usunąć gateway "${name}"?`)) return;
    try { await appApi.gateways.remove(id); await load(); }
    catch (e: any) { setGwErr(e.message); }
  };

  const handleUpdate = async (id: string, name: string) => {
    if (!confirm(`Zaktualizować gateway "${name}" do najnowszej wersji?

Gateway uruchomi się ponownie (~15s).`)) return;
    try {
      const r = await appApi.gateways.triggerUpdate(id);
      setGwErr(`✓ ${r.oldVersion} → ${r.newVersion}`);
      setTimeout(load, 18_000);  // odśwież po restarcie
    } catch (e: any) {
      setGwErr(`Błąd: ${e.message ?? e}`);
    }
  };


  const handleRegenSecret = async (id: string) => {
    // Legacy alias — delegates to handleRotateSecret
    handleRotateSecret(id);
  };

  const handleRotateSecret = async (id: string) => {
    if (!confirm(
      'Rotacja klucza gateway\n\n' +
      'Nowy klucz zostanie wygenerowany i wysłany do gateway automatycznie.\n' +
      'Stary klucz pozostaje ważny przez 15 minut — okno na ewentualną ręczną aktualizację.'
    )) return;
    setBusy(true);
    try {
      const r = await appApi.gateways.rotateSecret(id);
      setSecretResult(r);
      setModal('secret');
    } catch (e: any) { setGwErr(e.message ?? 'Błąd rotacji'); }
    setBusy(false);
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-zinc-700">Gateway'e</h2>
        <Btn onClick={openInstall}>+ Nowy gateway</Btn>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-100">
            <tr>{['Nazwa','ID','Biuro','IP','Wersja','Urządzenia','Status','Ostatni kontakt',''].map(h =>
              <th key={h} className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{h}</th>
            )}</tr>
          </thead>
          <tbody>
            {gateways.map(gw => {
              const now          = Date.now();
              const lastSeenMs   = gw.lastSeen ? new Date(gw.lastSeen).getTime() : null;
              const minutesSince = lastSeenMs ? Math.floor((now - lastSeenMs) / 60000) : null;
              const neverSeen    = !lastSeenMs;
              const stale        = lastSeenMs && minutesSince! > 5;
              const healthy      = gw.isOnline && !stale;

              let diagMsg   = '';
              let diagColor = '';
              if (neverSeen) {
                diagMsg   = 'Nigdy nie połączony — uruchom komendę instalacyjną z panelu Biura → + Gateway';
                diagColor = 'text-amber-600 bg-amber-50 border-amber-200';
              } else if (!gw.isOnline && stale) {
                diagMsg   = `Offline od ${minutesSince} min — sprawdź: journalctl -u reserti-gateway -n 20`;
                diagColor = 'text-red-600 bg-red-50 border-red-200';
              } else if (gw.isOnline && stale) {
                diagMsg   = `Brak heartbeat od ${minutesSince} min — sprawdź: systemctl status reserti-gateway`;
                diagColor = 'text-amber-600 bg-amber-50 border-amber-200';
              }

              return (
              <React.Fragment key={gw.id}>
                <tr className="border-b border-zinc-50 hover:bg-zinc-50/50 group">
                  <td className="py-3 px-4 font-medium text-zinc-800">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${healthy ? 'bg-emerald-400' : stale ? 'bg-amber-400 animate-pulse' : 'bg-zinc-300'}`} />
                      {gw.name}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <code className="text-[10px] font-mono text-zinc-500 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded select-all">{gw.id}</code>
                      <button onClick={() => navigator.clipboard.writeText(gw.id)} className="text-zinc-400 hover:text-[#B53578] transition-colors" title="Kopiuj ID">⎘</button>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-zinc-500">{gw.location?.name ?? '—'}</td>
                  <td className="py-3 px-4 font-mono text-xs text-zinc-500">{gw.ipAddress ?? '—'}</td>
                  <td className="py-3 px-4 font-mono text-xs text-zinc-500">{gw.version ?? '—'}</td>
                  <td className="py-3 px-4 text-zinc-600">{gw._count?.devices ?? 0}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${healthy ? 'bg-emerald-100 text-emerald-700' : stale ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {healthy ? 'Online' : stale ? 'Problem' : 'Offline'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-zinc-400">
                    {lastSeenMs ? (minutesSince === 0 ? 'przed chwilą' : `${minutesSince} min temu`) : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {gw.ipAddress && (
                        <button onClick={() => handleUpdate(gw.id, gw.name)}
                          className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-sky-100 text-zinc-600 hover:text-sky-700 transition-colors"
                          title="Zaktualizuj gateway do najnowszej wersji">↑ Update</button>
                      )}
                      <button onClick={() => handleRotateSecret(gw.id)}
                        className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-amber-100 text-zinc-600 hover:text-amber-700 transition-colors"
                        title="Rotuj klucz (15min okno)">🔑 Rotuj</button>
                      <button onClick={() => handleDelete(gw.id, gw.name)}
                        className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-red-100 text-zinc-600 hover:text-red-600 transition-colors"
                        title="Usuń gateway">Usuń</button>
                    </div>
                  </td>
                </tr>
                {diagMsg && (
                  <tr className="border-b border-zinc-50">
                    <td colSpan={8} className="px-4 py-2">
                      <div className={`flex items-start gap-2 text-xs rounded-lg border px-3 py-2 ${diagColor}`}>
                        <span className="shrink-0 mt-0.5">⚠</span>
                        <div>
                          <span className="font-medium">{gw.name}: </span>
                          {diagMsg}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
              );
            })}
            {gateways.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-zinc-400 text-sm">
                Brak gateway'ów — kliknij "+ Nowy gateway" aby wygenerować komendę instalacyjną
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: token instalacyjny */}
      <Modal open={modal === 'install'} title="Dodaj gateway" onClose={() => setModal(null)}>
        {busy && !tokenResult && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-zinc-200 border-t-[#B53578] rounded-full animate-spin" />
          </div>
        )}
        {tokenResult && (
          <div className="space-y-4">
            <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
              <p className="text-sm font-semibold text-zinc-700 mb-2">Jak zainstalować gateway:</p>
              <ol className="text-sm text-zinc-600 space-y-1.5 list-decimal list-inside">
                <li>Włącz Raspberry Pi (lub inne urządzenie z Linuksem)</li>
                <li>Otwórz terminal (SSH lub lokalnie)</li>
                <li>Wklej poniższą komendę i naciśnij Enter</li>
              </ol>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-1.5 font-medium">Komenda instalacyjna (ważna 24h, jednorazowa)</p>
              <div className="bg-zinc-950 rounded-xl p-4 flex items-start gap-3">
                <code className="text-emerald-400 text-xs font-mono flex-1 break-all leading-relaxed">{tokenResult.installCmd}</code>
                <button onClick={() => copy(tokenResult.installCmd)}
                  className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors font-medium">
                  {copied ? '✓' : '⎘'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-zinc-50 rounded-lg p-3">
                <p className="text-zinc-400 mb-0.5">Biuro</p>
                <p className="font-medium text-zinc-700">{tokenResult.location?.name}</p>
              </div>
              <div className="bg-zinc-50 rounded-lg p-3">
                <p className="text-zinc-400 mb-0.5">Ważna do</p>
                <p className="font-medium text-zinc-700">
                  {new Date(tokenResult.expiresAt).toLocaleString('pl-PL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <span className="text-amber-500 shrink-0">⚠</span>
              <p className="text-xs text-amber-700">Token jest jednorazowy. Po użyciu wygasa — wróć tu po nowy jeśli instalacja się nie powiedzie.</p>
            </div>
            <div className="flex justify-end"><Btn onClick={() => setModal(null)}>Zamknij</Btn></div>
          </div>
        )}
      </Modal>

      {/* Regenerate secret modal */}
      <Modal open={modal === 'secret'} title="Nowy secret gateway" onClose={() => { setModal(null); setSecretResult(null); }}>
        {secretResult && (
          <div className="space-y-3">
            {secretResult.gatewayReached ? (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
                ✓ Gateway zaktualizowany automatycznie — uruchomi się ponownie za ~2s
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium">
                ⚠ Nie można połączyć z gateway — zaktualizuj ręcznie przed upływem okna
              </div>
            )}
            <div className="bg-zinc-950 rounded-xl p-4 font-mono text-xs text-zinc-200 space-y-1">
              <p><span className="text-zinc-500">GATEWAY_ID=</span>{secretResult.gateway?.id}</p>
              <p><span className="text-zinc-500">GATEWAY_SECRET=</span><span className="text-amber-400">{secretResult.secret}</span></p>
            </div>
            <div className="flex gap-4 text-xs">
              <div className="flex-1 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
                ✓ Nowy klucz aktywny od teraz
              </div>
              <div className="flex-1 p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-600">
                ⏱ Stary klucz wygasa: {secretResult.expiresAt ? new Date(secretResult.expiresAt).toLocaleTimeString('pl-PL') : '—'}
              </div>
            </div>
            <p className="text-xs text-zinc-400">Ręcznie: edytuj <code className="bg-zinc-100 px-1 rounded">/opt/reserti-gateway/.env</code> i uruchom <code className="bg-zinc-100 px-1 rounded">systemctl restart reserti-gateway</code></p>
            <div className="flex justify-end"><Btn onClick={() => { setModal(null); setSecretResult(null); }}>Zamknij</Btn></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── BeaconSection — OTA status + i18n ────────────────────────
// Zastępuje stary BeaconSection z alert() i bez statusu OTA.
// Nowe funkcje:
//   - Status OTA: idle | in_progress | success | failed (badge)
//   - Auto-refresh co 15s gdy są beacony in_progress
//   - Przycisk "Zaktualizuj wszystkie" (ota-all) bez alert()
//   - Inline toast zamiast alert/confirm
//   - useTranslation — wszystkie stringi z i18n
import { useTranslation } from 'react-i18next';

// ── OTA status badge ──────────────────────────────────────────
function OtaBadge({ status, version }: { status?: string; version?: string }) {
  const { t } = useTranslation();
  if (!status || status === 'idle') return null;

  const cfg = {
    in_progress: {
      cls:   'bg-amber-100 text-amber-700 border-amber-200',
      label: t('provisioning.ota.status_in_progress'),
      icon:  '⟳',
      spin:  true,
    },
    success: {
      cls:   'bg-emerald-100 text-emerald-700 border-emerald-200',
      label: t('provisioning.ota.status_success'),
      icon:  '✓',
      spin:  false,
    },
    failed: {
      cls:   'bg-red-100 text-red-600 border-red-200',
      label: t('provisioning.ota.status_failed'),
      icon:  '✗',
      spin:  false,
    },
  }[status] ?? null;

  if (!cfg) return null;

  return (
    <span
      title={version ? `v${version}` : undefined}
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.cls}`}
    >
      <span className={cfg.spin ? 'animate-spin inline-block' : ''}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

// ── Inline toast (zamiast alert()) ───────────────────────────
function Toast({
  msg, type = 'info', onClose,
}: {
  msg: string; type?: 'info' | 'success' | 'error'; onClose(): void;
}) {
  const cls = {
    info:    'bg-sky-50 border-sky-200 text-sky-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    error:   'bg-red-50 border-red-200 text-red-600',
  }[type];
  return (
    <div className={`flex items-start justify-between gap-3 p-3 rounded-xl border text-sm mb-3 ${cls}`}>
      <span>{msg}</span>
      <button onClick={onClose} className="opacity-60 hover:opacity-100 flex-shrink-0">✕</button>
    </div>
  );
}

// ── BeaconSection ─────────────────────────────────────────────
function BeaconSection({ locations, activeLocId }: { locations: any[]; activeLocId: string }) {
  const { t }      = useTranslation();
  const [desks,    setDesks]    = React.useState<any[]>([]);
  const [devices,  setDevices]  = React.useState<any[]>([]);
  const [gateways, setGateways] = React.useState<any[]>([]);
  const [modal,    setModal]    = React.useState(false);
  const [result,   setResult]   = React.useState<any>(null);
  const [form,     setForm]     = React.useState({ hardwareId: '', deskId: '', gatewayId: '', locId: activeLocId });
  const [busy,     setBusy]     = React.useState(false);
  const [filterLoc,    setFilterLoc]    = React.useState('all');
  const [assignTarget, setAssignTarget] = React.useState<any>(null);
  const [assignDeskId, setAssignDeskId] = React.useState('');
  const [assignBusy,   setAssignBusy]   = React.useState(false);
  const [latestFw,     setLatestFw]     = React.useState<any>(null);
  const [otaAllBusy,   setOtaAllBusy]   = React.useState(false);
  const [toast,        setToast]        = React.useState<{ msg: string; type: 'info'|'success'|'error' } | null>(null);
  const autoRefreshRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => { setForm(f => ({ ...f, locId: activeLocId })); }, [activeLocId]);

  const load = React.useCallback(async () => {
    const [dev, gw] = await Promise.all([
      appApi.devices.list().catch(() => [] as any[]),
      appApi.gateways.list().catch(() => [] as any[]),
    ]);
    setDevices(dev);
    setGateways(gw);
  }, []);

  const loadDesks = async (locId: string) => {
    if (!locId) return;
    const d = await appApi.desks.list(locId).catch(() => [] as any[]);
    setDesks(d);
  };

  // Auto-refresh co 15s gdy są beacony in_progress
  React.useEffect(() => {
    load();
    appApi.devices.firmwareLatest().then(setLatestFw).catch(() => {});
  }, [load]);

  React.useEffect(() => {
    const hasInProgress = devices.some(d => d.otaStatus === 'in_progress');
    if (hasInProgress) {
      if (!autoRefreshRef.current) {
        autoRefreshRef.current = setInterval(load, 15_000);
      }
    } else {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [devices, load]);

  React.useEffect(() => { loadDesks(form.locId); }, [form.locId]);

  // ── OTA: pojedynczy beacon ────────────────────────────────
  const handleOta = async (deviceId: string, hwId: string, currentFw?: string) => {
    if (!latestFw) return;
    const confirmed = window.confirm(
      t('provisioning.ota.confirm_msg', {
        hwId,
        current: currentFw ?? t('common.na'),
        target:  latestFw.version,
      })
    );
    if (!confirmed) return;
    try {
      await appApi.devices.triggerOta(deviceId);
      setToast({
        msg:  t('provisioning.ota.started_desc', { hwId, version: latestFw.version }),
        type: 'info',
      });
      await load();
    } catch (e: any) {
      const msg = (e?.message ?? '') as string;
      if (msg.includes('Conflict') || msg.includes('409') || msg.includes('toku')) {
        setToast({ msg: t('provisioning.ota.conflict'), type: 'error' });
      } else if (msg.includes('biurka') || msg.includes('desk')) {
        setToast({ msg: t('provisioning.ota.no_desk'), type: 'error' });
      } else {
        setToast({ msg: `${t('common.error')}: ${msg}`, type: 'error' });
      }
    }
  };

  // ── OTA: wszystkie outdated ───────────────────────────────
  const handleOtaAll = async () => {
    if (!latestFw) return;
    const outdated = filteredDevices.filter(
      d => d.firmwareVersion !== latestFw.version && d.otaStatus !== 'in_progress'
    );
    if (!outdated.length) {
      setToast({ msg: t('provisioning.firmware.no_outdated'), type: 'info' });
      return;
    }
    const confirmed = window.confirm(
      t('provisioning.firmware.update_all_confirm', {
        count:   outdated.length,
        version: latestFw.version,
      })
    );
    if (!confirmed) return;
    setOtaAllBusy(true);
    try {
      const locId = filterLoc !== 'all' ? filterLoc : undefined;
      const r     = await appApi.devices.otaAll(locId);
      setToast({
        msg:  t('provisioning.firmware.update_all_started', {
          count:   r.queued ?? outdated.length,
          version: latestFw.version,
        }),
        type: 'info',
      });
      await load();
    } catch (e: any) {
      setToast({ msg: `${t('common.error')}: ${e?.message}`, type: 'error' });
    }
    setOtaAllBusy(false);
  };

  // ── Provision ─────────────────────────────────────────────
  const provision = async () => {
    setBusy(true);
    try {
      const r = await appApi.devices.provision({
        hardwareId: form.hardwareId,
        deskId:     form.deskId || undefined,
        gatewayId:  form.gatewayId,
      });
      setResult(r);
      await load();
    } catch (e: any) {
      setToast({ msg: e.message, type: 'error' });
    }
    setBusy(false);
  };

  const sendCmd = (deviceId: string, cmd: string) => appApi.devices.command(deviceId, cmd);

  const handleDelete = async (id: string, hwId: string) => {
    if (!window.confirm(t('provisioning.device.delete_confirm', { hwId }))) return;
    try { await appApi.devices.remove(id); await load(); }
    catch (e: any) { setToast({ msg: e.message, type: 'error' }); }
  };

  const getDeviceLocation = (d: any) => {
    const gw = gateways.find(g => g.id === d.gatewayId);
    return gw?.location?.name ?? t('common.na');
  };

  const filteredDevices = filterLoc === 'all'
    ? devices
    : devices.filter(d => {
        const gw = gateways.find(g => g.id === d.gatewayId);
        return gw?.locationId === filterLoc;
      });

  const handleAssign = async () => {
    if (!assignTarget || !assignDeskId) return;
    setAssignBusy(true);
    try {
      await appApi.devices.assign(assignTarget.id, assignDeskId);
      await load();
      setAssignTarget(null);
    } catch (e: any) { setToast({ msg: e.message, type: 'error' }); }
    setAssignBusy(false);
  };

  const openAssignModal = async (device: any) => {
    setAssignTarget(device);
    setAssignDeskId(device.desk?.id ?? '');
    const gw    = gateways.find((g: any) => g.id === device.gatewayId);
    const locId = gw?.location?.id ?? gw?.locationId ?? activeLocId;
    await loadDesks(locId);
  };

  const availableGateways = form.locId
    ? gateways.filter(g => g.locationId === form.locId)
    : gateways;

  const outdatedCount = filteredDevices.filter(
    d => latestFw && d.firmwareVersion !== latestFw.version && d.otaStatus !== 'in_progress'
  ).length;

  return (
    <div>
      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-zinc-700">
            {t('provisioning.beacons_title')}
          </h2>
          <select
            value={filterLoc}
            onChange={e => setFilterLoc(e.target.value)}
            className="text-xs border border-zinc-200 rounded-lg px-2 py-1 text-zinc-600 focus:outline-none"
          >
            <option value="all">{t('common.all_offices')}</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          {latestFw && outdatedCount > 0 && (
            <Btn
              variant="secondary"
              size="sm"
              onClick={handleOtaAll}
              loading={otaAllBusy}
              title={t('provisioning.firmware.update_all')}
            >
              🆙 {t('provisioning.firmware.update_all')}
              <span className="ml-1 bg-violet-100 text-violet-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {outdatedCount}
              </span>
            </Btn>
          )}
          <Btn onClick={() => {
            setModal(true);
            setResult(null);
            setForm({ hardwareId: '', deskId: '', gatewayId: '', locId: activeLocId });
          }}>
            {t('provisioning.add_provisioning')}
          </Btn>
        </div>
      </div>

      {/* ── Firmware banner ── */}
      {latestFw && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-sky-50 border border-sky-200 mb-3">
          <span className="text-sky-600 text-sm">📦</span>
          <div className="flex-1">
            <span className="text-sm text-sky-800 font-medium">
              {t('provisioning.firmware.latest_label')}: v{latestFw.version}
            </span>
            <span className="text-xs text-sky-600 ml-2">
              ({(latestFw.size / 1024).toFixed(0)} {t('provisioning.firmware.size_kb')} ·{' '}
              {t('provisioning.firmware.published')}{' '}
              {new Date(latestFw.publishedAt).toLocaleDateString('pl-PL')})
            </span>
          </div>
          {outdatedCount > 0 && (
            <span className="text-xs text-sky-600 font-medium">
              {outdatedCount} {outdatedCount === 1 ? 'beacon' : 'beaconów'} wymaga aktualizacji
            </span>
          )}
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-x-auto rounded-xl border border-zinc-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-100">
            <tr>
              {[
                t('provisioning.table.hardware_id'),
                t('provisioning.table.device_id'),
                t('provisioning.table.mqtt_user'),
                t('provisioning.table.office'),
                t('provisioning.table.desk'),
                t('common.status'),
                t('provisioning.table.fw'),
                t('common.actions'),
              ].map(h => (
                <th key={h} className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map(d => (
              <tr key={d.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 group">
                <td className="py-3 px-4 font-mono text-xs text-zinc-700">{d.hardwareId}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1">
                    <code className="text-[10px] font-mono text-zinc-500 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded select-all">
                      {d.id}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(d.id)}
                      className="text-zinc-400 hover:text-[#B53578] transition-colors"
                      title={t('common.copy')}
                    >⎘</button>
                  </div>
                </td>
                <td className="py-3 px-4 font-mono text-xs text-zinc-400">{d.mqttUsername}</td>
                <td className="py-3 px-4 text-xs text-zinc-500">{getDeviceLocation(d)}</td>
                <td className="py-3 px-4 text-zinc-700">
                  {d.desk
                    ? `${d.desk.name} (${d.desk.code})`
                    : <span className="text-zinc-300">{t('provisioning.device.no_desk')}</span>}
                </td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    d.isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-400'
                  }`}>
                    {d.isOnline ? t('common.online') : t('common.offline')}
                  </span>
                </td>
                {/* ── Firmware + OTA status ── */}
                <td className="py-3 px-4">
                  <div className="flex flex-col gap-1">
                    <span className={`font-mono text-xs ${
                      latestFw && d.firmwareVersion && d.firmwareVersion !== latestFw.version
                        ? 'text-amber-600'
                        : 'text-zinc-400'
                    }`}>
                      {d.firmwareVersion ?? t('common.na')}
                    </span>
                    {d.otaStatus && d.otaStatus !== 'idle' && (
                      <OtaBadge status={d.otaStatus} version={d.otaVersion} />
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => sendCmd(d.id, 'IDENTIFY')}
                      className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors"
                      title={t('provisioning.device.identify')}
                    >💡</button>
                    <button
                      onClick={() => sendCmd(d.id, 'REBOOT')}
                      className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-amber-100 text-zinc-600 hover:text-amber-600 transition-colors"
                      title={t('provisioning.device.reboot')}
                    >↺</button>
                    <button
                      onClick={() => openAssignModal(d)}
                      className="text-xs px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-600 transition-colors font-medium"
                      title={t('provisioning.device.assign')}
                    >
                      {t('provisioning.device.assign')}
                    </button>
                    {/* OTA button — tylko gdy jest nowsza wersja i status != in_progress */}
                    {latestFw &&
                      d.firmwareVersion !== latestFw.version &&
                      d.otaStatus !== 'in_progress' && (
                      <button
                        onClick={() => handleOta(d.id, d.hardwareId, d.firmwareVersion)}
                        className="text-xs px-2 py-1 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-600 transition-colors font-medium"
                        title={t('provisioning.ota.button_title', {
                          current: d.firmwareVersion ?? t('common.na'),
                          target:  latestFw.version,
                        })}
                      >
                        {t('provisioning.ota.button')}
                      </button>
                    )}
                    {d.desk && (
                      <button
                        onClick={async () => {
                          if (!window.confirm(
                            t('provisioning.device.unassign_confirm', {
                              hwId:     d.hardwareId,
                              deskName: d.desk.name,
                            })
                          )) return;
                          try { await appApi.desks.unpair(d.desk.id); await load(); }
                          catch (e: any) { setToast({ msg: e.message, type: 'error' }); }
                        }}
                        className="text-xs px-2 py-1 rounded-lg bg-zinc-50 hover:bg-zinc-100 text-zinc-500 transition-colors"
                        title={t('provisioning.device.unassign')}
                      >⊘</button>
                    )}
                    <button
                      onClick={() => handleDelete(d.id, d.hardwareId)}
                      className="text-xs px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
                      title={t('provisioning.device.delete')}
                    >✕</button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredDevices.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-zinc-400 text-sm">
                  {t('common.loading')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Assign modal ── */}
      {assignTarget && (
        <Modal
          title={t('provisioning.device.assign_title')}
          onClose={() => setAssignTarget(null)}
        >
          <p className="text-xs text-zinc-400 mt-0.5 mb-3">
            Beacon: {assignTarget.hardwareId}
          </p>
          <select
            value={assignDeskId}
            onChange={e => setAssignDeskId(e.target.value)}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none mb-4"
          >
            <option value="">{t('provisioning.device.assign_desk')}</option>
            {desks
              .filter(d => !d.device || d.device.id === assignTarget.id)
              .map((d: any) => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
          </select>
          <div className="flex gap-2 justify-end">
            <Btn variant="secondary" onClick={() => setAssignTarget(null)}>
              {t('common.cancel')}
            </Btn>
            <Btn onClick={handleAssign} loading={assignBusy}>
              {t('provisioning.device.assign_save')}
            </Btn>
          </div>
        </Modal>
      )}

      {/* ── Provision modal ── */}
      {modal && (
        <Modal
          title={t('provisioning.add_provisioning')}
          onClose={() => { setModal(false); setResult(null); }}
        >
          {!result ? (
            <div className="space-y-3">
              <FormField label="Hardware ID">
                <Input
                  value={form.hardwareId}
                  onChange={e => setForm(f => ({ ...f, hardwareId: e.target.value }))}
                  placeholder="ESP32 MAC / chip ID"
                />
              </FormField>
              <FormField label="Gateway">
                <select
                  value={form.gatewayId}
                  onChange={e => setForm(f => ({ ...f, gatewayId: e.target.value }))}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">— wybierz gateway —</option>
                  {availableGateways.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Biurko (opcjonalne)">
                <select
                  value={form.deskId}
                  onChange={e => setForm(f => ({ ...f, deskId: e.target.value }))}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">— wybierz biurko —</option>
                  {desks
                    .filter(d => !d.device)
                    .map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                </select>
              </FormField>
              <div className="flex gap-2 justify-end pt-1">
                <Btn variant="secondary" onClick={() => setModal(false)}>
                  {t('common.cancel')}
                </Btn>
                <Btn onClick={provision} loading={busy}>
                  Provisioning
                </Btn>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-emerald-600 font-semibold">
                ✓ Beacon zarejestrowany pomyślnie
              </p>
              <div className="bg-zinc-50 rounded-xl p-4 space-y-2 font-mono text-xs">
                {[
                  ['PROVISION:{'],
                  [`  "device_id": "${result.deviceId}"`],
                  [`  "gateway_id": "${result.gatewayId}"`],
                  [`  "mqtt_host": "...",`],
                  [`  "mqtt_user": "${result.mqttUsername}"`],
                  [`  "mqtt_pass": "${result.mqttPassword}"`],
                  ['}'],
                ].map(([line], i) => (
                  <div key={i} className="text-zinc-600 break-all">{line}</div>
                ))}
              </div>
              <p className="text-xs text-zinc-400">
                Wklej powyższe przez Serial Monitor (115200 baud) gdy beacon jest w trybie provisioning.
              </p>
              <div className="flex gap-2 justify-end">
                <Btn
                  variant="secondary"
                  onClick={() => {
                    const cmd = `PROVISION:{"device_id":"${result.deviceId}","gateway_id":"${result.gatewayId}","mqtt_host":"","mqtt_user":"${result.mqttUsername}","mqtt_pass":"${result.mqttPassword}"}`;
                    navigator.clipboard.writeText(cmd);
                  }}
                >
                  {t('common.copy')}
                </Btn>
                <Btn onClick={() => { setModal(false); setResult(null); }}>
                  {t('common.close')}
                </Btn>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}


// ── Main ──────────────────────────────────────────────────────
export function ProvisioningPage() {
  const { t } = useTranslation();
  const { locations, activeLocId, setLoc } = useLocations();

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">
            {t('provisioning.title')}
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Rejestracja i zarządzanie gateway&apos;ami i beaconami
          </p>
        </div>
        <div className="flex items-center gap-3">

          {/* Biuro switcher */}
          {locations.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">Biuro:</span>
              <select
                value={activeLocId}
                onChange={e => setLoc(e.target.value)}
                className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30 font-medium"
              >
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>
      <GatewaySection locations={locations} activeLocId={activeLocId} />
      <BeaconSection  locations={locations} activeLocId={activeLocId} />
    </div>
  );
}
