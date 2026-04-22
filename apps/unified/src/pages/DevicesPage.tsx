import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi as api } from '../api/client';
import { PageHeader } from '../components/ui';

interface Device {
  id: string;
  hardwareId: string;
  firmwareVersion: string | null;
  isOnline: boolean;
  lastSeen: string | null;
  rssi: number | null;
  desk: { name: string; code: string } | null;
}

interface Gateway {
  id: string;
  name: string;
  isOnline: boolean;
  lastSeen: string | null;
  ipAddress: string | null;
  version: string | null;
  location: { name: string } | null;
  _count: { devices: number };
}

function RssiBar({ rssi }: { rssi: number | null }) {
  if (rssi === null) return <span className="text-zinc-300">—</span>;
  const pct   = Math.max(0, Math.min(100, ((rssi + 100) / 60) * 100));
  const color = pct > 66 ? 'bg-emerald-400' : pct > 33 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-500 font-mono">{rssi} dBm</span>
    </div>
  );
}

function StatusDot({ online }: { online: boolean }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${online ? 'text-emerald-600' : 'text-zinc-400'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-zinc-300'}`} />
      {online ? t('devices.status.online') : t('devices.status.offline')}
    </span>
  );
}

function fmtDate(val: string | null, lang: string) {
  if (!val) return '—';
  return new Date(val).toLocaleString(lang === 'en' ? 'en-GB' : 'pl-PL',
    { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

// ── Beacony tab ───────────────────────────────────────────────
function BeaconsTab({ devices, loading, onRefresh }: {
  devices: Device[]; loading: boolean; onRefresh: () => void;
}) {
  const { t, i18n } = useTranslation();

  const online  = devices.filter(d => d.isOnline).length;
  const offline = devices.length - online;

  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: t('devices.summary.all'),     count: devices.length, color: 'text-zinc-700',    bg: 'bg-zinc-50'    },
          { label: t('devices.summary.online'),  count: online,         color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: t('devices.summary.offline'), count: offline,        color: 'text-red-500',     bg: 'bg-red-50'     },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4 text-center`}>
            <p className={`text-3xl font-bold font-mono ${color}`}>{count}</p>
            <p className="text-xs text-zinc-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {loading && devices.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-block w-5 h-5 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-100">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/70">
                {[t('devices.table.status'), t('devices.table.hardware_id'), t('devices.table.desk'), t('devices.table.firmware'), t('devices.table.rssi'), t('devices.table.last_seen')].map(h => (
                  <th key={h} className="py-2.5 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices.map(d => (
                <tr key={d.id} className="border-b border-zinc-50 hover:bg-zinc-50/60 transition-colors">
                  <td className="py-3 px-4"><StatusDot online={d.isOnline} /></td>
                  <td className="py-3 px-4"><span className="font-mono text-xs text-zinc-700">{d.hardwareId}</span></td>
                  <td className="py-3 px-4 text-sm text-zinc-700">
                    {d.desk
                      ? <span>{d.desk.name} <span className="text-zinc-400 text-xs">({d.desk.code})</span></span>
                      : <span className="text-zinc-300 text-xs">{t('devices.unassigned')}</span>}
                  </td>
                  <td className="py-3 px-4"><span className="font-mono text-xs text-zinc-500">{d.firmwareVersion ?? '—'}</span></td>
                  <td className="py-3 px-4"><RssiBar rssi={d.rssi} /></td>
                  <td className="py-3 px-4 text-xs text-zinc-500">{fmtDate(d.lastSeen, i18n.language)}</td>
                </tr>
              ))}
              {!devices.length && (
                <tr><td colSpan={6} className="py-12 text-center text-sm text-zinc-400">{t('table.empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ── Gateways tab ──────────────────────────────────────────────
function GatewaysTab({ gateways, loading }: { gateways: Gateway[]; loading: boolean }) {
  const { t, i18n } = useTranslation();

  const online  = gateways.filter(g => g.isOnline).length;
  const offline = gateways.length - online;

  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: t('devices.summary.all'),     count: gateways.length, color: 'text-zinc-700',    bg: 'bg-zinc-50'    },
          { label: t('devices.summary.online'),  count: online,          color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: t('devices.summary.offline'), count: offline,         color: 'text-red-500',     bg: 'bg-red-50'     },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4 text-center`}>
            <p className={`text-3xl font-bold font-mono ${color}`}>{count}</p>
            <p className="text-xs text-zinc-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {loading && gateways.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-block w-5 h-5 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-100">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/70">
                {[t('devices.table.status'), t('devices.gateway.name'), t('devices.gateway.location'), t('devices.table.ip'), t('devices.gateway.version'), t('devices.gateway.beacons'), t('devices.table.last_seen')].map(h => (
                  <th key={h} className="py-2.5 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gateways.map(g => (
                <tr key={g.id} className="border-b border-zinc-50 hover:bg-zinc-50/60 transition-colors">
                  <td className="py-3 px-4"><StatusDot online={g.isOnline} /></td>
                  <td className="py-3 px-4 text-sm font-medium text-zinc-700">{g.name}</td>
                  <td className="py-3 px-4 text-sm text-zinc-500">{g.location?.name ?? '—'}</td>
                  <td className="py-3 px-4"><span className="font-mono text-xs text-zinc-500">{g.ipAddress ?? '—'}</span></td>
                  <td className="py-3 px-4"><span className="font-mono text-xs text-zinc-500">{g.version ?? '—'}</span></td>
                  <td className="py-3 px-4 text-sm text-zinc-700 text-center">{g._count.devices}</td>
                  <td className="py-3 px-4 text-xs text-zinc-500">{fmtDate(g.lastSeen, i18n.language)}</td>
                </tr>
              ))}
              {!gateways.length && (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-zinc-400">{t('table.empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ── DevicesPage ───────────────────────────────────────────────
type Tab = 'beacons' | 'gateways';

export function DevicesPage() {
  const { t } = useTranslation();
  const [tab,      setTab]      = useState<Tab>('beacons');
  const [devices,  setDevices]  = useState<Device[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loadingD, setLoadingD] = useState(true);
  const [loadingG, setLoadingG] = useState(true);

  const loadDevices = async () => {
    setLoadingD(true);
    try {
      const data = await api.devices.list();
      setDevices(Array.isArray(data) ? data : []);
    } catch { /* noop */ }
    setLoadingD(false);
  };

  const loadGateways = async () => {
    setLoadingG(true);
    try {
      const data = await api.gateways.list();
      setGateways(Array.isArray(data) ? data : []);
    } catch { /* noop */ }
    setLoadingG(false);
  };

  useEffect(() => {
    loadDevices();
    loadGateways();
    const id = setInterval(() => { loadDevices(); loadGateways(); }, 30_000);
    return () => clearInterval(id);
  }, []);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'beacons',  label: t('devices.tab.beacons') },
    { key: 'gateways', label: t('devices.tab.gateways') },
  ];

  return (
    <div>
      <PageHeader
        title={t('pages.devices.title')}
        action={
          <button onClick={() => { loadDevices(); loadGateways(); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors">
            {t('btn.refresh')}
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-100 p-1 rounded-xl w-fit">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'beacons'
        ? <BeaconsTab devices={devices} loading={loadingD} onRefresh={loadDevices} />
        : <GatewaysTab gateways={gateways} loading={loadingG} />}
    </div>
  );
}
