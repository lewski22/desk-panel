/**
 * TeamsConfigForm — Sprint F4
 * apps/unified/src/components/integrations/forms/TeamsConfigForm.tsx
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi }         from '../../../api/client';
import { Field, Toggle, FormActions, styles } from './AzureConfigForm';

interface Integration {
  publicConfig?: { notifyOnReservation?: boolean; notifyOnCheckin?: boolean; notifyOnBeaconAlert?: boolean; notifyOnGatewayAlert?: boolean; hasWebhookUrl?: boolean };
  isEnabled?:    boolean;
}

interface Props { integration?: Integration | null; onSaved: () => void; onCancel: () => void; }

export function TeamsConfigForm({ integration, onSaved, onCancel }: Props) {
  const { t } = useTranslation();
  const pub = integration?.publicConfig ?? {};

  const [webhookUrl,        setWebhookUrl]        = useState('');
  const [notifyReservation, setNotifyReservation] = useState(pub.notifyOnReservation  ?? true);
  const [notifyCheckin,     setNotifyCheckin]     = useState(pub.notifyOnCheckin      ?? true);
  const [notifyBeacon,      setNotifyBeacon]      = useState(pub.notifyOnBeaconAlert  ?? true);
  const [notifyGateway,     setNotifyGateway]     = useState(pub.notifyOnGatewayAlert ?? true);
  const [isEnabled,         setIsEnabled]         = useState(integration?.isEnabled   ?? false);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSave = async () => {
    if (!pub.hasWebhookUrl && !webhookUrl.trim()) {
      setError(t('integrations.teams.webhook_url') + ' jest wymagany');
      return;
    }

    setSaving(true); setError('');
    try {
      const config: Record<string, unknown> = {
        notifyOnReservation:  notifyReservation,
        notifyOnCheckin:      notifyCheckin,
        notifyOnBeaconAlert:  notifyBeacon,
        notifyOnGatewayAlert: notifyGateway,
        mentionUserEnabled:   false,
      };
      if (webhookUrl.trim()) config.incomingWebhookUrl = webhookUrl.trim();

      await appApi.integrations.upsert('MICROSOFT_TEAMS', {
        config,
        displayName: 'Microsoft Teams',
        isEnabled,
      });
      onSaved();
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Błąd zapisu'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <h3 style={styles.title}>{t('integrations.providers.MICROSOFT_TEAMS.name')}</h3>

      <div style={styles.infoBox}>
        <p style={styles.infoTitle}>{t('integrations.teams.setup_title')}</p>
        {[1,2,3,4,5].map(n => (
          <p key={n} style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            {n}. {t(`integrations.teams.setup_step${n}`)}
          </p>
        ))}
      </div>

      <Field label={t('integrations.teams.webhook_url')} hint={t('integrations.teams.webhook_url_hint')}>
        <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
          placeholder={pub.hasWebhookUrl ? '••• webhook.office.com/... (bez zmian)' : t('integrations.teams.webhook_url_placeholder')}
          style={{ ...styles.input, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
      </Field>

      <p style={styles.sectionLabel}>Powiadomienia</p>

      {[
        { label: t('integrations.teams.notify_reservation'), value: notifyReservation, set: setNotifyReservation },
        { label: t('integrations.teams.notify_checkin'),     value: notifyCheckin,     set: setNotifyCheckin },
        { label: t('integrations.teams.notify_beacon'),      value: notifyBeacon,      set: setNotifyBeacon },
        { label: t('integrations.teams.notify_gateway'),     value: notifyGateway,     set: setNotifyGateway },
      ].map(item => (
        <div key={item.label} style={{ ...styles.toggleRow, padding: '7px 0' }}>
          <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{item.label}</span>
          <Toggle value={item.value} onChange={item.set} />
        </div>
      ))}

      <div style={styles.toggleRow}>
        <span style={styles.toggleLabel}>Włącz integrację Teams</span>
        <Toggle value={isEnabled} onChange={setIsEnabled} />
      </div>

      <FormActions error={error} saving={saving} onSave={handleSave} onCancel={onCancel} />
    </div>
  );
}
