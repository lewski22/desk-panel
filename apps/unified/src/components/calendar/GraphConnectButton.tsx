/**
 * GraphConnectButton — Sprint F (M4)
 *
 * Przycisk "Połącz Outlook Calendar" w ustawieniach usera lub panelu integracji.
 * Wywołuje /auth/graph/redirect → Microsoft OAuth2 → /auth/graph/callback.
 *
 * apps/unified/src/components/integrations/GraphConnectButton.tsx
 */
import { useState, useEffect } from 'react';
import { useTranslation }       from 'react-i18next';
import { appApi }               from '../../api/client';

interface GraphStatus {
  connected:  boolean;
  tokenValid?: boolean;
}

export function GraphConnectButton() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'en';

  const [status,       setStatus]       = useState<GraphStatus | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message,      setMessage]      = useState('');

  useEffect(() => {
    // Sprawdź query params po powrocie z OAuth
    const params = new URLSearchParams(window.location.search);
    if (params.get('graph_connected') === '1') {
      setMessage(lang === 'pl' ? '✅ Outlook Calendar połączony pomyślnie' : '✅ Outlook Calendar connected');
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('graph_error')) {
      setMessage((lang === 'pl' ? '❌ Błąd połączenia: ' : '❌ Connection error: ') +
        decodeURIComponent(params.get('graph_error') ?? ''));
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Pobierz status
    appApi.graph.status()
      .then(setStatus)
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false));
  }, []);

  const connect = () => {
    window.location.href = `${import.meta.env.VITE_API_URL ?? 'https://api.prohalw2026.ovh/api/v1'}/auth/graph/redirect`;
  };

  const disconnect = async () => {
    if (!window.confirm(lang === 'pl' ? 'Odłączyć Outlook Calendar?' : 'Disconnect Outlook Calendar?')) return;
    setDisconnecting(true);
    try {
      await appApi.graph.disconnect();
      setStatus({ connected: false });
      setMessage(lang === 'pl' ? 'Odłączono Outlook Calendar' : 'Outlook Calendar disconnected');
    } catch {
      setMessage(lang === 'pl' ? 'Błąd rozłączania' : 'Disconnect failed');
    } finally { setDisconnecting(false); }
  };

  if (loading) {
    return <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>
      {lang === 'pl' ? 'Sprawdzanie...' : 'Checking...'}
    </div>;
  }

  return (
    <div style={{
      border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10,
      padding: '14px 16px', background: 'var(--color-background-primary)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Ikona Microsoft */}
        <svg width="24" height="24" viewBox="0 0 23 23" fill="none" style={{ flexShrink: 0 }}>
          <rect x="1"  y="1"  width="10" height="10" fill="#F25022"/>
          <rect x="12" y="1"  width="10" height="10" fill="#7FBA00"/>
          <rect x="1"  y="12" width="10" height="10" fill="#00A4EF"/>
          <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
        </svg>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            Outlook Calendar
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {status?.connected
              ? (lang === 'pl' ? 'Połączono — rezerwacje synchronizowane z kalendarzem' : 'Connected — reservations synced with calendar')
              : (lang === 'pl' ? 'Nie połączono — kliknij aby zsynchronizować z Outlook' : 'Not connected — click to sync with Outlook')}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Status dot */}
          <span style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: status?.connected && status.tokenValid !== false
              ? 'var(--color-text-success)'
              : status?.connected
              ? 'var(--color-text-warning)'
              : 'var(--color-text-tertiary)',
          }} />

          {status?.connected ? (
            <>
              <button
                onClick={connect}
                style={btnStyle}
                title={lang === 'pl' ? 'Odnów autoryzację' : 'Re-authorize'}
              >
                ↻
              </button>
              <button
                onClick={disconnect}
                disabled={disconnecting}
                style={{ ...btnStyle, color: 'var(--color-text-danger)' }}
              >
                {disconnecting ? '…' : (lang === 'pl' ? 'Odłącz' : 'Disconnect')}
              </button>
            </>
          ) : (
            <button onClick={connect} style={{ ...btnStyle, background: '#0078d4', color: '#fff', border: 'none', padding: '6px 14px' }}>
              {lang === 'pl' ? 'Połącz' : 'Connect'}
            </button>
          )}
        </div>
      </div>

      {/* Status message */}
      {message && (
        <p style={{
          fontSize: 12,
          marginTop: 10,
          color: message.startsWith('✅') ? 'var(--color-text-success)' : 'var(--color-text-danger)',
        }}>
          {message}
        </p>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  fontSize: 12, padding: '5px 12px', borderRadius: 8,
  border: '0.5px solid var(--color-border-secondary)',
  background: 'transparent', color: 'var(--color-text-secondary)',
  cursor: 'pointer',
};
