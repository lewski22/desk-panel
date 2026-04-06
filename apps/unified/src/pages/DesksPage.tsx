import React, { useEffect, useState } from 'react';
import { appApi } from '../api/client';
import {
  PageHeader, Btn, Table, TR, TD, Badge, Modal, Input, Spinner,
} from '../components/ui';

const STAFF_URL = window.location.origin;  // QR links resolve within unified app

const STATUS_COLOR: Record<string, 'green'|'amber'|'red'|'zinc'> = {
  ACTIVE: 'green', INACTIVE: 'zinc', MAINTENANCE: 'amber',
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Aktywne', INACTIVE: 'Dezaktywowane', MAINTENANCE: 'Serwis',
};

function QrModal({ desk, onClose }: { desk: any; onClose: () => void }) {
  const qrUrl = `${STAFF_URL}/checkin/${desk.qrToken}`;
  const imgSrc = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrUrl)}&size=240x240&margin=12&format=png`;
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(qrUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>QR — ${desk.name}</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 40px; }
        h2 { font-size: 22px; margin-bottom: 4px; }
        p  { color: #666; font-size: 13px; margin-bottom: 20px; }
        img { display: block; margin: 0 auto 16px; }
        code { font-size: 11px; color: #888; word-break: break-all; }
      </style></head><body>
        <h2>${desk.name}</h2>
        <p>${desk.code}${desk.floor ? ` · Piętro ${desk.floor}` : ''}${desk.zone ? ` · ${desk.zone}` : ''}</p>
        <img src="${imgSrc}" width="200" height="200" />
        <code>${qrUrl}</code>
      </body></html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 500);
  };

  return (
    <Modal title={`Kod QR — ${desk.name}`} onClose={onClose}>
      <div className="flex flex-col items-center gap-4">
        <div className="p-3 bg-white rounded-xl border border-zinc-100 shadow-sm">
          <img src={imgSrc} width={200} height={200} alt="QR kod" className="rounded" />
        </div>

        <div className="w-full">
          <p className="text-xs text-zinc-400 mb-1 font-medium">URL check-in</p>
          <div className="flex gap-2">
            <code className="flex-1 text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-600 break-all">
              {qrUrl}
            </code>
          </div>
        </div>

        <div className="flex gap-2 w-full">
          <Btn variant="secondary" className="flex-1" onClick={copy}>
            {copied ? '✓ Skopiowano' : 'Kopiuj URL'}
          </Btn>
          <Btn className="flex-1" onClick={print}>
            Drukuj QR
          </Btn>
        </div>

        <p className="text-xs text-zinc-400 text-center">
          Wydrukuj i umieść na biurku — użytkownicy skanują telefonem aby zrobić check-in
        </p>
      </div>
    </Modal>
  );
}

export function DesksPage() {
  const [locations, setLocations] = useState<any[]>([]);
  const [locId,     setLocId]     = useState(() =>
    localStorage.getItem('desks_loc') ?? import.meta.env.VITE_LOCATION_ID ?? ''
  );
  const [desks,    setDesks]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState<'create'|'edit'|'qr'|null>(null);
  const [target,   setTarget]   = useState<any>(null);
  const [form,     setForm]     = useState({ name:'', code:'', floor:'', zone:'', locId: locId });
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState('');

  useEffect(() => {
    appApi.locations.listAll().then(locs => {
      setLocations(locs);
      if (!locId && locs.length > 0) {
        setLocId(locs[0].id);
        localStorage.setItem('desks_loc', locs[0].id);
      }
    }).catch(() => {});
  }, []);

  const load = async () => {
    if (!locId) return;
    setLoading(true);
    try { setDesks(await appApi.desks.list(locId)); }
    catch (e: any) { setErr(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [locId]);

  const switchLoc = (id: string) => {
    setLocId(id);
    localStorage.setItem('desks_loc', id);
  };

  const openEdit = (desk: any) => {
    setTarget(desk);
    setForm({ name: desk.name, code: desk.code, floor: desk.floor ?? '', zone: desk.zone ?? '', locId });
    setModal('edit');
  };

  const openQr = (desk: any) => {
    setTarget(desk);
    setModal('qr');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await appApi.desks.create(form.locId || locId, form);
      setModal(null); setForm({ name:'', code:'', floor:'', zone:'', locId });
      await load();
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await appApi.desks.update(target.id, form);
      setModal(null); await load();
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const handleStatus = async (id: string, status: string) => {
    try { await appApi.desks.update(id, { status }); await load(); }
    catch (e: any) { alert(e.message); }
  };

  const handleActivate = async (id: string) => {
    try { await appApi.desks.activate(id); await load(); }
    catch (e: any) { alert(e.message); }
  };

  const handleUnpair = async (desk: any) => {
    if (!confirm(`Odparować beacon "${desk.device?.hardwareId ?? ''}" od biurka "${desk.name}"?`)) return;
    try {
      const result = await appApi.desks.unpair(desk.id);
      if (result?.unlinked === false) {
        alert('Brak beacona przypisanego do tego biurka');
      }
      await load();
    } catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Dezaktywować biurko "${name}"?`)) return;
    try { await appApi.desks.remove(id); await load(); }
    catch (e: any) { alert(e.message); }
  };

  if (loading && !desks.length) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Biurka"
        sub={`${desks.filter(d => d.status === 'ACTIVE').length} aktywnych z ${desks.length}`}
        action={<Btn onClick={() => { setModal('create'); setForm({ name:'', code:'', floor:'', zone:'', locId }); setErr(''); }}>+ Nowe biurko</Btn>}
      />

      {/* Biuro switcher */}
      {locations.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-zinc-400">Biuro:</span>
          {locations.map(l => (
            <button key={l.id} onClick={() => switchLoc(l.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                locId === l.id
                  ? 'bg-[#B53578] text-white'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
              }`}>
              {l.name}
            </button>
          ))}
        </div>
      )}

      <Table headers={['Biuro','Kod','Nazwa','ID biurka','Piętro','Strefa','Beacon','Status','']} empty={!desks.length}>
        {desks.map(d => (
          <TR key={d.id}>
            <TD>
              <span className="text-xs text-zinc-500">{d.location?.name ?? '—'}</span>
            </TD>
            <TD mono>{d.code}</TD>
            <TD>{d.name}</TD>
            <TD>
              <div className="flex items-center gap-1">
                <code className="text-[10px] font-mono text-zinc-400 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded select-all">{d.id}</code>
                <button onClick={() => navigator.clipboard.writeText(d.id)} className="text-zinc-300 hover:text-[#B53578] transition-colors text-xs" title="Kopiuj ID">⎘</button>
              </div>
            </TD>
            <TD>{d.floor ?? '—'}</TD>
            <TD>{d.zone ?? '—'}</TD>
            <TD>
              {d.device ? (
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.device.isOnline ? 'bg-emerald-400' : 'bg-zinc-300'}`} />
                  <span className="text-xs text-zinc-500">{d.device.isOnline ? 'Online' : 'Offline'}</span>
                  <span className="text-xs text-zinc-300 font-mono">{d.device.hardwareId}</span>
                  <button
                    onClick={() => handleUnpair(d)}
                    className="text-xs px-1.5 py-0.5 rounded bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 transition-colors font-medium"
                    title="Odparuj beacon od biurka"
                  >
                    Odparuj
                  </button>
                </div>
              ) : (
                <span className="text-xs text-zinc-300">Brak beacona</span>
              )}
            </TD>
            <TD><Badge color={STATUS_COLOR[d.status] ?? 'zinc'}>{STATUS_LABEL[d.status] ?? d.status}</Badge></TD>
            <TD>
              <div className="flex gap-1 flex-wrap">
                <Btn variant="ghost" size="sm" onClick={() => openEdit(d)}>Edytuj</Btn>
                <Btn variant="ghost" size="sm" onClick={() => openQr(d)} title="Generuj kod QR">QR</Btn>

                {d.status === 'ACTIVE' && (
                  <Btn variant="secondary" size="sm" onClick={() => handleStatus(d.id, 'MAINTENANCE')}>Serwis</Btn>
                )}
                {d.status === 'MAINTENANCE' && (
                  <Btn variant="secondary" size="sm" onClick={() => handleStatus(d.id, 'ACTIVE')}>Aktywuj</Btn>
                )}
                {d.status === 'INACTIVE' && (
                  <>
                    <Btn variant="secondary" size="sm" onClick={() => handleActivate(d.id)}>Reaktywuj</Btn>
                    <Btn variant="danger" size="sm" onClick={async () => {
                      if (!confirm(`Trwale usunąć biurko "${d.name}"? Tej operacji nie można cofnąć.`)) return;
                      try { await appApi.desks.hardDelete(d.id); await load(); }
                      catch (e: any) { alert(e.message); }
                    }}>Usuń trwale</Btn>
                  </>
                )}
                {d.status !== 'INACTIVE' && (
                  <Btn variant="danger" size="sm" onClick={() => handleDelete(d.id, d.name)}>Dezaktywuj</Btn>
                )}
              </div>
            </TD>
          </TR>
        ))}
      </Table>

      {/* Create / Edit modal */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal
          title={modal === 'create' ? 'Nowe biurko' : `Edytuj: ${target?.name}`}
          onClose={() => setModal(null)}
        >
          <form onSubmit={modal === 'create' ? handleCreate : handleEdit} className="flex flex-col gap-3">
            {/* Biuro selector — always shown on create */}
            {modal === 'create' && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-medium">Biuro</label>
                {locations.length > 1 ? (
                  <select
                    value={form.locId}
                    onChange={e => setForm(f => ({ ...f, locId: e.target.value }))}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
                    required
                  >
                    <option value="">— wybierz biuro —</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                ) : (
                  <div className="px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200 text-sm text-zinc-600">
                    {locations[0]?.name ?? '—'}
                  </div>
                )}
              </div>
            )}
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

      {/* QR modal */}
      {modal === 'qr' && target && (
        <QrModal desk={target} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
