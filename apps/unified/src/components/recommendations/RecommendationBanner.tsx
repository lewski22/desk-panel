/**
 * RecommendationBanner — Sprint K1
 *
 * Dismissable banner nad mapą biurek pokazujący sugerowane biurko.
 * Znika po kliknięciu "Zarezerwuj" lub "Nie teraz".
 * Nie pojawia się więcej niż raz dziennie per user (localStorage).
 *
 * apps/unified/src/components/recommendations/RecommendationBanner.tsx
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi }         from '../../api/client';

interface Recommendation {
  deskId:      string;
  deskName:    string;
  deskCode:    string;
  zone:        string | null;
  floor:       string | null;
  score:       number;
  reason:      'FAVORITE' | 'FAVORITE_ZONE' | 'ANY_FREE';
  isOnline:    boolean;
  timesBooked: number;
}

interface Props {
  locationId:  string;
  userId:      string;
  date:        string; // YYYY-MM-DD
  start?:      string;
  end?:        string;
  onReserve:   (deskId: string) => void; // callback do otwarcia modalu
}

function getDismissKey(userId: string, date: string) {
  return `rec_dismissed_${userId}_${date}`;
}

export function RecommendationBanner({ locationId, userId, date, start, end, onReserve }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'en';

  const [rec,      setRec]      = useState<Recommendation | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [visible,  setVisible]  = useState(false);

  const dismissKey = getDismissKey(userId, date);

  const dismiss = useCallback(() => {
    localStorage.setItem(dismissKey, '1');
    setVisible(false);
  }, [dismissKey]);

  const handleReserve = useCallback(() => {
    if (!rec) return;
    dismiss();
    onReserve(rec.deskId);
  }, [rec, dismiss, onReserve]);

  useEffect(() => {
    // Sprawdź czy już odrzucony dzisiaj
    if (localStorage.getItem(dismissKey)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    appApi.desks.getRecommended({ locationId, date, start, end })
      .then((r: { recommendation: Recommendation | null }) => {
        if (r?.recommendation) {
          setRec(r.recommendation);
          setVisible(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId, date, start, end, dismissKey]);

  if (loading || !visible || !rec) return null;

  const reasonLabel: Record<string, string> = {
    FAVORITE:      lang === 'pl' ? 'Twoje ulubione biurko' : 'Your favorite desk',
    FAVORITE_ZONE: lang === 'pl' ? 'Ulubiona strefa'       : 'Your preferred zone',
    ANY_FREE:      lang === 'pl' ? 'Wolne biurko'           : 'Available desk',
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            12,
        background:     'var(--color-background-info)',
        border:         '0.5px solid var(--color-border-info)',
        borderRadius:   10,
        padding:        '10px 14px',
        marginBottom:   16,
        flexWrap:       'wrap',
      }}
    >
      {/* Ikona */}
      <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>

      {/* Tekst */}
      <div style={{ flex: 1, minWidth: 160 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-info)' }}>
          {lang === 'pl' ? 'Sugerowane' : 'Suggested'}:{' '}
          <strong>{rec.deskCode || rec.deskName}</strong>
        </span>
        {rec.zone && (
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginLeft: 8 }}>
            {rec.zone}{rec.floor ? ` · Piętro ${rec.floor}` : ''}
          </span>
        )}
        <span
          style={{
            display:      'inline-block',
            marginLeft:   8,
            fontSize:     11,
            color:        'var(--color-text-info)',
            background:   'var(--color-background-primary)',
            borderRadius: 999,
            padding:      '1px 7px',
            border:       '0.5px solid var(--color-border-info)',
          }}
        >
          {reasonLabel[rec.reason] ?? reasonLabel.ANY_FREE}
        </span>
        {rec.timesBooked > 0 && (
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginLeft: 6 }}>
            ({lang === 'pl' ? `${rec.timesBooked}× zarezerwowane` : `booked ${rec.timesBooked}×`})
          </span>
        )}
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={handleReserve}
          style={{
            fontSize:     12,
            fontWeight:   500,
            padding:      '5px 12px',
            borderRadius: 8,
            border:       'none',
            background:   '#B53578',
            color:        '#fff',
            cursor:       'pointer',
          }}
        >
          {lang === 'pl' ? '+ Zarezerwuj' : '+ Reserve'}
        </button>
        <button
          onClick={dismiss}
          aria-label={lang === 'pl' ? 'Odrzuć sugestię' : 'Dismiss suggestion'}
          style={{
            fontSize:     12,
            padding:      '5px 10px',
            borderRadius: 8,
            border:       '0.5px solid var(--color-border-secondary)',
            background:   'transparent',
            color:        'var(--color-text-secondary)',
            cursor:       'pointer',
          }}
        >
          {lang === 'pl' ? 'Nie teraz' : 'Not now'}
        </button>
      </div>
    </div>
  );
}
