import React, { useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import { Btn, Card, Modal, FormField, Badge } from '../components/ui';

export function OrganizationsPage() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', plan: 'starter' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true);
    setOrgs(await adminApi.orgs.list().catch(() => []));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true); setErr('');
    try {
      await adminApi.orgs.create(form);
      setModal(false);
      setForm({ name: '', slug: '', plan: 'starter' });
      await load();
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  const PLANS: Record<string, string> = {
    starter: 'bg-zinc-100 text-zinc-600',
    pro:     'bg-sky-100 text-sky-700',
    enterprise: 'bg-purple-100 text-purple-700',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Organizacje</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Zarządzanie klientami platformy</p>
        </div>
        <Btn onClick={() => setModal(true)}>+ Nowa organizacja</Btn>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-5 h-5 border-2 border-zinc-200 border-t-[#B53578] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {orgs.map(org => (
            <Card key={org.id} className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-xl bg-[#B53578]/10 flex items-center justify-center text-[#B53578] font-bold text-lg shrink-0">
                {org.name[0].toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-zinc-800 truncate">{org.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLANS[org.plan] ?? PLANS.starter}`}>
                    {org.plan}
                  </span>
                  {!org.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Nieaktywna</span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5 font-mono">{org.slug}</p>
              </div>

              <div className="text-right shrink-0">
                <p className="text-xs text-zinc-400">
                  {new Date(org.createdAt).toLocaleDateString('pl-PL')}
                </p>
              </div>
            </Card>
          ))}

          {orgs.length === 0 && (
            <div className="text-center py-16 text-zinc-400">
              <p className="text-3xl mb-2">🏢</p>
              <p className="text-sm">Brak organizacji</p>
            </div>
          )}
        </div>
      )}

      <Modal open={modal} title="Nowa organizacja" onClose={() => setModal(false)}>
        {err && <p className="mb-3 text-sm text-red-500 bg-red-50 p-2.5 rounded-lg">{err}</p>}
        <div className="flex flex-col gap-3">
          <FormField label="Nazwa organizacji">
            <input
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Firma sp. z o.o."
            />
          </FormField>
          <FormField label="Slug (unikalny identyfikator)">
            <input
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
              placeholder="firma-sp-zoo"
            />
          </FormField>
          <FormField label="Plan">
            <select
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
              value={form.plan}
              onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
            >
              {['starter', 'pro', 'enterprise'].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </FormField>
          <div className="flex gap-2 mt-2 justify-end">
            <Btn variant="secondary" onClick={() => setModal(false)}>Anuluj</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'Zapisywanie…' : 'Utwórz'}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
