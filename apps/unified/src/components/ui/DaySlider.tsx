import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const browserTZ = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function todayLocal(tz?: string) {
  return new Date().toLocaleDateString('sv-SE', { timeZone: tz ?? browserTZ() });
}

interface Props {
  selected:    string;
  onChange:    (d: string) => void;
  pastDays?:   number;
  futureDays?: number;
  minDate?:    string;
  timezone?:   string;
}

export function DaySlider({ selected, onChange, pastDays = 3, futureDays = 14, minDate, timezone }: Props) {
  const { i18n } = useTranslation();
  const tz       = timezone ?? browserTZ();
  const today    = todayLocal(tz);
  const lang     = i18n.language === 'en' ? 'en-GB' : 'pl-PL';

  const days = useMemo(() => {
    const result: string[] = [];
    const base = new Date();
    base.setDate(base.getDate() - pastDays);
    for (let i = 0; i <= pastDays + futureDays; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      result.push(d.toLocaleDateString('sv-SE', { timeZone: tz }));
    }
    return result;
  }, [pastDays, futureDays, tz]);

  const fmt = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00Z');
    return {
      day: d.toLocaleDateString(lang, { day: 'numeric',  timeZone: tz }),
      dow: d.toLocaleDateString(lang, { weekday: 'short', timeZone: tz }),
    };
  };

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {days.map(dateStr => {
        const { day, dow } = fmt(dateStr);
        const isToday    = dateStr === today;
        const isSelected = dateStr === selected;
        const isPast     = dateStr < today;
        const isDisabled = minDate ? dateStr < minDate : false;

        return (
          <button
            key={dateStr}
            onClick={() => !isDisabled && onChange(dateStr)}
            disabled={isDisabled}
            className={`flex-shrink-0 flex flex-col items-center px-3 py-1.5 rounded-xl border
                        text-xs font-medium transition-all min-w-[44px] ${
              isDisabled
                ? 'opacity-30 cursor-not-allowed bg-zinc-50 border-zinc-100'
                : isSelected
                ? 'bg-brand text-white border-brand'
                : isPast
                ? 'bg-zinc-50 text-zinc-400 border-zinc-100 hover:border-zinc-200'
                : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <span className={`text-[10px] mb-0.5 ${isSelected ? 'text-white/80' : 'text-zinc-400'}`}>
              {dow}
            </span>
            <span className="leading-none">{day}</span>
            {isToday && !isSelected && (
              <span className="mt-0.5 w-1 h-1 rounded-full bg-brand" />
            )}
          </button>
        );
      })}
    </div>
  );
}
