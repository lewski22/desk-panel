/**
 * KioskPage — Sprint H3
 * Route: /kiosk?location=<id>
 * Fullscreen widok zajętości biurek — dla tabletu przy wejściu do biura.
 * Auto-refresh co 30s, wyjście przez PIN weryfikowany na backendzie.
 */
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation }  from 'react-i18next';
import { appApi }           from '../api/client';

// ── Kolory statusu ────────────────────────────────────────────
const S_FREE     = '#10b981';
const S_RESERVED = '#f59e0b';
const S_OCCUPIED = '#ef4444';
const S_OFFLINE  = '#a1a1aa';

function deskColor(d: any) {
  if (!d.isOnline || d.status !== 'ACTIVE') return S_OFFLINE;
  if (d.isOccupied)          return S_OCCUPIED;
  if (d.currentReservation)  return S_RESERVED;
  return S_FREE;
}

// ── PIN exit modal ────────────────────────────────────────────
function PinModal({ onClose, onSuccess, onVerify }: {
  onClose:   () => void;
  onSuccess: () => void;
  onVerify:  (pin: string) => Promise<boolean>;
}) {
  const { t }         = useTranslation();
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDigit = async (d: string) => {
    if (busy) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    setErr(false);
    if (next.length === 4) {
      setBusy(true);
      const ok = await onVerify(next);
      setBusy(false);
      if (ok) {
        onSuccess();
      } else {
        setErr(true);
        setTimeout(() => { setPin(''); setErr(false); }, 700);
      }
    }
  };
  const del = () => { if (!busy) setPin(p => p.slice(0, -1)); };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-zinc-900 rounded-3xl p-8 w-72 shadow-2xl border border-zinc-700"
        onClick={e => e.stopPropagation()}>
        <p className="text-center text-white font-bold text-lg mb-1">{t('kiosk.exit_title')}</p>
        <p className="text-center text-zinc-400 text-sm mb-6">{t('kiosk.exit_hint')}</p>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 mb-6">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${
              i < pin.length
                ? (err ? 'bg-red-500 border-red-500' : 'bg-brand border-brand')
                : 'border-zinc-600'
            }`} />
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3">
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
            d === '' ? <div key={i} /> :
            <button key={d} onClick={() => d === '⌫' ? del() : handleDigit(d)}
              disabled={busy}
              className={`h-14 rounded-2xl text-xl font-bold transition-colors disabled:opacity-40 ${
                d === '⌫'
                  ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  : 'bg-zinc-800 text-white hover:bg-zinc-700 active:bg-zinc-600'
              }`}>
              {d}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Desk tile — duże, touch-friendly ─────────────────────────
function DeskTile({ desk }: { desk: any }) {
  const { t }   = useTranslation();
  const color   = deskColor(desk);
  const labelKey = desk.isOccupied
    ? 'kiosk.status.occupied'
    : desk.currentReservation
      ? 'kiosk.status.reserved'
      : desk.isOnline && desk.status === 'ACTIVE'
        ? 'kiosk.status.free'
        : 'kiosk.status.offline';

  return (
    <div className="rounded-2xl flex flex-col items-center justify-center gap-2 p-4 min-h-[100px]"
      style={{ background: color + '22', border: `2px solid ${color}40` }}>
      <div className="w-4 h-4 rounded-full" style={{ background: color }} />
      <p className="font-bold text-white text-sm text-center leading-tight">{desk.name}</p>
      <p className="text-xs text-white/60">{t(labelKey)}</p>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────
function Legend() {
  const { t } = useTranslation();
  const items = [
    { color: S_FREE,     key: 'kiosk.status.free'     },
    { color: S_RESERVED, key: 'kiosk.status.reserved'  },
    { color: S_OCCUPIED, key: 'kiosk.status.occupied'  },
    { color: S_OFFLINE,  key: 'kiosk.status.offline'   },
  ];
  return (
    <div className="flex gap-6 justify-center mt-6">
      {items.map(({ color, key }) => (
        <span key={key} className="flex items-center gap-2 text-sm text-white/50">
          <span className="w-3 h-3 rounded-full" style={{ background: color }} />
          {t(key)}
        </span>
      ))}
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// ── Main Page ─────────────────────────────────────────────────
export function KioskPage() {
  const { t }              = useTranslation();
  const [params]           = useSearchParams();
  const locationId          = params.get('location') ?? '';

  const [desks,      setDesks]      = useState<any[]>([]);
  const [location,   setLocation]   = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [pinOpen,    setPinOpen]    = useState(false);
  const [_exiting,   setExiting]    = useState(false);
  const [clock,      setClock]      = useState(() => new Date().toLocaleTimeString());
  const clockRef = useRef<ReturnType<typeof setInterval>>();
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallEvt(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const doInstall = async () => {
    if (!installEvt) return;
    await installEvt.prompt();
    await installEvt.userChoice;
    setInstallEvt(null);
  };

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await appApi.desks.status(locationId);
      setDesks(res?.desks ?? res ?? []);
      setLastUpdate(new Date());
    } catch {}
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    appApi.locations.listAll()
      .then(locs => setLocation(locs.find((l: any) => l.id === locationId) ?? null))
      .catch(() => {});
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load, locationId]);

  useEffect(() => {
    clockRef.current = setInterval(() => setClock(new Date().toLocaleTimeString()), 1_000);
    return () => clearInterval(clockRef.current);
  }, []);

  // Fullscreen request
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => { document.exitFullscreen?.().catch(() => {}); };
  }, []);

  const grouped = useMemo(() => {
    const zones = new Map<string, any[]>();
    for (const d of desks) {
      const z = d.zone ?? t('kiosk.default_zone');
      if (!zones.has(z)) zones.set(z, []);
      zones.get(z)!.push(d);
    }
    return zones;
  }, [desks, t]);

  const stats = useMemo(() => ({
    free:     desks.filter(d => d.isOnline && !d.isOccupied && !d.currentReservation).length,
    occupied: desks.filter(d => d.isOccupied).length,
    total:    desks.filter(d => d.status === 'ACTIVE').length,
  }), [desks]);

  const verifyPin = useCallback(async (pin: string) => {
    try {
      const res = await appApi.locations.verifyKioskPin(locationId, pin);
      return res?.ok === true;
    } catch {
      return false;
    }
  }, [locationId]);

  const handlePinSuccess = () => {
    setExiting(true);
    document.exitFullscreen?.().catch(() => {});
    window.history.back();
  };

  // Error state — brak locationId w URL
  if (!locationId) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 text-center px-8">
        <span className="text-5xl">🖥️</span>
        <p className="text-white text-xl font-bold">{t('kiosk.no_location_title')}</p>
        <p className="text-zinc-400 text-sm max-w-xs">{t('kiosk.no_location_hint')}</p>
        <code className="text-xs text-zinc-600 bg-zinc-900 px-3 py-1.5 rounded-lg mt-2">
          /kiosk?location=&lt;id&gt;
        </code>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-zinc-700 border-t-brand rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white select-none overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur px-6 py-4 border-b border-zinc-800
        flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-brand font-black text-2xl">R</span>
          <div>
            <p className="font-bold text-lg leading-none">{location?.name ?? t('kiosk.default_office')}</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {t('kiosk.last_update')}: {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Clock */}
        <div className="hidden sm:block text-center">
          <p className="text-xl font-mono font-bold text-white tabular-nums">{clock}</p>
          <p className="text-[10px] text-zinc-500">
            {new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
        </div>

        {/* KPI row */}
        <div className="flex gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-emerald-400">{stats.free}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">{t('kiosk.status.free')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-400">{stats.occupied}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">{t('kiosk.status.occupied')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-400">{stats.total}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">{t('kiosk.total')}</p>
          </div>
        </div>

        {/* Install / Exit buttons */}
        <div className="flex items-center gap-2">
          {installEvt && (
            <button onClick={doInstall}
              className="text-xs text-zinc-400 hover:text-white transition-colors px-3 py-2
                border border-zinc-700 rounded-xl hover:border-zinc-500">
              {t('kiosk.install_btn')}
            </button>
          )}
          <button onClick={() => setPinOpen(true)}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors px-3 py-2
              border border-zinc-800 rounded-xl hover:border-zinc-600">
            {t('kiosk.exit_btn')}
          </button>
        </div>
      </div>

      {/* Desk grid */}
      <div className="px-6 py-6">
        {Array.from(grouped.entries()).map(([zone, zDesks]) => (
          <div key={zone} className="mb-8">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">{zone}</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3">
              {zDesks.map(d => <DeskTile key={d.id} desk={d} />)}
            </div>
          </div>
        ))}
      </div>

      <Legend />

      {/* PIN exit modal */}
      {pinOpen && !exiting && (
        <PinModal
          onClose={() => setPinOpen(false)}
          onSuccess={handlePinSuccess}
          onVerify={verifyPin}
        />
      )}
    </div>
  );
}
