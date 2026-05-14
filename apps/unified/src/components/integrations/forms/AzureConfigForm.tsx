import React, { useState } from 'react';
import { appApi }                    from '../../../api/client';
import { IntegrationSetupShell }     from '../IntegrationSetupShell';
import { AzureStep1Consent }         from './AzureStep1Consent';
import { AzureStep2Connection }      from './AzureStep2Connection';
import { AzureStep3LoginOptions }    from './AzureStep3LoginOptions';
import { AzureStep4Done }            from './AzureStep4Done';

const MsLogo = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect width="8" height="8" fill="white" opacity=".95"/>
    <rect x="10" width="8" height="8" fill="white" opacity=".6"/>
    <rect y="10" width="8" height="8" fill="white" opacity=".6"/>
    <rect x="10" y="10" width="8" height="8" fill="white" opacity=".4"/>
  </svg>
);

const STEPS = [
  { label: 'Zgoda admina',  sublabel: 'Global Admin Azure' },
  { label: 'Połączenie',    sublabel: 'Tenant ID i domeny' },
  { label: 'Logowanie',     sublabel: 'Opcje SSO' },
  { label: 'Gotowe',        sublabel: 'Podsumowanie' },
];

interface Integration {
  publicConfig?: {
    tenantId?: string; useCustomApp?: boolean;
    allowedDomains?: string[]; hasClientSecret?: boolean;
  };
  isEnabled?: boolean;
}

interface Props {
  integration?: Integration | null;
  onSaved:      () => void;
  onCancel:     () => void;
}

export function AzureConfigForm({ integration, onSaved, onCancel }: Props) {
  const pub = integration?.publicConfig ?? {};

  const consentDoneFromUrl = new URLSearchParams(window.location.search).get('consent') === 'done';
  const [step, setStep] = useState(0);
  const [consentDone, setConsentDone] = useState(consentDoneFromUrl);

  const [tenantId,       setTenantId]       = useState(pub.tenantId ?? '');
  const [allowedDomains, setAllowedDomains] = useState((pub.allowedDomains ?? []).join(', '));
  const [useCustomApp,   setUseCustomApp]   = useState(pub.useCustomApp ?? false);
  const [clientId,       setClientId]       = useState('');
  const [clientSecret,   setClientSecret]   = useState('');
  const [isEnabled,      setIsEnabled]      = useState(integration?.isEnabled ?? false);
  const [forceSSO,       setForceSSO]       = useState(false);
  const [autoProvision,  setAutoProvision]  = useState(true);
  const [testResult,     setTestResult]     = useState<'ok' | 'fail' | 'testing' | null>(null);
  const [doneTest,       setDoneTest]       = useState<'ok' | 'fail' | null>(null);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState('');

  const adminConsentUrl = (() => {
    const clientIdEnv = (import.meta as any).env?.VITE_AZURE_CLIENT_ID ?? 'AZURE_CLIENT_ID';
    const redirectUri  = `${window.location.origin}/settings/integrations`;
    return `https://login.microsoftonline.com/organizations/adminconsent?client_id=${clientIdEnv}&redirect_uri=${encodeURIComponent(redirectUri)}&prompt=login`;
  })();

  const handleTest = async () => {
    if (!tenantId) return;
    setTestResult('testing');
    try {
      const r = await fetch(
        `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`
      );
      setTestResult(r.ok ? 'ok' : 'fail');
    } catch { setTestResult('fail'); }
  };

  const handleSave = async () => {
    if (!tenantId.trim()) { setError('Tenant ID jest wymagany'); return; }
    const guidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!guidRx.test(tenantId.trim())) { setError('Tenant ID musi być w formacie GUID'); return; }

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
      setStep(3);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Błąd zapisu');
    } finally {
      setSaving(false);
    }
  };

  const canGoNext = () => {
    if (step === 1) return tenantId.trim().length > 0;
    return true;
  };

  const handleNext = async () => {
    if (step === 2) { await handleSave(); return; }
    if (step < 3)   setStep(s => s + 1);
    else             onSaved();
  };

  const stepContent = [
    <AzureStep1Consent adminConsentUrl={adminConsentUrl} consentDone={consentDone} onConsentDone={setConsentDone} />,
    <AzureStep2Connection
      tenantId={tenantId}           onTenantId={setTenantId}
      allowedDomains={allowedDomains} onDomains={setAllowedDomains}
      useCustomApp={useCustomApp}   onCustomApp={setUseCustomApp}
      clientId={clientId}           onClientId={setClientId}
      clientSecret={clientSecret}   onClientSecret={setClientSecret}
      hasClientSecret={pub.hasClientSecret}
      testResult={testResult}       onTest={handleTest}
      error={error}
    />,
    <AzureStep3LoginOptions
      isEnabled={isEnabled}           onEnabled={setIsEnabled}
      forceSSO={forceSSO}             onForceSSO={setForceSSO}
      autoProvision={autoProvision}   onAutoProvision={setAutoProvision}
    />,
    <AzureStep4Done
      tenantId={tenantId}
      onTestConnection={async () => {
        try {
          const r = await fetch(
            `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`
          );
          setDoneTest(r.ok ? 'ok' : 'fail');
        } catch { setDoneTest('fail'); }
      }}
      testResult={doneTest}
    />,
  ];

  return (
    <IntegrationSetupShell
      logo={<MsLogo />}
      logoColor="#0078D4"
      title="Azure Entra ID"
      subtitle="Microsoft 365 · Single Sign-On · Teams · Outlook"
      steps={STEPS}
      currentStep={step}
      onBack={step > 0 ? () => setStep(s => s - 1) : undefined}
      onNext={step < 3 ? handleNext : onSaved}
      onCancel={onCancel}
      nextDisabled={!canGoNext()}
      nextLoading={saving}
      isLastStep={step === 2}
    >
      {stepContent[step]}
    </IntegrationSetupShell>
  );
}

export { AzureConfigForm as default };
