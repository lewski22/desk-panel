import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ownerApi } from '../api/client';
import { Btn, Card, Badge, StatusDot, PlanBadge, Spinner, Modal, Input } from '../components/ui';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">{title}</h2>
      {children}
    </div>
  );
}

function gwStatus(gw: any): 'healthy' | 'stale' | 'offline' {
  if (!gw.isOnline) return 'offline';
  if (!gw.lastSeen) return 'offline';
  return (Date.now() - new Date(gw.lastSeen).getTime()) / 60000 > 5 ? 'stale' : 'healthy';
}

export function ClientDetailPage() {
  const { id }      = useParams<{ id: string }>();
  const navigate    = useNavigate();
  const [org,       setOrg]       = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [busy,      setBusy]      = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [form,      setForm]      = useState<any>({});
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState('');

  const load = async () => {
    setLoading(true);
    try { setOrg(await ownerApi.organizations.get(id!)); }
    catch (e: any) { setErr(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const openEdit = () => {
    setForm({
      plan:         org.plan,
      contactEmail: org.contactEmail ?? '',
      notes:        org.notes ?? '',
    });
    setEditModal(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await ownerApi.organizations.update(id!, form);
      await load();
      setEditModal(false);
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  };

  const impersonate = async () => {
    setBusy(true);
    try {
      const { adminUrl, orgName } = await ownerApi.organizations.impersonate(id!);
      localStorage.setItem('owner_impersonating', JSON.stringify({ orgId: id, orgName }));
      window.open(adminUrl, '_blank');
    } catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (err || !org) return <div className="p-4 text-red-500">{err || 'Nie znaleziono'}</div>;

  const allGateways = org.locations.flatMap((l: any) => l.gateways.map((g: any) => ({ ...g, locationName: l.name })));
  const allBeacons  = org.locations.flatMap((l: any) =>
    l.desks.filter((d: any) => d.device).map((d: any) => ({ ...d.device, locationName: l.name, deskName: d.name }))
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/clients')} className="text-zinc-400 hover:text-zinc-700 text-sm">← Klienci</button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-zinc-800">{org.name}</h1>
            <PlanBadge plan={org.plan} />
            {!org.isActive && <Badge label="Nieaktywna" color="red" />}
          </div>
          <p className="text-sm text-zinc-400 mt-0.5">{org.slug}</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="secondary" size="sm" onClick={openEdit}>Edytuj</Btn>
          <Btn size="sm" loading={busy} onClick={impersonate}>👁 Wejdź jako Admin</Btn>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Sekcja 1: Informacje */}
        <Section title="Informacje ogólne">
          <Card className="grid grid-cols-2 gap-4 text-sm">
            {[
              ['Kontakt', org.contactEmail ?? '—'],
              ['Plan', org.plan],
              ['Biura', org.locations.length],
              ['Użytkownicy', org._count?.users ?? org.users?.length ?? '—'],
              ['Trial do', org.trialEndsAt ? new Date(org.trialEndsAt).toLocaleDateString('pl-PL') : '—'],
              ['Plan wygasa', org.planExpiresAt ? new Date(org.planExpiresAt).toLocaleDateString('pl-PL') : '—'],
              ['Utworzona', new Date(org.createdAt).toLocaleDateString('pl-PL')],
              ['ID', org.id],
            ].map(([label, value]) => (
              <div key={label as string}>
                <p className="text-xs text-zinc-400 font-medium">{label}</p>
                <p className="text-zinc-700 font-mono text-xs mt-0.5 break-all">{value}</p>
              </div>
            ))}
            {org.notes && (
              <div className="col-span-2">
                <p className="text-xs text-zinc-400 font-medium">Notatki</p>
                <p className="text-zinc-700 text-xs mt-0.5 whitespace-pre-wrap">{org.notes}</p>
              </div>
            )}
          </Card>
        </Section>

        {/* Sekcja 2: Gateway */}
        <Section title={`Gateway (${allGateways.length})`}>
          {allGateways.length === 0 ? (
            <p className="text-zinc-400 text-sm">Brak gateway</p>
          ) : (
            <Card className="overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-100">
                  <tr>
                    {['Nazwa', 'Biuro', 'IP', 'Status', 'Ostatni heartbeat'].map(h => (
                      <th key={h} className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allGateways.map((gw: any) => (
                    <tr key={gw.id} className="border-b border-zinc-50">
                      <td className="py-2.5 px-4 font-medium text-zinc-700">{gw.name}</td>
                      <td className="py-2.5 px-4 text-zinc-500 text-xs">{gw.locationName}</td>
                      <td className="py-2.5 px-4 font-mono text-xs text-zinc-400">{gw.ipAddress ?? '—'}</td>
                      <td className="py-2.5 px-4"><StatusDot status={gwStatus(gw)} /></td>
                      <td className="py-2.5 px-4 text-xs text-zinc-400">
                        {gw.lastSeen ? new Date(gw.lastSeen).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </Section>

        {/* Sekcja 3: Beacony */}
        <Section title={`Beacony (${allBeacons.length})`}>
          {allBeacons.length === 0 ? (
            <p className="text-zinc-400 text-sm">Brak beaconów</p>
          ) : (
            <Card className="overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-100">
                  <tr>
                    {['Hardware ID', 'Biuro', 'Status', 'RSSI', 'Firmware'].map(h => (
                      <th key={h} className="py-2.5 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allBeacons.map((d: any) => (
                    <tr key={d.id} className="border-b border-zinc-50">
                      <td className="py-2.5 px-4 font-mono text-xs text-zinc-700">{d.hardwareId}</td>
                      <td className="py-2.5 px-4 text-xs text-zinc-500">{d.locationName}</td>
                      <td className="py-2.5 px-4">
                        <StatusDot status={d.isOnline ? 'healthy' : 'offline'} />
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-zinc-400">{d.rssi ? `${d.rssi} dBm` : '—'}</td>
                      <td className="py-2.5 px-4 font-mono text-xs text-zinc-400">{d.firmwareVersion ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </Section>

        {/* Sekcja 4: Aktywność */}
        <Section title="Ostatnia aktywność">
          {!org.events?.length ? (
            <p className="text-zinc-400 text-sm">Brak zdarzeń</p>
          ) : (
            <Card className="space-y-2 max-h-64 overflow-y-auto">
              {org.events.map((ev: any) => (
                <div key={ev.id} className="flex items-start gap-3 text-xs">
                  <span className="text-zinc-300 font-mono shrink-0 mt-0.5">
                    {new Date(ev.createdAt).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-zinc-500 font-medium">{ev.type}</span>
                </div>
              ))}
            </Card>
          )}
        </Section>
      </div>

      {/* Edit Modal */}
      <Modal open={editModal} title={`Edytuj: ${org.name}`} onClose={() => setEditModal(false)}>
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Plan</label>
            <select value={form.plan ?? 'starter'} onChange={e => setForm((f: any) => ({ ...f, plan: e.target.value }))}
              className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30">
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <Input label="Email kontaktowy" type="email" value={form.contactEmail ?? ''}
            onChange={e => setForm((f: any) => ({ ...f, contactEmail: e.target.value }))} />
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Notatki</label>
            <textarea value={form.notes ?? ''} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30 resize-none" />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Btn variant="secondary" onClick={() => setEditModal(false)}>Anuluj</Btn>
            <Btn loading={saving} onClick={saveEdit}>Zapisz</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
