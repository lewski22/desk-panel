import { useState } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import { outlookApi } from '../api/client';

interface Props {
  onLogin: (user: any) => void;
}

export function LoginPage({ onLogin }: Props) {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [step,    setStep]    = useState<'email' | 'sso' | 'checking'>('email');
  const [tenantId, setTenantId] = useState('');

  const checkEmail = async () => {
    if (!email.includes('@')) return;
    setLoading(true); setError('');
    try {
      const res = await outlookApi.auth.checkSso(email);
      if (!res.available || !res.tenantId) {
        setError('Logowanie przez Microsoft nie jest skonfigurowane dla tej domeny. Skontaktuj się z administratorem.');
        setStep('email');
      } else {
        setTenantId(res.tenantId);
        setStep('sso');
      }
    } catch {
      setError('Nie można sprawdzić konfiguracji SSO. Sprawdź połączenie internetowe.');
    }
    setLoading(false);
  };

  const loginWithMicrosoft = async () => {
    if (!tenantId) return;
    setLoading(true); setError('');
    try {
      const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
      if (!clientId) throw new Error('VITE_AZURE_CLIENT_ID nie jest skonfigurowany');

      const msal = new PublicClientApplication({
        auth: {
          clientId,
          authority:   `https://login.microsoftonline.com/${tenantId}`,
          redirectUri: window.location.origin,
        },
        cache: { cacheLocation: 'sessionStorage' },
      });
      await msal.initialize();

      const result = await msal.loginPopup({
        scopes:      ['openid', 'profile', 'email'],
        loginHint:   email,
        prompt:      'select_account',
      });

      if (!result?.idToken) throw new Error('Brak tokenu od Microsoft');

      const user = await outlookApi.auth.loginAzure(result.idToken);
      onLogin(user);
    } catch (e: any) {
      if (e.errorCode !== 'user_cancelled') {
        setError(e.message ?? 'Logowanie nie powiodło się. Spróbuj ponownie.');
      }
      setStep('sso');
    }
    setLoading(false);
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", padding: '24px', minHeight: '100vh', background: '#f8f9fa' }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ fontSize: '28px', fontWeight: 900, color: '#B53578', letterSpacing: '-1px' }}>R</div>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a', letterSpacing: '3px' }}>RESERTI</div>
        <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>Desk Booking</div>
      </div>

      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
          padding: '10px 12px', marginBottom: '16px', fontSize: '12px', color: '#dc2626',
        }}>
          {error}
        </div>
      )}

      {step === 'email' && (
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#555', marginBottom: '6px', fontWeight: 600 }}>
            Adres email firmowy
          </label>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && checkEmail()}
            placeholder="jan@twoja-firma.pl"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '8px',
              border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box',
              outline: 'none',
            }}
            autoFocus
          />
          <button
            onClick={checkEmail}
            disabled={loading || !email.includes('@')}
            style={{
              width: '100%', marginTop: '12px', padding: '10px',
              background: loading ? '#e5e7eb' : '#B53578',
              color: loading ? '#9ca3af' : '#fff',
              border: 'none', borderRadius: '8px', fontSize: '14px',
              fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Sprawdzanie…' : 'Dalej'}
          </button>
        </div>
      )}

      {step === 'sso' && (
        <div>
          <p style={{ fontSize: '13px', color: '#555', marginBottom: '16px', textAlign: 'center' }}>
            Zaloguj się przez konto Microsoft powiązane z <strong>{email}</strong>
          </p>
          <button
            onClick={loginWithMicrosoft}
            disabled={loading}
            style={{
              width: '100%', padding: '10px', background: '#fff',
              border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px',
              fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            }}
          >
            {loading ? (
              <span>Logowanie…</span>
            ) : (
              <>
                {/* Microsoft logo */}
                <svg width="18" height="18" viewBox="0 0 21 21">
                  <rect x="1"  y="1"  width="9" height="9" fill="#f25022"/>
                  <rect x="11" y="1"  width="9" height="9" fill="#7fba00"/>
                  <rect x="1"  y="11" width="9" height="9" fill="#00a4ef"/>
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                </svg>
                Zaloguj przez Microsoft
              </>
            )}
          </button>
          <button
            onClick={() => { setStep('email'); setError(''); }}
            style={{
              width: '100%', marginTop: '8px', padding: '8px',
              background: 'transparent', border: 'none',
              fontSize: '12px', color: '#888', cursor: 'pointer',
            }}
          >
            ← Zmień email
          </button>
        </div>
      )}
    </div>
  );
}
