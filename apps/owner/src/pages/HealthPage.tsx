import React, { useEffect, useState, useCallback } from 'react';
import { ownerApi } from '../api/client';
import { Spinner, PageHeader, Badge } from '../components/ui';

type HealthStatus = 'healthy' | 'stale' | 'offline';

function worstStatus(statuses: HealthStatus[]): HealthStatus {
  if (!statuses.length) return 'offline';
  if (statuses.some(s => s === 'offline')) return 'offline';
  if (statuses.some(s => s === 'stale'))   return 'stale';
  return 'healthy';
}

const STATUS_COLOR: Record<HealthStatus, string> = {
  healthy: 'border-l-4 border-l-emerald-400',
  stale:   'border-l-4 border-l-amber-400',
  offline: 'border-l-4 border-l-red-400',
};

const STATUS_DOT: Record<HealthStatus, string> = {
  healthy: 'bg-emerald-500',
  stale:   'bg-amber-400',
  offline: 'bg-red-500',
};

const STATUS_LABEL: Record<HealthStatus, string> = {
  healthy: 'Online',
  stale:   'Stale',
  offline: 'Offline',
};

function Dot({ status }: { status: HealthStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
      <span className="text-xs text-zinc-500">{STATUS_LABEL[status]}</span>
    </span>
  );
}

export function HealthPage() {
  const [data,      setData]      = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [lastUpdate,setLastUpdate]= useState<Date | null>(null);
  const [filter,    setFilter]    = useState<'all' | 'critical' | 'problem'>('all');
  const [err,       setErr]       = useState('');

  const load = useCallback(async () => {
    try {
      const res = await ownerApi.health.global();
      setData(res);
      setLastUpdate(new Date());
      setErr('');
    } catch (e: any) { setErr(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = data.filter(org => {
    const s = worstStatus(org.gateways.map((g: any) => g.status));
    if (filter === 'critical') return s === 'offline';
    if (filter === 'problem')  return s !== 'healthy';
    return true;
  });

  const summary = {
    healthy:  data.filter(o => worstStatus(o.gateways.map((g: any) => g.status)) === 'healthy').length,
    problem:  data.filter(o => { const s = worstStatus(o.gateways.map((g: any) => g.status)); return s === 'stale'; }).length,
    critical: data.filter(o => worstStatus(o.gateways.map((g: any) => g.status)) === 'offline').length,
  };

  return (
    <div>
      <PageHeader
        title="Health"
        sub="Globalny stan infrastruktury IoT"
        action={
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">
              {lastUpdate ? `Odświeżono: ${lastUpdate.toLocaleTimeString('pl-PL')}` : ''}
            </span>
            <button onClick={load} className="text-xs text-[#B53578] hover:underline">↻ Odśwież</button>
          </div>
        }
      />

      {/* Podsumowanie */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Wszystkie online', value: summary.healthy, color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
          { label: 'Problemy (stale)', value: summary.problem,  color: 'bg-amber-50  border-amber-200  text-amber-700' },
          { label: 'Offline',          value: summary.critical, color: 'bg-red-50    border-red-200    text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl border p-4 ${color}`}>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs font-medium mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filtr */}
      <div className="flex bg-white border border-zinc-200 rounded-xl overflow-hidden w-fit mb-5">
        {([['all', 'Wszystkie'], ['problem', 'Problemy'], ['critical', 'Offline']] as const).map(([f, l]) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${filter === f ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}>
            {l}
          </button>
        ))}
      </div>

      {err && <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">{err}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.map((org: any) => {
            const orgStatus = worstStatus(org.gateways.map((g: any) => g.status));
            return (
              <div key={org.org.id} className={`bg-white rounded-2xl border border-zinc-200 ${STATUS_COLOR[orgStatus]}`}>
                <div className="px-5 py-3 flex items-center justify-between border-b border-zinc-100">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-zinc-800">{org.org.name}</p>
                    <span className="text-zinc-400 text-xs">{org.org.slug}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-400">
                    <span>GW: {org.summary.gatewaysOnline}/{org.summary.gatewaysTotal}</span>
                    <span>Beacony: {org.summary.beaconsOnline}/{org.summary.beaconsTotal}</span>
                  </div>
                </div>

                {org.gateways.length === 0 ? (
                  <div className="px-5 py-3 text-xs text-zinc-400">Brak gateway</div>
                ) : (
                  <div className="divide-y divide-zinc-50">
                    {org.gateways.map((gw: any) => (
                      <div key={gw.id} className="px-5 py-2.5 flex items-center gap-4 text-xs">
                        <Dot status={gw.status} />
                        <span className="font-medium text-zinc-700 w-40 truncate">{gw.name}</span>
                        <span className="text-zinc-400">{gw.locationName}</span>
                        <span className="font-mono text-zinc-400 ml-auto">{gw.ipAddress ?? '—'}</span>
                        <span className="text-zinc-400 w-28 text-right">
                          {gw.lastSeen
                            ? new Date(gw.lastSeen).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
                            : 'nigdy'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-zinc-400">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-sm">Wszystkie systemy działają poprawnie</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
