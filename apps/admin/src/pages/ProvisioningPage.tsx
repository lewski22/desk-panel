import React, { useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import { Btn, Modal, FormField, Input } from '../components/ui';

// ── Location selector hook ─────────────────────────────────────
function useLocations() {
  const [locations, setLocations] = useState<any[]>([]);
  const [activeLocId, setActiveLocId] = useState<string>(() =>
    localStorage.getItem('provisioning_loc') ?? import.meta.env.VITE_LOCATION_ID ?? ''
  );
  useEffect(() => {
    adminApi.locations.listAll().then(locs => {
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
  const [gateways, setGateways] = useState<any[]>([]);
  const [modal,    setModal]    = useState<'register'|'secret'|null>(null);
  const [name,     setName]     = useState('');
  const [locId,    setLocId]    = useState(activeLocId);
  const [result,   setResult]   = useState<any>(null);
  const [secretResult, setSecretResult] = useState<any>(null);
  const [busy,     setBusy]     = useState(false);

  // Update locId when activeLocId changes
  useEffect(() => { setLocId(activeLocId); }, [activeLocId]);

  const load = () => adminApi.gateways.list().then(setGateways).catch(() => {});
  useEffect(() => { load(); }, []);

  const register = async () => {
    setBusy(true);
    try {
      const r = await adminApi.gateways.register(locId, name);
      setResult(r);
      await load();
    } catch(e:any) { alert(e.message); }
    setBusy(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Usunąć gateway "${name}"?`)) return;
    try { await adminApi.gateways.remove(id); await load(); }
    catch(e:any) { alert(e.message); }
  };

  const handleRegenSecret = async (id: string) => {
    if (!confirm('Wygenerować nowy secret? Stary przestanie działać.')) return;
    setBusy(true);
    try {
      const r = await adminApi.gateways.regenerateSecret(id);
      setSecretResult(r);
      setModal('secret');
    } catch(e:any) { alert(e.message); }
    setBusy(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-zinc-700">Gateway'e</h2>
        <Btn onClick={() => { setModal('register'); setResult(null); setName(''); setLocId(activeLocId); }}>
          + Nowy gateway
        </Btn>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-100">
            <tr>{['Nazwa','ID','Biuro','IP','Urządzenia','Status','Ostatni kontakt',''].map(h =>
              <th key={h} className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{h}</th>
            )}</tr>
          </thead>
          <tbody>
            {gateways.map(gw => (
              <tr key={gw.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 group">
                <td className="py-3 px-4 font-medium text-zinc-800">{gw.name}</td>
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
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${gw.isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                    {gw.isOnline ? 'Online' : 'Offline'}
                  </span>
                </td>
                <td className="py-3 px-4 text-xs text-zinc-400">
                  {gw.lastSeen ? new Date(gw.lastSeen).toLocaleString('pl-PL', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' }) : '—'}
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
            ))}
            {gateways.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-zinc-400 text-sm">Brak gateway'ów</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Register modal */}
      <Modal open={modal === 'register'} title="Rejestracja gateway" onClose={() => setModal(null)}>
        {!result ? (
          <div className="flex flex-col gap-3">
            <FormField label="Biuro">
              <select value={locId} onChange={e => setLocId(e.target.value)}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30">
                <option value="">— wybierz biuro —</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </FormField>
            <FormField label="Nazwa gateway">
              <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
                value={name} onChange={e => setName(e.target.value)} placeholder="Warszawa GW-1" />
            </FormField>
            <div className="flex justify-end gap-2 mt-1">
              <Btn variant="secondary" onClick={() => setModal(null)}>Anuluj</Btn>
              <Btn onClick={register} loading={busy} disabled={!name || !locId}>Zarejestruj</Btn>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
              ✓ Gateway zarejestrowany pomyślnie
            </div>
            <p className="text-xs text-zinc-500 mb-2 font-medium">Skopiuj do pliku <code className="bg-zinc-100 px-1 rounded">.env</code> na Raspberry Pi:</p>
            <div className="bg-zinc-950 rounded-xl p-4 font-mono text-xs text-zinc-200 space-y-1 select-all">
              <p><span className="text-zinc-500">GATEWAY_ID=</span>{result.gateway.id}</p>
              <p><span className="text-zinc-500">GATEWAY_SECRET=</span><span className="text-amber-400">{result.secret}</span></p>
              <p><span className="text-zinc-500">LOCATION_ID=</span>{locId}</p>
              <p><span className="text-zinc-500">SERVER_URL=</span>{import.meta.env.VITE_API_URL ?? 'https://api.prohalw2026.ovh/api/v1'}</p>
              <p><span className="text-zinc-500">MQTT_PASSWORD=</span><span className="text-amber-400">{`# ustaw własne hasło`}</span></p>
            </div>
            <p className="text-xs text-red-500 mt-2">⚠ Zapisz secret — nie będzie wyświetlony ponownie</p>
            <div className="flex justify-end mt-4"><Btn onClick={() => setModal(null)}>Zamknij</Btn></div>
          </div>
        )}
      </Modal>

      {/* Regenerate secret modal */}
      <Modal open={modal === 'secret'} title="Nowy secret gateway" onClose={() => { setModal(null); setSecretResult(null); }}>
        {secretResult && (
          <div>
            <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium">
              🔑 Nowy secret wygenerowany. Zaktualizuj .env na gateway.
            </div>
            <div className="bg-zinc-950 rounded-xl p-4 font-mono text-xs text-zinc-200 space-y-1">
              <p><span className="text-zinc-500">GATEWAY_ID=</span>{secretResult.gateway.id}</p>
              <p><span className="text-zinc-500">GATEWAY_SECRET=</span><span className="text-amber-400">{secretResult.secret}</span></p>
              <p className="text-zinc-500 text-[10px] mt-1">Podgląd: {secretResult.secretPreview}</p>
            </div>
            <p className="text-xs text-red-500 mt-2">⚠ Stary secret przestał działać. Zrestartuj gateway.</p>
            <Btn className="mt-4 w-full" onClick={() => { setModal(null); setSecretResult(null); }}>Zamknij</Btn>
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
  const [filterLoc, setFilterLoc] = useState('all');

  useEffect(() => { setForm(f => ({ ...f, locId: activeLocId })); }, [activeLocId]);

  const load = async () => {
    const [dev, gw] = await Promise.all([
      adminApi.devices.list().catch(() => [] as any[]),
      adminApi.gateways.list().catch(() => [] as any[]),
    ]);
    setDevices(dev);
    setGateways(gw);
  };

  const loadDesks = async (locId: string) => {
    if (!locId) return;
    const d = await adminApi.desks.list(locId).catch(() => [] as any[]);
    setDesks(d);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadDesks(form.locId); }, [form.locId]);

  const provision = async () => {
    setBusy(true);
    try {
      const r = await adminApi.devices.provision({ hardwareId: form.hardwareId, deskId: form.deskId || undefined, gatewayId: form.gatewayId });
      setResult(r);
      await load();
    } catch(e:any) { alert(e.message); }
    setBusy(false);
  };

  const sendCmd = (deviceId: string, cmd: string) => adminApi.devices.command(deviceId, cmd);

  const handleDelete = async (id: string, hwId: string) => {
    if (!confirm(`Usunąć beacon "${hwId}"?`)) return;
    try { await adminApi.devices.remove(id); await load(); }
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
                    {d.desk && (
                      <button onClick={async () => {
                        if (!confirm(`Odparować beacon "${d.hardwareId}" od biurka "${d.desk.name}"?`)) return;
                        try { await adminApi.desks.unpair(d.desk.id); await load(); }
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
          <div>
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
              ✓ Beacon provisioned pomyślnie
            </div>
            <div className="bg-zinc-950 rounded-xl p-4 font-mono text-xs text-zinc-200 space-y-1">
              <p><span className="text-zinc-500">DEVICE_ID=</span>{result.device?.id}</p>
              <p><span className="text-zinc-500">MQTT_USER=</span>{result.mqttUsername}</p>
              <p><span className="text-zinc-500">MQTT_PASS=</span><span className="text-amber-400">{result.mqttPassword}</span></p>
            </div>
            <p className="text-xs text-red-500 mt-2">⚠ Hasło MQTT nie będzie wyświetlone ponownie</p>
            <div className="flex justify-end mt-4"><Btn onClick={() => setModal(false)}>Zamknij</Btn></div>
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
