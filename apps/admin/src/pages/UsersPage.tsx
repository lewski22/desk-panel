import React, { useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import { PageHeader, Btn, Table, TR, TD, Badge, Modal, Input, Select, Spinner } from '../components/ui';

const ROLE_COLOR: Record<string,'purple'|'blue'|'zinc'|'green'> = {
  SUPER_ADMIN: 'purple', OFFICE_ADMIN: 'blue', STAFF: 'zinc', END_USER: 'green',
};
const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', OFFICE_ADMIN: 'Office Admin', STAFF: 'Staff', END_USER: 'Użytkownik',
};

const ORG_ID = import.meta.env.VITE_ORG_ID ?? '';

export function UsersPage() {
  const [users,   setUsers]  = useState<any[]>([]);
  const [loading, setLoading]= useState(true);
  const [modal,   setModal]  = useState<'create'|'card'|null>(null);
  const [target,  setTarget] = useState<any>(null);

  const [form, setForm] = useState({ email:'', password:'', firstName:'', lastName:'', role:'END_USER' });
  const [cardUid, setCardUid] = useState('');
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');

  const load = async () => {
    setLoading(true);
    try { setUsers(await adminApi.users.list(ORG_ID || undefined)); }
    catch(e:any) { setErr(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await adminApi.users.create({ ...form, organizationId: ORG_ID || undefined });
      setModal(null); setForm({ email:'',password:'',firstName:'',lastName:'',role:'END_USER' });
      await load();
    } catch(e:any) { setErr(e.message); }
    setBusy(false);
  };

  const handleAssignCard = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await adminApi.users.assignCard(target.id, cardUid);
      setModal(null); setCardUid('');
      await load();
    } catch(e:any) { setErr(e.message); }
    setBusy(false);
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Dezaktywować konto?')) return;
    try { await adminApi.users.deactivate(id); await load(); }
    catch(e:any) { alert(e.message); }
  };

  if (loading && !users.length) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Użytkownicy"
        sub={`${users.length} kont`}
        action={<Btn onClick={() => setModal('create')}>+ Nowy użytkownik</Btn>}
      />

      <Table headers={['Imię i nazwisko', 'Email', 'Rola', 'Karta NFC', 'Aktywny', '']} empty={!users.length}>
        {users.map(u => (
          <TR key={u.id}>
            <TD>{u.firstName} {u.lastName}</TD>
            <TD mono>{u.email}</TD>
            <TD><Badge color={ROLE_COLOR[u.role] ?? 'zinc'}>{ROLE_LABEL[u.role] ?? u.role}</Badge></TD>
            <TD>
              {u.cardUid
                ? <span className="font-mono text-xs text-zinc-500">{u.cardUid}</span>
                : <Btn variant="ghost" size="sm" onClick={() => { setTarget(u); setModal('card'); }}>+ Przypisz kartę</Btn>
              }
            </TD>
            <TD>
              <span className={`text-xs font-medium ${u.isActive ? 'text-emerald-600' : 'text-zinc-400'}`}>
                {u.isActive ? 'Tak' : 'Nie'}
              </span>
            </TD>
            <TD>
              {u.isActive && (
                <div className="flex gap-1">
                  {u.cardUid && (
                    <Btn variant="secondary" size="sm"
                      onClick={() => { setTarget(u); setCardUid(u.cardUid); setModal('card'); }}>
                      Karta
                    </Btn>
                  )}
                  <Btn variant="danger" size="sm" onClick={() => handleDeactivate(u.id)}>
                    Dezaktywuj
                  </Btn>
                </div>
              )}
            </TD>
          </TR>
        ))}
      </Table>

      {modal === 'create' && (
        <Modal title="Nowy użytkownik" onClose={() => setModal(null)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Imię"     value={form.firstName} onChange={e => setForm(f => ({...f,firstName:e.target.value}))} />
              <Input label="Nazwisko" value={form.lastName}  onChange={e => setForm(f => ({...f,lastName:e.target.value}))} />
            </div>
            <Input label="Email" type="email" required
              value={form.email} onChange={e => setForm(f => ({...f,email:e.target.value}))} />
            <Input label="Hasło" type="password" required minLength={8}
              value={form.password} onChange={e => setForm(f => ({...f,password:e.target.value}))} />
            <Select label="Rola" value={form.role} onChange={e => setForm(f => ({...f,role:e.target.value}))}>
              <option value="END_USER">Użytkownik</option>
              <option value="STAFF">Staff</option>
              <option value="OFFICE_ADMIN">Office Admin</option>
            </Select>
            {err && <p className="text-xs text-red-500">{err}</p>}
            <div className="flex gap-2 pt-1">
              <Btn type="submit" loading={busy} className="flex-1">Utwórz</Btn>
              <Btn variant="secondary" onClick={() => setModal(null)} type="button">Anuluj</Btn>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'card' && target && (
        <Modal title={`Karta NFC — ${target.firstName} ${target.lastName}`} onClose={() => setModal(null)}>
          <p className="text-sm text-zinc-500 mb-4">
            Wpisz UID karty w formacie <code className="font-mono text-xs">AA:BB:CC:DD</code> lub przyłóż kartę do czytnika USB.
          </p>
          <form onSubmit={handleAssignCard} className="flex flex-col gap-3">
            <Input label="UID karty" placeholder="AA:BB:CC:DD" required
              value={cardUid} onChange={e => setCardUid(e.target.value.toUpperCase())} />
            {err && <p className="text-xs text-red-500">{err}</p>}
            <div className="flex gap-2 pt-1">
              <Btn type="submit" loading={busy} className="flex-1">Zapisz</Btn>
              <Btn variant="secondary" onClick={() => setModal(null)} type="button">Anuluj</Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
