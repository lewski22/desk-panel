import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import {
  PageHeader, Btn, Table, TR, TD, Badge, Modal, Input, Spinner,
} from '../components/ui';

const STAFF_URL = window.location.origin;

const STATUS_COLOR: Record<string, 'green'|'amber'|'red'|'zinc'> = {
  ACTIVE: 'green', INACTIVE: 'zinc', MAINTENANCE: 'amber',
};

function QrModal({ desk, onClose }: { desk: any; onClose: () => void }) {
  const { t } = useTranslation();
  const qrUrl = `${STAFF_URL}/checkin/${desk.qrToken}`;
  const imgSrc = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrUrl)}&size=240x240&margin=12&format=png`;
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(qrUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>QR — ${desk.name}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:40px}h2{font-size:22px;margin-bottom:4px}p{color:#666;font-size:13px;margin-bottom:20px}img{display:block;margin:0 auto 16px}code{font-size:11px;color:#888;word-break:break-all}</style></head><body>
        <h2>${desk.name}</h2><p>${desk.code}</p><img src="${imgSrc}" width="200" height="200" /><code>${qrUrl}</code>
      </body></html>`);
    w.document.close(); w.focus();
    setTimeout(() => { w.print(); }, 500);
  };

  return (
    <Modal title={t('desks.qr.title', { name: desk.name })} onClose={onClose}>
      <div className="flex flex-col items-center gap-4">
        <div className="p-3 bg-white rounded-xl border border-zinc-100 shadow-sm">
          <img src={imgSrc} width={200} height={200} alt={t('desks.qr.alt')} className="rounded" />
        </div>
        <div className="w-full">
          <p className="text-xs text-zinc-400 mb-1 font-medium">{t('desks.qr.url_label')}</p>
          <code className="flex-1 text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-600 break-all block">{qrUrl}</code>
        </div>
        <div className="flex gap-2 w-full">
          <Btn variant="secondary" className="flex-1" onClick={copy}>{copied ? '✓' : t('btn.save')}</Btn>
          <Btn className="flex-1" onClick={print}>{t('desks.qr.generate_title')}</Btn>
        </div>
        <p className="text-xs text-zinc-400 text-center">{t('desks.qr.print_hint')}</p>
      </div>
    </Modal>
  );
}

export function DesksPage() {
  const { t } = useTranslation();
  const navigate    = useNavigate();
  const [locations, setLocations] = useState<any[]>([]);
  const [locId,     setLocId]     = useState(() =>
    localStorage.getItem('desks_loc') ?? import.meta.env.VITE_LOCATION_ID ?? ''
  );
  const [desks,   setDesks]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState<'create'|'edit'|'qr'|null>(null);
  const [target,  setTarget]  = useState<any>(null);
  const [form,    setForm]    = useState({ name:'', code:'', floor:'', zone:'', locId });
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState('');

  useEffect(() => {
    appApi.locations.listAll().then(locs => {
      setLocations(locs);
      if (!locId && locs.length > 0) { setLocId(locs[0].id); localStorage.setItem('desks_loc', locs[0].id); }
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

  const switchLoc = (id: string) => { setLocId(id); localStorage.setItem('desks_loc', id); };
  const openEdit  = (desk: any)  => { setTarget(desk); setForm({ name: desk.name, code: desk.code, floor: desk.floor ?? '', zone: desk.zone ?? '', locId }); setModal('edit'); };
  const openQr    = (desk: any)  => { setTarget(desk); setModal('qr'); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await appApi.desks.create(form.locId || locId, form); setModal(null); setForm({ name:'', code:'', floor:'', zone:'', locId }); await load(); }
    catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await appApi.desks.update(target.id, form); setModal(null); await load(); }
    catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const handleStatus = async (id: string, status: string) => {
    try { await appApi.desks.update(id, { status }); await load(); }
    catch (e: any) { setErr(e.message); }
  };

  const handleActivate = async (id: string) => {
    try { await appApi.desks.activate(id); await load(); }
    catch (e: any) { setErr(e.message); }
  };

  const handleUnpair = async (desk: any) => {
    if (!confirm(t('desks.confirm.unpair', { hw: desk.device?.hardwareId ?? '', name: desk.name }))) return;
    try { await appApi.desks.unpair(desk.id); await load(); }
    catch (e: any) { setErr(e.message); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t('desks.confirm.deactivate', { name }))) return;
    try { await appApi.desks.remove(id); await load(); }
    catch (e: any) { setErr(e.message); }
  };

  const STATUS_LABEL: Record<string, string> = {
    ACTIVE: t('desks.stats.free'), INACTIVE: t('desks.actions.deactivate'), MAINTENANCE: t('desks.actions.maintenance'),
  };

  if (loading && !desks.length) return <Spinner />;

  const activeCount = desks.filter(d => d.status === 'ACTIVE').length;

  return (
    <div>
      <PageHeader
        title={t('pages.desks.title')}
        sub={t('desks.sub_active', { active: activeCount, total: desks.length })}
        action={<Btn onClick={() => { setModal('create'); setForm({ name:'', code:'', floor:'', zone:'', locId }); setErr(''); }}>{t('pages.desks.new')}</Btn>}
      />

      {locations.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-zinc-400">{t('desks.location_label')}</span>
          {locations.map(l => (
            <button key={l.id} onClick={() => switchLoc(l.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${locId === l.id ? 'bg-[#B53578] text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}>
              {l.name}
            </button>
          ))}
        </div>
      )}

      {err && <div className="mb-3 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{err}</div>}

      <Table headers={[
        t('desks.col.location'), t('desks.col.code'), t('desks.col.name'),
        t('desks.col.desk_id'), t('desks.col.floor'), t('desks.col.zone'),
        t('desks.col.beacon'), t('desks.col.status'), t('desks.col.actions'),
      ]} empty={!desks.length}>
        {desks.map(d => (
          <TR key={d.id}>
            <TD><span className="text-xs text-zinc-500">{d.location?.name ?? '—'}</span></TD>
            <TD mono>{d.code}</TD>
            <TD>{d.name}</TD>
            <TD>
              <div className="flex items-center gap-1">
                <code className="text-[10px] font-mono text-zinc-400 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded select-all">{d.id}</code>
                <button onClick={() => navigator.clipboard.writeText(d.id)} className="text-zinc-300 hover:text-[#B53578] transition-colors text-xs" title="Copy">⎘</button>
              </div>
            </TD>
            <TD>{d.floor ?? '—'}</TD>
            <TD>{d.zone ?? '—'}</TD>
            <TD>
              {d.device ? (
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.device.isOnline ? 'bg-emerald-400' : 'bg-zinc-300'}`} />
                  <span className="text-xs text-zinc-500">{d.device.isOnline ? t('devices.status.online') : t('devices.status.offline')}</span>
                  <span className="text-xs text-zinc-300 font-mono">{d.device.hardwareId}</span>
                  <button onClick={() => handleUnpair(d)}
                    className="text-xs px-1.5 py-0.5 rounded bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 transition-colors font-medium"
                    title={t('desks.actions_extra.unpair_title')}>
                    {t('desks.actions_extra.unpair')}
                  </button>
                </div>
              ) : (
                <span className="text-xs text-zinc-300">{t('desks.no_beacon')}</span>
              )}
            </TD>
            <TD><Badge color={STATUS_COLOR[d.status] ?? 'zinc'}>{STATUS_LABEL[d.status] ?? d.status}</Badge></TD>
            <TD>
              <div className="flex gap-1 flex-wrap">
                <Btn variant="ghost" size="sm" onClick={() => openEdit(d)}>{t('users.actions.edit')}</Btn>
                <Btn variant="ghost" size="sm" onClick={() => openQr(d)}>QR</Btn>
                {d.status === 'ACTIVE' && (
                  <Btn variant="secondary" size="sm" onClick={() => handleStatus(d.id, 'MAINTENANCE')}>{t('desks.actions.maintenance')}</Btn>
                )}
                {d.status === 'MAINTENANCE' && (
                  <Btn variant="secondary" size="sm" onClick={() => handleStatus(d.id, 'ACTIVE')}>{t('desks.actions.activate')}</Btn>
                )}
                {d.status === 'INACTIVE' && (
                  <>
                    <Btn variant="secondary" size="sm" onClick={() => handleActivate(d.id)}>{t('desks.actions.reactivate')}</Btn>
                    <Btn variant="danger" size="sm" onClick={async () => {
                      if (!confirm(t('desks.confirm.delete_permanent', { name: d.name }))) return;
                      try { await appApi.desks.hardDelete(d.id); await load(); }
                      catch (e: any) { setErr((e as any).message); }
                    }}>{t('desks.actions.delete_permanent')}</Btn>
                  </>
                )}
                {d.status !== 'INACTIVE' && (
                  <Btn variant="danger" size="sm" onClick={() => handleDelete(d.id, d.name)}
                    title={t('desks.deactivate_hint')}>
                    {t('desks.actions_extra.deactivate')}
                  </Btn>
                )}
              </div>
            </TD>
          </TR>
        ))}
      </Table>

      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? t('desks.modals.create_title') : t('desks.modals.edit_title', { name: target?.name })} onClose={() => setModal(null)}>
          <form onSubmit={modal === 'create' ? handleCreate : handleEdit} className="flex flex-col gap-3">
            {modal === 'create' && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-medium">{t('desks.form.label.location')}</label>
                {locations.length > 1 ? (
                  <select value={form.locId} onChange={e => setForm(f => ({ ...f, locId: e.target.value }))}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30" required>
                    <option value="">{t('desks.form.select_placeholder')}</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                ) : (
                  <div className="px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200 text-sm text-zinc-600">{locations[0]?.name ?? '—'}</div>
                )}
              </div>
            )}
            <Input label={t('desks.form.label.name')} placeholder="Desk A-01" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input label={t('desks.form.label.code')} placeholder="A-01" required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('desks.form.label.floor')} placeholder="1" value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))} />
              <Input label={t('desks.form.label.zone')} placeholder="Open Space" value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))} />
            </div>
            {err && <p className="text-xs text-red-500">{err}</p>}
            <div className="flex gap-2 pt-1">
              <Btn type="submit" loading={busy} className="flex-1">{modal === 'create' ? t('btn.create') : t('btn.save')}</Btn>
              <Btn variant="secondary" onClick={() => setModal(null)} type="button">{t('btn.cancel')}</Btn>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'qr' && target && <QrModal desk={target} onClose={() => setModal(null)} />}
    </div>
  );
}
