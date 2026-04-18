/**
 * SlackConfigForm — Sprint F2
 * apps/unified/src/components/integrations/forms/SlackConfigForm.tsx
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi }         from '../../../api/client';
import { Field, Toggle, FormActions, styles } from './AzureConfigForm';

interface Integration {
  publicConfig?: { defaultChannel?: string; notifyOnReservation?: boolean; notifyOnCheckin?: boolean; notifyOnBeaconAlert?: boolean; notifyOnGatewayAlert?: boolean; hasToken?: boolean };
  isEnabled?:    boolean;
}

interface Props { integration?: Integration | null; onSaved: () => void; onCancel: () => void; }

export function SlackConfigForm({ integration, onSaved, onCancel }: Props) {
  const { t } = useTranslation();
  const pub = integration?.publicConfig ?? {};

  const [botToken,            setBotToken]            = useState('');
  const [signingSecret,       setSigningSecret]       = useState('');
  const [defaultChannel,      setDefaultChannel]      = useState(pub.defaultChannel ?? '#desk-bookings');
  const [notifyReservation,   setNotifyReservation]   = useState(pub.notifyOnReservation   ?? true);
  const [notifyCheckin,       setNotifyCheckin]       = useState(pub.notifyOnCheckin       ?? true);
  const [notifyBeacon,        setNotifyBeacon]        = useState(pub.notifyOnBeaconAlert   ?? true);
  const [notifyGateway,       setNotifyGateway]       = useState(pub.notifyOnGatewayAlert  ?? true);
  const [isEnabled,           setIsEnabled]           = useState(integration?.isEnabled    ?? false);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSave = async () => {
    if (!defaultChannel.trim()) { setError(t('integrations.slack.default_channel') + ' jest wymagany'); return; }
    if (!pub.hasToken && !botToken.trim()) { setError(t('integrations.slack.bot_token') + ' jest wymagany'); return; }

    setSaving(true); setError('');
    try {
      const config: Record<string, unknown> = {
        defaultChannel:      defaultChannel.trim(),
        notifyOnReservation: notifyReservation,
        notifyOnCheckin:     notifyCheckin,
        notifyOnBeaconAlert: notifyBeacon,
        notifyOnGatewayAlert: notifyGateway,
      };
      if (botToken)      config.botToken      = botToken;
      if (signingSecret) config.signingSecret = signingSecret;

      await appApi.integrations.upsert('SLACK', {
        config,
        displayName: `Slack · ${defaultChannel.trim()}`,
        tenantHint:  defaultChannel.trim(),
        isEnabled,
      });
      onSaved();
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Błąd zapisu'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <h3 style={styles.title}>{t('integrations.providers.SLACK.name')}</h3>

      <div style={styles.infoBox}>
        <p style={styles.infoTitle}>Jak dodać bota Slack</p>
        <p style={styles.infoBody}>1. Utwórz aplikację Slack na api.slack.com → Create New App → From scratch<br />2. Włącz: OAuth &amp; Permissions → dodaj scope <code>chat:write</code><br />3. Zainstaluj aplikację w workspace → skopiuj Bot Token (xoxb-...)<br />4. Zaproś bota do kanału: <code>/invite @NazwaAplikacji</code></p>
      </div>

      <Field label={t('integrations.slack.bot_token')} hint={t('integrations.slack.bot_token_hint')}>
        <input type="password" value={botToken} onChange={e => setBotToken(e.target.value)}
          placeholder={pub.hasToken ? '••••••• (bez zmian)' : t('integrations.slack.bot_token_placeholder')}
          style={styles.input} />
      </Field>

      <Field label={t('integrations.slack.signing_secret')} hint={t('integrations.slack.signing_secret_hint')}>
        <input type="password" value={signingSecret} onChange={e => setSigningSecret(e.target.value)}
          placeholder="••••••• (bez zmian)" style={styles.input} />
      </Field>

      <Field label={t('integrations.slack.default_channel')} hint={t('integrations.slack.default_channel_hint')}>
        <input value={defaultChannel} onChange={e => setDefaultChannel(e.target.value)}
          placeholder={t('integrations.slack.default_channel_placeholder')} style={styles.input} />
      </Field>

      <p style={styles.sectionLabel}>Powiadomienia</p>

      {[
        { label: t('integrations.slack.notify_reservation'), value: notifyReservation, set: setNotifyReservation },
        { label: t('integrations.slack.notify_checkin'),     value: notifyCheckin,     set: setNotifyCheckin },
        { label: t('integrations.slack.notify_beacon'),      value: notifyBeacon,      set: setNotifyBeacon },
        { label: t('integrations.slack.notify_gateway'),     value: notifyGateway,     set: setNotifyGateway },
      ].map(item => (
        <div key={item.label} style={{ ...styles.toggleRow, padding: '7px 0' }}>
          <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{item.label}</span>
          <Toggle value={item.value} onChange={item.set} />
        </div>
      ))}

      <div style={styles.toggleRow}>
        <div>
          <span style={styles.toggleLabel}>Włącz integrację Slack</span>
        </div>
        <Toggle value={isEnabled} onChange={setIsEnabled} />
      </div>

      <FormActions error={error} saving={saving} onSave={handleSave} onCancel={onCancel} />
    </div>
  );
}
