import React, { useEffect, useState } from 'react';
import { ownerApi } from '../api/client';
import { MetricCard, PageHeader, Spinner, Card, PlanBadge } from '../components/ui';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

export function StatsPage() {
  const [stats,   setStats]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState('');

  useEffect(() => {
    ownerApi.stats()
      .then(setStats)
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (err)     return <div className="p-4 text-red-500">{err}</div>;
  if (!stats)  return null;

  const gatewayPct  = stats.gatewaysTotal  > 0 ? Math.round(stats.gatewaysOnline  / stats.gatewaysTotal  * 100) : 0;
  const beaconPct   = stats.beaconsTotal   > 0 ? Math.round(stats.beaconsOnline   / stats.beaconsTotal   * 100) : 0;

  const infraData = [
    { name: 'Gateway online',  value: stats.gatewaysOnline,  total: stats.gatewaysTotal,  fill: '#10b981' },
    { name: 'Gateway offline', value: stats.gatewaysTotal - stats.gatewaysOnline, total: stats.gatewaysTotal, fill: '#f87171' },
    { name: 'Beacony online',  value: stats.beaconsOnline,   total: stats.beaconsTotal,   fill: '#3b82f6' },
    { name: 'Beacony offline', value: stats.beaconsTotal - stats.beaconsOnline,   total: stats.beaconsTotal, fill: '#fbbf24' },
  ];

  const checkinData = [
    { name: 'Dziś',        value: stats.checkinsToday },
    { name: 'Tydzień', value: stats.checkinsWeek  },
  ];

  return (
    <div>
      <PageHeader title="Statystyki" sub="Metryki całej platformy Reserti" />

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Firmy łącznie"   value={stats.orgsTotal}     />
        <MetricCard label="Firmy aktywne"   value={stats.orgsActive}    color="green" />
        <MetricCard label="Firmy nieaktywne" value={stats.orgsInactive} color="red" />
        <MetricCard label="Check-iny dziś"  value={stats.checkinsToday} color="purple" />
        <MetricCard label="Gateway łącznie" value={stats.gatewaysTotal}  />
        <MetricCard label="Gateway online"  value={stats.gatewaysOnline} color="green"
          sub={`${gatewayPct}% dostępności`} />
        <MetricCard label="Beacony łącznie" value={stats.beaconsTotal}   />
        <MetricCard label="Beacony online"  value={stats.beaconsOnline}  color="green"
          sub={`${beaconPct}% dostępności`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        {/* Infrastruktura chart */}
        <Card>
          <p className="text-sm font-semibold text-zinc-700 mb-4">Stan infrastruktury</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={infraData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: any, n: any, p: any) => [`${v} / ${p.payload.total}`, n]} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {infraData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Check-iny chart */}
        <Card>
          <p className="text-sm font-semibold text-zinc-700 mb-4">Check-iny</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={checkinData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#B53578" radius={[4, 4, 0, 0]} name="Check-iny" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Nieaktywne firmy */}
      {stats.inactiveOrgs?.length > 0 && (
        <Card>
          <p className="text-sm font-semibold text-zinc-700 mb-4">
            Firmy bez aktywności (7+ dni)
          </p>
          <div className="space-y-2">
            {stats.inactiveOrgs.map((org: any) => (
              <div key={org.id} className="flex items-center justify-between py-2 border-b border-zinc-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-zinc-700">{org.name}</p>
                  <p className="text-xs text-zinc-400">{org.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <PlanBadge plan={org.plan} />
                  <span className="text-xs text-zinc-400">
                    od {new Date(org.createdAt).toLocaleDateString('pl-PL')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
