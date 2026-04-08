import React, { useEffect, useState, useCallback } from 'react';
import { appApi } from '../api/client';
import { PageHeader, Btn, Card, Modal, Input } from '../components/ui';

// ─── Typy ────────────────────────────────────────────────────────────
interface Org {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  plan: string | null;
  notes: string | null;
  createdAt: string;
  _count?: { users: number };
}

interface Stats {
  orgs:     { total: number; active: number; inactive: number };
  gateways: { total: number; online: number; offline: number };
  beacons:  { total: number; online: number; offline: number };
  checkins: { today: number; week: number };
}

// ─── Modal: nowa firma ───────────────────────────────────────────────
function CreateOrgModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', slug: '', plan: 'basic',
    adminEmail: '', adminFirstName: '', adminLastName: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<any>(null);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  // Auto-slug z nazwy
  useEffect(() => {
    if (form.name)
      setForm(p => ({ ...p, slug: form.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') }));
  }, [form.name]);

  const submit = async () => {
    setSaving(true); setErr('');
    try {
      const r = await appApi.owner.createOrg(form);
      setResult(r);
      onCreated();
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  if (result) return (
    <Modal title="✅ Firma utworzona" onClose={onClose}>
      <div style={{ padding: '8px 0' }}>
        <p style={{ color: '#34d399', marginBottom: 12, fontWeight: 600 }}>Firma <strong>{result.org?.name}</strong> gotowa.</p>
        <p style={{ color: '#9d93b0', marginBottom: 6, fontSize: 13 }}>Konto admina:</p>
        <div style={{ background: '#111', padding: 12, borderRadius: 8, fontFamily: 'monospace', fontSize: 13 }}>
          <div>📧 {result.user?.email}</div>
          <div style={{ marginTop: 6 }}>🔑 {result.temporaryPassword}</div>
        </div>
        <p style={{ color: '#f87171', fontSize: 12, marginTop: 10 }}>⚠️ Skopiuj hasło — nie będzie widoczne ponownie.</p>
      </div>
      <div style={{ marginTop: 16 }}>
        <Btn onClick={onClose}>Zamknij</Btn>
      </div>
    </Modal>
  );

  return (
    <Modal title="Nowa firma" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Input label="Nazwa firmy *" value={form.name} onChange={f('name')} placeholder="Acme Corp" />
          <Input label="Slug (URL) *" value={form.slug} onChange={f('slug')} placeholder="acme-corp" />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Plan</label>
          <select value={form.plan} onChange={f('plan')}
            style={{ width: '100%', padding: '8px 10px', background: '#111', border: '1px solid #333', borderRadius: 6, color: '#fff', fontSize: 13 }}>
            <option value="basic">Basic</option>
            <option value="standard">Standard</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        <div style={{ borderTop: '1px solid #222', paddingTop: 12, marginTop: 4 }}>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
            Pierwsze konto SUPER_ADMIN (hasło tymczasowe wygenerowane automatycznie):
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Input label="Imię *" value={form.adminFirstName} onChange={f('adminFirstName')} placeholder="Jan" />
            <Input label="Nazwisko *" value={form.adminLastName} onChange={f('adminLastName')} placeholder="Kowalski" />
          </div>
          <div style={{ marginTop: 10 }}>
            <Input label="Email admina *" value={form.adminEmail} onChange={f('adminEmail')} placeholder="admin@firma.pl" />
          </div>
        </div>

        {err && <p style={{ color: '#f87171', fontSize: 13 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <Btn variant="secondary" onClick={onClose}>Anuluj</Btn>
          <Btn onClick={submit} loading={saving}
            disabled={!form.name || !form.slug || !form.adminEmail || !form.adminFirstName || !form.adminLastName}>
            Utwórz firmę
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal: edycja firmy ─────────────────────────────────────────────
function EditOrgModal({ org, onClose, onSaved }: { org: Org; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: org.name, plan: org.plan ?? 'basic', notes: org.notes ?? '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    setSaving(true); setErr('');
    try {
      await appApi.owner.updateOrg(org.id, form);
      onSaved();
      onClose();
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <Modal title={`Edytuj: ${org.name}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Input label="Nazwa firmy" value={form.name} onChange={f('name')} />
        <div>
          <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Plan</label>
          <select value={form.plan} onChange={f('plan')}
            style={{ width: '100%', padding: '8px 10px', background: '#111', border: '1px solid #333', borderRadius: 6, color: '#fff', fontSize: 13 }}>
            <option value="basic">Basic</option>
            <option value="standard">Standard</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Notatki</label>
          <textarea value={form.notes} onChange={f('notes')} rows={3}
            style={{ width: '100%', padding: '8px 10px', background: '#111', border: '1px solid #333', borderRadius: 6, color: '#fff', fontSize: 13, resize: 'vertical' }} />
        </div>
        {err && <p style={{ color: '#f87171', fontSize: 13 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={onClose}>Anuluj</Btn>
          <Btn onClick={submit} loading={saving}>Zapisz</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Główna strona Owner ─────────────────────────────────────────────
export function OwnerPage() {
  const [stats, setStats]       = useState<Stats | null>(null);
  const [orgs,  setOrgs]        = useState<Org[]>([]);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');

  // Modals
  const [showCreate, setShowCreate]   = useState(false);
  const [editOrg,    setEditOrg]      = useState<Org | null>(null);
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const [s, o] = await Promise.all([
        appApi.owner.getStats(),
        appApi.owner.listOrgs(),
      ]);
      setStats(s);
      setOrgs(o);
    } catch (e: any) { setErr(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleImpersonate = async (org: Org) => {
    setImpersonating(org.id);
    try {
      const r = await appApi.owner.impersonate(org.id);
      // Redirect do panelu admina z tokenem — otwiera się w nowej karcie
      const url = r.adminUrl || `${window.location.origin}/auth/impersonate?token=${r.token}`;
      window.open(url, '_blank');
    } catch (e: any) { alert(e.message); }
    setImpersonating(null);
  };

  const handleDeactivate = async (org: Org) => {
    if (!confirm(`Dezaktywować firmę "${org.name}"? Użytkownicy stracą dostęp.`)) return;
    try {
      await appApi.owner.deactivateOrg(org.id);
      load();
    } catch (e: any) { alert(e.message); }
  };

  const handleActivate = async (org: Org) => {
    try {
      await appApi.owner.updateOrg(org.id, { isActive: true });
      load();
    } catch (e: any) { alert(e.message); }
  };

  const filtered = orgs.filter(o => {
    const matchSearch = !search || o.name.toLowerCase().includes(search.toLowerCase()) || o.slug.includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'active' ? o.isActive : !o.isActive);
    return matchSearch && matchFilter;
  });

  const planBadge = (plan: string | null) => {
    const colors: Record<string, string> = { basic: '#60a5fa', standard: '#a78bfa', enterprise: '#fbbf24' };
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
        padding: '2px 7px', borderRadius: 3,
        background: `${colors[plan ?? 'basic'] ?? '#6b7280'}22`,
        color: colors[plan ?? 'basic'] ?? '#6b7280'
      }}>{plan ?? 'basic'}</span>
    );
  };

  return (
    <div>
      <PageHeader
        title="Panel Operatora"
        subtitle="Zarządzanie firmami i infrastrukturą platformy Reserti"
        actions={<Btn onClick={() => setShowCreate(true)}>+ Nowa firma</Btn>}
      />

      {err && <div style={{ color: '#f87171', marginBottom: 16, fontSize: 13 }}>{err}</div>}

      {/* ── Statystyki platformy ─────────────────────────────── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Firmy aktywne',   val: stats.orgs.active,    total: stats.orgs.total,    icon: '🏢', color: '#60a5fa' },
            { label: 'Gateway online',  val: stats.gateways.online, total: stats.gateways.total, icon: '📡', color: '#34d399' },
            { label: 'Beacony online',  val: stats.beacons.online,  total: stats.beacons.total,  icon: '🔵', color: '#a78bfa' },
            { label: 'Check-iny dziś',  val: stats.checkins.today,  total: stats.checkins.week,  icon: '✅', color: '#fbbf24', sub: `${stats.checkins.week} w tygodniu` },
          ].map(({ label, val, total, icon, color, sub }) => (
            <Card key={label} style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: 'system-ui', marginTop: 4 }}>{val}</div>
                  <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>
                    {sub ?? `z ${total} łącznie`}
                  </div>
                </div>
                <span style={{ fontSize: 24 }}>{icon}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Filtry ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Szukaj firmy..."
          style={{ padding: '7px 12px', background: '#111', border: '1px solid #333', borderRadius: 6, color: '#fff', fontSize: 13, minWidth: 220 }}
        />
        {(['all', 'active', 'inactive'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: filter === f ? '#B03472' : '#1a1a2e', color: filter === f ? '#fff' : '#6b7280'
            }}>
            {f === 'all' ? 'Wszystkie' : f === 'active' ? 'Aktywne' : 'Nieaktywne'}
            {' '}
            <span style={{ opacity: .7 }}>
              ({f === 'all' ? orgs.length : f === 'active' ? orgs.filter(o => o.isActive).length : orgs.filter(o => !o.isActive).length})
            </span>
          </button>
        ))}
        <button onClick={load}
          style={{ padding: '6px 12px', borderRadius: 5, border: '1px solid #333', cursor: 'pointer', fontSize: 12, background: '#111', color: '#6b7280' }}>
          ↺ Odśwież
        </button>
      </div>

      {/* ── Tabela firm ─────────────────────────────────────── */}
      {loading ? (
        <div style={{ color: '#6b7280', padding: 32, textAlign: 'center' }}>Ładowanie...</div>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1f1f2e' }}>
                {['Firma', 'Slug', 'Plan', 'Użytkownicy', 'Status', 'Data', 'Akcje'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '32px 14px', textAlign: 'center', color: '#4b5563', fontSize: 13 }}>Brak firm</td></tr>
              )}
              {filtered.map((org, i) => (
                <tr key={org.id} style={{
                  borderBottom: '1px solid #111',
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                  opacity: org.isActive ? 1 : 0.5,
                }}>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>{org.name}</div>
                    {org.notes && <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>{org.notes}</div>}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <code style={{ fontSize: 11, color: '#6b7280', background: '#111', padding: '2px 6px', borderRadius: 3 }}>{org.slug}</code>
                  </td>
                  <td style={{ padding: '11px 14px' }}>{planBadge(org.plan)}</td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: '#9d93b0' }}>
                    {org._count?.users ?? '—'}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
                      padding: '2px 7px', borderRadius: 3,
                      background: org.isActive ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.12)',
                      color: org.isActive ? '#34d399' : '#f87171'
                    }}>{org.isActive ? 'aktywna' : 'nieaktywna'}</span>
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#4b5563' }}>
                    {new Date(org.createdAt).toLocaleDateString('pl-PL')}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Btn size="sm" onClick={() => handleImpersonate(org)}
                        loading={impersonating === org.id} title="Wejdź jako admin tej firmy">
                        🔑 Wejdź
                      </Btn>
                      <Btn size="sm" variant="secondary" onClick={() => setEditOrg(org)}>
                        Edytuj
                      </Btn>
                      {org.isActive
                        ? <Btn size="sm" variant="danger" onClick={() => handleDeactivate(org)}>Deaktywuj</Btn>
                        : <Btn size="sm" variant="secondary" onClick={() => handleActivate(org)}>Aktywuj</Btn>
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── Modals ──────────────────────────────────────────── */}
      {showCreate && <CreateOrgModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {editOrg    && <EditOrgModal   org={editOrg} onClose={() => setEditOrg(null)} onSaved={load} />}
    </div>
  );
}
