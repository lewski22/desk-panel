/**
 * IntegrationsPage — Sprint F2
 * Katalog integracji per organizacja + stepper konfiguracji
 *
 * apps/unified/src/pages/IntegrationsPage.tsx
 * Route: /settings/integrations
 * Roles: SUPER_ADMIN, OWNER
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation }     from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { appApi }             from '../api/client';
import { IntegrationCard }    from '../components/integrations/IntegrationCard';
import { AzureConfigForm }    from '../components/integrations/forms/AzureConfigForm';
import type { IntegrationStatus } from '../components/integrations/IntegrationCard';

type Provider = 'AZURE_ENTRA' | 'GOOGLE_WORKSPACE' | 'GRAFANA';
type ActiveForm = Provider | null;

const MsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect width="8" height="8" fill="white" opacity=".95"/>
    <rect x="10" width="8" height="8" fill="white" opacity=".6"/>
    <rect y="10" width="8" height="8" fill="white" opacity=".6"/>
    <rect x="10" y="10" width="8" height="8" fill="white" opacity=".4"/>
  </svg>
);

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M9 7v3h4.8a4.5 4.5 0 1 1-1.1-4.7L14.8 3.7A7.5 7.5 0 1 0 16.5 9H9V7z" fill="white"/>
  </svg>
);

const GrafanaIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="2" y="8" width="14" height="2" rx="1" fill="white"/>
    <rect x="7" y="3" width="4" height="12" rx="1" fill="white" opacity=".7"/>
  </svg>
);

export default function IntegrationsPage() {
  const { t }    = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const [integrations, setIntegrations] = useState<Record<string, any>>({});
  const [loading,      setLoading]      = useState(true);
  const [activeForm,   setActiveForm]   = useState<ActiveForm>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('consent') === 'done') {
      setActiveForm('AZURE_ENTRA');
      navigate(location.pathname, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await appApi.integrations.list();
      const map: Record<string, any> = {};
      list.forEach((i: any) => { map[i.provider] = i; });
      setIntegrations(map);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getStatus = (provider: string): IntegrationStatus => {
    const i = integrations[provider];
    if (!i) return 'available';
    if (i.lastTestOk === false) return 'error';
    if (i.isEnabled) return 'connected';
    return 'configuring';
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-5 h-5 border-2 border-zinc-200 border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  if (activeForm === 'AZURE_ENTRA') {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-800">{t('integrations.page_title')}</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{t('integrations.page_sub')}</p>
        </div>
        <div className="max-w-2xl">
          <AzureConfigForm
            integration={integrations['AZURE_ENTRA']}
            onSaved={() => { load(); setActiveForm(null); }}
            onCancel={() => setActiveForm(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-800">{t('integrations.page_title')}</h1>
        <p className="text-sm text-zinc-400 mt-0.5">{t('integrations.page_sub')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-2xl mb-6">
        <IntegrationCard
          id="AZURE_ENTRA"
          name="Azure Entra ID"
          description="SSO · Teams · Outlook · Microsoft 365"
          logo={<MsIcon />}
          logoColor="#0078D4"
          status={getStatus('AZURE_ENTRA')}
          onSelect={() => setActiveForm('AZURE_ENTRA')}
        />
        <IntegrationCard
          id="GOOGLE_WORKSPACE"
          name="Google Workspace"
          description="SSO przez Google OAuth 2.0"
          logo={<GoogleIcon />}
          logoColor="#EA4335"
          status={getStatus('GOOGLE_WORKSPACE')}
          onSelect={() => setActiveForm('GOOGLE_WORKSPACE')}
        />
        <IntegrationCard
          id="GRAFANA"
          name="Grafana"
          description="Metryki beaconów i dashboardy"
          logo={<GrafanaIcon />}
          logoColor="#0F6E56"
          status="available"
          onSelect={() => {}}
        />
      </div>

      {activeForm === 'GOOGLE_WORKSPACE' && (
        <div className="max-w-2xl border border-zinc-200 rounded-xl p-5 text-sm text-zinc-500 text-center">
          Konfiguracja Google Workspace — wkrótce dostępna
        </div>
      )}
    </div>
  );
}
