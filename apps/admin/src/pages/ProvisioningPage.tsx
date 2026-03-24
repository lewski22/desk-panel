import React, { useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import { Btn, Card, Modal, FormField } from '../components/ui';

const LOC_ID = import.meta.env.VITE_DEFAULT_LOCATION_ID ?? '';

function GatewaySection() {
  const [gateways, setGateways] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [result, setResult] = useState<any>(null);

  const load = () => adminApi.gateways.list(LOC_ID).then(setGateways).catch(() => {});
  useEffect(() => { load(); }, []);

  const register = async () => {
    const r = await adminApi.gateways.register(LOC_ID, name);
    setResult(r);
    await load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-zinc-700">Gateway'e</h2>
        <Btn onClick={() => { setModal(true); setResult(null); setName(''); }}>+ Nowy gateway</Btn>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-100">
            <tr>{['Nazwa','IP','Urządzenia','Status','Ostatni kontakt'].map(h =>
              <th key={h} className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{h}</th>
            )}</tr>
          </thead>
          <tbody>
            {gateways.map(gw => (
              <tr key={gw.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                <td className="py-3 px-4 font-medium text-zinc-800">{gw.name}</td>
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
              </tr>
            ))}
            {gateways.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-zinc-400 text-sm">Brak gateway'ów</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modal} title="Rejestracja gateway" onClose={() => setModal(false)}>
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
              <Btn variant="secondary" onClick={() => setModal(false)}>Anuluj</Btn>
              <Btn onClick={register} disabled={!name}>Zarejestruj</Btn>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
              ✓ Gateway zarejestrowany pomyślnie
            </div>
            <div className="bg-zinc-950 rounded-xl p-4 font-mono text-xs text-zinc-200 space-y-1">
              <p><span className="text-zinc-500">GATEWAY_ID=</span>{result.gateway.id}</p>
              <p><span className="text-zinc-500">GATEWAY_SECRET=</span><span className="text-amber-400">{result.secret}</span></p>
            </div>
            <p className="text-xs text-red-500 mt-2">⚠ Zapisz secret — nie będzie wyświetlony ponownie</p>
            <div className="flex justify-end mt-4">
              <Btn onClick={() => setModal(false)}>Zamknij</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function BeaconSection() {
  const [desks, setDesks]     = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [modal, setModal]     = useState(false);
  const [gateways, setGateways] = useState<any[]>([]);
  const [result, setResult]   = useState<any>(null);
  const [form, setForm]       = useState({ hardwareId: '', deskId: '', gatewayId: '' });

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
    const r = await adminApi.devices.provision(form);
    setResult(r);
    await load();
  };

  const sendCmd = async (deviceId: string, cmd: string) => {
    await adminApi.devices.command(deviceId, cmd);
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
            <tr>{['Hardware ID','MQTT user','Biurko','Status','RSSI','Akcje'].map(h =>
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
                <td className="py-3 px-4">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => sendCmd(d.id, 'IDENTIFY')}
                      className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors" title="Zidentyfikuj LED">
                      💡
                    </button>
                    <button onClick={() => sendCmd(d.id, 'REBOOT')}
                      className="text-xs px-2 py-1 rounded-lg bg-zinc-100 hover:bg-red-100 text-zinc-600 hover:text-red-600 transition-colors" title="Restart">
                      ↺
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-zinc-400 text-sm">Brak urządzeń</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modal} title="Provisioning beacona" onClose={() => setModal(false)}>
        {!result ? (
          <div className="flex flex-col gap-3">
            <FormField label="Hardware ID (MAC / unikalny ID ESP32)">
              <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
                placeholder="d-aabbccdd" value={form.hardwareId}
                onChange={e => setForm(f => ({ ...f, hardwareId: e.target.value }))} />
            </FormField>
            <FormField label="Przypisz do biurka (opcjonalnie)">
              <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
                value={form.deskId} onChange={e => setForm(f => ({ ...f, deskId: e.target.value }))}>
                <option value="">— Brak przypisania —</option>
                {desks.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
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
              <Btn onClick={provision} disabled={!form.hardwareId || !form.gatewayId}>Provisioning</Btn>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
              ✓ Beacon provisioned pomyślnie
            </div>
            <div className="bg-zinc-950 rounded-xl p-4 font-mono text-xs text-zinc-200 space-y-1">
              <p><span className="text-zinc-500">DEVICE_ID=</span>{result.device.id}</p>
              <p><span className="text-zinc-500">MQTT_USER=</span>{result.mqttUsername}</p>
              <p><span className="text-zinc-500">MQTT_PASS=</span><span className="text-amber-400">{result.mqttPassword}</span></p>
            </div>
            <p className="text-xs text-red-500 mt-2">⚠ Hasło MQTT nie będzie wyświetlone ponownie</p>
            <div className="mt-3 p-3 rounded-lg bg-zinc-50 border border-zinc-200">
              <p className="text-xs text-zinc-500 mb-1 font-medium">Komenda flash (serial):</p>
              <code className="text-xs text-zinc-600 break-all">
                python3 scripts/flash-config.py --port /dev/ttyUSB0 --device-id {result.device.id} --mqtt-user {result.mqttUsername} --mqtt-pass {result.mqttPassword} --wifi-ssid SSID --wifi-pass PASS --mqtt-host GATEWAY_IP
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
        <p className="text-xs text-zinc-400 mt-0.5">Rejestracja gateway'ów i beaconów</p>
      </div>
      <GatewaySection />
      <BeaconSection />
    </div>
  );
}
