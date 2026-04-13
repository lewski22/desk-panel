import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { appApi } from '../api/client';
import { PageHeader, Card, Stat, Spinner } from '../components/ui';
import { format, subDays, type Locale } from 'date-fns';
import { pl, enUS } from 'date-fns/locale';

const LOC_ID = import.meta.env.VITE_LOCATION_ID ?? 'seed-location-01';

// Build last-N-days labels
function lastNDays(n: number, locale: Locale) {
  return Array.from({ length: n }, (_, i) => {
    const d = subDays(new Date(), n - 1 - i);
    return { date: format(d, 'yyyy-MM-dd'), label: format(d, 'EEE dd.MM', { locale }) };
  });
}

export function ReportsPage() {
  const { t, i18n } = useTranslation();
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
  const locale = i18n.language?.startsWith('pl') ? pl : enUS;
  const days = lastNDays(14, locale);
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
      <PageHeader title={t('pages.reports.title')} sub={t('pages.reports.sub')} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label={t('reports.kpi.occ_today')}    value={`${occ?.occupancyPct ?? 0}%`} accent />
        <Stat label={t('reports.kpi.total')} value={totalResv} />
        <Stat label={t('reports.kpi.with_checkin')}       value={withCheckin}
          sub={`${totalResv ? Math.round((withCheckin/totalResv)*100) : 0}%`} />
        <Stat label={t('reports.kpi.no_show')}     value={`${noShowRate}%`} />
      </div>

      {/* Reservations over 14 days */}
      <Card className="p-5 mb-6">
        <p className="text-sm font-semibold text-zinc-700 mb-4">{t('reports.chart_title')}</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barCategoryGap="40%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
            <XAxis dataKey="label" tick={{ fontSize:11, fill:'#a1a1aa' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:11, fill:'#a1a1aa' }} axisLine={false} tickLine={false} width={20} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius:8, border:'1px solid #e4e4e7', fontSize:12 }} cursor={{ fill:'#f9f9f9' }} />
            <Legend wrapperStyle={{ fontSize:12 }} />
            <Bar dataKey="confirmed"  name={t('reports.series.confirmed')} fill="#6366f1" radius={[3,3,0,0]} stackId="a" />
            <Bar dataKey="completed"  name={t('reports.series.completed')} fill="#34d399" radius={[3,3,0,0]} stackId="a" />
            <Bar dataKey="cancelled"  name={t('reports.series.cancelled')} fill="#fca5a5" radius={[3,3,0,0]} stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Check-in methods */}
      {methodData.length > 0 && (
        <Card className="p-5">
          <p className="text-sm font-semibold text-zinc-700 mb-4">{t('reports.methods_title')}</p>
          <div className="flex flex-wrap gap-4">
            {methodData.map(({ name, value }) => (
              <div key={name} className="flex-1 min-w-[120px] bg-zinc-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold font-mono text-zinc-800">{value}</p>
                <p className="text-xs text-zinc-500 mt-1">
                  { (name === 'NFC' && t('methods.NFC')) || (name === 'QR' && t('methods.QR')) || (name === 'MANUAL' && t('methods.MANUAL')) || (name === 'NO_CHECKIN' && t('methods.NO_CHECKIN')) || name }
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
