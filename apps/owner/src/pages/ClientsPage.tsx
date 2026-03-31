import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ownerApi } from '../api/client';
import { Btn, Badge, PageHeader, PlanBadge, Spinner } from '../components/ui';

function GatewayPill({ online, total }: { online: number; total: number }) {
  const ok = total === 0 || online === total;
  const warn = !ok && online > 0;
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${ok ? 'bg-emerald-100 text-emerald-700' : warn ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
      {online}/{total} GW
    </span>
  );
}

export function ClientsPage() {
  const navigate = useNavigate();
  const [orgs,    setOrgs]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState<'all' | 'active' | 'inactive'>('active');
  const [busy,    setBusy]    = useState<string | null>(null);
  const [err,     setErr]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { search: search || undefined };
      if (filter === 'active')   params.isActive = true;
      if (filter === 'inactive') params.isActive = false;
      setOrgs(await ownerApi.organizations.list(params));
    } catch (e: any) { setErr(e.message); }
    setLoading(false);
  }, [search, filter]);

  useEffect(() => { load(); }, [load]);

  const handleImpersonate = async (org: any) => {
    setBusy(org.id);
    try {
      const { adminUrl, orgName } = await ownerApi.organizations.impersonate(org.id);
      localStorage.setItem('owner_impersonating', JSON.stringify({ orgId: org.id, orgName }));
      window.open(adminUrl, '_blank');
    } catch (e: any) { alert(e.message); }
    setBusy(null);
  };

  const handleDeactivate = async (org: any) => {
    if (!confirm(`Dezaktywować firmę "${org.name}"? Dane nie zostaną usunięte.`)) return;
    try {
      await ownerApi.organizations.deactivate(org.id);
      await load();
    } catch (e: any) { alert(e.message); }
  };

  return (
    <div>
      <PageHeader
        title="Klienci"
        sub={`${orgs.length} firm${orgs.length === 1 ? 'a' : orgs.length < 5 ? 'y' : ''}`}
        action={<Btn onClick={() => navigate('/clients/new')}>+ Nowy klient</Btn>}
      />

      {/* Filtry */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex bg-white border border-zinc-200 rounded-xl overflow-hidden">
          {(['active', 'inactive', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${filter === f ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}>
              {f === 'active' ? 'Aktywne' : f === 'inactive' ? 'Nieaktywne' : 'Wszystkie'}
            </button>
          ))}
        </div>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Szukaj firmy…"
          className="flex-1 max-w-xs border border-zinc-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B53578]/30"
        />
      </div>

      {err && <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">{err}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                {['Firma', 'Plan', 'Gateway', 'Beacony', 'Użytkownicy', 'Ostatnia aktywność', ''].map(h => (
                  <th key={h} className="py-3 px-4 text-xs text-zinc-400 font-semibold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orgs.map(org => (
                <tr key={org.id} className="border-b border-zinc-50 hover:bg-zinc-50/60 group">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#B53578]/10 flex items-center justify-center text-[#B53578] font-bold text-sm shrink-0">
                        {org.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-zinc-800">{org.name}</p>
                        <p className="text-xs text-zinc-400">{org.slug}</p>
                      </div>
                      {!org.isActive && <Badge label="Nieaktywna" color="red" />}
                    </div>
                  </td>
                  <td className="py-3 px-4"><PlanBadge plan={org.plan} /></td>
                  <td className="py-3 px-4">
                    <GatewayPill online={org.gateways.online} total={org.gateways.total} />
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs text-zinc-500">
                      {org.beacons.online}/{org.beacons.total}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-zinc-500">{org.usersCount}</td>
                  <td className="py-3 px-4 text-xs text-zinc-400">
                    {new Date(org.createdAt).toLocaleDateString('pl-PL')}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Btn size="sm" variant="ghost" onClick={() => navigate(`/clients/${org.id}`)}>
                        Szczegóły
                      </Btn>
                      <Btn size="sm" variant="ghost" loading={busy === org.id}
                        onClick={() => handleImpersonate(org)}>
                        👁 Wejdź
                      </Btn>
                      {org.isActive && (
                        <Btn size="sm" variant="ghost" onClick={() => handleDeactivate(org)}>
                          Dezaktywuj
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orgs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400 text-sm">
                    Brak firm{search ? ` pasujących do "${search}"` : ''}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
