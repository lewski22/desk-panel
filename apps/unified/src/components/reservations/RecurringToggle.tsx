/**
 * RecurringToggle — Sprint G1
 * UI wyboru cyklu rezerwacji w ReservationModal
 * Opcje: Nie powtarza / Codziennie / Co tydzień / Własna
 * Podgląd: lista dat które zostaną zarezerwowane
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format }          from 'date-fns';
import { pl, enUS }        from 'date-fns/locale';

export interface RecurrenceConfig {
  enabled: boolean;
  rule:    string;  // pełny RRULE string
  label:   string;  // opis dla użytkownika
}

interface Props {
  startDate: string;          // YYYY-MM-DD
  onChange:  (cfg: RecurrenceConfig) => void;
}

// Uproszczone opcje presetowe
const PRESETS = [
  { id: 'none',    label: 'recurring.none',    rule: '' },
  { id: 'daily',   label: 'recurring.daily',   rule: 'FREQ=DAILY;COUNT=5' },
  { id: 'weekly',  label: 'recurring.weekly',  rule: 'FREQ=WEEKLY;COUNT=4' },
  { id: 'monthly', label: 'recurring.monthly', rule: 'FREQ=WEEKLY;COUNT=8' }, // co tydzień x8 ≈ co miesiąc przez 2m
  { id: 'custom',  label: 'recurring.custom',  rule: '' },
] as const;

type PresetId = typeof PRESETS[number]['id'];

// Uproszczony preview — rozwiń reguły jak backend
function expandRule(startDate: string, rule: string, max = 8): string[] {
  if (!rule) return [];
  try {
    const parts: Record<string, string> = {};
    rule.replace(/^RRULE:/, '').split(';').forEach(p => {
      const [k, v] = p.split('='); parts[k] = v;
    });
    const freq  = parts['FREQ']  ?? 'WEEKLY';
    const count = parts['COUNT'] ? Math.min(parseInt(parts['COUNT']), max) : max;
    const DAY_MAP: Record<string, number> = { MO:1, TU:2, WE:3, TH:4, FR:5, SA:6, SU:0 };
    const targetDays = parts['BYDAY'] ? parts['BYDAY'].split(',').map(d => DAY_MAP[d] ?? 1) : null;

    const dates: string[] = [];
    const cur = new Date(startDate + 'T00:00:00');
    let iter = 0;
    while (dates.length < count && iter < 200) {
      iter++;
      const dow = cur.getDay();
      const ok  = freq === 'DAILY' || (freq === 'WEEKLY' && (!targetDays || targetDays.includes(dow)));
      if (ok) dates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + (freq === 'DAILY' ? 1 : 1));
      if (freq === 'WEEKLY' && !targetDays && dates.length < count) cur.setDate(cur.getDate() + 6);
    }
    return dates;
  } catch { return []; }
}

const WEEKDAYS = ['MO','TU','WE','TH','FR'] as const;
const WEEKDAY_LABELS: Record<string, string> = { MO:'Pn', TU:'Wt', WE:'Śr', TH:'Cz', FR:'Pt' };

export function RecurringToggle({ startDate, onChange }: Props) {
  const { t, i18n }  = useTranslation();
  const dfns           = i18n.language === 'en' ? enUS : pl;
  const [preset, setPreset]   = useState<PresetId>('none');
  const [count,  setCount]    = useState(4);
  const [byday,  setByday]    = useState<string[]>([]);

  // Buduj RRULE z custom opcji
  const customRule = useMemo(() => {
    if (preset !== 'custom') return '';
    const parts = [`FREQ=WEEKLY`, `COUNT=${count}`];
    if (byday.length > 0) parts.push(`BYDAY=${byday.join(',')}`);
    return parts.join(';');
  }, [preset, count, byday]);

  const activeRule = useMemo(() => {
    if (preset === 'none')   return '';
    if (preset === 'custom') return customRule;
    return PRESETS.find(p => p.id === preset)?.rule ?? '';
  }, [preset, customRule]);

  const preview = useMemo(() => expandRule(startDate, activeRule, 12), [startDate, activeRule]);

  // Powiadom rodzica przy każdej zmianie
  React.useEffect(() => {
    const label = t(PRESETS.find(p => p.id === preset)?.label ?? 'recurring.none');
    onChange({ enabled: preset !== 'none', rule: activeRule, label });
  }, [activeRule, preset]);

  const toggleDay = (d: string) =>
    setByday(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  return (
    <div className="space-y-3">
      {/* Preset selector */}
      <div>
        <label className="block text-xs text-zinc-500 font-medium mb-1.5">{t('recurring.label')}</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {PRESETS.map(p => (
            <button key={p.id} type="button"
              onClick={() => setPreset(p.id)}
              className={`py-2 px-2 rounded-xl text-xs font-medium border transition-all text-center ${
                preset === p.id
                  ? 'bg-brand text-white border-brand'
                  : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
              }`}>
              {t(p.label)}
            </button>
          ))}
        </div>
      </div>

      {/* Custom builder */}
      {preset === 'custom' && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-3">
          {/* Dni tygodnia */}
          <div>
            <p className="text-xs text-zinc-500 mb-1.5">{t('recurring.days_of_week')}</p>
            <div className="flex gap-1.5">
              {WEEKDAYS.map(d => (
                <button key={d} type="button"
                  onClick={() => toggleDay(d)}
                  className={`w-9 h-9 rounded-xl text-xs font-semibold transition-all border ${
                    byday.includes(d)
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                  }`}>
                  {WEEKDAY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          {/* Liczba powtórzeń */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-zinc-500">{t('recurring.count')}</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setCount(c => Math.max(1, c - 1))}
                className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-sm font-medium">−</button>
              <span className="text-sm font-semibold w-6 text-center">{count}</span>
              <button type="button" onClick={() => setCount(c => Math.min(52, c + 1))}
                className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-sm font-medium">+</button>
            </div>
            <span className="text-xs text-zinc-400">{t('recurring.count_suffix')}</span>
          </div>
        </div>
      )}

      {/* Preview dat */}
      {preview.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-1.5">
            {t('recurring.preview', { count: preview.length })}:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {preview.slice(0, 8).map(d => (
              <span key={d} className="text-[10px] bg-brand/10 text-brand border border-brand/20 px-2 py-1 rounded-lg font-medium">
                {format(new Date(d + 'T00:00'), 'dd MMM', { locale: dfns })}
              </span>
            ))}
            {preview.length > 8 && (
              <span className="text-[10px] text-zinc-400 px-2 py-1">+{preview.length - 8}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
