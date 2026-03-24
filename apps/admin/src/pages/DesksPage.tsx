import React, { useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import {
  PageHeader, Btn, Card, Table, TR, TD, Badge, Modal, Input, Select, Spinner,
} from '../components/ui';

const LOC_ID = import.meta.env.VITE_LOCATION_ID ?? 'seed-location-01';

const STATUS_COLOR: Record<string, 'green'|'amber'|'red'|'zinc'> = {
  ACTIVE: 'green', INACTIVE: 'zinc', MAINTENANCE: 'amber',
};

export function DesksPage() {
  const [desks,     setDesks]    = useState<any[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [modal,     setModal]    = useState<'create'|'provision'|null>(null);
  const [selected,  setSelected] = useState<any>(null);
  const [provision, setProvision]= useState<any>(null); // result from /devices/provision

  // Create form state
  const [form, setForm] = useState({ name:'', code:'', floor:'', zone:'' });
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');

  const load = async () => {
    setLoading(true);
    try { setDesks(await adminApi.desks.list(LOC_ID)); }
    catch (e: any) { setErr(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await adminApi.desks.create(LOC_ID, form);
      setModal(null);
      setForm({ name:'', code:'', floor:'', zone:'' });
      await load();
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const handleStatusChange = async (id: string, status: string) => {
    try { await adminApi.desks.update(id, { status }); await load(); }
    catch (e: any) { alert(e); }
  };

  const handleProvision = async (deskId: string) => {
    setBusy(true);
    try {
      const result = await adminApi.devices.provision({
        hardwareId: `hw-${Date.now()}`,
        deskId,
        gatewayId: 'seed-gateway-01',
      });
      setProvision(result);
      setModal('provision');
    } catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  if (loading && !desks.length) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Biurka"
        sub={`${desks.length} biurek w tej lokalizacji`}
        action={<Btn onClick={() => setModal('create')}>+ Nowe biurko</Btn>}
      />

      <Table
        headers={['Kod', 'Nazwa', 'Piętro', 'Strefa', 'Beacon', 'Status', '']}
        empty={!desks.length}>
        {desks.map(d => (
          <TR key={d.id}>
            <TD mono>{d.code}</TD>
            <TD>{d.name}</TD>
            <TD>{d.floor ?? '—'}</TD>
            <TD>{d.zone ?? '—'}</TD>
            <TD>
              {d.device ? (
                <span className="flex items-center gap-1.5 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full ${d.device.isOnline ? 'bg-emerald-400' : 'bg-zinc-300'}`} />
                  {d.device.isOnline ? 'Online' : 'Offline'}
                </span>
              ) : (
                <Btn variant="ghost" size="sm" loading={busy} onClick={() => handleProvision(d.id)}>
                  + Paruj beacon
                </Btn>
              )}
            </TD>
            <TD>
              <Badge color={STATUS_COLOR[d.status] ?? 'zinc'}>{d.status}</Badge>
            </TD>
            <TD>
              <div className="flex gap-1">
                {d.status === 'ACTIVE' && (
                  <Btn variant="secondary" size="sm"
                    onClick={() => handleStatusChange(d.id, 'MAINTENANCE')}>
                    Serwis
                  </Btn>
                )}
                {d.status === 'MAINTENANCE' && (
                  <Btn variant="secondary" size="sm"
                    onClick={() => handleStatusChange(d.id, 'ACTIVE')}>
                    Aktywuj
                  </Btn>
                )}
                {d.status !== 'INACTIVE' && (
                  <Btn variant="danger" size="sm"
                    onClick={() => handleStatusChange(d.id, 'INACTIVE')}>
                    Dezaktywuj
                  </Btn>
                )}
              </div>
            </TD>
          </TR>
        ))}
      </Table>

      {/* Create desk modal */}
      {modal === 'create' && (
        <Modal title="Nowe biurko" onClose={() => setModal(null)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <Input label="Nazwa" placeholder="Desk A-01" required
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Kod (unikalny w lokalizacji)" placeholder="A-01" required
              value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Piętro" placeholder="1"
                value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))} />
              <Input label="Strefa" placeholder="Open Space"
                value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))} />
            </div>
            {err && <p className="text-xs text-red-500">{err}</p>}
            <div className="flex gap-2 pt-1">
              <Btn type="submit" loading={busy} className="flex-1">Utwórz</Btn>
              <Btn variant="secondary" onClick={() => setModal(null)} type="button">Anuluj</Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Provisioning result modal */}
      {modal === 'provision' && provision && (
        <Modal title="Beacon sparowany" onClose={() => { setModal(null); setProvision(null); }}>
          <p className="text-sm text-zinc-600 mb-4">
            Beacon został zarejestrowany. Zapisz dane — hasło MQTT nie będzie wyświetlone ponownie.
          </p>
          <div className="bg-zinc-950 rounded-xl p-4 font-mono text-xs text-emerald-400 space-y-1">
            <p>DEVICE_ID  = {provision.device.hardwareId}</p>
            <p>MQTT_USER  = {provision.mqttUsername}</p>
            <p>MQTT_PASS  = <span className="text-yellow-400">{provision.mqttPassword}</span></p>
            <p>DESK_ID    = {provision.device.deskId}</p>
          </div>
          <p className="text-xs text-zinc-400 mt-3">
            Sflashuj te dane na ESP32 używając: <code className="font-mono">scripts/flash-config.py</code>
          </p>
          <Btn className="mt-4 w-full" variant="secondary"
            onClick={() => { setModal(null); setProvision(null); }}>
            Zamknij
          </Btn>
        </Modal>
      )}
    </div>
  );
}
