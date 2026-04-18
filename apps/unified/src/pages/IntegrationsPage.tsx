/**
 * IntegrationsPage — Sprint F
 *
 * Marketplace integracji per organizacja.
 * Każda integracja to karta z statusem + przycisk konfiguracji.
 *
 * apps/unified/src/pages/IntegrationsPage.tsx
 *
 * Route: /settings/integrations
 * Roles: SUPER_ADMIN, OWNER
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { appApi }         from '../api/client';
import { ProviderCard }   from '../components/integrations/ProviderCard';
import { AzureConfigForm }   from '../components/integrations/forms/AzureConfigForm';
import { SlackConfigForm }   from '../components/integrations/forms/SlackConfigForm';
import { GoogleConfigForm }  from '../components/integrations/forms/GoogleConfigForm';
import { TeamsConfigForm }   from '../components/integrations/forms/TeamsConfigForm';
import { WebhookConfigForm } from '../components/integrations/forms/WebhookConfigForm';

// ── Typy ────────────────────────────────────────────────────────
type Provider = 'AZURE_ENTRA' | 'SLACK' | 'GOOGLE_WORKSPACE' | 'MICROSOFT_TEAMS' | 'WEBHOOK_CUSTOM';

interface Integration {
  id:            string;
  provider:      Provider;
  isEnabled:     boolean;
  displayName:   string | null;
  tenantHint:    string | null;
  hasConfig:     boolean;
  lastTestedAt:  string | null;
  lastTestOk:    boolean | null;
  lastTestError: string | null;
  publicConfig?: Record<string, unknown>;
}

const PROVIDER_ORDER: Provider[] = [
  'AZURE_ENTRA',
  'GOOGLE_WORKSPACE',
  'SLACK',
  'MICROSOFT_TEAMS',
  'WEBHOOK_CUSTOM',
];

// ── Component ────────────────────────────────────────────────────
export default function IntegrationsPage() {
  const { t } = useTranslation();

  const [integrations, setIntegrations] = useState<Map<Provider, Integration>>(new Map());
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [configuring,  setConfiguring]  = useState<Provider | null>(null);
  const [testing,      setTesting]      = useState<Provider | null>(null);
  const [testResult,   setTestResult]   = useState<{ provider: Provider; ok: boolean; msg: string } | null>(null);

  // ── Load ─────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list: Integration[] = await appApi.integrations.list();
      const map = new Map<Provider, Integration>();
      for (const item of list) map.set(item.provider as Provider, item);
      setIntegrations(map);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Błąd ładowania integracji');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Handlers ──────────────────────────────────────────────────
  const handleToggle = async (provider: Provider, isEnabled: boolean) => {
    try {
      const updated = await appApi.integrations.toggle(provider, isEnabled);
      setIntegrations(prev => new Map(prev).set(provider, updated));
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Błąd zmiany statusu');
    }
  };

  const handleRemove = async (provider: Provider) => {
    if (!window.confirm(t('integrations.remove_confirm'))) return;
    try {
      await appApi.integrations.remove(provider);
      setIntegrations(prev => {
        const next = new Map(prev);
        next.delete(provider);
        return next;
      });
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Błąd usuwania');
    }
  };

  const handleTest = async (provider: Provider) => {
    setTesting(provider);
    setTestResult(null);
    try {
      const r = await appApi.integrations.test(provider);
      setTestResult({ provider, ok: r.ok, msg: r.message });
      // Odśwież wynik testu w danych
      await load();
    } catch (e: any) {
      setTestResult({ provider, ok: false, msg: e?.response?.data?.message ?? 'Błąd testu' });
    } finally {
      setTesting(null);
    }
  };

  const handleSaved = async () => {
    setConfiguring(null);
    await load();
  };

  // ── Render ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--color-border-secondary)', borderTopColor: '#B53578', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 }}>
          {t('integrations.page_title')}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
          {t('integrations.page_sub')}
        </p>
      </div>

      {/* Błąd globalny */}
      {error && (
        <div style={{ background: 'var(--color-background-danger)', color: 'var(--color-text-danger)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Wynik testu */}
      {testResult && (
        <div style={{
          background: testResult.ok ? 'var(--color-background-success)' : 'var(--color-background-danger)',
          color: testResult.ok ? 'var(--color-text-success)' : 'var(--color-text-danger)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>{testResult.ok ? '✅' : '❌'}</span>
          <span>{testResult.msg}</span>
          <button onClick={() => setTestResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.6 }}>×</button>
        </div>
      )}

      {/* Formularz konfiguracji */}
      {configuring && (
        <div style={{ border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: '20px 16px', marginBottom: 20, background: 'var(--color-background-primary)' }}>
          {configuring === 'AZURE_ENTRA'       && <AzureConfigForm   integration={integrations.get('AZURE_ENTRA')}         onSaved={handleSaved} onCancel={() => setConfiguring(null)} />}
          {configuring === 'SLACK'              && <SlackConfigForm   integration={integrations.get('SLACK')}               onSaved={handleSaved} onCancel={() => setConfiguring(null)} />}
          {configuring === 'GOOGLE_WORKSPACE'   && <GoogleConfigForm  integration={integrations.get('GOOGLE_WORKSPACE')}    onSaved={handleSaved} onCancel={() => setConfiguring(null)} />}
          {configuring === 'MICROSOFT_TEAMS'    && <TeamsConfigForm   integration={integrations.get('MICROSOFT_TEAMS')}     onSaved={handleSaved} onCancel={() => setConfiguring(null)} />}
          {configuring === 'WEBHOOK_CUSTOM'     && <WebhookConfigForm integration={integrations.get('WEBHOOK_CUSTOM')}      onSaved={handleSaved} onCancel={() => setConfiguring(null)} />}
        </div>
      )}

      {/* Provider cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {PROVIDER_ORDER.map(provider => (
          <ProviderCard
            key={provider}
            provider={provider}
            integration={integrations.get(provider) ?? null}
            isConfiguring={configuring === provider}
            isTesting={testing === provider}
            onConfigure={() => setConfiguring(configuring === provider ? null : provider)}
            onToggle={(enabled) => handleToggle(provider, enabled)}
            onTest={() => handleTest(provider)}
            onRemove={() => handleRemove(provider)}
          />
        ))}
      </div>
    </div>
  );
}
