import React, { useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import { Btn, Modal, FormField, Input } from '../components/ui';

const LOC_ID = import.meta.env.VITE_LOCATION_ID ?? '';

function GatewaySection() {
  const [gateways, setGateways] = useState<any[]>([]);
  const [modal,    setModal]    = useState<'register'|'detail'|'secret'|null>(null);
  const [target,   setTarget]   = useState<any>(null);
  const [name,     setName]     = useState('');
  const [result,   setResult]   = useState<any>(null);
  const [secretResult, setSecretResult] = useState<any>(null);
  const [busy,     setBusy]     = useState(false);

  const load = () => adminApi.gateways.list(LOC_ID).then(setGateways).catch(() => {});
  useEffect(() => { load(); }, []);

  const register = async () => {
    setBusy(true);
    try {
      const r = await adminApi.gateways.register(LOC_ID, name);
      setResult(r);
      await load();
    } catch(e:any) { alert(e.message); }
    setBusy(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Usunąć gateway "${name}"? Przypisane beacony zostaną odpięte.`)) return;
    try { await adminApi.gateways.remove(id); await load(); }
    catch(e:any) { alert(e.message); }
  };

  const handleRegenSecret = async (id: string) => {
    if (!confirm('Wygenerować nowy secret? Stary przestanie działać natychmiast.')) return;
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
        <Btn onClick={() => { setModal('register'); setResult(null); setName(''); }}>+ Nowy gateway</Btn>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-100">
            <tr>{['Nazwa','ID','IP','Urządzenia','Status','Ostatni kontakt',''].map(h =>
              <th key={h} className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{h}</th>
            )}</tr>
          </thead>
          <tbody>
            {gateways.map(gw => (
              <tr key={gw.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 group">
                <td className="py-3 px-4 font-medium text-zinc-800">{gw.name}</td>
                <td className="py-3 px-4 font-mono text-xs text-zinc-400">{gw.id.slice(0,12)}…</td>
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
                      title="Wygeneruj nowy secret">
                      🔑
                    </button>
                    <button onClick={() => handleDelete(gw.id, gw.name)}
                      className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-red-100 text-zinc-600 hover:text-red-600 transition-colors"
                      title="Usuń gateway">
                      Usuń
                    </button>
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
            <FormField label="Nazwa gateway">
              <input
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Warszawa GW-1"
              />
            </FormField>
            <div className="flex justify-end gap-2 mt-1">
              <Btn variant="secondary" onClick={() => setModal(null)}>Anuluj</Btn>
              <Btn onClick={register} loading={busy} disabled={!name}>Zarejestruj</Btn>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
              ✓ Gateway zarejestrowany pomyślnie
            </div>
            <div className="bg-zinc-950 rounded-xl p-4 font-mono text-xs text-zinc-200 space-y-1">
              <p><span className="text-zinc-500">GATEWAY_ID=</span>{result.gateway.id}</p>
              <p>
                <span className="text-zinc-500">GATEWAY_SECRET=</span>
                <span className="text-amber-400">{result.secret}</span>
                <span className="text-zinc-600 ml-2">(podgląd: {result.secret?.slice(0,8)}…)</span>
              </p>
            </div>
            <p className="text-xs text-red-500 mt-2">⚠ Zapisz secret — nie będzie wyświetlony ponownie</p>
            <div className="flex justify-end mt-4">
              <Btn onClick={() => setModal(null)}>Zamknij</Btn>
            </div>
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
              <p>
                <span className="text-zinc-500">GATEWAY_SECRET=</span>
                <span className="text-amber-400">{secretResult.secret}</span>
              </p>
              <p className="text-zinc-500 text-[10px] mt-1">Podgląd (pierwsze 8 znaków): {secretResult.secretPreview}</p>
            </div>
            <p className="text-xs text-red-500 mt-2">⚠ Stary secret przestał działać. Zapisz nowy i zrestartuj gateway.</p>
            <Btn className="mt-4 w-full" onClick={() => { setModal(null); setSecretResult(null); }}>Zamknij</Btn>
          </div>
        )}
      </Modal>
    </div>
  );
}

function BeaconSection() {
  const [desks,    setDesks]    = useState<any[]>([]);
  const [devices,  setDevices]  = useState<any[]>([]);
  const [gateways, setGateways] = useState<any[]>([]);
  const [modal,    setModal]    = useState(false);
  const [result,   setResult]   = useState<any>(null);
  const [form,     setForm]     = useState({ hardwareId: '', deskId: '', gatewayId: '' });
  const [busy,     setBusy]     = useState(false);

  const load = async () => {
    const [d, dev, gw] = await Promise.all([
      adminApi.desks.list(LOC_ID).catch(() => [] as any[]),
      adminApi.devices.list().catch(() => [] as any[]),
      adminApi.gateways.list(LOC_ID).catch(() => [] as any[]),
    ]);
    setDesks(d); setDevices(dev); setGateways(gw);
  };
  useEffect(() => { load(); }, []);

  const provision = async () => {
    setBusy(true);
    try {
      const r = await adminApi.devices.provision(form);
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

  const handleRepair = async (deviceId: string, deskId: string) => {
    const desk = desks.find(d => !d.device);
    if (!desk) { alert('Brak wolnych biurek bez beacona.'); return; }
    // Odepnij od obecnego biurka, przypisz do nowego
    try {
      await adminApi.devices.assign(deviceId, desk.id);
      await load();
    } catch(e:any) { alert(e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-zinc-700">Beacony (urządzenia)</h2>
        <Btn onClick={() => { setModal(true); setResult(null); setForm({ hardwareId:'', deskId:'', gatewayId:'' }); }}>
          + Provisioning
        </Btn>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-100">
            <tr>{['Hardware ID','MQTT user','Biurko','Status','RSSI','Fw','Akcje'].map(h =>
              <th key={h} className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{h}</th>
            )}</tr>
          </thead>
          <tbody>
            {devices.map(d => (
              <tr key={d.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 group">
                <td className="py-3 px-4 font-mono text-xs text-zinc-700">{d.hardwareId}</td>
                <td className="py-3 px-4 font-mono text-xs text-zinc-400">{d.mqttUsername}</td>
                <td className="py-3 px-4 text-zinc-700">
                  {d.desk ? `${d.desk.name} (${d.desk.code})` : <span className="text-zinc-300">Nieprzypisany</span>}
                </td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-400'}`}>
                    {d.isOnline ? 'Online' : 'Offline'}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-xs text-zinc-500">{d.rssi ? `${d.rssi} dBm` : '—'}</td>
                <td className="py-3 px-4 font-mono text-xs text-zinc-400">{d.firmwareVersion ?? '—'}</td>
                <td className="py-3 px-4">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => sendCmd(d.id, 'IDENTIFY')}
                      className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors" title="Zidentyfikuj">
                      💡
                    </button>
                    <button onClick={() => sendCmd(d.id, 'REBOOT')}
                      className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-amber-100 text-zinc-600 hover:text-amber-600 transition-colors" title="Restart">
                      ↺
                    </button>
                    {d.desk && (
                      <button onClick={() => adminApi.desks.unpair(d.desk.id).then(() => load())}
                        className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-orange-100 text-zinc-600 hover:text-orange-600 transition-colors" title="Odparuj">
                        ⇄
                      </button>
                    )}
                    <button onClick={() => handleDelete(d.id, d.hardwareId)}
                      className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-red-100 text-zinc-600 hover:text-red-600 transition-colors" title="Usuń">
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-zinc-400 text-sm">Brak urządzeń</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modal} title="Provisioning beacona" onClose={() => setModal(false)}>
        {!result ? (
          <div className="flex flex-col gap-3">
            <FormField label="Hardware ID (unikalny ID ESP32)">
              <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
                placeholder="d-aabbccdd" value={form.hardwareId}
                onChange={e => setForm(f => ({ ...f, hardwareId: e.target.value }))} />
            </FormField>
            <FormField label="Przypisz do biurka (opcjonalnie)">
              <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
                value={form.deskId} onChange={e => setForm(f => ({ ...f, deskId: e.target.value }))}>
                <option value="">— Brak przypisania —</option>
                {desks.filter(d => !d.device).map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </FormField>
            <FormField label="Gateway">
              <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
                value={form.gatewayId} onChange={e => setForm(f => ({ ...f, gatewayId: e.target.value }))}>
                <option value="">— Wybierz gateway —</option>
                {gateways.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
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
            <div className="mt-3 p-3 rounded-lg bg-zinc-50 border border-zinc-200">
              <p className="text-xs text-zinc-500 mb-1 font-medium">Komenda flash (serial):</p>
              <code className="text-xs text-zinc-600 break-all">
                python3 scripts/flash-config.py --device-id {result.device?.id} --mqtt-user {result.mqttUsername} --mqtt-pass {result.mqttPassword}
              </code>
            </div>
            <div className="flex justify-end mt-4">
              <Btn onClick={() => setModal(false)}>Zamknij</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function ProvisioningPage() {
  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-xl font-semibold text-zinc-800">Provisioning</h1>
        <p className="text-xs text-zinc-400 mt-0.5">Rejestracja i zarządzanie gateway'ami i beaconami</p>
      </div>
      <GatewaySection />
      <BeaconSection />
    </div>
  );
}
