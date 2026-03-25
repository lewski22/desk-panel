import React, { useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import {
  PageHeader, Btn, Table, TR, TD, Badge, Modal, Input, Select, Spinner,
} from '../components/ui';

const LOC_ID = import.meta.env.VITE_LOCATION_ID ?? 'seed-location-01';

const STATUS_COLOR: Record<string, 'green'|'amber'|'red'|'zinc'> = {
  ACTIVE: 'green', INACTIVE: 'zinc', MAINTENANCE: 'amber',
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Aktywne', INACTIVE: 'Dezaktywowane', MAINTENANCE: 'Serwis',
};

export function DesksPage() {
  const [desks,    setDesks]   = useState<any[]>([]);
  const [loading,  setLoading] = useState(true);
  const [modal,    setModal]   = useState<'create'|'edit'|'provision'|null>(null);
  const [target,   setTarget]  = useState<any>(null);
  const [provision,setProvision] = useState<any>(null);
  const [form,     setForm]    = useState({ name:'', code:'', floor:'', zone:'' });
  const [busy,     setBusy]    = useState(false);
  const [err,      setErr]     = useState('');

  const load = async () => {
    setLoading(true);
    try { setDesks(await adminApi.desks.list(LOC_ID)); }
    catch (e: any) { setErr(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openEdit = (desk: any) => {
    setTarget(desk);
    setForm({ name: desk.name, code: desk.code, floor: desk.floor ?? '', zone: desk.zone ?? '' });
    setModal('edit');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await adminApi.desks.create(LOC_ID, form);
      setModal(null); setForm({ name:'', code:'', floor:'', zone:'' });
      await load();
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await adminApi.desks.update(target.id, form);
      setModal(null); await load();
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const handleStatus = async (id: string, status: string) => {
    try { await adminApi.desks.update(id, { status }); await load(); }
    catch (e: any) { alert(e.message); }
  };

  const handleActivate = async (id: string) => {
    try { await adminApi.desks.activate(id); await load(); }
    catch (e: any) { alert(e.message); }
  };

  const handleUnpair = async (id: string) => {
    if (!confirm('Odparować beacon od tego biurka?')) return;
    try { await adminApi.desks.unpair(id); await load(); }
    catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Dezaktywować biurko "${name}"?`)) return;
    try { await adminApi.desks.remove(id); await load(); }
    catch (e: any) { alert(e.message); }
  };

  if (loading && !desks.length) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Biurka"
        sub={`${desks.filter(d => d.status === 'ACTIVE').length} aktywnych z ${desks.length}`}
        action={<Btn onClick={() => { setModal('create'); setForm({ name:'', code:'', floor:'', zone:'' }); setErr(''); }}>+ Nowe biurko</Btn>}
      />

      <Table headers={['Kod','Nazwa','Piętro','Strefa','Beacon','Status','']} empty={!desks.length}>
        {desks.map(d => (
          <TR key={d.id}>
            <TD mono>{d.code}</TD>
            <TD>{d.name}</TD>
            <TD>{d.floor ?? '—'}</TD>
            <TD>{d.zone ?? '—'}</TD>
            <TD>
              {d.device ? (
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.device.isOnline ? 'bg-emerald-400' : 'bg-zinc-300'}`} />
                  <span className="text-xs text-zinc-500">{d.device.isOnline ? 'Online' : 'Offline'}</span>
                  <button onClick={() => handleUnpair(d.id)}
                    className="ml-1 text-[10px] text-zinc-400 hover:text-red-500 transition-colors" title="Odparuj beacon">✕</button>
                </div>
              ) : (
                <span className="text-xs text-zinc-300">Brak beacona</span>
              )}
            </TD>
            <TD><Badge color={STATUS_COLOR[d.status] ?? 'zinc'}>{STATUS_LABEL[d.status] ?? d.status}</Badge></TD>
            <TD>
              <div className="flex gap-1">
                {/* Edycja zawsze dostępna */}
                <Btn variant="ghost" size="sm" onClick={() => openEdit(d)}>Edytuj</Btn>

                {d.status === 'ACTIVE' && (
                  <Btn variant="secondary" size="sm" onClick={() => handleStatus(d.id, 'MAINTENANCE')}>Serwis</Btn>
                )}
                {d.status === 'MAINTENANCE' && (
                  <Btn variant="secondary" size="sm" onClick={() => handleStatus(d.id, 'ACTIVE')}>Aktywuj</Btn>
                )}
                {/* Reaktywacja INACTIVE */}
                {d.status === 'INACTIVE' && (
                  <Btn variant="secondary" size="sm" onClick={() => handleActivate(d.id)}>Reaktywuj</Btn>
                )}
                {d.status !== 'INACTIVE' && (
                  <Btn variant="danger" size="sm" onClick={() => handleDelete(d.id, d.name)}>Dezaktywuj</Btn>
                )}
              </div>
            </TD>
          </TR>
        ))}
      </Table>

      {/* Create modal */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal
          title={modal === 'create' ? 'Nowe biurko' : `Edytuj: ${target?.name}`}
          onClose={() => setModal(null)}
        >
          <form onSubmit={modal === 'create' ? handleCreate : handleEdit} className="flex flex-col gap-3">
            <Input label="Nazwa" placeholder="Desk A-01" required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Kod (unikalny w lokalizacji)" placeholder="A-01" required value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Piętro" placeholder="1" value={form.floor}
                onChange={e => setForm(f => ({ ...f, floor: e.target.value }))} />
              <Input label="Strefa" placeholder="Open Space" value={form.zone}
                onChange={e => setForm(f => ({ ...f, zone: e.target.value }))} />
            </div>
            {err && <p className="text-xs text-red-500">{err}</p>}
            <div className="flex gap-2 pt-1">
              <Btn type="submit" loading={busy} className="flex-1">
                {modal === 'create' ? 'Utwórz' : 'Zapisz'}
              </Btn>
              <Btn variant="secondary" onClick={() => setModal(null)} type="button">Anuluj</Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Provision result modal */}
      {modal === 'provision' && provision && (
        <Modal title="Beacon sparowany" onClose={() => { setModal(null); setProvision(null); }}>
          <div className="bg-zinc-950 rounded-xl p-4 font-mono text-xs text-zinc-200 space-y-1">
            <p><span className="text-zinc-500">DEVICE_ID=</span>{provision.device?.id}</p>
            <p><span className="text-zinc-500">MQTT_USER=</span>{provision.mqttUsername}</p>
            <p><span className="text-zinc-500">MQTT_PASS=</span><span className="text-amber-400">{provision.mqttPassword}</span></p>
          </div>
          <p className="text-xs text-red-500 mt-2">⚠ Hasło MQTT nie będzie wyświetlone ponownie</p>
          <Btn className="mt-4 w-full" variant="secondary" onClick={() => { setModal(null); setProvision(null); }}>Zamknij</Btn>
        </Modal>
      )}
    </div>
  );
}
