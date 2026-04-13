import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { NfcCardModal } from '../components/users/NfcCardModal';
import { PageHeader, Btn, Table, TR, TD, Badge, Modal, Input, Select, Spinner } from '../components/ui';

const ROLE_COLOR: Record<string,'purple'|'blue'|'zinc'|'green'> = {
  SUPER_ADMIN: 'purple', OFFICE_ADMIN: 'blue', STAFF: 'zinc', END_USER: 'green',
};
const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', OFFICE_ADMIN: 'Office Admin', STAFF: 'Staff', END_USER: 'User',
};

const ORG_ID = import.meta.env.VITE_ORG_ID ?? '';

type TabType = 'active' | 'deactivated';

export function UsersPage() {
  const { t, i18n } = useTranslation();
  const [users,       setUsers]      = useState<any[]>([]);
  const [deactivated, setDeactivated] = useState<any[]>([]);
  const [tab,         setTab]        = useState<TabType>('active');
  const [loading,     setLoading]    = useState(true);
  const [modal,       setModal]      = useState<'create'|'edit'|'card'|'deactivate'|null>(null);
  const [target,      setTarget]     = useState<any>(null);

  const [form, setForm]   = useState({ email:'', password:'', firstName:'', lastName:'', role:'END_USER' });
  const [editForm, setEditForm] = useState({ firstName:'', lastName:'', email:'', role:'END_USER' });
  const [cardUid,  setCardUid] = useState('');
  const [retDays,  setRetDays] = useState(30);
  const [busy,     setBusy]   = useState(false);
  const [err,      setErr]    = useState('');

  // FIX: read once per mount from localStorage, not via a stale module-level function
  const currentUserRole = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('app_user') ?? '{}')?.role ?? ''; } catch { return ''; }
  }, []);

  const load = async () => {
    setLoading(true);
    const [active, deleted] = await Promise.all([
      appApi.users.list(ORG_ID || undefined).catch(() => [] as any[]),
      appApi.users.listDeactivated(ORG_ID || undefined).catch(() => [] as any[]),
    ]);
    setUsers(active);
    setDeactivated(deleted);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await appApi.users.create({ ...form, organizationId: ORG_ID || undefined });
      setModal(null); setForm({ email:'',password:'',firstName:'',lastName:'',role:'END_USER' });
      await load();
    } catch(e:any) { setErr(e.message); }
    setBusy(false);
  };

  const openEdit = (u: any) => {
    setTarget(u);
    setEditForm({ firstName: u.firstName ?? '', lastName: u.lastName ?? '', email: u.email, role: u.role });
    setModal('edit');
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await appApi.users.update(target.id, editForm);
      setModal(null); await load();
    } catch(e:any) { setErr(e.message); }
    setBusy(false);
  };


  const handleDeactivate = async () => {
    setBusy(true);
    try {
      await appApi.users.deactivate(target.id, retDays);
      setModal(null); await load();
    } catch(e:any) { setErr(e.message); }
    setBusy(false);
  };

  const handleRestore = async (id: string) => {
    try { await appApi.users.restore(id); await load(); }
    catch(e:any) { alert(e.message); }
  };

  const handleHardDelete = async (id: string, name: string) => {
    if (!confirm(t('users.confirm_hard_delete', { name, defaultValue: `Permanently delete account "${name}"? Activity will be preserved.` }))) return;
    try { await appApi.users.hardDelete(id); await load(); }
    catch(e:any) { alert(e.message); }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(i18n.language?.startsWith('pl') ? 'pl-PL' : 'en-US', { day:'2-digit', month:'2-digit', year:'numeric' });

  if (loading) return <Spinner />;

  const currentList = tab === 'active' ? users : deactivated;

  return (
    <div>
      <PageHeader
        title={t('pages.users.title')}
        sub={t('users.sub', { active: users.length, deactivated: deactivated.length })}
        action={<Btn onClick={() => setModal('create')}>{t('pages.users.new')}</Btn>}
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-zinc-100 rounded-xl w-fit">
        {(['active','deactivated'] as TabType[]).map(tabType => (
          <button key={tabType} onClick={() => setTab(tabType)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === tabType ? 'bg-white shadow text-zinc-800' : 'text-zinc-400 hover:text-zinc-600'}`}>
            {tabType === 'active' ? t('users.tabs.active', { count: users.length }) : t('users.tabs.deactivated', { count: deactivated.length })}
          </button>
        ))}
      </div>

      {/* Active users table */}
      {tab === 'active' && (
        <Table headers={[t('users.table.name'), { label: t('users.table.email'), hideOnMobile: true }, t('users.table.role'), { label: t('users.table.card'), hideOnMobile: true }, { label: t('users.table.active'), hideOnMobile: true }, '']} empty={!users.length}>
          {users.map(u => (
            <TR key={u.id}>
              <TD>{u.firstName} {u.lastName}</TD>
              <TD mono hideOnMobile>{u.email}</TD>
                          <TD><Badge color={ROLE_COLOR[u.role] ?? 'zinc'}>{t(`users.roles.${u.role}`, { defaultValue: u.role })}</Badge></TD>
                  <TD hideOnMobile>
                {u.cardUid
                  ? <span className="font-mono text-xs text-zinc-500">{u.cardUid}</span>
                  : <Btn variant="ghost" size="sm" onClick={() => { setTarget(u); setCardUid(''); setModal('card'); }}>{t('users.actions.add_card')}</Btn>
                }
              </TD>
              <TD hideOnMobile>
                <span className={`text-xs font-medium ${u.isActive ? 'text-emerald-600' : 'text-zinc-400'}`}>
                  {u.isActive ? t('users.yes') : t('users.no')}
                </span>
              </TD>
              <TD>
                <div className="flex gap-1">
                  <Btn variant="ghost" size="sm" onClick={() => openEdit(u)}>{t('users.actions.edit')}</Btn>
                  {u.cardUid && (
                    <Btn variant="ghost" size="sm" onClick={() => { setTarget(u); setCardUid(u.cardUid); setModal('card'); }}>{t('users.actions.card')}</Btn>
                  )}
                  {u.isActive && (
                    <Btn variant="danger" size="sm" onClick={() => { setTarget(u); setRetDays(30); setErr(''); setModal('deactivate'); }}>
                      {t('users.actions.deactivate')}
                    </Btn>
                  )}
                </div>
              </TD>
            </TR>
          ))}
        </Table>
      )}

      {/* Deactivated users table */}
      {tab === 'deactivated' && (
        <Table headers={[t('users.table.name'), { label: t('users.table.email'), hideOnMobile: true }, t('users.table.role'), { label: t('users.table.deactivated'), hideOnMobile: true }, { label: t('users.table.remove_in'), hideOnMobile: true }, '']} empty={!deactivated.length}>
          {deactivated.map(u => {
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
                      ? <span className={`text-xs font-mono ${daysLeft <= 7 ? 'text-red-500' : 'text-zinc-500'}`}>{t('users.days', { count: daysLeft })}</span>
                      : '—'
                    }
                </TD>
                <TD>
                  <div className="flex gap-1">
                    <Btn variant="secondary" size="sm" onClick={() => handleRestore(u.id)}>{t('users.actions.restore')}</Btn>
                    {daysLeft === 0 && (
                      <Btn variant="danger" size="sm" onClick={() => handleHardDelete(u.id, `${u.firstName} ${u.lastName}`)}>
                        {t('users.actions.delete_data')}
                      </Btn>
                    )}
                  </div>
                </TD>
              </TR>
            );
          })}
        </Table>
      )}

      {/* Create modal */}
      {modal === 'create' && (
        <Modal title={t('users.modals.create_title')} onClose={() => setModal(null)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('users.form.firstName')} value={form.firstName} onChange={e => setForm(f => ({...f,firstName:e.target.value}))} />
              <Input label={t('users.form.lastName')} value={form.lastName} onChange={e => setForm(f => ({...f,lastName:e.target.value}))} />
            </div>
            <Input label={t('users.form.email')} type="email" required value={form.email} onChange={e => setForm(f => ({...f,email:e.target.value}))} />
            <Input label={t('users.form.password')} type="password" required minLength={8} value={form.password} onChange={e => setForm(f => ({...f,password:e.target.value}))} />
            <Select label={t('users.form.role')} value={form.role} onChange={e => setForm(f => ({...f,role:e.target.value}))}>
              <option value="END_USER">{t('users.roles.END_USER')}</option>
              <option value="STAFF">{t('users.roles.STAFF')}</option>
              <option value="OFFICE_ADMIN">{t('users.roles.OFFICE_ADMIN')}</option>
              {currentUserRole === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">{t('users.roles.SUPER_ADMIN')}</option>}
            </Select>
            {err && <p className="text-xs text-red-500">{err}</p>}
            <div className="flex gap-2 pt-1">
              <Btn type="submit" loading={busy} className="flex-1">{t('users.actions.create')}</Btn>
              <Btn variant="secondary" onClick={() => setModal(null)} type="button">{t('btn.cancel')}</Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit modal */}
      {modal === 'edit' && target && (
        <Modal title={t('users.modals.edit_title', { name: `${target.firstName} ${target.lastName}` })} onClose={() => setModal(null)}>
          <form onSubmit={handleEdit} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('users.form.firstName')} value={editForm.firstName} onChange={e => setEditForm(f => ({...f,firstName:e.target.value}))} />
              <Input label={t('users.form.lastName')} value={editForm.lastName} onChange={e => setEditForm(f => ({...f,lastName:e.target.value}))} />
            </div>
            <Input label={t('users.form.email')} type="email" required value={editForm.email} onChange={e => setEditForm(f => ({...f,email:e.target.value}))} />
            <Select label={t('users.form.role')} value={editForm.role} onChange={e => setEditForm(f => ({...f,role:e.target.value}))}>
              <option value="END_USER">{t('users.roles.END_USER')}</option>
              <option value="STAFF">{t('users.roles.STAFF')}</option>
              <option value="OFFICE_ADMIN">{t('users.roles.OFFICE_ADMIN')}</option>
              {currentUserRole === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">{t('users.roles.SUPER_ADMIN')}</option>}
            </Select>
            {err && <p className="text-xs text-red-500">{err}</p>}
            <div className="flex gap-2 pt-1">
              <Btn type="submit" loading={busy} className="flex-1">{t('users.actions.save')}</Btn>
              <Btn variant="secondary" onClick={() => setModal(null)} type="button">{t('btn.cancel')}</Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Card modal */}
      {modal === 'card' && target && (
        <NfcCardModal
          user={target}
          onClose={() => { setModal(null); load(); }}
        />
      )}

      {/* Deactivate modal — with retention days */}
      {modal === 'deactivate' && target && (
        <Modal title={t('users.modals.deactivate_title', { name: `${target.firstName} ${target.lastName}` })} onClose={() => setModal(null)}>
          <p className="text-sm text-zinc-600 mb-4">{t('users.modals.deactivate_text')}</p>
          <Input
            label={t('users.modals.retention_label')}
            type="number"
            min={30}
            value={String(retDays)}
            onChange={e => setRetDays(Math.max(30, parseInt(e.target.value) || 30))}
          />
          <p className="text-xs text-zinc-400 mt-1">
            {t('users.modals.will_be_anonymized_on', { date: new Date(Date.now() + retDays * 86400000).toLocaleDateString(i18n.language?.startsWith('pl') ? 'pl-PL' : 'en-US') })}
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
