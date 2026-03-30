import React, { useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import { PageHeader, Btn, Card, Modal, Input } from '../components/ui';

function getUser() {
  try { return JSON.parse(localStorage.getItem('admin_user') ?? 'null'); } catch { return null; }
}

// ── Modal: generowanie tokenu instalacyjnego gateway ──────────
function InstallTokenModal({ location, onClose }: { location: any; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [token,   setToken]   = useState<any>(null);
  const [copied,  setCopied]  = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    adminApi.gateways.createSetupToken(location.id)
      .then(t => { setToken(t); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [location.id]);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Modal title={`Dodaj gateway — ${location.name}`} onClose={onClose}>
      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-zinc-200 border-t-[#B53578] rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>
      )}
      {token && (
        <div className="space-y-5">
          {/* Instrukcja */}
          <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
            <p className="text-sm font-semibold text-zinc-700 mb-2">Jak zainstalować gateway:</p>
            <ol className="text-sm text-zinc-600 space-y-1.5 list-decimal list-inside">
              <li>Włącz Raspberry Pi i połącz z internetem</li>
              <li>Otwórz terminal (SSH lub lokalnie)</li>
              <li>Wklej poniższą komendę i naciśnij Enter</li>
              <li>Skrypt zapyta tylko o nazwę WiFi (jeśli na kablu — pomija)</li>
            </ol>
          </div>

          {/* Komenda instalacyjna */}
          <div>
            <p className="text-xs text-zinc-400 mb-1.5 font-medium">Komenda instalacyjna (ważna 24h, jednorazowa)</p>
            <div className="bg-zinc-950 rounded-xl p-4 flex items-start gap-3">
              <code className="text-emerald-400 text-xs font-mono flex-1 break-all leading-relaxed">
                {token.installCmd}
              </code>
              <button
                onClick={() => copy(token.installCmd)}
                className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors font-medium"
              >
                {copied ? '✓' : '⎘'}
              </button>
            </div>
          </div>

          {/* Informacje */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-zinc-50 rounded-lg p-3">
              <p className="text-zinc-400 mb-0.5">Biuro</p>
              <p className="font-medium text-zinc-700">{token.location?.name}</p>
            </div>
            <div className="bg-zinc-50 rounded-lg p-3">
              <p className="text-zinc-400 mb-0.5">Ważny do</p>
              <p className="font-medium text-zinc-700">
                {new Date(token.expiresAt).toLocaleString('pl-PL', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <span className="text-amber-500 shrink-0">⚠</span>
            <p className="text-xs text-amber-700">
              Token jest jednorazowy — po użyciu wygasa. Jeśli instalacja się nie powiedzie,
              wróć tutaj i wygeneruj nowy.
            </p>
          </div>

          <div className="flex justify-end">
            <Btn onClick={onClose}>Zamknij</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function OrganizationsPage() {
  const user = getUser();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [locations, setLocations] = useState<any[]>([]);
  const [orgs,      setOrgs]      = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState<'create'|'edit'|null>(null);
  const [target,    setTarget]    = useState<any>(null);
  const [form,      setForm]      = useState({
    name: '', address: '', city: '', openTime: '08:00', closeTime: '17:00', organizationId: '',
  });
  const [saving,       setSaving]       = useState(false);
  const [err,          setErr]          = useState('');
  const [installModal, setInstallModal] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [locs, os] = await Promise.all([
        adminApi.locations.listAll(),
        isSuperAdmin ? adminApi.orgs.list() : Promise.resolve([]),
      ]);
      setLocations(locs);
      setOrgs(os);
    } catch (e: any) { console.error('Failed to load locations:', e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm({ name:'', address:'', city:'', openTime:'08:00', closeTime:'17:00',
      organizationId: isSuperAdmin ? '' : (user?.organizationId ?? '') });
    setErr('');
    setModal('create');
  };

  const openEdit = (loc: any) => {
    setTarget(loc);
    setForm({
      name: loc.name, address: loc.address ?? '', city: loc.city ?? '',
      openTime: loc.openTime ?? '08:00', closeTime: loc.closeTime ?? '17:00',
      organizationId: loc.organizationId,
    });
    setErr('');
    setModal('edit');
  };

  const save = async () => {
    setSaving(true); setErr('');
    try {
      if (modal === 'create') {
        const orgId = form.organizationId || user?.organizationId;
        await adminApi.locations.create(orgId, {
          name: form.name, address: form.address, city: form.city,
          openTime: form.openTime, closeTime: form.closeTime,
          organizationId: orgId,
        });
      } else if (target) {
        await adminApi.locations.update(target.id, {
          name: form.name, address: form.address, city: form.city,
          openTime: form.openTime, closeTime: form.closeTime,
        });
      }
      setModal(null);
      await load();
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <div>
      <PageHeader
        title="Biura"
        sub="Fizyczne biura — godziny pracy, adresy, lokalizacje"
        action={<Btn onClick={openCreate}>+ Nowe biuro</Btn>}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-5 h-5 border-2 border-zinc-200 border-t-[#B53578] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {locations.map(loc => (
            <Card key={loc.id} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#B53578]/10 flex items-center justify-center text-[#B53578] font-bold text-lg shrink-0">
                {loc.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-zinc-800 truncate">{loc.name}</p>
                  {!loc.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Nieaktywne</span>
                  )}
                  {isSuperAdmin && loc.organization && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-medium">
                      {loc.organization.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {[loc.address, loc.city].filter(Boolean).join(', ') || 'Brak adresu'}
                </p>
                {/* ID do prowizjonowania */}
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">ID:</span>
                  <code className="text-[10px] font-mono text-zinc-500 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded select-all">{loc.id}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(loc.id); }}
                    className="text-[10px] text-zinc-400 hover:text-[#B53578] transition-colors"
                    title="Kopiuj ID"
                  >⎘</button>
                </div>
              </div>
              {/* Godziny */}
              <div className="shrink-0 text-center px-4 border-l border-zinc-100">
                <p className="text-sm font-mono font-semibold text-zinc-700">
                  {loc.openTime ?? '08:00'} – {loc.closeTime ?? '17:00'}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">godziny pracy</p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <p className="text-xs text-zinc-400">
                  {new Date(loc.createdAt).toLocaleDateString('pl-PL')}
                </p>
                <Btn variant="ghost" size="sm" onClick={() => setInstallModal(loc)}>+ Gateway</Btn>
                <Btn variant="ghost" size="sm" onClick={() => openEdit(loc)}>Edytuj</Btn>
              </div>
            </Card>
          ))}
          {locations.length === 0 && (
            <div className="text-center py-16 text-zinc-400">
              <p className="text-3xl mb-2">🏢</p>
              <p className="text-sm">Brak biur — dodaj pierwsze biuro</p>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={modal !== null}
        title={modal === 'create' ? 'Nowe biuro' : `Edytuj: ${target?.name}`}
        onClose={() => setModal(null)}
      >
        {err && <p className="mb-3 text-sm text-red-500 bg-red-50 p-2.5 rounded-lg">{err}</p>}
        <div className="flex flex-col gap-3">
          {/* Super Admin wybiera firmę */}
          {isSuperAdmin && modal === 'create' && (
            <div>
              <label className="block text-xs text-zinc-400 mb-1 font-medium">Firma</label>
              <select
                value={form.organizationId}
                onChange={e => setForm(f => ({ ...f, organizationId: e.target.value }))}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
              >
                <option value="">— wybierz firmę —</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
          <Input label="Nazwa biura" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Warszawa HQ" />
          <Input label="Adres" value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            placeholder="ul. Marszałkowska 1" />
          <Input label="Miasto" value={form.city}
            onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
            placeholder="Warszawa" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1 font-medium">Otwarcie</label>
              <input type="time" value={form.openTime}
                onChange={e => setForm(f => ({ ...f, openTime: e.target.value }))}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1 font-medium">Zamknięcie</label>
              <input type="time" value={form.closeTime}
                onChange={e => setForm(f => ({ ...f, closeTime: e.target.value }))}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30" />
            </div>
          </div>
          <p className="text-xs text-zinc-400">
            Godziny pracy określają, kiedy użytkownicy mogą rezerwować biurka. Walk-in przez QR
            kończy się automatycznie o godzinie zamknięcia.
          </p>
          <div className="flex gap-2 mt-1 justify-end">
            <Btn variant="secondary" onClick={() => setModal(null)}>Anuluj</Btn>
            <Btn onClick={save} loading={saving}>
              {modal === 'create' ? 'Utwórz' : 'Zapisz'}
            </Btn>
          </div>
        </div>
      </Modal>
      {/* Install token modal */}
      {installModal && (
        <InstallTokenModal location={installModal} onClose={() => setInstallModal(null)} />
      )}
    </div>
  );
}
