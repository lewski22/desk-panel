import React, { useEffect, useState, useMemo } from 'react';
import QRCode from 'qrcode';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import {
  PageHeader, Btn, Table, TR, TD, Badge, Modal, Input, Spinner,
} from '../components/ui';
import { useDirtyGuard } from '../hooks';
import { DirtyGuardDialog } from '../components/ui/DirtyGuardDialog';
import { parseApiError, FieldErrors } from '../utils/parseApiError';
import { FieldError } from '../components/ui/FieldError';

const STAFF_URL = window.location.origin;

const STATUS_COLOR: Record<string, 'green'|'amber'|'red'|'zinc'> = {
  ACTIVE: 'green', INACTIVE: 'zinc', MAINTENANCE: 'amber',
};

function QrModal({ desk, onClose }: { desk: any; onClose: () => void }) {
  const { t } = useTranslation();
  const qrUrl = `${STAFF_URL}/checkin/${desk.qrToken}`;
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(qrUrl, { width: 240, margin: 1 }).then(setQrDataUrl).catch(() => {});
  }, [qrUrl]);

  const copy = () => {
    navigator.clipboard.writeText(qrUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>QR — ${desk.name}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:40px}h2{font-size:22px;margin-bottom:4px}p{color:#666;font-size:13px;margin-bottom:20px}img{display:block;margin:0 auto 16px}code{font-size:11px;color:#888;word-break:break-all}</style></head><body>
        <h2>${desk.name}</h2><p>${desk.code}</p><img src="${qrDataUrl}" width="200" height="200" /><code>${qrUrl}</code>
      </body></html>`);
    w.document.close(); w.focus();
    setTimeout(() => { w.print(); }, 500);
  };

  return (
    <Modal title={t('desks.qr.title', { name: desk.name })} onClose={onClose}>
      <div className="flex flex-col items-center gap-4">
        <div className="p-3 bg-white rounded-xl border border-zinc-100 shadow-sm">
          {qrDataUrl
            ? <img src={qrDataUrl} width={200} height={200} alt={t('desks.qr.alt')} className="rounded" />
            : <div className="w-[200px] h-[200px] flex items-center justify-center text-zinc-300">…</div>
          }
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
  const [busy,       setBusy]       = useState(false);
  const [err,        setErr]        = useState('');
  const [globalErr,  setGlobalErr]  = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // FEATURE P4-2: filter state
  const [search,       setSearch]       = useState('');
  const [floorFilter,  setFloorFilter]  = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    appApi.locations.listAll().then(locs => {
      setLocations(locs);
      if (!locId && locs.length > 0) { setLocId(locs[0].id); localStorage.setItem('desks_loc', locs[0].id); }
    }).catch((e) => console.error('[DesksPage] locations.listAll', e));
  }, []);

  const load = async () => {
    if (!locId) return;
    setLoading(true);
    try { setDesks(await appApi.desks.list(locId)); }
    catch (e: any) { setErr(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [locId]);

  // FEATURE P4-2: reset filters on location change
  useEffect(() => { setSearch(''); setFloorFilter(''); setStatusFilter(''); }, [locId]);

  // FEATURE P4-2: derived floors list + filtered desks
  const uniqueFloors = useMemo(() =>
    [...new Set(desks.map(d => d.floor).filter(Boolean))].sort() as string[],
  [desks]);

  const filtered = useMemo(() => {
    let list = desks;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q)
      );
    }
    if (floorFilter)  list = list.filter(d => d.floor === floorFilter);
    if (statusFilter) list = list.filter(d => d.status === statusFilter);
    return list;
  }, [desks, search, floorFilter, statusFilter]);

  const anyFilterActive = !!(search || floorFilter || statusFilter);

  const closeModal = () => setModal(null);
  const { markDirty, resetDirty, requestClose, showConfirm, confirmClose, cancelClose } = useDirtyGuard(closeModal);

  const switchLoc = (id: string) => { setLocId(id); localStorage.setItem('desks_loc', id); };
  const openEdit  = (desk: any)  => { setTarget(desk); setForm({ name: desk.name, code: desk.code, floor: desk.floor ?? '', zone: desk.zone ?? '', locId }); resetDirty(); setModal('edit'); };
  const openQr    = (desk: any)  => { setTarget(desk); setModal('qr'); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setGlobalErr(''); setFieldErrors({});
    try { await appApi.desks.create(form.locId || locId, form); resetDirty(); setModal(null); setForm({ name:'', code:'', floor:'', zone:'', locId }); await load(); }
    catch (e: any) { const p = parseApiError(e); setGlobalErr(p.global); setFieldErrors(p.fields); }
    setBusy(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setGlobalErr(''); setFieldErrors({});
    try { await appApi.desks.update(target.id, form); resetDirty(); setModal(null); await load(); }
    catch (e: any) { const p = parseApiError(e); setGlobalErr(p.global); setFieldErrors(p.fields); }
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

  // FIX P0-2: admin table shows lifecycle status (ACTIVE/INACTIVE), not occupancy —
  // using 'desks.stats.free' (= "Wolne") for ACTIVE was misleading; use neutral admin labels
  const STATUS_LABEL: Record<string, string> = {
    ACTIVE: t('desks.status.active'), INACTIVE: t('desks.status.inactive'), MAINTENANCE: t('desks.actions.maintenance'),
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
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${locId === l.id ? 'bg-brand text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}>
              {l.name}
            </button>
          ))}
        </div>
      )}

      {/* FEATURE P4-2: filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('desks.filter.search_placeholder')}
          className="w-full sm:w-48 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        {uniqueFloors.length >= 2 && (
          <select value={floorFilter} onChange={e => setFloorFilter(e.target.value)}
            className="border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white">
            <option value="">{t('desks.filter.all_floors')}</option>
            {uniqueFloors.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        )}
        <div className="flex gap-1">
          {(['', 'ACTIVE', 'MAINTENANCE', 'INACTIVE'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                statusFilter === s
                  ? 'bg-brand text-white border-brand'
                  : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 bg-white'
              }`}>
              {s === '' ? t('desks.filter.all_statuses') : (STATUS_LABEL[s] ?? s)}
            </button>
          ))}
        </div>
        {anyFilterActive && (
          <>
            <span className="text-xs text-zinc-400">{t('desks.filter.results', { count: filtered.length, total: desks.length })}</span>
            <button onClick={() => { setSearch(''); setFloorFilter(''); setStatusFilter(''); }}
              className="text-xs text-brand hover:underline">
              {t('desks.filter.clear')}
            </button>
          </>
        )}
      </div>

      {err && <div className="mb-3 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{err}</div>}

      <Table headers={[
        t('desks.col.location'), t('desks.col.code'), t('desks.col.name'),
        t('desks.col.desk_id'), t('desks.col.floor'), t('desks.col.zone'),
        t('desks.col.beacon'), t('desks.col.status'), t('desks.col.actions'),
      ]} empty={!filtered.length}>
        {filtered.map(d => (
          <TR key={d.id}>
            <TD><span className="text-xs text-zinc-500">{d.location?.name ?? '—'}</span></TD>
            <TD mono>{d.code}</TD>
            <TD>{d.name}</TD>
            <TD>
              <div className="flex items-center gap-1">
                <code className="text-[10px] font-mono text-zinc-400 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded select-all">{d.id}</code>
                <button onClick={() => navigator.clipboard.writeText(d.id)} className="text-zinc-300 hover:text-brand transition-colors text-xs" title="Copy">⎘</button>
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
        <Modal title={modal === 'create' ? t('desks.modals.create_title') : t('desks.modals.edit_title', { name: target?.name })} onClose={requestClose}>
          <form onSubmit={modal === 'create' ? handleCreate : handleEdit} className="flex flex-col gap-3">
            {modal === 'create' && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-medium">{t('desks.form.label.location')}</label>
                {locations.length > 1 ? (
                  <select value={form.locId} onChange={e => { setForm(f => ({ ...f, locId: e.target.value })); markDirty(); }}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" required>
                    <option value="">{t('desks.form.select_placeholder')}</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                ) : (
                  <div className="px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200 text-sm text-zinc-600">{locations[0]?.name ?? '—'}</div>
                )}
              </div>
            )}
            <div>
              <Input label={t('desks.form.label.name')} placeholder="Desk A-01" required value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFieldErrors(fe => ({ ...fe, name: '' })); markDirty(); }} />
              <FieldError error={fieldErrors.name} />
            </div>
            <div>
              <Input label={t('desks.form.label.code')} placeholder="A-01" required value={form.code} onChange={e => { setForm(f => ({ ...f, code: e.target.value })); setFieldErrors(fe => ({ ...fe, code: '' })); markDirty(); }} />
              <FieldError error={fieldErrors.code} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('desks.form.label.floor')} placeholder="1" value={form.floor} onChange={e => { setForm(f => ({ ...f, floor: e.target.value })); markDirty(); }} />
              <Input label={t('desks.form.label.zone')} placeholder="Open Space" value={form.zone} onChange={e => { setForm(f => ({ ...f, zone: e.target.value })); markDirty(); }} />
            </div>
            {globalErr && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{globalErr}</p>
            )}
            <div className="flex gap-2 pt-1">
              <Btn type="submit" loading={busy} className="flex-1">{modal === 'create' ? t('btn.create') : t('btn.save')}</Btn>
              <Btn variant="secondary" onClick={requestClose} type="button">{t('btn.cancel')}</Btn>
            </div>
          </form>
        </Modal>
      )}

      {showConfirm && <DirtyGuardDialog onConfirm={confirmClose} onCancel={cancelClose} />}

      {modal === 'qr' && target && <QrModal desk={target} onClose={() => setModal(null)} />}
    </div>
  );
}
