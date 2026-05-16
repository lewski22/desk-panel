import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { useRole } from '../context/UserContext';
import { NfcCardModal } from '../components/users/NfcCardModal';
import { PageHeader, Btn, Table, TR, TD, Badge, Modal, Input, Select } from '../components/ui';
import { SkeletonRows } from '../components/ui/Skeleton';
import { useDirtyGuard } from '../hooks';
import { DirtyGuardDialog } from '../components/ui/DirtyGuardDialog';
import { parseApiError, FieldErrors } from '../utils/parseApiError';
import { FieldError } from '../components/ui/FieldError';
import { toast } from '../components/ui/Toast';

const ROLE_COLOR: Record<string,'purple'|'blue'|'zinc'|'green'> = {
  SUPER_ADMIN: 'purple', OFFICE_ADMIN: 'blue', STAFF: 'zinc', END_USER: 'green',
};

const chipBtn = (active: boolean) =>
  `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
    active
      ? 'bg-[#FDF4F9] border-[#B53578] text-[#B53578]'
      : 'bg-white border-[#DCD6EA] text-[#6B5F7A] hover:bg-[#F8F6FC]'
  }`;

const iconBtn =
  'w-7 h-7 flex items-center justify-center rounded-md border border-[#DCD6EA] text-[#6B5F7A] hover:bg-[#F8F6FC] transition-colors';

type TabType = 'active' | 'deactivated';

export function UsersPage() {
  const { t, i18n } = useTranslation();
  const [users,       setUsers]      = useState<any[]>([]);
  const [deactivated, setDeactivated] = useState<any[]>([]);
  const [tab,         setTab]        = useState<TabType>('active');
  const [loading,     setLoading]    = useState(true);
  const [modal,       setModal]      = useState<'create'|'edit'|'card'|'deactivate'|'invite'|null>(null);
  const [target,      setTarget]     = useState<any>(null);
  const [form,     setForm]     = useState({ email:'', password:'', firstName:'', lastName:'', role:'END_USER' });
  const [inviteForm, setInviteForm] = useState({ email:'', role:'END_USER' });
  const [inviteSent,       setInviteSent]       = useState(false);
  const [pendingInvites,   setPendingInvites]   = useState<{ email: string; role: string; expiresAt: string }[]>([]);
  const [editForm, setEditForm] = useState({ firstName:'', lastName:'', email:'', role:'END_USER' });
  const [retDays,  setRetDays]  = useState(30);
  const [busy,       setBusy]       = useState(false);
  const [err,        setErr]        = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [cardFilter, setCardFilter] = useState<''|'has'|'none'>('');
  const [showRoleDrop, setShowRoleDrop] = useState(false);
  const [showCardDrop, setShowCardDrop] = useState(false);
  const [openMenuId,   setOpenMenuId]   = useState<string | null>(null);

  const roleDropRef = useRef<HTMLDivElement>(null);
  const cardDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showRoleDrop) return;
    const handler = (e: MouseEvent) => {
      if (roleDropRef.current && !roleDropRef.current.contains(e.target as Node)) setShowRoleDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showRoleDrop]);

  useEffect(() => {
    if (!showCardDrop) return;
    const handler = (e: MouseEvent) => {
      if (cardDropRef.current && !cardDropRef.current.contains(e.target as Node)) setShowCardDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCardDrop]);

  useEffect(() => {
    if (!openMenuId) return;
    const handler = () => setOpenMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openMenuId]);

  const currentUserRole = useRole();

  const locale = i18n.language === 'en' ? 'en-GB' : 'pl-PL';

  const handleTabChange = useCallback((next: TabType) => {
    setTab(next);
    setSearch(''); setRoleFilter(''); setCardFilter('');
  }, []);

  const filtered = useMemo(() => {
    let list = tab === 'active' ? users : deactivated;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        `${u.firstName ?? ''} ${u.lastName ?? ''}`.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q)
      );
    }
    if (roleFilter) list = list.filter(u => u.role === roleFilter);
    if (cardFilter === 'has')  list = list.filter(u => !!u.cardUid);
    if (cardFilter === 'none') list = list.filter(u => !u.cardUid);
    return list;
  }, [users, deactivated, tab, search, roleFilter, cardFilter]);

  const anyFilterActive = !!(search || roleFilter || cardFilter);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    const [active, deleted, pending] = await Promise.all([
      appApi.users.list().catch(() => [] as any[]),
      appApi.users.listDeactivated().catch(() => [] as any[]),
      appApi.auth.pendingInvitations().catch(() => []),
    ]);
    setUsers(active); setDeactivated(deleted); setPendingInvites(pending);
    if (!silent) setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await appApi.auth.inviteUser({ email: inviteForm.email, role: inviteForm.role });
      setInviteSent(true);
      load(true);
    } catch(e:any) { setErr(e.message); }
    setBusy(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(''); setFieldErrors({});
    try {
      await appApi.users.create({ ...form });
      resetDirty(); setModal(null); setForm({ email:'',password:'',firstName:'',lastName:'',role:'END_USER' });
      toast(t('toast.user_created', 'Użytkownik utworzony'));
      load(true);
    } catch(e:any) { const p = parseApiError(e); setErr(p.global); setFieldErrors(p.fields); }
    setBusy(false);
  };

  const closeModal = () => setModal(null);
  const { markDirty, resetDirty, requestClose, showConfirm, confirmClose, cancelClose } = useDirtyGuard(closeModal);

  const openEdit = (u: any) => {
    resetDirty();
    setTarget(u); setEditForm({ firstName: u.firstName ?? '', lastName: u.lastName ?? '', email: u.email, role: u.role });
    setModal('edit');
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(''); setFieldErrors({});
    try {
      await appApi.users.update(target.id, editForm);
      resetDirty(); setModal(null);
      toast(t('toast.user_saved', 'Użytkownik zapisany'));
      load(true);
    }
    catch(e:any) { const p = parseApiError(e); setErr(p.global); setFieldErrors(p.fields); }
    setBusy(false);
  };

  const handleDeactivate = async () => {
    setBusy(true);
    try { await appApi.users.deactivate(target.id, retDays); setModal(null); load(true); }
    catch(e:any) { setErr(e.message); }
    setBusy(false);
  };

  const handleRestore = async (id: string) => {
    try { await appApi.users.restore(id); load(true); }
    catch(e:any) { setErr(e.message); }
  };

  const handleHardDelete = async (id: string, name: string) => {
    if (!confirm(t('users.modals.confirm_hard_delete', { name }))) return;
    try { await appApi.users.hardDelete(id); load(true); }
    catch(e:any) { setErr(e.message); }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(locale, { day:'2-digit', month:'2-digit', year:'numeric' });

  if (loading) return (
    <div>
      <PageHeader title={t('pages.users.title')} sub="" />
      <SkeletonRows rows={6} />
    </div>
  );

  const ROLE_LABEL: Record<string, string> = {
    SUPER_ADMIN: t('users.roles.SUPER_ADMIN'), OFFICE_ADMIN: t('users.roles.OFFICE_ADMIN'),
    STAFF: t('users.roles.STAFF'), END_USER: t('users.roles.END_USER'),
  };

  return (
    <div>
      <PageHeader
        title={t('pages.users.title')}
        sub={t('users.sub', { active: users.length, deactivated: deactivated.length })}
        action={
          <div className="flex gap-2">
            <button
              onClick={() => { setInviteForm({ email:'', role:'END_USER' }); setInviteSent(false); setErr(''); setModal('invite'); }}
              className={chipBtn(false)}>
              <i className="ti ti-mail text-base" />
              {t('users.invite.btn')}
            </button>
            <Btn onClick={() => { resetDirty(); setModal('create'); }}>{t('pages.users.new')}</Btn>
          </div>
        }
      />

      {/* Tab chips */}
      <div className="flex gap-1 mb-4">
        {(['active','deactivated'] as TabType[]).map(tabKey => (
          <button key={tabKey} onClick={() => handleTabChange(tabKey)}
            className={chipBtn(tab === tabKey)}>
            <i className={`ti ${tabKey === 'active' ? 'ti-users' : 'ti-user-off'} text-base`} />
            {tabKey === 'active'
              ? t('users.tabs.active', { count: users.length })
              : t('users.tabs.deactivated', { count: deactivated.length })}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative w-full sm:w-64">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-[#6B5F7A] text-sm pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('users.filter.search_placeholder')}
            className="w-full pl-8 pr-3 py-2 border border-[#DCD6EA] rounded-xl text-sm bg-[#F8F6FC] focus:outline-none focus:ring-2 focus:ring-[#B53578]/20"
          />
        </div>

        {/* Role chip dropdown */}
        <div className="relative" ref={roleDropRef}>
          <button onClick={() => setShowRoleDrop(p => !p)} className={chipBtn(!!roleFilter)}>
            <i className="ti ti-shield text-base" />
            {roleFilter ? ROLE_LABEL[roleFilter] : t('users.filter.all_roles')}
            <i className="ti ti-chevron-down text-xs" />
          </button>
          {showRoleDrop && (
            <div className="absolute left-0 top-10 z-20 bg-white border border-[#DCD6EA] rounded-xl shadow-lg py-1 min-w-[160px]">
              {(['', 'SUPER_ADMIN', 'OFFICE_ADMIN', 'STAFF', 'END_USER'] as const).map(r => (
                <button key={r} onClick={() => { setRoleFilter(r); setShowRoleDrop(false); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    roleFilter === r ? 'text-[#B53578] bg-[#FDF4F9]' : 'text-[#6B5F7A] hover:bg-[#F8F6FC]'
                  }`}>
                  {r ? ROLE_LABEL[r] : t('users.filter.all_roles')}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Card chip dropdown */}
        <div className="relative" ref={cardDropRef}>
          <button onClick={() => setShowCardDrop(p => !p)} className={chipBtn(!!cardFilter)}>
            <i className="ti ti-credit-card text-base" />
            {cardFilter === 'has' ? t('users.filter.has_card') : cardFilter === 'none' ? t('users.filter.no_card') : t('users.filter.all_cards')}
            <i className="ti ti-chevron-down text-xs" />
          </button>
          {showCardDrop && (
            <div className="absolute left-0 top-10 z-20 bg-white border border-[#DCD6EA] rounded-xl shadow-lg py-1 min-w-[160px]">
              {([
                { value: '' as const,    label: t('users.filter.all_cards') },
                { value: 'has' as const, label: t('users.filter.has_card') },
                { value: 'none' as const,label: t('users.filter.no_card') },
              ]).map(({ value, label }) => (
                <button key={value} onClick={() => { setCardFilter(value); setShowCardDrop(false); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    cardFilter === value ? 'text-[#B53578] bg-[#FDF4F9]' : 'text-[#6B5F7A] hover:bg-[#F8F6FC]'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {anyFilterActive && (
          <>
            <span className="text-xs text-[#6B5F7A]">{t('users.filter.results', { count: filtered.length })}</span>
            <button onClick={() => { setSearch(''); setRoleFilter(''); setCardFilter(''); }}
              className="text-xs text-[#B53578] hover:underline">
              {t('users.filter.clear')}
            </button>
          </>
        )}
      </div>

      {err && <div className="mb-3 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{err}</div>}

      {/* Pending invites banner */}
      {tab === 'active' && pendingInvites.length > 0 && (
        <div className="mb-4 p-3 bg-[#F8F6FC] border border-[#DCD6EA] rounded-xl text-sm text-[#6B5F7A]">
          <p className="font-semibold mb-1 flex items-center gap-2">
            <i className="ti ti-mail text-base text-[#B53578]" />
            {pendingInvites.length} {t('users.invite.pending', 'oczekujące zaproszenie(a)')}
          </p>
          <div className="space-y-1">
            {pendingInvites.map(inv => (
              <p key={inv.email} className="text-xs text-[#6B5F7A]">
                {inv.email} · {inv.role} · {t('users.invite.expires', 'wygasa')} {new Date(inv.expiresAt).toLocaleDateString()}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Active users table */}
      {tab === 'active' && (
        <Table headers={[
          t('users.table.name'), { label: t('users.table.email'), hideOnMobile: true },
          t('users.table.role'), { label: t('users.table.card'), hideOnMobile: true }, '',
        ]} empty={!filtered.length}>
          {filtered.map(u => (
            <TR key={u.id}>
              <TD>{u.firstName} {u.lastName}</TD>
              <TD mono hideOnMobile>{u.email}</TD>
              <TD><Badge color={ROLE_COLOR[u.role] ?? 'zinc'}>{ROLE_LABEL[u.role] ?? u.role}</Badge></TD>
              <TD hideOnMobile>
                {u.cardUid
                  ? <span className="font-mono text-xs text-[#6B5F7A]">{u.cardUid}</span>
                  : <span className="text-xs text-[#6B5F7A] italic">{t('users.filter.no_card')}</span>}
              </TD>
              <TD>
                <div className="flex items-center gap-1">
                  {!(u.role === 'SUPER_ADMIN' && currentUserRole === 'OFFICE_ADMIN') && (
                    <button title={t('users.actions.edit')} onClick={() => openEdit(u)} className={iconBtn}>
                      <i className="ti ti-edit text-sm" />
                    </button>
                  )}
                  <button
                    title={u.cardUid ? t('users.actions.card') : t('users.actions.add_card')}
                    onClick={() => { setTarget(u); setModal('card'); }}
                    className={iconBtn}>
                    <i className="ti ti-credit-card text-sm" />
                  </button>
                  {u.isActive && !(u.role === 'SUPER_ADMIN' && currentUserRole === 'OFFICE_ADMIN') && (
                    <div className="relative">
                      <button title={t('btn.menu', 'Menu')}
                        onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === u.id ? null : u.id); }}
                        className={iconBtn}>
                        <i className="ti ti-dots-vertical text-sm" />
                      </button>
                      {openMenuId === u.id && (
                        <div className="absolute right-0 top-8 z-20 bg-white border border-[#DCD6EA] rounded-xl shadow-lg py-1 min-w-[150px]">
                          <button
                            onClick={() => { setTarget(u); setRetDays(30); setErr(''); setModal('deactivate'); setOpenMenuId(null); }}
                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                            <i className="ti ti-user-off text-sm" />
                            {t('users.actions.deactivate')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TD>
            </TR>
          ))}
        </Table>
      )}

      {/* Deactivated users table */}
      {tab === 'deactivated' && (
        <Table headers={[
          t('users.table.name'), { label: t('users.table.email'), hideOnMobile: true },
          t('users.table.role'), { label: t('users.table.deactivated'), hideOnMobile: true },
          { label: t('users.table.remove_in'), hideOnMobile: true }, '',
        ]} empty={!filtered.length}>
          {filtered.map(u => {
            const daysLeft = u.scheduledDeleteAt
              ? Math.max(0, Math.ceil((new Date(u.scheduledDeleteAt).getTime() - Date.now()) / 86400000))
              : null;
            return (
              <TR key={u.id}>
                <TD>{u.firstName} {u.lastName}</TD>
                <TD mono hideOnMobile>{u.email}</TD>
                <TD><Badge color={ROLE_COLOR[u.role] ?? 'zinc'}>{ROLE_LABEL[u.role] ?? u.role}</Badge></TD>
                <TD hideOnMobile>{u.deletedAt ? formatDate(u.deletedAt) : '—'}</TD>
                <TD hideOnMobile>
                  {daysLeft !== null
                    ? <span className={`text-xs font-mono ${daysLeft <= 7 ? 'text-red-500' : 'text-[#6B5F7A]'}`}>
                        {t('users.days', { count: daysLeft })}
                      </span>
                    : '—'}
                </TD>
                <TD>
                  <div className="flex items-center gap-1">
                    <button title={t('users.actions.restore')} onClick={() => handleRestore(u.id)} className={iconBtn}>
                      <i className="ti ti-user-check text-sm" />
                    </button>
                    {daysLeft === 0 && (
                      <div className="relative">
                        <button title={t('btn.menu', 'Menu')}
                          onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === u.id ? null : u.id); }}
                          className={iconBtn}>
                          <i className="ti ti-dots-vertical text-sm" />
                        </button>
                        {openMenuId === u.id && (
                          <div className="absolute right-0 top-8 z-20 bg-white border border-[#DCD6EA] rounded-xl shadow-lg py-1 min-w-[150px]">
                            <button
                              onClick={() => { handleHardDelete(u.id, `${u.firstName} ${u.lastName}`); setOpenMenuId(null); }}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                              <i className="ti ti-trash text-sm" />
                              {t('users.actions.delete_data')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </TD>
              </TR>
            );
          })}
        </Table>
      )}

      {modal === 'invite' && (
        <Modal title={t('users.invite.modal_title')} onClose={() => setModal(null)}>
          {inviteSent ? (
            <div className="text-center py-4">
              <i className="ti ti-mail text-4xl text-[#B53578] mb-2 block" />
              <p className="font-semibold text-zinc-800 text-sm mb-1">{t('users.invite.sent_title')}</p>
              <p className="text-xs text-zinc-500 mb-5">{t('users.invite.sent_body', { email: inviteForm.email })}</p>
              <Btn onClick={() => setModal(null)}>{t('btn.cancel')}</Btn>
            </div>
          ) : (
            <form onSubmit={handleInvite} className="flex flex-col gap-3">
              <Input label={t('users.form.email')} type="email" required value={inviteForm.email}
                onChange={e => setInviteForm(f => ({...f, email:e.target.value}))} />
              <Select label={t('users.form.role')} value={inviteForm.role}
                onChange={e => setInviteForm(f => ({...f, role:e.target.value}))}>
                <option value="END_USER">{t('users.roles.END_USER')}</option>
                <option value="STAFF">{t('users.roles.STAFF')}</option>
                <option value="OFFICE_ADMIN">{t('users.roles.OFFICE_ADMIN')}</option>
                {currentUserRole === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">{t('users.roles.SUPER_ADMIN')}</option>}
              </Select>
              <p className="text-xs text-zinc-400">{t('users.invite.hint')}</p>
              {err && <p className="text-xs text-red-500">{err}</p>}
              <div className="flex gap-2 pt-1">
                <Btn type="submit" loading={busy} className="flex-1">{t('users.invite.send')}</Btn>
                <Btn variant="secondary" onClick={() => setModal(null)} type="button">{t('btn.cancel')}</Btn>
              </div>
            </form>
          )}
        </Modal>
      )}

      {modal === 'create' && (
        <Modal title={t('users.modals.create_title')} onClose={requestClose}>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Input label={t('users.form.firstName')} value={form.firstName} onChange={e => { setForm(f => ({...f,firstName:e.target.value})); setFieldErrors(fe => ({...fe,firstName:''})); markDirty(); }} />
                <FieldError error={fieldErrors.firstName} />
              </div>
              <Input label={t('users.form.lastName')} value={form.lastName} onChange={e => { setForm(f => ({...f,lastName:e.target.value})); markDirty(); }} />
            </div>
            <div>
              <Input label={t('users.form.email')} type="email" required value={form.email} onChange={e => { setForm(f => ({...f,email:e.target.value})); setFieldErrors(fe => ({...fe,email:''})); markDirty(); }} />
              <FieldError error={fieldErrors.email} />
            </div>
            <Input label={t('users.form.password')} type="password" required minLength={8} value={form.password} onChange={e => { setForm(f => ({...f,password:e.target.value})); markDirty(); }} />
            <Select label={t('users.form.role')} value={form.role} onChange={e => { setForm(f => ({...f,role:e.target.value})); markDirty(); }}>
              <option value="END_USER">{t('users.roles.END_USER')}</option>
              <option value="STAFF">{t('users.roles.STAFF')}</option>
              <option value="OFFICE_ADMIN">{t('users.roles.OFFICE_ADMIN')}</option>
              {currentUserRole === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">{t('users.roles.SUPER_ADMIN')}</option>}
            </Select>
            {err && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
            <div className="flex gap-2 pt-1">
              <Btn type="submit" loading={busy} className="flex-1">{t('users.actions.create')}</Btn>
              <Btn variant="secondary" onClick={requestClose} type="button">{t('btn.cancel')}</Btn>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'edit' && target && (
        <Modal title={t('users.modals.edit_title', { name: `${target.firstName} ${target.lastName}` })} onClose={requestClose}>
          <form onSubmit={handleEdit} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('users.form.firstName')} value={editForm.firstName} onChange={e => { setEditForm(f => ({...f,firstName:e.target.value})); markDirty(); }} />
              <Input label={t('users.form.lastName')} value={editForm.lastName} onChange={e => { setEditForm(f => ({...f,lastName:e.target.value})); markDirty(); }} />
            </div>
            <div>
              <Input label={t('users.form.email')} type="email" required value={editForm.email} onChange={e => { setEditForm(f => ({...f,email:e.target.value})); setFieldErrors(fe => ({...fe,email:''})); markDirty(); }} />
              <FieldError error={fieldErrors.email} />
            </div>
            <Select label={t('users.form.role')} value={editForm.role}
              disabled={target.role === 'SUPER_ADMIN' && currentUserRole === 'OFFICE_ADMIN'}
              onChange={e => { setEditForm(f => ({...f,role:e.target.value})); markDirty(); }}>
              <option value="END_USER">{t('users.roles.END_USER')}</option>
              <option value="STAFF">{t('users.roles.STAFF')}</option>
              <option value="OFFICE_ADMIN">{t('users.roles.OFFICE_ADMIN')}</option>
              {currentUserRole === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">{t('users.roles.SUPER_ADMIN')}</option>}
            </Select>
            {err && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
            <div className="flex gap-2 pt-1">
              <Btn type="submit" loading={busy} className="flex-1">{t('users.actions.save')}</Btn>
              <Btn variant="secondary" onClick={requestClose} type="button">{t('btn.cancel')}</Btn>
            </div>
          </form>
        </Modal>
      )}

      {showConfirm && <DirtyGuardDialog onConfirm={confirmClose} onCancel={cancelClose} />}

      {modal === 'card' && target && (
        <NfcCardModal user={target} onClose={() => { setModal(null); load(); }} />
      )}

      {modal === 'deactivate' && target && (
        <Modal title={t('users.modals.deactivate_title', { name: `${target.firstName} ${target.lastName}` })} onClose={() => setModal(null)}>
          <p className="text-sm text-zinc-600 mb-4">{t('users.modals.deactivate_text')}</p>
          <Input label={t('users.modals.retention_label')} type="number" min={30} value={String(retDays)}
            onChange={e => setRetDays(Math.max(30, parseInt(e.target.value) || 30))} />
          <p className="text-xs text-zinc-400 mt-1">
            {t('users.modals.will_be_anonymized_on', {
              date: new Date(Date.now() + retDays * 86400000).toLocaleDateString(locale)
            })}
          </p>
          {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
          <div className="flex gap-2 pt-4">
            <Btn variant="danger" loading={busy} onClick={handleDeactivate} className="flex-1">{t('users.actions.deactivate')}</Btn>
            <Btn variant="secondary" onClick={() => setModal(null)}>{t('btn.cancel')}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
