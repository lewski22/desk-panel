/**
 * GroupDetailPage — /parking-groups/:id
 * 3 tabs: Users | Parking spots | Blocks
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { pl, enUS } from 'date-fns/locale';
import { appApi }  from '../api/client';
import { Btn, Modal, Input, Spinner, EmptyState } from '../components/ui';

type Tab = 'users' | 'parkings' | 'blocks';

function useDateLocale() {
  const { i18n } = useTranslation();
  return i18n.language?.startsWith('pl') ? pl : enUS;
}

// ── AddUserModal ──────────────────────────────────────────────
function AddUserModal({ groupId, onClose, onSaved }: {
  groupId: string; onClose: () => void; onSaved: () => void;
}) {
  const { t }                            = useTranslation();
  const [allUsers,  setAllUsers]  = useState<any[]>([]);
  const [search,    setSearch]    = useState('');
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState<string | null>(null);
  const [selected,  setSelected]  = useState<string | null>(null);

  useEffect(() => {
    appApi.users.list().then(setAllUsers).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allUsers.filter(u =>
      u.email?.toLowerCase().includes(q) ||
      u.firstName?.toLowerCase().includes(q) ||
      u.lastName?.toLowerCase().includes(q),
    ).slice(0, 10);
  }, [allUsers, search]);

  const handleAdd = async () => {
    if (!selected) return;
    setSaving(true); setErr(null);
    try {
      await appApi.parkingGroups.addUser(groupId, selected);
      onSaved();
    } catch (e: any) {
      setErr(e?.message ?? t('error.load_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t('parking_groups.detail.add_user_modal.title')} onClose={onClose}>
      <div className="space-y-3">
        <Input
          label={t('parking_groups.detail.add_user_modal.search_label')}
          value={search}
          onChange={e => { setSearch(e.target.value); setSelected(null); }}
          placeholder={t('parking_groups.detail.add_user_modal.search_ph')}
          autoFocus
        />
        {search && filtered.length > 0 && (
          <div className="border border-zinc-200 rounded-lg overflow-hidden">
            {filtered.map(u => (
              <button
                key={u.id}
                onClick={() => { setSelected(u.id); setSearch(`${u.firstName ?? ''} ${u.lastName ?? ''} (${u.email})`); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 transition-colors border-b border-zinc-100 last:border-0 ${selected === u.id ? 'bg-violet-50' : ''}`}
              >
                <span className="font-medium">{u.firstName} {u.lastName}</span>
                <span className="ml-2 text-zinc-400 text-xs">{u.email}</span>
              </button>
            ))}
          </div>
        )}
        {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="secondary" onClick={onClose}>{t('btn.cancel')}</Btn>
          <Btn onClick={handleAdd} loading={saving} disabled={!selected}>{t('parking_groups.detail.add_user_modal.submit')}</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ── BulkAddModal ──────────────────────────────────────────────
function BulkAddModal({ groupId, onClose, onSaved }: {
  groupId: string; onClose: () => void; onSaved: () => void;
}) {
  const { t }                       = useTranslation();
  const [text,   setText]   = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ added: number } | null>(null);
  const [err,    setErr]    = useState<string | null>(null);

  const handleAdd = async () => {
    const emails = text.split(/[\n,;]/).map(e => e.trim()).filter(Boolean);
    if (emails.length === 0) return;
    setSaving(true); setErr(null);
    try {
      const allUsers = await appApi.users.list();
      const emailMap: Record<string, string> = {};
      for (const u of allUsers) { if (u.email) emailMap[u.email.toLowerCase()] = u.id; }
      const userIds = emails.map(e => emailMap[e.toLowerCase()]).filter(Boolean) as string[];
      const res = await appApi.parkingGroups.addUsersBulk(groupId, userIds);
      setResult(res);
      setTimeout(onSaved, 1200);
    } catch (e: any) {
      setErr(e?.message ?? t('error.load_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t('parking_groups.detail.bulk_modal.title')} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-zinc-500">{t('parking_groups.detail.bulk_modal.hint')}</p>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={6}
          placeholder="jan.kowalski@firma.pl&#10;anna.nowak@firma.pl"
          className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400 resize-none"
          autoFocus
        />
        {result && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            {t('parking_groups.detail.bulk_modal.added', { count: result.added })}
          </p>
        )}
        {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="secondary" onClick={onClose}>{t('btn.cancel')}</Btn>
          <Btn onClick={handleAdd} loading={saving}>{t('parking_groups.detail.bulk_modal.submit')}</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ── AddBlockModal ─────────────────────────────────────────────
function AddBlockModal({ groupId, onClose, onSaved }: {
  groupId: string; onClose: () => void; onSaved: () => void;
}) {
  const { t }                          = useTranslation();
  const [startTime, setStart]   = useState('');
  const [endTime,   setEnd]     = useState('');
  const [reason,    setReason]  = useState('');
  const [saving,    setSaving]  = useState(false);
  const [err,       setErr]     = useState<string | null>(null);

  const handleSave = async () => {
    if (!startTime || !endTime) { setErr(t('parking_groups.detail.add_block_modal.time_required')); return; }
    if (new Date(startTime) >= new Date(endTime)) { setErr(t('parking_groups.detail.add_block_modal.time_invalid')); return; }
    setSaving(true); setErr(null);
    try {
      await appApi.parkingBlocks.create({ groupId, startTime, endTime, reason: reason.trim() || undefined });
      onSaved();
    } catch (e: any) {
      setErr(e?.message ?? t('error.load_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t('parking_groups.detail.add_block_modal.title')} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('parking_groups.detail.add_block_modal.from_label')} type="datetime-local" value={startTime} onChange={e => setStart(e.target.value)} />
          <Input label={t('parking_groups.detail.add_block_modal.to_label')}   type="datetime-local" value={endTime}   onChange={e => setEnd(e.target.value)} />
        </div>
        <Input
          label={t('parking_groups.detail.add_block_modal.reason_label')}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder={t('parking_groups.detail.add_block_modal.reason_ph')}
        />
        {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="secondary" onClick={onClose}>{t('btn.cancel')}</Btn>
          <Btn onClick={handleSave} loading={saving}>{t('parking_groups.detail.add_block_modal.submit')}</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ── UsersTab ──────────────────────────────────────────────────
function UsersTab({ group, groupId, onReload }: { group: any; groupId: string; onReload: () => void }) {
  const { t }                              = useTranslation();
  const dateLocale                         = useDateLocale();
  const [search,    setSearch]    = useState('');
  const [showAdd,   setShowAdd]   = useState(false);
  const [showBulk,  setShowBulk]  = useState(false);

  const members: any[] = group?.users ?? [];
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return members.filter(m =>
      m.user.email?.toLowerCase().includes(q) ||
      m.user.firstName?.toLowerCase().includes(q) ||
      m.user.lastName?.toLowerCase().includes(q),
    );
  }, [members, search]);

  const handleRemove = async (userId: string, name: string) => {
    if (!confirm(t('parking_groups.detail.users_tab.confirm_remove', { name }))) return;
    try {
      await appApi.parkingGroups.removeUser(groupId, userId);
      onReload();
    } catch (e: any) {
      alert(e?.message ?? t('error.load_failed'));
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('parking_groups.detail.users_tab.search_ph')}
          className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
        />
        <Btn size="sm" variant="secondary" onClick={() => setShowBulk(true)}>{t('parking_groups.detail.users_tab.add_bulk')}</Btn>
        <Btn size="sm" onClick={() => setShowAdd(true)}>{t('parking_groups.detail.users_tab.add_user')}</Btn>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="👤" title={t('parking_groups.detail.users_tab.empty_title')} sub={t('parking_groups.detail.users_tab.empty_sub')} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-100">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('parking_groups.detail.users_tab.col_user')}</th>
                <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider hidden md:table-cell">{t('parking_groups.detail.users_tab.col_email')}</th>
                <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider hidden sm:table-cell">{t('parking_groups.detail.users_tab.col_added')}</th>
                <th className="py-2.5 px-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.userId} className="border-b border-zinc-50 hover:bg-zinc-50/60 group">
                  <td className="py-3 px-4">
                    <p className="font-medium text-zinc-800">{m.user.firstName} {m.user.lastName}</p>
                  </td>
                  <td className="py-3 px-4 text-zinc-500 hidden md:table-cell">{m.user.email}</td>
                  <td className="py-3 px-4 text-zinc-400 text-xs hidden sm:table-cell">
                    {format(new Date(m.addedAt), 'dd MMM yyyy', { locale: dateLocale })}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleRemove(m.userId, `${m.user.firstName} ${m.user.lastName}`)}
                      className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-all">
                      {t('btn.remove')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd  && <AddUserModal groupId={groupId} onClose={() => setShowAdd(false)}  onSaved={() => { setShowAdd(false);  onReload(); }} />}
      {showBulk && <BulkAddModal groupId={groupId} onClose={() => setShowBulk(false)} onSaved={() => { setShowBulk(false); onReload(); }} />}
    </div>
  );
}

// ── ParkingsTab ───────────────────────────────────────────────
function ParkingsTab({ group, groupId, onReload }: { group: any; groupId: string; onReload: () => void }) {
  const { t }                                  = useTranslation();
  const [allParkings,      setAllParkings]      = useState<any[]>([]);
  const [selected,         setSelected]         = useState<Set<string>>(new Set());
  const [saving,           setSaving]           = useState(false);
  const [loadingP,         setLoadingP]         = useState(true);
  const [loadingAccessFor, setLoadingAccessFor] = useState<Set<string>>(new Set());

  const assignedIds = useMemo(
    () => new Set<string>((group?.resources ?? []).map((r: any) => r.resourceId)),
    [group],
  );

  useEffect(() => {
    setSelected(new Set(assignedIds));
  }, [group]);

  useEffect(() => {
    appApi.locations.listAll()
      .then(locs => Promise.all(locs.map(l => appApi.resources.list(l.id, 'PARKING'))))
      .then(arrays => setAllParkings(arrays.flat()))
      .catch(() => {})
      .finally(() => setLoadingP(false));
  }, []);

  const toggleParking = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await appApi.parkingGroups.setResources(groupId, Array.from(selected));
      onReload();
    } catch (e: any) {
      alert(e?.message ?? t('error.load_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleAccessMode = async (resourceId: string, mode: string) => {
    setLoadingAccessFor(prev => new Set(prev).add(resourceId));
    try {
      await appApi.parkingGroups.setAccessMode(resourceId, mode);
      onReload();
    } catch (e: any) {
      alert(e?.message ?? t('error.load_failed'));
    } finally {
      setLoadingAccessFor(prev => { const next = new Set(prev); next.delete(resourceId); return next; });
    }
  };

  if (loadingP) return <Spinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-500">{t('parking_groups.detail.parkings_tab.hint')}</p>
        <Btn size="sm" onClick={handleSave} loading={saving}>{t('parking_groups.detail.parkings_tab.save')}</Btn>
      </div>

      {allParkings.length === 0 ? (
        <EmptyState icon="🅿️" title={t('parking_groups.detail.parkings_tab.empty_title')} sub={t('parking_groups.detail.parkings_tab.empty_sub')} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-100">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                <th className="w-10 py-2.5 px-4" />
                <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('parking_groups.detail.parkings_tab.col_name')}</th>
                <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider hidden sm:table-cell">{t('parking_groups.detail.parkings_tab.col_code')}</th>
                <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('parking_groups.detail.parkings_tab.col_access')}</th>
              </tr>
            </thead>
            <tbody>
              {allParkings.map(r => (
                <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/60">
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleParking(r.id)}
                      className="w-4 h-4 rounded accent-violet-500"
                    />
                  </td>
                  <td className="py-3 px-4 font-medium text-zinc-800">{r.name}</td>
                  <td className="py-3 px-4 text-zinc-400 font-mono text-xs hidden sm:table-cell">{r.code}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleAccessMode(r.id, r.accessMode === 'PUBLIC' ? 'GROUP_RESTRICTED' : 'PUBLIC')}
                      disabled={loadingAccessFor.has(r.id)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        r.accessMode === 'GROUP_RESTRICTED'
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      }`}>
                      {loadingAccessFor.has(r.id) ? '…' : r.accessMode === 'GROUP_RESTRICTED'
                        ? t('parking_groups.detail.parkings_tab.access_group')
                        : t('parking_groups.detail.parkings_tab.access_public')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── BlocksTab ─────────────────────────────────────────────────
function BlocksTab({ groupId }: { groupId: string }) {
  const { t }                                    = useTranslation();
  const dateLocale                               = useDateLocale();
  const [blocks,       setBlocks]      = useState<any[]>([]);
  const [loading,      setLoading]     = useState(true);
  const [futureOnly,   setFutureOnly]  = useState(true);
  const [showAdd,      setShowAdd]     = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const now = new Date().toISOString();
    appApi.parkingBlocks.list({ groupId, ...(futureOnly ? { from: now } : {}) })
      .then(setBlocks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [groupId, futureOnly]);

  useEffect(() => { load(); }, [load]);

  const handleRemove = async (id: string) => {
    if (!confirm(t('parking_groups.detail.blocks_tab.confirm_remove'))) return;
    try { await appApi.parkingBlocks.remove(id); load(); }
    catch (e: any) { alert(e?.message ?? t('error.load_failed')); }
  };

  const fmt = (d: string) => format(new Date(d), 'dd MMM yyyy HH:mm', { locale: dateLocale });

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
          <input
            type="checkbox"
            checked={futureOnly}
            onChange={e => setFutureOnly(e.target.checked)}
            className="w-4 h-4 rounded accent-violet-500"
          />
          {t('parking_groups.detail.blocks_tab.future_only')}
        </label>
        <div className="ml-auto">
          <Btn size="sm" onClick={() => setShowAdd(true)}>{t('parking_groups.detail.blocks_tab.add_block')}</Btn>
        </div>
      </div>

      {loading ? <Spinner /> : blocks.length === 0 ? (
        <EmptyState icon="⛔" title={t('parking_groups.detail.blocks_tab.empty_title')} sub={t('parking_groups.detail.blocks_tab.empty_sub')} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-100">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('parking_groups.detail.blocks_tab.col_from')}</th>
                <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider">{t('parking_groups.detail.blocks_tab.col_to')}</th>
                <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider hidden sm:table-cell">{t('parking_groups.detail.blocks_tab.col_reason')}</th>
                <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider hidden md:table-cell">{t('parking_groups.detail.blocks_tab.col_created_by')}</th>
                <th className="py-2.5 px-4" />
              </tr>
            </thead>
            <tbody>
              {blocks.map(b => (
                <tr key={b.id} className="border-b border-zinc-50 hover:bg-zinc-50/60 group">
                  <td className="py-3 px-4 text-zinc-700">{fmt(b.startTime)}</td>
                  <td className="py-3 px-4 text-zinc-700">{fmt(b.endTime)}</td>
                  <td className="py-3 px-4 text-zinc-500 hidden sm:table-cell">{b.reason ?? <span className="text-zinc-300">—</span>}</td>
                  <td className="py-3 px-4 text-zinc-400 text-xs hidden md:table-cell">
                    {b.creator?.firstName} {b.creator?.lastName}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleRemove(b.id)}
                      className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-all">
                      {t('btn.remove')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddBlockModal
          groupId={groupId}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export function GroupDetailPage() {
  const { t }                               = useTranslation();
  const { id }                              = useParams<{ id: string }>();
  const navigate                            = useNavigate();
  const [group,   setGroup]         = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [err,     setErr]           = useState<string | null>(null);
  const [tab,     setTab]           = useState<Tab>('users');

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true); setErr(null);
    appApi.parkingGroups.get(id)
      .then(setGroup)
      .catch(e => setErr(e?.message ?? t('error.load_failed')))
      .finally(() => setLoading(false));
  }, [id, t]);

  useEffect(() => { load(); }, [load]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'users',    label: t('parking_groups.detail.tab_users')    },
    { key: 'parkings', label: t('parking_groups.detail.tab_parkings') },
    { key: 'blocks',   label: t('parking_groups.detail.tab_blocks')   },
  ];

  if (loading) return <Spinner />;

  if (err) return (
    <div className="flex flex-col items-start gap-3">
      <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{err}</div>
      <Btn variant="secondary" onClick={load}>{t('btn.retry')}</Btn>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/parking-groups')}
          className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
          {t('parking_groups.detail.back')}
        </button>
        <span className="text-zinc-300">/</span>
        <h1 className="text-xl font-semibold text-zinc-800">{group?.name}</h1>
        {group?.description && (
          <span className="text-sm text-zinc-400">{group.description}</span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-zinc-100 rounded-xl p-1 mb-6 w-fit">
        {TABS.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === tb.key ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            }`}>
            {tb.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'users'    && <UsersTab    group={group} groupId={id!} onReload={load} />}
      {tab === 'parkings' && <ParkingsTab group={group} groupId={id!} onReload={load} />}
      {tab === 'blocks'   && <BlocksTab   groupId={id!} />}
    </div>
  );
}
