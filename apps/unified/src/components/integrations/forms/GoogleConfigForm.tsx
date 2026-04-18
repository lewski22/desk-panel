/**
 * GoogleConfigForm — Sprint F3
 * apps/unified/src/components/integrations/forms/GoogleConfigForm.tsx
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi }         from '../../../api/client';
import { Field, Toggle, FormActions, styles } from './AzureConfigForm';

interface Integration {
  publicConfig?: { allowedDomain?: string; hasClientSecret?: boolean };
  isEnabled?:    boolean;
}

interface Props { integration?: Integration | null; onSaved: () => void; onCancel: () => void; }

const REDIRECT_URI = `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/google/callback`;

export function GoogleConfigForm({ integration, onSaved, onCancel }: Props) {
  const { t } = useTranslation();
  const pub = integration?.publicConfig ?? {};

  const [clientId,      setClientId]      = useState('');
  const [clientSecret,  setClientSecret]  = useState('');
  const [allowedDomain, setAllowedDomain] = useState(pub.allowedDomain ?? '');
  const [isEnabled,     setIsEnabled]     = useState(integration?.isEnabled ?? false);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSave = async () => {
    if (!allowedDomain.trim()) { setError(t('integrations.google.allowed_domain') + ' jest wymagany'); return; }
    if (!pub.hasClientSecret && !clientId.trim()) { setError(t('integrations.google.client_id') + ' jest wymagany'); return; }

    setSaving(true); setError('');
    try {
      const config: Record<string, unknown> = {
        allowedDomain: allowedDomain.trim().toLowerCase(),
      };
      if (clientId)     config.clientId     = clientId.trim();
      if (clientSecret) config.clientSecret = clientSecret;

      await appApi.integrations.upsert('GOOGLE_WORKSPACE', {
        config,
        displayName: `Google Workspace · ${allowedDomain.trim()}`,
        tenantHint:  allowedDomain.trim(),
        isEnabled,
      });
      onSaved();
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Błąd zapisu'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <h3 style={styles.title}>{t('integrations.providers.GOOGLE_WORKSPACE.name')}</h3>

      {/* Setup guide */}
      <div style={styles.infoBox}>
        <p style={styles.infoTitle}>{t('integrations.google.setup_title')}</p>
        {[1,2,3,4,5].map(n => (
          <p key={n} style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            {n}. {t(`integrations.google.setup_step${n}`)}
          </p>
        ))}
        <p style={{ ...styles.infoBody, marginTop: 8, marginBottom: 0 }}>
          <strong>Authorized redirect URI:</strong>{' '}
          <code style={{ fontSize: 11, background: 'var(--color-background-primary)', padding: '2px 6px', borderRadius: 4 }}>
            {REDIRECT_URI}
          </code>
        </p>
      </div>

      <Field label={t('integrations.google.client_id')}>
        <input value={clientId} onChange={e => setClientId(e.target.value)}
          placeholder={pub.hasClientSecret ? '••• (bez zmian)' : t('integrations.google.client_id_placeholder')}
          style={{ ...styles.input, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
      </Field>

      <Field label={t('integrations.google.client_secret')}>
        <input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)}
          placeholder={pub.hasClientSecret ? '••••••• (bez zmian)' : t('integrations.google.client_secret_placeholder')}
          style={styles.input} />
      </Field>

      <Field label={t('integrations.google.allowed_domain')} hint={t('integrations.google.allowed_domain_hint')}>
        <input value={allowedDomain} onChange={e => setAllowedDomain(e.target.value)}
          placeholder={t('integrations.google.allowed_domain_placeholder')} style={styles.input} />
      </Field>

      <div style={styles.toggleRow}>
        <span style={styles.toggleLabel}>Włącz logowanie przez Google</span>
        <Toggle value={isEnabled} onChange={setIsEnabled} />
      </div>

      <FormActions error={error} saving={saving} onSave={handleSave} onCancel={onCancel} />
    </div>
  );
}
