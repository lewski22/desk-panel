import React, { useEffect, useState } from 'react';
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

  const load = () => appApi.gateways.list().then(setGateways).catch(() => {});
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
    } catch (e: any) { alert(e.message); setModal(null); }
    setBusy(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Usunąć gateway "${name}"?`)) return;
    try { await appApi.gateways.remove(id); await load(); }
    catch (e: any) { alert(e.message); }
  };

  const handleRegenSecret = async (id: string) => {
    if (!confirm('Wygenerować nowy secret? Stary przestanie działać.')) return;
    setBusy(true);
    try {
      const r = await appApi.gateways.regenerateSecret(id);
      setSecretResult(r);
      setModal('secret');
    } catch (e: any) { alert(e.message); }
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
            <tr>{['Nazwa','ID','Biuro','IP','Urządzenia','Status','Ostatni kontakt',''].map(h =>
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
                      <button onClick={() => handleRegenSecret(gw.id)}
                        className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-amber-100 text-zinc-600 hover:text-amber-700 transition-colors"
                        title="Wygeneruj nowy secret">🔑</button>
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
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium">
              🔑 Nowy secret wygenerowany. Zaktualizuj na gateway i zrestartuj.
            </div>
            <div className="bg-zinc-950 rounded-xl p-4 font-mono text-xs text-zinc-200 space-y-1">
              <p><span className="text-zinc-500">GATEWAY_ID=</span>{secretResult.gateway.id}</p>
              <p><span className="text-zinc-500">GATEWAY_SECRET=</span><span className="text-amber-400">{secretResult.secret}</span></p>
            </div>
            <p className="text-xs text-zinc-500">Na Pi: edytuj <code className="bg-zinc-100 px-1 rounded">/opt/reserti-gateway/.env</code> i uruchom <code className="bg-zinc-100 px-1 rounded">systemctl restart reserti-gateway</code></p>
            <p className="text-xs text-red-500">⚠ Stary secret przestał działać natychmiast.</p>
            <div className="flex justify-end"><Btn onClick={() => { setModal(null); setSecretResult(null); }}>Zamknij</Btn></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
// ── BeaconSection ─────────────────────────────────────────────
function BeaconSection({ locations, activeLocId }: { locations: any[]; activeLocId: string }) {
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

  useEffect(() => { load(); }, []);
  useEffect(() => { loadDesks(form.locId); }, [form.locId]);

  const provision = async () => {
    setBusy(true);
    try {
      const r = await appApi.devices.provision({ hardwareId: form.hardwareId, deskId: form.deskId || undefined, gatewayId: form.gatewayId });
      setResult(r);
      await load();
    } catch(e:any) { alert(e.message); }
    setBusy(false);
  };

  const sendCmd = (deviceId: string, cmd: string) => appApi.devices.command(deviceId, cmd);

  const handleDelete = async (id: string, hwId: string) => {
    if (!confirm(`Usunąć beacon "${hwId}"?`)) return;
    try { await appApi.devices.remove(id); await load(); }
    catch(e:any) { alert(e.message); }
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
    } catch (e: any) { alert(e.message); }
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
          <h2 className="font-semibold text-zinc-700">Beacony (urządzenia)</h2>
          <select value={filterLoc} onChange={e => setFilterLoc(e.target.value)}
            className="text-xs border border-zinc-200 rounded-lg px-2 py-1 text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#B53578]/30">
            <option value="all">Wszystkie biura</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <Btn onClick={() => { setModal(true); setResult(null); setForm({ hardwareId:'', deskId:'', gatewayId:'', locId: activeLocId }); }}>
          + Provisioning
        </Btn>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-100">
            <tr>{['Hardware ID','ID urządzenia','MQTT user','Biuro','Biurko','Status','Fw','Akcje'].map(h =>
              <th key={h} className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{h}</th>
            )}</tr>
          </thead>
          <tbody>
            {filteredDevices.map(d => (
              <tr key={d.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 group">
                <td className="py-3 px-4 font-mono text-xs text-zinc-700">{d.hardwareId}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1">
                    <code className="text-[10px] font-mono text-zinc-500 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded select-all">{d.id}</code>
                    <button onClick={() => navigator.clipboard.writeText(d.id)} className="text-zinc-400 hover:text-[#B53578] transition-colors" title="Kopiuj ID">⎘</button>
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
                      className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors" title="Zidentyfikuj">💡</button>
                    <button onClick={() => sendCmd(d.id, 'REBOOT')}
                      className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-amber-100 text-zinc-600 hover:text-amber-600 transition-colors" title="Restart">↺</button>
                    <button onClick={() => openAssignModal(d)}
                      className="text-xs px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-600 transition-colors font-medium" title="Przypisz do biurka">
                      Przypisz
                    </button>
                    {d.desk && (
                      <button onClick={async () => {
                        if (!confirm(`Odparować beacon "${d.hardwareId}" od biurka "${d.desk.name}"?`)) return;
                        try { await appApi.desks.unpair(d.desk.id); await load(); }
                        catch(e:any) { alert(e.message); }
                      }}
                        className="text-xs px-2 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-600 hover:text-orange-700 transition-colors font-medium">
                        Odparuj
                      </button>
                    )}
                    <button onClick={() => handleDelete(d.id, d.hardwareId)}
                      className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-red-100 text-zinc-600 hover:text-red-600 transition-colors" title="Usuń">🗑</button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredDevices.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-zinc-400 text-sm">Brak urządzeń</td></tr>
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
                <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Biurko</label>
                <select value={assignDeskId} onChange={e => setAssignDeskId(e.target.value)}
                  className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30">
                  <option value="">— brak przypisania —</option>
                  {desks.filter(d => !d.device || d.device.id === assignTarget.id).map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setAssignTarget(null)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm font-medium transition-colors">
                  Anuluj
                </button>
                <button onClick={handleAssign} disabled={assignBusy}
                  className="flex-1 py-2.5 rounded-xl bg-[#B53578] hover:bg-[#9d2d66] text-white font-semibold text-sm transition-colors disabled:opacity-50">
                  {assignBusy ? 'Zapisuję…' : 'Zapisz'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal open={modal} title="Provisioning beacona" onClose={() => setModal(false)}>
        {!result ? (
          <div className="flex flex-col gap-3">
            <FormField label="Biuro">
              <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
                value={form.locId} onChange={e => { setForm(f => ({ ...f, locId: e.target.value, gatewayId: '', deskId: '' })); }}>
                <option value="">— wybierz biuro —</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </FormField>
            <FormField label="Hardware ID (unikalny ID ESP32)">
              <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
                placeholder="d-aabbccdd" value={form.hardwareId}
                onChange={e => setForm(f => ({ ...f, hardwareId: e.target.value }))} />
            </FormField>
            <FormField label="Gateway">
              <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
                value={form.gatewayId} onChange={e => setForm(f => ({ ...f, gatewayId: e.target.value }))}>
                <option value="">— wybierz gateway —</option>
                {availableGateways.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </FormField>
            <FormField label="Przypisz do biurka (opcjonalnie)">
              <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
                value={form.deskId} onChange={e => setForm(f => ({ ...f, deskId: e.target.value }))}>
                <option value="">— brak przypisania —</option>
                {desks.filter(d => !d.device).map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
              </select>
            </FormField>
            <div className="flex justify-end gap-2 mt-1">
              <Btn variant="secondary" onClick={() => setModal(false)}>Anuluj</Btn>
              <Btn onClick={provision} loading={busy} disabled={!form.hardwareId || !form.gatewayId}>Provisioning</Btn>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
              ✓ Beacon zarejestrowany — MQTT user dodany do gateway automatycznie
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
                  title="Kopiuj komendę">⎘</button>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">
                Podmień <span className="font-mono bg-zinc-100 px-0.5 rounded">NAZWA_WIFI</span>,{' '}
                <span className="font-mono bg-zinc-100 px-0.5 rounded">HASLO_WIFI</span> i{' '}
                <span className="font-mono bg-zinc-100 px-0.5 rounded">IP_RASPBERRY</span> na rzeczywiste wartości
              </p>
            </div>

            {/* Dane techniczne */}
            <div className="bg-zinc-50 rounded-xl p-3 font-mono text-xs space-y-0.5">
              <p><span className="text-zinc-400">DEVICE_ID  </span><span className="text-zinc-700">{result.device?.hardwareId}</span></p>
              <p><span className="text-zinc-400">MQTT_USER  </span><span className="text-zinc-700">{result.mqttUsername}</span></p>
              <p><span className="text-zinc-400">MQTT_PASS  </span><span className="text-amber-600">{result.mqttPassword}</span></p>
            </div>
            <p className="text-xs text-red-500">⚠ Hasło MQTT nie będzie wyświetlone ponownie</p>
            <div className="flex justify-end"><Btn onClick={() => setModal(false)}>Zamknij</Btn></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export function ProvisioningPage() {
  const { locations, activeLocId, setLoc } = useLocations();

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Provisioning</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Rejestracja i zarządzanie gateway'ami i beaconami</p>
        </div>
        {/* Biuro switcher */}
        {locations.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Aktywne biuro:</span>
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
