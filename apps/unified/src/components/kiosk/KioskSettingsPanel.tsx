import { useState, useEffect } from 'react';
import { useTranslation }      from 'react-i18next';
import { KioskSettings }       from '../../types';
import { appApi }              from '../../api/client';

interface Props {
  current:  KioskSettings;
  onSave:   (updated: KioskSettings) => void;
  onClose:  () => void;
}

export function KioskSettingsPanel({ current, onSave, onClose }: Props) {
  const { t }                     = useTranslation();
  const [draft, setDraft]         = useState<KioskSettings>(current);
  const [locations, setLocations] = useState<any[]>([]);
  const [floors,    setFloors]    = useState<string[]>([]);
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState('');

  useEffect(() => {
    appApi.locations.listAll()
      .then((locs: any[]) => setLocations(locs.filter((l: any) => l.isActive)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!draft.locationId) return;
    appApi.locations.floors(draft.locationId)
      .then(setFloors)
      .catch(() => setFloors([]));
  }, [draft.locationId]);

  const handleSave = async () => {
    setSaving(true); setErr('');
    try {
      await appApi.kiosk.updateSettings(draft);
      onSave(draft);
    } catch (e: any) {
      setErr(e.message ?? 'Błąd zapisu');
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof KioskSettings>(key: K, val: KioskSettings[K]) =>
    setDraft(d => ({ ...d, [key]: val }));

  const btnBase     = 'px-3 py-2.5 rounded-lg text-sm font-semibold border transition-colors min-h-[44px]';
  const btnActive   = `${btnBase} bg-brand text-white border-brand`;
  const btnInactive = `${btnBase} bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-500`;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      role="dialog" aria-modal="true">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl
        overflow-y-auto max-h-[85vh]">
        <h2 className="text-white font-semibold text-base mb-5">
          ⚙️ {t('kiosk.settings_title', 'Ustawienia kiosku')}
        </h2>

        {err && (
          <div className="mb-4 p-2 rounded-lg bg-red-950 border border-red-900/50 text-red-400 text-xs">
            {err}
          </div>
        )}

        {/* Lokalizacja */}
        <div className="mb-4">
          <p className="text-zinc-400 text-xs font-medium mb-1.5">
            📍 {t('kiosk.settings_location', 'Lokalizacja')}
          </p>
          <select
            value={draft.locationId}
            onChange={e => { set('locationId', e.target.value); set('floor', null); }}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2
              text-white text-sm focus:outline-none focus:border-brand"
          >
            {locations.map((l: any) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* Piętro */}
        {floors.length > 0 && (
          <div className="mb-4">
            <p className="text-zinc-400 text-xs font-medium mb-1.5">
              🏢 {t('kiosk.settings_floor', 'Piętro')}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => set('floor', null)}
                className={draft.floor === null ? btnActive : btnInactive}
              >
                {t('kiosk.settings_floor_all', 'Wszystkie')}
              </button>
              {floors.map(f => (
                <button key={f}
                  onClick={() => set('floor', f)}
                  className={draft.floor === f ? btnActive : btnInactive}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tryb wyświetlania */}
        <div className="mb-4">
          <p className="text-zinc-400 text-xs font-medium mb-1.5">
            📊 {t('kiosk.settings_display_mode', 'Tryb wyświetlania')}
          </p>
          <div className="flex gap-2">
            {(['tiles', 'map'] as const).map(mode => (
              <button key={mode}
                onClick={() => set('displayMode', mode)}
                className={`flex-1 ${draft.displayMode === mode ? btnActive : btnInactive}`}
              >
                {mode === 'tiles'
                  ? `⊞ ${t('kiosk.settings_mode_tiles', 'Kafelki')}`
                  : `🗺 ${t('kiosk.settings_mode_map', 'Mapa')}`
                }
              </button>
            ))}
          </div>
        </div>

        {/* Kolumny — tylko dla trybu tiles */}
        {draft.displayMode === 'tiles' && (
          <div className="mb-4">
            <p className="text-zinc-400 text-xs font-medium mb-1.5">
              {t('kiosk.settings_columns', 'Kolumny siatki')}
            </p>
            <div className="flex gap-2">
              {(['auto', 4, 6, 8, 10] as const).map(c => (
                <button key={c}
                  onClick={() => set('columns', c)}
                  className={`flex-1 ${draft.columns === c ? btnActive : btnInactive}`}
                >
                  {c === 'auto' ? t('kiosk.settings_columns_auto', 'Auto') : c}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Interwał odświeżania */}
        <div className="mb-6">
          <p className="text-zinc-400 text-xs font-medium mb-1.5">
            🔄 {t('kiosk.settings_refresh', 'Odświeżanie')}
          </p>
          <div className="flex gap-2">
            {([15, 30, 60] as const).map(s => (
              <button key={s}
                onClick={() => set('refreshInterval', s)}
                className={`flex-1 ${draft.refreshInterval === s ? btnActive : btnInactive}`}
              >
                {s}s
              </button>
            ))}
          </div>
        </div>

        {/* Akcje */}
        <div className="flex gap-3">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-3 min-h-[44px] rounded-xl text-sm text-zinc-400 border border-zinc-700
              hover:border-zinc-500 transition-colors disabled:opacity-40">
            {t('kiosk.settings_cancel', 'Anuluj')}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 min-h-[44px] rounded-xl text-sm font-semibold bg-brand text-white
              hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2">
            {saving
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('kiosk.settings_save', 'Zapisz')}</>
              : t('kiosk.settings_save', 'Zapisz')
            }
          </button>
        </div>
      </div>
    </div>
  );
}
