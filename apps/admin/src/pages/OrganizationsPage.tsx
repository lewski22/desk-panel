import React, { useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import { PageHeader, Btn, Card, Modal, Input, Select, Badge } from '../components/ui';

const PLAN_COLOR: Record<string, string> = {
  starter:    'bg-zinc-100 text-zinc-600',
  pro:        'bg-sky-100 text-sky-700',
  enterprise: 'bg-purple-100 text-purple-700',
};
const PLAN_LABELS = ['starter', 'pro', 'enterprise'];

export function OrganizationsPage() {
  const [orgs,    setOrgs]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]  = useState<'create'|'edit'|null>(null);
  const [target,  setTarget] = useState<any>(null);
  const [form,    setForm]   = useState({ name: '', slug: '', plan: 'starter' });
  const [saving,  setSaving] = useState(false);
  const [err,     setErr]    = useState('');

  const load = async () => {
    setLoading(true);
    setOrgs(await adminApi.orgs.list().catch(() => []));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openEdit = (org: any) => {
    setTarget(org);
    setForm({ name: org.name, slug: org.slug, plan: org.plan ?? 'starter' });
    setModal('edit');
  };

  const save = async () => {
    setSaving(true); setErr('');
    try {
      if (modal === 'create') {
        await adminApi.orgs.create(form);
      } else if (target) {
        await adminApi.orgs.update(target.id, form);
      }
      setModal(null);
      setForm({ name: '', slug: '', plan: 'starter' });
      await load();
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <div>
      <PageHeader
        title="Biura"
        sub="Zarządzanie biurami platformy"
        action={
          <Btn onClick={() => { setForm({ name:'', slug:'', plan:'starter' }); setErr(''); setModal('create'); }}>
            + Nowe biuro
          </Btn>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-5 h-5 border-2 border-zinc-200 border-t-[#B53578] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {orgs.map(org => (
            <Card key={org.id} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#B53578]/10 flex items-center justify-center text-[#B53578] font-bold text-lg shrink-0">
                {org.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-zinc-800 truncate">{org.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLOR[org.plan] ?? PLAN_COLOR.starter}`}>
                    {org.plan}
                  </span>
                  {!org.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Nieaktywne</span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5 font-mono">{org.slug}</p>
              </div>
              <div className="text-right shrink-0 flex items-center gap-3">
                <p className="text-xs text-zinc-400">
                  {new Date(org.createdAt).toLocaleDateString('pl-PL')}
                </p>
                <Btn variant="ghost" size="sm" onClick={() => openEdit(org)}>Edytuj</Btn>
              </div>
            </Card>
          ))}
          {orgs.length === 0 && (
            <div className="text-center py-16 text-zinc-400">
              <p className="text-3xl mb-2">🏢</p>
              <p className="text-sm">Brak biur</p>
            </div>
          )}
        </div>
      )}

      <Modal
        open={modal !== null}
        title={modal === 'create' ? 'Nowe biuro' : `Edytuj: ${target?.name}`}
        onClose={() => setModal(null)}
      >
        {err && <p className="mb-3 text-sm text-red-500 bg-red-50 p-2.5 rounded-lg">{err}</p>}
        <div className="flex flex-col gap-3">
          <Input
            label="Nazwa biura"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Warszawa HQ"
          />
          <Input
            label="Slug (unikalny identyfikator)"
            value={form.slug}
            onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
            placeholder="warszawa-hq"
          />
          <Select
            label="Plan"
            value={form.plan}
            onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
          >
            {PLAN_LABELS.map(p => <option key={p} value={p}>{p}</option>)}
          </Select>
          <div className="flex gap-2 mt-2 justify-end">
            <Btn variant="secondary" onClick={() => setModal(null)}>Anuluj</Btn>
            <Btn onClick={save} loading={saving}>
              {modal === 'create' ? 'Utwórz' : 'Zapisz'}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
