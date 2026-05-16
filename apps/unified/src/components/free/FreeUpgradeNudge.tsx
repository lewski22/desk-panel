import React from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  plan:          string;
  ghostPct?:     number;
  deskUsagePct?: number;
}

export function FreeUpgradeNudge({ plan, ghostPct, deskUsagePct }: Props) {
  const { t } = useTranslation();

  if (plan !== 'free') return null;

  const showGhost = typeof ghostPct     === 'number' && ghostPct     > 20;
  const showLimit = typeof deskUsagePct === 'number' && deskUsagePct > 80;
  if (!showGhost && !showLimit) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50
                    px-4 py-3 flex items-start gap-3">
      <span className="text-xl shrink-0">💡</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800">
          {showGhost
            ? t('free_nudge.ghost_title', { pct: ghostPct })
            : t('free_nudge.limit_title', { pct: deskUsagePct })}
        </p>
        <p className="text-xs text-amber-600 mt-0.5">
          {showGhost
            ? t('free_nudge.ghost_body')
            : t('free_nudge.limit_body')}
        </p>
      </div>
      <a
        href="mailto:hello@reserti.com?subject=Upgrade%20Reserti"
        className="shrink-0 text-xs font-semibold text-amber-700 border
                   border-amber-300 rounded-lg px-3 py-1.5 hover:bg-amber-100
                   transition-colors whitespace-nowrap"
      >
        {t('free_nudge.cta')}
      </a>
    </div>
  );
}
