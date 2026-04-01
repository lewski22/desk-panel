import React, { useEffect, useState, useMemo } from 'react';
import { appApi } from '../api/client';
import { PageHeader, Btn, Table, TR, TD, Badge, Modal, Input, Select, Spinner } from '../components/ui';

const ROLE_COLOR: Record<string,'purple'|'blue'|'zinc'|'green'> = {
  SUPER_ADMIN: 'purple', OFFICE_ADMIN: 'blue', STAFF: 'zinc', END_USER: 'green',
};
const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', OFFICE_ADMIN: 'Office Admin', STAFF: 'Staff', END_USER: 'Użytkownik',
};

const ORG_ID = import.meta.env.VITE_ORG_ID ?? '';

type TabType = 'active' | 'deactivated';

export function UsersPage() {
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

  const handleAssignCard = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await appApi.users.assignCard(target.id, cardUid);
      setModal(null); setCardUid(''); await load();
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
    if (!confirm(`Trwale usunąć dane konta "${name}"? Aktywności zostaną zachowane.`)) return;
    try { await appApi.users.hardDelete(id); await load(); }
    catch(e:any) { alert(e.message); }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pl-PL', { day:'2-digit', month:'2-digit', year:'numeric' });

  if (loading) return <Spinner />;

  const currentList = tab === 'active' ? users : deactivated;

  return (
    <div>
      <PageHeader
        title="Użytkownicy"
        sub={`${users.length} aktywnych · ${deactivated.length} dezaktywowanych`}
        action={<Btn onClick={() => setModal('create')}>+ Nowy użytkownik</Btn>}
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-zinc-100 rounded-xl w-fit">
        {(['active','deactivated'] as TabType[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white shadow text-zinc-800' : 'text-zinc-400 hover:text-zinc-600'}`}>
            {t === 'active' ? `Aktywni (${users.length})` : `Dezaktywowani (${deactivated.length})`}
          </button>
        ))}
      </div>

      {/* Active users table */}
      {tab === 'active' && (
        <Table headers={['Imię i nazwisko','Email','Rola','Karta NFC','Aktywny','']} empty={!users.length}>
          {users.map(u => (
            <TR key={u.id}>
              <TD>{u.firstName} {u.lastName}</TD>
              <TD mono>{u.email}</TD>
              <TD><Badge color={ROLE_COLOR[u.role] ?? 'zinc'}>{ROLE_LABEL[u.role] ?? u.role}</Badge></TD>
              <TD>
                {u.cardUid
                  ? <span className="font-mono text-xs text-zinc-500">{u.cardUid}</span>
                  : <Btn variant="ghost" size="sm" onClick={() => { setTarget(u); setCardUid(''); setModal('card'); }}>+ Karta</Btn>
                }
              </TD>
              <TD>
                <span className={`text-xs font-medium ${u.isActive ? 'text-emerald-600' : 'text-zinc-400'}`}>
                  {u.isActive ? 'Tak' : 'Nie'}
                </span>
              </TD>
              <TD>
                <div className="flex gap-1">
                  <Btn variant="ghost" size="sm" onClick={() => openEdit(u)}>Edytuj</Btn>
                  {u.cardUid && (
                    <Btn variant="ghost" size="sm" onClick={() => { setTarget(u); setCardUid(u.cardUid); setModal('card'); }}>Karta</Btn>
                  )}
                  {u.isActive && (
                    <Btn variant="danger" size="sm" onClick={() => { setTarget(u); setRetDays(30); setErr(''); setModal('deactivate'); }}>
                      Dezaktywuj
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
        <Table headers={['Imię i nazwisko','Email','Rola','Dezaktywowany','Usunięcie za','']} empty={!deactivated.length}>
          {deactivated.map(u => {
            const daysLeft = u.scheduledDeleteAt
              ? Math.max(0, Math.ceil((new Date(u.scheduledDeleteAt).getTime() - Date.now()) / 86400000))
              : null;
            return (
              <TR key={u.id}>
                <TD>{u.firstName} {u.lastName}</TD>
                <TD mono>{u.email}</TD>
                <TD><Badge color={ROLE_COLOR[u.role] ?? 'zinc'}>{ROLE_LABEL[u.role] ?? u.role}</Badge></TD>
                <TD>{u.deletedAt ? formatDate(u.deletedAt) : '—'}</TD>
                <TD>
                  {daysLeft !== null
                    ? <span className={`text-xs font-mono ${daysLeft <= 7 ? 'text-red-500' : 'text-zinc-500'}`}>{daysLeft} dni</span>
                    : '—'
                  }
                </TD>
                <TD>
                  <div className="flex gap-1">
                    <Btn variant="secondary" size="sm" onClick={() => handleRestore(u.id)}>Przywróć</Btn>
                    {daysLeft === 0 && (
                      <Btn variant="danger" size="sm" onClick={() => handleHardDelete(u.id, `${u.firstName} ${u.lastName}`)}>
                        Usuń dane
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
        <Modal title="Nowy użytkownik" onClose={() => setModal(null)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Imię" value={form.firstName} onChange={e => setForm(f => ({...f,firstName:e.target.value}))} />
              <Input label="Nazwisko" value={form.lastName} onChange={e => setForm(f => ({...f,lastName:e.target.value}))} />
            </div>
            <Input label="Email" type="email" required value={form.email} onChange={e => setForm(f => ({...f,email:e.target.value}))} />
            <Input label="Hasło" type="password" required minLength={8} value={form.password} onChange={e => setForm(f => ({...f,password:e.target.value}))} />
            <Select label="Rola" value={form.role} onChange={e => setForm(f => ({...f,role:e.target.value}))}>
              <option value="END_USER">Użytkownik</option>
              <option value="STAFF">Staff</option>
              <option value="OFFICE_ADMIN">Office Admin</option>
              {currentUserRole === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">Super Admin</option>}
            </Select>
            {err && <p className="text-xs text-red-500">{err}</p>}
            <div className="flex gap-2 pt-1">
              <Btn type="submit" loading={busy} className="flex-1">Utwórz</Btn>
              <Btn variant="secondary" onClick={() => setModal(null)} type="button">Anuluj</Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit modal */}
      {modal === 'edit' && target && (
        <Modal title={`Edytuj: ${target.firstName} ${target.lastName}`} onClose={() => setModal(null)}>
          <form onSubmit={handleEdit} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Imię" value={editForm.firstName} onChange={e => setEditForm(f => ({...f,firstName:e.target.value}))} />
              <Input label="Nazwisko" value={editForm.lastName} onChange={e => setEditForm(f => ({...f,lastName:e.target.value}))} />
            </div>
            <Input label="Email" type="email" required value={editForm.email} onChange={e => setEditForm(f => ({...f,email:e.target.value}))} />
            <Select label="Rola" value={editForm.role} onChange={e => setEditForm(f => ({...f,role:e.target.value}))}>
              <option value="END_USER">Użytkownik</option>
              <option value="STAFF">Staff</option>
              <option value="OFFICE_ADMIN">Office Admin</option>
              {currentUserRole === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">Super Admin</option>}
            </Select>
            {err && <p className="text-xs text-red-500">{err}</p>}
            <div className="flex gap-2 pt-1">
              <Btn type="submit" loading={busy} className="flex-1">Zapisz</Btn>
              <Btn variant="secondary" onClick={() => setModal(null)} type="button">Anuluj</Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Card modal */}
      {modal === 'card' && target && (
        <Modal title={`Karta NFC — ${target.firstName} ${target.lastName}`} onClose={() => setModal(null)}>
          <form onSubmit={handleAssignCard} className="flex flex-col gap-3">
            <Input label="UID karty (format AA:BB:CC:DD)" placeholder="AA:BB:CC:DD" required
              value={cardUid} onChange={e => setCardUid(e.target.value.toUpperCase())} />
            {err && <p className="text-xs text-red-500">{err}</p>}
            <div className="flex gap-2 pt-1">
              <Btn type="submit" loading={busy} className="flex-1">Zapisz</Btn>
              <Btn variant="secondary" onClick={() => setModal(null)} type="button">Anuluj</Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Deactivate modal — with retention days */}
      {modal === 'deactivate' && target && (
        <Modal title={`Dezaktywuj: ${target.firstName} ${target.lastName}`} onClose={() => setModal(null)}>
          <p className="text-sm text-zinc-600 mb-4">
            Konto zostanie dezaktywowane. Po upływie okresu retencji dane osobowe zostaną anonimizowane,
            jednak wszystkie aktywności (rezerwacje, check-iny) pozostaną zachowane z zachowaną nazwą konta.
          </p>
          <Input
            label="Okres retencji (minimum 30 dni)"
            type="number"
            min={30}
            value={String(retDays)}
            onChange={e => setRetDays(Math.max(30, parseInt(e.target.value) || 30))}
          />
          <p className="text-xs text-zinc-400 mt-1">
            Konto zostanie trwale zanonimizowane: {new Date(Date.now() + retDays * 86400000).toLocaleDateString('pl-PL')}
          </p>
          {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
          <div className="flex gap-2 pt-4">
            <Btn variant="danger" loading={busy} onClick={handleDeactivate} className="flex-1">Dezaktywuj</Btn>
            <Btn variant="secondary" onClick={() => setModal(null)}>Anuluj</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
