/**
 * ProviderCard — Sprint F
 *
 * Karta integracji: status + przyciski akcji.
 * apps/unified/src/components/integrations/ProviderCard.tsx
 */
import { useTranslation } from 'react-i18next';

type Provider = 'AZURE_ENTRA' | 'SLACK' | 'GOOGLE_WORKSPACE' | 'MICROSOFT_TEAMS' | 'WEBHOOK_CUSTOM';

interface Integration {
  provider:      Provider;
  isEnabled:     boolean;
  displayName:   string | null;
  hasConfig:     boolean;
  lastTestedAt:  string | null;
  lastTestOk:    boolean | null;
  lastTestError: string | null;
}

interface Props {
  provider:      Provider;
  integration:   Integration | null;
  isConfiguring: boolean;
  isTesting:     boolean;
  onConfigure:   () => void;
  onToggle:      (enabled: boolean) => void;
  onTest:        () => void;
  onRemove:      () => void;
}

const PROVIDER_ICONS: Record<Provider, string> = {
  AZURE_ENTRA:       '🔵',
  SLACK:             '💬',
  GOOGLE_WORKSPACE:  '🟢',
  MICROSOFT_TEAMS:   '🟣',
  WEBHOOK_CUSTOM:    '🔗',
};

export function ProviderCard({
  provider, integration, isConfiguring, isTesting,
  onConfigure, onToggle, onTest, onRemove,
}: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const isConnected  = !!integration?.hasConfig;
  const isEnabled    = !!integration?.isEnabled;
  const testOk       = integration?.lastTestOk;
  const testErr      = integration?.lastTestError;
  const lastTested   = integration?.lastTestedAt;

  const providerName = t(`integrations.providers.${provider}.name`);
  const providerDesc = t(`integrations.providers.${provider}.description`);

  // Status
  let statusLabel: string;
  let statusColor: string;

  if (!isConnected) {
    statusLabel = t('integrations.not_configured');
    statusColor = 'var(--color-text-tertiary)';
  } else if (!isEnabled) {
    statusLabel = t('integrations.disabled');
    statusColor = 'var(--color-text-warning)';
  } else if (testOk === false) {
    statusLabel = t('integrations.test_fail');
    statusColor = 'var(--color-text-danger)';
  } else {
    statusLabel = t('integrations.connected');
    statusColor = 'var(--color-text-success)';
  }

  const borderColor = isConnected && isEnabled
    ? (testOk === false ? 'var(--color-border-danger)' : 'var(--color-border-success)')
    : 'var(--color-border-tertiary)';

  return (
    <div
      style={{
        border: `0.5px solid ${isConfiguring ? '#B53578' : borderColor}`,
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--color-background-primary)',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Header */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{PROVIDER_ICONS[provider]}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {providerName}
          </div>
          {integration?.displayName && (
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>
              {integration.displayName}
            </div>
          )}
        </div>
        {/* Status dot */}
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: statusColor,
          flexShrink: 0,
        }} title={statusLabel} />
      </div>

      {/* Description */}
      <div style={{ padding: '0 16px 12px', fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
        {providerDesc}
      </div>

      {/* Test result */}
      {testOk === false && testErr && (
        <div style={{ margin: '0 12px 10px', padding: '6px 10px', background: 'var(--color-background-danger)', borderRadius: 6, fontSize: 11, color: 'var(--color-text-danger)' }}>
          {testErr}
        </div>
      )}
      {testOk === true && lastTested && (
        <div style={{ margin: '0 12px 10px', padding: '6px 10px', background: 'var(--color-background-success)', borderRadius: 6, fontSize: 11, color: 'var(--color-text-success)' }}>
          ✓ {t('integrations.test_ok')} · {new Date(lastTested).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB')}
        </div>
      )}

      {/* Actions */}
      <div style={{ padding: '10px 12px 12px', borderTop: '0.5px solid var(--color-border-tertiary)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {/* Configure button */}
        <button
          onClick={onConfigure}
          style={{
            fontSize: 12, padding: '5px 12px', borderRadius: 8,
            border: isConfiguring ? '0.5px solid #B53578' : '0.5px solid var(--color-border-secondary)',
            background: isConfiguring ? '#B53578' : 'transparent',
            color: isConfiguring ? '#fff' : 'var(--color-text-primary)',
            cursor: 'pointer', fontWeight: 500,
          }}
        >
          {isConnected ? t('integrations.edit') : t('integrations.configure')}
        </button>

        {/* Test button — tylko jeśli skonfigurowane */}
        {isConnected && (
          <button
            onClick={onTest}
            disabled={isTesting}
            style={{
              fontSize: 12, padding: '5px 12px', borderRadius: 8,
              border: '0.5px solid var(--color-border-secondary)',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              cursor: isTesting ? 'default' : 'pointer',
              opacity: isTesting ? 0.6 : 1,
            }}
          >
            {isTesting ? t('integrations.testing') : t('integrations.test')}
          </button>
        )}

        {/* Enable/Disable toggle — tylko jeśli skonfigurowane */}
        {isConnected && (
          <button
            onClick={() => onToggle(!isEnabled)}
            style={{
              fontSize: 12, padding: '5px 12px', borderRadius: 8,
              border: '0.5px solid var(--color-border-secondary)',
              background: 'transparent',
              color: isEnabled ? 'var(--color-text-warning)' : 'var(--color-text-success)',
              cursor: 'pointer',
            }}
          >
            {isEnabled ? t('integrations.disable') : t('integrations.enable')}
          </button>
        )}

        {/* Remove — tylko jeśli skonfigurowane, na końcu */}
        {isConnected && (
          <button
            onClick={onRemove}
            style={{
              fontSize: 12, padding: '5px 10px', borderRadius: 8,
              border: 'none', background: 'transparent',
              color: 'var(--color-text-tertiary)',
              cursor: 'pointer', marginLeft: 'auto',
            }}
            title={t('integrations.remove')}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
