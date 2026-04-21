/**
 * InsightsWidget — Sprint K2
 *
 * Wyświetla listę wygenerowanych insightów zajętości.
 * Używany w:
 *   - DashboardPage (kompaktowy — max 3 insighty)
 *   - ReportsPage (pełny — wszystkie insighty + refresh)
 *   - OwnerPage (per-lokalizacja — wszystkie orgi)
 *
 * apps/unified/src/components/insights/InsightsWidget.tsx
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi }         from '../../api/client';

// ── Typy ──────────────────────────────────────────────────────
type InsightType =
  | 'PEAK_DAY' | 'UNDERUTILIZED_ZONE' | 'GHOST_DESKS'
  | 'MORNING_RUSH' | 'NFC_VS_QR' | 'AVG_DURATION';

type InsightSeverity = 'info' | 'warning' | 'success';

interface InsightItem {
  type:     InsightType;
  title:    string;
  body:     string;
  metric:   number;
  unit:     string;
  severity: InsightSeverity;
}

interface Props {
  locationId:  string;
  compact?:    boolean; // true = max 3, no refresh btn
  showRefresh?: boolean;
}

// ── Severity config ───────────────────────────────────────────
const SEV: Record<InsightSeverity, { bg: string; text: string; border: string; icon: string }> = {
  info:    { bg: 'var(--color-background-info)',    text: 'var(--color-text-info)',    border: 'var(--color-border-info)',    icon: 'ℹ️' },
  warning: { bg: 'var(--color-background-warning)', text: 'var(--color-text-warning)', border: 'var(--color-border-warning)', icon: '⚠️' },
  success: { bg: 'var(--color-background-success)', text: 'var(--color-text-success)', border: 'var(--color-border-success)', icon: '✅' },
};

const TYPE_ICON: Record<InsightType, string> = {
  PEAK_DAY:           '📅',
  UNDERUTILIZED_ZONE: '🗺️',
  GHOST_DESKS:        '👻',
  MORNING_RUSH:       '🌅',
  NFC_VS_QR:          '📱',
  AVG_DURATION:       '⏱️',
};

// ── Component ─────────────────────────────────────────────────
export function InsightsWidget({ locationId, compact = false, showRefresh = false }: Props) {
  const { t } = useTranslation();

  const [insights,   setInsights]   = useState<InsightItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await appApi.insights.getForLocation(locationId);
      setInsights(r?.insights ?? []);
    } catch {
      setError(t('insights.load_error'));
    } finally {
      setLoading(false);
    }
  }, [locationId, t]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await appApi.insights.refresh(locationId);
      setInsights(r?.insights ?? []);
    } catch {
      setError(t('insights.refresh_error'));
    } finally {
      setRefreshing(false);
    }
  }, [locationId, t]);

  useEffect(() => { load(); }, [load]);

  const displayed = compact ? insights.slice(0, 3) : insights;

  if (loading) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center' }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          border: '2px solid var(--color-border-secondary)',
          borderTopColor: '#B53578',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontSize: 13, color: 'var(--color-text-danger)', padding: '8px 0' }}>
        {error}
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', padding: '12px 0', textAlign: 'center' }}>
        {t('insights.no_data')}
      </div>
    );
  }

  return (
    <div>
      {/* Header z refresh */}
      {showRefresh && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {t('insights.title')}
          </p>
          <button
            onClick={refresh}
            disabled={refreshing}
            style={{
              fontSize: 12, padding: '4px 10px', borderRadius: 8,
              border: '0.5px solid var(--color-border-secondary)',
              background: 'transparent', color: 'var(--color-text-secondary)',
              cursor: refreshing ? 'default' : 'pointer', opacity: refreshing ? 0.6 : 1,
            }}
          >
            {refreshing ? '…' : `↻ ${t('btn.refresh')}`}
          </button>
        </div>
      )}

      {/* Insight cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {displayed.map((item, i) => {
          const sev = SEV[item.severity];
          return (
            <div
              key={i}
              style={{
                display:      'flex',
                gap:          12,
                alignItems:   'flex-start',
                padding:      '10px 12px',
                borderRadius: 10,
                background:   sev.bg,
                border:       `0.5px solid ${sev.border}`,
              }}
            >
              {/* Icon */}
              <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                {TYPE_ICON[item.type]}
              </span>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {item.title}
                  </span>
                  {/* Metric badge */}
                  <span style={{
                    fontSize: 11, fontWeight: 500,
                    padding: '1px 7px', borderRadius: 999,
                    background: 'var(--color-background-primary)',
                    color: sev.text,
                    border: `0.5px solid ${sev.border}`,
                    flexShrink: 0,
                  }}>
                    {item.metric}{item.unit}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  {item.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* "Pokaż więcej" w compact mode */}
      {compact && insights.length > 3 && (
        <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 8, textAlign: 'center' }}>
          {t('insights.more', { count: insights.length - 3 })}
        </p>
      )}
    </div>
  );
}

// ── Multi-location variant (OwnerPage) ────────────────────────
interface OrgInsightsProps {
  orgId?: string;
}

interface LocationInsights {
  locationId:   string;
  locationName: string;
  insights:     InsightItem[];
}

export function OrgInsightsWidget({ orgId }: OrgInsightsProps) {
  const { t } = useTranslation();

  const [data,    setData]    = useState<LocationInsights[]>([]);
  const [loading, setLoading] = useState(true);
  const [open,    setOpen]    = useState<string | null>(null);

  useEffect(() => {
    appApi.insights.getForOrg(orgId)
      .then(r => setData(r?.locations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId]);

  if (loading) return <div style={{ padding: 16, color: 'var(--color-text-tertiary)', fontSize: 13 }}>
    {t('insights.loading')}
  </div>;

  if (data.length === 0) return <div style={{ padding: 16, color: 'var(--color-text-tertiary)', fontSize: 13 }}>
    {t('insights.no_insights')}
  </div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.map(loc => (
        <div key={loc.locationId} style={{ border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10 }}>
          <button
            onClick={() => setOpen(open === loc.locationId ? null : loc.locationId)}
            style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)',
            }}
          >
            <span>{loc.locationName}</span>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              {loc.insights.length} {t('insights.count')}
              {' '}{open === loc.locationId ? '▲' : '▼'}
            </span>
          </button>
          {open === loc.locationId && (
            <div style={{ padding: '0 14px 14px' }}>
              <InsightsWidget locationId={loc.locationId} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
