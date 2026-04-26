import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface Step {
  key: string;
  done: boolean;
  href: string;
}

interface Props {
  desksCount:   number;
  hasPlan:      boolean;
  usersCount:   number;
  beaconsCount: number;
  locationId:   string;
}

const STORAGE_KEY = 'onboarding_dismissed';

export function OnboardingChecklist({ desksCount, hasPlan, usersCount, beaconsCount, locationId }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');

  const steps: Step[] = [
    { key: 'desks',    done: desksCount > 0,   href: '/desks' },
    { key: 'plan',     done: hasPlan,           href: `/floor-plan/${locationId}` },
    { key: 'users',    done: usersCount > 1,    href: '/users' },
    { key: 'beacon',   done: beaconsCount > 0,  href: '/desks' },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;

  if (dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="mb-5 border border-violet-200 bg-violet-50/60 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-violet-800">{t('onboarding.title', 'Konfiguracja biura')}</p>
          <p className="text-xs text-violet-600 mt-0.5">
            {allDone
              ? t('onboarding.complete', 'Gotowe! Biuro skonfigurowane.')
              : t('onboarding.progress', '{{done}}/{{total}} kroków ukończonych', { done: doneCount, total: steps.length })}
          </p>
        </div>
        <button onClick={dismiss} className="text-violet-400 hover:text-violet-600 text-lg leading-none" aria-label="Zamknij">×</button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-violet-200 rounded-full mb-3 overflow-hidden">
        <div
          className="h-full bg-violet-500 rounded-full transition-all"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {steps.map(step => (
          <button
            key={step.key}
            onClick={() => !step.done && navigate(step.href)}
            className={`flex items-center gap-2 text-left px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
              step.done
                ? 'bg-violet-100 border-violet-200 text-violet-700 cursor-default'
                : 'bg-white border-zinc-200 text-zinc-600 hover:border-violet-300 hover:bg-violet-50'
            }`}
          >
            <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
              step.done ? 'bg-violet-500 text-white' : 'bg-zinc-200 text-zinc-400'
            }`}>
              {step.done ? '✓' : ''}
            </span>
            {t(`onboarding.step.${step.key}`, step.key)}
          </button>
        ))}
      </div>
    </div>
  );
}
