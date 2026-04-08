import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { appApi } from '../api/client';
import { PageHeader, Card, Stat, Spinner } from '../components/ui';
import { format, subDays } from 'date-fns';
import { pl } from 'date-fns/locale';

const LOC_ID = import.meta.env.VITE_LOCATION_ID ?? 'seed-location-01';

// Build last-N-days labels
function lastNDays(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = subDays(new Date(), n - 1 - i);
    return { date: format(d, 'yyyy-MM-dd'), label: format(d, 'EEE dd.MM', { locale: pl }) };
  });
}

export function ReportsPage() {
  const [occ,  setOcc]  = useState<any>(null);
  const [resv, setResv] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [o, r] = await Promise.all([
          appApi.locations.occupancy(LOC_ID),
          appApi.reservations.list({ locationId: LOC_ID }),
        ]);
        setOcc(o);
        setResv(r);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner />;

  // Aggregate reservations by day for the last 14 days
  const days = lastNDays(14);
  const byDay = Object.fromEntries(days.map(d => [d.date, { confirmed:0, cancelled:0, completed:0 }]));
  for (const r of resv) {
    const day = r.date?.slice(0, 10);
    if (byDay[day]) {
      if (r.status === 'CONFIRMED')  byDay[day].confirmed++;
      if (r.status === 'CANCELLED')  byDay[day].cancelled++;
      if (r.status === 'COMPLETED')  byDay[day].completed++;
    }
  }
  const chartData = days.map(d => ({ ...d, ...byDay[d.date] }));

  // Method distribution
  const methods = resv.reduce((acc: Record<string,number>, r) => {
    const m = r.checkin?.method ?? 'NO_CHECKIN';
    acc[m] = (acc[m] ?? 0) + 1;
    return acc;
  }, {});
  const methodData = Object.entries(methods).map(([name, value]) => ({ name, value }));

  const totalResv     = resv.length;
  const confirmed     = resv.filter(r => r.status === 'CONFIRMED').length;
  const withCheckin   = resv.filter(r => r.checkin).length;
  const noShowRate    = totalResv ? Math.round(((confirmed - withCheckin) / Math.max(confirmed, 1)) * 100) : 0;

  return (
    <div>
      <PageHeader title="Raporty" sub="Statystyki lokalizacji" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Zajętość dziś"    value={`${occ?.occupancyPct ?? 0}%`} accent />
        <Stat label="Wszystkich rezerwacji" value={totalResv} />
        <Stat label="Z check-in"       value={withCheckin}
          sub={`${totalResv ? Math.round((withCheckin/totalResv)*100) : 0}%`} />
        <Stat label="No-show rate"     value={`${noShowRate}%`} />
      </div>

      {/* Reservations over 14 days */}
      <Card className="p-5 mb-6">
        <p className="text-sm font-semibold text-zinc-700 mb-4">Rezerwacje — ostatnie 14 dni</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barCategoryGap="40%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
            <XAxis dataKey="label" tick={{ fontSize:11, fill:'#a1a1aa' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:11, fill:'#a1a1aa' }} axisLine={false} tickLine={false} width={20} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius:8, border:'1px solid #e4e4e7', fontSize:12 }} cursor={{ fill:'#f9f9f9' }} />
            <Legend wrapperStyle={{ fontSize:12 }} />
            <Bar dataKey="confirmed"  name="Potwierdzone" fill="#6366f1" radius={[3,3,0,0]} stackId="a" />
            <Bar dataKey="completed"  name="Zakończone"   fill="#34d399" radius={[3,3,0,0]} stackId="a" />
            <Bar dataKey="cancelled"  name="Anulowane"    fill="#fca5a5" radius={[3,3,0,0]} stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Check-in methods */}
      {methodData.length > 0 && (
        <Card className="p-5">
          <p className="text-sm font-semibold text-zinc-700 mb-4">Metody check-in</p>
          <div className="flex flex-wrap gap-4">
            {methodData.map(({ name, value }) => (
              <div key={name} className="flex-1 min-w-[120px] bg-zinc-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold font-mono text-zinc-800">{value}</p>
                <p className="text-xs text-zinc-500 mt-1">
                  {{ NFC:'📡 NFC', QR:'📷 QR', MANUAL:'✋ Ręczny', NO_CHECKIN:'⏳ Brak' }[name] ?? name}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
