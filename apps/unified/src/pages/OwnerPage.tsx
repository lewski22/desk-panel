import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi } from '../api/client';
import { PageHeader, Btn, Modal, Input } from '../components/ui';

// ─── Modal: nowa firma ────────────────────────────────────────
function CreateOrgModal({ onClose, onCreated }: { onClose(): void; onCreated(): void }) {
  const { t } = useTranslation();
  const [name, setName]         = useState('');
  const [slug, setSlug]         = useState('');
  const [plan, setPlan]         = useState('basic');
  const [email, setEmail]       = useState('');
  const [firstName, setFirst]   = useState('');
  const [lastName,  setLast]    = useState('');
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');
  const [result, setResult]     = useState<any>(null);

  // Auto-slug z nazwy
  useEffect(() => {
    if (name) setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  }, [name]);

  const submit = async () => {
    setSaving(true); setErr('');
    try {
      const r = await appApi.owner.createOrg({ name, slug, plan, adminEmail: email, adminFirstName: firstName, adminLastName: lastName });
      setResult(r);
      onCreated();
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  if (result) return (
    <Modal title={t('owner.create_done_title')} onClose={onClose}>
      <p className="text-green-600 font-semibold mb-3">{t('owner.create_done_msg', { name: result.org?.name })}</p>
      <p className="text-xs text-zinc-500 mb-2">{t('owner.admin_account')}</p>
      <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 font-mono text-sm space-y-1">
        <div>📧 {result.user?.email}</div>
        <div>🔑 {result.temporaryPassword}</div>
      </div>
      <p className="text-xs text-red-500 mt-2">{t('owner.copy_password_warning')}</p>
      <div className="mt-4"><Btn onClick={onClose}>{t('btn.cancel')}</Btn></div>
    </Modal>
  );

  return (
    <Modal title={t('owner.create_title')} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('owner.form.name')} value={name} onChange={e => setName(e.target.value)} placeholder="Acme Corp" />
          <Input label={t('owner.form.slug')} value={slug} onChange={e => setSlug(e.target.value)} placeholder="acme-corp" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1 font-medium">{t('owner.form.plan')}</label>
          <select value={plan} onChange={e => setPlan(e.target.value)}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="basic">Basic</option>
            <option value="standard">Standard</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <p className="text-xs text-zinc-400 pt-1 border-t border-zinc-100">{t('owner.create_hint')}</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('owner.form.firstName')} value={firstName} onChange={e => setFirst(e.target.value)} placeholder="Jan" />
          <Input label={t('owner.form.lastName')} value={lastName} onChange={e => setLast(e.target.value)} placeholder="Kowalski" />
        </div>
        <Input label={t('owner.form.email')} value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@firma.pl" />
        {err && <p className="text-sm text-red-500">{err}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Btn variant="secondary" onClick={onClose}>{t('btn.cancel')}</Btn>
          <Btn onClick={submit} loading={saving}
            disabled={!name || !slug || !email || !firstName || !lastName}>
            {t('owner.create_action')}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal: edycja firmy ──────────────────────────────────────
function EditOrgModal({ org, onClose, onSaved }: { org: any; onClose(): void; onSaved(): void }) {
  const { t } = useTranslation();
  const [name,  setName]  = useState(org.name);
  const [plan,  setPlan]  = useState(org.plan ?? 'basic');
  const [notes, setNotes] = useState(org.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setSaving(true); setErr('');
    try {
      await appApi.owner.updateOrg(org.id, { name, plan, notes });
      onSaved(); onClose();
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <Modal title={t('owner.edit_title', { name: org.name })} onClose={onClose}>
      <div className="space-y-3">
        <Input label={t('owner.form.name')} value={name} onChange={e => setName(e.target.value)} />
        <div>
          <label className="block text-xs text-zinc-500 mb-1 font-medium">{t('owner.form.plan')}</label>
          <select value={plan} onChange={e => setPlan(e.target.value)}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="basic">Basic</option>
            <option value="standard">Standard</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1 font-medium">{t('owner.form.notes')}</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none" />
        </div>
        {err && <p className="text-sm text-red-500">{err}</p>}
        <div className="flex gap-2 justify-end">
          <Btn variant="secondary" onClick={onClose}>{t('btn.cancel')}</Btn>
          <Btn onClick={submit} loading={saving}>{t('btn.save')}</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Główna strona ────────────────────────────────────────────
export function OwnerPage() {
  const { t } = useTranslation();
  const [stats, setStats]     = useState<any>(null);
  const [orgs,  setOrgs]      = useState<any[]>([]);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editOrg, setEditOrg]       = useState<any>(null);
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const [s, o] = await Promise.all([
        appApi.owner.getStats(),
        appApi.owner.listOrgs(),
      ]);
      setStats(s);
      setOrgs(Array.isArray(o) ? o : []);
    } catch (e: any) {
      setErr(e.message || t('owner.api_error'));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleImpersonate = async (org: any) => {
    setImpersonating(org.id);
    try {
      const r = await appApi.owner.impersonate(org.id);
      const url = r.adminUrl || `${window.location.origin}/auth/impersonate?token=${r.token}`;
      window.open(url, '_blank');
    } catch (e: any) { alert(e.message || t('owner.impersonate_failed')); }
    setImpersonating(null);
  };

  const handleDeactivate = async (org: any) => {
    if (!confirm(t('owner.confirm_deactivate', { name: org.name }))) return;
    try { await appApi.owner.deactivateOrg(org.id); load(); }
    catch (e: any) { alert(e.message || t('owner.deactivate_failed')); }
  };

  const handleActivate = async (org: any) => {
    try { await appApi.owner.updateOrg(org.id, { isActive: true }); load(); }
    catch (e: any) { alert(e.message || t('owner.activate_failed')); }
  };

  // stats z API: { orgsTotal, orgsActive, orgsInactive, gatewaysTotal, gatewaysOnline, beaconsTotal, beaconsOnline, checkinsToday, checkinsWeek }
  const statCards = stats ? [
    { label: t('owner.stats.active'),   val: stats.orgsActive,     sub: t('owner.stats.total', { total: stats.orgsTotal }),              icon: '🏢' },
    { label: t('owner.stats.gateways_online'),  val: stats.gatewaysOnline,  sub: t('owner.stats.total', { total: stats.gatewaysTotal }),           icon: '📡' },
    { label: t('owner.stats.beacons_online'),  val: stats.beaconsOnline,   sub: t('owner.stats.total', { total: stats.beaconsTotal }),            icon: '🔵' },
    { label: t('owner.stats.checkins_today'),  val: stats.checkinsToday,   sub: t('owner.stats.week_count', { count: stats.checkinsWeek }),         icon: '✅' },
  ] : [];

  const filtered = orgs.filter(o =>
    !search || o.name?.toLowerCase().includes(search.toLowerCase()) || o.slug?.includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title={t('pages.owner.title')}
        subtitle={t('owner.subtitle')}
        action={<Btn onClick={() => setShowCreate(true)}>{t('owner.new_org')}</Btn>}
      />

      {err && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {err}
        </div>
      )}

      {/* Statystyki platformy */}
      {statCards.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {statCards.map(({ label, val, sub, icon }) => (
            <div key={label} className="bg-white border border-zinc-100 rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">{label}</p>
                  <p className="text-2xl font-bold text-zinc-800 mt-1">{val ?? '—'}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>
                </div>
                <span className="text-2xl">{icon}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtry */}
      <div className="flex gap-2 mb-4 items-center">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('owner.search_placeholder')}
          className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none min-w-[200px]"
        />
        <button onClick={load}
          className="text-xs px-3 py-1.5 border border-zinc-200 rounded-lg text-zinc-500 hover:bg-zinc-50">
          {t('btn.refresh')}
        </button>
        <span className="text-xs text-zinc-400 ml-auto">{t('owner.count', { count: filtered.length })}</span>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-zinc-400 text-sm">{t('owner.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-zinc-400 text-sm">
            {err ? t('owner.load_error') : t('owner.no_orgs')}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">{t('owner.table.name')}</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">{t('owner.table.slug')}</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">{t('owner.table.plan')}</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">{t('owner.table.users')}</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">{t('owner.table.status')}</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">{t('owner.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((org, i) => (
                <tr key={org.id} className={`border-b border-zinc-50 ${i % 2 === 1 ? 'bg-zinc-50/50' : ''} ${!org.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-800 text-sm">{org.name}</div>
                    {org.notes && <div className="text-xs text-zinc-400 mt-0.5 truncate max-w-[200px]">{org.notes}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">{org.slug}</code>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      org.plan === 'enterprise' ? 'bg-yellow-100 text-yellow-700' :
                      org.plan === 'standard'   ? 'bg-purple-100 text-purple-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>{org.plan ?? 'basic'}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {org.usersCount ?? org._count?.users ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${org.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {org.isActive ? t('owner.status.active') : t('owner.status.inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      <Btn size="sm" onClick={() => handleImpersonate(org)}
                        loading={impersonating === org.id}>
                        {t('owner.actions.impersonate')}
                      </Btn>
                      <Btn size="sm" variant="secondary" onClick={() => setEditOrg(org)}>{t('owner.actions.edit')}</Btn>
                      {org.isActive
                        ? <Btn size="sm" variant="danger" onClick={() => handleDeactivate(org)}>{t('owner.actions.deactivate')}</Btn>
                        : <Btn size="sm" variant="secondary" onClick={() => handleActivate(org)}>{t('owner.actions.activate')}</Btn>
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreateOrgModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {editOrg    && <EditOrgModal org={editOrg} onClose={() => setEditOrg(null)} onSaved={load} />}
    </div>
  );
}
