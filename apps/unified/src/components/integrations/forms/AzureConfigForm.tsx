/**
 * AzureConfigForm — Sprint F1
 *
 * Formularz konfiguracji Azure Entra ID SSO per org.
 * Obsługuje: globalną Reserti App Registration + BYOA.
 * Admin consent link wygenerowany dynamicznie z VITE_AZURE_CLIENT_ID.
 *
 * apps/unified/src/components/integrations/forms/AzureConfigForm.tsx
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi }         from '../../../api/client';

interface Integration {
  publicConfig?: { tenantId?: string; useCustomApp?: boolean; allowedDomains?: string[]; hasClientSecret?: boolean };
  isEnabled?:    boolean;
  displayName?:  string | null;
}

interface Props {
  integration?: Integration | null;
  onSaved:      () => void;
  onCancel:     () => void;
}

export function AzureConfigForm({ integration, onSaved, onCancel }: Props) {
  const { t } = useTranslation();
  const pub = integration?.publicConfig ?? {};

  const [tenantId,       setTenantId]       = useState(pub.tenantId ?? '');
  const [useCustomApp,   setUseCustomApp]   = useState(pub.useCustomApp ?? false);
  const [clientId,       setClientId]       = useState('');
  const [clientSecret,   setClientSecret]   = useState('');
  const [allowedDomains, setAllowedDomains] = useState((pub.allowedDomains ?? []).join(', '));
  const [isEnabled,      setIsEnabled]      = useState(integration?.isEnabled ?? false);

  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const adminConsentUrl = (() => {
    const clientIdEnv = (import.meta as any).env?.VITE_AZURE_CLIENT_ID ?? 'AZURE_CLIENT_ID';
    return `https://login.microsoftonline.com/organizations/adminconsent?client_id=${clientIdEnv}&redirect_uri=${encodeURIComponent(window.location.origin)}`;
  })();

  const handleSave = async () => {
    if (!tenantId.trim()) { setError(t('integrations.azure.tenant_id') + ' jest wymagany'); return; }

    const guidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!guidRx.test(tenantId.trim())) {
      setError('Tenant ID musi być w formacie GUID');
      return;
    }

    setSaving(true); setError('');
    try {
      const config: Record<string, unknown> = {
        tenantId:       tenantId.trim(),
        useCustomApp,
        allowedDomains: allowedDomains.split(',').map(d => d.trim()).filter(Boolean),
        groupSync:      false,
      };
      if (useCustomApp && clientId)     config.clientId     = clientId.trim();
      if (useCustomApp && clientSecret) config.clientSecret = clientSecret;

      await appApi.integrations.upsert('AZURE_ENTRA', {
        config,
        displayName: `Azure Entra · ${tenantId.trim().slice(0, 8)}…`,
        tenantHint:  tenantId.trim(),
        isEnabled,
      });
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Błąd zapisu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3 style={styles.title}>{t('integrations.providers.AZURE_ENTRA.name')}</h3>

      {/* Step 1 — Admin consent */}
      <div style={styles.infoBox}>
        <p style={styles.infoTitle}>{t('integrations.azure.admin_consent_title')}</p>
        <p style={styles.infoBody}>{t('integrations.azure.admin_consent_body')}</p>
        <a href={adminConsentUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>
          {t('integrations.azure.admin_consent_btn')} ↗
        </a>
      </div>

      {/* Step 2 — Tenant ID */}
      <p style={styles.sectionLabel}>{t('integrations.azure.tenant_id_title')}</p>

      <Field label={t('integrations.azure.tenant_id')} hint={t('integrations.azure.tenant_id_hint')}>
        <input
          value={tenantId} onChange={e => setTenantId(e.target.value)}
          placeholder={t('integrations.azure.tenant_id_placeholder')}
          style={{ ...styles.input, fontFamily: 'var(--font-mono)', fontSize: 12 }}
        />
      </Field>

      <Field label={t('integrations.azure.allowed_domains')} hint={t('integrations.azure.allowed_domains_hint')}>
        <input
          value={allowedDomains} onChange={e => setAllowedDomains(e.target.value)}
          placeholder={t('integrations.azure.allowed_domains_placeholder')}
          style={styles.input}
        />
      </Field>

      {/* BYOA toggle */}
      <div style={styles.toggleRow}>
        <div>
          <span style={styles.toggleLabel}>{t('integrations.azure.use_custom_app')}</span>
          <p style={styles.toggleHint}>{t('integrations.azure.use_custom_app_hint')}</p>
        </div>
        <Toggle value={useCustomApp} onChange={setUseCustomApp} />
      </div>

      {/* BYOA fields */}
      {useCustomApp && (
        <div style={{ paddingLeft: 12, borderLeft: '2px solid var(--color-border-info)', marginBottom: 14 }}>
          <Field label={t('integrations.azure.client_id')}>
            <input
              value={clientId} onChange={e => setClientId(e.target.value)}
              placeholder={t('integrations.azure.client_id_placeholder')}
              style={{ ...styles.input, fontFamily: 'var(--font-mono)', fontSize: 12 }}
            />
          </Field>
          <Field label={t('integrations.azure.client_secret')}>
            <input
              type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)}
              placeholder={pub.hasClientSecret ? '••••••• (bez zmian)' : t('integrations.azure.client_secret_placeholder')}
              style={styles.input}
            />
          </Field>
        </div>
      )}

      {/* Enable SSO */}
      <div style={styles.toggleRow}>
        <div>
          <span style={styles.toggleLabel}>{t('integrations.azure.sso_enabled_label')}</span>
          <p style={styles.toggleHint}>{t('integrations.azure.sso_enabled_hint')}</p>
        </div>
        <Toggle value={isEnabled} onChange={setIsEnabled} />
      </div>

      <FormActions error={error} saving={saving} onSave={handleSave} onCancel={onCancel} />
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={styles.label}>{label}</label>
      {children}
      {hint && <p style={styles.hint}>{hint}</p>}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: value ? '#B53578' : 'var(--color-border-secondary)',
        position: 'relative', flexShrink: 0, transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        left: value ? 18 : 2,
      }} />
    </button>
  );
}

function FormActions({ error, saving, onSave, onCancel }: { error: string; saving: boolean; onSave: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  return (
    <div>
      {error && <p style={{ fontSize: 12, color: 'var(--color-text-danger)', marginBottom: 10 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={styles.btnSecondary}>{t('integrations.cancel')}</button>
        <button onClick={onSave} disabled={saving} style={styles.btnPrimary}>
          {saving ? t('integrations.saving') : t('integrations.save')}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title:        { fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 16 },
  infoBox:      { background: 'var(--color-background-info)', border: '0.5px solid var(--color-border-info)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 },
  infoTitle:    { fontSize: 13, fontWeight: 500, color: 'var(--color-text-info)', marginBottom: 4 },
  infoBody:     { fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8, lineHeight: 1.5 },
  link:         { fontSize: 12, color: 'var(--color-text-info)', textDecoration: 'none', fontWeight: 500 },
  sectionLabel: { fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 10 },
  label:        { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 5 },
  hint:         { fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4, lineHeight: 1.4 },
  input:        { width: '100%', fontSize: 13, padding: '7px 10px', borderRadius: 8, border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', boxSizing: 'border-box' as const },
  toggleRow:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderTop: '0.5px solid var(--color-border-tertiary)', marginBottom: 14 },
  toggleLabel:  { fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' },
  toggleHint:   { fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 },
  btnPrimary:   { fontSize: 13, padding: '7px 18px', borderRadius: 8, border: 'none', background: '#B53578', color: '#fff', cursor: 'pointer', fontWeight: 500 },
  btnSecondary: { fontSize: 13, padding: '7px 16px', borderRadius: 8, border: '0.5px solid var(--color-border-secondary)', background: 'transparent', color: 'var(--color-text-primary)', cursor: 'pointer' },
};

export { Field, Toggle, FormActions, styles };
