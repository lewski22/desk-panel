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
  const { t } = useTranslation();
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
    } catch (e: any) { alert(e.message || t('provisioning.install_failed')); setModal(null); }
    setBusy(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t('provisioning.confirm_delete_gateway', { name }))) return;
    try { await appApi.gateways.remove(id); await load(); }
    catch (e: any) { alert(e.message || t('provisioning.delete_failed')); }
  };

  const handleUpdate = async (id: string, name: string) => {
    if (!confirm(t('provisioning.confirm_update_gateway', { name }))) return;
    try {
      const r = await appApi.gateways.triggerUpdate(id);
      alert(t('provisioning.update_started', { old: r.oldVersion, new: r.newVersion }));
      setTimeout(load, 18_000);  // odśwież po restarcie
    } catch (e: any) {
      alert(e.message ?? t('provisioning.update_failed', { msg: e.message ?? e }));
    }
  };


  const handleRegenSecret = async (id: string) => {
    // Legacy alias — delegates to handleRotateSecret
    handleRotateSecret(id);
  };

  const handleRotateSecret = async (id: string) => {
    if (!confirm(t('provisioning.confirm_rotate'))) return;
    setBusy(true);
    try {
      const r = await appApi.gateways.rotateSecret(id);
      setSecretResult(r);
      setModal('secret');
    } catch (e: any) { alert(e.message ?? 'Błąd rotacji'); }
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
        <h2 className="font-semibold text-zinc-700">{t('provisioning.gateways_title')}</h2>
        <Btn onClick={openInstall}>{t('provisioning.new_gateway')}</Btn>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-100">
            <tr>
              <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('provisioning.table.name')}</th>
              <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('provisioning.table.id')}</th>
              <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('provisioning.table.location')}</th>
              <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('provisioning.table.ip')}</th>
              <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('provisioning.table.version')}</th>
              <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('provisioning.table.devices')}</th>
              <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('provisioning.table.status')}</th>
              <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('provisioning.table.last_seen')}</th>
              <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('provisioning.table.actions')}</th>
            </tr>
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
                      <button onClick={() => navigator.clipboard.writeText(gw.id)} className="text-zinc-400 hover:text-[#B53578] transition-colors" title={t('provisioning.copy_id')}>⎘</button>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-zinc-500">{gw.location?.name ?? '—'}</td>
                  <td className="py-3 px-4 font-mono text-xs text-zinc-500">{gw.ipAddress ?? '—'}</td>
                  <td className="py-3 px-4 font-mono text-xs text-zinc-500">{gw.version ?? '—'}</td>
                  <td className="py-3 px-4 text-zinc-600">{gw._count?.devices ?? 0}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${healthy ? 'bg-emerald-100 text-emerald-700' : stale ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {healthy ? t('provisioning.status.online') : stale ? t('provisioning.status.problem') : t('provisioning.status.offline')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-zinc-400">
                    {lastSeenMs ? (minutesSince === 0 ? t('provisioning.last_seen.now') : t('provisioning.last_seen.minutes', { minutes: minutesSince })) : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {gw.ipAddress && (
                        <button onClick={() => handleUpdate(gw.id, gw.name)}
                          className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-sky-100 text-zinc-600 hover:text-sky-700 transition-colors"
                          title={t('provisioning.update_title')}>{t('provisioning.update_button')}</button>
                      )}
                      <button onClick={() => handleRotateSecret(gw.id)}
                        className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-amber-100 text-zinc-600 hover:text-amber-700 transition-colors"
                        title={t('provisioning.rotate_title')}>{t('provisioning.rotate_button')}</button>
                      <button onClick={() => handleDelete(gw.id, gw.name)}
                        className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-red-100 text-zinc-600 hover:text-red-600 transition-colors"
                        title={t('provisioning.delete_title')}>{t('provisioning.delete_button')}</button>
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
                {t('provisioning.no_gateways')}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: token instalacyjny */}
      <Modal open={modal === 'install'} title={t('provisioning.modal.add_gateway')} onClose={() => setModal(null)}>
        {busy && !tokenResult && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-zinc-200 border-t-[#B53578] rounded-full animate-spin" />
          </div>
        )}
        {tokenResult && (
          <div className="space-y-4">
            <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
              <p className="text-sm font-semibold text-zinc-700 mb-2">{t('provisioning.install.title')}</p>
              <ol className="text-sm text-zinc-600 space-y-1.5 list-decimal list-inside">
                <li>{t('provisioning.install.step1')}</li>
                <li>{t('provisioning.install.step2')}</li>
                <li>{t('provisioning.install.step3')}</li>
              </ol>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-1.5 font-medium">{t('provisioning.install.cmd_label')}</p>
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
              <p className="text-xs text-amber-700">{t('provisioning.install.token_warning')}</p>
            </div>
            <div className="flex justify-end"><Btn onClick={() => setModal(null)}>{t('btn.cancel')}</Btn></div>
          </div>
        )}
      </Modal>

      {/* Regenerate secret modal */}
      <Modal open={modal === 'secret'} title={t('provisioning.modal.secret_title')} onClose={() => { setModal(null); setSecretResult(null); }}>
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
// ── BeaconSection ─────────────────────────────────────────────
function BeaconSection({ locations, activeLocId }: { locations: any[]; activeLocId: string }) {
  const { t } = useTranslation();
  const [desks,    setDesks]    = useState<any[]>([]);
  const [devices,  setDevices]  = useState<any[]>([]);
  const [gateways, setGateways] = useState<any[]>([]);
  const [modal,    setModal]    = useState(false);
  const [result,   setResult]   = useState<any>(null);
  const [form,     setForm]     = useState({ hardwareId: '', deskId: '', gatewayId: '', locId: activeLocId });
  const [busy,     setBusy]     = useState(false);
  const [filterLoc,    setFilterLoc]    = useState('all');
  const [assignTarget, setAssignTarget] = useState<any>(null);
  const [assignDeskId, setAssignDeskId] = useState('');
  const [assignBusy,   setAssignBusy]   = useState(false);
  const [latestFw,     setLatestFw]     = useState<any>(null);

  useEffect(() => { setForm(f => ({ ...f, locId: activeLocId })); }, [activeLocId]);

  const load = async () => {
    const [dev, gw] = await Promise.all([
      appApi.devices.list().catch(() => [] as any[]),
      appApi.gateways.list().catch(() => [] as any[]),
    ]);
    setDevices(dev);
    setGateways(gw);
  };

  const loadDesks = async (locId: string) => {
    if (!locId) return;
    const d = await appApi.desks.list(locId).catch(() => [] as any[]);
    setDesks(d);
  };

  useEffect(() => {
    load();
    appApi.devices.firmwareLatest().then(setLatestFw).catch(() => {});
  }, []);

  const handleOta = async (deviceId: string, hwId: string, currentFw: string) => {
    if (!latestFw) return;
    const msg = t('provisioning.confirm_ota', { hw: hwId, current: currentFw ?? '—', version: latestFw.version });
    if (!confirm(msg)) return;
    try {
      await appApi.devices.triggerOta(deviceId);
      alert(t('provisioning.ota_started', { version: latestFw.version }));
    } catch (e: any) { alert((e as any).message ?? t('provisioning.ota_failed')); }
  };
  useEffect(() => { loadDesks(form.locId); }, [form.locId]);

  const provision = async () => {
    setBusy(true);
    try {
      const r = await appApi.devices.provision({ hardwareId: form.hardwareId, deskId: form.deskId || undefined, gatewayId: form.gatewayId });
      setResult(r);
      await load();
    } catch(e:any) { alert(e.message ?? t('provisioning.provision_failed')); }
    setBusy(false);
  };

  const sendCmd = (deviceId: string, cmd: string) => appApi.devices.command(deviceId, cmd);

  const handleDelete = async (id: string, hwId: string) => {
    if (!confirm(t('provisioning.confirm_delete_beacon', { hw: hwId }))) return;
    try { await appApi.devices.remove(id); await load(); }
    catch(e:any) { alert(e.message ?? t('provisioning.delete_failed')); }
  };

  // Find location name for a device via its gateway
  const getDeviceLocation = (d: any) => {
    const gw = gateways.find(g => g.id === d.gatewayId);
    return gw?.location?.name ?? '—';
  };

  const filteredDevices = filterLoc === 'all'
    ? devices
    : devices.filter(d => {
        const gw = gateways.find(g => g.id === d.gatewayId);
        return gw?.locationId === filterLoc;
      });

  // Filter gateways by selected location for beacon form
  const handleAssign = async () => {
    if (!assignTarget || !assignDeskId) return;
    setAssignBusy(true);
    try {
      await appApi.devices.assign(assignTarget.id, assignDeskId);
      await load();
      setAssignTarget(null);
    } catch (e: any) { alert(e.message ?? t('provisioning.assign_failed')); }
    setAssignBusy(false);
  };

  // Otwórz modal przypisania — załaduj desks dla lokalizacji tego gateway
  const openAssignModal = async (device: any) => {
    setAssignTarget(device);
    setAssignDeskId(device.desk?.id ?? '');
    // Znajdź locId dla gateway tego beacona
    const gw = gateways.find((g: any) => g.id === device.gatewayId);
    const locId = gw?.location?.id ?? gw?.locationId ?? activeLocId;
    await loadDesks(locId);
  };

  const availableGateways = form.locId
    ? gateways.filter(g => g.locationId === form.locId)
    : gateways;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-zinc-700">{t('provisioning.beacons_title')}</h2>
          <select value={filterLoc} onChange={e => setFilterLoc(e.target.value)}
            className="text-xs border border-zinc-200 rounded-lg px-2 py-1 text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#B53578]/30">
            <option value="all">{t('provisioning.all_locations')}</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <Btn onClick={() => { setModal(true); setResult(null); setForm({ hardwareId:'', deskId:'', gatewayId:'', locId: activeLocId }); }}>
          {t('provisioning.provision_button')}
        </Btn>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-100">
          {latestFw && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-sky-50 border border-sky-200 mb-3">
              <span className="text-sky-600 text-sm">📦</span>
              <div className="flex-1">
                <span className="text-sm text-sky-800 font-medium">{t('provisioning.latest_firmware', { version: latestFw.version })}</span>
                <span className="text-xs text-sky-600 ml-2">
                  ({(latestFw.size / 1024).toFixed(0)} KB · {new Date(latestFw.publishedAt).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'pl-PL')})
                </span>
              </div>
            </div>
          )}
            <tr>
              <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('provisioning.table.hardware')}</th>
              <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('provisioning.table.id')}</th>
              <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('provisioning.table.mqtt_user')}</th>
              <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('provisioning.table.location')}</th>
              <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('provisioning.table.desk')}</th>
              <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('provisioning.table.status')}</th>
              <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('provisioning.table.fw')}</th>
              <th className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('provisioning.table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map(d => (
              <tr key={d.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 group">
                <td className="py-3 px-4 font-mono text-xs text-zinc-700">{d.hardwareId}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1">
                    <code className="text-[10px] font-mono text-zinc-500 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded select-all">{d.id}</code>
                    <button onClick={() => navigator.clipboard.writeText(d.id)} className="text-zinc-400 hover:text-[#B53578] transition-colors" title={t('provisioning.copy_id')}>⎘</button>
                  </div>
                </td>
                <td className="py-3 px-4 font-mono text-xs text-zinc-400">{d.mqttUsername}</td>
                <td className="py-3 px-4 text-xs text-zinc-500">{getDeviceLocation(d)}</td>
                <td className="py-3 px-4 text-zinc-700">
                  {d.desk ? `${d.desk.name} (${d.desk.code})` : <span className="text-zinc-300">—</span>}
                </td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-400'}`}>
                    {d.isOnline ? 'Online' : 'Offline'}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-xs text-zinc-400">{d.firmwareVersion ?? '—'}</td>
                <td className="py-3 px-4">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => sendCmd(d.id, 'IDENTIFY')}
                      className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors" title={t('provisioning.identify')}>💡</button>
                    <button onClick={() => sendCmd(d.id, 'REBOOT')}
                      className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-amber-100 text-zinc-600 hover:text-amber-600 transition-colors" title={t('provisioning.restart')}>↺</button>
                    <button onClick={() => openAssignModal(d)}
                      className="text-xs px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-600 transition-colors font-medium" title={t('provisioning.assign_to_desk')}>
                      {t('provisioning.assign')}
                    </button>
                    {latestFw && d.firmwareVersion !== latestFw.version && (
                      <button onClick={() => handleOta(d.id, d.hardwareId, d.firmwareVersion)}
                        className="text-xs px-2 py-1 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-600 transition-colors font-medium"
                        title={t('provisioning.update_fw_title', { from: d.firmwareVersion ?? '—', to: latestFw.version })}>
                        {t('provisioning.update_fw')}
                      
                      </button>
                      </button>
                    )}
                    {d.desk && (
                      <button onClick={async () => {
                        if (!confirm(t('provisioning.unpair_confirm', { hw: d.hardwareId, desk: d.desk.name }))) return;
                        try { await appApi.desks.unpair(d.desk.id); await load(); }
                        catch(e:any) { alert(e.message); }
                      }}
                        className="text-xs px-2 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-600 hover:text-orange-700 transition-colors font-medium">
                        {t('provisioning.unpair')}
                      </button>
                    )}
                    <button onClick={() => handleDelete(d.id, d.hardwareId)}
                      className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-red-100 text-zinc-600 hover:text-red-600 transition-colors" title={t('provisioning.delete_button')}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredDevices.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-zinc-400 text-sm">{t('provisioning.no_devices')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal — przypisz beacon do biurka */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <div>
                <p className="font-semibold text-zinc-800">Przypisz biurko</p>
                <p className="text-xs text-zinc-400 mt-0.5">Beacon: {assignTarget.hardwareId}</p>
              </div>
              <button onClick={() => setAssignTarget(null)} className="text-zinc-400 hover:text-zinc-700 text-xl w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100">×</button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5 font-medium">{t('provisioning.form.label.desk')}</label>
                <select value={assignDeskId} onChange={e => setAssignDeskId(e.target.value)}
                  className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30">
                  <option value="">{t('provisioning.form.none')}</option>
                  {desks.filter(d => !d.device || d.device.id === assignTarget.id).map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setAssignTarget(null)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm font-medium transition-colors">
                  {t('btn.cancel')}
                </button>
                <button onClick={handleAssign} disabled={assignBusy}
                  className="flex-1 py-2.5 rounded-xl bg-[#B53578] hover:bg-[#9d2d66] text-white font-semibold text-sm transition-colors disabled:opacity-50">
                  {assignBusy ? t('btn.saving') : t('btn.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal open={modal} title={t('provisioning.modal.provision_title')} onClose={() => setModal(false)}>
        {!result ? (
          <div className="flex flex-col gap-3">
            <FormField label={t('provisioning.form.label.location')}>
              <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
                value={form.locId} onChange={e => { setForm(f => ({ ...f, locId: e.target.value, gatewayId: '', deskId: '' })); }}>
                <option value="">{t('provisioning.form.select_placeholder')}</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </FormField>
            <FormField label={t('provisioning.form.hardware_label')}>
              <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
                placeholder="d-aabbccdd" value={form.hardwareId}
                onChange={e => setForm(f => ({ ...f, hardwareId: e.target.value }))} />
            </FormField>
            <FormField label={t('provisioning.form.label.gateway')}>
              <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
                value={form.gatewayId} onChange={e => setForm(f => ({ ...f, gatewayId: e.target.value }))}>
                <option value="">{t('provisioning.form.select_gateway_placeholder')}</option>
                {availableGateways.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </FormField>
            <FormField label={t('provisioning.form.assign_optional')}>
              <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
                value={form.deskId} onChange={e => setForm(f => ({ ...f, deskId: e.target.value }))}>
                <option value="">{t('provisioning.form.none')}</option>
                {desks.filter(d => !d.device).map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
              </select>
            </FormField>
            <div className="flex justify-end gap-2 mt-1">
              <Btn variant="secondary" onClick={() => setModal(false)}>{t('btn.cancel')}</Btn>
              <Btn onClick={provision} loading={busy} disabled={!form.hardwareId || !form.gatewayId}>{t('provisioning.provision_button')}</Btn>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
              {t('provisioning.provisioned_success')}
            </div>

            {/* Gotowa komenda PROVISION: dla monitora serialnego ESP32 */}
            <div>
              <p className="text-xs font-semibold text-zinc-600 mb-1.5">
                Wklej w monitorze serialnym ESP32 (115200 baud):
              </p>
              <div className="bg-zinc-950 rounded-xl p-3 flex items-start gap-2">
                <code className="text-emerald-400 text-[10px] font-mono flex-1 break-all leading-relaxed">
                  {`PROVISION:{"wifi_ssid":"NAZWA_WIFI","wifi_pass":"HASLO_WIFI","mqtt_host":"IP_RASPBERRY","mqtt_port":1883,"mqtt_user":"${result.mqttUsername}","mqtt_pass":"${result.mqttPassword}","device_id":"${result.device?.hardwareId}","desk_id":"${result.device?.deskId ?? ''}","gateway_id":"${result.device?.gatewayId}"}`}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(
                    `PROVISION:{"wifi_ssid":"NAZWA_WIFI","wifi_pass":"HASLO_WIFI","mqtt_host":"IP_RASPBERRY","mqtt_port":1883,"mqtt_user":"${result.mqttUsername}","mqtt_pass":"${result.mqttPassword}","device_id":"${result.device?.hardwareId}","desk_id":"${result.device?.deskId ?? ''}","gateway_id":"${result.device?.gatewayId}"}`
                  )}
                  className="shrink-0 text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                  title={t('provisioning.copy_cmd')}>⎘</button>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">{t('provisioning.serial_replace_hint')}</p>
            </div>

            {/* Dane techniczne */}
            <div className="bg-zinc-50 rounded-xl p-3 font-mono text-xs space-y-0.5">
              <p><span className="text-zinc-400">DEVICE_ID  </span><span className="text-zinc-700">{result.device?.hardwareId}</span></p>
              <p><span className="text-zinc-400">MQTT_USER  </span><span className="text-zinc-700">{result.mqttUsername}</span></p>
              <p><span className="text-zinc-400">MQTT_PASS  </span><span className="text-amber-600">{result.mqttPassword}</span></p>
            </div>
            <p className="text-xs text-red-500">{t('provisioning.mqtt_password_warning')}</p>
            <div className="flex justify-end"><Btn onClick={() => setModal(false)}>{t('btn.cancel')}</Btn></div>
          </div>
        )}
      </Modal>
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
          <h1 className="text-xl font-semibold text-zinc-800">{t('pages.provisioning.title')}</h1>
          <p className="text-xs text-zinc-400 mt-0.5">{t('provisioning.subtitle')}</p>
        </div>
        {/* Biuro switcher */}
        {locations.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">{t('provisioning.active_office_label')}</span>
            <select value={activeLocId} onChange={e => setLoc(e.target.value)}
              className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30 font-medium">
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <GatewaySection locations={locations} activeLocId={activeLocId} />
      <BeaconSection  locations={locations} activeLocId={activeLocId} />
    </div>
  );
}
