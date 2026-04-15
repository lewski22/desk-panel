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
    <Modal title="✅ Firma utworzona" onClose={onClose}>
      <p className="text-green-600 font-semibold mb-3">Firma <strong>{result.org?.name}</strong> gotowa.</p>
      <p className="text-xs text-zinc-500 mb-2">Konto admina:</p>
      <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 font-mono text-sm space-y-1">
        <div>📧 {result.user?.email}</div>
        <div>🔑 {result.temporaryPassword}</div>
      </div>
      <p className="text-xs text-red-500 mt-2">⚠️ Skopiuj hasło — nie będzie widoczne ponownie.</p>
      <div className="mt-4"><Btn onClick={onClose}>{t('btn.cancel')}</Btn></div>
    </Modal>
  );

  return (
    <Modal title="Nowa firma" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nazwa firmy *" value={name} onChange={e => setName(e.target.value)} placeholder="Acme Corp" />
          <Input label="Slug (URL) *" value={slug} onChange={e => setSlug(e.target.value)} placeholder="acme-corp" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1 font-medium">Plan</label>
          <select value={plan} onChange={e => setPlan(e.target.value)}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="basic">Basic</option>
            <option value="standard">Standard</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <p className="text-xs text-zinc-400 pt-1 border-t border-zinc-100">Konto SUPER_ADMIN (hasło tymczasowe):</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Imię *" value={firstName} onChange={e => setFirst(e.target.value)} placeholder="Jan" />
          <Input label="Nazwisko *" value={lastName} onChange={e => setLast(e.target.value)} placeholder="Kowalski" />
        </div>
        <Input label="Email admina *" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@firma.pl" />
        {err && <p className="text-sm text-red-500">{err}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Btn variant="secondary" onClick={onClose}>{t('btn.cancel')}</Btn>
          <Btn onClick={submit} loading={saving}
            disabled={!name || !slug || !email || !firstName || !lastName}>
            Utwórz firmę
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
    <Modal title={`Edytuj: ${org.name}`} onClose={onClose}>
      <div className="space-y-3">
        <Input label="Nazwa firmy" value={name} onChange={e => setName(e.target.value)} />
        <div>
          <label className="block text-xs text-zinc-500 mb-1 font-medium">Plan</label>
          <select value={plan} onChange={e => setPlan(e.target.value)}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="basic">Basic</option>
            <option value="standard">Standard</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1 font-medium">Notatki</label>
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
      setErr(e.message || t('qr.no_connection'));
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
    } catch (e: any) { setErr(e.message); }
    setImpersonating(null);
  };

  const handleDeactivate = async (org: any) => {
    if (!confirm(`Dezaktywować firmę "${org.name}"?`)) return;
    try { await appApi.owner.deactivateOrg(org.id); load(); }
    catch (e: any) { setErr(e.message); }
  };

  const handleActivate = async (org: any) => {
    try { await appApi.owner.updateOrg(org.id, { isActive: true }); load(); }
    catch (e: any) { setErr(e.message); }
  };

  // stats z API: { orgsTotal, orgsActive, orgsInactive, gatewaysTotal, gatewaysOnline, beaconsTotal, beaconsOnline, checkinsToday, checkinsWeek }
  const statCards = stats ? [
    { label: t('pages.organizations.title'),   val: stats.orgsActive,     sub: `${stats.orgsTotal}`,              icon: '🏢' },
    { label: t('provisioning.gateways_title'),  val: stats.gatewaysOnline,  sub: `${stats.gatewaysTotal}`,           icon: '📡' },
    { label: t('provisioning.beacons_title'),  val: stats.beaconsOnline,   sub: `${stats.beaconsTotal}`,            icon: '🔵' },
    { label: t('dashboard.kpi.checkins_today'),  val: stats.checkinsToday,   sub: `${stats.checkinsWeek}`,         icon: '✅' },
  ] : [];

  const filtered = orgs.filter(o =>
    !search || o.name?.toLowerCase().includes(search.toLowerCase()) || o.slug?.includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Panel Operatora"
        subtitle="Zarządzanie firmami i infrastrukturą platformy Reserti"
        action={<Btn onClick={() => setShowCreate(true)}>+ Nowa firma</Btn>}
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
          placeholder="Szukaj firmy..."
          className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none min-w-[200px]"
        />
        <button onClick={load}
          className="text-xs px-3 py-1.5 border border-zinc-200 rounded-lg text-zinc-500 hover:bg-zinc-50">
          ↺ Odśwież
        </button>
        <span className="text-xs text-zinc-400 ml-auto">{filtered.length} firm</span>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-zinc-400 text-sm">{t('btn.saving').replace('…','')}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-zinc-400 text-sm">
            {err ? t('qr.error_title') : t('organizations.no_locations')}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                {[t('organizations.label_office'), 'Slug', 'Plan', t('users.table.name'), t('desks.col.status'), t('desks.col.actions')].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">{h}</th>
                ))}
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
                      {org.isActive ? 'aktywna' : 'nieaktywna'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      <Btn size="sm" onClick={() => handleImpersonate(org)}
                        loading={impersonating === org.id}>
                        🔑 Wejdź
                      </Btn>
                      <Btn size="sm" variant="secondary" onClick={() => setEditOrg(org)}>{t('users.actions.edit')}</Btn>
                      {org.isActive
                        ? <Btn size="sm" variant="danger" onClick={() => handleDeactivate(org)}>{t('desks.actions_extra.deactivate')}</Btn>
                        : <Btn size="sm" variant="secondary" onClick={() => handleActivate(org)}>{t('desks.actions.activate')}</Btn>
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
