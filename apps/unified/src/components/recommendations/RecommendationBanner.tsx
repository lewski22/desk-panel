/**
 * RecommendationBanner — Sprint K1
 *
 * Dismissable banner nad mapą biurek pokazujący sugerowane biurko.
 * Znika po kliknięciu "Zarezerwuj" lub ✕.
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
  const { t } = useTranslation();

  const [rec,     setRec]     = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

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

  const subtitle = [
    rec.zone,
    rec.floor ? `P${rec.floor}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position:     'relative',
        background:   '#B53578',
        borderRadius: 12,
        padding:      16,
        marginBottom: 16,
        overflow:     'hidden',
      }}
    >
      {/* Decorative circles */}
      <div style={{ position: 'absolute', right: -18, top: -18, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 16, bottom: -28, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

      {/* Dismiss button */}
      <button
        onClick={dismiss}
        aria-label={t('recommendations.dismiss_aria')}
        style={{
          position:        'absolute',
          top:             6,
          right:           8,
          fontSize:        14,
          color:           'rgba(255,255,255,0.5)',
          background:      'none',
          border:          'none',
          cursor:          'pointer',
          fontFamily:      'Sora, sans-serif',
          lineHeight:      1,
          minWidth:        44,
          minHeight:       44,
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
        }}
      >
        ✕
      </button>

      {/* Eyebrow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', flexShrink: 0 }} />
        <span style={{
          fontFamily:    'Sora, sans-serif',
          fontSize:      10,
          fontWeight:    600,
          color:         'rgba(255,255,255,0.65)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {t('recommendations.suggested_eyebrow', 'Polecane dla Ciebie')}
        </span>
      </div>

      {/* Desk name */}
      <p style={{
        fontFamily: 'Sora, sans-serif',
        fontSize:   17,
        fontWeight: 700,
        color:      '#fff',
        margin:     '0 0 2px 0',
        lineHeight: 1.2,
      }}>
        {rec.deskCode || rec.deskName}
      </p>

      {/* Subtitle */}
      {subtitle && (
        <p style={{
          fontFamily: 'DM Sans, sans-serif',
          fontSize:   12,
          color:      'rgba(255,255,255,0.65)',
          margin:     '0 0 12px 0',
        }}>
          {subtitle}
        </p>
      )}

      {/* Bottom row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Status badge */}
        <span style={{
          display:    'inline-flex',
          alignItems: 'center',
          gap:        5,
          background: 'rgba(255,255,255,0.18)',
          borderRadius: 20,
          padding:    '4px 10px',
          fontFamily: 'DM Sans, sans-serif',
          fontSize:   11,
          fontWeight: 500,
          color:      '#fff',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', flexShrink: 0 }} />
          {t('resource.status.free')}
        </span>

        {/* CTA button */}
        <button
          onClick={handleReserve}
          style={{
            background:   'rgba(255,255,255,0.15)',
            border:       '1px solid rgba(255,255,255,0.4)',
            borderRadius: 8,
            fontFamily:   'Sora, sans-serif',
            fontSize:     12,
            fontWeight:   600,
            color:        '#fff',
            padding:      '6px 14px',
            cursor:       'pointer',
          }}
        >
          {t('deskcard.book')} →
        </button>
      </div>
    </div>
  );
}
