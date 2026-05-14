/**
 * GroupDetailPage — /parking-groups/:id
 * Tabs: Users | Parkings | Blocks
 * UX: search-dropdown dla dodawania (zamiast dual-list)
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { pl, enUS } from 'date-fns/locale';
import { appApi }  from '../api/client';
import { Btn, Modal, Input, Spinner, EmptyState } from '../components/ui';
import { toast } from '../components/ui/Toast';
import { SearchDropdown } from '../components/ui/SearchDropdown';

type Tab = 'users' | 'parkings' | 'blocks';

function useDateLocale() {
  const { i18n } = useTranslation();
  return i18n.language?.startsWith('pl') ? pl : enUS;
}

// ── BulkAddModal (zachowane) ──────────────────────────────────
function BulkAddModal({ groupId, onClose, onSaved }: {
  groupId: string; onClose: () => void; onSaved: () => void;
}) {
  const { t }                        = useTranslation();
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

// ── AddBlockModal (zachowane) ─────────────────────────────────
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

// ── Main Page ─────────────────────────────────────────────────
export function GroupDetailPage() {
  const { t }        = useTranslation();
  const dateLocale   = useDateLocale();
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();

  const [group,   setGroup]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<Tab>('users');

  // ── Użytkownicy ─────────────────────────────────────────────
  const [allUsers,   setAllUsers]   = useState<any[]>([]);
  const [members,    setMembers]    = useState<any[]>([]);
  const [addingUser, setAddingUser] = useState<string | null>(null);
  const [showBulk,   setShowBulk]  = useState(false);

  // ── Parkingi ────────────────────────────────────────────────
  const [allParkings,     setAllParkings]     = useState<any[]>([]);
  const [assigned,        setAssigned]        = useState<any[]>([]);
  const [savingResources, setSavingResources] = useState(false);
  const [resourcesDirty,  setResourcesDirty]  = useState(false);
  const [loadingAccessFor, setLoadingAccessFor] = useState<Set<string>>(new Set());

  // ── Blokady ─────────────────────────────────────────────────
  const [blocks,     setBlocks]     = useState<any[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(true);
  const [futureOnly, setFutureOnly] = useState(true);
  const [showAddBlock, setShowAddBlock] = useState(false);

  // ── Load ─────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [grp, users, locs] = await Promise.all([
        appApi.parkingGroups.get(id),
        appApi.users.list(),
        appApi.locations.listAll(),
      ]);
      setGroup(grp);

      const memberIds = new Set<string>((grp.users ?? []).map((gu: any) => gu.userId ?? gu.user?.id));
      setMembers((grp.users ?? []).map((gu: any) => gu.user ?? gu));
      setAllUsers((users as any[]).filter(u => !memberIds.has(u.id)));

      const assignedIds = new Set<string>((grp.resources ?? []).map((gr: any) => gr.resourceId ?? gr.resource?.id));
      setAssigned((grp.resources ?? []).map((gr: any) => gr.resource ?? gr));

      const parkingArrays = await Promise.all(
        locs.map((loc: any) =>
          (appApi.resources.list(loc.id, 'PARKING') as Promise<any[]>)
            .then(res => res.map(r => ({ ...r, location: loc })))
            .catch(() => [] as any[])
        )
      );
      setAllParkings(parkingArrays.flat().filter((p: any) => !assignedIds.has(p.id)));
      setResourcesDirty(false);
    } catch (e: any) {
      toast(e.message ?? t('error.load_failed'), 'error');
    }
    setLoading(false);
  }, [id, t]);

  const loadBlocks = useCallback(async () => {
    if (!id) return;
    setLoadingBlocks(true);
    try {
      const now = new Date().toISOString();
      const list = await appApi.parkingBlocks.list({ groupId: id, ...(futureOnly ? { from: now } : {}) });
      setBlocks(list as any[]);
    } catch { /* silent */ }
    setLoadingBlocks(false);
  }, [id, futureOnly]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  // ── Użytkownicy — handlers ────────────────────────────────────
  const handleAddUser = async (user: any) => {
    if (!id) return;
    setAddingUser(user.id);
    try {
      await appApi.parkingGroups.addUser(id, user.id);
      setAllUsers(prev => prev.filter(u => u.id !== user.id));
      setMembers(prev => [...prev, user]);
      toast(`Dodano ${user.firstName ?? user.email}`);
    } catch (e: any) {
      toast(e.message ?? t('error.load_failed'), 'error');
    }
    setAddingUser(null);
  };

  const handleRemoveUser = async (userId: string) => {
    if (!id) return;
    try {
      await appApi.parkingGroups.removeUser(id, userId);
      const removed = members.find(u => u.id === userId);
      setMembers(prev => prev.filter(u => u.id !== userId));
      if (removed) setAllUsers(prev => [removed, ...prev]);
      toast(t('parking_groups.detail.users_tab.removed', 'Usunięto z grupy'));
    } catch (e: any) {
      toast(e.message ?? t('error.load_failed'), 'error');
    }
  };

  // ── Parkingi — handlers ───────────────────────────────────────
  const handleAddParking = (parking: any) => {
    setAllParkings(prev => prev.filter(p => p.id !== parking.id));
    setAssigned(prev => [...prev, parking]);
    setResourcesDirty(true);
  };

  const handleRemoveParking = (parkingId: string) => {
    const removed = assigned.find(p => p.id === parkingId);
    setAssigned(prev => prev.filter(p => p.id !== parkingId));
    if (removed) setAllParkings(prev => [...prev, removed]);
    setResourcesDirty(true);
  };

  const handleSaveResources = async () => {
    if (!id) return;
    setSavingResources(true);
    try {
      await appApi.parkingGroups.setResources(id, assigned.map(p => p.id));
      setResourcesDirty(false);
      toast(t('parking_groups.detail.parkings_tab.saved', 'Przypisanie parkingów zapisano'));
    } catch (e: any) {
      toast(e.message ?? t('error.load_failed'), 'error');
    }
    setSavingResources(false);
  };

  const handleAccessMode = async (resourceId: string, mode: string) => {
    setLoadingAccessFor(prev => new Set(prev).add(resourceId));
    try {
      await appApi.parkingGroups.setAccessMode(resourceId, mode);
      setAssigned(prev => prev.map(p => p.id === resourceId ? { ...p, accessMode: mode } : p));
    } catch (e: any) {
      toast(e.message ?? t('error.load_failed'), 'error');
    }
    setLoadingAccessFor(prev => { const next = new Set(prev); next.delete(resourceId); return next; });
  };

  // ── Filter functions ──────────────────────────────────────────
  const filterUser = (user: any, query: string) => {
    const q = query.toLowerCase();
    return (
      `${user.firstName ?? ''} ${user.lastName ?? ''}`.toLowerCase().includes(q) ||
      (user.email ?? '').toLowerCase().includes(q)
    );
  };

  const filterParking = (parking: any, query: string) => {
    const q = query.toLowerCase();
    return (
      (parking.name ?? '').toLowerCase().includes(q) ||
      (parking.code ?? '').toLowerCase().includes(q) ||
      (parking.location?.name ?? '').toLowerCase().includes(q) ||
      (parking.floor ?? '').toLowerCase().includes(q) ||
      (parking.zone ?? '').toLowerCase().includes(q)
    );
  };

  // ─────────────────────────────────────────────────────────────
  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  if (!group) return (
    <div className="text-center py-16 text-zinc-400">
      <p className="mb-3">Nie znaleziono grupy.</p>
      <button onClick={() => navigate('/parking-groups')} className="text-brand underline text-sm">
        ← Wróć do grup
      </button>
    </div>
  );

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'users',    label: t('parking_groups.detail.tab_users'),    count: members.length },
    { key: 'parkings', label: t('parking_groups.detail.tab_parkings'), count: assigned.length },
    { key: 'blocks',   label: t('parking_groups.detail.tab_blocks') },
  ];

  const now = new Date();
  const fmt = (d: string) => format(new Date(d), 'dd MMM yyyy HH:mm', { locale: dateLocale });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/parking-groups')}
          className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
          {t('parking_groups.detail.back')}
        </button>
        <span className="text-zinc-300">/</span>
        <h1 className="text-xl font-semibold text-zinc-800">{group.name}</h1>
        {group.description && (
          <span className="text-sm text-zinc-400">{group.description}</span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-zinc-100 rounded-xl p-1 mb-6 w-fit">
        {TABS.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              tab === tb.key ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            }`}>
            {tb.label}
            {tb.count !== undefined && tb.count > 0 && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                tab === tb.key ? 'bg-brand/10 text-brand' : 'bg-zinc-200 text-zinc-500'
              }`}>
                {tb.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Użytkownicy ── */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-zinc-500">
                Dodaj użytkownika do grupy
              </label>
              <button
                onClick={() => setShowBulk(true)}
                className="text-xs text-zinc-400 hover:text-brand transition-colors"
              >
                + Dodaj wiele (email)
              </button>
            </div>
            <SearchDropdown
              placeholder={t('parking_groups.detail.users_tab.search_ph', 'Szukaj po imieniu, nazwisku lub emailu...')}
              items={allUsers}
              filterFn={filterUser}
              onSelect={handleAddUser}
              disabled={!!addingUser}
              renderItem={(user: any) => (
                <>
                  <div className="w-7 h-7 rounded-full bg-brand/10 text-brand flex items-center
                    justify-center text-xs font-semibold shrink-0">
                    {(user.firstName?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-700 truncate">
                      {user.firstName ?? ''} {user.lastName ?? ''}
                    </p>
                    <p className="text-xs text-zinc-400 truncate">{user.email}</p>
                  </div>
                  <span className="text-[10px] text-zinc-300 group-hover:text-brand transition-colors font-medium">
                    Dodaj
                  </span>
                </>
              )}
            />
            {allUsers.length === 0 && members.length > 0 && (
              <p className="text-xs text-zinc-400 mt-1.5">
                Wszyscy użytkownicy organizacji są już w tej grupie.
              </p>
            )}
          </div>

          {members.length === 0 ? (
            <EmptyState icon="👤"
              title={t('parking_groups.detail.users_tab.empty_title')}
              sub={t('parking_groups.detail.users_tab.empty_sub')} />
          ) : (
            <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
              <div className="px-4 py-2 border-b border-zinc-50 bg-zinc-50/50">
                <p className="text-xs font-medium text-zinc-400">
                  {members.length} {members.length === 1 ? 'członek' : 'członków'}
                </p>
              </div>
              <ul className="divide-y divide-zinc-50">
                {members.map((user: any) => (
                  <li key={user.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50/50 transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center
                      justify-center text-sm font-semibold shrink-0">
                      {(user.firstName?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-700">
                        {user.firstName ?? ''} {user.lastName ?? ''}
                      </p>
                      <p className="text-xs text-zinc-400">{user.email}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveUser(user.id)}
                      className="opacity-0 group-hover:opacity-100 text-xs px-2.5 py-1 rounded-lg
                        border border-zinc-200 text-zinc-400 hover:border-red-200 hover:text-red-500
                        hover:bg-red-50 transition-all"
                    >
                      {t('btn.remove')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Parkingi ── */}
      {tab === 'parkings' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">
              Dodaj miejsce parkingowe do grupy
            </label>
            <SearchDropdown
              placeholder={t('parking_groups.detail.parkings_tab.search_ph', 'Szukaj po kodzie, nazwie lub lokalizacji...')}
              items={allParkings}
              filterFn={filterParking}
              onSelect={handleAddParking}
              renderItem={(parking: any) => (
                <>
                  <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center
                    justify-center text-sm shrink-0">
                    🅿️
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-700 truncate">
                      {parking.name}
                      <span className="ml-1.5 text-xs font-mono text-zinc-400">{parking.code}</span>
                    </p>
                    <p className="text-xs text-zinc-400 truncate">
                      {parking.location?.name ?? '—'}
                      {parking.floor && ` · Piętro: ${parking.floor}`}
                      {parking.zone  && ` · Strefa: ${parking.zone}`}
                    </p>
                  </div>
                  <span className="text-[10px] text-zinc-300 group-hover:text-brand transition-colors font-medium">
                    Dodaj
                  </span>
                </>
              )}
            />
            {allParkings.length === 0 && (
              <p className="text-xs text-zinc-400 mt-1.5">
                Wszystkie dostępne parkingi są już przypisane do tej grupy.
              </p>
            )}
          </div>

          {assigned.length === 0 ? (
            <EmptyState icon="🅿️"
              title={t('parking_groups.detail.parkings_tab.empty_title')}
              sub={t('parking_groups.detail.parkings_tab.empty_sub')} />
          ) : (
            <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
              <div className="px-4 py-2 border-b border-zinc-50 bg-zinc-50/50 flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-400">
                  {assigned.length} {assigned.length === 1 ? 'miejsce' : 'miejsc'} przypisanych
                </p>
                {resourcesDirty && (
                  <span className="text-[11px] text-amber-500 font-medium">● Niezapisane zmiany</span>
                )}
              </div>
              <ul className="divide-y divide-zinc-50">
                {assigned.map((parking: any) => (
                  <li key={parking.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50/50 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-base shrink-0">
                      🅿️
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-700">
                        {parking.name}
                        <span className="ml-1.5 text-xs font-mono text-zinc-400">{parking.code}</span>
                      </p>
                      <p className="text-xs text-zinc-400">
                        {parking.location?.name ?? '—'}
                        {parking.floor && ` · Piętro: ${parking.floor}`}
                        {parking.zone  && ` · Strefa: ${parking.zone}`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAccessMode(
                        parking.id,
                        parking.accessMode === 'PUBLIC' ? 'GROUP_RESTRICTED' : 'PUBLIC',
                      )}
                      disabled={loadingAccessFor.has(parking.id)}
                      className={`text-xs px-2 py-1 rounded-full font-medium transition-colors
                        disabled:opacity-50 shrink-0 ${
                        parking.accessMode === 'GROUP_RESTRICTED'
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      }`}
                    >
                      {loadingAccessFor.has(parking.id)
                        ? '…'
                        : parking.accessMode === 'GROUP_RESTRICTED'
                          ? t('parking_groups.detail.parkings_tab.access_group')
                          : t('parking_groups.detail.parkings_tab.access_public')}
                    </button>
                    <button
                      onClick={() => handleRemoveParking(parking.id)}
                      className="opacity-0 group-hover:opacity-100 text-xs px-2.5 py-1 rounded-lg
                        border border-zinc-200 text-zinc-400 hover:border-red-200 hover:text-red-500
                        hover:bg-red-50 transition-all"
                    >
                      {t('btn.remove')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resourcesDirty && (
            <div className="flex justify-end gap-2">
              <Btn variant="secondary" onClick={() => { load(); }}>
                {t('btn.cancel')}
              </Btn>
              <Btn onClick={handleSaveResources} loading={savingResources}>
                {t('parking_groups.detail.parkings_tab.save')}
              </Btn>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Blokady ── */}
      {tab === 'blocks' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={futureOnly}
                onChange={e => setFutureOnly(e.target.checked)}
                className="w-4 h-4 rounded accent-violet-500"
              />
              {t('parking_groups.detail.blocks_tab.future_only')}
            </label>
            <div className="ml-auto">
              <Btn size="sm" onClick={() => setShowAddBlock(true)}>
                {t('parking_groups.detail.blocks_tab.add_block')}
              </Btn>
            </div>
          </div>

          {loadingBlocks ? <Spinner /> : blocks.length === 0 ? (
            <EmptyState icon="⛔"
              title={t('parking_groups.detail.blocks_tab.empty_title')}
              sub={t('parking_groups.detail.blocks_tab.empty_sub')} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-100">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-100">
                  <tr>
                    <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                      {t('parking_groups.detail.blocks_tab.col_from')}
                    </th>
                    <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                      {t('parking_groups.detail.blocks_tab.col_to')}
                    </th>
                    <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider hidden sm:table-cell">
                      {t('parking_groups.detail.blocks_tab.col_reason')}
                    </th>
                    <th className="py-2.5 px-4 text-left text-xs text-zinc-400 font-semibold uppercase tracking-wider hidden md:table-cell">
                      {t('parking_groups.detail.blocks_tab.col_created_by')}
                    </th>
                    <th className="py-2.5 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {blocks.map(b => (
                    <tr key={b.id} className="border-b border-zinc-50 hover:bg-zinc-50/60 group">
                      <td className="py-3 px-4 text-zinc-700">{fmt(b.startTime)}</td>
                      <td className="py-3 px-4 text-zinc-700">{fmt(b.endTime)}</td>
                      <td className="py-3 px-4 text-zinc-500 hidden sm:table-cell">
                        {b.reason ?? <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="py-3 px-4 text-zinc-400 text-xs hidden md:table-cell">
                        {b.creator?.firstName} {b.creator?.lastName}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={async () => {
                            if (!confirm(t('parking_groups.detail.blocks_tab.confirm_remove'))) return;
                            try {
                              await appApi.parkingBlocks.remove(b.id);
                              setBlocks(prev => prev.filter(x => x.id !== b.id));
                              toast('Blokada usunięta');
                            } catch (e: any) {
                              toast(e?.message ?? t('error.load_failed'), 'error');
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded-lg
                            bg-red-50 hover:bg-red-100 text-red-600 transition-all"
                        >
                          {t('btn.remove')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showBulk && (
        <BulkAddModal
          groupId={id!}
          onClose={() => setShowBulk(false)}
          onSaved={() => { setShowBulk(false); load(); }}
        />
      )}
      {showAddBlock && (
        <AddBlockModal
          groupId={id!}
          onClose={() => setShowAddBlock(false)}
          onSaved={() => { setShowAddBlock(false); loadBlocks(); }}
        />
      )}
    </div>
  );
}
